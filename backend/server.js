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
  const body = req.body || {};
  const { repo = '', teamName = '', leaderName = '' } = body;
  logger.info('run-agent received:', JSON.stringify(body));

  const repoInput = typeof repo === 'string' ? repo.trim() : '';
  if (!repoInput) {
    return res.status(400).json({
      ok: false,
      error: 'Repository URL or path required',
      received: { repo: body.repo, teamName: body.teamName, leaderName: body.leaderName },
    });
  }

  const sendStarted = () => {
    res.status(202).json({
      ok: true,
      status: 'started',
      message: 'Agent run started',
      repo: repoInput,
      teamName: teamName || 'Team',
      leaderName: leaderName || 'Leader',
      estimated_seconds: 120,
      note: 'Full output usually ready in 1–5 minutes. Poll GET /api/results.',
    });
  };

  try {
    let repoPath = null;
    const displayRepo = repoInput;

    if (isGitHubUrl(repoInput)) {
      sendStarted();
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
        return res.status(400).json({
          ok: false,
          error: 'Repository path does not exist',
          path: repoInput,
        });
      }
      const normalized = path.normalize(repoPath);
      if (normalized.includes('..')) {
        return res.status(400).json({ ok: false, error: 'Invalid repository path' });
      }
      sendStarted();
    }

    logger.info('run-agent: starting orchestrator');
    const results = await run(repoPath, teamName || 'Team', leaderName || 'Leader', displayRepo);
    write(results);
    logger.info('Run completed:', results.ci_status, 'score:', results.score);
  } catch (err) {
    logger.error('run-agent error:', err.message);
    write(failurePayload({
      repo: repoInput,
      team_name: teamName || '',
      team_leader: leaderName || '',
      error: err.message,
    }));
  } finally {
    if (tempDir) removeDir(tempDir);
  }
});

app.get('/api/results', (req, res) => {
  try {
    const data = read();
    res.status(200).json({
      ok: true,
      ...data,
    });
  } catch (err) {
    logger.error('results error:', err.message);
    res.status(200).json({ ok: true, ...EMPTY_RESULTS });
  }
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
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
