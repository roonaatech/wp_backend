const { normalizeEmploymentType } = require('../utils/employmentType.util');

describe('employmentType.util - normalizeEmploymentType', () => {
    test('defaults to Full-time when null, undefined, or empty', () => {
        expect(normalizeEmploymentType(null)).toBe('Full-time');
        expect(normalizeEmploymentType(undefined)).toBe('Full-time');
        expect(normalizeEmploymentType('')).toBe('Full-time');
        expect(normalizeEmploymentType('   ')).toBe('Full-time');
    });

    test('normalizes Full-time variations correctly', () => {
        expect(normalizeEmploymentType('Full-time')).toBe('Full-time');
        expect(normalizeEmploymentType('Full Time')).toBe('Full-time');
        expect(normalizeEmploymentType('full_time')).toBe('Full-time');
        expect(normalizeEmploymentType('fulltime')).toBe('Full-time');
        expect(normalizeEmploymentType('FULL TIME')).toBe('Full-time');
        expect(normalizeEmploymentType('full')).toBe('Full-time');
    });

    test('normalizes Part-time variations correctly', () => {
        expect(normalizeEmploymentType('Part-time')).toBe('Part-time');
        expect(normalizeEmploymentType('Part Time')).toBe('Part-time');
        expect(normalizeEmploymentType('part_time')).toBe('Part-time');
        expect(normalizeEmploymentType('parttime')).toBe('Part-time');
        expect(normalizeEmploymentType('PART TIME')).toBe('Part-time');
        expect(normalizeEmploymentType('part')).toBe('Part-time');
    });
});
