"""Integration tests for Wall and Room CRUD via geometry router."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_wall_crud() -> None:
    # Setup: building + floor
    r = client.post("/api/buildings", json={"name": "GeoTest", "total_floors": 5})
    assert r.status_code == 201
    b = r.json()

    r = client.post(f"/api/buildings/{b['id']}/floors", json={"floor_number": 1})
    assert r.status_code == 201
    f = r.json()

    # List (empty)
    r = client.get(f"/api/floors/{f['id']}/walls")
    assert r.status_code == 200 and r.json() == []

    # Create
    r = client.post(f"/api/floors/{f['id']}/walls", json={"x1": 0, "y1": 0, "x2": 10, "y2": 0})
    assert r.status_code == 201
    w = r.json()
    assert w["x1"] == 0 and w["x2"] == 10
    assert w["floor_id"] == f["id"]

    # Update
    r = client.put(f"/api/walls/{w['id']}", json={"x2": 15})
    assert r.status_code == 200
    assert r.json()["x2"] == 15

    # List (1 item)
    r = client.get(f"/api/floors/{f['id']}/walls")
    assert len(r.json()) == 1

    # Delete
    r = client.delete(f"/api/walls/{w['id']}")
    assert r.status_code == 204

    # Confirm empty
    r = client.get(f"/api/floors/{f['id']}/walls")
    assert r.json() == []

    # Non-existent wall
    r = client.get(f"/api/floors/{f['id']}/walls")
    assert r.status_code == 200


def test_room_crud() -> None:
    # Setup: building + floor
    r = client.post("/api/buildings", json={"name": "RoomTest", "total_floors": 3})
    assert r.status_code == 201
    b = r.json()

    r = client.post(f"/api/buildings/{b['id']}/floors", json={"floor_number": 1})
    assert r.status_code == 201
    f = r.json()

    # Create
    r = client.post(f"/api/floors/{f['id']}/rooms", json={"name": "Office", "x": 1, "y": 2, "w": 5, "h": 4})
    assert r.status_code == 201
    rm = r.json()
    assert rm["name"] == "Office"
    assert rm["floor_id"] == f["id"]

    # List
    r = client.get(f"/api/floors/{f['id']}/rooms")
    assert len(r.json()) == 1

    # Partial update
    r = client.put(f"/api/rooms/{rm['id']}", json={"name": "Renamed"})
    assert r.json()["name"] == "Renamed"

    # Delete
    r = client.delete(f"/api/rooms/{rm['id']}")
    assert r.status_code == 204

    # Confirm empty
    r = client.get(f"/api/floors/{f['id']}/rooms")
    assert r.json() == []


def test_door_crud() -> None:
    r = client.post("/api/buildings", json={"name": "DoorTest", "total_floors": 2})
    assert r.status_code == 201
    building = r.json()

    r = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1})
    assert r.status_code == 201
    floor = r.json()

    r = client.get(f"/api/floors/{floor['id']}/doors")
    assert r.status_code == 200
    assert r.json() == []

    r = client.post(
        f"/api/floors/{floor['id']}/doors",
        json={"x": 3, "y": 0, "width": 1.1, "rotation_degrees": 90, "door_type": "sliding"},
    )
    assert r.status_code == 201
    door = r.json()
    assert door["floor_id"] == floor["id"]
    assert door["door_type"] == "sliding"

    r = client.put(f"/api/doors/{door['id']}", json={"width": 1.4})
    assert r.status_code == 200
    assert r.json()["width"] == 1.4

    r = client.delete(f"/api/doors/{door['id']}")
    assert r.status_code == 204
    assert client.get(f"/api/floors/{floor['id']}/doors").json() == []


def test_window_crud() -> None:
    r = client.post("/api/buildings", json={"name": "WindowTest", "total_floors": 2})
    assert r.status_code == 201
    building = r.json()

    r = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1})
    assert r.status_code == 201
    floor = r.json()

    r = client.post(
        f"/api/floors/{floor['id']}/windows",
        json={"x": 4, "y": 0, "width": 1.5, "rotation_degrees": 0, "window_type": "casement"},
    )
    assert r.status_code == 201
    window = r.json()
    assert window["floor_id"] == floor["id"]
    assert window["sill_height_meters"] == 0.9

    r = client.put(f"/api/windows/{window['id']}", json={"sill_height_meters": 1.1})
    assert r.status_code == 200
    assert r.json()["sill_height_meters"] == 1.1

    r = client.get(f"/api/floors/{floor['id']}/windows")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = client.delete(f"/api/windows/{window['id']}")
    assert r.status_code == 204
    assert client.get(f"/api/floors/{floor['id']}/windows").json() == []


def test_wall_requires_existing_floor() -> None:
    r = client.post("/api/floors/999999/walls", json={"x1": 0, "y1": 0, "x2": 1, "y2": 0})
    assert r.status_code == 404


def test_room_requires_existing_floor() -> None:
    r = client.post("/api/floors/999999/rooms", json={"name": "X", "x": 0, "y": 0, "w": 1, "h": 1})
    assert r.status_code == 404


def test_door_and_window_require_existing_floor() -> None:
    r = client.post("/api/floors/999999/doors", json={"x": 0, "y": 0})
    assert r.status_code == 404

    r = client.post("/api/floors/999999/windows", json={"x": 0, "y": 0})
    assert r.status_code == 404
