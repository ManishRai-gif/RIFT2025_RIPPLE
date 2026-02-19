import React, { useState } from 'react';
import { useAgent } from '../context/AgentContext';
import { getApiBase } from '../api/agentApi';

export default function RunForm() {
  const { triggerRun, running } = useAgent();
  const [repo, setRepo] = useState('');
  const [teamName, setTeamName] = useState('RIFT ORGANISERS');
  const [leaderName, setLeaderName] = useState('Saiyam Kumar');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!repo.trim() || running) return;
    triggerRun(repo.trim(), teamName.trim() || 'Team', leaderName.trim() || 'Leader');
  };

  return (
    <section className="card run-form">
      <h2>Run Agent</h2>
      <p className="api-hint">API: {getApiBase()}</p>
      <form onSubmit={handleSubmit}>
        <label>
          GitHub URL or local path
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="https://github.com/user/repo"
            disabled={running}
          />
        </label>
        <label>
          Team name
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="RIFT ORGANISERS"
            disabled={running}
          />
        </label>
        <label>
          Leader name
          <input
            type="text"
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
            placeholder="Saiyam Kumar"
            disabled={running}
          />
        </label>
        <button type="submit" disabled={!repo.trim() || running}>
          {running ? (
            <>
              <span className="btn-spinner" />
              Running…
            </>
          ) : (
            'Run Agent'
          )}
        </button>
      </form>
    </section>
  );
}
