const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Get the application root directory (two levels up from utils folder)
const APP_ROOT = path.resolve(__dirname, '..', '..');
const LOG_DIR = path.join(APP_ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Format timestamp
const getTimestamp = () => {
  return new Date().toISOString();
};

// Format log message
const formatMessage = (level, message, meta = {}) => {
  const timestamp = getTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
};

// Write to log file
const writeToFile = (filePath, message) => {
  try {
    fs.appendFileSync(filePath, message);
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
};

// Rotate log file if it exceeds max size (10MB)
const rotateLogIfNeeded = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        const rotatedPath = path.join(LOG_DIR, `${base}-${timestamp}${ext}`);
        fs.renameSync(filePath, rotatedPath);
      }
    }
  } catch (err) {
    console.error('Failed to rotate log file:', err.message);
  }
};

// Logger class
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  _log(level, message, meta = {}) {
    const contextMeta = { ...meta, context: this.context };
    const formattedMessage = formatMessage(level, message, contextMeta);
    
    // Always log to console
    const consoleMethod = level === LOG_LEVELS.ERROR ? console.error : 
                          level === LOG_LEVELS.WARN ? console.warn : console.log;
    consoleMethod(formattedMessage.trim());
    
    // Rotate logs if needed
    rotateLogIfNeeded(LOG_FILE);
    
    // Write to main log file
    writeToFile(LOG_FILE, formattedMessage);
    
    // Write errors to separate error log
    if (level === LOG_LEVELS.ERROR) {
      rotateLogIfNeeded(ERROR_LOG_FILE);
      writeToFile(ERROR_LOG_FILE, formattedMessage);
    }
  }

  error(message, meta = {}) {
    this._log(LOG_LEVELS.ERROR, message, meta);
  }

  warn(message, meta = {}) {
    this._log(LOG_LEVELS.WARN, message, meta);
  }

  info(message, meta = {}) {
    this._log(LOG_LEVELS.INFO, message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      this._log(LOG_LEVELS.DEBUG, message, meta);
    }
  }

  // Log HTTP request
  request(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress
    };
    
    if (res.statusCode >= 400) {
      this.warn(`HTTP ${req.method} ${req.originalUrl || req.url}`, meta);
    } else {
      this.info(`HTTP ${req.method} ${req.originalUrl || req.url}`, meta);
    }
  }
}

// Create a child logger with context
const createLogger = (context) => {
  return new Logger(context);
};

// Default logger instance
const defaultLogger = new Logger('App');

// Express middleware for request logging
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    defaultLogger.request(req, res, duration);
  });
  
  next();
};

module.exports = {
  Logger,
  createLogger,
  logger: defaultLogger,
  requestLogger,
  LOG_LEVELS
};
