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
 * @param {string} timezone - IANA timezone string (e.g., 'America/Chicago')
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
const formatInTimezone = (date, timezone = 'America/Chicago', options = {}) => {
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;

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
 * Format date only (no time)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted date string (MM/DD/YYYY)
 */
const formatDateOnly = (date, timezone = 'America/Chicago') => {
    return formatInTimezone(date, timezone, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: undefined,
        minute: undefined,
        hour12: undefined
    });
};

/**
 * Format time only (no date)
 * @param {Date|string} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted time string (HH:MM AM/PM)
 */
const formatTimeOnly = (date, timezone = 'America/Chicago') => {
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
const getCurrentTimeInTimezone = (timezone = 'America/Chicago') => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Convert UTC date to application timezone
 * @param {Date|string} utcDate - UTC date
 * @param {string} timezone - Target timezone
 * @returns {Date} Converted date
 */
const convertFromUTC = (utcDate, timezone = 'America/Chicago') => {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Get timezone offset string (e.g., "GMT-6")
 * @param {string} timezone - IANA timezone string
 * @returns {string} Offset string
 */
const getTimezoneOffset = (timezone = 'America/Chicago') => {
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

module.exports = {
    TIMEZONE_OPTIONS,
    formatInTimezone,
    formatDateOnly,
    formatTimeOnly,
    getCurrentTimeInTimezone,
    convertFromUTC,
    getTimezoneOffset
};
