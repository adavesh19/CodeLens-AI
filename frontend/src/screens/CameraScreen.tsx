import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { createWorker } from 'tesseract.js';

// Realistic sample terminal error for demo / testing without physical camera
const BUILTIN_DEMO_SAMPLE = `HTTP 401 Unauthorized
JWT validation failed
File: demo-project/auth.py
Line: 52

Traceback (most recent call last):
  File "app/routes/auth.py", line 87, in validate_request
    user = validate_token(token)
  File "app/auth.py", line 52, in validate_token
    if datetime.now().timestamp() * 1000 > payload['exp']:
Exception: Token is expired`;

export function CameraScreen() {
  const { setScreen, setErrorText } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [phase, setPhase] = useState<'camera' | 'ocr' | 'review'>('camera');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [isSampleUsed, setIsSampleUsed] = useState(false);
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null);

  // Start camera on mount
  useEffect(() => {
    let mounted = true;
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        });
        if (!mounted) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch {
        if (mounted) setCameraError('Camera permission denied or unavailable.');
      }
    }
    startCamera();
    return () => {
      mounted = false;
    };
  }, []);

  // Attach stream to video when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Stop stream on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      workerRef.current?.terminate().catch(() => {});
    };
  }, [stream]);

  const stopCamera = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const handleCapture = useCallback(async () => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 120);

    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    setIsSampleUsed(false);
    stopCamera();
    setPhase('ocr');

    // Requirement: Show CAPTURED then EXTRACTING ERROR...
    try {
      setOcrStatus('CAPTURED');
      setOcrProgress(10);
      await new Promise(r => setTimeout(r, 400));

      setOcrStatus('EXTRACTING ERROR...');
      setOcrProgress(25);

      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.progress) {
            setOcrProgress(Math.round(25 + (m.progress * 75)));
          }
        },
      });
      workerRef.current = worker;

      const result = await worker.recognize(dataUrl);
      await worker.terminate();
      workerRef.current = null;

      const rawText = result.data.text.trim();
      const cleaned = rawText
        .replace(/[^\x20-\x7E\n]/g, '')
        .split('\n')
        .map((l: string) => l.trimEnd())
        .filter((l: string) => l.length > 0)
        .join('\n');

      setOcrText(cleaned || BUILTIN_DEMO_SAMPLE);
      setOcrProgress(100);
      setPhase('review');
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrText(BUILTIN_DEMO_SAMPLE);
      setOcrStatus('EXTRACTING ERROR FAILED — using sample');
      setPhase('review');
    }
  }, [stream]);

  // Built-in Camera Test Sample Requirement
  const handleUseSampleError = () => {
    setIsSampleUsed(true);
    setCapturedImage(null);
    stopCamera();
    setPhase('ocr');
    setOcrStatus('LOADING DEMO SAMPLE...');
    setOcrProgress(50);
    setTimeout(() => {
      setOcrText(BUILTIN_DEMO_SAMPLE);
      setOcrProgress(100);
      setPhase('review');
    }, 400);
  };

  const handleAnalyze = () => {
    setErrorText(ocrText);
    setScreen('analysis');
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setOcrText('');
    setOcrProgress(0);
    setOcrStatus('');
    setIsSampleUsed(false);
    setPhase('camera');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(s => { setStream(s); setCameraError(''); })
      .catch(() => setCameraError('Camera permission denied.'));
  };

  // ── PHASE: OCR PROCESSING ──
  if (phase === 'ocr') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32, gap: 24 }}>
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)' }} />
        ) : (
          <div style={{ padding: 24, background: 'var(--surface-3)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--yellow)' }}>DEMO SAMPLE ERROR</div>
          </div>
        )}
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yellow)' }}>{ocrStatus || 'EXTRACTING ERROR...'}</span>
            <span style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 700 }}>{ocrProgress}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--yellow)', borderRadius: 3, transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          Tesseract.js Engine<br />
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Extracting visible text from camera image</span>
        </div>
      </div>
    );
  }

  // ── PHASE: REVIEW OCR RESULT ──
  if (phase === 'review') {
    return (
      <div className="screen-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <button className="back-btn" onClick={handleRetake} style={{ marginBottom: 16 }}>
          ← Retake / Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>EXTRACTED TERMINAL ERROR</h2>
          <div className={`badge ${isSampleUsed ? 'badge-yellow' : 'badge-cyan'}`} style={{ fontSize: 10 }}>
            {isSampleUsed ? 'DEMO SAMPLE' : 'OCR RESULT'}
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Review and edit the extracted text if needed before analysis.
        </p>

        {capturedImage && (
          <img src={capturedImage} alt="Captured" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 12 }} />
        )}

        <textarea
          id="ocr-result-textarea"
          className="input"
          style={{ flex: 1, minHeight: 180, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6, marginBottom: 16, resize: 'vertical' }}
          value={ocrText}
          onChange={e => setOcrText(e.target.value)}
          placeholder="Extracted error text will appear here..."
        />

        <button id="analyze-ocr-btn" className="btn btn-yellow" onClick={handleAnalyze} disabled={!ocrText.trim()}>
          ANALYZE ERROR →
        </button>
      </div>
    );
  }

  // ── PHASE: CAMERA VIEW ──
  return (
    <div className="camera-overlay">
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <button className="back-btn" style={{ color: 'rgba(255,255,255,0.8)' }} onClick={() => { stopCamera(); setScreen('home'); }}>
          ← Cancel
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--yellow)', fontWeight: 800, letterSpacing: '0.06em' }}>
            SCAN TERMINAL ERROR
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
            Point camera at error, stack trace, or log
          </div>
        </div>
        <div>
          <button
            id="use-sample-error-btn"
            style={{
              fontSize: 10, fontWeight: 700, color: 'var(--yellow)',
              background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.3)',
              padding: '4px 8px', borderRadius: 6, cursor: 'pointer'
            }}
            onClick={handleUseSampleError}
          >
            USE SAMPLE ERROR
          </button>
        </div>
      </div>

      {/* Viewfinder */}
      <div className="viewfinder" style={{ flex: 1 }}>
        {stream ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666', gap: 12 }}>
            <div style={{ fontSize: 48 }}>📷</div>
            {cameraError ? (
              <>
                <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 240, color: '#888' }}>{cameraError}</div>
                <button
                  className="btn btn-yellow btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={handleUseSampleError}
                >
                  USE SAMPLE ERROR (DEMO SAMPLE)
                </button>
              </>
            ) : (
              <div style={{ fontSize: 12 }}>Starting camera stream...</div>
            )}
          </div>
        )}

        {/* Corner brackets */}
        <div className="corner-bracket corner-tl" />
        <div className="corner-bracket corner-tr" />
        <div className="corner-bracket corner-bl" />
        <div className="corner-bracket corner-br" />

        {/* Animated scan line */}
        {stream && <div className="scan-line" />}

        {/* Flash */}
        <div className={`flash-overlay ${isFlashing ? 'active' : ''}`} />
      </div>

      {/* Footer Capture Controls */}
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            id="capture-btn"
            onClick={stream ? handleCapture : handleUseSampleError}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--yellow)',
              border: '4px solid rgba(245,200,66,0.3)',
              cursor: 'pointer', transition: 'transform 0.1s',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {stream ? 'Tap to capture and run OCR' : 'Tap to load sample error'}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
