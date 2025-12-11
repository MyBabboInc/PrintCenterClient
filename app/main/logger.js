// Logger Module - Captures console logs for diagnostic purposes
// Stores logs in memory and provides them for support bundles

class Logger {
    constructor(maxLogs = 1000) {
        this.logs = [];
        this.maxLogs = maxLogs;
        this.startTime = new Date();

        // Intercept console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };

        this.interceptConsole();
    }

    interceptConsole() {
        const self = this;

        console.log = function (...args) {
            self.addLog('log', args);
            self.originalConsole.log.apply(console, args);
        };

        console.error = function (...args) {
            self.addLog('error', args);
            self.originalConsole.error.apply(console, args);
        };

        console.warn = function (...args) {
            self.addLog('warn', args);
            self.originalConsole.warn.apply(console, args);
        };

        console.info = function (...args) {
            self.addLog('info', args);
            self.originalConsole.info.apply(console, args);
        };
    }

    addLog(level, args) {
        const timestamp = new Date();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        this.logs.push({
            timestamp: timestamp.toISOString(),
            level,
            message,
            relativeTime: timestamp - this.startTime
        });

        // Keep only the most recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    getLogs() {
        return this.logs;
    }

    getLogsAsText() {
        return this.logs.map(log => {
            return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
        }).join('\n');
    }

    clear() {
        this.logs = [];
        this.startTime = new Date();
    }

    getLogsSince(sinceTime) {
        return this.logs.filter(log => new Date(log.timestamp) >= sinceTime);
    }

    // Get logs related to printing (contains certain keywords)
    getPrintLogs() {
        const printKeywords = ['PRINT', 'RENDERER', 'PROFILE', 'tray', 'duplex', 'bypass'];
        return this.logs.filter(log => {
            const msgLower = log.message.toLowerCase();
            return printKeywords.some(keyword => msgLower.includes(keyword.toLowerCase()));
        });
    }

    getPrintLogsAsText() {
        return this.getPrintLogs().map(log => {
            return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
        }).join('\n');
    }
}

// Singleton instance
const logger = new Logger(2000); // Store last 2000 logs

module.exports = logger;
