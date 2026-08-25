"""
Backend API tests for CodeLens AI.
Tests all endpoints and specific requirement scenarios using FastAPI's TestClient.
"""
import sys
import os
import pytest
from unittest.mock import patch

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from services.retrieval import CodebaseRetriever
from services.llm_service import DeterministicFallbackProvider

client = TestClient(app)
DEMO_PROJECT_DIR = app.state.demo_project_path


@pytest.fixture(autouse=True)
def mock_llm_provider_for_unit_tests():
    """Use deterministic provider for fast, reliable unit test assertions."""
    async def _mock_get_provider():
        return DeterministicFallbackProvider()
    with patch("routers.analyze.get_llm_provider", side_effect=_mock_get_provider):
        yield


class TestHealth:
    def test_health_returns_200(self):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_has_status_ok(self):
        resp = client.get("/health")
        data = resp.json()
        assert data["status"] == "ok"

    def test_health_has_ai_available_field(self):
        resp = client.get("/health")
        data = resp.json()
        assert "ai_online" in data or "ai_available" in data or "ai_provider" in data

    def test_health_has_model_field(self):
        resp = client.get("/health")
        data = resp.json()
        assert "model" in data


class TestAnalyze:
    def test_analyze_returns_200_with_error_text(self):
        resp = client.post("/analyze", json={
            "error_text": "HTTP 401 Unauthorized JWT validation failed auth.py:42"
        })
        assert resp.status_code == 200

    def test_analyze_returns_root_cause(self):
        resp = client.post("/analyze", json={
            "error_text": "JWT 401 unauthorized token expired"
        })
        data = resp.json()
        assert "root_cause" in data
        assert len(data["root_cause"]) > 0

    def test_analyze_returns_confidence(self):
        resp = client.post("/analyze", json={
            "error_text": "JWT 401 unauthorized"
        })
        data = resp.json()
        assert "confidence" in data
        assert data["confidence"] in ["high", "medium", "low"]

    def test_analyze_returns_affected_file(self):
        resp = client.post("/analyze", json={
            "error_text": "JWT authentication error auth.py line 42"
        })
        data = resp.json()
        assert "affected_file" in data

    def test_analyze_missing_body_returns_422(self):
        resp = client.post("/analyze", json={})
        assert resp.status_code == 422

    def test_analyze_with_voice_query(self):
        resp = client.post("/analyze", json={
            "error_text": "401 error",
            "voice_query": "Why is the JWT failing?"
        })
        assert resp.status_code == 200


