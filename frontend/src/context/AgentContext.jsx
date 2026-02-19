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
    console.warn('[Agent] Starting run:', { repo, teamName, leaderName });
    try {
      const res = await runAgent({ repo, teamName, leaderName });
      console.warn('[Agent] Run started, response:', res);
      const startTime = Date.now();
      const TIMEOUT_MS = 10 * 60 * 1000;
      const POLL_MS = 2000;
      let pollCount = 0;

      const poll = async () => {
        pollCount++;
        try {
          const data = await fetchResults();
          const normalized = data && typeof data === 'object' ? { ...data } : {};
          setResults(normalized);
          const done = normalized.ci_status === 'PASSED' || normalized.ci_status === 'FAILED' || normalized.error;
          if (normalized.run_log && normalized.run_log.length > 0) {
            console.warn('[Agent] Run log:', normalized.run_log.map(l => `+${l.t}ms ${l.msg} ${l.file ? l.file : ''} ${l.line ? 'L' + l.line : ''} ${l.bugType ? l.bugType : ''}`).join('\n'));
          }
          if (done) {
            console.warn('[Agent] Run complete:', normalized.ci_status, 'fixes:', normalized.fixes?.length, normalized);
            return true;
          }
          console.warn('[Agent] Poll', pollCount, 'ci_status:', normalized.ci_status || 'pending', 'log entries:', normalized.run_log?.length || 0);
        } catch (e) {
          console.warn('[Agent] Poll error:', e);
        }
        return Date.now() - startTime > TIMEOUT_MS;
      };

      while (!(await poll())) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (err) {
      const msg = err.message || 'Failed to start agent';
      setError(msg);
      console.warn('[Agent] Run failed:', err);
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
