# API Contracts

## Health

- `GET /health` returns service status.

## Buildings

- `GET /api/buildings`
- `POST /api/buildings`
- Required creation field: `name`
- Optional fields: `address`, `origin_longitude`, `origin_latitude`, `total_floors`

## Floors

- `GET /api/buildings/{building_id}/floors`
- `POST /api/buildings/{building_id}/floors`
- Required creation field: `floor_number`

## Uploads

- `GET /api/uploads`
- `POST /api/uploads`
- Prototype stores upload metadata only; real parser pipeline comes later.

## Workflow

- `GET /api/workflow/{building_id}`
- `PATCH /api/workflow/{building_id}`
- Tracks current step and completed steps.
