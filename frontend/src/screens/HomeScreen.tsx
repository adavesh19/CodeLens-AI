import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { useState, useEffect } from 'react';
import { TerminalSample } from '../components/TerminalSample';

const DEMO_ERROR = `HTTP 401 Unauthorized
JWT validation failed
File: demo-project/auth.py
Line: 52

Traceback (most recent call last):
  File "app/routes/auth.py", line 87, in validate_request
    user = validate_token(token)
  File "app/auth.py", line 52, in validate_token
    if datetime.now().timestamp() * 1000 > payload['exp']:
Exception: Token is expired`;

export function HomeScreen() {
  const { setScreen, setErrorText, setAiAvailable, setAiModel, demoMode, setDemoMode, resetSession, setSelectedFile, aiAvailable, aiModel } = useApp();
  const [health, setHealth] = useState<{ ai_available: boolean; model: string; fallback: boolean } | null>(null);
  const [, setHealthError] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [showTerminalSample, setShowTerminalSample] = useState(false);

  useEffect(() => {
    api.health()
      .then(h => {
        setHealth(h);
        setAiAvailable(h.ai_available);
        setAiModel(h.model);
      })
      .catch(() => setHealthError(true));
  }, [setAiAvailable, setAiModel]);

  const handleJudgeDemo = async () => {
    setLoadingDemo(true);
    setDemoError('');
    try {
      await api.loadDemo();
      setDemoMode(true);
      setErrorText(DEMO_ERROR);
      setSelectedFile('demo-project/auth.py');
    } catch (err: any) {
      setDemoMode(true);
      setErrorText(DEMO_ERROR);
      setSelectedFile('demo-project/auth.py');
      setDemoError('Backend unreachable — using built-in demo scenario.');
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      await api.loadDemo();
    } catch {
      // Ignore
    }
    resetSession();
  };

  const isLiveAI = health?.ai_available === true || aiAvailable === true;

  return (
    <div className="screen-content">

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(245,200,66,0.25), rgba(245,200,66,0.05))',
              border: '1px solid rgba(245,200,66,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>🔍</div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>CODELENS AI</h1>
              <p style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700, letterSpacing: '0.08em', marginTop: 2 }}>
                SEE • UNDERSTAND • FIX • VERIFY
              </p>
            </div>
          </div>
        </div>

        {/* AI Status Badge Requirement: LOCAL AI • ONLINE vs DEMO ENGINE • OFFLINE AI */}
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 8,
          background: isLiveAI ? 'rgba(34,211,238,0.08)' : 'rgba(245,200,66,0.08)',
          border: `1px solid ${isLiveAI ? 'rgba(34,211,238,0.25)' : 'rgba(245,200,66,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isLiveAI ? 'var(--cyan)' : 'var(--yellow)',
              animation: isLiveAI ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: isLiveAI ? 'var(--cyan)' : 'var(--yellow)' }}>
              {isLiveAI ? 'LOCAL AI • ONLINE' : 'DEMO ENGINE • OFFLINE AI'}
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
            {isLiveAI ? (health?.model || aiModel || 'codellama') : 'deterministic'}
          </span>
        </div>

        {/* Demo Mode vs Live Session Status Banner */}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className={`badge ${demoMode ? 'badge-cyan' : 'badge-green'}`} style={{ fontSize: 9 }}>
            {demoMode ? 'JUDGE DEMO • JWT AUTH BUG • REPEATABLE WORKFLOW' : 'LIVE SESSION'}
          </span>
          {demoMode && (
            <button
              onClick={handleResetDemo}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
            >
              RESET DEMO
            </button>
          )}
        </div>
      </div>

      {/* ── PRIMARY HERO ACTION: SCAN ERROR ── */}
      <div style={{ marginBottom: 20 }}>
        <button
          id="scan-error-hero-btn"
          onClick={() => setScreen('camera')}
          style={{
            width: '100%', padding: '24px 20px',
            background: 'linear-gradient(135deg, rgba(245,200,66,0.22), rgba(245,200,66,0.06))',
            border: '2px solid var(--yellow)',
            borderRadius: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 8px 24px rgba(245,200,66,0.15)',
            transition: 'all 0.2s',
            textAlign: 'left',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--yellow)', color: '#0a0a0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, flexShrink: 0, fontWeight: 900,
          }}>📸</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--yellow)', letterSpacing: '0.04em' }}>
              SCAN ERROR
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Point phone camera at terminal or stack trace
            </div>
          </div>
          <span style={{ color: 'var(--yellow)', fontSize: 24, fontWeight: 900 }}>›</span>
        </button>
      </div>

      {/* ── SECONDARY ACTIONS ── */}
      <div className="section-label">Other Debug Inputs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <button id="voice-debug-btn" className="action-card" onClick={() => setScreen('voice')} style={{ padding: '14px' }}>
          <div className="action-icon" style={{ width: 38, height: 38, fontSize: 18, background: 'var(--cyan-dim)' }}>🎤</div>
          <div>
            <div className="font-semibold" style={{ fontSize: 13 }}>VOICE DEBUG</div>
            <div className="text-xs text-muted">Describe error</div>
          </div>
        </button>

        <button id="paste-error-btn" className="action-card" onClick={() => setScreen('input')} style={{ padding: '14px' }}>
          <div className="action-icon" style={{ width: 38, height: 38, fontSize: 18, background: 'var(--surface-3)' }}>📋</div>
          <div>
            <div className="font-semibold" style={{ fontSize: 13 }}>PASTE ERROR</div>
            <div className="text-xs text-muted">Type error text</div>
          </div>
        </button>
      </div>

      <div className="sep" />

      {/* ── DEMO / TESTING ACTION ── */}
      <div className="section-label">Judges Demo Workflow</div>
      {demoMode ? (
        <div
          id="judge-demo-ready-card"
          style={{
            width: '100%', padding: '16px', marginBottom: 12,
            background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(34,211,238,0.04))',
            border: '1px solid rgba(34,211,238,0.4)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontWeight: 900, fontSize: 13, color: 'var(--cyan)', letterSpacing: '0.04em' }}>
                JUDGE DEMO READY
              </span>
            </div>
            <span className="badge badge-cyan" style={{ fontSize: 9, fontWeight: 800 }}>READY TO SCAN</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
            <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>JWT AUTH BUG (auth.py:52)</span>
            <span style={{ color: 'var(--red)', fontWeight: 800 }}>8 FAILING TESTS</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              id="ready-scan-error-btn"
              onClick={() => setScreen('camera')}
              className="btn btn-yellow btn-sm"
              style={{ flex: 1, fontWeight: 800, fontSize: 12, padding: '8px' }}
            >
              📸 SCAN ERROR →
            </button>
            <button
              onClick={handleJudgeDemo}
              disabled={loadingDemo}
              className="btn btn-outline btn-sm"
              style={{ fontSize: 10, padding: '8px 10px', color: 'var(--text-muted)' }}
            >
              {loadingDemo ? 'PREPARING...' : 'RELOAD'}
            </button>
          </div>
        </div>
      ) : (
        <button
          id="judge-demo-btn"
          onClick={handleJudgeDemo}
          disabled={loadingDemo}
          style={{
            width: '100%', padding: '16px', marginBottom: 10,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 14, cursor: loadingDemo ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s',
            opacity: loadingDemo ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!loadingDemo) e.currentTarget.style.borderColor = 'var(--yellow)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <span style={{ fontSize: 18 }}>{loadingDemo ? '⏳' : '⚡'}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            {loadingDemo ? 'PREPARING DEMO...' : 'START JUDGE DEMO'}
          </span>
        </button>
      )}

      {/* Terminal Sample Asset Toggle for Testing */}
      <button
        className="btn btn-outline btn-sm"
        style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%', marginBottom: 12 }}
        onClick={() => setShowTerminalSample(!showTerminalSample)}
      >
        {showTerminalSample ? 'HIDE TERMINAL SAMPLE ▲' : '🖥️ VIEW TERMINAL SAMPLE'}
      </button>

      {showTerminalSample && (
        <TerminalSample
          onClose={() => setShowTerminalSample(false)}
          onUseSample={() => {
            setErrorText(DEMO_ERROR);
            setScreen('analysis');
          }}
        />
      )}

      {demoError && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12, padding: '6px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
          ⚠️ {demoError}
        </div>
      )}

      {/* Workflow pill */}
      <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 8 }}>
        <div className="text-xs text-dim" style={{ letterSpacing: '0.08em' }}>
          SEE • UNDERSTAND • FIX • VERIFY
        </div>
      </div>
    </div>
  );
}
