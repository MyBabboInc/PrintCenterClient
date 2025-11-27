const config = require('./config');

class TrayMapper {
    constructor() {
        this.mapping = {};
        config.subscribe((data) => {
            this.mapping = data.defaultTrayMapping || {};
        });
    }

    /**
     * Returns the recommended tray for a given paper size.
     * @param {number} width - Width in mm
     * @param {number} height - Height in mm
     * @returns {string|null} - Tray name or null if no match
     */
    getRecommendedTray(width, height) {
        // Create a key like "457x304"
        // We need to handle rotation, so we check both orientations
        const key1 = `${Math.round(width)}x${Math.round(height)}`;
        const key2 = `${Math.round(height)}x${Math.round(width)}`;

        if (this.mapping[key1]) return this.mapping[key1];
        if (this.mapping[key2]) return this.mapping[key2];

        return null;
    }

    getAllTrays() {
        // Return unique values from the mapping as a suggestion list, 
        // though actual available trays should come from the printer driver if possible.
        // For this logic, we just return what we have mapped.
        return [...new Set(Object.values(this.mapping))];
    }
}

module.exports = new TrayMapper();
