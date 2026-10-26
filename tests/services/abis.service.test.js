const axios = require('axios');
const abisService = require('../../services/abis.service');

jest.mock('axios');

describe('ABiS Service Unit Tests', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            ABIS_BASE_URL: 'https://uat-abis.roonaa.in:8773',
            ABIS_API_KEY: 'test-api-key-12345'
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('formatTimeToHHMM', () => {
        it('should format seconds-based time string to HH:mm', () => {
            expect(abisService.formatTimeToHHMM('13:01:30')).toBe('13:01');
            expect(abisService.formatTimeToHHMM('19:32:51')).toBe('19:32');
            expect(abisService.formatTimeToHHMM('09:05:00')).toBe('09:05');
        });

        it('should format single digit hours to two digit HH:mm', () => {
            expect(abisService.formatTimeToHHMM('9:05:00')).toBe('09:05');
            expect(abisService.formatTimeToHHMM('7:30')).toBe('07:30');
        });

        it('should preserve already formatted HH:mm strings', () => {
            expect(abisService.formatTimeToHHMM('09:30')).toBe('09:30');
            expect(abisService.formatTimeToHHMM('18:30')).toBe('18:30');
        });

        it('should return null for null, undefined, empty, or invalid inputs', () => {
            expect(abisService.formatTimeToHHMM(null)).toBeNull();
            expect(abisService.formatTimeToHHMM(undefined)).toBeNull();
            expect(abisService.formatTimeToHHMM('')).toBeNull();
            expect(abisService.formatTimeToHHMM('invalid')).toBeNull();
        });
    });

    describe('getAbisConfig', () => {
        it('should load baseURL and apiKey from environment', () => {
            const config = abisService.getAbisConfig();
            expect(config).toBeDefined();
            expect(config.baseURL).toBe('https://uat-abis.roonaa.in:8773');
            expect(config.apiKey).toBe('test-api-key-12345');
        });
    });

    describe('fetchStaffLoginTimes', () => {
        it('should handle missing API key gracefully without calling axios', async () => {
            delete process.env.ABIS_API_KEY;

            const res = await abisService.fetchStaffLoginTimes({ date: '2026-10-26' });
            expect(res).toEqual([]);
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should fetch and map login/logout times from ABiS', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    status: true,
                    date: '2026-10-26',
                    data: [
                        {
                            email: 'sakthivel@roonaa.com',
                            date: '2026-10-26',
                            login_time: '19:32:51',
                            logout_time: '19:39:06'
                        },
                        {
                            email: 'bala@roonaa.com',
                            date: '2026-10-26',
                            login_time: null,
                            logout_time: null
                        }
                    ]
                }
            });

            const res = await abisService.fetchStaffLoginTimes({ date: '2026-10-26', email: 'sakthivel@roonaa.com' });
            expect(axios.get).toHaveBeenCalledWith(
                'https://uat-abis.roonaa.in:8773/api/staff_login_times',
                expect.objectContaining({
                    params: { date: '2026-10-26', email: 'sakthivel@roonaa.com' },
                    headers: { 'api-key': 'test-api-key-12345' },
                    timeout: 10000
                })
            );

            expect(res).toHaveLength(2);
            expect(res[0]).toEqual({
                email: 'sakthivel@roonaa.com',
                date: '2026-10-26',
                login_time: '19:32',
                logout_time: '19:39',
                raw_login_time: '19:32:51',
                raw_logout_time: '19:39:06'
            });
            expect(res[1]).toEqual({
                email: 'bala@roonaa.com',
                date: '2026-10-26',
                login_time: null,
                logout_time: null,
                raw_login_time: null,
                raw_logout_time: null
            });
        });

        it('should return empty array on API error', async () => {
            axios.get.mockRejectedValueOnce(new Error('Network timeout'));

            const res = await abisService.fetchStaffLoginTimes({ date: '2026-10-26' });
            expect(res).toEqual([]);
        });
    });

    describe('fetchStaffLoginTimesMap', () => {
        it('should return empty map for empty datesList', async () => {
            const map = await abisService.fetchStaffLoginTimesMap({ datesList: [] });
            expect(map.size).toBe(0);
        });

        it('should return populated map keyed by email_date', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    status: true,
                    date: '2026-10-26',
                    data: [
                        {
                            email: 'sakthivel@roonaa.com',
                            date: '2026-10-26',
                            login_time: '19:32:51',
                            logout_time: '19:39:06'
                        }
                    ]
                }
            });

            const map = await abisService.fetchStaffLoginTimesMap({ datesList: ['2026-10-26'] });
            expect(map.size).toBe(1);
            expect(map.has('sakthivel@roonaa.com_2026-10-26')).toBe(true);

            const record = map.get('sakthivel@roonaa.com_2026-10-26');
            expect(record.login_time).toBe('19:32');
            expect(record.logout_time).toBe('19:39');
        });
    });
});
