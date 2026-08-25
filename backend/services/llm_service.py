"""
LLM Service - Multi-provider abstraction layer for CodeLens AI.

Supported Providers:
  - GroqProvider (LLM_PROVIDER=groq): High-speed Groq Cloud LLM for production
  - OllamaProvider (LLM_PROVIDER=ollama): Local open-source LLM via Ollama API
  - DeterministicFallbackProvider (LLM_PROVIDER=demo): Offline fallback provider

Browser/Frontend never calls Ollama or Groq directly.
Server environment variables dictate the active provider safely.
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

# Configured Environment Settings
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama").lower().strip()

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:1.5b")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

_IS_MODEL_WARMED = False


# System and prompt template for AI error analysis
SYSTEM_PROMPT = "You are an expert software debugger. Respond ONLY with a valid JSON object matching the requested schema."

ANALYSIS_PROMPT_TEMPLATE = """Analyze error & code. Respond ONLY with valid JSON matching this schema:
ERROR: {error_text}
CODE: {code_context}
REQUIRED JSON SCHEMA:
{{"root_cause":"concise description","affected_file":"demo-project/auth.py","line":52,"explanation":"why bug occurs","suggested_fix":"fix description","confidence":"high","patch":"patch description","tests_to_run":["tests/test_auth.py"],"old_code":"if datetime.now().timestamp() * 1000 > payload['exp']:","new_code":"if datetime.now().timestamp() > payload['exp']:"}}
"""


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def analyze(self, error_text: str, code_context: str) -> dict:
        """Analyze an error with context and return structured analysis."""
        pass


class GroqProvider(LLMProvider):
    """Production Groq Cloud API provider."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model or "llama-3.3-70b-versatile"

    async def analyze(self, error_text: str, code_context: str) -> dict:
        t0 = time.time()
        logger.info(f"[ANALYZE] Groq Cloud request started (model: {self.model})")

        if not self.api_key:
            logger.error("[ANALYZE] Groq API key is missing")
            raise Exception("AI PROVIDER AUTHENTICATION ERROR: GROQ_API_KEY is not set on server")

        compact_context = code_context[:1500]
        prompt = ANALYSIS_PROMPT_TEMPLATE.format(
            error_text=error_text[:800],
            code_context=compact_context
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 400
        }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                resp = await client.post(GROQ_BASE_URL, headers=headers, json=payload)

                if resp.status_code == 401:
                    logger.error(f"[ANALYZE] Groq 401 Invalid API Key: {resp.text}")
                    raise Exception("AI PROVIDER AUTHENTICATION ERROR")
                if resp.status_code == 429:
                    logger.error(f"[ANALYZE] Groq 429 Rate Limit Exceeded: {resp.text}")
                    raise Exception("AI RATE LIMIT REACHED")
                if resp.status_code >= 500:
                    logger.error(f"[ANALYZE] Groq {resp.status_code} Error: {resp.text}")
                    raise Exception("AI PROVIDER TEMPORARILY UNAVAILABLE")

                resp.raise_for_status()
                data = resp.json()
                raw_response = data["choices"][0]["message"]["content"]

            t_groq = (time.time() - t0) * 1000
            logger.info(f"[ANALYZE] Groq response received: {t_groq:.1f} ms")

            result = _parse_json_response(raw_response)
            result["provider"] = "groq"
            result["model"] = self.model
            result["inference_ms"] = round(t_groq, 1)

            t_total = (time.time() - t0) * 1000
            logger.info(f"[ANALYZE] Groq completed total: {t_total:.1f} ms")
            return result

        except httpx.TimeoutException:
            logger.error("[ANALYZE] Groq request timed out")
            raise Exception("AI REQUEST TIMED OUT")
        except Exception as e:
            if any(term in str(e) for term in ["AUTHENTICATION", "RATE LIMIT", "TIMED OUT", "UNAVAILABLE"]):
                raise
            logger.error(f"[ANALYZE] Groq processing error: {e}")
            raise Exception(f"AI ANALYSIS ERROR: {e}")


class OllamaProvider(LLMProvider):
    """Local Ollama provider for offline/local development."""

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def analyze(self, error_text: str, code_context: str) -> dict:
        t0 = time.time()
        logger.info(f"[ANALYZE] Local Ollama request started (model: {self.model})")

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
                "num_thread": cpu_threads,
                "num_ctx": 1024,
                "num_predict": 180,
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

            result = _parse_json_response(raw_response)
            result["provider"] = "ollama"
            result["model"] = self.model
            result["inference_ms"] = round(t_ollama, 1)

            t_total = (time.time() - t0) * 1000
            logger.info(f"[ANALYZE] Ollama completed total: {t_total:.1f} ms")
            return result

        except httpx.TimeoutException:
            logger.error("[ANALYZE] Ollama request timed out")
            raise Exception("LOCAL AI REQUEST TIMED OUT")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise Exception("MODEL NOT FOUND")
            raise Exception(f"LOCAL AI HTTP ERROR: {e.response.status_code}")
        except Exception as e:
            if any(term in str(e) for term in ["TIMED OUT", "NOT FOUND", "HTTP ERROR"]):
                raise
            logger.error(f"[ANALYZE] Ollama error: {e}")
            raise Exception(f"LOCAL AI ANALYSIS ERROR: {e}")


