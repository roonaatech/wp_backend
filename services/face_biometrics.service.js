/**
 * Face Biometrics Service (DEPRECATED)
 * WorkPulse has migrated from face-recognition attendance to QR code attendance.
 * This stub maintains compatibility for any legacy callers without loading heavy ML models.
 */

async function init() {
    return true;
}

function getEuclideanDistance(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < arr1.length; i++) {
        sum += Math.pow(arr1[i] - arr2[i], 2);
    }
    return Math.sqrt(sum);
}

async function extractDescriptor() {
    throw new Error("Face recognition is deprecated. Please use QR badge attendance.");
}

async function identifyEmployee() {
    return {
        matched: false,
        message: "Face recognition is deprecated. Please use QR badge attendance."
    };
}

async function verifyEmployee() {
    return {
        verified: false,
        message: "Face recognition is deprecated. Please use QR badge attendance."
    };
}

module.exports = {
    init,
    extractDescriptor,
    getEuclideanDistance,
    identifyEmployee,
    verifyEmployee
};
