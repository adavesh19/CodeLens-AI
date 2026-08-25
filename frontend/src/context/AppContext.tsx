import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AnalysisResult, TestResults } from '../api/types';

export type Screen = 'home' | 'camera' | 'voice' | 'input' | 'analysis' | 'patch' | 'tests' | 'success';

interface AppState {
  // Navigation
  screen: Screen;
  setScreen: (s: Screen) => void;

  // Error text (captured via camera/voice/paste)
  errorText: string;
  setErrorText: (t: string) => void;

  // Selected target file from project context UI
  selectedFile: string;
  setSelectedFile: (f: string) => void;

  // AI analysis result
  analysisResult: AnalysisResult | null;
  setAnalysisResult: (r: AnalysisResult | null) => void;

  // Patch state
  patchApplied: boolean;
  setPatchApplied: (v: boolean) => void;

  // Test results
  testResults: TestResults | null;
  setTestResults: (r: TestResults | null) => void;

  // Loading state
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;

  // Demo mode
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;

  // AI availability
  aiAvailable: boolean;
  setAiAvailable: (v: boolean) => void;

  // Ollama model name
  aiModel: string;
  setAiModel: (v: string) => void;

  // Full session reset
  resetSession: () => void;
}

const AppContext = createContext<AppState>(null as unknown as AppState);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('home');
  const [errorText, setErrorText] = useState('');
  const [selectedFile, setSelectedFile] = useState('demo-project/auth.py');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [patchApplied, setPatchApplied] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiModel, setAiModel] = useState('fallback');

  const resetSession = useCallback(() => {
    setAnalysisResult(null);
    setTestResults(null);
    setPatchApplied(false);
    setErrorText('');
    setSelectedFile('demo-project/auth.py');
    setDemoMode(false);
    setScreen('home');
  }, []);

  return (
    <AppContext.Provider value={{
      screen, setScreen,
      errorText, setErrorText,
      selectedFile, setSelectedFile,
      analysisResult, setAnalysisResult,
      patchApplied, setPatchApplied,
      testResults, setTestResults,
      isLoading, setIsLoading,
      demoMode, setDemoMode,
      aiAvailable, setAiAvailable,
      aiModel, setAiModel,
      resetSession,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
