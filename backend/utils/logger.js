function log(level, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}]`, ...args);
}

module.exports = {
  info: (...args) => log('INFO', ...args),
  error: (...args) => log('ERROR', ...args),
  warn: (...args) => log('WARN', ...args),
};
