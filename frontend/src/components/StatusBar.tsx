import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export function StatusBar({ aiAvailable: _propsAiAvailable }: { aiAvailable?: boolean }) {
  const { backendConnected, aiProvider, aiAvailable, aiModel } = useApp();
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  let badgeText = 'DEMO ENGINE • OFFLINE AI';
  let bg = 'rgba(245,200,66,0.12)';
  let color = 'var(--yellow)';
  let border = '1px solid rgba(245,200,66,0.25)';

  if (!backendConnected || aiProvider === 'offline') {
    badgeText = 'BACKEND OFFLINE';
    bg = 'rgba(239,68,68,0.12)';
    color = 'var(--red)';
    border = '1px solid rgba(239,68,68,0.3)';
  } else if (aiProvider === 'groq' && aiAvailable) {
    badgeText = 'CLOUD AI • ONLINE';
    bg = 'rgba(34,211,238,0.12)';
    color = 'var(--cyan)';
    border = '1px solid rgba(34,211,238,0.3)';
  } else if (aiProvider === 'ollama' && aiAvailable) {
    badgeText = 'LOCAL AI • ONLINE';
    bg = 'rgba(34,211,238,0.12)';
    color = 'var(--cyan)';
    border = '1px solid rgba(34,211,238,0.3)';
  }

  return (
    <div className="status-bar">
      <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{time || '09:41'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          title={backendConnected ? `Model: ${aiModel}` : 'Backend unreachable'}
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            background: bg,
            color: color,
            border: border,
          }}
        >
          {badgeText}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>5G</span>
      </div>
    </div>
  );
}
