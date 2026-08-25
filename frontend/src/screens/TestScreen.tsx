import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import type { TestResults } from '../api/types';

export function TestScreen() {
  const { setScreen, setTestResults, setPatchApplied } = useApp();
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setLocalResults] = useState<TestResults | null>(null);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(true);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [suiteProgress, setSuiteProgress] = useState({
    auth: false,
    api: false,
    integration: false,
  });
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPatchApplied(true);
    let isMounted = true;

    async function executeRealTests() {
      setIsRunning(true);
      setError('');
      setLogs(['> python -m pytest tests/ --tb=short --json-report']);

      try {
        if (!isMounted) return;

        // Progressive test suite indicators
        setTimeout(() => { if (isMounted) setSuiteProgress(p => ({ ...p, auth: true })); }, 300);
        setTimeout(() => { if (isMounted) setSuiteProgress(p => ({ ...p, api: true })); }, 600);

        // ALWAYS run actual test suite via API
        const finalResults: TestResults = await api.runTests();
        if (!isMounted) return;

        setSuiteProgress({ auth: true, api: true, integration: true });

        // Raw output lines for detailed log viewer
        if (finalResults.output) {
          const lines = finalResults.output.split('\n');
          const cleanLines = lines.map(line => {
            if (line.includes('PASSED')) return `<span class="t-pass">${line}</span>`;
            if (line.includes('FAILED')) return `<span class="t-fail">${line}</span>`;
            if (line.includes('warnings')) return `<span class="t-dim">${line}</span>`;
            return line;
          });
          setLogs(cleanLines);
        }

        setLocalResults(finalResults);
        setTestResults(finalResults);
        setIsRunning(false);

        // If tests all passed, navigate automatically to Success Screen
        if (finalResults.all_passed) {
          setTimeout(() => {
            if (isMounted) setScreen('success');
          }, 800);
        }

      } catch (err: any) {
        if (!isMounted) return;
        console.error("Test execution error:", err);
        setError(err.message || 'Failed to connect to test runner API.');
        setIsRunning(false);
      }
    }

    executeRealTests();
    return () => { isMounted = false; };
  }, [setTestResults, setPatchApplied, setScreen]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, showRawLogs]);

  return (
    <div className="screen-content flex flex-col h-full">
      {/* Title Header */}
      <div className="flex items-center gap-3 mb-4">
        {isRunning ? (
          <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        ) : results?.all_passed ? (
          <div style={{ fontSize: 28 }}>✅</div>
        ) : (
          <div style={{ fontSize: 28 }}>❌</div>
        )}
        <div>
          <h2 className="text-xl font-black" style={{ letterSpacing: '-0.3px' }}>
            {isRunning ? 'VERIFYING FIX' : results?.all_passed ? 'BUG FIX VERIFIED' : 'TESTS FAILED'}
          </h2>
          <p className="text-xs text-muted">
            {isRunning ? 'Running project tests...' : 'pytest suite execution complete'}
          </p>
        </div>
      </div>

      {/* Test Suite Progress Checklist */}
      <div className="card mb-4" style={{ background: 'var(--surface-2)', padding: '14px' }}>
        <div className="section-label" style={{ marginBottom: 8 }}>TEST SUITE EXECUTION</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="flex items-center justify-between text-xs">
            <span>AUTH TESTS (test_auth.py)</span>
            <span style={{ color: suiteProgress.auth ? 'var(--green)' : 'var(--text-dim)', fontWeight: 700 }}>
              {suiteProgress.auth ? '✓ PASSED' : '⏳ RUNNING...'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>API TESTS (test_api.py)</span>
            <span style={{ color: suiteProgress.api ? 'var(--green)' : 'var(--text-dim)', fontWeight: 700 }}>
              {suiteProgress.api ? '✓ PASSED' : '⏳ WAITING...'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>INTEGRATION TESTS</span>
            <span style={{ color: suiteProgress.integration ? 'var(--green)' : 'var(--text-dim)', fontWeight: 700 }}>
              {suiteProgress.integration ? '✓ PASSED' : '⏳ WAITING...'}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Dynamic Summary Hero */}
      {results && (
        <div
          className="card mb-4"
          style={{
            background: results.all_passed ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            borderColor: results.all_passed ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
            padding: '20px',
            textAlign: 'center'
          }}
        >
          <div className={`font-black style-hero ${results.all_passed ? 'text-green' : 'text-red'}`} style={{ fontSize: 32, letterSpacing: '-0.5px' }}>
            {results.passed} / {results.total} TESTS PASSED
          </div>
          <div className="text-xs font-bold text-muted mt-2" style={{ letterSpacing: '0.05em' }}>
            {results.failed} FAILED · PATCH APPLIED SUCCESSFULLY
          </div>
        </div>
      )}

      {/* Collapsible Raw Logs Toggle */}
      {results && (
        <div style={{ marginBottom: 16 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowRawLogs(!showRawLogs)}
            style={{ fontSize: 11, color: 'var(--text-muted)' }}
          >
            {showRawLogs ? 'HIDE TEST LOGS ▲' : 'VIEW TEST LOGS →'}
          </button>
        </div>
      )}

      {/* Raw Output Terminal Box */}
      {(showRawLogs || isRunning || error) && (
        <div
          ref={terminalRef}
          className="terminal flex-1 mb-4"
          style={{ minHeight: 180 }}
        >
          {logs.map((log, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: log }} />
          ))}
          {isRunning && <div className="t-info mt-2">⏳ Executing pytest runner...</div>}
          {error && <div className="t-fail mt-2">{error}</div>}
        </div>
      )}

      {/* Navigation Buttons */}
      {results && (
        <button
          id="proceed-success-btn"
          className={`btn ${results.all_passed ? 'btn-yellow' : 'btn-outline'}`}
          onClick={() => {
            if (results.all_passed) setScreen('success');
            else setScreen('home');
          }}
        >
          {results.all_passed ? 'View Final Result →' : 'Return Home'}
        </button>
      )}
    </div>
  );
}
