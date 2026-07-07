from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_and_list_building() -> None:
    response = client.post(
        "/api/buildings",
        json={"name": "HQ", "address": "Seoul", "origin_longitude": 127.0276, "origin_latitude": 37.4979},
    )
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "HQ"

    list_response = client.get("/api/buildings")
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == created["id"]


def test_create_floor_requires_existing_building() -> None:
    response = client.post("/api/buildings/404/floors", json={"floor_number": 1})
    assert response.status_code == 404
    assert response.json() == {"detail": "Building not found"}


def test_create_floor_for_building() -> None:
    building_response = client.post("/api/buildings", json={"name": "Floor Parent"})
    building_id = building_response.json()["id"]

    floor_response = client.post(f"/api/buildings/{building_id}/floors", json={"floor_number": 2, "floor_name": "2F"})
    assert floor_response.status_code == 201
    assert floor_response.json()["building_id"] == building_id


def test_upload_rejects_missing_building() -> None:
    response = client.post("/api/uploads", json={"filename": "floor.dxf", "source_type": "dxf", "building_id": 404})
    assert response.status_code == 404
    assert response.json() == {"detail": "Building not found"}


def test_upload_rejects_floor_from_other_building() -> None:
    first = client.post("/api/buildings", json={"name": "Upload A"}).json()
    second = client.post("/api/buildings", json={"name": "Upload B"}).json()
    floor = client.post(f"/api/buildings/{first['id']}/floors", json={"floor_number": 1}).json()

    response = client.post(
        "/api/uploads",
        json={"filename": "floor.dxf", "source_type": "dxf", "building_id": second["id"], "floor_id": floor["id"]},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Floor does not belong to building"}


def test_workflow_update_requires_existing_building() -> None:
    response = client.patch("/api/workflow/404", json={"current_step": "editor"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Building not found"}


def test_workflow_update_for_existing_building() -> None:
    building = client.post("/api/buildings", json={"name": "Workflow Parent"}).json()

    response = client.patch(
        f"/api/workflow/{building['id']}",
        json={"current_step": "editor", "completed_steps": ["projects", "data-sources"]},
    )
    assert response.status_code == 200
    assert response.json() == {
        "building_id": building["id"],
        "current_step": "editor",
        "completed_steps": ["projects", "data-sources"],
    }
