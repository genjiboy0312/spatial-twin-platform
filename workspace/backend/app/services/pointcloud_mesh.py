import json
import struct
from collections.abc import Callable
from pathlib import Path

import numpy as np


def _align4(payload: bytes, pad: bytes = b"\x00") -> bytes:
    return payload + pad * ((4 - len(payload) % 4) % 4)


def _glb_bytes(
    positions: np.ndarray,
    normals: np.ndarray,
    colors: np.ndarray,
    indices: np.ndarray,
) -> bytes:
    position_array = np.asarray(positions, dtype="<f4").reshape((-1, 3))
    normal_array = np.asarray(normals, dtype="<f4").reshape((-1, 3))
    color_array = np.asarray(colors, dtype="<f4").reshape((-1, 3))
    index_array = np.asarray(indices, dtype="<u4").reshape(-1)
    payloads = [
        position_array.tobytes(),
        normal_array.tobytes(),
        color_array.tobytes(),
        index_array.tobytes(),
    ]
    offsets: list[int] = []
    binary = bytearray()
    for payload in payloads:
        offsets.append(len(binary))
        binary.extend(_align4(payload))

    minimum = position_array.min(axis=0).tolist()
    maximum = position_array.max(axis=0).tolist()
    document = {
        "asset": {"version": "2.0", "generator": "Spatial Twin Poisson surface"},
        "extensionsUsed": ["KHR_materials_unlit"],
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
            "pbrMetallicRoughness": {
                "baseColorFactor": [1, 1, 1, 1],
                "metallicFactor": 0,
                "roughnessFactor": 1,
            },
            "extensions": {"KHR_materials_unlit": {}},
            "doubleSided": True,
        }],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(payloads[0]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(payloads[1]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(payloads[2]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(payloads[3]), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(position_array), "type": "VEC3", "min": minimum, "max": maximum},
            {"bufferView": 1, "componentType": 5126, "count": len(normal_array), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(color_array), "type": "VEC3"},
            {"bufferView": 3, "componentType": 5125, "count": len(index_array), "type": "SCALAR"},
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


def _nearest_vertex_colors(point_cloud, vertices: np.ndarray) -> np.ndarray:
    import open3d as o3d

    source_points = np.asarray(point_cloud.points, dtype=np.float32)
    source_colors = np.asarray(point_cloud.colors, dtype=np.float32)
    search = o3d.core.nns.NearestNeighborSearch(o3d.core.Tensor(source_points))
    search.knn_index()
    neighbor_indices, neighbor_distances = search.knn_search(
        o3d.core.Tensor(np.asarray(vertices, dtype=np.float32)),
        4,
    )
    indices = neighbor_indices.numpy()
    distances = neighbor_distances.numpy()
    candidates = source_colors[indices]
    weights = 1 / np.maximum(np.sqrt(distances), 1e-5)
    blended = np.sum(candidates * weights[..., None], axis=1) / np.sum(weights, axis=1, keepdims=True)
    color_spread = np.ptp(candidates, axis=1).max(axis=1)
    blended[color_spread > 0.24] = candidates[color_spread > 0.24, 0]
    return np.clip(blended, 0, 1)


def build_surface_glb(
    preview_payload: bytes,
    output_path: Path,
    max_voxels: int = 500_000,
    progress_callback: Callable[[int, str], None] | None = None,
) -> dict[str, int | float]:
    import open3d as o3d

    def report(percent: int, stage: str) -> None:
        if progress_callback is not None:
            progress_callback(percent, stage)

    report(4, "reading_points")
    samples = np.frombuffer(preview_payload, dtype="<f4")
    if samples.size == 0 or samples.size % 6 != 0:
        raise ValueError("PointCloud has no valid XYZRGB points")
    samples = samples.reshape((-1, 6))
    xyz = np.asarray(samples[:, :3], dtype=np.float64)
    rgb = np.clip(np.asarray(samples[:, 3:6], dtype=np.float64), 0, 1)
    span = float(np.ptp(xyz, axis=0).max())
    voxel_size = max(span / 560, 0.005)

    source = o3d.geometry.PointCloud()
    source.points = o3d.utility.Vector3dVector(xyz)
    source.colors = o3d.utility.Vector3dVector(rgb)
    report(12, "downsampling")
    point_cloud = source.voxel_down_sample(voxel_size)
    while len(point_cloud.points) > max_voxels:
        voxel_size *= 1.15
        point_cloud = source.voxel_down_sample(voxel_size)
    if len(point_cloud.points) < 100:
        raise ValueError("PointCloud has too few surface samples")

    report(20, "filtering_noise")
    point_cloud, _ = point_cloud.remove_statistical_outlier(
        nb_neighbors=24,
        std_ratio=2.2,
    )
    if len(point_cloud.points) < 100:
        raise ValueError("PointCloud filtering removed too many samples")

    report(30, "estimating_normals")
    point_cloud.estimate_normals(
        o3d.geometry.KDTreeSearchParamHybrid(radius=voxel_size * 2.8, max_nn=50),
        fast_normal_computation=False,
    )
    point_cloud.normalize_normals()
    report(40, "orienting_normals")
    point_cloud.orient_normals_consistent_tangent_plane(24)

    report(48, "reconstructing_surface")
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        point_cloud,
        depth=11,
        scale=1.03,
        linear_fit=True,
        n_threads=4,
    )
    report(80, "cleaning_surface")
    density_values = np.asarray(densities)
    if density_values.size:
        mesh.remove_vertices_by_mask(density_values < np.quantile(density_values, 0.02))

    bounds = point_cloud.get_axis_aligned_bounding_box()
    margin = np.maximum(bounds.get_extent() * 0.005, voxel_size)
    crop_bounds = o3d.geometry.AxisAlignedBoundingBox(
        bounds.min_bound - margin,
        bounds.max_bound + margin,
    )
    mesh = mesh.crop(crop_bounds)
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_unreferenced_vertices()

    component_labels, component_counts, _ = mesh.cluster_connected_triangles()
    labels = np.asarray(component_labels)
    counts = np.asarray(component_counts)
    if labels.size and counts.size:
        mesh.remove_triangles_by_mask(counts[labels] < 16)
        mesh.remove_unreferenced_vertices()

    triangle_limit = 1_800_000
    if len(mesh.triangles) > triangle_limit:
        report(88, "optimizing_mesh")
        mesh = mesh.simplify_quadric_decimation(triangle_limit)
        mesh.remove_degenerate_triangles()
        mesh.remove_unreferenced_vertices()
    if len(mesh.triangles) == 0:
        raise ValueError("Poisson reconstruction did not produce a surface")

    mesh.compute_vertex_normals(normalized=True)
    vertices = np.asarray(mesh.vertices, dtype=np.float32)
    normals = np.asarray(mesh.vertex_normals, dtype=np.float32)
    report(94, "baking_colors")
    colors = _nearest_vertex_colors(point_cloud, vertices)
    triangles = np.asarray(mesh.triangles, dtype=np.uint32)
    report(98, "writing_mesh")
    output_path.write_bytes(_glb_bytes(vertices, normals, colors, triangles))
    report(100, "completed")
    return {
        "voxel_count": len(point_cloud.points),
        "triangle_count": len(triangles),
        "voxel_size": round(voxel_size, 5),
    }
