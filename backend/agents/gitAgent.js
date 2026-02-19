const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

function formatBranchName(teamName, leaderName) {
  const team = String(teamName || 'Team').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
  const leader = String(leaderName || 'Leader').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
  return `${team}_${leader}_AI_Fix`;
}

async function createBranch(repoPath, teamName, leaderName) {
  try {
    if (!fs.existsSync(repoPath)) return { success: false, branch: null, error: 'Repo not found' };
    const git = simpleGit(repoPath);
    const branch = formatBranchName(teamName, leaderName);
    await git.checkoutLocalBranch(branch);
    return { success: true, branch };
  } catch (err) {
    try {
      const git = simpleGit(repoPath);
      const branch = formatBranchName(teamName, leaderName);
      await git.checkoutBranch(branch, await git.revparse(['HEAD']));
      return { success: true, branch };
    } catch (e) {
      logger.error('gitAgent createBranch error:', e.message);
      return { success: false, branch: null, error: e.message };
    }
  }
}

async function commit(repoPath, message) {
  try {
    const git = simpleGit(repoPath);
    await git.add('.');
    const status = await git.status();
    if (status.files.length === 0) return { success: false, count: 0 };
    await git.commit(message ? `[AI-AGENT] ${message}` : '[AI-AGENT] Fix');
    return { success: true, count: status.files.length };
  } catch (err) {
    logger.error('gitAgent commit error:', err.message);
    return { success: false, count: 0 };
  }
}

async function push(repoPath, branch, remoteUrl) {
  const config = require('../config');
  const token = config.githubToken;
  if (!token || !remoteUrl) return { success: false, error: 'GITHUB_TOKEN not set - add to env for push' };
  try {
    const git = simpleGit(repoPath);
    const authUrl = String(remoteUrl).replace(/^https:\/\//, `https://x-access-token:${token}@`).replace(/^http:\/\//, `http://x-access-token:${token}@`);
    await git.removeRemote('agent-push').catch(() => {});
    await git.addRemote('agent-push', authUrl);
    await git.push('agent-push', branch, ['--force']);
    await git.removeRemote('agent-push').catch(() => {});
    return { success: true };
  } catch (err) {
    logger.error('gitAgent push error:', err.message);
    return { success: false, error: err.message };
  }
}

async function getCommitCount(repoPath) {
  try {
    const git = simpleGit(repoPath);
    const log = await git.log();
    return log.total;
  } catch {
    return 0;
  }
}

module.exports = { createBranch, commit, push, getCommitCount, formatBranchName };