class TestRequiredScenarios:
    """Explicit tests for the required patch/resolution/verification scenarios."""

    def test_valid_file_path(self):
        """Scenario 1: Valid file path resolution and check."""
        retriever = CodebaseRetriever(DEMO_PROJECT_DIR)
        resolved = retriever.resolve_file(raw_file="auth.py")
        assert resolved == "auth.py"
        assert os.path.exists(os.path.join(DEMO_PROJECT_DIR, resolved))

    def test_analyzer_returns_unknown_file_but_selected_context_has_valid_file(self):
        """Scenario 2: Analyzer returns 'unknown' or 'unknown:52', but selected_file context is 'auth.py'."""
        retriever = CodebaseRetriever(DEMO_PROJECT_DIR)
        
        # Test direct retriever resolution
        resolved = retriever.resolve_file(
            raw_file="unknown:52",
            error_text="Generic runtime error without filename",
            selected_file="auth.py"
        )
        assert resolved == "auth.py"
        assert resolved != "unknown"

        # Test via analyze API endpoint with selected_file
        resp = client.post("/analyze", json={
            "error_text": "Unspecified syntax error in python file",
            "selected_file": "auth.py"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("affected_file") != "unknown"
        assert "auth.py" in data.get("affected_file")

    def test_nonexistent_file(self):
        """Scenario 3: Nonexistent file or 'unknown' patch target is rejected with 404."""
        resp = client.post("/apply-patch", json={
            "file": "nonexistent_file.py",
            "old_code": "foo",
            "new_code": "bar"
        })
        assert resp.status_code == 404
        assert "File not found" in resp.json()["detail"]

        # Test with 'unknown'
        resp_unk = client.post("/apply-patch", json={
            "file": "unknown",
            "old_code": "foo",
            "new_code": "bar"
        })
        assert resp_unk.status_code == 404
        assert "File not found" in resp_unk.json()["detail"]

    def test_patch_application_success(self):
        """Scenario 4: Patch application succeeds on valid file with matching old_code."""
        client.post("/demo/load")  # Ensure known buggy state

        # Apply fix
        resp = client.post("/apply-patch", json={
            "file": "auth.py",
            "old_code": "if datetime.now().timestamp() * 1000 > payload['exp']:",
            "new_code": "if datetime.now().timestamp() > payload['exp']:"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["backup_created"] is True

        # Verify content was updated
        with open(os.path.join(DEMO_PROJECT_DIR, "auth.py"), "r") as f:
            content = f.read()
        assert "* 1000" not in content

    def test_patch_application_failure(self):
        """Scenario 5: Patch application fails when old_code pattern does not exist in file."""
        resp = client.post("/apply-patch", json={
            "file": "auth.py",
            "old_code": "def non_existent_function_pattern_999():",
            "new_code": "def fixed():"
        })
        assert resp.status_code == 400
        assert "Old code pattern not found" in resp.json()["detail"]

    def test_verification_success(self):
        """Scenario 6: Test verification returns all_passed=True when project is fixed."""
        client.post("/demo/load")
        client.post("/apply-patch", json={
            "file": "auth.py",
            "old_code": "if datetime.now().timestamp() * 1000 > payload['exp']:",
            "new_code": "if datetime.now().timestamp() > payload['exp']:"
        })

        resp = client.post("/run-tests")
        assert resp.status_code == 200
        data = resp.json()
        assert data["all_passed"] is True
        assert data["failed"] == 0
        assert data["passed"] == 20

    def test_verification_failure(self):
        """Scenario 7: Test verification returns all_passed=False when project is buggy or has syntax error."""
        client.post("/demo/load")  # Reset to buggy state

        resp = client.post("/run-tests")
        assert resp.status_code == 200
        data = resp.json()
        assert data["all_passed"] is False
        assert data["failed"] > 0


class TestProject:
    def test_get_project_returns_200(self):
        resp = client.get("/project")
        assert resp.status_code == 200

    def test_get_project_has_name(self):
        resp = client.get("/project")
        data = resp.json()
        assert "name" in data
        assert data["name"] == "demo-project"

    def test_get_project_has_files(self):
        resp = client.get("/project")
        data = resp.json()
        assert "files" in data
        assert isinstance(data["files"], list)

    def test_get_file_returns_content(self):
        resp = client.get("/project/file?path=auth.py")
        assert resp.status_code == 200
        data = resp.json()
        assert "content" in data
        assert len(data["content"]) > 0

    def test_get_file_path_traversal_blocked(self):
        resp = client.get("/project/file?path=../../backend/main.py")
        assert resp.status_code in [400, 404]


class TestOCR:
    def test_ocr_returns_200(self):
        resp = client.post("/ocr", json={"image_data": "test"})
        assert resp.status_code == 200

    def test_ocr_returns_text(self):
        resp = client.post("/ocr", json={})
        data = resp.json()
        assert "text" in data
        assert len(data["text"]) > 0


class TestVoice:
    def test_voice_query_returns_200(self):
        resp = client.post("/voice/query", json={"query": "Why is my API returning 401?"})
        assert resp.status_code == 200

    def test_voice_detects_auth_intent(self):
        resp = client.post("/voice/query", json={"query": "JWT token is failing with 401"})
        data = resp.json()
        assert data["detected_intent"] == "authentication_error"


class TestDemo:
    def test_load_demo_returns_200(self):
        resp = client.post("/demo/load")
        assert resp.status_code == 200

    def test_load_demo_returns_success(self):
        resp = client.post("/demo/load")
        data = resp.json()
        assert data["success"] is True

    def test_demo_status_returns_state(self):
        resp = client.get("/demo/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "state" in data
