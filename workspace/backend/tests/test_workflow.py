from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_default_workflow() -> None:
    response = client.get("/api/workflow/1")
    assert response.status_code == 200
    assert response.json() == {"building_id": 1, "current_step": "projects", "completed_steps": []}
