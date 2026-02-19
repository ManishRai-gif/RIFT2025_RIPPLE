const fs = require('fs');
const path = require('path');
const { analyzeBug } = require('./analyzerAgent');
const { runTests } = require('./testAgent');
const { proposeFix, applyFix } = require('./fixAgent');
const { createBranch, commit, getCommitCount, formatBranchName } = require('./gitAgent');
const { getCIStatus } = require('./ciAgent');
const config = require('../config');
const logger = require('../utils/logger');

function extractFilePath(testOutput) {
  const m = testOutput.match(/(?:at|in)\s+[\w.]+\s+\(([^)]+)\)|(\/[\w./-]+\.(?:js|ts|jsx|tsx))/);
  return m ? (m[1] || m[2] || '').split(':')[0] : '';
}

async function run(repoPath, teamName = 'Team', leaderName = 'Leader') {
  const startTime = Date.now();
  const timeline = [];
  const fixes = [];
  let totalFailures = 0;
  let totalFixes = 0;
  let ciStatus = 'FAILED';
  let branch = formatBranchName(teamName, leaderName);

  const addTimeline = (event, data = {}) => {
    timeline.push({ time: Date.now() - startTime, event, ...data });
  };

  try {
    if (!repoPath || !fs.existsSync(repoPath)) {
      return buildResults(repoPath, branch, 0, 0, 'FAILED', 0, config.retryLimit, 0, [], [], startTime);
    }

    addTimeline('START');
    const branchResult = await createBranch(repoPath, teamName, leaderName);
    if (branchResult.success) branch = branchResult.branch;
    addTimeline('BRANCH_CREATED', { branch });

    let iterations = 0;
    let lastOutput = '';

    while (iterations < config.retryLimit) {
      iterations++;
      addTimeline('TEST_START', { iteration: iterations });

      const testResult = await runTests(repoPath);
      lastOutput = testResult.stdout || '';

      if (testResult.success) {
        ciStatus = 'PASSED';
        addTimeline('TEST_PASSED', { iteration: iterations });
        break;
      }

      totalFailures++;
      addTimeline('TEST_FAILED', { iteration: iterations });

      let analysis = { rootCause: 'Unknown', file: '', suggestion: '', confidence: 0 };
      try {
        analysis = await analyzeBug(repoPath, lastOutput);
      } catch (err) {
        logger.error('Analyzer failed:', err.message);
        fixes.push({ iteration: iterations, status: 'FAILED', reason: 'Analysis failed' });
        continue;
      }

      const fileToFix = analysis.file || extractFilePath(lastOutput);
      if (!fileToFix) {
        fixes.push({ iteration: iterations, status: 'FAILED', reason: 'No file identified' });
        continue;
      }

      const absPath = path.join(repoPath, fileToFix);
      let fileContent = '';
      try {
        if (fs.existsSync(absPath)) fileContent = fs.readFileSync(absPath, 'utf8');
      } catch {}

      let fix = null;
      try {
        fix = await proposeFix(fileToFix, fileContent, analysis, lastOutput);
      } catch (err) {
        logger.error('Fix proposal failed:', err.message);
        fixes.push({ iteration: iterations, status: 'FAILED', reason: 'Fix proposal failed' });
        continue;
      }

      if (!fix) {
        fixes.push({ iteration: iterations, status: 'FAILED', reason: 'Invalid fix from LLM' });
        continue;
      }

      const applied = await applyFix(repoPath, fix);
      if (!applied) {
        fixes.push({ iteration: iterations, status: 'FAILED', reason: 'Apply failed' });
        continue;
      }

      totalFixes++;
      fixes.push({ iteration: iterations, status: 'APPLIED', file: fix.file });
      addTimeline('FIX_APPLIED', { file: fix.file });

      const commitResult = await commit(repoPath, `AI fix iteration ${iterations}`);
      if (commitResult.success) addTimeline('COMMIT', { iteration: iterations });
    }

    if (ciStatus !== 'PASSED') {
      const finalStatus = await getCIStatus(repoPath);
      ciStatus = finalStatus.passing ? 'PASSED' : 'FAILED';
    }

    const elapsed = (Date.now() - startTime) / 1000 / 60;
    const commits = await getCommitCount(repoPath);
    const score = computeScore(elapsed, commits);

    const results = buildResults(repoPath, branch, totalFailures, totalFixes, ciStatus, iterations, config.retryLimit, score, fixes, timeline, startTime);
    const resultsPath = path.join(__dirname, '..', 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8');
    addTimeline('DONE');
    return results;
  } catch (err) {
    logger.error('orchestrator error:', err.message);
    const results = buildResults(repoPath, branch, totalFailures, totalFixes, 'FAILED', 0, config.retryLimit, 0, fixes, timeline, startTime);
    try {
      fs.writeFileSync(path.join(__dirname, '..', 'results.json'), JSON.stringify(results, null, 2), 'utf8');
    } catch {}
    return results;
  }
}

function computeScore(elapsedMinutes, commitCount) {
  let score = 100;
  if (elapsedMinutes < 5) score += 10;
  if (commitCount > 20) score -= 2 * (commitCount - 20);
  return Math.max(0, score);
}

function buildResults(repo, branch, totalFailures, totalFixes, ciStatus, iterationsUsed, retryLimit, score, fixes, timeline, startTime) {
  return {
    repo: repo || '',
    branch: branch || '',
    total_failures: totalFailures,
    total_fixes: totalFixes,
    ci_status: ciStatus,
    iterations_used: iterationsUsed,
    retry_limit: retryLimit,
    score: score,
    fixes: Array.isArray(fixes) ? fixes : [],
    timeline: Array.isArray(timeline) ? timeline : [],
  };
}

module.exports = { run };
