"""
Integration tests for the Demo Auth API.
These tests verify the full HTTP API behaviour.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from auth import create_access_token

client = TestClient(app)


class TestHealthEndpoint:
    """Health check tests."""

    def test_health_returns_ok(self):
        """Health endpoint should return 200 with status ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


class TestLoginEndpoint:
    """Login endpoint tests."""

    def test_login_valid_credentials(self):
        """Valid credentials should return a JWT token."""
        resp = client.post("/auth/login", json={"username": "alice", "password": "secret123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["username"] == "alice"

    def test_login_invalid_password(self):
        """Wrong password should return 401."""
        resp = client.post("/auth/login", json={"username": "alice", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_unknown_user(self):
        """Unknown user should return 401."""
        resp = client.post("/auth/login", json={"username": "nobody", "password": "pass"})
        assert resp.status_code == 401


class TestProtectedEndpoints:
    """Protected endpoint tests - these FAIL before the fix."""

    def test_profile_with_valid_token(self):
        """Profile endpoint should succeed with valid token."""
        # First login to get token
        login_resp = client.post("/auth/login", json={"username": "alice", "password": "secret123"})
        token = login_resp.json()["access_token"]

        # Then access protected endpoint
        # This FAILS before fix because validate_token raises "Token is expired"
        resp = client.get("/protected/profile", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["id"] == "alice"

    def test_dashboard_with_valid_token(self):
        """Dashboard endpoint should succeed with valid token."""
        login_resp = client.post("/auth/login", json={"username": "bob", "password": "password456"})
        token = login_resp.json()["access_token"]

        # This FAILS before fix
        resp = client.get("/protected/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total_requests" in data["data"]

    def test_profile_without_token(self):
        """Profile without token should return 403."""
        resp = client.get("/protected/profile")
        assert resp.status_code == 403

    def test_profile_with_invalid_token(self):
        """Profile with garbage token should return 401."""
        resp = client.get("/protected/profile", headers={"Authorization": "Bearer garbage.token.here"})
        assert resp.status_code == 401

    def test_full_auth_flow(self):
        """Complete login + access flow should work end-to-end."""
        # Login
        login_resp = client.post("/auth/login", json={"username": "demo", "password": "demo"})
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        # Access profile - FAILS before fix
        profile_resp = client.get("/protected/profile", headers={"Authorization": f"Bearer {token}"})
        assert profile_resp.status_code == 200

        # Access dashboard - FAILS before fix
        dash_resp = client.get("/protected/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert dash_resp.status_code == 200
