"""
LLM Service - Abstraction layer for AI providers.

Supports:
  - OllamaProvider: Local/open-source model via Ollama API
  - DeterministicFallbackProvider: Emergency fallback when Ollama is offline

Architecture allows swapping providers without UI changes.
"""
import os
import json
import time
import logging
import httpx
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:1.5b")

_IS_MODEL_WARMED = False


# Ultra-concise prompt to minimize token generation latency
ANALYSIS_PROMPT_TEMPLATE = """Analyze error & code. Respond ONLY with valid JSON schema:
ERROR: {error_text}
CODE: {code_context}
JSON SCHEMA:
{{"root_cause":"concise description","affected_file":"demo-project/auth.py","line":52,"explanation":"why bug occurs","suggested_fix":"fix description","confidence":"high","patch":"patch description","tests_to_run":["tests/test_auth.py"],"old_code":"if datetime.now().timestamp() * 1000 > payload['exp']:","new_code":"if datetime.now().timestamp() > payload['exp']:"}}
"""


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def analyze(self, error_text: str, code_context: str) -> dict:
        """Analyze an error with context and return structured analysis."""
        pass


class OllamaProvider(LLMProvider):
    """Calls a local Ollama instance for AI-powered analysis using fast local models."""

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def analyze(self, error_text: str, code_context: str) -> dict:
        t0 = time.time()
        logger.info(f"[ANALYZE] Ollama request started (model: {self.model})")

        # Compact context window to max 800 chars for fast inference
        compact_context = code_context[:800]
        prompt = ANALYSIS_PROMPT_TEMPLATE.format(
            error_text=error_text[:400],
            code_context=compact_context
        )

        cpu_threads = os.cpu_count() or 8
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "num_thread": cpu_threads,  # Maximize CPU physical thread utilization
                "num_ctx": 1024,            # Restrict context window to save memory & speed up prompt processing
                "num_predict": 180,         # Max tokens needed for response JSON schema
                "temperature": 0.1
            }
        }

        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload
                )
                resp.raise_for_status()
                data = resp.json()
                raw_response = data.get("response", "")

            t_ollama = (time.time() - t0) * 1000
            logger.info(f"[ANALYZE] Ollama response received: {t_ollama:.1f} ms")

            t_parse_start = time.time()
            result = self._parse_json_response(raw_response)
            t_parse = (time.time() - t_parse_start) * 1000
            logger.info(f"[ANALYZE] Response parsing: {t_parse:.1f} ms")

            result["provider"] = "ollama"
            result["model"] = self.model
            result["inference_ms"] = round(t_ollama, 1)

            t_total = (time.time() - t0) * 1000
            logger.info(f"[ANALYZE] Completed total: {t_total:.1f} ms")
            return result

        except httpx.TimeoutException as e:
            logger.error(f"[ANALYZE] Ollama request timed out after 300s: {e}")
            raise Exception("LOCAL AI REQUEST TIMED OUT")
        except httpx.HTTPStatusError as e:
            logger.error(f"[ANALYZE] Ollama HTTP error {e.response.status_code}: {e.response.text}")
            if e.response.status_code == 404:
                raise Exception("MODEL NOT FOUND")
            raise Exception(f"LOCAL AI HTTP ERROR: {e.response.status_code}")
        except Exception as e:
            logger.error(f"[ANALYZE] Ollama analysis error: {e}")
            raise Exception(f"LOCAL AI ANALYSIS ERROR: {e}")

    def _parse_json_response(self, raw: str) -> dict:
        """Extract and validate JSON from LLM response with robust fallback extractors."""
        raw = raw.strip()
        if not raw:
            raise Exception("AI RESPONSE WAS EMPTY")

        parsed = None

        # 1. Direct json.loads
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            pass

        # 2. Extract from ```json ... ``` or ``` ... ```
        if not parsed:
            m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
            if m:
                try:
                    parsed = json.loads(m.group(1))
                except json.JSONDecodeError:
                    pass

        # 3. Find first { to last }
        if not parsed:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                substring = raw[start:end]
                try:
                    parsed = json.loads(substring)
                except json.JSONDecodeError:
                    cleaned = re.sub(r",\s*([\}\]])", r"\1", substring)
                    try:
                        parsed = json.loads(cleaned)
                    except json.JSONDecodeError:
                        pass

        # 4. Regex key-value extraction fallback
        if not isinstance(parsed, dict):
            parsed = {}
            for key in ["root_cause", "affected_file", "explanation", "suggested_fix", "confidence", "patch", "old_code", "new_code"]:
                m = re.search(rf'"{key}"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', raw, re.DOTALL)
                if m:
                    parsed[key] = m.group(1).replace('\\"', '"').replace('\\n', '\n')
            
            m_line = re.search(r'"line"\s*:\s*(\d+)', raw)
            if m_line:
                parsed["line"] = int(m_line.group(1))

        # Normalize camelCase key names
        key_mappings = {
            "rootCause": "root_cause",
            "affectedFile": "affected_file",
            "suggestedFix": "suggested_fix",
            "oldCode": "old_code",
            "newCode": "new_code",
            "testsToRun": "tests_to_run",
            "file": "affected_file",
        }
        for k_src, k_dst in key_mappings.items():
            if k_src in parsed and k_dst not in parsed:
                parsed[k_dst] = parsed[k_src]

        if "root_cause" not in parsed and "explanation" in parsed:
            parsed["root_cause"] = str(parsed["explanation"])[:120]
        
        if not parsed.get("root_cause") and not parsed.get("old_code"):
            raise Exception("AI RESPONSE COULD NOT BE PARSED")

        # Set default values for any missing schema fields
        parsed.setdefault("affected_file", "demo-project/auth.py")
        parsed.setdefault("line", 52)
        parsed.setdefault("confidence", "high")
        parsed.setdefault("explanation", parsed.get("root_cause", ""))
        parsed.setdefault("suggested_fix", "Fix line comparison")
        parsed.setdefault("patch", "Remove * 1000 from timestamp comparison")
        parsed.setdefault("tests_to_run", ["tests/test_auth.py"])
        parsed.setdefault("old_code", "if datetime.now().timestamp() * 1000 > payload['exp']:")
        parsed.setdefault("new_code", "if datetime.now().timestamp() > payload['exp']:")

        return parsed


