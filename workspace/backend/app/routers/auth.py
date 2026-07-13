from fastapi import APIRouter, HTTPException, Request, status

from app.auth_sessions import create_session, get_session
from app.schemas import LoginRequest, LoginResponse, MeResponse
from app.security import token_from_request

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEMO_USERS = {
    "admin": {"password": "admin123", "role": "admin"},
    "manager": {"password": "manager123", "role": "manager"},
    "editor": {"password": "editor123", "role": "editor"},
    "viewer": {"password": "viewer123", "role": "viewer"},
}


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    user = DEMO_USERS.get(payload.username)
    if user is None or user["password"] != payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role = user["role"]
    return LoginResponse(
        access_token=create_session(payload.username, role),  # type: ignore[arg-type]
        username=payload.username,
        role=role,  # type: ignore[arg-type]
    )


@router.get("/me", response_model=MeResponse)
def me(request: Request) -> MeResponse:
    session = get_session(token_from_request(request))
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API token")
    return MeResponse(username=session.username, role=session.role)
