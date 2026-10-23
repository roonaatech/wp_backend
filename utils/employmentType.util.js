/**
 * Employment Type Normalization Utility
 * Standardizes employment_type strings across WorkPulse backend controllers
 * Valid canonical values: 'Full-time', 'Part-time'
 */

const normalizeEmploymentType = (type) => {
    if (!type) return 'Full-time';
    const t = String(type).trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (t === 'parttime' || t === 'part') {
        return 'Part-time';
    }
    return 'Full-time';
};

module.exports = {
    normalizeEmploymentType
};