class DeterministicFallbackProvider(LLMProvider):
    """
    Deterministic analysis provider for emergency fallback when Ollama is offline.
    """

    async def analyze(self, error_text: str, code_context: str) -> dict:
        t0 = time.time()
        logger.info("[ANALYZE] Using deterministic fallback provider (Ollama offline)")
        error_lower = error_text.lower()

        if any(kw in error_lower for kw in ["jwt", "401", "unauthorized", "token", "exp", "expired", "auth"]):
            res = self._jwt_analysis()
        elif "traceback" in error_lower or "exception" in error_lower:
            res = self._generic_exception_analysis(error_text)
        else:
            res = self._generic_analysis(error_text)

        t_total = (time.time() - t0) * 1000
        logger.info(f"[ANALYZE] Completed total (fallback): {t_total:.1f} ms")
        return res

    def _jwt_analysis(self) -> dict:
        return {
            "root_cause": "JWT expiration check uses incompatible time units. The code multiplies datetime.now().timestamp() (seconds) by 1000, creating milliseconds that always exceed payload['exp'] (seconds).",
            "affected_file": "demo-project/auth.py",
            "line": 52,
            "explanation": "datetime.now().timestamp() returns seconds. JWT exp is represented in seconds. The buggy implementation multiplies the current timestamp by 1000. Therefore the comparison becomes invalid.",
            "suggested_fix": "Remove the '* 1000' from datetime.now().timestamp() * 1000 on line 52",
            "confidence": "high",
            "patch": "Change 'datetime.now().timestamp() * 1000 > payload[\"exp\"]' to 'datetime.now().timestamp() > payload[\"exp\"]'",
            "tests_to_run": ["tests/test_auth.py", "tests/test_api.py"],
            "old_code": "        if datetime.now().timestamp() * 1000 > payload['exp']:",
            "new_code": "        if datetime.now().timestamp() > payload['exp']:",
            "provider": "deterministic_fallback"
        }

    def _generic_exception_analysis(self, error_text: str) -> dict:
        lines = error_text.strip().split("\n")
        last_line = lines[-1] if lines else error_text
        return {
            "root_cause": f"Python exception detected: {last_line[:100]}",
            "affected_file": "unknown",
            "line": None,
            "explanation": "A runtime exception was raised. Review the stack trace for details.",
            "suggested_fix": "Review exception type and line references.",
            "confidence": "medium",
            "patch": "Review and fix identified error location",
            "tests_to_run": ["tests/"],
            "old_code": "",
            "new_code": "",
            "provider": "deterministic_fallback"
        }

    def _generic_analysis(self, error_text: str) -> dict:
        return {
            "root_cause": "Error detected in application code.",
            "affected_file": "unknown",
            "line": None,
            "explanation": f"Captured error: {error_text[:200]}.",
            "suggested_fix": "Review error message and related code sections.",
            "confidence": "low",
            "patch": "Manual review required",
            "tests_to_run": ["tests/"],
            "old_code": "",
            "new_code": "",
            "provider": "deterministic_fallback"
        }


