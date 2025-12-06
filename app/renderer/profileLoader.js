// Printer Profile Loader Utility
// Handles loading, matching, and applying printer-specific presets

/**
 * Load printer profiles from the configuration file
 * @returns {Promise<Object>} Printer profiles object
 */
async function loadPrinterProfiles() {
    try {
        const profiles = await ipcRenderer.invoke('get-printer-profiles');
        return profiles;
    } catch (err) {
        console.error('Failed to load printer profiles:', err);
        return { printerProfiles: {} };
    }
}

/**
 * Match a printer name to a profile using fuzzy matching
 * @param {string} printerName - The actual printer name from the system
 * @param {Object} profiles - The printer profiles object
 * @returns {string|null} The matched profile key or null
 */
function matchPrinterProfile(printerName, profiles) {
    if (!printerName || !profiles) return null;

    const normalizedName = printerName.toLowerCase();

    // 1. Try exact match first
    if (profiles[printerName]) {
        console.log(`Exact profile match found: ${printerName}`);
        return printerName;
    }

    // 2. Try case-insensitive exact match
    for (const profileKey in profiles) {
        if (profileKey.toLowerCase() === normalizedName) {
            console.log(`Case-insensitive match found: ${profileKey}`);
            return profileKey;
        }
    }

    // 3. Try fuzzy match by keywords
    const keywords = normalizedName.split(/[\s\-_.,;:\/\\()\[\]]/);
    const meaningfulKeywords = keywords.filter(k => k.length > 2); // Filter out short words

    for (const profileKey in profiles) {
        const profileKeywords = profileKey.toLowerCase().split(/[\s\-_.,;:\/\\()\[\]]/);
        const meaningfulProfileKeywords = profileKeywords.filter(k => k.length > 2);

        // Count matching keywords
        const matches = meaningfulKeywords.filter(k =>
            meaningfulProfileKeywords.some(pk => pk.includes(k) || k.includes(pk))
        );

        // Require at least 2 keyword matches for fuzzy match
        if (matches.length >= 2) {
            console.log(`Fuzzy match found: "${printerName}" → "${profileKey}" (matched: ${matches.join(', ')})`);
            return profileKey;
        }
    }

    // 4. No match found
    console.log(`No profile match found for: ${printerName}`);
    return null;
}

/**
 * Get the preset settings for a specific printer profile and tray
 * @param {string} profileName - The matched profile name
 * @param {string} trayName - The selected tray name
 * @param {Object} profiles - The printer profiles object
 * @returns {Object|null} The preset object or null
 */
function getTrayPreset(profileName, trayName, profiles) {
    if (!profileName || !trayName || !profiles || !profiles[profileName]) {
        return null;
    }

    const profile = profiles[profileName];

    // Try exact tray match
    if (profile[trayName]) {
        console.log(`Exact tray preset found: ${profileName} → ${trayName}`);
        return profile[trayName];
    }

    // Try case-insensitive match
    const normalizedTrayName = trayName.toLowerCase();
    for (const trayKey in profile) {
        if (trayKey.toLowerCase() === normalizedTrayName) {
            console.log(`Case-insensitive tray match: ${trayKey}`);
            return profile[trayKey];
        }
    }

    // Try partial match (e.g., "Tray 1" matches "Tray 1 (Auto-Select)")
    for (const trayKey in profile) {
        if (trayKey.toLowerCase().includes(normalizedTrayName) ||
            normalizedTrayName.includes(trayKey.toLowerCase())) {
            console.log(`Partial tray match: ${trayName} → ${trayKey}`);
            return profile[trayKey];
        }
    }

    console.log(`No tray preset found for: ${profileName} → ${trayName}`);
    return null;
}

/**
 * Check if a product appears to be a multi-up card format
 * @param {number} widthMm - Width in millimeters
 * @param {number} heightMm - Height in millimeters
 * @returns {boolean} True if multi-up card format detected
 */
