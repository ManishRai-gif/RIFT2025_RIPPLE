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
  const m = testOutput.match(/(?:at|in)\s+[\w.]+\s+\(([^)]+)\)|(\/[\w./-]+\.(?:js|ts|jsx|tsx|py))/);
  if (m) return (m[1] || m[2] || '').split(':')[0];
  const py = testOutput.match(/([\w./-]+\.py)(?::\d+)?/);
  return py ? py[1] : '';
}

async function run(repoPath, teamName = 'Team', leaderName = 'Leader', displayRepo = null) {
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
      return buildResults(repoPath, branch, 0, 0, 'FAILED', 0, config.retryLimit, 0, [], [], null, teamName, leaderName, 0, { base: 100, speed_bonus: 0, efficiency_penalty: 0 });
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
        addTimeline('TEST_RUN', { iteration: iterations, passed: true });
        break;
      }

      totalFailures++;
      addTimeline('TEST_RUN', { iteration: iterations, passed: false });

      let analysis = { rootCause: 'Unknown', file: '', suggestion: '', confidence: 0 };
      try {
        analysis = await analyzeBug(repoPath, lastOutput);
      } catch (err) {
        logger.error('Analyzer failed:', err.message);
        fixes.push({ file: '—', bug_type: '—', line_number: null, commit_message: 'Analysis failed', status: 'Failed' });
        continue;
      }

      const fileToFix = analysis.file || extractFilePath(lastOutput);
      if (!fileToFix) {
        fixes.push({ file: '—', bug_type: '—', line_number: null, commit_message: 'No file identified', status: 'Failed' });
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
        fixes.push({ file: fileToFix, bug_type: '—', line_number: analysis.line, commit_message: '—', status: 'Failed' });
        continue;
      }

      if (!fix) {
        fixes.push({ file: fileToFix, bug_type: analysis.bugType, line_number: analysis.line, commit_message: '—', status: 'Failed' });
        continue;
      }

      const applied = await applyFix(repoPath, fix);
      if (!applied) {
        fixes.push({ file: fix.file, bug_type: analysis.bugType, line_number: analysis.line, commit_message: '—', status: 'Failed' });
        continue;
      }

      const commitMsg = `${analysis.bugType || 'LOGIC'} error in ${fileToFix}${analysis.line ? ` line ${analysis.line}` : ''} - Fix: ${analysis.suggestion || 'applied'}`;
      totalFixes++;
      fixes.push({
        iteration: iterations,
        file: fix.file,
        bug_type: analysis.bugType || 'LOGIC',
        line_number: analysis.line,
        commit_message: commitMsg,
        status: 'Fixed',
      });
      addTimeline('FIX_APPLIED', { file: fix.file });

      const commitResult = await commit(repoPath, commitMsg);
      if (commitResult.success) addTimeline('COMMIT', { iteration: iterations });
    }

    if (ciStatus !== 'PASSED') {
      const finalStatus = await getCIStatus(repoPath);
      ciStatus = finalStatus.passing ? 'PASSED' : 'FAILED';
    }

    const totalTimeMs = Date.now() - startTime;
    const elapsed = totalTimeMs / 1000 / 60;
    const commits = await getCommitCount(repoPath);
    const { score, breakdown } = computeScoreWithBreakdown(elapsed, commits);

    const repoDisplay = displayRepo || repoPath;
    const results = buildResults(repoDisplay, branch, totalFailures, totalFixes, ciStatus, iterations, config.retryLimit, score, fixes, timeline, null, teamName, leaderName, totalTimeMs, breakdown);
    const resultsPath = path.join(__dirname, '..', 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8');
    addTimeline('DONE');
    return results;
  } catch (err) {
    logger.error('orchestrator error:', err.message);
    const totalTimeMs = Date.now() - startTime;
    const repoDisplay = displayRepo || repoPath;
    const results = buildResults(repoDisplay, branch, totalFailures, totalFixes, 'FAILED', 0, config.retryLimit, 0, fixes, timeline, null, teamName, leaderName, totalTimeMs, { base: 100, speed_bonus: 0, efficiency_penalty: 0 });
    try {
      fs.writeFileSync(path.join(__dirname, '..', 'results.json'), JSON.stringify(results, null, 2), 'utf8');
    } catch {}
    return results;
  }
}

function computeScoreWithBreakdown(elapsedMinutes, commitCount) {
  const base = 100;
  const speedBonus = elapsedMinutes < 5 ? 10 : 0;
  const efficiencyPenalty = commitCount > 20 ? 2 * (commitCount - 20) : 0;
  const score = Math.max(0, base + speedBonus - efficiencyPenalty);
  return {
    score,
    breakdown: { base, speed_bonus: speedBonus, efficiency_penalty: efficiencyPenalty },
  };
}

function buildResults(repo, branch, totalFailures, totalFixes, ciStatus, iterationsUsed, retryLimit, score, fixes, timeline, startTime, teamName, leaderName, totalTimeMs, scoreBreakdown) {
  return {
    repo: repo || '',
    team_name: teamName || '',
    team_leader: leaderName || '',
    branch: branch || '',
    total_failures: totalFailures,
    total_fixes: totalFixes,
    ci_status: ciStatus,
    iterations_used: iterationsUsed,
    retry_limit: retryLimit,
    score: score,
    total_time_ms: totalTimeMs ?? 0,
    score_breakdown: scoreBreakdown || { base: 100, speed_bonus: 0, efficiency_penalty: 0 },
    fixes: Array.isArray(fixes) ? fixes : [],
    timeline: Array.isArray(timeline) ? timeline : [],
  };
}

module.exports = { run };
