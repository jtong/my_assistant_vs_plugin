// logger.js
const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logFilePath = path.join(__dirname, 'debug.log');
        this.baseDir = __dirname;
    }

    log(message) {
        const callSite = this._getCallSite();
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${callSite.fileName}:${callSite.lineNumber} - ${message}\n`;

        fs.appendFileSync(this.logFilePath, logEntry);
    }

    _getCallSite() {
        const oldPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_, stack) => stack;
        const stack = new Error().stack;
        Error.prepareStackTrace = oldPrepareStackTrace;

        const callSite = stack[2];
        const fileName = callSite.getFileName();
        const relativePath = path.relative(this.baseDir, fileName);
        return {
            fileName: relativePath,
            lineNumber: callSite.getLineNumber()
        };
    }
}

// 创建并导出单例
const logger = new Logger();
module.exports = logger;