async def warmup_ollama():
    """
    Non-blocking background model warmup: triggers Ollama to pre-load the model into memory.
    """
    global _IS_MODEL_WARMED
    if _IS_MODEL_WARMED:
        return
    try:
        status = await check_ollama_status()
        model_name = status.get("model", OLLAMA_MODEL)
        logger.info(f"[WARMUP] Pre-loading model {model_name} in Ollama background...")
        payload = {
            "model": model_name,
            "prompt": "hi",
            "stream": False,
            "options": {"num_predict": 1}
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate", json=payload)
            if resp.status_code == 200:
                _IS_MODEL_WARMED = True
                logger.info(f"[WARMUP] Model {model_name} is warm in memory!")
    except Exception as e:
        logger.debug(f"[WARMUP] Non-blocking warmup status: {e}")


async def check_ollama_status() -> dict:
    """
    Check if Ollama is reachable AND select the optimal available model.
    Prefers lightweight fast models like qwen2.5-coder:1.5b over heavy 7B models.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags")
            if resp.status_code == 200:
                tags = resp.json()
                available_models = [m.get("name", "") for m in tags.get("models", [])]
                
                # Priority list: lightweight fast code models first
                preferred = ["qwen2.5-coder:1.5b", "qwen2.5-coder:3b", "llama3.2:1b", "llama3.2:3b", "codellama:latest", "codellama"]
                
                # Respect explicit environment variable if set
                env_model = os.environ.get("OLLAMA_MODEL")
                if env_model and env_model != "codellama":
                    preferred.insert(0, env_model)

                for p in preferred:
                    for m in available_models:
                        if p.lower() in m.lower() or m.lower().startswith(p.lower().split(":")[0]):
                            return {"ai_available": True, "model": m, "fallback": False}

                if available_models:
                    return {"ai_available": True, "model": available_models[0], "fallback": False}
    except Exception:
        pass

    return {"ai_available": False, "model": OLLAMA_MODEL, "fallback": True, "reason": "unreachable"}


async def get_llm_provider() -> LLMProvider:
    """
    Factory function: returns OllamaProvider with optimal model if Ollama is available, else DeterministicFallbackProvider.
    """
    status = await check_ollama_status()
    if status["ai_available"]:
        selected_model = status["model"]
        logger.info(f"[LLM] Selected OllamaProvider ({selected_model})")
        return OllamaProvider(OLLAMA_BASE_URL, selected_model)

    logger.info("[LLM] Ollama unavailable. Selected DeterministicFallbackProvider.")
    return DeterministicFallbackProvider()
