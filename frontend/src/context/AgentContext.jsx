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
      console.warn('[Agent] loadResults failed:', err);
    } finally {
      setLoading(false);
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
      const TIMEOUT_MS = 3 * 60 * 1000;
      const POLL_MS = 2000;
      let pollCount = 0;

      const poll = async () => {
        pollCount++;
        try {
          const data = await fetchResults();
          setResults(data);
          const status = data.ci_status || '';
          const done =
            status === 'PASSED' ||
            status === 'FAILED' ||
            !!data.error ||
            (typeof data.iterations_used === 'number' &&
              typeof data.retry_limit === 'number' &&
              data.iterations_used >= data.retry_limit);
          if (data.run_log && data.run_log.length > 0) {
            console.warn('[Agent] Run log:', data.run_log.map(l => `+${l.t}ms ${l.msg} ${l.file ? l.file : ''} ${l.line ? 'L' + l.line : ''} ${l.bugType ? l.bugType : ''}`).join('\n'));
          }
          if (done) {
            console.warn('[Agent] Run complete:', data.ci_status, 'fixes:', data.fixes?.length, data);
            return true;
          }
          console.warn('[Agent] Poll', pollCount, 'ci_status:', data.ci_status || 'pending', 'log entries:', data.run_log?.length || 0);
        } catch (e) {
          console.warn('[Agent] Poll error:', e);
        }
        return Date.now() - startTime > TIMEOUT_MS;
      };

      while (!(await poll())) {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (Date.now() - startTime > TIMEOUT_MS) {
        setError('Timed out waiting for agent results. Please check backend logs.');
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
