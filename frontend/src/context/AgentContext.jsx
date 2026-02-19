import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchResults, runAgent } from '../api/agentApi';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchResults();
      setResults(data);
    } catch (err) {
      setError('Cannot reach backend. Set VITE_API_URL to your backend URL.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerRun = useCallback(async (repo, teamName, leaderName) => {
    setRunning(true);
    setError(null);
    try {
      await runAgent({ repo, teamName, leaderName });
      const startTime = Date.now();
      const TIMEOUT_MS = 10 * 60 * 1000;
      const POLL_MS = 2000;

      const poll = async () => {
        try {
          const data = await fetchResults();
          setResults(data);
          const r = String(data.repo || '').trim();
          const submitted = String(repo || '').trim();
          const repoMatch = !submitted || r === submitted || r.endsWith(submitted) || submitted.endsWith(r);
          const done = data.ci_status === 'PASSED' || data.ci_status === 'FAILED' || data.error;
          if (repoMatch && done) return true;
        } catch {}
        return Date.now() - startTime > TIMEOUT_MS;
      };

      while (!(await poll())) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (err) {
      setError(err.message || 'Failed to start agent');
    } finally {
      setRunning(false);
    }
  }, []);

  const value = {
    results,
    loading,
    error,
    running,
    loadResults,
    triggerRun,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}
