const { runTests } = require('./testAgent');
const logger = require('../utils/logger');

async function getCIStatus(repoPath) {
  try {
    const result = await runTests(repoPath);
    return {
      passing: result.success,
      output: result.stdout || '',
      exitCode: result.exitCode || 0,
    };
  } catch (err) {
    logger.error('ciAgent error:', err.message);
    return { passing: false, output: err.message, exitCode: 1 };
  }
}

module.exports = { getCIStatus };
