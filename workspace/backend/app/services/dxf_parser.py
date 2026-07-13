from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from typing import Any


Point2D = tuple[float, float]


@dataclass(frozen=True)
class DxfSegment:
    start: Point2D
    end: Point2D
    layer: str
    entity_type: str


@dataclass(frozen=True)
class DxfRoom:
    name: str
    x: float
    y: float
    w: float
    h: float
    layer: str
    points: list[Point2D]


@dataclass(frozen=True)
class DxfParseResult:
    layers: list[dict[str, Any]]
    walls: list[DxfSegment]
    rooms: list[DxfRoom]
    entity_counts: dict[str, int]
    total_entities: int

    def summary(self) -> dict[str, Any]:
        return {
            "status": "parsed",
            "total_entities": self.total_entities,
            "layers": self.layers,
            "entity_counts": self.entity_counts,
            "walls_count": len(self.walls),
            "rooms_count": len(self.rooms),
        }


def parse_dxf_file(file_path: Path) -> DxfParseResult:
    """Extract simple floor geometry from a DXF file.

    The backend schema stores wall geometry as line segments and room geometry as
    rectangles, so closed polylines are represented by their bounding boxes.
    """

    try:
        ezdxf = import_module("ezdxf")
        doc = ezdxf.readfile(file_path)
    except ImportError:
        return parse_ascii_dxf_file(file_path)
    except (OSError, Exception) as exc:
        raise ValueError(f"Unable to parse DXF file: {exc}") from exc

    modelspace = doc.modelspace()
    layer_counts: Counter[str] = Counter()
    entity_counts: Counter[str] = Counter()
    walls: list[DxfSegment] = []
    rooms: list[DxfRoom] = []
    room_index = 1
    total_entities = 0

    for entity in modelspace:
        total_entities += 1
        entity_type = entity.dxftype()
        layer = str(entity.dxf.layer or "0")
        layer_counts[layer] += 1
        entity_counts[entity_type] += 1

        if entity_type == "LINE":
            segment = _line_segment(entity, layer)
            if segment is not None:
                walls.append(segment)
            continue

        if entity_type == "LWPOLYLINE":
            vertices = _lwpolyline_vertices(entity)
            closed = bool(getattr(entity, "closed", False) or getattr(entity, "is_closed", False))
            walls.extend(_segments_from_vertices(vertices, layer, entity_type, closed=closed))
            if closed:
                room = _room_from_vertices(vertices, layer, room_index)
                if room is not None:
                    rooms.append(room)
                    room_index += 1
            continue

        if entity_type == "POLYLINE":
            vertices = _polyline_vertices(entity)
            closed = bool(getattr(entity, "is_closed", False))
            walls.extend(_segments_from_vertices(vertices, layer, entity_type, closed=closed))
            if closed:
                room = _room_from_vertices(vertices, layer, room_index)
                if room is not None:
                    rooms.append(room)
                    room_index += 1

    return DxfParseResult(
        layers=[{"name": name, "entity_count": count} for name, count in sorted(layer_counts.items())],
        walls=walls,
        rooms=rooms,
        entity_counts=dict(sorted(entity_counts.items())),
        total_entities=total_entities,
    )


def parse_ascii_dxf_file(file_path: Path) -> DxfParseResult:
    try:
      lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError as exc:
      raise ValueError(f"Unable to read DXF file: {exc}") from exc

    pairs = _dxf_pairs(lines)
    layer_counts: Counter[str] = Counter()
    entity_counts: Counter[str] = Counter()
    walls: list[DxfSegment] = []
    rooms: list[DxfRoom] = []
    room_index = 1
    index = 0

    while index < len(pairs):
        code, value = pairs[index]
        if code != "0":
            index += 1
            continue

        entity_type = value.upper()
        if entity_type == "LINE":
            entity_pairs, index = _collect_entity_pairs(pairs, index + 1)
            layer = _pair_value(entity_pairs, "8") or "0"
            layer_counts[layer] += 1
            entity_counts[entity_type] += 1
            segment = _line_segment_from_pairs(entity_pairs, layer)
            if segment is not None:
                walls.append(segment)
            continue

        if entity_type == "LWPOLYLINE":
            entity_pairs, index = _collect_entity_pairs(pairs, index + 1)
            layer = _pair_value(entity_pairs, "8") or "0"
            layer_counts[layer] += 1
            entity_counts[entity_type] += 1
            vertices = _lwpolyline_vertices_from_pairs(entity_pairs)
            closed = ((_pair_int(entity_pairs, "70") & 1) == 1) or (len(vertices) >= 3 and _same_point(vertices[0], vertices[-1]))
            walls.extend(_segments_from_vertices(vertices, layer, entity_type, closed=closed))
            if closed:
                room = _room_from_vertices(vertices, layer, room_index)
                if room is not None:
                    rooms.append(room)
                    room_index += 1
            continue

        if entity_type == "POLYLINE":
            entity_pairs, index = _collect_polyline_pairs(pairs, index + 1)
            header_pairs = entity_pairs["header"]
            vertex_groups = entity_pairs["vertices"]
            layer = _pair_value(header_pairs, "8") or "0"
            layer_counts[layer] += 1
            entity_counts[entity_type] += 1
            vertices = [_point_from_pairs(group) for group in vertex_groups]
            vertices = [point for point in vertices if point is not None]
            closed = ((_pair_int(header_pairs, "70") & 1) == 1) or (len(vertices) >= 3 and _same_point(vertices[0], vertices[-1]))
            walls.extend(_segments_from_vertices(vertices, layer, entity_type, closed=closed))
            if closed:
                room = _room_from_vertices(vertices, layer, room_index)
                if room is not None:
                    rooms.append(room)
                    room_index += 1
            continue

        index += 1

    return DxfParseResult(
        layers=[{"name": name, "entity_count": count} for name, count in sorted(layer_counts.items())],
        walls=walls,
        rooms=rooms,
        entity_counts=dict(sorted(entity_counts.items())),
        total_entities=sum(entity_counts.values()),
    )


