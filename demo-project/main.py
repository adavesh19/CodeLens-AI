from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from auth import create_access_token, get_current_user
from datetime import timedelta

app = FastAPI(title="Demo Auth Service", version="1.0.0")
security = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    username: str


# Fake user database
USERS_DB = {
    "alice": {"password": "secret123", "role": "admin"},
    "bob": {"password": "password456", "role": "user"},
    "demo": {"password": "demo", "role": "user"},
}


@app.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Authenticate user and return JWT token."""
    user = USERS_DB.get(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    token = create_access_token(
        data={"sub": body.username, "username": body.username, "role": user["role"]},
        expires_delta=timedelta(minutes=30)
    )
    return LoginResponse(access_token=token, token_type="bearer", username=body.username)


@app.get("/protected/profile")
async def get_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user profile. Requires valid JWT."""
    try:
        user = get_current_user(credentials.credentials)
        return {"user": user, "message": "Profile retrieved successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


@app.get("/protected/dashboard")
async def get_dashboard(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get dashboard data. Requires valid JWT."""
    try:
        user = get_current_user(credentials.credentials)
        return {
            "user": user,
            "data": {
                "total_requests": 1247,
                "active_sessions": 3,
                "last_login": "2026-08-25T10:30:00Z"
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Demo Auth Service"}
