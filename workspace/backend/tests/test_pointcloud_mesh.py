import struct

from app.services.pointcloud_mesh import build_voxel_glb


def test_build_voxel_glb_writes_valid_glb(tmp_path) -> None:
    preview = b"".join(
        struct.pack("<ffffff", x, y, z, 0.2 + x * 0.1, 0.5, 0.8)
        for x in (0.0, 0.2, 0.4)
        for y in (0.0, 0.2)
        for z in (0.0, 0.2)
    )
    output = tmp_path / "mesh.glb"

    result = build_voxel_glb(preview, output, max_voxels=100)

    payload = output.read_bytes()
    assert payload[:4] == b"glTF"
    assert struct.unpack_from("<I", payload, 4)[0] == 2
    assert struct.unpack_from("<I", payload, 8)[0] == len(payload)
    assert result["voxel_count"] > 0
    assert result["triangle_count"] > 0
