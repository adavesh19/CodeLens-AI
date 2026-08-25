import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

export function PatchScreen() {
  const { setScreen, analysisResult, selectedFile, setSelectedFile } = useApp();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [targetFile, setTargetFile] = useState<string>('');

  useEffect(() => {
    api.getProject()
      .then(p => {
        if (p.files && p.files.length > 0) setProjectFiles(p.files);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!analysisResult) return;
    
    let resolved = analysisResult.affected_file || '';

    resolved = resolved.replace('demo-project/', '').replace('demo-project\\', '').trim();
    if (resolved.includes(':')) {
      const parts = resolved.split(':');
      if (parts[parts.length - 1].match(/^\d+$/)) {
        resolved = parts.slice(0, -1).join(':');
      }
    }

    if (!resolved || resolved.toLowerCase().includes('unknown')) {
      if (selectedFile && !selectedFile.toLowerCase().includes('unknown')) {
        resolved = selectedFile;
      } else if (projectFiles.length > 0) {
        resolved = projectFiles[0];
      } else {
        resolved = 'unknown';
      }
    }

    setTargetFile(resolved);
  }, [analysisResult, selectedFile, projectFiles]);

  if (!analysisResult) {
    setScreen('home');
    return null;
  }

  const isUnknownTarget = !targetFile || targetFile.toLowerCase().includes('unknown');

  const handleApply = async () => {
    setError('');

    if (isUnknownTarget) {
      setError("Unable to determine the target file. Select a project file and retry.");
      return;
    }

    setApplying(true);
    try {
      const cleanPath = targetFile.replace('demo-project/', '').replace('demo-project\\', '').replace(/^\/+/, '');

      const res = await api.applyPatch({
        file: cleanPath,
        old_code: analysisResult.old_code,
        new_code: analysisResult.new_code
      });

      if (res.success) {
        setScreen('tests');
      } else {
        setError(res.message || 'Patch failed to apply');
        setApplying(false);
      }
    } catch (err: any) {
      console.error("Patch application error:", err);
      if (err.message && err.message.includes('already been patched')) {
        setScreen('tests');
      } else {
        setError(err.message || 'Failed to apply patch. Check backend connection.');
        setApplying(false);
      }
    }
  };

  const handleReject = async () => {
    try {
      await api.rejectPatch();
    } catch {
      // Ignore
    }
    setScreen('home');
  };

  const handleSelectFile = (file: string) => {
    setTargetFile(file);
    setSelectedFile(file);
    setError('');
  };

  const lines_old = (analysisResult.old_code || "").split('\n');
  const lines_new = (analysisResult.new_code || "").split('\n');

  return (
    <div className="screen-content flex flex-col h-full">
      <button className="back-btn" onClick={() => setScreen('analysis')} style={{ marginBottom: 16 }}>
        ← Back to Analysis
      </button>

      {/* Hero Title Header */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.3px' }}>REVIEW CODE PATCH</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span className="badge badge-yellow" style={{ fontSize: 9, fontWeight: 800 }}>USER APPROVAL REQUIRED</span>
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
            {targetFile || 'unknown'}
          </span>
        </div>
      </div>

      {isUnknownTarget && projectFiles.length > 0 && (
        <div className="card mb-4" style={{ background: 'var(--surface-3)', padding: 12 }}>
          <div className="text-xs font-bold text-yellow mb-2">SELECT TARGET PROJECT FILE:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {projectFiles.map(file => (
              <button
                key={file}
                className="btn btn-outline btn-sm"
                style={{ fontSize: 11, padding: '4px 8px', minHeight: 28 }}
                onClick={() => handleSelectFile(file)}
              >
                {file}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Code Diff Hero Display */}
      <div className="flex-1 overflow-y-auto mb-4" style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#0d0d0f', padding: 4, minHeight: 180 }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ padding: '8px 12px', fontSize: 10, background: 'var(--surface-3)', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', fontWeight: 800, letterSpacing: '0.08em' }}>
            TARGET: {targetFile} (LINE {analysisResult.line || 52})
          </div>

          {/* BEFORE (Red Lines) */}
          <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--red)', fontWeight: 700, background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
            BEFORE (REMOVED CODE)
          </div>
          {lines_old.map((line, i) => (
            <div key={`old-${i}`} style={{ display: 'flex', background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
              <div style={{ width: 32, padding: '3px 6px', textAlign: 'right', color: 'var(--red)', opacity: 0.8, borderRight: '1px solid rgba(239,68,68,0.3)', userSelect: 'none', fontWeight: 700 }}>-</div>
              <div style={{ padding: '3px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
            </div>
          ))}

          {/* AFTER (Green Lines) */}
          <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--green)', fontWeight: 700, background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.1)', marginTop: 4 }}>
            AFTER (ADDED CODE)
          </div>
          {lines_new.map((line, i) => (
            <div key={`new-${i}`} style={{ display: 'flex', background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>
              <div style={{ width: 32, padding: '3px 6px', textAlign: 'right', color: 'var(--green)', opacity: 0.8, borderRight: '1px solid rgba(34,197,94,0.3)', userSelect: 'none', fontWeight: 700 }}>+</div>
              <div style={{ padding: '3px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="card mb-4" style={{ background: 'var(--red-dim)', borderColor: 'rgba(239,68,68,0.4)', padding: '12px 14px' }}>
          <div className="text-red text-xs font-semibold text-center" style={{ lineHeight: 1.5 }}>
            ⚠️ {error}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 mt-auto">
        <button id="reject-patch-btn" className="btn btn-red flex-1" onClick={handleReject} disabled={applying}>
          REJECT
        </button>
        <button id="apply-patch-btn" className="btn btn-yellow flex-[2]" onClick={handleApply} disabled={applying}>
          {applying ? 'Applying Patch...' : 'APPLY FIX ✓'}
        </button>
      </div>
    </div>
  );
}
