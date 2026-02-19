import React from 'react';

export default function LoadingOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-overlay-content">
        <div className="loading-orb-wrap">
          <div className="loading-spinner" />
          <div className="loading-orb" />
        </div>
        <h3>Agent is running</h3>
        <p>Cloning repo, running tests, and applying fixes…</p>
        <div className="loading-steps">
          <span className="step">1. Clone</span>
          <span className="step">2. Run tests</span>
          <span className="step">3. Analyze & fix</span>
        </div>
      </div>
    </div>
  );
}
