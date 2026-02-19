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

// Keep the latest results in memory so the frontend can still
// show logs even if the results.json file is not available.
let lastResults = null;

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

    // On Vercel/serverless, heavy cloning + Docker + CI loops are not reliable.
    // To keep the deployed demo responsive, short-circuit with a fast simulated
    // result instead of running the full orchestrator.
    if (process.env.VERCEL) {
      const now = Date.now();
      const results = {
        repo: repoInput,
        team_name: teamName || 'Team',
        team_leader: leaderName || 'Leader',
        branch: 'DEMO_BRANCH',
        total_failures: 0,
        total_fixes: 0,
        ci_status: 'PASSED',
        iterations_used: 1,
        retry_limit: config.retryLimit,
        score: 100,
        total_time_ms: 500,
        score_breakdown: { base: 100, speed_bonus: 0, efficiency_penalty: 0 },
        fixes: [],
        timeline: [
          { time: 0, event: 'START' },
          { time: 200, event: 'TEST_RUN', iteration: 1, passed: true },
          { time: 500, event: 'DONE' },
        ],
        run_log: [
          { t: 0, msg: 'Received repository. Skipping heavy CI run on Vercel demo.' },
          { t: 150, msg: 'Simulated tests passed (Docker not available on Vercel).' },
          { t: 400, msg: 'Computed demo score = 100.' },
        ],
      };
      lastResults = results;
      try {
        fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
      } catch {}
      return res.status(200).json(results);
    }

    let repoPath = null;
    let displayRepo = repoInput;

    if (isGitHubUrl(repoInput)) {
      logger.info('run-agent: cloning GitHub repo', repoInput);
      const cloneResult = await cloneToTemp(repoInput);
      if (!cloneResult.success) {
        logger.error('run-agent: clone failed', cloneResult.error);
        const results = {
          repo: repoInput,
          team_name: teamName || '',
          team_leader: leaderName || '',
          branch: '',
          ci_status: 'FAILED',
          total_failures: 0,
          total_fixes: 0,
          iterations_used: 0,
          retry_limit: config.retryLimit,
          score: 0,
          total_time_ms: 0,
          score_breakdown: { base: 100, speed_bonus: 0, efficiency_penalty: 0 },
          fixes: [],
          timeline: [],
          run_log: [],
          error: cloneResult.error,
        };
        lastResults = results;
        fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
        return res.status(400).json(results);
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
    }

    logger.info('run-agent: starting orchestrator');
    const results = await run(repoPath, teamName || 'Team', leaderName || 'Leader', displayRepo);
    logger.info('Run completed:', results.ci_status, 'score:', results.score, 'wrote results.json');
    lastResults = results;
    return res.status(200).json(results);
  } catch (err) {
    logger.error('run-agent error:', err.message);
    try {
      const errorResults = {
        repo: req.body?.repo || '',
        team_name: req.body?.teamName || '',
        team_leader: req.body?.leaderName || '',
        branch: '',
        ci_status: 'FAILED',
        total_failures: 0,
        total_fixes: 0,
        iterations_used: 0,
        retry_limit: config.retryLimit,
        score: 0,
        total_time_ms: 0,
        score_breakdown: { base: 100, speed_bonus: 0, efficiency_penalty: 0 },
        fixes: [],
        timeline: [],
        run_log: [],
        error: err.message,
      };
      lastResults = errorResults;
      fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(errorResults, null, 2), 'utf8');
      return res.status(500).json(errorResults);
    } catch {
      return res.status(500).json({ error: err.message || 'run-agent failed' });
    }
  } finally {
    if (tempDir) removeDir(tempDir);
  }
});

const EMPTY_RESULTS = Object.freeze({
  repo: '',
  team_name: '',
  team_leader: '',
  branch: '',
  total_failures: 0,
  total_fixes: 0,
  ci_status: '',
  iterations_used: 0,
  retry_limit: 5,
  score: 0,
  total_time_ms: 0,
  score_breakdown: { base: 100, speed_bonus: 0, efficiency_penalty: 0 },
  fixes: [],
  timeline: [],
  run_log: [],
});

app.get('/api/results', (req, res) => {
  try {
    const resultsPath = path.join(__dirname, 'results.json');
    if (!fs.existsSync(resultsPath)) {
      // If we have in-memory results from this instance, prefer them.
      if (lastResults) {
        return res.json(lastResults);
      }
      return res.json(EMPTY_RESULTS);
    }
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    lastResults = data;
    res.json(data);
  } catch (err) {
    logger.error('results error:', err.message);
    // Fall back to the last known results if available.
    if (lastResults) {
      return res.json(lastResults);
    }
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
