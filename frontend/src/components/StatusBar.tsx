import { useState, useEffect } from 'react';

export function StatusBar({ aiAvailable }: { aiAvailable: boolean }) {
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

  return (
    <div className="status-bar">
      <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{time || '09:41'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 4,
          background: aiAvailable ? 'rgba(34,211,238,0.12)' : 'rgba(245,200,66,0.12)',
          color: aiAvailable ? 'var(--cyan)' : 'var(--yellow)',
          border: `1px solid ${aiAvailable ? 'rgba(34,211,238,0.3)' : 'rgba(245,200,66,0.25)'}`
        }}>
          {aiAvailable ? 'LOCAL AI • ONLINE' : 'DEMO ENGINE • OFFLINE AI'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>5G</span>
      </div>
    </div>
  );
}