def _dxf_pairs(lines: list[str]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for index in range(0, len(lines) - 1, 2):
        pairs.append((lines[index].strip(), lines[index + 1].strip()))
    return pairs


def _collect_entity_pairs(pairs: list[tuple[str, str]], index: int) -> tuple[list[tuple[str, str]], int]:
    items: list[tuple[str, str]] = []
    while index < len(pairs) and pairs[index][0] != "0":
        items.append(pairs[index])
        index += 1
    return items, index


def _collect_polyline_pairs(pairs: list[tuple[str, str]], index: int) -> tuple[dict[str, list], int]:
    header: list[tuple[str, str]] = []
    vertices: list[list[tuple[str, str]]] = []
    current_vertex: list[tuple[str, str]] | None = None
    while index < len(pairs):
        code, value = pairs[index]
        if code == "0" and value.upper() == "SEQEND":
            if current_vertex is not None:
                vertices.append(current_vertex)
            return {"header": header, "vertices": vertices}, index + 1
        if code == "0" and value.upper() == "VERTEX":
            if current_vertex is not None:
                vertices.append(current_vertex)
            current_vertex = []
            index += 1
            continue
        if code == "0":
            if current_vertex is not None:
                vertices.append(current_vertex)
            return {"header": header, "vertices": vertices}, index
        if current_vertex is not None:
            current_vertex.append((code, value))
        else:
            header.append((code, value))
        index += 1
    if current_vertex is not None:
        vertices.append(current_vertex)
    return {"header": header, "vertices": vertices}, index


def _pair_value(pairs: list[tuple[str, str]], code: str) -> str | None:
    return next((value for item_code, value in pairs if item_code == code), None)


def _pair_float(pairs: list[tuple[str, str]], code: str) -> float | None:
    value = _pair_value(pairs, code)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _pair_int(pairs: list[tuple[str, str]], code: str) -> int:
    value = _pair_value(pairs, code)
    if value is None:
        return 0
    try:
        return int(float(value))
    except ValueError:
        return 0


def _line_segment_from_pairs(pairs: list[tuple[str, str]], layer: str) -> DxfSegment | None:
    x1 = _pair_float(pairs, "10")
    y1 = _pair_float(pairs, "20")
    x2 = _pair_float(pairs, "11")
    y2 = _pair_float(pairs, "21")
    if x1 is None or y1 is None or x2 is None or y2 is None:
        return None
    start = (x1, y1)
    end = (x2, y2)
    if _same_point(start, end):
        return None
    return DxfSegment(start=start, end=end, layer=layer, entity_type="LINE")


def _lwpolyline_vertices_from_pairs(pairs: list[tuple[str, str]]) -> list[Point2D]:
    vertices: list[Point2D] = []
    pending_x: float | None = None
    for code, value in pairs:
        if code == "10":
            try:
                pending_x = float(value)
            except ValueError:
                pending_x = None
        elif code == "20" and pending_x is not None:
            try:
                vertices.append((pending_x, float(value)))
            except ValueError:
                pass
            pending_x = None
    return vertices


def _point_from_pairs(pairs: list[tuple[str, str]]) -> Point2D | None:
    x = _pair_float(pairs, "10")
    y = _pair_float(pairs, "20")
    if x is None or y is None:
        return None
    return (x, y)


def _line_segment(entity: Any, layer: str) -> DxfSegment | None:
    start = _point2d(entity.dxf.start)
    end = _point2d(entity.dxf.end)
    if _same_point(start, end):
        return None
    return DxfSegment(start=start, end=end, layer=layer, entity_type="LINE")


def _lwpolyline_vertices(entity: Any) -> list[Point2D]:
    return [_point2d(point) for point in entity.get_points("xy")]


def _polyline_vertices(entity: Any) -> list[Point2D]:
    return [_point2d(vertex.dxf.location) for vertex in entity.vertices]


def _segments_from_vertices(vertices: list[Point2D], layer: str, entity_type: str, *, closed: bool) -> list[DxfSegment]:
    if len(vertices) < 2:
        return []

    points = [*vertices]
    if closed and not _same_point(points[0], points[-1]):
        points.append(points[0])

    segments: list[DxfSegment] = []
    for start, end in zip(points, points[1:], strict=False):
        if not _same_point(start, end):
            segments.append(DxfSegment(start=start, end=end, layer=layer, entity_type=entity_type))
    return segments


def _room_from_vertices(vertices: list[Point2D], layer: str, room_index: int) -> DxfRoom | None:
    if len(vertices) < 3:
        return None
    x_values = [point[0] for point in vertices]
    y_values = [point[1] for point in vertices]
    min_x = min(x_values)
    max_x = max(x_values)
    min_y = min(y_values)
    max_y = max(y_values)
    width = max_x - min_x
    height = max_y - min_y
    if width <= 0 or height <= 0:
        return None
    return DxfRoom(name=f"Room {room_index}", x=min_x, y=min_y, w=width, h=height, layer=layer, points=vertices)


def _point2d(point: Any) -> Point2D:
    return (float(point[0]), float(point[1]))


def _same_point(first: Point2D, second: Point2D) -> bool:
    return abs(first[0] - second[0]) < 1e-9 and abs(first[1] - second[1]) < 1e-9
