/**
 * Timezone Utility
 * Provides timezone conversion and formatting utilities for the application
 */

// Common timezone options for the UI
const TIMEZONE_OPTIONS = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'UTC', label: 'UTC' }
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse date components safely without unwanted timezone shifting for naked date/datetime strings
 */
const parseDateComponents = (date, timezone = 'Asia/Kolkata') => {
    if (!date) return null;

    if (typeof date === 'string') {
        const trimmed = date.trim();
        // Pure date string: YYYY-MM-DD
        const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
            const [, y, m, d] = dateMatch;
            const mIdx = parseInt(m, 10) - 1;
            return {
                year: y,
                month: m,
                day: d,
                hour: null,
                minute: null,
                second: null,
                mShort: SHORT_MONTHS[mIdx] || m
            };
        }
        // Naked datetime string without timezone offset: YYYY-MM-DD HH:mm(:ss)?
        const dtMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (dtMatch) {
            const [, y, m, d, hh, mm, ss] = dtMatch;
            const mIdx = parseInt(m, 10) - 1;
            return {
                year: y,
                month: m,
                day: d,
                hour: parseInt(hh, 10),
                minute: mm,
                second: ss || '00',
                mShort: SHORT_MONTHS[mIdx] || m
            };
        }
    }

    // Date object or ISO string with timezone offset (e.g., ends in 'Z' or '+05:30')
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;

    const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23',
        timeZone: timezone
    });
    const parts = formatter.formatToParts(dateObj);
    const p = {};
    parts.forEach(part => { p[part.type] = part.value; });
    const safeHour = parseInt(p.hour, 10) % 24;
    const mShort = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short' }).format(dateObj);

    return {
        year: p.year,
        month: p.month,
        day: p.day,
        hour: safeHour,
        minute: p.minute,
        second: p.second,
        mShort
    };
};

/**
 * Format date only (no time)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @param {string} dateFormat - Date format string (e.g. 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'MMM DD, YYYY')
 * @returns {string} Formatted date string
 */
