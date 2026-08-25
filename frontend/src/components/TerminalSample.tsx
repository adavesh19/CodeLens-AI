interface TerminalSampleProps {
  onClose?: () => void;
  onUseSample?: () => void;
}

export function TerminalSample({ onClose, onUseSample }: TerminalSampleProps) {
  return (
    <div style={{
      background: '#0a0a0c',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
      fontFamily: 'JetBrains Mono, monospace',
      margin: '12px 0',
      textAlign: 'left',
    }}>
      {/* Terminal Titlebar */}
      <div style={{
        background: '#16161a',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>bash — 80x24</div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>
            ✕
          </button>
        )}
      </div>

      {/* Terminal Content */}
      <div style={{ padding: '16px', fontSize: 11, lineHeight: 1.7, color: '#e0e0e0', whiteSpace: 'pre-wrap' }}>
        <span style={{ color: '#4af626' }}>user@dev-laptop</span>:<span style={{ color: '#22d3ee' }}>~/codelens-ai/demo-project</span>$ pytest tests/<br />
        <span style={{ color: '#888' }}>============================= test session starts ==============================</span><br />
        collected 20 items<br /><br />
        tests/test_api.py::TestLoginEndpoint::test_login_valid_credentials <span style={{ color: '#4af626' }}>PASSED</span> [  5%]<br />
        tests/test_api.py::TestProtectedEndpoints::test_profile_with_valid_token <span style={{ color: '#ff5f56' }}>FAILED</span> [ 10%]<br /><br />
        <span style={{ color: '#ff5f56', fontWeight: 700 }}>=================================== FAILURES ===================================</span><br />
        <span style={{ color: '#ff5f56', fontWeight: 700 }}>___________________ TestProtectedEndpoints.test_profile_with_valid_token ___________________</span><br />
        Traceback (most recent call last):<br />
        &nbsp;&nbsp;File "<span style={{ color: '#f5c842' }}>demo-project/auth.py</span>", line 52, in verify_token<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#ff5f56' }}>raise HTTPException(status_code=401, detail="Token expired")</span><br />
        <span style={{ color: '#ff5f56', fontWeight: 700 }}>HTTPException: 401 Unauthorized</span><br />
        <span style={{ color: '#ff5f56' }}>JWT validation failed</span><br />
        auth.py:52<br />
        <span style={{ color: '#888' }}>=========================== 8 failed, 12 passed in 0.42s ===========================</span>
      </div>

      {onUseSample && (
        <div style={{ padding: '10px 16px', background: '#111115', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-yellow btn-sm" onClick={onUseSample}>
            Use This Terminal Sample →
          </button>
        </div>
      )}
    </div>
  );
}
