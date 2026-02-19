const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const RETRY_DELAY = 2000;
const MAX_RETRIES = 3;

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }
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