const formatDateOnly = (date, timezone = 'Asia/Kolkata', dateFormat = 'DD/MM/YYYY') => {
    try {
        if (!date) return '';
        const comp = parseDateComponents(date, timezone);
        if (!comp) return String(date);

        const { year, month, day, mShort } = comp;

        if (dateFormat === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
        if (dateFormat === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
        if (dateFormat === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
        if (dateFormat === 'MM-DD-YYYY') return `${month}-${day}-${year}`;
        if (dateFormat === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
        if (dateFormat === 'YYYY/MM/DD') return `${year}/${month}/${day}`;
        if (dateFormat === 'MMM DD, YYYY') return `${mShort} ${day}, ${year}`;
        if (dateFormat === 'DD MMM YYYY') return `${day} ${mShort} ${year}`;
        if (dateFormat === 'DD MMM, YYYY') return `${day} ${mShort}, ${year}`;
        return `${day}/${month}/${year}`;
    } catch (e) {
        return String(date);
    }
};

/**
 * Format time only (no date)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @param {string} timeFormat - '12h' or '24h'
 * @returns {string} Formatted time string
 */
const formatTimeOnly = (date, timezone = 'Asia/Kolkata', timeFormat = '12h') => {
    try {
        if (!date) return '';
        const is24h = timeFormat === '24h';

        // Check if string is already a pure time string (e.g. "09:30" or "14:30:00")
        if (typeof date === 'string') {
            const timeOnlyMatch = date.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
            if (timeOnlyMatch) {
                const h = parseInt(timeOnlyMatch[1], 10);
                const m = timeOnlyMatch[2];
                if (is24h) return `${String(h).padStart(2, '0')}:${m}`;
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
            }
        }

        const comp = parseDateComponents(date, timezone);
        if (!comp || comp.hour === null) return '';
        const h = comp.hour;
        const m = comp.minute;
        if (is24h) return `${String(h).padStart(2, '0')}:${m}`;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
    } catch (e) {
        return String(date);
    }
};

/**
 * Format date and time
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @param {string} dateFormat - Date format string
 * @param {string} timeFormat - '12h' or '24h'
 * @returns {string} Formatted date and time string
 */
const formatDateTime = (date, timezone = 'Asia/Kolkata', dateFormat = 'DD/MM/YYYY', timeFormat = '12h') => {
    try {
        if (!date) return '';
        const datePart = formatDateOnly(date, timezone, dateFormat);
        const timePart = formatTimeOnly(date, timezone, timeFormat);
        if (!timePart) return datePart;
        return `${datePart} ${timePart}`;
    } catch (e) {
        return String(date);
    }
};

const formatInTimezone = (date, timezone = 'Asia/Kolkata', options = {}) => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const dateFormat = options.dateFormat || options.format;

        if (dateFormat) {
            const timeFormat = options.hour12 === false ? '24h' : '12h';
            const datePart = formatDateOnly(dateObj, timezone, dateFormat);
            const timePart = formatTimeOnly(dateObj, timezone, timeFormat);
            if (!timePart) return datePart;
            return `${datePart}, ${timePart}`;
        }

        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        };

        const formatOptions = { ...defaultOptions, ...options };

        return new Intl.DateTimeFormat('en-US', formatOptions).format(dateObj);
    } catch (error) {
        console.error('Error formatting date in timezone:', error);
        return new Date(date).toLocaleString();
    }
};

/**
 * Get current time in the specified timezone
 * @param {string} timezone - IANA timezone string
 * @returns {Date} Current date/time
 */
const getCurrentTimeInTimezone = (timezone = 'Asia/Kolkata') => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Get current time as a string formatted for MySQL (YYYY-MM-DD HH:mm:ss) 
 * in the specified timezone.
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted date time string
 */
const getNowStringInTimezone = (timezone = 'Asia/Kolkata') => {
    const now = new Date();

    // Use Intl to get parts in target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(now);
    const p = {};
    parts.forEach(part => { p[part.type] = part.value; });
    const safeHour = String(parseInt(p.hour, 10) % 24).padStart(2, '0');

    return `${p.year}-${p.month}-${p.day} ${safeHour}:${p.minute}:${p.second}`;
};

/**
 * Convert UTC date to application timezone
 * @param {Date|string} utcDate - UTC date
 * @param {string} timezone - Target timezone
 * @returns {Date} Converted date
 */
const convertFromUTC = (utcDate, timezone = 'Asia/Kolkata') => {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Convert a naive "YYYY-MM-DD HH:mm:ss" (or "YYYY-MM-DD HH:mm") string that
 * represents wall-clock time IN THE GIVEN TIMEZONE into the correct absolute
 * UTC Date instant. Unlike `new Date(str)`, this does not depend on the
 * server process's local timezone.
 * @param {string} dateTimeStr - e.g. "2026-07-27 09:30:00"
 * @param {string} timezone - IANA timezone string
 * @returns {Date}
 */
const parseTimeInTimezone = (dateTimeStr, timezone = 'Asia/Kolkata') => {
    const cleaned = String(dateTimeStr).replace('T', ' ').replace('Z', '').trim();
    const [datePart, timePart = '00:00:00'] = cleaned.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(Number);

    // Treat the given wall-clock numbers as if they were UTC, then check what
    // that instant actually looks like when rendered in the target timezone.
    // The difference is the timezone's real offset at that moment (handles DST).
    const asUTC = Date.UTC(year, month - 1, day, hour, minute, second || 0);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(new Date(asUTC));
    const p = {};
    parts.forEach(part => { p[part.type] = part.value; });

    // Handle hour '24' that can be emitted by Intl for midnight to prevent day rolling forward
    const renderedHour = parseInt(p.hour, 10) % 24;

    const renderedAsUTC = Date.UTC(
        parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10),
        renderedHour, parseInt(p.minute, 10), parseInt(p.second, 10)
    );

    const offset = renderedAsUTC - asUTC;
    return new Date(asUTC - offset);
};

/**
 * Get timezone offset string (e.g., "GMT-6")
 * @param {string} timezone - IANA timezone string
 * @returns {string} Offset string
 */
const getTimezoneOffset = (timezone = 'Asia/Kolkata') => {
    try {
        const date = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short'
        });
        const parts = formatter.formatToParts(date);
        const timeZoneName = parts.find(part => part.type === 'timeZoneName');
        return timeZoneName ? timeZoneName.value : '';
    } catch (error) {
        console.error('Error getting timezone offset:', error);
        return '';
    }
};

