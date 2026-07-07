# Architecture Rules

## Boundaries

- Backend owns persistence, validation, upload lifecycle, and API contracts.
- Frontend owns page flow, local UI state, and visualization transforms.
- Database stores canonical spatial data in WGS84/SRID 4326.
- Raw source files are stored separately from parsed canonical geometry.

## Backend choice

- Use FastAPI for the prototype and MVP foundation.
- Do not introduce Rust Axum until a measured bottleneck or WebSocket-heavy feature justifies it.

## API shape

- REST endpoints live under `/api`.
- Responses use explicit Pydantic schemas.
- Errors should use a stable `{ detail: string }` shape for the prototype.

## Verification

- Backend changes require pytest.
- Frontend changes require Vitest/build.
- Coordinate changes require round-trip tests.
