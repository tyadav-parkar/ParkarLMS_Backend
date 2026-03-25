'use strict';

const LEVELS = {
  info: 'info',
  warn: 'warn',
  error: 'error',
  debug: 'debug',
};

function emit(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const payload = { level, timestamp, message, meta };
  const hasMeta = meta && Object.keys(meta).length > 0;

  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(payload));
    return;
  }

  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (level === LEVELS.error) {
    console.error(hasMeta ? `${base} ${JSON.stringify(meta)}` : base);
  } else if (level === LEVELS.warn) {
    console.warn(hasMeta ? `${base} ${JSON.stringify(meta)}` : base);
  } else {
    console.log(hasMeta ? `${base} ${JSON.stringify(meta)}` : base);
  }
}

module.exports = {
  info: (message, meta) => emit(LEVELS.info, message, meta),
  warn: (message, meta) => emit(LEVELS.warn, message, meta),
  error: (message, meta) => emit(LEVELS.error, message, meta),
  debug: (message, meta) => emit(LEVELS.debug, message, meta),
};
