const formatContext = (context = {}) => {
  if (!context || typeof context !== 'object') {
    return '';
  }

  const entries = Object.entries(context).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) {
    return '';
  }

  const serialized = entries
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');

  return ` ${serialized}`;
};

const writeLog = (level, message, context) => {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${formatContext(context)}`;

  if (level === 'ERROR') {
    console.error(line);
    return;
  }

  if (level === 'WARN') {
    console.warn(line);
    return;
  }

  console.info(line);
};

const logger = {
  info: (message, context) => writeLog('INFO', message, context),
  warn: (message, context) => writeLog('WARN', message, context),
  error: (message, context) => writeLog('ERROR', message, context),
};

module.exports = logger;
