const manualController = require('../../controllers/manual_attendance.controller');
const abisService = require('../../services/abis.service');

jest.mock('../../services/abis.service');

describe('Manual Attendance Controller - ABiS Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAbisStaffLoginTimes', () => {
        it('should return staff login times from abisService', async () => {
            abisService.fetchStaffLoginTimes.mockResolvedValueOnce([
                {
                    email: 'sakthivel@roonaa.com',
                    date: '2026-10-26',
                    login_time: '19:32',
                    logout_time: '19:39',
                    raw_login_time: '19:32:51',
                    raw_logout_time: '19:39:06'
                }
            ]);

            const req = {
                query: { date: '2026-10-26', email: 'sakthivel@roonaa.com' }
            };

            const jsonSend = jest.fn();
            const res = {
                status: jest.fn().mockReturnValue({ send: jsonSend })
            };

            await manualController.getAbisStaffLoginTimes(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(jsonSend).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                date: '2026-10-26',
                count: 1,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        email: 'sakthivel@roonaa.com',
                        login_time: '19:32',
                        logout_time: '19:39'
                    })
                ])
            }));
        });

        it('should handle errors gracefully with 500', async () => {
            abisService.fetchStaffLoginTimes.mockRejectedValueOnce(new Error('ABiS connection error'));

            const req = { query: {} };
            const jsonSend = jest.fn();
            const res = {
                status: jest.fn().mockReturnValue({ send: jsonSend })
            };

            await manualController.getAbisStaffLoginTimes(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(jsonSend).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'ABiS connection error'
            }));
        });
    });
});