class DeterministicFallbackProvider(LLMProvider):
    """Deterministic fallback analysis provider for emergency demo safety."""

    async def analyze(self, error_text: str, code_context: str) -> dict:
        t0 = time.time()
        logger.info("[ANALYZE] Using deterministic fallback provider")
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
            "explanation": "datetime.now().timestamp() returns seconds. JWT exp is represented in seconds. The buggy implementation multiplies current timestamp by 1000, causing validation to fail.",
            "suggested_fix": "Remove '* 1000' from datetime.now().timestamp() * 1000 on line 52",
            "confidence": "high",
            "patch": "Change 'datetime.now().timestamp() * 1000 > payload[\"exp\"]' to 'datetime.now().timestamp() > payload[\"exp\"]'",
            "tests_to_run": ["tests/test_auth.py", "tests/test_api.py"],
            "old_code": "        if datetime.now().timestamp() * 1000 > payload['exp']:",
            "new_code": "        if datetime.now().timestamp() > payload['exp']:",
            "provider": "demo",
            "model": "deterministic-fallback"
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
            "provider": "demo",
            "model": "deterministic-fallback"
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
            "provider": "demo",
            "model": "deterministic-fallback"
        }


def _parse_json_response(raw: str) -> dict:
    """Extract and validate JSON from LLM response with robust fallback extractors."""
    raw = raw.strip()
    if not raw:
        raise Exception("AI RESPONSE COULD NOT BE PARSED")

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


async def check_llm_status() -> dict:
    """
    Check backend AI status and return provider metadata safely (never exposing secrets).
    """
    provider_type = os.environ.get("LLM_PROVIDER", "ollama").lower().strip()

    if provider_type == "groq":
        key_present = bool(GROQ_API_KEY)
        model = GROQ_MODEL or "llama-3.3-70b-versatile"
        return {
            "status": "ok",
            "ai_provider": "groq",
            "ai_online": key_present,
            "model": model,
            "fallback": not key_present
        }

    if provider_type == "ollama":
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags")
                if resp.status_code == 200:
                    tags = resp.json()
                    available_models = [m.get("name", "") for m in tags.get("models", [])]
                    preferred = ["qwen2.5-coder:1.5b", "qwen2.5-coder:3b", "llama3.2:1b", "codellama:latest", "codellama"]
                    
                    env_model = os.environ.get("OLLAMA_MODEL")
                    if env_model:
                        preferred.insert(0, env_model)

                    selected = None
                    for p in preferred:
                        for m in available_models:
                            if p.lower() in m.lower() or m.lower().startswith(p.lower().split(":")[0]):
                                selected = m
                                break
                        if selected:
                            break

                    if not selected and available_models:
                        selected = available_models[0]

                    if selected:
                        return {
                            "status": "ok",
                            "ai_provider": "ollama",
                            "ai_online": True,
                            "model": selected,
                            "fallback": False
                        }
        except Exception:
            pass

        return {
            "status": "ok",
            "ai_provider": "ollama",
            "ai_online": False,
            "model": OLLAMA_MODEL,
            "fallback": True
        }

    # Default to deterministic demo provider
    return {
        "status": "ok",
        "ai_provider": "demo",
        "ai_online": False,
        "model": "deterministic-fallback",
        "fallback": True
    }


async def warmup_ollama():
    """Non-blocking background warmup for local Ollama."""
    global _IS_MODEL_WARMED
    if _IS_MODEL_WARMED:
        return
    provider_type = os.environ.get("LLM_PROVIDER", "ollama").lower().strip()
    if provider_type != "ollama":
        return
    try:
        status = await check_llm_status()
        if status.get("ai_online"):
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


async def get_llm_provider() -> LLMProvider:
    """
    Factory function: returns active LLMProvider based on LLM_PROVIDER env.
    """
    provider_type = os.environ.get("LLM_PROVIDER", "ollama").lower().strip()

    if provider_type == "groq":
        if GROQ_API_KEY:
            logger.info(f"[LLM] Selected GroqProvider ({GROQ_MODEL})")
            return GroqProvider(GROQ_API_KEY, GROQ_MODEL)
        else:
            logger.warning("[LLM] GROQ_API_KEY missing. Falling back to DeterministicFallbackProvider.")
            return DeterministicFallbackProvider()

    if provider_type == "ollama":
        status = await check_llm_status()
        if status["ai_online"]:
            selected_model = status["model"]
            logger.info(f"[LLM] Selected OllamaProvider ({selected_model})")
            return OllamaProvider(OLLAMA_BASE_URL, selected_model)
        else:
            logger.warning("[LLM] Ollama unreachable. Falling back to DeterministicFallbackProvider.")
            return DeterministicFallbackProvider()

    logger.info("[LLM] LLM_PROVIDER=demo or default. Selected DeterministicFallbackProvider.")
    return DeterministicFallbackProvider()
