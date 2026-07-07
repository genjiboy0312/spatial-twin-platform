# Building Editor Prototype

Spatial Digital Twin Building Editor의 MVP 프로토타입입니다. 목표는 전체 제품을 한 번에 만들기보다 **계약 → API → 화면 흐름 → 좌표 검증 → 뷰어** 순서로 안전하게 확장하는 기본환경을 마련하는 것입니다.

## Stack

- Frontend: React + Vite + TypeScript + Zustand + React Router
- Backend: FastAPI + SQLAlchemy + Pydantic Settings
- Database: PostgreSQL + PostGIS
- Cache: Redis
- Local platform: Docker Compose

## Local startup

```bash
# 1. Infrastructure
docker compose up -d postgres redis

# 2. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pytest
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd ..\frontend
npm install
npm run test
npm run build
npm run dev
```

Frontend: http://localhost:5173  
Backend OpenAPI: http://localhost:8000/docs

## MVP scope

1. Building/Floor CRUD contract scaffold
2. Upload lifecycle scaffold
3. Workflow progress scaffold
4. React page shell
5. WGS84 ↔ local-meter coordinate utility with tests

## Non-goals for this prototype

- IFC/GLB/Point Cloud production processing
- Rust Axum backend
- Full authentication/authorization
- Production deployment
