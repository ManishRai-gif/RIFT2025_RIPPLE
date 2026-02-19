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
app.use(cors({ origin: true, credentials: false, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Accept'] }));
app.use(express.json({ limit: '1mb' }));

// Keep the latest results in memory so the frontend can still
// show logs even if the results.json file is not available.
let lastResults = null;

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
<<<<<<< HEAD
      logger.info('run-agent: cloning GitHub repo', repoInput);
=======
      sendStarted();
>>>>>>> fe9cbff9b1d1095fed42d46c9818a6bdfbdc1f11
      const cloneResult = await cloneToTemp(repoInput);
      if (!cloneResult.success) {
        logger.error('run-agent: clone failed', cloneResult.error);
        write(failurePayload({
          repo: repoInput,
          team_name: teamName || '',
          team_leader: leaderName || '',
<<<<<<< HEAD
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
=======
          error: cloneResult.error || 'Clone failed (no details)',
        }));
        return;
>>>>>>> fe9cbff9b1d1095fed42d46c9818a6bdfbdc1f11
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
<<<<<<< HEAD
=======
      sendStarted();
>>>>>>> fe9cbff9b1d1095fed42d46c9818a6bdfbdc1f11
    }

    logger.info('run-agent: starting orchestrator');
    const results = await run(repoPath, teamName || 'Team', leaderName || 'Leader', displayRepo);
<<<<<<< HEAD
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
=======
    write(results);
    logger.info('Run completed:', results.ci_status, 'score:', results.score);
  } catch (err) {
    logger.error('run-agent error:', err.message);
    try {
      write(failurePayload({
        repo: repoInput,
        team_name: teamName || '',
        team_leader: leaderName || '',
        error: err.message || String(err) || 'Run failed (no details)',
      }));
    } catch (writeErr) {
      logger.error('run-agent: could not write failure payload', writeErr.message);
>>>>>>> fe9cbff9b1d1095fed42d46c9818a6bdfbdc1f11
    }
  } finally {
    if (tempDir) removeDir(tempDir);
  }
});

app.get('/api/results', (req, res) => {
  try {
<<<<<<< HEAD
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
=======
    const data = read();
    res.status(200).json({
      ok: true,
      ...data,
    });
  } catch (err) {
    logger.error('results error:', err.message);
    res.status(200).json({ ok: true, ...EMPTY_RESULTS });
>>>>>>> fe9cbff9b1d1095fed42d46c9818a6bdfbdc1f11
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
