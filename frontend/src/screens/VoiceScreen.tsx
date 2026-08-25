import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

// Standard Web Speech API declaration
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VoiceScreen() {
  const { setScreen, setErrorText } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detectedIntent, setDetectedIntent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        setTranscript(current);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access denied.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setErrorMsg('Web Speech API not supported in this browser. You can type or use sample query.');
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      // Fallback demo input if speech API not available
      setTranscript("Why is this API returning 401?");
      setDetectedIntent("authentication_error");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setErrorMsg('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePresetSample = (sample: string) => {
    setTranscript(sample);
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setIsAnalyzing(true);
    try {
      // Send query to voice API router to detect intent
      const res = await api.voiceQuery(transcript);
      if (res.detected_intent) {
        setDetectedIntent(res.detected_intent);
      }
      // Set error text for analysis pipeline
      const fullQuery = `Voice Debug Query: "${res.formatted_query || transcript}"\nContext: HTTP 401 Unauthorized JWT validation failure in auth.py`;
      setErrorText(fullQuery);
      setScreen('analysis');
    } catch {
      // Fallback if backend offline
      setErrorText(`Voice Query: ${transcript}\nHTTP 401 Unauthorized in auth.py:52`);
      setScreen('analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="screen-content flex flex-col h-full">
      <button className="back-btn" onClick={() => setScreen('home')} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 className="text-xl font-bold">VOICE DEBUG</h2>
        <div className="badge badge-cyan">AUDIO INPUT</div>
      </div>
      <p className="text-muted text-xs mb-6">Describe the error aloud to CodeLens AI.</p>

      {/* Mic Button Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '20px 0 32px' }}>
        <button
          id="mic-btn"
          className={`mic-btn ${isListening ? 'listening' : ''}`}
          onClick={toggleListening}
        >
          {isListening ? '🎙️' : '🎤'}
        </button>

        <div style={{ fontSize: 13, color: isListening ? 'var(--yellow)' : 'var(--text-muted)', fontWeight: 600, marginTop: 16 }}>
          {isListening ? 'Listening... Speak your query' : 'Tap microphone to speak'}
        </div>
      </div>

      {/* Query Result Box */}
      {transcript && (
        <div className="card mb-4" style={{ borderColor: 'rgba(34,211,238,0.3)', background: 'var(--surface-2)' }}>
          <div className="section-label" style={{ color: 'var(--cyan)' }}>VOICE QUERY DETECTED</div>
          <div className="text-base font-semibold" style={{ marginBottom: 8, fontStyle: 'italic' }}>
            "{transcript}"
          </div>
          {detectedIntent && (
            <div className="badge badge-yellow" style={{ fontSize: 10 }}>
              Intent: {detectedIntent}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="text-xs text-muted text-center mb-4" style={{ padding: '6px 12px', background: 'var(--surface-3)', borderRadius: 8 }}>
          ℹ️ {errorMsg}
        </div>
      )}

      {/* Preset Query Shortcuts for Hackathon Demo */}
      <div className="section-label">Quick Sample Voice Queries</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        <button
          className="btn btn-outline btn-sm"
          style={{ justifyContent: 'flex-start', fontSize: 12, textAlign: 'left' }}
          onClick={() => handlePresetSample("Why is this API returning 401?")}
        >
          💬 "Why is this API returning 401?"
        </button>
        <button
          className="btn btn-outline btn-sm"
          style={{ justifyContent: 'flex-start', fontSize: 12, textAlign: 'left' }}
          onClick={() => handlePresetSample("Why is the JWT token expiring immediately?")}
        >
          💬 "Why is the JWT token expiring immediately?"
        </button>
      </div>

      {/* Analyze Button */}
      <button
        id="analyze-voice-btn"
        className="btn btn-yellow mt-auto"
        onClick={handleAnalyze}
        disabled={!transcript.trim() || isAnalyzing}
      >
        {isAnalyzing ? 'Processing Voice...' : 'Analyze Voice Query →'}
      </button>
    </div>
  );
}
