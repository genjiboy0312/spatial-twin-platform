from dataclasses import dataclass
from secrets import token_urlsafe
from typing import Literal

from app.settings import get_settings

UserRole = Literal["admin", "manager", "editor", "viewer"]


@dataclass(frozen=True)
class AuthSession:
    username: str
    role: UserRole


_SESSIONS: dict[str, AuthSession] = {}


def create_session(username: str, role: UserRole) -> str:
    token = token_urlsafe(32)
    _SESSIONS[token] = AuthSession(username=username, role=role)
    return token


def get_session(token: str | None) -> AuthSession | None:
    if token is None:
        return None
    session = _SESSIONS.get(token)
    if session is not None:
        return session
    if token == get_settings().api_access_token:
        return AuthSession(username="admin", role="admin")
    return None


def is_valid_token(token: str | None) -> bool:
    return get_session(token) is not None
