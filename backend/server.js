const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { run } = require('./agents/orchestrator');
const { cloneToTemp, isGitHubUrl, removeDir } = require('./utils/cloneRepo');
const { read, write, EMPTY_RESULTS, failurePayload } = require('./utils/resultsStore');
const logger = require('./utils/logger');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.post('/api/run-agent', async (req, res) => {
  let tempDir = null;
  logger.info('run-agent received:', JSON.stringify(req.body));
  try {
    const { repo, teamName, leaderName } = req.body || {};
    const repoInput = typeof repo === 'string' ? repo.trim() : '';

    if (!repoInput) {
      logger.warn('run-agent: missing repo');
      return res.status(400).json({ error: 'Repository URL or path required' });
    }

    let repoPath = null;
    let displayRepo = repoInput;

    if (isGitHubUrl(repoInput)) {
      logger.info('run-agent: cloning GitHub repo', repoInput);
      res.status(202).json({ status: 'started', message: 'Cloning and running agent' });
      const cloneResult = await cloneToTemp(repoInput);
      if (!cloneResult.success) {
        logger.error('run-agent: clone failed', cloneResult.error);
        write(failurePayload({
          repo: repoInput,
          team_name: teamName || '',
          team_leader: leaderName || '',
          error: cloneResult.error,
        }));
        return;
      }
      repoPath = cloneResult.path;
      tempDir = repoPath;
    } else {
      repoPath = path.resolve(repoInput);
      if (!fs.existsSync(repoPath)) {
        return res.status(400).json({ error: 'Repository path does not exist' });
      }
      const normalized = path.normalize(repoPath);
      if (normalized.includes('..')) {
        return res.status(400).json({ error: 'Invalid repository path' });
      }
      res.status(202).json({ status: 'started', message: 'Agent run started' });
    }

    logger.info('run-agent: starting orchestrator');
    const results = await run(repoPath, teamName || 'Team', leaderName || 'Leader', displayRepo);
    write(results);
    logger.info('Run completed:', results.ci_status, 'score:', results.score);
  } catch (err) {
    logger.error('run-agent error:', err.message);
    write(failurePayload({
      repo: req.body?.repo || '',
      team_name: req.body?.teamName || '',
      team_leader: req.body?.leaderName || '',
      error: err.message,
    }));
  } finally {
    if (tempDir) removeDir(tempDir);
  }
});

app.get('/api/results', (req, res) => {
  try {
    const data = read();
    res.json(data);
  } catch (err) {
    logger.error('results error:', err.message);
    res.json(EMPTY_RESULTS);
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: !!config.geminiApiKey,
    retryLimit: config.retryLimit,
  });
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
  });
}
