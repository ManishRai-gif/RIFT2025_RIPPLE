const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

const GITHUB_PATTERNS = [
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
];

function parseGitHubUrl(input) {
  const trimmed = String(input || '').trim();
  for (const re of GITHUB_PATTERNS) {
    const m = trimmed.match(re);
    if (m) return { owner: m[1], repo: m[2].replace(/\.git$/, ''), url: trimmed };
  }
  return null;
}

function isGitHubUrl(input) {
  return !!parseGitHubUrl(input);
}

async function cloneToTemp(url) {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return { success: false, path: null, error: 'Invalid GitHub URL' };

  const dir = path.join(os.tmpdir(), `ripple-agent-${parsed.owner}-${parsed.repo}-${Date.now()}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const git = simpleGit();
    await git.clone(parsed.url, dir, ['--depth', '1']);
    if (!fs.existsSync(dir)) return { success: false, path: null, error: 'Clone failed' };
    logger.info('Cloned repo to', dir);
    return { success: true, path: dir, url };
  } catch (err) {
    logger.error('cloneRepo error:', err.message);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
    return { success: false, path: null, error: err.message || 'Clone failed' };
  }
}

function removeDir(dir) {
  try {
    if (dir && fs.existsSync(dir) && dir.includes('ripple-agent-')) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    logger.error('removeDir error:', err.message);
  }
}

module.exports = { cloneToTemp, isGitHubUrl, parseGitHubUrl, removeDir };
