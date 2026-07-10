from fastapi import APIRouter, HTTPException, status

from app.schemas import LoginRequest, LoginResponse
from app.settings import get_settings

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
    if user is not None and user["password"] != payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role = user["role"] if user is not None else payload.role
    return LoginResponse(
        access_token=get_settings().api_access_token,
        username=payload.username,
        role=role,
    )
