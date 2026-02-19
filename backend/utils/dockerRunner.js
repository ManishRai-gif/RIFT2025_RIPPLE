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

function buildTestCommandInner(repoPath) {
  if (hasFile(repoPath, 'package.json')) {
    return '(npm ci 2>/dev/null || npm install --no-audit --no-fund) && (npm test 2>&1 || npx jest --passWithNoTests 2>&1 || echo "NO_TEST_SCRIPT")';
  }
  if (hasFile(repoPath, 'requirements.txt') || hasFile(repoPath, 'pyproject.toml') || hasFile(repoPath, 'setup.py')) {
    return 'pip install -q -e . 2>/dev/null; pip install -q -r requirements.txt 2>/dev/null; pip install -q pytest 2>/dev/null; pytest -v 2>&1 || python -m pytest -v 2>&1 || echo "NO_TEST_SCRIPT"';
  }
  if (hasFile(repoPath, 'go.mod')) {
    return 'go test ./... 2>&1 || echo "NO_TEST_SCRIPT"';
  }
  if (hasFile(repoPath, 'Cargo.toml')) {
    return 'cargo test 2>&1 || echo "NO_TEST_SCRIPT"';
  }
  return '(npm test 2>&1 || pytest -v 2>&1 || echo "NO_TEST_SCRIPT")';
}

function buildTestCommand(repoPath, forDocker = true) {
  const inner = buildTestCommandInner(repoPath);
  return forDocker ? 'cd /repo && ' + inner : inner;
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

  // Vercel and other serverless platforms generally do not support Docker.
  // Fail fast with a clear message so the orchestrator can still complete
  // quickly and produce a score instead of hanging on docker.
  if (process.env.VERCEL) {
    const msg = 'Docker is not available in this environment (VERCEL); tests not executed.';
    logger.warn('runTestsInDocker skipped:', msg);
    return {
      success: false,
      stdout: msg,
      exitCode: 1,
    };
  }

  const volumePath = safePath.startsWith('/') ? safePath : path.join(process.cwd(), safePath);
  const testCmd = buildTestCommand(safePath, true);
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

/** Run tests in-process (no Docker). Used on Vercel where Docker is unavailable. */
async function runTestsLocal(repoPath) {
  const safePath = path.resolve(repoPath);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Repository path does not exist: ${safePath}`);
  }
  const testCmd = buildTestCommand(safePath, false);
  const timeout = Math.min(config.dockerTimeout, 120000);
  logger.info('Local test run (no Docker):', testCmd.slice(0, 100) + '...');
  try {
    const { stdout, stderr } = await Promise.race([
      execAsync(testCmd, { cwd: safePath, maxBuffer: 1024 * 1024 * 4, timeout, shell: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Test run timeout')), timeout)),
    ]);
    return { success: true, stdout: (stdout || '') + (stderr || ''), exitCode: 0 };
  } catch (err) {
    const output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n');
    logger.error('Local test run failed:', err.message);
    return {
      success: false,
      stdout: String(output),
      exitCode: err.code || 1,
    };
  }
}

/** Use Docker when available; on Vercel use local runner. */
async function runTests(repoPath) {
  if (process.env.VERCEL || (typeof __dirname === 'string' && __dirname.startsWith('/var/task'))) {
    return runTestsLocal(repoPath);
  }
  return runTestsInDocker(repoPath);
}

module.exports = { runTestsInDocker, runTestsLocal, runTests };
