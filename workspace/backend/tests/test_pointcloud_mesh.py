import struct

import numpy as np

from app.services.pointcloud_mesh import _glb_bytes


def test_glb_bytes_writes_indexed_colored_mesh() -> None:
    positions = np.asarray([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ], dtype=np.float32)
    normals = np.asarray([[0.0, 0.0, 1.0]] * 3, dtype=np.float32)
    colors = np.asarray([
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ], dtype=np.float32)
    indices = np.asarray([[0, 1, 2]], dtype=np.uint32)

    payload = _glb_bytes(positions, normals, colors, indices)

    assert payload[:4] == b"glTF"
    assert struct.unpack_from("<I", payload, 4)[0] == 2
    assert struct.unpack_from("<I", payload, 8)[0] == len(payload)
