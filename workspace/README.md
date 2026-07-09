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

## Docker LAN access

Docker Compose exposes only the UI and API to the local network.
Postgres and Redis remain bound to `127.0.0.1`.

```powershell
docker compose up -d --build
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254*" } |
  Select-Object IPAddress, InterfaceAlias
```

Open these URLs from another PC on the same Wi-Fi/LAN:

- UI: `http://<HOST_PC_IP>:5174`
- API docs: `http://<HOST_PC_IP>:8000/docs`

If the page does not open, allow inbound TCP ports `5174` and `8000` in Windows Defender Firewall.

## Temporary internet access

Use the optional Cloudflare Tunnel compose file when another network needs to reach the local Docker UI.
This creates a temporary public HTTPS URL that forwards to the frontend container. The frontend still proxies
`/api` to the backend inside Docker, so the backend/database do not need public ports.

```powershell
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs -f cloudflared
```

Copy the `https://....trycloudflare.com` URL printed by `cloudflared` and open it from the other PC/network.

Stop the public tunnel when testing is done:

```powershell
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop cloudflared
```

For a permanent public address, use a named tunnel/domain or deploy the stack behind HTTPS, authentication,
and a reverse proxy. Do not expose this development Vite server as a permanent production service.

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
