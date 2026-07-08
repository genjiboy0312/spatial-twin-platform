from math import sqrt


def _solve_linear_system(matrix: list[list[float]], vector: list[float]) -> list[float] | None:
    size = len(vector)
    rows = [matrix[i][:] + [vector[i]] for i in range(size)]

    for col in range(size):
        pivot = max(range(col, size), key=lambda row: abs(rows[row][col]))
        if abs(rows[pivot][col]) < 1e-12:
            return None
        rows[col], rows[pivot] = rows[pivot], rows[col]

        pivot_value = rows[col][col]
        for idx in range(col, size + 1):
            rows[col][idx] /= pivot_value

        for row in range(size):
            if row == col:
                continue
            factor = rows[row][col]
            for idx in range(col, size + 1):
                rows[row][idx] -= factor * rows[col][idx]

    return [rows[row][size] for row in range(size)]


def compute_affine_transform(
    local_points: list[tuple[float, float]],
    gps_points: list[tuple[float, float]],
) -> tuple[list[list[float]], float]:
    if len(local_points) < 3 or len(gps_points) < 3:
        raise ValueError("At least 3 control points required")
    if len(local_points) != len(gps_points):
        raise ValueError("Local and GPS point counts must match")

    # Least-squares normal equations for:
    # lat = a*x + b*y + tx
    # lng = c*x + d*y + ty
    normal = [[0.0 for _ in range(6)] for _ in range(6)]
    rhs = [0.0 for _ in range(6)]

    for (x, y), (lat, lng) in zip(local_points, gps_points, strict=True):
        lat_row = [x, y, 1.0, 0.0, 0.0, 0.0]
        lng_row = [0.0, 0.0, 0.0, x, y, 1.0]
        for row_values, target in ((lat_row, lat), (lng_row, lng)):
            for i, left in enumerate(row_values):
                rhs[i] += left * target
                for j, right in enumerate(row_values):
                    normal[i][j] += left * right

    solution = _solve_linear_system(normal, rhs)
    if solution is None:
        raise ValueError("Control points are degenerate")

    transform_matrix = [
        [solution[0], solution[1], solution[2]],
        [solution[3], solution[4], solution[5]],
    ]

    squared_error = 0.0
    for local, gps in zip(local_points, gps_points, strict=True):
        predicted = transform_point(local, transform_matrix)
        squared_error += (predicted[0] - gps[0]) ** 2
        squared_error += (predicted[1] - gps[1]) ** 2
    rmse = sqrt(squared_error / (len(local_points) * 2))
    return transform_matrix, rmse


def transform_point(local_point: tuple[float, float], transform_matrix: list[list[float]]) -> tuple[float, float]:
    if len(transform_matrix) != 2 or any(len(row) != 3 for row in transform_matrix):
        raise ValueError("Transform matrix must be [[a,b,tx],[c,d,ty]]")
    x, y = local_point
    lat = transform_matrix[0][0] * x + transform_matrix[0][1] * y + transform_matrix[0][2]
    lng = transform_matrix[1][0] * x + transform_matrix[1][1] * y + transform_matrix[1][2]
    return (round(lat, 8), round(lng, 8))
