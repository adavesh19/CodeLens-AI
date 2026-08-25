export interface AnalyzeRequest {
  error_text: string;
  voice_query?: string;
  image_data?: string;
  selected_file?: string;
}

export interface AnalysisResult {
  root_cause: string;
  affected_file: string;
  line: number | null;
  explanation: string;
  suggested_fix: string;
  confidence: 'high' | 'medium' | 'low';
  patch: string;
  tests_to_run: string[];
  old_code: string;
  new_code: string;
  provider?: string;
  model?: string;
  note?: string;
  inference_ms?: number;
  total_ms?: number;
}

export interface PatchResult {
  success: boolean;
  message: string;
  backup_created: boolean;
  file?: string;
}

export interface TestDetail {
  name: string;
  status: 'passed' | 'failed';
  message: string;
}

export interface TestResults {
  passed: number;
  failed: number;
  total: number;
  all_passed: boolean;
  output: string;
  test_details: TestDetail[];
  return_code?: number;
}

export interface ProjectInfo {
  name: string;
  path: string;
  files: string[];
  status: string;
  description?: string;
}

export interface HealthStatus {
  status: string;
  ai_available: boolean;
  model: string;
  fallback: boolean;
  demo_project?: string;
}
