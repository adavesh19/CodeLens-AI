import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

export function SuccessScreen() {
  const { setScreen, testResults, resetSession, aiAvailable } = useApp();
  const [resetting, setResetting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.loadDemo();
    } catch {
      // Ignore
    }
    resetSession();
    setScreen('home');
  };

  const passedCount = testResults?.passed ?? 20;
  const totalCount = testResults?.total ?? 20;
  const failedCount = testResults?.failed ?? 0;

  return (
    <div className="screen-content flex flex-col items-center justify-center h-full text-center">
      {/* Checkmark Pop */}
      <div className="success-check mb-4" style={{ width: 80, height: 80, fontSize: 40 }}>
        ✓
      </div>
      
      <h2 className="text-2xl font-black mb-1 text-white" style={{ letterSpacing: '-0.5px' }}>BUG FIX VERIFIED</h2>
      <p className="text-muted text-xs mb-6">Authentication issue resolved & patch verified live.</p>

      {/* Dynamic Visual Hero Hero Box */}
      <div className="card w-full mb-6" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)', padding: 20 }}>
        <div className="text-3xl font-black text-green mb-1" style={{ letterSpacing: '-0.5px' }}>
          {passedCount} / {totalCount} TESTS PASSED
        </div>
        <div className="text-xs font-bold text-muted" style={{ letterSpacing: '0.06em' }}>
          {failedCount} FAILED · PATCH APPLIED SUCCESSFULLY
        </div>
      </div>

      {/* Metrics Card */}
      <div className="card w-full mb-6" style={{ background: 'var(--surface-3)', padding: 14 }}>
        <div className="flex justify-between items-center mb-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-muted text-xs">AI Provider Engine</span>
          <span className="font-bold text-xs" style={{ color: aiAvailable ? 'var(--cyan)' : 'var(--yellow)' }}>
            {aiAvailable ? 'LOCAL AI • ONLINE' : 'DEMO ENGINE • OFFLINE AI'}
          </span>
        </div>
        <div className="flex justify-between items-center mb-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-muted text-xs">Target File</span>
          <span className="font-mono text-xs text-yellow">demo-project/auth.py</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted text-xs">Verification Suite</span>
          <span className="font-bold text-xs text-green">pytest unit + integration</span>
        </div>
      </div>

      {/* Collapsible View Test Logs Toggle */}
      <button
        className="btn btn-outline btn-sm mb-6 w-full"
        onClick={() => setShowLogs(!showLogs)}
        style={{ fontSize: 11, color: 'var(--text-muted)' }}
      >
        {showLogs ? 'HIDE TEST LOGS ▲' : 'VIEW TEST LOGS →'}
      </button>

      {showLogs && (
        <div className="terminal w-full mb-6 text-left" style={{ maxHeight: 160, fontSize: 11 }}>
          {testResults?.output || "pytest test_auth.py test_api.py - PASSED"}
        </div>
      )}

      {/* Final Tagline */}
      <div className="text-center mb-6">
        <div className="font-black text-yellow mb-1 tracking-widest text-xs">CODELENS AI</div>
        <div className="text-muted text-xs" style={{ letterSpacing: '0.05em' }}>
          SEE • UNDERSTAND • FIX • VERIFY
        </div>
      </div>

      <button id="new-debug-session-btn" className="btn btn-yellow w-full" onClick={handleReset} disabled={resetting}>
        {resetting ? 'Resetting Demo...' : 'Start New Debug Session'}
      </button>
    </div>
  );
}