/**
 * Converts a "local" date string (YYYY-MM-DD) into UTC bounds [start, end]
 * matching that full day (00:00:00.000 to 23:59:59.999) in the target timezone.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timezone - IANA timezone string
 * @returns {[Date, Date]} [startUTC, endUTC]
 */
const getUTCBounds = (dateStr, timezone = 'Asia/Kolkata') => {
    const cleanDate = String(dateStr).split('T')[0].split(' ')[0].trim();
    const start = parseTimeInTimezone(`${cleanDate} 00:00:00`, timezone);
    const end = new Date(parseTimeInTimezone(`${cleanDate} 23:59:59`, timezone).getTime() + 999);
    return [start, end];
};

// In-memory cache for application settings to support synchronous helpers
let cachedSettings = {
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h'
};

/**
 * Fetch application settings from database (timezone, date format, time format)
 * @returns {Promise<{timezone: string, dateFormat: string, timeFormat: string}>}
 */
const getAppSettings = async () => {
    try {
        const db = require('../models');
        if (db && db.settings) {
            const settings = await db.settings.findAll({
                where: {
                    key: ['application_timezone', 'application_date_format', 'application_time_format']
                }
            });
            const map = {};
            settings.forEach(s => { map[s.key] = s.value; });
            cachedSettings = {
                timezone: map['application_timezone'] || 'Asia/Kolkata',
                dateFormat: map['application_date_format'] || 'DD/MM/YYYY',
                timeFormat: map['application_time_format'] || '12h'
            };
            return { ...cachedSettings };
        }
    } catch (e) {
        console.error('Error fetching app settings in timezone.util:', e);
    }
    return { ...cachedSettings };
};

/**
 * Get synchronously cached application settings
 * @returns {{timezone: string, dateFormat: string, timeFormat: string}}
 */
const getCachedAppSettings = () => {
    return { ...cachedSettings };
};

/**
 * Helper to get the configured application timezone from database settings
 * @returns {Promise<string>} Configured timezone or 'Asia/Kolkata' default
 */
const getAppTimezone = async () => {
    const settings = await getAppSettings();
    return settings.timezone;
};

/**
 * Helper to get the configured application date format from database settings
 * @returns {Promise<string>} Configured date format or 'DD/MM/YYYY' default
 */
const getAppDateFormat = async () => {
    const settings = await getAppSettings();
    return settings.dateFormat;
};

/**
 * Helper to get the configured application time format from database settings
 * @returns {Promise<string>} Configured time format ('12h' or '24h')
 */
const getAppTimeFormat = async () => {
    const settings = await getAppSettings();
    return settings.timeFormat;
};

/**
 * Format date using application settings
 * @param {Date|string} date
 * @returns {Promise<string>}
 */
const formatAppDate = async (date) => {
    if (!date) return '';
    const { timezone, dateFormat } = await getAppSettings();
    return formatDateOnly(date, timezone, dateFormat);
};

/**
 * Format datetime using application settings
 * @param {Date|string} date
 * @returns {Promise<string>}
 */
const formatAppDateTime = async (date) => {
    if (!date) return '';
    const { timezone, dateFormat, timeFormat } = await getAppSettings();
    return formatDateTime(date, timezone, dateFormat, timeFormat);
};

/**
 * Helper to get date-only string in timezone (YYYY-MM-DD)
 * @param {Date|string} dateObj - Date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string|null} YYYY-MM-DD string
 */
const getDateInTimezone = (dateObj, timezone = 'Asia/Kolkata') => {
    return formatDateOnly(dateObj, timezone, 'YYYY-MM-DD');
};

module.exports = {
    TIMEZONE_OPTIONS,
    formatInTimezone,
    formatDateOnly,
    formatTimeOnly,
    formatDateTime,
    getCurrentTimeInTimezone,
    getNowStringInTimezone,
    convertFromUTC,
    getTimezoneOffset,
    parseTimeInTimezone,
    getUTCBounds,
    getAppSettings,
    getCachedAppSettings,
    getAppTimezone,
    getAppDateFormat,
    getAppTimeFormat,
    formatAppDate,
    formatAppDateTime,
    getDateInTimezone
};


