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
    assert body["access_token"] == get_settings().api_access_token


def test_api_token_guard_blocks_protected_api_when_enabled(monkeypatch) -> None:
    monkeypatch.setenv("API_AUTH_ENABLED", "true")
    monkeypatch.setenv("API_ACCESS_TOKEN", "test-token")
    get_settings.cache_clear()
    client = TestClient(app)

    blocked = client.get("/api/buildings")
    assert blocked.status_code == 401

    allowed = client.get("/api/buildings", headers={"Authorization": "Bearer test-token"})
    assert allowed.status_code == 200

    get_settings.cache_clear()
