import jwt
import os
from datetime import datetime, timedelta
from typing import Optional

SECRET_KEY = os.environ.get("SECRET_KEY", "codelens-demo-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary of claims to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def validate_token(token: str) -> dict:
    """
    Validate a JWT token and return its payload.

    This function checks if the token signature is valid and if it has not expired.

    Args:
        token: JWT token string to validate

    Returns:
        Decoded payload dictionary

    Raises:
        Exception: If token is invalid or expired
    """
    try:
        # Decode without expiry verification first to get the payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})

        # BUG: datetime.now().timestamp() returns seconds since epoch.
        # Multiplying by 1000 converts to milliseconds.
        # payload['exp'] is in seconds. So we compare milliseconds > seconds,
        # which is ALWAYS True (ms value ~1000x larger), causing every token
        # to appear expired immediately after creation.
        if datetime.now().timestamp() * 1000 > payload['exp']:

            raise Exception("Token is expired")

        return payload
    except jwt.InvalidTokenError as e:
        raise Exception(f"Invalid token: {e}")


def get_current_user(token: str) -> dict:
    """
    Get the current authenticated user from a JWT token.

    Args:
        token: JWT token string

    Returns:
        User data from token payload
    """
    payload = validate_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise Exception("Token missing subject claim")
    return {"id": user_id, "username": payload.get("username", ""), "role": payload.get("role", "user")}
