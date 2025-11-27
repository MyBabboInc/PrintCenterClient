const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigManager {
  constructor() {
    this.configPath = path.join(app.getAppPath(), 'config', 'papers.json');
    // In production, config might be in a different place relative to the executable
    if (!fs.existsSync(this.configPath)) {
      // Fallback for development or if moved
      this.configPath = path.join(process.cwd(), 'config', 'papers.json');
    }

    this.userConfigPath = path.join(app.getPath('userData'), 'user-papers.json');

    this.data = {
      paperSizes: {},
      defaultTrayMapping: {}
    };
    this.observers = [];

    this.load();
    this.watch();
  }

  load() {
    try {
      let baseConfig = {};
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        baseConfig = JSON.parse(raw);
      }

      let userConfig = { paperSizes: {} };
      if (fs.existsSync(this.userConfigPath)) {
        try {
          const rawUser = fs.readFileSync(this.userConfigPath, 'utf8');
          userConfig = JSON.parse(rawUser);
          // Mark user products as custom
          for (const key in userConfig.paperSizes) {
            userConfig.paperSizes[key].isCustom = true;
          }
        } catch (e) {
          console.error("Error loading user config", e);
        }
      }

      // Merge: User config overrides base config if same key (or adds new ones)
      this.data = {
        ...baseConfig,
        paperSizes: {
          ...baseConfig.paperSizes,
          ...userConfig.paperSizes
        },
        defaultTrayMapping: {
          ...baseConfig.defaultTrayMapping,
          // We could merge tray mappings too if needed
        }
      };

      console.log('Config loaded. Base:', this.configPath, 'User:', this.userConfigPath);
      this.notifyObservers();

    } catch (err) {
      console.error('Error loading config:', err);
    }
  }

  saveUserProduct(productKey, productData) {
    try {
      let userConfig = { paperSizes: {} };
      if (fs.existsSync(this.userConfigPath)) {
        userConfig = JSON.parse(fs.readFileSync(this.userConfigPath, 'utf8'));
      }

      userConfig.paperSizes[productKey] = productData;

      fs.writeFileSync(this.userConfigPath, JSON.stringify(userConfig, null, 2));
      this.load(); // Reload and notify
      return true;
    } catch (e) {
      console.error("Error saving user product", e);
      return false;
    }
  }

  deleteUserProduct(productKey) {
    try {
      if (fs.existsSync(this.userConfigPath)) {
        let userConfig = JSON.parse(fs.readFileSync(this.userConfigPath, 'utf8'));
        if (userConfig.paperSizes[productKey]) {
          delete userConfig.paperSizes[productKey];
          fs.writeFileSync(this.userConfigPath, JSON.stringify(userConfig, null, 2));
          this.load();
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Error deleting user product", e);
      return false;
    }
  }

  watch() {
    try {
      fs.watch(this.configPath, (eventType, filename) => {
        if (eventType === 'change') {
          this.load();
        }
      });
      // Also watch user config? Not strictly necessary if we only write to it from app
    } catch (e) {
      console.error("Failed to watch config file", e);
    }
  }

  get() {
    return this.data;
  }

  subscribe(callback) {
    this.observers.push(callback);
    // Send current data immediately
    callback(this.data);
  }

  notifyObservers() {
    for (const cb of this.observers) {
      cb(this.data);
    }
  }
}

module.exports = new ConfigManager();
