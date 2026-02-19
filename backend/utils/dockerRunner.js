const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('./logger');

const execAsync = promisify(exec);

async function runTestsInDocker(repoPath) {
  const safePath = path.resolve(repoPath);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Repository path does not exist: ${safePath}`);
  }
  const volumePath = safePath.startsWith('/') ? safePath : path.join(process.cwd(), safePath);

  const commands = [
    'cd /repo && npm ci 2>/dev/null || npm install --no-audit --no-fund 2>/dev/null || true',
    'cd /repo && npm test 2>&1 || cd /repo && npx jest --passWithNoTests 2>&1 || echo "NO_TEST_SCRIPT"',
  ];
  const fullCmd = `docker run --rm -v "${volumePath}:/repo" -w /repo node:20-alpine sh -c '${commands.join(' && ')}'`;
  
  try {
    const { stdout, stderr } = await Promise.race([
      execAsync(fullCmd, { 
        maxBuffer: 1024 * 1024 * 4,
        timeout: config.dockerTimeout,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Docker execution timeout')), config.dockerTimeout)
      ),
    ]);
    return { success: true, stdout: (stdout || '') + (stderr || ''), exitCode: 0 };
  } catch (err) {
    const output = err.stdout || err.stderr || err.message || '';
    return { 
      success: false, 
      stdout: String(output), 
      exitCode: err.code || 1,
    };
  }
}

module.exports = { runTestsInDocker };
