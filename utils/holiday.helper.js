const db = require("../models");
const Holiday = db.holidays;
const { Op } = require("sequelize");

/**
 * Normalizes any date value (String, Date) to 'YYYY-MM-DD'
 */
const toDateString = (dateVal) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') {
        return dateVal.split('T')[0].split(' ')[0];
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Check if a specific date (YYYY-MM-DD) is an active company holiday
 * @param {string|Date} dateVal 
 * @returns {Promise<{isHoliday: boolean, holidayName: string|null}>}
 */
const isDateHoliday = async (dateVal) => {
    try {
        const dateStr = toDateString(dateVal);
        if (!dateStr) return { isHoliday: false, holidayName: null };

        const holiday = await Holiday.findOne({
            where: {
                holiday_date: dateStr,
                status: 1
            },
            attributes: ['holiday_date', 'holiday_name'],
            raw: true
        });

        if (holiday) {
            return {
                isHoliday: true,
                holidayName: holiday.holiday_name
            };
        }
        return { isHoliday: false, holidayName: null };
    } catch (err) {
        console.error("Error checking holiday date:", err);
        return { isHoliday: false, holidayName: null };
    }
};

/**
 * Get map of all active holidays between two dates (inclusive)
 * @param {string|Date} startDate 
 * @param {string|Date} endDate 
 * @returns {Promise<Map<string, string>>} Map of 'YYYY-MM-DD' => holiday_name
 */
const getActiveHolidaysMap = async (startDate, endDate) => {
    try {
        const s = toDateString(startDate);
        const e = toDateString(endDate);
        if (!s || !e) return new Map();

        const minDate = s <= e ? s : e;
        const maxDate = s <= e ? e : s;

        const holidays = await Holiday.findAll({
            where: {
                holiday_date: {
                    [Op.between]: [minDate, maxDate]
                },
                status: 1
            },
            attributes: ['holiday_date', 'holiday_name'],
            raw: true
        });

        const map = new Map();
        holidays.forEach(h => {
            const d = toDateString(h.holiday_date);
            map.set(d, h.holiday_name);
        });
        return map;
    } catch (err) {
        console.error("Error fetching holidays map:", err);
        return new Map();
    }
};

/**
 * Get a Set of all active holiday date strings for a given 4-digit year
 * @param {number|string} year 
 * @returns {Promise<Set<string>>}
 */
const getActiveHolidaysSetForYear = async (year) => {
    try {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        const holidays = await Holiday.findAll({
            where: {
                holiday_date: {
                    [Op.between]: [start, end]
                },
                status: 1
            },
            attributes: ['holiday_date'],
            raw: true
        });

        const set = new Set();
        holidays.forEach(h => {
            set.add(toDateString(h.holiday_date));
        });
        return set;
    } catch (err) {
        console.error("Error fetching holidays for year:", err);
        return new Set();
    }
};

/**
 * Calculate working days between startDate and endDate, excluding Sundays and holidays
 * @param {string|Date} startDate 
 * @param {string|Date} endDate 
 * @param {Set<string>|Map<string, string>} holidaysSetOrMap 
 * @returns {number}
 */
const calculateWorkingDays = (startDate, endDate, holidaysSetOrMap = new Set()) => {
    const parseDateParts = (d) => {
        if (!d) return null;
        const parts = String(d).split('T')[0].split(' ')[0].split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
        return new Date(d);
    };

    const start = parseDateParts(startDate);
    const end = parseDateParts(endDate);

    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return 0;
    }

    const isHoliday = (dateStr) => {
        if (holidaysSetOrMap instanceof Map) return holidaysSetOrMap.has(dateStr);
        if (holidaysSetOrMap instanceof Set) return holidaysSetOrMap.has(dateStr);
        if (typeof holidaysSetOrMap === 'object' && holidaysSetOrMap !== null) return Boolean(holidaysSetOrMap[dateStr]);
        return false;
    };

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;

        // Exclude Sunday (0) and active holidays
        if (current.getDay() !== 0 && !isHoliday(dateStr)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
};

module.exports = {
    toDateString,
    isDateHoliday,
    getActiveHolidaysMap,
    getActiveHolidaysSetForYear,
    calculateWorkingDays
};