function isMultiUpCardFormat(widthMm, heightMm) {
    // Standard card sizes (in mm)
    const cardSizes = [
        { w: 63.5, h: 88.9, name: 'Business Card (2.5" x 3.5")' },  // Standard business card
        { w: 88.9, h: 63.5, name: 'Business Card Landscape' },
        { w: 85.6, h: 53.98, name: 'Credit Card Size' },
        { w: 89, h: 51, name: 'Standard Card' },
    ];

    // Tolerance for size matching (±5mm)
    const tolerance = 5;

    for (const card of cardSizes) {
        // Check if dimensions suggest multi-up layout (2-up, 4-up, 8-up, etc.)
        // Multi-up means width or height is approximately 2x, 4x, etc. of card size

        // Check width for multi-up
        const widthRatioToCard = widthMm / card.w;
        const heightRatioToCard = heightMm / card.h;
        const widthRatioLandscape = widthMm / card.h;
        const heightRatioLandscape = heightMm / card.w;

        // Check if any dimension is close to 2x, 3x, or 4x a card dimension
        const isMultiUpWidth = (
            (Math.abs(widthRatioToCard - 2) < 0.15) ||  // 2-up horizontal
            (Math.abs(widthRatioToCard - 4) < 0.15) ||  // 4-up horizontal
            (Math.abs(heightRatioToCard - 2) < 0.15) || // 2-up vertical
            (Math.abs(heightRatioToCard - 4) < 0.15) || // 4-up vertical
            (Math.abs(widthRatioLandscape - 2) < 0.15) ||
            (Math.abs(heightRatioLandscape - 2) < 0.15)
        );

        if (isMultiUpWidth) {
            console.log(`Multi-up card format detected: ${widthMm}mm x ${heightMm}mm appears to be multi-up of ${card.name}`);
            return true;
        }
    }

    return false;
}

/**
 * Merge profile preset with user-saved overrides from localStorage
 * @param {Object} preset - The profile preset object
 * @param {string} printerName - The printer name
 * @param {string} trayName - The tray name
 * @param {string} productKey - The product key (optional)
 * @returns {Object} Merged settings object
 */
function mergeWithUserOverrides(preset, printerName, trayName, productKey = '') {
    if (!preset) return null;

    const overrideKey = `override_${printerName}__${trayName}__${productKey || 'default'}`;
    const saved = localStorage.getItem(overrideKey);

    if (saved) {
        try {
            const override = JSON.parse(saved);
            console.log(`Applying user override for ${overrideKey}:`, override);
            // User overrides take precedence over profile defaults
            return { ...preset, ...override };
        } catch (err) {
            console.error('Failed to parse user override:', err);
            return preset;
        }
    }

    return preset;
}

/**
 * Save user settings as an override for the current printer+tray+product combination
 * @param {string} printerName - The printer name
 * @param {string} trayName - The tray name
 * @param {string} productKey - The product key
 * @param {Object} settings - The settings to save
 */
function saveUserOverride(printerName, trayName, productKey, settings) {
    const overrideKey = `override_${printerName}__${trayName}__${productKey || 'default'}`;

    const override = {
        ...settings,
        savedAt: new Date().toISOString(),
        printerName,
        trayName,
        productKey
    };

    localStorage.setItem(overrideKey, JSON.stringify(override));
    console.log(`Saved user override to ${overrideKey}`);
}

/**
 * Clear user overrides for a specific printer+tray+product combination
 * @param {string} printerName - The printer name
 * @param {string} trayName - The tray name
 * @param {string} productKey - The product key
 */
function clearUserOverride(printerName, trayName, productKey) {
    const overrideKey = `override_${printerName}__${trayName}__${productKey || 'default'}`;
    localStorage.removeItem(overrideKey);
    console.log(`Cleared user override: ${overrideKey}`);
}

// Make functions available globally for renderer.js
if (typeof window !== 'undefined') {
    window.profileLoader = {
        loadPrinterProfiles,
        matchPrinterProfile,
        getTrayPreset,
        isMultiUpCardFormat,
        mergeWithUserOverrides,
        saveUserOverride,
        clearUserOverride
    };
}
