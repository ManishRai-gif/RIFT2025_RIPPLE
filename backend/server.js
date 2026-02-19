const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { run } = require('./agents/orchestrator');
const { cloneToTemp, isGitHubUrl, removeDir } = require('./utils/cloneRepo');
const logger = require('./utils/logger');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/api/run-agent', async (req, res) => {
  let tempDir = null;
  try {
    const { repo, teamName, leaderName } = req.body || {};
    const repoInput = typeof repo === 'string' ? repo.trim() : '';

    if (!repoInput) {
      return res.status(400).json({ error: 'Repository URL or path required' });
    }

    let repoPath = null;
    let displayRepo = repoInput;

    if (isGitHubUrl(repoInput)) {
      res.status(202).json({ status: 'started', message: 'Cloning and running agent' });
      const cloneResult = await cloneToTemp(repoInput);
      if (!cloneResult.success) {
        const results = { repo: repoInput, ci_status: 'FAILED', error: cloneResult.error };
        fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
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

    const results = await run(repoPath, teamName || 'Team', leaderName || 'Leader', displayRepo);
    logger.info('Run completed:', results.ci_status, 'score:', results.score);
  } catch (err) {
    logger.error('run-agent error:', err.message);
    try {
      fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({
        repo: req.body?.repo || '',
        ci_status: 'FAILED',
        error: err.message,
      }, null, 2), 'utf8');
    } catch {}
  } finally {
    if (tempDir) removeDir(tempDir);
  }
});

const EMPTY_RESULTS = Object.freeze({
  repo: '',
  branch: '',
  total_failures: 0,
  total_fixes: 0,
  ci_status: '',
  iterations_used: 0,
  retry_limit: 5,
  score: 0,
  fixes: [],
  timeline: [],
});

app.get('/api/results', (req, res) => {
  try {
    const resultsPath = path.join(__dirname, 'results.json');
    if (!fs.existsSync(resultsPath)) {
      return res.json(EMPTY_RESULTS);
    }
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
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

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
