import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import type { AnalysisResult } from '../api/types';

export function AnalysisScreen() {
  const { setScreen, errorText, setAnalysisResult, analysisResult, backendConnected, aiProvider, aiModel, selectedFile, setSelectedFile, checkHealth } = useApp();
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [projectFiles, setProjectFiles] = useState<string[]>([]);

  useEffect(() => {
    api.getProject()
      .then(p => {
        if (p.files && p.files.length > 0) {
          setProjectFiles(p.files);
          if (!selectedFile || selectedFile === 'unknown') {
            const first = p.files.find(f => !f.includes('test')) || p.files[0];
            setSelectedFile(first);
          }
        } else {
          setProjectFiles(['auth.py', 'main.py', 'tests/test_auth.py', 'tests/test_api.py']);
        }
      })
      .catch(() => {
        setProjectFiles(['auth.py', 'main.py', 'tests/test_auth.py', 'tests/test_api.py']);
      });
  }, []);

  useEffect(() => {
    if (analysisResult) return;

    let isMounted = true;

    async function doAnalyze() {
      if (isMounted) setLoadingStep(1);
      await new Promise(r => setTimeout(r, 300));

      if (isMounted) setLoadingStep(2);
      await new Promise(r => setTimeout(r, 300));

      if (isMounted) setLoadingStep(3);
      await new Promise(r => setTimeout(r, 400));

      if (isMounted) setLoadingStep(4);

      try {
        const res: AnalysisResult = await api.analyze({
          error_text: errorText || 'HTTP 401 Unauthorized JWT validation failed auth.py:52',
          selected_file: selectedFile
        });
        
        if (!isMounted) return;

        if (!res.affected_file || res.affected_file.toLowerCase().includes('unknown')) {
          if (selectedFile && !selectedFile.toLowerCase().includes('unknown')) {
            res.affected_file = selectedFile;
          } else if (projectFiles.length > 0) {
            res.affected_file = projectFiles[0];
            setSelectedFile(projectFiles[0]);
          }
        } else {
          setSelectedFile(res.affected_file);
        }

        setAnalysisResult(res);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Analysis error:", err);
        const msg = err.message || 'ANALYSIS ERROR';
        setError(msg);
      }
    }

    doAnalyze();
    return () => { isMounted = false; };
  }, [errorText, analysisResult, setAnalysisResult, selectedFile, setSelectedFile]);

  // Context-aware Error Screen (STEP 17)
  if (error) {
    let title = "ANALYSIS FAILED";
    let desc = error;

    if (error.includes("AUTHENTICATION ERROR")) {
      title = "AI PROVIDER AUTHENTICATION ERROR";
      desc = "Server GROQ_API_KEY is invalid or missing.";
    } else if (error.includes("RATE LIMIT")) {
      title = "AI RATE LIMIT REACHED";
      desc = "Cloud AI rate limit reached. Please wait a moment and try again.";
    } else if (error.includes("TIMED OUT")) {
      title = "AI REQUEST TIMED OUT";
      desc = "AI inference request took longer than expected. Click Retry to try again.";
    } else if (error.includes("BACKEND OFFLINE")) {
      title = "BACKEND OFFLINE";
      desc = "Could not connect to CodeLens AI backend API. Please ensure the backend is running.";
    } else if (error.includes("TEMPORARILY UNAVAILABLE")) {
      title = "BACKEND TEMPORARILY UNAVAILABLE";
      desc = "The backend service is starting up or temporarily busy.";
    } else if (error.includes("COULD NOT BE PARSED")) {
      title = "AI RESPONSE COULD NOT BE PARSED";
      desc = "The AI model output could not be formatted into structured JSON.";
    }

    return (
      <div className="screen-content flex flex-col items-center justify-center h-full text-center">
        <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
        <h3 className="text-lg font-black text-red" style={{ marginBottom: 8, letterSpacing: '-0.3px' }}>{title}</h3>
        <p className="text-xs text-muted text-center" style={{ marginBottom: 24, maxWidth: 300, lineHeight: 1.6 }}>{desc}</p>
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setScreen('home')}>
            Home
          </button>
          <button className="btn btn-yellow" style={{ flex: 1.5 }} onClick={() => { setError(''); setAnalysisResult(null); checkHealth(); }}>
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  // Loading Screen with Render Cold Start Notice (STEP 18)
  if (!analysisResult) {
    const isConnecting = !backendConnected;
    return (
      <div className="screen-content flex flex-col items-center justify-center h-full">
        <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
            <div className="text-lg font-black" style={{ color: 'var(--yellow)', letterSpacing: '0.04em' }}>
              {isConnecting
                ? 'CONNECTING TO CODELENS ENGINE...'
                : aiProvider === 'groq'
                ? 'CLOUD AI ANALYZING...'
                : aiProvider === 'ollama'
                ? 'LOCAL AI ANALYZING...'
                : 'DEMO ENGINE ANALYZING...'}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {isConnecting
                ? 'Waking backend server instance...'
                : aiProvider === 'groq'
                ? `Running ${aiModel} cloud inference via Groq`
                : aiProvider === 'ollama'
                ? `Running ${aiModel} local inference via Ollama`
                : 'Evaluating error context against demo rules'}
            </div>
          </div>

          <div className="loading-step">
            <div className="step-icon">{loadingStep > 0 ? (loadingStep > 1 ? '✅' : <div className="spinner" />) : '⏳'}</div>
            <div className={loadingStep >= 1 ? 'text-text font-medium text-sm' : 'text-muted text-sm'}>Parsing error stack trace...</div>
          </div>
          <div className="loading-step">
            <div className="step-icon">{loadingStep > 1 ? (loadingStep > 2 ? '✅' : <div className="spinner" />) : '⏳'}</div>
            <div className={loadingStep >= 2 ? 'text-text font-medium text-sm' : 'text-muted text-sm'}>Retrieving codebase context...</div>
          </div>
          <div className="loading-step">
            <div className="step-icon">{loadingStep > 2 ? (loadingStep > 3 ? '✅' : <div className="spinner" />) : '⏳'}</div>
            <div className={loadingStep >= 3 ? 'text-text font-medium text-sm' : 'text-muted text-sm'}>Identifying root cause...</div>
          </div>
          <div className="loading-step">
            <div className="step-icon">{loadingStep > 3 ? (loadingStep > 4 ? '✅' : <div className="spinner" />) : '⏳'}</div>
            <div className={loadingStep >= 4 ? 'text-text font-medium text-sm' : 'text-muted text-sm'}>Preparing suggested fix...</div>
          </div>
        </div>
      </div>
    );
  }

  const isDemoFallback = analysisResult.provider === 'demo' || aiProvider === 'demo';
  const isGroqCloud = analysisResult.provider === 'groq' || aiProvider === 'groq';
  const currentTargetFile = (analysisResult.affected_file && !analysisResult.affected_file.toLowerCase().includes('unknown'))
    ? analysisResult.affected_file
    : selectedFile;

  let badgeLabel = `LOCAL AI • ONLINE (${analysisResult.model || aiModel})`;
  let badgeStyle = {
    background: 'rgba(34,211,238,0.12)',
    color: 'var(--cyan)',
    border: '1px solid rgba(34,211,238,0.3)'
  };

  if (isGroqCloud) {
    badgeLabel = `CLOUD AI • ONLINE (${analysisResult.model || aiModel})`;
  } else if (isDemoFallback) {
    badgeLabel = 'DEMO ENGINE • OFFLINE AI';
    badgeStyle = {
      background: 'rgba(245,200,66,0.12)',
      color: 'var(--yellow)',
      border: '1px solid rgba(245,200,66,0.25)'
    };
  }

  return (
    <div className="screen-content">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <button className="back-btn" onClick={() => { setAnalysisResult(null); setScreen('home'); }}>
          ← Cancel
        </button>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 4,
          ...badgeStyle
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* Root Cause Card */}
      <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(245,200,66,0.3)' }}>
        <div className="section-label" style={{ color: 'var(--yellow)', marginBottom: 6 }}>ROOT CAUSE IDENTIFIED</div>
        <h3 className="text-base font-black" style={{ marginBottom: 14, lineHeight: 1.4 }}>{analysisResult.root_cause}</h3>
        
        {/* Metadata Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14, background: 'var(--surface-3)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
          <div>
            <div className="section-label" style={{ fontSize: 8, marginBottom: 2 }}>AFFECTED FILE</div>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--yellow)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentTargetFile}
            </div>
          </div>
          <div>
            <div className="section-label" style={{ fontSize: 8, marginBottom: 2 }}>LINE</div>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text)' }}>
              {analysisResult.line || 52}
            </div>
          </div>
          <div>
            <div className="section-label" style={{ fontSize: 8, marginBottom: 2 }}>CONFIDENCE</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase' }}>
              {analysisResult.confidence || 'HIGH'}
            </div>
          </div>
        </div>

        {/* WHY THIS HAPPENS */}
        <div className="section-label" style={{ marginBottom: 4 }}>WHY THIS HAPPENS</div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
          {analysisResult.explanation}
        </div>
      </div>

      {/* PROJECT CONTEXT */}
      <div className="section-label" style={{ marginTop: 16 }}>PROJECT CONTEXT</div>
      <div className="card" style={{ padding: '12px', marginBottom: 16 }}>
        <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
          Retrieved codebase context files:
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {projectFiles.map((file) => {
            const isTarget = currentTargetFile.includes(file) || file.includes(currentTargetFile);
            return (
              <button
                key={file}
                onClick={() => {
                  setSelectedFile(file);
                  setAnalysisResult({ ...analysisResult, affected_file: file });
                }}
                style={{
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: isTarget ? 'var(--yellow-dim)' : 'var(--surface-3)',
                  color: isTarget ? 'var(--yellow)' : 'var(--text-muted)',
                  border: isTarget ? '1px solid rgba(245,200,66,0.4)' : '1px solid var(--border)',
                  fontWeight: isTarget ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {isTarget ? '👉 ' : ''}{file}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3" style={{ marginBottom: 12 }}>
        <button id="reject-analysis-btn" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setAnalysisResult(null); setScreen('home'); }}>
          Reject
        </button>
        <button id="review-patch-btn" className="btn btn-yellow" style={{ flex: 2 }} onClick={() => setScreen('patch')}>
          Review & Apply Patch →
        </button>
      </div>
    </div>
  );
}
