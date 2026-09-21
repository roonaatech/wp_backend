const crypto = require('crypto');

// Dedicated secret for attendance QR badge encryption (falls back to app JWT secret)
const BADGE_SECRET = process.env.BADGE_SECRET || process.env.JWT_SECRET || 'workpulse-dynamic-badge-secret-key-2026';

// Token validity window (in milliseconds)
const TOKEN_TTL_MS = 30 * 1000; // 30 seconds validity

// Anti-replay cache: stores recently used nonces to prevent token reuse
const usedNonces = new Map(); // nonce -> timestamp

// Auto-cleanup used nonces older than TOKEN_TTL_MS * 2
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [nonce, timestamp] of usedNonces.entries()) {
        if (now - timestamp > TOKEN_TTL_MS * 2) {
            usedNonces.delete(nonce);
        }
    }
}, 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Generate a cryptographically signed dynamic QR badge token.
 * 
 * @param {Object} employeeData - { staffId, email, name }
 * @returns {Object} { token, expiresAt, ttlSeconds }
 */
function generateBadgeToken(employeeData) {
    const now = Date.now();
    const expiresAt = now + TOKEN_TTL_MS;
    const nonce = crypto.randomBytes(8).toString('hex');

    const payload = {
        sid: employeeData.staffId,
        em: employeeData.email,
        nm: employeeData.name,
        iat: now,
        exp: expiresAt,
        nc: nonce
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    // Create HMAC-SHA256 signature
    const signature = crypto
        .createHmac('sha256', BADGE_SECRET)
        .update(payloadBase64)
        .digest('base64url');

    const token = `WPQR.${payloadBase64}.${signature}`;

    return {
        token,
        expiresAt,
        ttlSeconds: Math.floor(TOKEN_TTL_MS / 1000)
    };
}

/**
 * Verify and decode a dynamic QR badge token.
 * Validates HMAC signature, expiration time, and checks against replay attacks.
 * 
 * @param {string} tokenString
 * @returns {Object} { valid: boolean, error?: string, data?: { staffId, email, name, timestamp } }
 */
function verifyBadgeToken(tokenString) {
    if (!tokenString || typeof tokenString !== 'string') {
        return { valid: false, error: 'Empty or invalid QR token format' };
    }

    const parts = tokenString.trim().split('.');
    if (parts.length !== 3 || parts[0] !== 'WPQR') {
        return { valid: false, error: 'Invalid WorkPulse QR Badge format' };
    }

    const [, payloadBase64, signature] = parts;

    // 1. Verify HMAC signature
    const expectedSignature = crypto
        .createHmac('sha256', BADGE_SECRET)
        .update(payloadBase64)
        .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
        signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
        return { valid: false, error: 'Invalid QR signature or corrupted badge' };
    }

    // 2. Decode and check expiration
    let payload;
    try {
        const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        payload = JSON.parse(jsonStr);
    } catch (e) {
        return { valid: false, error: 'Malformed QR payload' };
    }

    const now = Date.now();
    if (!payload.exp || now > payload.exp) {
        return { valid: false, error: 'QR code has expired. Please refresh your badge.' };
    }

    // Reject tokens issued in the future (more than 5s drift)
    if (payload.iat && payload.iat > now + 5000) {
        return { valid: false, error: 'Invalid timestamp clock drift' };
    }

    // 3. Anti-replay check
    if (usedNonces.has(payload.nc)) {
        return { valid: false, error: 'This QR code has already been scanned. Please wait for the next rotation.' };
    }

    // Mark nonce as used
    usedNonces.set(payload.nc, now);

    return {
        valid: true,
        data: {
            staffId: payload.sid,
            email: payload.em,
            name: payload.nm,
            issuedAt: payload.iat,
            expiresAt: payload.exp
        }
    };
}

module.exports = {
    generateBadgeToken,
    verifyBadgeToken,
    TOKEN_TTL_MS
};
