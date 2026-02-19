import React from 'react';
import { useAgent } from '../context/AgentContext';

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
            <li>Node.js projects with <code>npm test</code> (Jest, Mocha, etc.)</li>
            <li>Syntax errors, logic bugs, missing imports</li>
            <li>Test output and stack traces to find root cause</li>
          </ul>
          <p className="muted">Enter a GitHub URL above and click Run Agent. Results will appear here after a run completes.</p>
        </div>
      </section>
    );
  }

  const statusClass = results.ci_status === 'PASSED' ? 'success' : 'error';
  const statusPillClass = results.ci_status === 'PASSED' ? 'passed' : 'failed';

  return (
    <section className="dashboard">
      <div className="cards-row">
        <div className="card stat">
          <span className="stat-label">CI Status</span>
          <span className={`status-pill ${statusPillClass}`}>{results.ci_status}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Score</span>
          <span className="stat-value">{results.score ?? 0}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Failures</span>
          <span className="stat-value">{results.total_failures ?? 0}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Fixes</span>
          <span className="stat-value">{results.total_fixes ?? 0}</span>
        </div>
      </div>
      <div className="card">
        <h3>Summary</h3>
        <dl className="summary">
          <dt>Repo</dt>
          <dd>{results.repo || '—'}</dd>
          <dt>Branch</dt>
          <dd>{results.branch || '—'}</dd>
          <dt>Iterations</dt>
          <dd>{results.iterations_used ?? 0} / {results.retry_limit ?? 5}</dd>
        </dl>
      </div>
      <div className="card">
        <h3>Fixes</h3>
        {Array.isArray(results.fixes) && results.fixes.length > 0 ? (
          <ul className="fix-list">
            {results.fixes.map((f, i) => (
              <li key={i} className={f.status}>
                <span>{f.status}</span>
                {f.file && <code>{f.file}</code>}
                {f.reason && <span className="reason">{f.reason}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No fixes recorded</p>
        )}
      </div>
      <div className="card">
        <h3>Timeline</h3>
        {Array.isArray(results.timeline) && results.timeline.length > 0 ? (
          <ul className="timeline">
            {results.timeline.map((t, i) => (
              <li key={i}>
                <span className="time">+{t.time}ms</span>
                <span className="event">{t.event}</span>
                {t.branch && <code>{t.branch}</code>}
                {t.file && <code>{t.file}</code>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No timeline events</p>
        )}
      </div>
    </section>
  );
}
