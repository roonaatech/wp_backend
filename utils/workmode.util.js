/**
 * WorkMode Normalization Utility
 * Standardizes work_mode strings across WorkPulse backend controllers
 * Valid canonical values: 'Office', 'Work from home', 'Hybrid'
 */

const normalizeWorkMode = (mode) => {
    if (!mode) return 'Office';
    const m = String(mode).trim().toLowerCase();
    if (m === 'work from home' || m === 'wfh' || m === 'remote' || m === 'work_from_home') {
        return 'Work from home';
    }
    if (m === 'hybrid') {
        return 'Hybrid';
    }
    return 'Office';
};

module.exports = {
    normalizeWorkMode
};
