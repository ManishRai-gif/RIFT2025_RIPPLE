import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchResults, runAgent, getApiBase } from '../api/agentApi';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const loadResults = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchResults();
      const normalized = data && typeof data === 'object' ? { ...data } : {};
      setResults(normalized);
    } catch (err) {
      if (!isBackgroundRefresh) {
        const msg = `Cannot reach backend at ${getApiBase()}. Check VITE_API_URL.`;
        setError(msg);
        setResults(null);
        console.warn('[Agent] loadResults failed:', err);
      }
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  }, []);

  const triggerRun = useCallback(async (repo, teamName, leaderName) => {
    setRunning(true);
    setError(null);
    try {
      await runAgent({ repo, teamName, leaderName });
      const startTime = Date.now();
      const TIMEOUT_MS = 10 * 60 * 1000;
      const POLL_MS = 2500;
      const MAX_POLL_FAILURES = 5;
      let pollFailures = 0;

      while (true) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (Date.now() - startTime > TIMEOUT_MS) {
          setError('Run timed out (10 min). Check backend logs.');
          break;
        }
        try {
          const data = await fetchResults();
          const normalized = data && typeof data === 'object' ? { ...data } : {};
          setResults(normalized);
          pollFailures = 0;
          const done = normalized.ci_status === 'PASSED' || normalized.ci_status === 'FAILED' || normalized.error;
          if (done) break;
        } catch (e) {
          pollFailures++;
          if (pollFailures >= MAX_POLL_FAILURES) {
            setError(`Backend unreachable after ${MAX_POLL_FAILURES} attempts. Check VITE_API_URL and backend.`);
            break;
          }
        }
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
