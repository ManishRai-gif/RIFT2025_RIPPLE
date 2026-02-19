const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const RETRY_DELAY = 2000;
const MAX_RETRIES = 2;

function log(msg, data) {
  console.warn(`[Agent API] ${msg}`, data !== undefined ? data : '');
}
function logError(msg, err) {
  console.warn(`[Agent API] ERROR ${msg}`, err);
}

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  const fullUrl = `${API_BASE}${url}`;
  log('Request', { url: fullUrl, method: options.method || 'GET' });
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(fullUrl, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
      const text = await res.text();
      log('Response', { status: res.status, url: fullUrl });
      if (!res.ok) {
        lastErr = new Error(text || `HTTP ${res.status}`);
        logError('Request failed', lastErr.message);
        throw lastErr;
      }
      const data = text ? JSON.parse(text) : {};
      return data;
    } catch (err) {
      lastErr = err;
      logError('Attempt failed', { attempt: i + 1, error: err.message });
      if (i < retries) await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }
  logError('All retries failed', lastErr?.message);
  throw lastErr;
}

export async function fetchResults() {
  return fetchWithRetry('/api/results');
}

export async function runAgent(body) {
  return fetchWithRetry('/api/run-agent', {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}

export async function fetchHealth() {
  return fetchWithRetry('/api/health');
}

export function getApiBase() {
  return API_BASE;
}
