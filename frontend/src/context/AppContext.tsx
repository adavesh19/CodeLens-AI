import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AnalysisResult, TestResults } from '../api/types';
import { api } from '../api/client';

export type Screen = 'home' | 'camera' | 'voice' | 'input' | 'analysis' | 'patch' | 'tests' | 'success';
export type AIProvider = 'groq' | 'ollama' | 'demo' | 'offline';

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

  // AI & Backend Connectivity Status
  backendConnected: boolean;
  setBackendConnected: (v: boolean) => void;

  aiProvider: AIProvider;
  setAiProvider: (p: AIProvider) => void;

  aiAvailable: boolean;
  setAiAvailable: (v: boolean) => void;

  aiModel: string;
  setAiModel: (v: string) => void;

  // Manual status check
  checkHealth: () => Promise<void>;

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
  const [backendConnected, setBackendConnected] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>('offline');
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiModel, setAiModel] = useState('connecting...');

  const checkHealth = useCallback(async () => {
    try {
      const res = await api.health();
      setBackendConnected(true);

      const provider = res.ai_provider || (res.ai_available ? 'ollama' : 'demo');
      const isOnline = res.ai_online !== undefined ? res.ai_online : Boolean(res.ai_available);

      setAiProvider(provider);
      setAiAvailable(isOnline);
      setAiModel(res.model || 'default');
    } catch {
      setBackendConnected(false);
      setAiProvider('offline');
      setAiAvailable(false);
      setAiModel('unreachable');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const resetSession = useCallback(() => {
    setAnalysisResult(null);
    setTestResults(null);
    setPatchApplied(false);
    setErrorText('');
    setSelectedFile('demo-project/auth.py');
    setDemoMode(false);
    setScreen('home');
    checkHealth();
  }, [checkHealth]);

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
      backendConnected, setBackendConnected,
      aiProvider, setAiProvider,
      aiAvailable, setAiAvailable,
      aiModel, setAiModel,
      checkHealth,
      resetSession,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
