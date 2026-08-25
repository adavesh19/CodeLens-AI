import { useState } from 'react';
import { useApp } from '../context/AppContext';

const SAMPLE_ERROR = `HTTP 401 Unauthorized
JWT validation failed: Token appears expired
File: auth.py, line 52

Traceback (most recent call last):
  File "app/routes/auth.py", line 87, in validate_request
    user = validate_token(token)
  File "app/auth.py", line 52, in validate_token
    if datetime.now().timestamp() * 1000 > payload['exp']:
Exception: Token is expired`;

export function InputScreen() {
  const { setScreen, setErrorText } = useApp();
  const [text, setText] = useState('');

  const handleAnalyze = () => {
    if (!text.trim()) return;
    setErrorText(text.trim());
    setScreen('analysis');
  };

  const handleLoadSample = () => {
    setText(SAMPLE_ERROR);
  };

  return (
    <div className="screen-content flex flex-col h-full">
      <button className="back-btn" onClick={() => setScreen('home')} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 className="text-xl font-bold">PASTE ERROR TEXT</h2>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--yellow)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          onClick={handleLoadSample}
        >
          Load Sample
        </button>
      </div>
      <p className="text-muted text-xs mb-4">Paste stack trace or terminal output manually.</p>

      <textarea
        className="input"
        style={{ flex: 1, minHeight: 220, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}
        placeholder={`Paste your error stack trace here...\n\nExample:\nHTTP 401 Unauthorized\nauth.py:52`}
        value={text}
        onChange={e => setText(e.target.value)}
      />

      <button
        className="btn btn-yellow mt-auto"
        onClick={handleAnalyze}
        disabled={!text.trim()}
      >
        Analyze Error Text →
      </button>
    </div>
  );
}
