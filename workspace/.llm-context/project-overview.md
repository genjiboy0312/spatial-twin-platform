# Project Overview

## Product

Unified Building Editor is a web-based spatial digital twin editor for uploading floor source files, extracting geometry, viewing 2D/3D building data, and preparing later editing/validation workflows.

## Prototype goal

Build the smallest trustworthy vertical foundation:

1. Stable contracts for buildings, floors, uploads, workflow, and coordinates.
2. FastAPI backend with typed request/response models.
3. React/Vite frontend shell that calls real API contracts.
4. Coordinate utilities tested before viewer/editor work expands.

## Runtime ports

- Frontend: 5173
- Backend: 8000
- PostgreSQL/PostGIS: 5432
- Redis: 6379
