from fastapi.testclient import TestClient

from app.main import app
from app.settings import get_settings


def test_login_returns_configured_api_token() -> None:
    client = TestClient(app)
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123", "role": "admin"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["username"] == "admin"
    assert body["role"] == "admin"
    assert body["access_token"]
    assert body["access_token"] != get_settings().api_access_token


def test_login_rejects_unknown_or_wrong_password() -> None:
    client = TestClient(app)

    unknown = client.post("/api/auth/login", json={"username": "guest", "password": "guest123", "role": "viewer"})
    wrong_password = client.post("/api/auth/login", json={"username": "admin", "password": "wrong", "role": "admin"})

    assert unknown.status_code == 401
    assert wrong_password.status_code == 401


def test_me_returns_authenticated_session() -> None:
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"username": "editor", "password": "editor123", "role": "editor"})
    token = login.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {"username": "editor", "role": "editor"}


def test_api_token_guard_blocks_protected_api_when_enabled(monkeypatch) -> None:
    monkeypatch.setenv("API_AUTH_ENABLED", "true")
    monkeypatch.setenv("API_ACCESS_TOKEN", "test-token")
    get_settings.cache_clear()
    client = TestClient(app)

    blocked = client.get("/api/buildings")
    assert blocked.status_code == 401

    static_token_allowed = client.get("/api/buildings", headers={"Authorization": "Bearer test-token"})
    assert static_token_allowed.status_code == 200

    login = client.post("/api/auth/login", json={"username": "viewer", "password": "viewer123", "role": "viewer"})
    session_token_allowed = client.get("/api/buildings", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert session_token_allowed.status_code == 200

    get_settings.cache_clear()
