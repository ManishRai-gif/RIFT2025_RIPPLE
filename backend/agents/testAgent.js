const { runTests: runTestsRunner } = require('../utils/dockerRunner');
const logger = require('../utils/logger');

async function runTests(repoPath) {
  try {
    if (!repoPath || typeof repoPath !== 'string') {
      return { success: false, stdout: 'Invalid repo path', exitCode: 1 };
    }
    const result = await runTestsRunner(repoPath);
    return result;
  } catch (err) {
    logger.error('testAgent error:', err.message);
    return { success: false, stdout: err.message || 'Test execution failed', exitCode: 1 };
  }
}

module.exports = { runTests };
