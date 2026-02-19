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
  const method = options.method || 'GET';
  const body = options.body;
  console.warn('[Agent API] REQUEST', method, fullUrl);
  if (body) console.warn('[Agent API] REQUEST BODY:', typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(fullUrl, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
      const text = await res.text();
      console.warn('[Agent API] RESPONSE', res.status, fullUrl);
      console.warn('[Agent API] RESPONSE BODY:', text ? (text.length > 2000 ? text.slice(0, 2000) + '...[truncated]' : text) : '(empty)');
      if (!res.ok) {
        lastErr = new Error(text || `HTTP ${res.status}`);
        logError('Request failed', lastErr.message);
        throw lastErr;
      }
      const raw = text ? JSON.parse(text) : {};
      const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
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
