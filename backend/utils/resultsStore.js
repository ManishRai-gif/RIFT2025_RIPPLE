const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Use writable /tmp on Vercel/serverless; /var/* is read-only there
const defaultResultsPath = path.join(__dirname, '..', 'results.json');
const isReadOnlyFs = !!(
  process.env.VERCEL ||
  (typeof defaultResultsPath === 'string' && defaultResultsPath.startsWith('/var/'))
);
const RESULTS_FILE = isReadOnlyFs ? '/tmp/ripple-agent-results.json' : defaultResultsPath;
const isServerless = isReadOnlyFs;

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
  error: '',
});

function failurePayload(overrides = {}) {
  return {
    repo: '',
    team_name: '',
    team_leader: '',
    branch: '',
    total_failures: 0,
    total_fixes: 0,
    ci_status: 'FAILED',
    iterations_used: 0,
    retry_limit: 5,
    score: 0,
    total_time_ms: 0,
    score_breakdown: { base: 100, speed_bonus: 0, efficiency_penalty: 0 },
    fixes: [],
    timeline: [],
    run_log: [],
    error: '',
    ...overrides,
  };
}

function read() {
  try {
    if (!fs.existsSync(RESULTS_FILE)) return { ...EMPTY_RESULTS };
    const data = fs.readFileSync(RESULTS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return { ...EMPTY_RESULTS, ...parsed };
  } catch (err) {
    logger.error('resultsStore read error:', err.message);
    return { ...EMPTY_RESULTS };
  }
}

function write(data) {
  try {
    if (!isServerless) {
      const dir = path.dirname(RESULTS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error('resultsStore write error:', err.message);
    throw err;
  }
}

module.exports = {
  EMPTY_RESULTS,
  failurePayload,
  read,
  write,
};
