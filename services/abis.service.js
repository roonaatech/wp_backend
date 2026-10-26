const axios = require('axios');

/**
 * Service to interact with the external ABiS application API
 */

/**
 * Helper to get ABiS configuration from environment variables
 */
const getAbisConfig = () => {
    return {
        baseURL: (process.env.ABIS_BASE_URL || 'https://uat-abis.roonaa.in:8773').replace(/\/+$/, ''),
        apiKey: process.env.ABIS_API_KEY || ''
    };
};

/**
 * Normalizes any time string (e.g. "13:01:30" or "13:01" or "9:5:00") into standard "HH:mm"
 * Returns null if invalid or falsy
 */
const formatTimeToHHMM = (timeStr) => {
    if (!timeStr) return null;
    const trimmed = String(timeStr).trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const hh = String(parseInt(match[1], 10)).padStart(2, '0');
    const mm = match[2];
    return `${hh}:${mm}`;
};

/**
 * Fetches staff login times from ABiS application API
 * Endpoint: /api/staff_login_times
 * Header: api-key: ABIS_API_KEY
 * Query Params:
 *   date: YYYY-MM-DD
 *   email: (optional) employee email
 * 
 * @param {Object} options
 * @param {string} options.date - Date in YYYY-MM-DD format
 * @param {string} [options.email] - Optional employee email
 * @returns {Promise<Array>} Array of parsed login time records
 */
const fetchStaffLoginTimes = async ({ date, email } = {}) => {
    const { baseURL, apiKey } = getAbisConfig();

    if (!apiKey) {
        console.warn('[ABiS Service] ABIS_API_KEY is not defined in environment variables.');
        return [];
    }

    try {
        const targetUrl = `${baseURL}/api/staff_login_times`;
        const params = {};
        if (date) params.date = date;
        if (email) params.email = email.trim();

        const response = await axios.get(targetUrl, {
            params,
            headers: {
                'api-key': apiKey
            },
            timeout: 10000 // 10 second timeout
        });

        if (response.data && response.data.status && Array.isArray(response.data.data)) {
            return response.data.data.map(item => ({
                email: (item.email || '').trim().toLowerCase(),
                date: item.date || date,
                login_time: formatTimeToHHMM(item.login_time),
                logout_time: formatTimeToHHMM(item.logout_time),
                raw_login_time: item.login_time || null,
                raw_logout_time: item.logout_time || null
            }));
        }

        return [];
    } catch (err) {
        console.error(`[ABiS Service] Failed to fetch staff login times (date: ${date}, email: ${email}):`, err.message);
        return [];
    }
};

/**
 * Fetches staff login times for multiple dates and returns a Map keyed by `${email}_${date}`
 * 
 * @param {Object} options
 * @param {string[]} options.datesList - Array of date strings (YYYY-MM-DD)
 * @param {string} [options.email] - Optional single email filter
 * @returns {Promise<Map<string, Object>>}
 */
const fetchStaffLoginTimesMap = async ({ datesList = [], email = null } = {}) => {
    const resultMap = new Map();
    if (!datesList || datesList.length === 0) return resultMap;

    try {
        // Fetch for each date in parallel
        const promises = datesList.map(d => fetchStaffLoginTimes({ date: d, email }));
        const responses = await Promise.all(promises);

        responses.forEach(records => {
            records.forEach(rec => {
                if (rec.email && rec.date) {
                    const key = `${rec.email.toLowerCase()}_${rec.date}`;
                    resultMap.set(key, rec);
                }
            });
        });
    } catch (e) {
        console.error('[ABiS Service] Error populating login times map:', e.message);
    }

    return resultMap;
};

module.exports = {
    getAbisConfig,
    formatTimeToHHMM,
    fetchStaffLoginTimes,
    fetchStaffLoginTimesMap
};
