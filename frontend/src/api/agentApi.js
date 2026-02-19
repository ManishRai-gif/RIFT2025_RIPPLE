const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function parseErrorResponse(text, status) {
  if (!text || status === 502 || status === 504) return text || `HTTP ${status}`;
  try {
    const j = JSON.parse(text);
    if (j && typeof j.error === 'string') return j.error;
  } catch (_) {}
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

async function request(url, options = {}) {
  const fullUrl = `${API_BASE}${url}`;
  const method = options.method || 'GET';
  const res = await fetch(fullUrl, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  if (!res.ok) {
    const msg = parseErrorResponse(text, res.status);
    throw new Error(msg);
  }
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (_) {
    throw new Error('Invalid JSON from backend');
  }
}

/** GET with one retry on network failure only. */
export async function fetchWithRetry(url, options = {}) {
  try {
    return await request(url, options);
  } catch (err) {
    const isNetwork = err.name === 'TypeError' && (err.message || '').includes('fetch');
    if (!isNetwork) throw err;
    await new Promise((r) => setTimeout(r, 1500));
    return request(url, options);
  }
}

export async function fetchResults() {
  return fetchWithRetry('/api/results');
}

/** POST run-agent: no retries so we fail fast with backend error. */
export async function runAgent(body) {
  return request('/api/run-agent', {
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

export function isApiBaseSet() {
  const u = import.meta.env.VITE_API_URL;
  return !!u && u.trim().length > 0;
}
