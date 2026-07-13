import json
import math
import struct
from pathlib import Path


FACE_DEFINITIONS = (
    ((1, 0, 0), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))),
    ((-1, 0, 0), ((0, 0, 1), (0, 1, 1), (0, 1, 0), (0, 0, 0))),
    ((0, 1, 0), ((0, 1, 1), (1, 1, 1), (1, 1, 0), (0, 1, 0))),
    ((0, -1, 0), ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))),
    ((0, 0, 1), ((1, 0, 1), (1, 1, 1), (0, 1, 1), (0, 0, 1))),
    ((0, 0, -1), ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0))),
)


def _align4(payload: bytes, pad: bytes = b"\x00") -> bytes:
    return payload + pad * ((4 - len(payload) % 4) % 4)


def _pack_floats(values: list[float]) -> bytes:
    return struct.pack(f"<{len(values)}f", *values)


def _pack_uints(values: list[int]) -> bytes:
    return struct.pack(f"<{len(values)}I", *values)


def _glb_bytes(positions: list[float], normals: list[float], colors: list[float], indices: list[int]) -> bytes:
    payloads = [_pack_floats(positions), _pack_floats(normals), _pack_floats(colors), _pack_uints(indices)]
    offsets: list[int] = []
    binary = bytearray()
    for payload in payloads:
        offsets.append(len(binary))
        binary.extend(_align4(payload))

    xs = positions[0::3]
    ys = positions[1::3]
    zs = positions[2::3]
    document = {
        "asset": {"version": "2.0", "generator": "Spatial Twin voxel mesh"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "PointCloud Mesh"}],
        "meshes": [{"primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
            "indices": 3,
            "material": 0,
        }]}],
        "materials": [{
            "name": "PointCloud RGB",
            "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 0.82},
            "doubleSided": False,
        }],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(payloads[0]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(payloads[1]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(payloads[2]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(payloads[3]), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(positions) // 3, "type": "VEC3", "min": [min(xs), min(ys), min(zs)], "max": [max(xs), max(ys), max(zs)]},
            {"bufferView": 1, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(colors) // 3, "type": "VEC3"},
            {"bufferView": 3, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
    }
    json_chunk = _align4(json.dumps(document, separators=(",", ":")).encode(), b" ")
    binary_chunk = _align4(bytes(binary))
    total_length = 12 + 8 + len(json_chunk) + 8 + len(binary_chunk)
    return b"".join((
        struct.pack("<4sII", b"glTF", 2, total_length),
        struct.pack("<I4s", len(json_chunk), b"JSON"), json_chunk,
        struct.pack("<I4s", len(binary_chunk), b"BIN\x00"), binary_chunk,
    ))


def build_voxel_glb(preview_payload: bytes, output_path: Path, max_voxels: int = 12_000) -> dict[str, int | float]:
    points = [values for values in struct.iter_unpack("<ffffff", preview_payload)]
    if not points:
        raise ValueError("PointCloud has no points")

    mins = [min(point[axis] for point in points) for axis in range(3)]
    maxs = [max(point[axis] for point in points) for axis in range(3)]
    span = max(maxs[axis] - mins[axis] for axis in range(3))
    voxel_size = max(span / 72, 0.025)

    voxels: dict[tuple[int, int, int], list[float]] = {}
    while True:
        voxels.clear()
        for x, y, z, red, green, blue in points:
            key = (math.floor(x / voxel_size), math.floor(y / voxel_size), math.floor(z / voxel_size))
            bucket = voxels.setdefault(key, [0.0] * 7)
            bucket[0] += x
            bucket[1] += y
            bucket[2] += z
            bucket[3] += red
            bucket[4] += green
            bucket[5] += blue
            bucket[6] += 1
        if len(voxels) <= max_voxels:
            break
        voxel_size *= 1.22

    positions: list[float] = []
    normals: list[float] = []
    colors: list[float] = []
    indices: list[int] = []
    half = voxel_size * 0.52
    occupied = set(voxels)
    for key, bucket in voxels.items():
        count = bucket[6]
        center = (bucket[0] / count, bucket[1] / count, bucket[2] / count)
        color = (bucket[3] / count, bucket[4] / count, bucket[5] / count)
        for normal, corners in FACE_DEFINITIONS:
            neighbor = (key[0] + normal[0], key[1] + normal[1], key[2] + normal[2])
            if neighbor in occupied:
                continue
            base = len(positions) // 3
            for corner in corners:
                positions.extend((center[0] + (corner[0] * 2 - 1) * half, center[1] + (corner[1] * 2 - 1) * half, center[2] + (corner[2] * 2 - 1) * half))
                normals.extend(normal)
                colors.extend(color)
            indices.extend((base, base + 1, base + 2, base, base + 2, base + 3))

    output_path.write_bytes(_glb_bytes(positions, normals, colors, indices))
    return {"voxel_count": len(voxels), "triangle_count": len(indices) // 3, "voxel_size": round(voxel_size, 5)}
