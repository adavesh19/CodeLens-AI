"""
Demo Project Tests - CodeLens AI Hackathon Demo

These tests verify the JWT authentication service.
Initially they FAIL because of the milliseconds bug in auth.py.
After CodeLens applies the fix, ALL tests PASS.

The bug: validate_token() compares datetime.now().timestamp() > payload['exp'] * 1000
This multiplies the Unix epoch seconds by 1000, treating it as milliseconds,
causing ALL valid tokens to appear expired immediately.

The fix: Remove '* 1000' so the comparison is correct.
"""

import pytest
import jwt as pyjwt
import sys
import os
from datetime import datetime, timedelta

# Add demo-project to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth import create_access_token, validate_token, get_current_user, SECRET_KEY, ALGORITHM


class TestTokenCreation:
    """Tests for JWT token creation."""

    def test_create_token_returns_string(self):
        """Token creation should return a non-empty string."""
        token = create_access_token({"sub": "user1", "username": "alice"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_token_has_three_parts(self):
        """JWT tokens should have exactly 3 parts separated by dots."""
        token = create_access_token({"sub": "user1"})
        parts = token.split(".")
        assert len(parts) == 3

    def test_create_token_with_custom_expiry(self):
        """Token with custom expiry should encode correctly."""
        token = create_access_token(
            {"sub": "user1"},
            expires_delta=timedelta(hours=1)
        )
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "user1"
        assert "exp" in payload


class TestTokenValidation:
    """Tests for JWT token validation - these FAIL before the fix."""

    def test_validate_fresh_token_succeeds(self):
        """A freshly created token should pass validation without errors."""
        token = create_access_token({"sub": "user1", "username": "alice", "role": "admin"})
        # This FAILS before fix: exp * 1000 makes token appear expired
        payload = validate_token(token)
        assert payload["sub"] == "user1"

    def test_validate_token_returns_correct_claims(self):
        """Validated token should contain the original claims."""
        token = create_access_token({"sub": "user42", "username": "bob", "role": "user"})
        # This FAILS before fix
        payload = validate_token(token)
        assert payload["username"] == "bob"
        assert payload["role"] == "user"

    def test_validate_token_with_30min_expiry(self):
        """Token with 30 minute expiry should be valid immediately after creation."""
        token = create_access_token(
            {"sub": "user1"},
            expires_delta=timedelta(minutes=30)
        )
        # This FAILS before fix: 30 minutes from now in seconds * 1000 > now in seconds
        payload = validate_token(token)
        assert "sub" in payload
        assert "exp" in payload

    def test_validate_token_wrong_secret_fails(self):
        """Token signed with wrong secret should be rejected."""
        import jwt
        bad_token = jwt.encode(
            {"sub": "hacker", "exp": datetime.utcnow() + timedelta(hours=1)},
            "wrong-secret",
            algorithm=ALGORITHM
        )
        with pytest.raises(Exception):
            validate_token(bad_token)

    def test_validate_expired_token_fails(self):
        """Token with past expiry should be rejected."""
        import jwt
        expired_token = jwt.encode(
            {"sub": "user1", "exp": datetime.utcnow() - timedelta(hours=1)},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        with pytest.raises(Exception):
            validate_token(expired_token)


class TestGetCurrentUser:
    """Tests for get_current_user helper - these FAIL before the fix."""

    def test_get_user_from_valid_token(self):
        """Should extract user data from valid token."""
        token = create_access_token({"sub": "user1", "username": "alice", "role": "admin"})
        # This FAILS before fix
        user = get_current_user(token)
        assert user["id"] == "user1"
        assert user["username"] == "alice"
        assert user["role"] == "admin"

    def test_get_user_default_role(self):
        """User without role claim should default to 'user'."""
        token = create_access_token({"sub": "user2", "username": "charlie"})
        # This FAILS before fix
        user = get_current_user(token)
        assert user["role"] == "user"

    def test_get_user_missing_sub_fails(self):
        """Token without 'sub' claim should raise exception."""
        import jwt
        bad_token = jwt.encode(
            {"username": "alice", "exp": datetime.utcnow() + timedelta(minutes=30)},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        # This MIGHT fail before fix for different reason (expires first)
        with pytest.raises(Exception):
            get_current_user(bad_token)
