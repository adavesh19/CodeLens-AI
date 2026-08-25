import os
import time
from fastapi import APIRouter

router = APIRouter(tags=["demo"])

DEMO_PROJECT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "demo-project")
)

# Buggy auth.py content split to avoid issues embedding the bug string
_BUG_LINE = "        if datetime.now().timestamp() * 1000 > payload['exp']:"
_BUG_COMMENT = """        # BUG: datetime.now().timestamp() returns seconds since epoch.
        # Multiplying by 1000 converts to milliseconds.
        # payload['exp'] is in seconds. So we compare milliseconds > seconds,
        # which is ALWAYS True (ms value ~1000x larger), causing every token
        # to appear expired immediately after creation."""

BUGGY_AUTH_PREAMBLE = """import jwt
import os
from datetime import datetime, timedelta
from typing import Optional

SECRET_KEY = os.environ.get("SECRET_KEY", "codelens-demo-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    \"\"\"
    Create a JWT access token.

    Args:
        data: Dictionary of claims to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT string
    \"\"\"
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def validate_token(token: str) -> dict:
    \"\"\"
    Validate a JWT token and return its payload.

    This function checks if the token signature is valid and if it has not expired.

    Args:
        token: JWT token string to validate

    Returns:
        Decoded payload dictionary

    Raises:
        Exception: If token is invalid or expired
    \"\"\"
    try:
        # Decode without expiry verification first to get the payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})

"""

BUGGY_AUTH_SUFFIX = """
            raise Exception("Token is expired")

        return payload
    except jwt.InvalidTokenError as e:
        raise Exception(f"Invalid token: {e}")


def get_current_user(token: str) -> dict:
    \"\"\"
    Get the current authenticated user from a JWT token.

    Args:
        token: JWT token string

    Returns:
        User data from token payload
    \"\"\"
    payload = validate_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise Exception("Token missing subject claim")
    return {"id": user_id, "username": payload.get("username", ""), "role": payload.get("role", "user")}
"""


def _build_buggy_auth() -> str:
    return (
        BUGGY_AUTH_PREAMBLE
        + _BUG_COMMENT + "\n"
        + _BUG_LINE + "\n"
        + BUGGY_AUTH_SUFFIX
    )


@router.post("/demo/load")
async def load_demo():
    """
    Reset the demo project to its intentionally broken state.
    This enables repeatable hackathon demonstrations.
    Fast and lightweight - only resets auth.py.
    """
    t0 = time.perf_counter()
    print("[JUDGE DEMO] reset started")
    auth_file = os.path.join(DEMO_PROJECT_DIR, "auth.py")
    buggy_content = _build_buggy_auth()

    with open(auth_file, "w", encoding="utf-8") as f:
        f.write(buggy_content)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"[JUDGE DEMO] reset completed: {elapsed_ms:.1f}ms")

    return {
        "success": True,
        "scenario": "JWT Authentication Bug - Milliseconds vs Seconds",
        "description": "auth.py has been reset to the buggy state. The JWT expiration check multiplies current timestamp by 1000 (converting to ms) before comparing against exp (which is in seconds), so all tokens appear expired.",
        "error_preview": "HTTP 401 Unauthorized\nJWT validation failed: Token appears expired\nauth.py:52",
        "affected_file": "auth.py",
        "bug_line": 52,
        "bug_description": "datetime.now().timestamp() * 1000 > payload['exp'] — always True",
        "duration_ms": round(elapsed_ms, 2)
    }


@router.get("/demo/status")
async def demo_status():
    """Check whether the demo is in broken or fixed state."""
    auth_file = os.path.join(DEMO_PROJECT_DIR, "auth.py")
    if not os.path.exists(auth_file):
        return {"state": "unknown", "file_exists": False}

    with open(auth_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Check for the bug marker
    is_buggy = ("timestamp() * 1000" in content) or ("* 1000 >" in content)
    return {
        "state": "buggy" if is_buggy else "fixed",
        "file_exists": True,
        "has_bug": is_buggy
    }
