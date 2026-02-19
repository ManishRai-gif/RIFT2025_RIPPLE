import React from 'react';
import { useAgent } from '../context/AgentContext';

function formatTime(ms) {
  if (ms == null || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  return m > 0 ? `${m}m ${secs}s` : `${secs}s`;
}

function formatTimelineEvent(t) {
  const time = t.time != null ? `+${t.time}ms` : '';
  switch (t.event) {
    case 'START':
      return { label: 'Run started', detail: null, kind: 'info', time };
    case 'BRANCH_CREATED':
      return { label: 'Branch created', detail: t.branch ? `Branch: ${t.branch}` : null, kind: 'info', time };
    case 'TEST_START':
      return { label: `Test run started`, detail: t.iteration ? `Iteration ${t.iteration}` : null, kind: 'info', time };
    case 'TEST_RUN':
      return {
        label: t.passed ? 'Tests passed' : 'Tests failed',
        detail: t.iteration ? `Iteration ${t.iteration}` : null,
        kind: t.passed ? 'passed' : 'failed',
        time,
      };
    case 'FIX_APPLIED':
      return { label: 'Fix applied', detail: t.file || null, kind: 'fix', time };
    case 'COMMIT':
      return { label: 'Committed', detail: t.iteration ? `Iteration ${t.iteration}` : null, kind: 'info', time };
    case 'DONE':
      return { label: 'Run complete', detail: null, kind: 'info', time };
    default:
      return { label: t.event || '—', detail: null, kind: 'info', time };
  }
}

export default function Dashboard() {
  const { results, loading, running, loadResults } = useAgent();

  if (loading && !results) {
    return (
      <section className="dashboard">
        <div className="cards-row">
          {['CI Status', 'Score', 'Failures', 'Fixes'].map((label, i) => (
            <div key={i} className="card stat">
              <span className="stat-label">{label}</span>
              <div className="loading-skeleton" style={{ marginTop: '0.2rem' }}>
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!results) {
    return (
      <section className="dashboard">
        <div className="card" style={{ animationDelay: '0.1s' }}>
          <p className="muted">Cannot load results. Check that the backend is running and VITE_API_URL is set.</p>
        </div>
      </section>
    );
  }

  const hasOutput =
    results.repo ||
    results.ci_status ||
    results.error ||
    (Array.isArray(results.fixes) && results.fixes.length > 0) ||
    (Array.isArray(results.timeline) && results.timeline.length > 0) ||
    (Array.isArray(results.run_log) && results.run_log.length > 0);

  if (!hasOutput) {
    return (
      <section className="dashboard">
        <div className="card info-card">
          <h3>What the agent checks</h3>
          <ul className="check-list">
            <li>Node.js / Python projects with <code>npm test</code> or <code>pytest</code></li>
            <li>Bug types: LINTING, SYNTAX, LOGIC, TYPE_ERROR, IMPORT, INDENTATION</li>
            <li>Test output and stack traces to find root cause</li>
          </ul>
          <p className="muted">Enter a GitHub URL, Team name, and Leader name. Click Run Agent. Results will appear here.</p>
          <p className="muted" style={{ marginTop: '0.5rem' }}>A full run usually takes <strong>1–5 minutes</strong> (clone, tests, AI fixes, repeat).</p>
        </div>
      </section>
    );
  }

  const statusPillClass = results.ci_status === 'PASSED' ? 'passed' : results.ci_status === 'FAILED' ? 'failed' : 'running';
  const sb = results.score_breakdown || {};
  const total = results.score ?? 0;
  const timeline = Array.isArray(results.timeline) ? results.timeline : [];
  const failedEarly =
    results.ci_status === 'FAILED' &&
    ((results.total_time_ms ?? 0) === 0 || timeline.length === 0);

  return (
    <section className="dashboard">
      {results.error && (
        <div className="card result-error-card">
          <h3>Error</h3>
          <p className="result-error-text">{results.error}</p>
        </div>
      )}

      {failedEarly && (
        <div className="card troubleshooting-card">
          <h3>Run failed before completing any steps</h3>
          <p className="troubleshooting-lead">
            The agent did not reach tests or fixes. Use the steps below to fix it.
          </p>
          <ul className="troubleshooting-list">
            <li><strong>Repo URL</strong> — Must be a public GitHub URL, e.g. <code>https://github.com/owner/repo</code></li>
            <li><strong>Backend</strong> — On Vercel: set <code>GEMINI_API_KEY</code> in the backend project and redeploy</li>
            <li><strong>Clone / network</strong> — If the error above mentions clone or network, the backend may not reach GitHub; try again or use a different repo</li>
            <li><strong>Logs</strong> — In Vercel: Project → Deployments → select deployment → Functions → view logs for the failing request</li>
          </ul>
          {!results.error && (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              No error message was returned. Check backend function logs for the real cause.
            </p>
          )}
        </div>
      )}

      <div className="card run-summary">
        <div className="run-summary-head">
          <h3>Run Summary</h3>
          <button type="button" className="btn-refresh" onClick={() => loadResults(false)} disabled={loading}>
            {loading ? '…' : 'Refresh results'}
          </button>
        </div>
        {running && (
          <p className="running-indicator">
            <span className="btn-spinner" style={{ marginRight: 8 }} />
            Run in progress…
          </p>
        )}
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">Repository</span>
            <span className="value mono">{results.repo || '—'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Team</span>
            <span className="value">{results.team_name || '—'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Leader</span>
            <span className="value">{results.team_leader || '—'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Branch</span>
            <span className="value mono">{results.branch || '—'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Failures</span>
            <span className="value">{results.total_failures ?? 0}</span>
          </div>
          <div className="summary-item">
            <span className="label">Fixes applied</span>
            <span className="value">{results.total_fixes ?? 0}</span>
          </div>
          <div className="summary-item">
            <span className="label">CI Status</span>
            <span className={`status-badge ${statusPillClass}`}>{results.ci_status || '—'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Total time</span>
            <span className="value">{formatTime(results.total_time_ms)}</span>
          </div>
        </div>
      </div>

      <div className="card score-breakdown">
        <h3>Score</h3>
        <div className="score-total">{total}</div>
        <div className="score-bar">
          <div className="score-segment base" style={{ width: `${Math.min(100, (sb.base || 100) / 1.2)}%` }} title="Base: 100" />
          {sb.speed_bonus > 0 && (
            <div className="score-segment bonus" style={{ width: `${(sb.speed_bonus || 0) / 1.2}%` }} title={`Speed bonus: +${sb.speed_bonus}`} />
          )}
          {sb.efficiency_penalty > 0 && (
            <div className="score-segment penalty" style={{ width: `${Math.min(50, (sb.efficiency_penalty || 0) / 1.2)}%` }} title={`Efficiency penalty: -${sb.efficiency_penalty}`} />
          )}
        </div>
        <div className="score-details">
          <span>Base: {(sb.base ?? 100)}</span>
          {sb.speed_bonus > 0 && <span className="success">+{sb.speed_bonus} (speed &lt; 5 min)</span>}
          {sb.efficiency_penalty > 0 && <span className="error">−{sb.efficiency_penalty} (commits &gt; 20)</span>}
        </div>
      </div>

      <div className="card fixes-table-card">
        <h3>Fixes Applied</h3>
        <div className="table-wrap">
          <table className="fixes-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Bug Type</th>
                <th>Line</th>
                <th>Commit Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(results.fixes) && results.fixes.length > 0 ? (
                results.fixes.map((f, i) => (
                  <tr key={i} className={f.status === 'Fixed' ? 'row-fixed' : 'row-failed'}>
                    <td><code>{f.file || '—'}</code></td>
                    <td><span className="bug-type">{f.bug_type || '—'}</span></td>
                    <td>{f.line_number ?? '—'}</td>
                    <td className="commit-msg">{f.commit_message || '—'}</td>
                    <td>
                      <span className={`status-cell ${f.status === 'Fixed' ? 'fixed' : 'failed'}`}>
                        {f.status === 'Fixed' ? '✓ Fixed' : '✗ Failed'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="muted">No fixes recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card timeline-card">
        <h3>CI/CD Timeline</h3>
        <div className="timeline-header">
          <span>Iterations: {results.iterations_used ?? 0} / {results.retry_limit ?? 5}</span>
        </div>
        {timeline.length > 0 ? (
          <div className="timeline-list">
            {timeline.map((t, i) => {
              const { label, detail, kind, time } = formatTimelineEvent(t);
              return (
                <div key={i} className={`timeline-item timeline-item-${kind}`}>
                  <span className={`timeline-badge timeline-badge-${kind}`}>
                    {kind === 'passed' ? '✓' : kind === 'failed' ? '✗' : '•'}
                  </span>
                  <span className="timeline-label">{label}</span>
                  {detail && <span className="timeline-detail">{typeof detail === 'string' && detail.length > 60 ? <code title={detail}>{detail.slice(0, 60)}…</code> : <code>{detail}</code>}</span>}
                  <span className="timeline-ts">{time}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No timeline events yet</p>
        )}
      </div>

      <div className="card run-log-card">
        <h3>Run Log</h3>
        {Array.isArray(results.run_log) && results.run_log.length > 0 ? (
          <pre className="run-log-pre">
            {results.run_log.map((l, i) => `+${l.t}ms ${l.msg}${l.file ? ' ' + l.file : ''}${l.line != null ? ' L' + l.line : ''}${l.bugType ? ' ' + l.bugType : ''}`).join('\n')}
          </pre>
        ) : (
          <p className="muted">No run log yet</p>
        )}
      </div>
    </section>
  );
}
