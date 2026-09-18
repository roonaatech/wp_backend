const path = require('path');
const fs = require('fs');
const nodeUtil = require('node:util');
const canvas = require('canvas');

// Polyfill nodeUtil for face-api ESM if needed
globalThis.nodeUtil = nodeUtil;

let faceapi = null;
let modelsLoaded = false;
let modelLoadingPromise = null;

/**
 * Initialize face-api environment and load neural network models on the server.
 */
async function init() {
    if (modelsLoaded) return true;
    if (modelLoadingPromise) return modelLoadingPromise;

    modelLoadingPromise = (async () => {
        try {
            // Dynamically import ESM face-api bundle
            const imported = await import('@vladmandic/face-api/dist/face-api.esm.js');
            faceapi = imported.default || imported;

            const { Canvas, Image, ImageData } = canvas;
            faceapi.env.monkeyPatch({
                Canvas,
                Image,
                ImageData,
                readFile: (p) => fs.promises.readFile(p)
            });

            if (faceapi.tf) {
                await faceapi.tf.setBackend('cpu');
                await faceapi.tf.ready();
            }

            const modelPath = path.resolve(__dirname, '../node_modules/@vladmandic/face-api/model');
            console.log(`[FaceBiometrics] Loading models from: ${modelPath}`);

            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
                faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
                faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath)
            ]);

            modelsLoaded = true;
            console.log('✅ [FaceBiometrics] Models loaded successfully on server.');
            return true;
        } catch (error) {
            console.error('❌ [FaceBiometrics] Failed to load face recognition models:', error);
            modelLoadingPromise = null;
            throw error;
        }
    })();

    return modelLoadingPromise;
}

/**
 * Helper to calculate Euclidean Distance between two 128-dimensional vectors.
 */
function getEuclideanDistance(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < arr1.length; i++) {
        sum += Math.pow(arr1[i] - arr2[i], 2);
    }
    return Math.sqrt(sum);
}

/**
 * Converts image inputs (base64 string, Data URL, Buffer, or file path) into a canvas Image.
 */
async function toCanvasImage(input) {
    if (!input) return null;
    if (typeof input === 'string') {
        if (input.startsWith('data:image') || input.startsWith('/9j/') || input.startsWith('iVBORw0KGgo')) {
            const base64Data = input.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            return canvas.loadImage(buffer);
        }
        if (fs.existsSync(input)) {
            return canvas.loadImage(input);
        }
    }
    if (Buffer.isBuffer(input)) {
        return canvas.loadImage(input);
    }
    return null;
}

/**
 * Server-side Face Detection and 128-d Feature Extraction.
 *
 * @param {string|Buffer} imageInput - Base64 Data URL, Base64 string, image Buffer, or file path.
 * @returns {Promise<{ descriptor: number[], score: number, box: object }|null>}
 */
async function extractDescriptor(imageInput) {
    if (!imageInput) return null;
    await init();

    const img = await toCanvasImage(imageInput);
    if (!img) return null;

    const detection = await faceapi.detectSingleFace(
        img,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
    ).withFaceLandmarks().withFaceDescriptor();

    if (!detection || !detection.descriptor) {
        return null;
    }

    return {
        descriptor: Array.from(detection.descriptor),
        score: detection.detection.score,
        box: {
            x: detection.detection.box.x,
            y: detection.detection.box.y,
            width: detection.detection.box.width,
            height: detection.detection.box.height
        }
    };
}

/**
 * 1-to-N Employee Identification.
 * Compares an incoming face image or precomputed descriptor against all active registered employees.
 *
 * @param {string|Buffer|number[]} input - Face snapshot image or 128-d descriptor array.
 * @param {Array} users - List of active users with registered `face_descriptor`.
 * @param {object} [options] - Configuration thresholds.
 * @returns {Promise<{ matched: boolean, user?: object, distance?: number, message?: string }>}
 */
async function identifyEmployee(input, users, options = {}) {
    const threshold = options.threshold ?? 0.45;
    const margin = options.margin ?? 0.03;

    let descriptor = null;
    if (Array.isArray(input) && input.length === 128) {
        descriptor = input;
    } else {
        const extracted = await extractDescriptor(input);
        if (!extracted) {
            return { matched: false, message: "No face detected in the provided image." };
        }
        descriptor = extracted.descriptor;
    }

    let bestMatch = null;
    let bestDistance = Infinity;
    let secondBestDistance = Infinity;

    for (const user of users) {
        if (!user.face_descriptor) continue;
        try {
            const stored = JSON.parse(user.face_descriptor);
            const dist = getEuclideanDistance(descriptor, stored);

            if (dist < bestDistance) {
                secondBestDistance = bestDistance;
                bestDistance = dist;
                bestMatch = user;
            } else if (dist < secondBestDistance) {
                secondBestDistance = dist;
            }
        } catch (_) {
            // Skip corrupted descriptors
        }
    }

    // Biometric match validation:
    // 1. Distance strictly lower than threshold (0.45)
    // 2. Clear candidate margin or near-zero distance (< 0.38)
    const hasClearMargin = (secondBestDistance === Infinity) || ((secondBestDistance - bestDistance) >= margin) || (bestDistance < 0.38);

    if (bestMatch && bestDistance < threshold && hasClearMargin) {
        return {
            matched: true,
            user: bestMatch,
            distance: bestDistance,
            descriptor
        };
    }

    return {
        matched: false,
        message: "Face not recognized.",
        closestDistance: bestDistance !== Infinity ? bestDistance : null
    };
}

/**
 * 1-to-1 Employee Verification against stored multi-angle templates.
 */
async function verifyEmployee(input, user, options = {}) {
    const frontThreshold = options.threshold ?? 0.60;
    const profileThreshold = options.profileThreshold ?? 0.72;

    let descriptor = null;
    if (Array.isArray(input) && input.length === 128) {
        descriptor = input;
    } else {
        const extracted = await extractDescriptor(input);
        if (!extracted) {
            return { verified: false, message: "No face detected in verification image." };
        }
        descriptor = extracted.descriptor;
    }

    if (!user || !user.face_descriptor) {
        return { verified: false, message: "User does not have a registered Face ID." };
    }

    const storedFront = JSON.parse(user.face_descriptor);
    const frontDist = getEuclideanDistance(descriptor, storedFront);

    if (frontDist >= frontThreshold) {
        return {
            verified: false,
            distance: frontDist,
            message: "Facial verification failed. Face does not match registered profile."
        };
    }

    return {
        verified: true,
        distance: frontDist,
        descriptor
    };
}

// Auto-initialize on module load
init().catch(err => {
    console.warn('[FaceBiometrics] Background model pre-load will retry on first request:', err.message);
});

module.exports = {
    init,
    extractDescriptor,
    getEuclideanDistance,
    identifyEmployee,
    verifyEmployee
};
