import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchResults, runAgent, getApiBase } from '../api/agentApi';

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
      const msg = `Cannot reach backend at ${getApiBase()}. Check VITE_API_URL.`;
      setError(msg);
      setResults(null);
      console.error('[Agent] loadResults failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerRun = useCallback(async (repo, teamName, leaderName) => {
    setRunning(true);
    setError(null);
    console.log('[Agent] Starting run:', { repo, teamName, leaderName });
    try {
      const res = await runAgent({ repo, teamName, leaderName });
      console.log('[Agent] Run started, response:', res);
      const startTime = Date.now();
      const TIMEOUT_MS = 10 * 60 * 1000;
      const POLL_MS = 2000;
      let pollCount = 0;

      const poll = async () => {
        pollCount++;
        try {
          const data = await fetchResults();
          setResults(data);
          const done = data.ci_status === 'PASSED' || data.ci_status === 'FAILED' || data.error;
          if (done) {
            console.log('[Agent] Run complete:', data.ci_status, data);
            return true;
          }
          if (pollCount % 5 === 0) {
            console.log('[Agent] Polling...', pollCount, 'ci_status:', data.ci_status || 'pending');
          }
        } catch (e) {
          console.error('[Agent] Poll error:', e);
        }
        return Date.now() - startTime > TIMEOUT_MS;
      };

      while (!(await poll())) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (err) {
      const msg = err.message || 'Failed to start agent';
      setError(msg);
      console.error('[Agent] Run failed:', err);
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
