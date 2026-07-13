from fastapi.testclient import TestClient

from app.main import app
from app.settings import get_settings

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


def test_pointcloud_file_upload_creates_ready_asset() -> None:
    building = client.post("/api/buildings", json={"name": "PointCloud Parent"}).json()
    floor = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1}).json()

    response = client.post(
        "/api/uploads/file",
        data={"source_type": "pointcloud", "building_id": str(building["id"]), "floor_id": str(floor["id"])},
        files={"file": ("scan.ply", b"ply\nformat ascii 1.0\nend_header\n", "application/octet-stream")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source_type"] == "pointcloud"
    assert body["status"] == "ready"
    assert body["floor_id"] == floor["id"]
    assert "PointCloud object ready" in body["message"]


def test_pointcloud_file_upload_rejects_malformed_las() -> None:
    building = client.post("/api/buildings", json={"name": "Malformed PointCloud Parent"}).json()

    response = client.post(
        "/api/uploads/file",
        data={"source_type": "pointcloud", "building_id": str(building["id"])},
        files={"file": ("broken.las", b"not a las file", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid LAS pointcloud file"}


def test_pointcloud_file_upload_enforces_streamed_size_limit(monkeypatch) -> None:
    monkeypatch.setenv("UPLOAD_MAX_BYTES_POINTCLOUD", "8")
    get_settings.cache_clear()
    try:
        building = client.post("/api/buildings", json={"name": "PointCloud Limit Parent"}).json()
        response = client.post(
            "/api/uploads/file",
            data={"source_type": "pointcloud", "building_id": str(building["id"])},
            files={"file": ("too-large.ply", b"ply\nformat ascii 1.0\nend_header\n", "application/octet-stream")},
        )
    finally:
        get_settings.cache_clear()

    assert response.status_code == 413
    assert "Upload exceeds" in response.json()["detail"]


def test_file_upload_rejects_wrong_source_extension() -> None:
    building = client.post("/api/buildings", json={"name": "Extension Guard Parent"}).json()
    response = client.post(
        "/api/uploads/file",
        data={"source_type": "image", "building_id": str(building["id"])},
        files={"file": ("floor.exe", b"not an image", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert "Unsupported image file type" in response.json()["detail"]


def test_delete_upload_removes_asset_record() -> None:
    building = client.post("/api/buildings", json={"name": "Delete Upload Parent"}).json()
    upload = client.post(
        "/api/uploads/file",
        data={"source_type": "pointcloud", "building_id": str(building["id"])},
        files={"file": ("delete-me.ply", b"ply\nformat ascii 1.0\nend_header\n", "application/octet-stream")},
    ).json()

    delete_response = client.delete(f"/api/uploads/{upload['id']}")
    assert delete_response.status_code == 204

    list_response = client.get(f"/api/uploads/by-building/{building['id']}")
    assert list_response.status_code == 200
    assert all(asset["id"] != upload["id"] for asset in list_response.json())


def test_file_upload_rejects_floor_from_other_building() -> None:
    first = client.post("/api/buildings", json={"name": "File Upload A"}).json()
    second = client.post("/api/buildings", json={"name": "File Upload B"}).json()
    floor = client.post(f"/api/buildings/{first['id']}/floors", json={"floor_number": 1}).json()

    response = client.post(
        "/api/uploads/file",
        data={"source_type": "pointcloud", "building_id": str(second["id"]), "floor_id": str(floor["id"])},
        files={"file": ("scan.ply", b"ply\nformat ascii 1.0\nend_header\n", "application/octet-stream")},
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


def test_update_building_and_map_settings() -> None:
    building = client.post("/api/buildings", json={"name": "Map Parent"}).json()

    patch_response = client.patch(
        f"/api/buildings/{building['id']}",
        json={"origin_latitude": 37.5, "origin_longitude": 127.0},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["origin_latitude"] == 37.5

    map_response = client.put(
        f"/api/buildings/{building['id']}/map-settings",
        json={
            "origin_latitude": 37.501,
            "origin_longitude": 127.001,
            "osm_zoom": 17,
            "osm_scale": 2.5,
            "osm_opacity": 0.8,
        },
    )
    assert map_response.status_code == 200
    assert map_response.json()["saved"] is True
    assert map_response.json()["osm_zoom"] == 17

    get_response = client.get(f"/api/buildings/{building['id']}/map-settings")
    assert get_response.status_code == 200
    assert get_response.json()["origin_latitude"] == 37.501


def test_spatial_settings_round_trip() -> None:
    building = client.post("/api/buildings", json={"name": "Spatial Parent"}).json()
    floor = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1}).json()
    payload = {
        "apply_to_building": False,
        "alignment_local_points": {"origin": [0, 0, 0]},
        "alignment_gps_points": {"origin": [37.5, 127.0]},
        "glb_transform": {"position": [1, 2, 3]},
        "render_model_format": "glb",
        "alignment_transform_matrix": [[1, 0, 127], [0, 1, 37]],
        "alignment_rmse": 0.12,
    }

    building_response = client.put(f"/api/buildings/{building['id']}/spatial-settings", json=payload)
    assert building_response.status_code == 200
    assert building_response.json()["alignment_local_points"] == {"origin": [0, 0, 0]}
    assert building_response.json()["apply_to_building"] is False

    floor_response = client.put(f"/api/floors/{floor['id']}/spatial-settings", json=payload)
    assert floor_response.status_code == 200
    assert floor_response.json()["floor_id"] == floor["id"]
    assert floor_response.json()["glb_transform"] == {"position": [1, 2, 3]}


def test_gps_alignment_three_point_and_transform() -> None:
    building = client.post("/api/buildings", json={"name": "GPS Parent"}).json()
    response = client.post(
        "/api/gps-alignment/three-point",
        json={
            "building_id": building["id"],
            "points": [
                {"local": [0, 0], "gps": [37.0, 127.0]},
                {"local": [10, 0], "gps": [37.0, 127.001]},
                {"local": [0, 10], "gps": [37.001, 127.0]},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["building_id"] == building["id"]
    assert body["rmse"] < 1e-9
    assert body["accuracy"]["quality"] == "excellent"
    assert body["accuracy"]["point_count"] == 3

    transform_response = client.post(
        "/api/gps-alignment/transform-point",
        json={
            "building_id": building["id"],
            "local_point": [10, 10],
            "transform_matrix": body["transform_matrix"],
        },
    )
    assert transform_response.status_code == 200
    assert transform_response.json()["gps_point"] == [37.001, 127.001]

    batch_response = client.post(
        "/api/gps-alignment/batch-transform-point",
        json={
            "building_id": building["id"],
            "local_points": [[0, 0], [10, 10]],
            "transform_matrix": body["transform_matrix"],
        },
    )
    assert batch_response.status_code == 200
    assert batch_response.json()["gps_points"] == [[37.0, 127.0], [37.001, 127.001]]

    audit_response = client.get(f"/api/gps-alignment/buildings/{building['id']}/audit-logs")
    assert audit_response.status_code == 200
    audit_logs = audit_response.json()
    assert audit_logs[0]["action"] == "three-point-align"
    assert audit_logs[0]["accuracy"]["quality"] == "excellent"


def test_osm_tile_status_contract() -> None:
    response = client.get("/api/osm-tiles/status")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "OpenStreetMap"
    assert body["cache_enabled"] is True
    assert body["fallback_enabled"] is True


def test_project_data_assets_and_object_placements() -> None:
    building = client.post("/api/buildings", json={"name": "Project Data Parent"}).json()
    floor = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1}).json()
    upload = client.post(
        "/api/uploads",
        json={
            "filename": "floor-01.dwg",
            "source_type": "dwg",
            "building_id": building["id"],
            "floor_id": floor["id"],
        },
    ).json()

    image_asset = client.post(
        f"/api/buildings/{building['id']}/assets",
        json={
            "asset_type": "image",
            "name": "Floor plan image",
            "floor_id": floor["id"],
            "file_uri": "uploads/floor.png",
            "metadata": {"width": 1920, "height": 1080},
        },
    )
    assert image_asset.status_code == 201
    assert image_asset.json()["metadata"] == {"width": 1920, "height": 1080}

    model_asset = client.post(
        f"/api/buildings/{building['id']}/assets",
        json={
            "asset_type": "dwg",
            "name": "DWG source",
            "floor_id": floor["id"],
            "upload_asset_id": upload["id"],
            "metadata": {"unit": "meter"},
        },
    ).json()

    placement_response = client.post(
        f"/api/buildings/{building['id']}/object-placements",
        json={
            "object_type": "ifc_model",
            "name": "Main IFC shell",
            "floor_id": floor["id"],
            "source_asset_id": model_asset["id"],
            "position_x": 1.5,
            "position_y": 0.0,
            "position_z": -2.0,
            "rotation_y": 45.0,
            "scale_x": 1.2,
            "scale_y": 1.2,
            "scale_z": 1.2,
            "metadata": {"snap": "origin"},
        },
    )
    assert placement_response.status_code == 201
    placement = placement_response.json()
    assert placement["position_x"] == 1.5
    assert placement["metadata"] == {"snap": "origin"}

    device_response = client.post(
        f"/api/floors/{floor['id']}/devices",
        json={"name": "Lobby Camera", "device_type": "camera", "pos_x": 2.0, "pos_y": 3.0},
    )
    assert device_response.status_code == 201
    geometry_response = client.put(
        f"/api/floors/{floor['id']}/geometry",
        json={
            "walls": [{"x1": 0, "y1": 0, "x2": 5, "y2": 0}],
            "rooms": [{"name": "Lobby", "x": 0, "y": 0, "w": 5, "h": 4}],
        },
    )
    assert geometry_response.status_code == 200

    summary_response = client.get(f"/api/buildings/{building['id']}/project-data")
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["building"]["id"] == building["id"]
    assert summary["asset_counts"]["image"] == 1
    assert summary["asset_counts"]["dwg"] >= 1
    assert summary["asset_counts"]["object"] == 1
    assert summary["asset_counts"]["security_device"] == 1
    assert summary["object_placements"][0]["name"] == "Main IFC shell"

    project_summary_response = client.get(f"/api/buildings/{building['id']}/project-summary")
    assert project_summary_response.status_code == 200
    project_summary = project_summary_response.json()
    assert project_summary["building_id"] == building["id"]
    assert project_summary["floor_count"] == 1
    assert project_summary["source_count"] == 1
    assert project_summary["pointcloud_count"] == 0
    assert project_summary["device_count"] == 1
    assert project_summary["wall_count"] == 1
    assert project_summary["room_count"] == 1
    assert project_summary["geometry_count"] == 2
    assert project_summary["asset_counts"]["security_device"] == 1


def test_object_placement_sync_replaces_scoped_editor_devices() -> None:
    building = client.post("/api/buildings", json={"name": "Placement Sync Parent"}).json()
    floor = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1}).json()

    first = client.put(
        f"/api/buildings/{building['id']}/object-placements/sync",
        json={
            "metadata_scope_key": "editor_source",
            "metadata_scope_value": "editor-device",
            "placements": [
                {
                    "object_type": "security_device",
                    "name": "Camera A",
                    "floor_id": floor["id"],
                    "position_x": 1,
                    "position_z": 2,
                    "metadata": {"editor_source": "editor-device", "editor_id": "cam-a"},
                }
            ],
        },
    )
    assert first.status_code == 200
    assert len(first.json()) == 1

    second = client.put(
        f"/api/buildings/{building['id']}/object-placements/sync",
        json={
            "metadata_scope_key": "editor_source",
            "metadata_scope_value": "editor-device",
            "placements": [
                {
                    "object_type": "security_device",
                    "name": "Sensor B",
                    "floor_id": floor["id"],
                    "position_x": 4,
                    "position_z": 5,
                    "metadata": {"editor_source": "editor-device", "editor_id": "sensor-b"},
                }
            ],
        },
    )
    assert second.status_code == 200
    synced = second.json()
    assert len(synced) == 1
    assert synced[0]["name"] == "Sensor B"

    placements = client.get(f"/api/buildings/{building['id']}/object-placements").json()
    assert [placement["name"] for placement in placements] == ["Sensor B"]


def test_object_placement_sync_can_be_limited_to_floor() -> None:
    building = client.post("/api/buildings", json={"name": "Placement Floor Scope Parent"}).json()
    first_floor = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1}).json()
    second_floor = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 2}).json()

    first_sync = client.put(
        f"/api/buildings/{building['id']}/object-placements/sync",
        json={
            "metadata_scope_key": "editor_source",
            "metadata_scope_value": "editor-device",
            "floor_id": first_floor["id"],
            "placements": [
                {
                    "object_type": "security_device",
                    "name": "First Floor Camera",
                    "floor_id": first_floor["id"],
                    "metadata": {"editor_source": "editor-device", "editor_id": "first"},
                }
            ],
        },
    )
    assert first_sync.status_code == 200

    second_sync = client.put(
        f"/api/buildings/{building['id']}/object-placements/sync",
        json={
            "metadata_scope_key": "editor_source",
            "metadata_scope_value": "editor-device",
            "floor_id": second_floor["id"],
            "placements": [
                {
                    "object_type": "security_device",
                    "name": "Second Floor Sensor",
                    "floor_id": second_floor["id"],
                    "metadata": {"editor_source": "editor-device", "editor_id": "second"},
                }
            ],
        },
    )
    assert second_sync.status_code == 200

    placements = client.get(f"/api/buildings/{building['id']}/object-placements").json()
    assert {placement["name"] for placement in placements} == {"First Floor Camera", "Second Floor Sensor"}


def test_project_asset_rejects_floor_from_other_building() -> None:
    first = client.post("/api/buildings", json={"name": "Asset Scope A"}).json()
    second = client.post("/api/buildings", json={"name": "Asset Scope B"}).json()
    floor = client.post(f"/api/buildings/{first['id']}/floors", json={"floor_number": 1}).json()

    response = client.post(
        f"/api/buildings/{second['id']}/assets",
        json={"asset_type": "ifc", "name": "Wrong floor asset", "floor_id": floor["id"]},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Floor does not belong to building"}


def test_project_snapshot_round_trip() -> None:
    building = client.post("/api/buildings", json={"name": "Snapshot Parent"}).json()

    empty_response = client.get(f"/api/buildings/{building['id']}/project-snapshot")
    assert empty_response.status_code == 200
    assert empty_response.json()["saved"] is False
    assert empty_response.json()["state"] == {}

    payload = {
        "version": 2,
        "state": {
            "selectedFloorId": 10,
            "editor": {"view": "pointcloud", "deviceCount": 4},
            "alignment": {"origin": [37.462, 127.037]},
        },
    }
    save_response = client.put(f"/api/buildings/{building['id']}/project-snapshot", json=payload)
    assert save_response.status_code == 200
    assert save_response.json()["saved"] is True
    assert save_response.json()["version"] == 2

    load_response = client.get(f"/api/buildings/{building['id']}/project-snapshot")
    assert load_response.status_code == 200
    assert load_response.json()["state"] == payload["state"]


def test_upload_pipeline_status_updates_linked_project_asset() -> None:
    building = client.post("/api/buildings", json={"name": "Pipeline Parent"}).json()
    floor = client.post(f"/api/buildings/{building['id']}/floors", json={"floor_number": 1}).json()
    upload = client.post(
        "/api/uploads/file",
        data={"source_type": "ifc", "building_id": str(building["id"]), "floor_id": str(floor["id"])},
        files={"file": ("model.ifc", b"ISO-10303-21;", "application/octet-stream")},
    ).json()

    pipeline_response = client.get(f"/api/uploads/{upload['id']}/pipeline")
    assert pipeline_response.status_code == 200
    pipeline = pipeline_response.json()
    assert pipeline["upload"]["status"] == "ready"
    assert pipeline["current_stage"] == "BIM extraction"
    assert pipeline["progress"] == 100
    assert "floor separation metadata" in pipeline["details"]["derived_outputs"]
    assert pipeline["details"]["persistent_file_uri"] == upload["file_url"]
    assert any(record["kind"] == "floor-separation" for record in pipeline["details"]["derivative_records"])
    assert pipeline["project_assets"][0]["asset_type"] == "ifc"
    assert pipeline["project_assets"][0]["status"] == "ready"
    assert pipeline["project_assets"][0]["metadata"]["pipeline_stage"] == "BIM extraction"
    assert pipeline["project_assets"][0]["metadata"]["derivative_records"]

    failed_response = client.patch(
        f"/api/uploads/{upload['id']}/status",
        json={"status": "failed", "message": "IFC parser failed"},
    )
    assert failed_response.status_code == 200
    failed_pipeline = failed_response.json()
    assert failed_pipeline["upload"]["status"] == "failed"
    assert failed_pipeline["project_assets"][0]["status"] == "failed"
    assert failed_pipeline["details"]["failure_reason"] == "IFC parser failed"
    assert "Allow retry" in " ".join(failed_pipeline["next_actions"])


def test_backend_export_dxf_and_package() -> None:
    payload = {
        "walls": [{"x1": 0, "y1": 0, "x2": 5, "y2": 0}],
        "rooms": [{"x": 0, "y": 0, "w": 5, "h": 4, "label": "Lobby"}],
        "devices": [{"id": "cam-1", "x": 2, "y": 1, "device_type": "camera", "name": "Lobby Camera"}],
    }

    dxf_response = client.post("/api/exports/dxf", json=payload)
    assert dxf_response.status_code == 200
    assert "SECTION" in dxf_response.text
    assert "DEVICE_CAMERA" in dxf_response.text

    package_response = client.post("/api/exports/package", json=payload)
    assert package_response.status_code == 200
    body = package_response.json()
    assert body["summary"] == {"walls": 1, "rooms": 1, "devices": 1}
    assert body["devices"][0]["name"] == "Lobby Camera"


def test_realtime_websocket_connects() -> None:
    with client.websocket_connect("/api/realtime/ws") as websocket:
        message = websocket.receive_json()
        assert message["source"] == "system"
        assert message["severity"] == "info"
