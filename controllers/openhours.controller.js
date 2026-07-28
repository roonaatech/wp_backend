const db = require("../models");
const Setting = db.settings;
const axios = require("axios");

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getGoogleMapsApiKey = async () => {
    try {
        const setting = await Setting.findOne({ where: { key: 'google_maps_api_key' } });
        return setting ? setting.value : null;
    } catch (e) {
        return null;
    }
};

const formatHourMinute = (hour = 0, minute = 0) => {
    const hour12 = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
};

// Extract a suite/unit identifier from an address string, e.g. "Ste 140", "Suite 140",
// "Unit 140", "#140" -> "140". Used to disambiguate multi-tenant buildings.
const extractUnitNumber = (addressStr) => {
    const match = String(addressStr || '').match(/(?:suite|ste\.?|unit|apt\.?|#)\s*[:.]?\s*([a-z0-9-]+)/i);
    return match ? match[1].toLowerCase() : null;
};

// A real business/POI place includes "point_of_interest" or "establishment" in its
// types; a plain geocoded address (street_address, subpremise, premise, route, etc.)
// does not. Google's text search sometimes resolves a suite address to the bare
// address point instead of the specific tenant business at that suite.
const isBusinessPlace = (place) => {
    const types = place?.types || [];
    return types.includes('point_of_interest') || types.includes('establishment');
};

/**
 * When a text search resolves to a plain address point rather than a business
 * (common for multi-tenant / suite addresses), search nearby for POIs and pick
 * the one whose formatted address contains the same suite/unit number as the
 * original query. Returns the better place, or the original if no match found.
 */
const resolveBusinessAtAddress = async (apiKey, originalAddress, addressPlace) => {
    const unitNumber = extractUnitNumber(originalAddress);
    if (!unitNumber || !addressPlace.location) return addressPlace;

    try {
        const nearbyRes = await axios.post(
            "https://places.googleapis.com/v1/places:searchNearby",
            {
                maxResultCount: 20,
                locationRestriction: {
                    circle: { center: addressPlace.location, radius: 100.0 }
                }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": apiKey,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types"
                }
            }
        );

        const candidates = nearbyRes.data.places || [];
        const match = candidates.find(c => isBusinessPlace(c) && extractUnitNumber(c.formattedAddress) === unitNumber);
        return match || addressPlace;
    } catch (err) {
        console.error("Nearby business resolution failed:", err.response?.data || err.message);
        return addressPlace;
    }
};

/**
 * Look up a US business address via Google's Places API (New) and return its
 * Monday-Friday opening hours.
 * POST /api/open-hours/lookup
 */
exports.lookupOpenHours = async (req, res) => {
    try {
        const { address } = req.body;

        if (!address || !address.trim()) {
            return res.status(400).send({ message: "Address is required." });
        }

        const apiKey = await getGoogleMapsApiKey();
        if (!apiKey) {
            return res.status(500).send({ message: "Google Maps API key is not configured. Please set it in Settings." });
        }

        const addressQuery = `${address.trim()}, USA`;

        // 1. Resolve the address to a Google Place
        let searchRes;
        try {
            searchRes = await axios.post(
                "https://places.googleapis.com/v1/places:searchText",
                { textQuery: addressQuery },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": apiKey,
                        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types,places.location"
                    }
                }
            );
        } catch (err) {
            const googleMsg = err.response?.data?.error?.message;
            console.error("Google Places searchText failed:", googleMsg || err.message);
            return res.status(502).send({ message: googleMsg || "Failed to reach Google Places API." });
        }

        const places = searchRes.data.places || [];
        if (places.length === 0) {
            return res.status(404).send({ message: "No location found for the given address." });
        }

        let place = places[0];

        // Suite/multi-tenant addresses often resolve to the bare address point
        // rather than the actual business occupying that suite - try to find the
        // real tenant nearby before giving up on opening hours.
        if (!isBusinessPlace(place)) {
            place = await resolveBusinessAtAddress(apiKey, address, place);
        }

        // 2. Fetch opening hours for the resolved place
        let detailsRes;
        try {
            detailsRes = await axios.get(
                `https://places.googleapis.com/v1/places/${place.id}`,
                {
                    headers: {
                        "X-Goog-Api-Key": apiKey,
                        "X-Goog-FieldMask": "displayName,formattedAddress,regularOpeningHours"
                    }
                }
            );
        } catch (err) {
            const googleMsg = err.response?.data?.error?.message;
            console.error("Google Places details failed:", googleMsg || err.message);
            return res.status(502).send({ message: googleMsg || "Failed to retrieve business details from Google Places." });
        }

        const details = detailsRes.data || {};
        const periods = details.regularOpeningHours?.periods || [];
        const hasHoursData = !!details.regularOpeningHours;

        // Days are indexed Sunday=0 .. Saturday=6, so Monday-Friday is 1-5
        const hours = [1, 2, 3, 4, 5].map(dayIndex => {
            const period = periods.find(p => p.open?.day === dayIndex);
            if (!period) {
                return { day: DAY_NAMES[dayIndex], open: null, close: null, closed: true };
            }
            // A period with no `close` field means the location is open 24 hours that day
            if (!period.close) {
                return { day: DAY_NAMES[dayIndex], open: "12:00 AM", close: "11:59 PM", closed: false };
            }
            return {
                day: DAY_NAMES[dayIndex],
                open: formatHourMinute(period.open.hour, period.open.minute),
                close: formatHourMinute(period.close.hour, period.close.minute),
                closed: false
            };
        });

        res.status(200).send({
            success: true,
            name: details.displayName?.text || place.displayName?.text || null,
            formattedAddress: details.formattedAddress || place.formattedAddress || addressQuery,
            hasHoursData,
            hours
        });

    } catch (err) {
        console.error("Error looking up open hours:", err.response?.data || err.message);
        res.status(500).send({ message: "Failed to look up business hours. Please try again." });
    }
};
