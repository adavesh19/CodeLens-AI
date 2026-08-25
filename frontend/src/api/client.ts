/**
 * API client for CodeLens AI backend.
 * Handles timeouts, local LLM inference delays, and context-aware error reporting.
 */
import type { AnalyzeRequest, AnalysisResult, PatchResult, TestResults, ProjectInfo, HealthStatus } from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit, timeoutMs: number = 30000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      if (path.includes('/analyze')) {
        throw new Error('LOCAL AI REQUEST TIMED OUT');
      }
      throw new Error('BACKEND UNAVAILABLE');
    }
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('BACKEND UNAVAILABLE');
    }
    throw err;
  }
}

export const api = {
  health: () => request<HealthStatus>('/health', {}, 5000),

  // 300s (5 min) timeout for local CPU/GPU LLM inference (codellama model loading + generation)
  analyze: (body: AnalyzeRequest) =>
    request<AnalysisResult>('/analyze', { method: 'POST', body: JSON.stringify(body) }, 300000),

  applyPatch: (body: { file: string; old_code: string; new_code: string }) =>
    request<PatchResult>('/apply-patch', { method: 'POST', body: JSON.stringify(body) }, 30000),

  rejectPatch: () => request('/reject-patch', { method: 'POST' }),

  runTests: () => request<TestResults>('/run-tests', { method: 'POST' }, 60000),

  getProject: () => request<ProjectInfo>('/project'),

  getFile: (path: string) =>
    request<{ path: string; content: string }>(`/project/file?path=${encodeURIComponent(path)}`),

  loadDemo: () => request('/demo/load', { method: 'POST' }),

  getDemoStatus: () => request<{ state: string; has_bug: boolean; file_exists: boolean }>('/demo/status'),

  ocr: (imageData: string) =>
    request<{ text: string; confidence: number; lines: string[] }>('/ocr', {
      method: 'POST',
      body: JSON.stringify({ image_data: imageData }),
    }),

  voiceQuery: (query: string) =>
    request<{ formatted_query: string; detected_intent: string }>('/voice/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
};
