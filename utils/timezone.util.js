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

/**
 * Format a date/time in the application's configured timezone
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string (e.g., 'Asia/Kolkata')
/**
 * Format date only (no time)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @param {string} dateFormat - Date format string (e.g. 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD', 'MMM DD, YYYY')
 * @returns {string} Formatted date string
 */
const formatDateOnly = (date, timezone = 'Asia/Kolkata', dateFormat = 'DD/MM/YYYY') => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const formatter = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: timezone
        });
        const parts = formatter.formatToParts(dateObj);
        const day = parts.find(p => p.type === 'day')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const year = parts.find(p => p.type === 'year')?.value;

        if (dateFormat === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
        if (dateFormat === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
        if (dateFormat === 'MM-DD-YYYY') return `${month}-${day}-${year}`;
        if (dateFormat === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
        if (dateFormat === 'MMM DD, YYYY') {
            const mShort = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short' }).format(dateObj);
            return `${mShort} ${day}, ${year}`;
        }
        return `${month}/${day}/${year}`;
    } catch (e) {
        return String(date);
    }
};

const formatInTimezone = (date, timezone = 'Asia/Kolkata', options = {}) => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const dateFormat = options.dateFormat || options.format;

        if (dateFormat) {
            const datePart = formatDateOnly(dateObj, timezone, dateFormat);
            const timeFormatter = new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: options.second ? '2-digit' : undefined,
                hour12: options.hour12 !== undefined ? options.hour12 : true,
                timeZone: timezone
            });
            const timePart = timeFormatter.format(dateObj);
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
 * Format time only (no date)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted time string (HH:MM AM/PM)
 */
const formatTimeOnly = (date, timezone = 'Asia/Kolkata') => {
    return formatInTimezone(date, timezone, {
        year: undefined,
        month: undefined,
        day: undefined,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
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

/**
 * Helper to get the configured application timezone from database settings
 * @returns {Promise<string>} Configured timezone or 'Asia/Kolkata' default
 */
const getAppTimezone = async () => {
    try {
        const db = require('../models');
        if (db && db.settings) {
            const tzSetting = await db.settings.findOne({ where: { key: 'application_timezone' } });
            return tzSetting?.value || 'Asia/Kolkata';
        }
        return 'Asia/Kolkata';
    } catch (e) {
        return 'Asia/Kolkata';
    }
};

/**
 * Helper to get the configured application date format from database settings
 * @returns {Promise<string>} Configured date format or 'DD/MM/YYYY' default
 */
const getAppDateFormat = async () => {
    try {
        const db = require('../models');
        if (db && db.settings) {
            const dfSetting = await db.settings.findOne({ where: { key: 'application_date_format' } });
            return dfSetting?.value || 'DD/MM/YYYY';
        }
        return 'DD/MM/YYYY';
    } catch (e) {
        return 'DD/MM/YYYY';
    }
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
    getCurrentTimeInTimezone,
    getNowStringInTimezone,
    convertFromUTC,
    getTimezoneOffset,
    parseTimeInTimezone,
    getUTCBounds,
    getAppTimezone,
    getAppDateFormat,
    getDateInTimezone
};

