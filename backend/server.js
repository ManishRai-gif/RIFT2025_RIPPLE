const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { run } = require('./agents/orchestrator');
const logger = require('./utils/logger');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/api/run-agent', async (req, res) => {
  try {
    const { repo, teamName, leaderName } = req.body || {};
    const repoPath = typeof repo === 'string' ? path.resolve(repo.trim()) : null;
    
    if (!repoPath || !fs.existsSync(repoPath)) {
      return res.status(400).json({ error: 'Valid local repository path required' });
    }

    const safeRepo = path.normalize(repoPath);
    if (safeRepo.includes('..')) {
      return res.status(400).json({ error: 'Invalid repository path' });
    }

    res.status(202).json({ status: 'started', message: 'Agent run started' });

    const results = await run(safeRepo, teamName || 'Team', leaderName || 'Leader');
    logger.info('Run completed:', results.ci_status, 'score:', results.score);
  } catch (err) {
    logger.error('run-agent error:', err.message);
  }
});

app.get('/api/results', (req, res) => {
  try {
    const resultsPath = path.join(__dirname, 'results.json');
    if (!fs.existsSync(resultsPath)) {
      return res.status(404).json({ error: 'No results yet' });
    }
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    res.json(data);
  } catch (err) {
    logger.error('results error:', err.message);
    res.status(500).json({ error: 'Failed to load results' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    geminiConfigured: !!config.geminiApiKey,
    retryLimit: config.retryLimit 
  });
});

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});
