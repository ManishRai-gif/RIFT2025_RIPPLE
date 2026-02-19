import React from 'react';
import { useAgent } from '../context/AgentContext';

function formatTime(ms) {
  if (ms == null || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  return m > 0 ? `${m}m ${secs}s` : `${secs}s`;
}

export default function Dashboard() {
  const { results, loading } = useAgent();

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

  const isEmpty = !results || (results.ci_status === '' && !results.repo);

  if (!results) {
    return (
      <section className="dashboard">
        <div className="card" style={{ animationDelay: '0.1s' }}>
          <p className="muted">Cannot load results. Check that the backend is running and VITE_API_URL is set.</p>
        </div>
      </section>
    );
  }

  if (isEmpty) {
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

  const statusPillClass = results.ci_status === 'PASSED' ? 'passed' : 'failed';
  const sb = results.score_breakdown || {};
  const total = results.score ?? 0;

  return (
    <section className="dashboard">
      <div className="card run-summary">
        <h3>Run Summary</h3>
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
        <h3>Score Breakdown</h3>
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

      {Array.isArray(results.run_log) && results.run_log.length > 0 && (
        <div className="card run-log-card">
          <h3>Run Log (checks & updates)</h3>
          <pre className="run-log-pre">{results.run_log.map((l, i) => `+${l.t}ms ${l.msg} ${l.file || ''} ${l.line ? 'L' + l.line : ''} ${l.bugType || ''}`).join('\n')}</pre>
        </div>
      )}
      <div className="card timeline-card">
        <h3>CI/CD Status Timeline</h3>
        <div className="timeline-header">
          <span>Iterations: {results.iterations_used ?? 0} / {results.retry_limit ?? 5}</span>
        </div>
        {Array.isArray(results.timeline) && results.timeline.length > 0 ? (
          <div className="timeline-list">
            {results.timeline
              .filter(t => t.event === 'TEST_RUN')
              .map((t, i) => (
                <div key={i} className={`timeline-item ${t.passed ? 'passed' : 'failed'}`}>
                  <span className="timeline-badge">{t.passed ? '✓' : '✗'}</span>
                  <span className="timeline-iter">Iteration {t.iteration}</span>
                  <span className="timeline-status">{t.passed ? 'PASSED' : 'FAILED'}</span>
                  <span className="timeline-ts">+{t.time}ms</span>
                </div>
              ))}
            {results.timeline.filter(t => t.event === 'TEST_RUN').length === 0 && results.timeline.map((t, i) => (
              <div key={i} className="timeline-item">
                <span className="timeline-ts">+{t.time}ms</span>
                <span className="timeline-event">{t.event}</span>
                {t.branch && <code>{t.branch}</code>}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No timeline events</p>
        )}
      </div>
    </section>
  );
}
