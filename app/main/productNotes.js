const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class ProductNotesManager {
    constructor() {
        this.notesPath = path.join(app.getPath('userData'), 'product-notes.json');
        this.notes = {};
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.notesPath)) {
                const raw = fs.readFileSync(this.notesPath, 'utf8');
                this.notes = JSON.parse(raw);
                console.log('Product notes loaded from:', this.notesPath);
            } else {
                this.notes = {};
            }
        } catch (err) {
            console.error('Error loading product notes:', err);
            this.notes = {};
        }
    }

    getNote(productKey) {
        if (this.notes[productKey]) {
            return this.notes[productKey];
        }

        // Return default template
        return `<p><strong>Tray(s):</strong></p>
<p></p>
<p><strong>How to load the paper in the tray(s):</strong></p>
<p></p>
<p></p>
<p><strong>Print Setting Customisation(s):</strong></p>
<p></p>`;
    }

    saveNote(productKey, htmlContent) {
        try {
            this.notes[productKey] = htmlContent;
            fs.writeFileSync(this.notesPath, JSON.stringify(this.notes, null, 2), 'utf8');
            console.log('Product note saved for:', productKey);
            return true;
        } catch (err) {
            console.error('Error saving product note:', err);
            return false;
        }
    }
}

module.exports = ProductNotesManager;
