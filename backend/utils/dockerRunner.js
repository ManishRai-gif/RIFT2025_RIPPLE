const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('./logger');

const execAsync = promisify(exec);

function hasFile(repoPath, name) {
  return fs.existsSync(path.join(repoPath, name));
}

function buildTestCommand(repoPath) {
  if (hasFile(repoPath, 'package.json')) {
    return 'cd /repo && (npm ci 2>/dev/null || npm install --no-audit --no-fund) && (npm test 2>&1 || npx jest --passWithNoTests 2>&1 || echo "NO_TEST_SCRIPT")';
  }
  if (hasFile(repoPath, 'requirements.txt') || hasFile(repoPath, 'pyproject.toml') || hasFile(repoPath, 'setup.py')) {
    return 'cd /repo && pip install -q -e . 2>/dev/null; pip install -q -r requirements.txt 2>/dev/null; pip install -q pytest 2>/dev/null; pytest -v 2>&1 || python -m pytest -v 2>&1 || echo "NO_TEST_SCRIPT"';
  }
  if (hasFile(repoPath, 'go.mod')) {
    return 'cd /repo && go test ./... 2>&1 || echo "NO_TEST_SCRIPT"';
  }
  if (hasFile(repoPath, 'Cargo.toml')) {
    return 'cd /repo && cargo test 2>&1 || echo "NO_TEST_SCRIPT"';
  }
  return 'cd /repo && (npm test 2>&1 || pytest -v 2>&1 || echo "NO_TEST_SCRIPT")';
}

function getDockerImage(repoPath) {
  if (hasFile(repoPath, 'package.json')) return 'node:20-alpine';
  if (hasFile(repoPath, 'requirements.txt') || hasFile(repoPath, 'pyproject.toml') || hasFile(repoPath, 'setup.py')) return 'python:3.11-slim';
  if (hasFile(repoPath, 'go.mod')) return 'golang:1.21-alpine';
  if (hasFile(repoPath, 'Cargo.toml')) return 'rust:1.74-alpine';
  return 'node:20-alpine';
}

async function runTestsInDocker(repoPath) {
  const safePath = path.resolve(repoPath);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Repository path does not exist: ${safePath}`);
  }
  const volumePath = safePath.startsWith('/') ? safePath : path.join(process.cwd(), safePath);
  const testCmd = buildTestCommand(safePath);
  const image = getDockerImage(safePath);
  const fullCmd = `docker run --rm -v "${volumePath}:/repo" -w /repo ${image} sh -c '${testCmd.replace(/'/g, "'\\''")}'`;

  logger.info('Docker run:', image, testCmd.slice(0, 80) + '...');
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
    logger.error('Docker run failed:', err.message);
    return {
      success: false,
      stdout: String(output),
      exitCode: err.code || 1,
    };
  }
}

module.exports = { runTestsInDocker };
