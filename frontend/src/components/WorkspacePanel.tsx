import { useApp } from '../context/AppContext';

export function WorkspacePanel() {
  const { patchApplied, testResults, backendConnected, aiProvider, aiAvailable, aiModel, demoMode } = useApp();

  let badgeText = 'DEMO ENGINE • OFFLINE AI';
  let bg = 'rgba(245,200,66,0.12)';
  let color = 'var(--yellow)';
  let border = '1px solid rgba(245,200,66,0.25)';
  let description = 'Deterministic engine active for demo reliability';

  if (!backendConnected || aiProvider === 'offline') {
    badgeText = 'BACKEND OFFLINE';
    bg = 'rgba(239,68,68,0.12)';
    color = 'var(--red)';
    border = '1px solid rgba(239,68,68,0.3)';
    description = 'Cannot connect to backend API';
  } else if (aiProvider === 'groq' && aiAvailable) {
    badgeText = 'CLOUD AI • ONLINE';
    bg = 'rgba(34,211,238,0.12)';
    color = 'var(--cyan)';
    border = '1px solid rgba(34,211,238,0.3)';
    description = `Model: ${aiModel} (Groq Cloud AI)`;
  } else if (aiProvider === 'ollama' && aiAvailable) {
    badgeText = 'LOCAL AI • ONLINE';
    bg = 'rgba(34,211,238,0.12)';
    color = 'var(--cyan)';
    border = '1px solid rgba(34,211,238,0.3)';
    description = `Model: ${aiModel} (Local Ollama)`;
  }

  return (
    <div className="workspace-panel">
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Office Kit Integration</div>
          <span className="badge badge-cyan" style={{ fontSize: 9 }}>BRIDGE READY</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>
          Designed for Office Kit integration
        </div>
      </div>

      {/* Connection Hierarchy Architecture */}
      <div>
        <div className="section-label">Architecture State</div>
        
        <div className="bridge-item" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="bridge-dot active" />
          <div style={{ flex: 1 }}>
            <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>PHONE</div>
            <div className="text-xs text-muted">React Mobile Shell · Camera / Voice</div>
          </div>
          <span className="badge badge-green" style={{ fontSize: 9 }}>ONLINE</span>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, margin: '2px 0' }}>↓</div>

        <div className="bridge-item" style={{ background: 'var(--surface-2)', border: '1px solid rgba(245,200,66,0.2)' }}>
          <div className="bridge-dot active" style={{ background: 'var(--yellow)' }} />
          <div style={{ flex: 1 }}>
            <div className="text-xs font-bold" style={{ color: 'var(--yellow)' }}>OFFICE KIT</div>
            <div className="text-xs text-muted">OfficeKitBridge Abstraction Layer</div>
          </div>
          <span className="badge badge-yellow" style={{ fontSize: 9 }}>BRIDGE READY</span>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, margin: '2px 0' }}>↓</div>

        <div className="bridge-item" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className={`bridge-dot ${backendConnected ? 'active' : 'offline'}`} />
          <div style={{ flex: 1 }}>
            <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>LAPTOP PROJECT</div>
            <div className="text-xs text-muted">demo-project (/auth.py)</div>
          </div>
          <span className={`badge ${backendConnected ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 9 }}>
            {backendConnected ? 'SYNCED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* AI Engine Status Component */}
      <div>
        <div className="section-label">AI Engine Status</div>
        <div className="card" style={{ padding: '12px', background: 'var(--surface-2)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="text-xs font-semibold">Engine</span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              background: bg,
              color: color,
              border: border
            }}>
              {badgeText}
            </span>
          </div>
          <div className="text-xs text-muted">
            {description}
          </div>
        </div>
      </div>

      {/* Current Analysis & Test Status */}
      <div>
        <div className="section-label">Project Verification Status</div>
        <div className="card" style={{ padding: '12px' }}>
          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>
            File: <span className="mono text-yellow">demo-project/auth.py</span>
          </div>
          <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
            Mode: <span style={{ color: demoMode ? 'var(--cyan)' : 'var(--green)' }}>
              {demoMode ? 'JUDGE DEMO' : 'LIVE SESSION'}
            </span>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Test Suite Results:</div>
            {testResults ? (
              <div className="flex items-center justify-between">
                <span className={testResults.all_passed ? 'text-green font-bold text-sm' : 'text-red font-bold text-sm'}>
                  {testResults.all_passed ? '✅ ALL PASSED' : '❌ TESTS FAILED'}
                </span>
                <span className="text-xs font-mono text-muted">{testResults.passed}/{testResults.total}</span>
              </div>
            ) : patchApplied ? (
              <div className="text-xs text-yellow">Running tests...</div>
            ) : (
              <div className="text-xs text-red font-semibold">❌ 8 Failing Tests (Intentionally Broken)</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Badge */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{
          padding: '12px',
          background: 'linear-gradient(135deg, rgba(245,200,66,0.1), transparent)',
          border: '1px solid rgba(245,200,66,0.2)',
          borderRadius: 'var(--radius)',
          textAlign: 'center'
        }}>
          <div className="text-yellow font-black" style={{ fontSize: 13, letterSpacing: '0.08em' }}>CODELENS AI</div>
          <div className="text-xs text-dim" style={{ marginTop: 2 }}>SEE • UNDERSTAND • FIX • VERIFY</div>
        </div>
      </div>
    </div>
  );
}
