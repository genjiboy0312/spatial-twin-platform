# Building Editor 프로젝트 전면 분석 문서 (재개발 가이드)

> **작성 목적**: 이 프로젝트를 A-Z까지 재개발하기 위한 완전한 참조 문서
> **작성일**: 2026-07-02
> **원본 저장소 구조 기반**

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [데이터베이스](#3-데이터베이스)
4. [백엔드 (Python FastAPI)](#4-백엔드-python-fastapi)
5. [백엔드-RS (Rust Axum)](#5-백엔드-rs-rust-axum)
6. [프론트엔드 (React + TypeScript)](#6-프론트엔드-react--typescript)
7. [마이크로서비스](#7-마이크로서비스)
8. [인프라스트럭처](#8-인프라스트럭처)
9. [디자인 시스템](#9-디자인-시스템)
10. [워크플로우 ★중요](#10-워크플로우-중요)
11. [재개발 주의사항](#11-재개발-주의사항)
12. [개발 로드맵](#12-개발-로드맵)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 설명
**Unified Building Editor** - 건축물의 DXF/IFC/이미지 도면을 업로드하고, 2D/3D로 편집하며, 보안 장비를 배치하고, 디지털 트윈을 구축하는 웹 기반 통합 플랫폼.

### 1.2 핵심 기능
- **건물 관리**: Building/Floor CRUD, GIS 좌표(WGS84) 기반
- **도면 업로드 및 파싱**: DXF, PNG/JPG, IFC, GLB 형식 지원
- **2D/3D 뷰어**: Canvas 2D + Three.js 3D 통합 뷰어
- **Geometry 편집**: Wall/Door/Window/Room CRUD, 속성 편집
- **보안 장비 배치**: Camera/Sensor/Alarm/Access Control 배치 및 편집
- **좌표 정합 (GPS Alignment)**: WGS84 좌표 ↔ 로컬 좌표 변환
- **포인트 클라우드**: LAS/LAZ/Potree 포맷 지원, 3D 메시 생성
- **Pathfinding**: 건물 내 경로 탐색
- **Export**: OBJ, DXF, PDF, Excel 내보내기
- **실시간 모니터링**: WebSocket 기반 이벤트/알람/대시보드

### 1.3 기술 스택 요약

| 계층 | 기술 | 비고 |
|------|------|------|
| **프론트엔드** | React 18 + TypeScript + Vite 6 | SPA |
| **3D 렌더링** | Three.js + @react-three/fiber/drei | Canvas 2D 병행 |
| **맵** | Leaflet, MapLibre GL, react-map-gl, deck.gl, Cesium | |
| **상태 관리** | Zustand 5 | |
| **스타일링** | Tailwind CSS 4 + CSS 커스텀 속성 | SOC Professional Dark 테마 |
| **메인 백엔드** | Python FastAPI + SQLAlchemy 2.0 + PostGIS | 포트 8000 |
| **차세대 백엔드** | Rust Axum + SQLx + PostGIS | 포트 3000 (마이그레이션 중) |
| **데이터베이스** | PostgreSQL 15 + PostGIS 3.4 | SRID 4326 (WGS84) |
| **캐시** | Redis 7 | |
| **마이크로서비스** | Python FastAPI (IFC/Image/DXF) | 각각 8001, 8002, 8003 |
| **컨테이너** | Docker Compose | 6개 서비스 |
| **CI/CD** | GitHub Actions | |

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (React+Vite)                      │
│  Port 5173 (dev) / Docker                                        │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Pages    │ │Components│ │  Stores  │ │ Shared/Utils     │   │
│  │ (15개)   │ │ (47개)   │ │ (Zustand)│ │ Canvas2D/3D etc  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP / WebSocket
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│              Backend-RS (Rust Axum) - Port 3000                   │
│  (차세대, 현재 FastAPI와 병행 운영, 마이그레이션 중)                │
│  37개 API 라우트 파일 + WebSocket                                  │
│  SQLx + geozero(postgis)                                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │ (또는)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│              Backend (Python FastAPI) - Port 8000                  │
│  (메인 운영 중)                                                   │
│  13개 API 라우터 + 5개 미들웨어                                    │
│  SQLAlchemy 2.0 + GeoAlchemy2 + Alembic                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌────────────────┐
│ PostgreSQL 15    │ │   Redis 7    │ │ Microservices  │
│ + PostGIS 3.4    │ │   (Cache)    │ │ (Python)       │
│ Port 5432        │ │ Port 6379    │ │                │
│                  │ │              │ │ IFC:8001       │
│ 16+ tables       │ │              │ │ Image:8002     │
│ SRID 4326        │ │              │ │ DXF:8003       │
└──────────────────┘ └──────────────┘ └────────────────┘
```

### 2.2 디렉토리 구조

```
building-editor/
├── frontend/              # React + Vite SPA
│   ├── src/
│   │   ├── pages/         # 15개 페이지 (라우팅 진입점)
│   │   ├── components/    # 47개 컴포넌트 (재사용)
│   │   ├── store/         # 10개 Zustand 스토어
│   │   ├── api/           # 12개 API 클라이언트 (axios)
│   │   ├── shared/        # 공유 유틸/타입/상수
│   │   │   ├── utils/     # 22개 유틸 파일 (Canvas2D/3D 등)
│   │   │   └── types/     # Building/Geometry/Device/Analysis 타입
│   │   ├── hooks/         # 12개 커스텀 훅
│   │   ├── layouts/       # DashboardLayout, Header, Sidebar
│   │   ├── services/      # GeometryRenderer, IFC 관련 서비스
│   │   ├── styles/        # CSS (Tailwind + responsive)
│   │   ├── workers/       # Web Workers (LAS 파싱, 포인트 클라우드)
│   │   ├── data/          # 샘플 데이터
│   │   ├── features/      # IFC 관련 피처 모듈
│   │   ├── utils/         # 범용 유틸
│   │   ├── App.tsx        # 메인 라우터
│   │   └── main.tsx       # 진입점
│   ├── e2e/               # Playwright E2E 테스트
│   └── vite.config.ts     # Vite 설정 (프록시, Tailwind)
│
├── backend/               # Python FastAPI 백엔드
│   ├── app/
│   │   ├── api/           # 13개 API 라우터
│   │   ├── models/        # 10개 SQLAlchemy 모델
│   │   ├── schemas/       # 6개 Pydantic 스키마
│   │   ├── services/      # 15개 서비스 (비즈니스 로직)
│   │   ├── middleware/     # 3개 미들웨어
│   │   ├── core/          # 설정, 로깅
│   │   ├── utils/         # 유틸
│   │   ├── main.py        # FastAPI 앱 진입점
│   │   └── db.py          # DB 설정
│   ├── migrations/        # 5개 SQL 마이그레이션
│   └── tests/             # 38개 pytest
│
├── backend-rs/            # Rust Axum 백엔드 (차세대)
│   ├── src/
│   │   ├── api/           # 37개 라우트 파일
│   │   ├── models/        # 10개 Rust 모델
│   │   ├── services/      # 4개 서비스
│   │   ├── middleware/    # 미들웨어
│   │   ├── utils/         # 유틸
│   │   ├── main.rs        # Axum 앱 진입점
│   │   └── lib.rs         # 모듈 선언
│   ├── migrations/        # 15개 SQL 마이그레이션
│   └── tests/             # Rust 테스트
│
├── services/
│   ├── ifc-processor/     # IFC 처리 마이크로서비스 (8001)
│   ├── image-processor/   # 이미지 처리 마이크로서비스 (8002)
│   └── ... (image_processing/ 파이프라인)
│
├── dxf-export-service/    # DXF 내보내기 서비스 (8003)
├── docker-compose.yml     # 6개 서비스 오케스트레이션
└── docs/                  # 문서
```

---

## 3. 데이터베이스

### 3.1 PostgreSQL + PostGIS 설정

- **버전**: PostgreSQL 15 + PostGIS 3.4
- **SRID**: 4326 (WGS84) - 모든 지오메트리는 위도/경도 기반
- **포트**: 5432 (초기 5433에서 변경됨)
- **Docker 이미지**: `postgis/postgis:15-3.4`
- **DB 이름**: `total_building_db`
- **사용자/비밀번호**: `postgres/postgres`

### 3.2 전체 테이블 구조 (16개 + @)

#### 3.2.1 buildings (건물 메타데이터)
```sql
CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    total_floors INT DEFAULT 1,
    origin_longitude FLOAT,       -- WGS84 경도
    origin_latitude FLOAT,        -- WGS84 위도
    geocoded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, address)
);
```

#### 3.2.2 floors (층 정보)
```sql
CREATE TABLE floors (
    id SERIAL PRIMARY KEY,
    building_id INT REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INT NOT NULL,        -- -2(B2), -1(B1), 0(ground), 1, 2...
    floor_name VARCHAR(50),           -- "1층", "지하 1층"
    height_meters FLOAT DEFAULT 3.0,  -- 층고
    input_type VARCHAR(20),           -- 'dxf', 'image', 'ifc', 'glb'
    original_file_path TEXT,
    processed_at TIMESTAMP,
    UNIQUE(building_id, floor_number)
);
```

#### 3.2.3 walls (벽)
```sql
CREATE TABLE walls (
    id SERIAL PRIMARY KEY,
    floor_id INT REFERENCES floors(id) ON DELETE CASCADE,
    geometry GEOMETRY(LINESTRING, 4326) NOT NULL,  -- 2D 선분
    original_geometry GEOMETRY(LINESTRING, 4326),
    p1 GEOMETRY(POINT, 4326),              -- 시작점
    p2 GEOMETRY(POINT, 4326),              -- 끝점
    thickness_meters FLOAT DEFAULT 0.2,
    height_meters FLOAT DEFAULT 3.0,
    wall_type VARCHAR(50) DEFAULT 'interior',  -- 'interior', 'exterior', 'load_bearing'
    confidence FLOAT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.2.4 doors (문)
```sql
CREATE TABLE doors (
    id SERIAL PRIMARY KEY,
    floor_id INT REFERENCES floors(id) ON DELETE CASCADE,
    center GEOMETRY(POINT, 4326) NOT NULL,
    original_center GEOMETRY(POINT, 4326),
    p1 GEOMETRY(POINT, 4326),
    p2 GEOMETRY(POINT, 4326),
    rotation_degrees FLOAT DEFAULT 0.0,
    width_meters FLOAT DEFAULT 0.9,
    height_meters FLOAT DEFAULT 2.1,
    door_type VARCHAR(50) DEFAULT 'swing',
    confidence FLOAT,
    is_emergency_exit BOOLEAN,
    is_external_entry BOOLEAN,
    has_access_control BOOLEAN,
    security_level INT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.2.5 windows (창문)
```sql
CREATE TABLE windows (
    id SERIAL PRIMARY KEY,
    floor_id INT REFERENCES floors(id) ON DELETE CASCADE,
    center GEOMETRY(POINT, 4326) NOT NULL,
    original_center GEOMETRY(POINT, 4326),
    p1 GEOMETRY(POINT, 4326),
    p2 GEOMETRY(POINT, 4326),
    rotation_degrees FLOAT DEFAULT 0.0,
    width_meters FLOAT DEFAULT 1.5,
    height_meters FLOAT DEFAULT 1.2,
    sill_height_meters FLOAT DEFAULT 0.9,
    window_type VARCHAR(50) DEFAULT 'casement',
    confidence FLOAT,
    is_accessible BOOLEAN,
    security_rating VARCHAR(10),
    has_sensor BOOLEAN,
    has_security_film BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.2.6 rooms (방)
```sql
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    floor_id INT REFERENCES floors(id) ON DELETE CASCADE,
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    original_geometry GEOMETRY(POLYGON, 4326),
    room_name VARCHAR(100),
    room_type VARCHAR(50),
    area_sqm FLOAT,  -- PostGIS 트리거 자동 계산
    confidence FLOAT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 면적 자동 계산 트리거
CREATE FUNCTION update_room_area() RETURNS TRIGGER AS $$
BEGIN
    NEW.area_sqm := ST_Area(NEW.geometry::geography);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 3.2.7 security_devices (보안장비)
```sql
CREATE TABLE security_devices (
    id SERIAL PRIMARY KEY,
    floor_id INT REFERENCES floors(id) ON DELETE CASCADE,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    position GEOMETRY(POINT, 4326) NOT NULL,
    height_meters FLOAT DEFAULT 2.5,
    device_type VARCHAR(50) NOT NULL,  -- 'camera', 'sensor', 'alarm', 'access_control'
    device_model VARCHAR(100),
    device_id VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'active',
    rotation_degrees FLOAT DEFAULT 0.0,
    coverage_angle FLOAT,
    coverage_range FLOAT,
    horizontal_resolution INT,
    vertical_resolution INT,
    sensor_width_mm FLOAT,
    metadata JSONB,
    network_ip VARCHAR(45),
    network_port INT,
    firmware_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 자동 Room 할당 트리거
CREATE FUNCTION assign_device_room() RETURNS TRIGGER AS $$
BEGIN
    NEW.room_id := (
        SELECT id FROM rooms
        WHERE floor_id = NEW.floor_id
          AND ST_Contains(geometry, NEW.position)
        LIMIT 1
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 3.2.8 기타 테이블
- **original_geometry_cache**: 원본 지오메트리 JSONB 백업 (entity_type, entity_id)
- **floor_adjacency**: 층간 연결성 (계단/엘리베이터/램프)
- **export_history**: OBJ 출력 이력
- **edit_history**: 편집 이력 추적
- **point_cloud_files**: 포인트 클라우드 파일 메타데이터
- **alarm_history**: 알람 이력 (RS 마이그레이션에서 추가)
- **audit_logs**: 감사 로그 (RS)
- **event**: 이벤트 (RS)
- **building_map_settings**: 지도 설정 (RS)
- **spatial_settings**: 공간 설정 (RS)
- **alignment_result_cache**: 정합 결과 캐시 (RS)
- **floor_boundaries**: 층 경계 (RS)
- **geometry_entity_metadata**: 지오메트리 메타데이터 (RS)

### 3.3 중요 DB 설계 결정사항
- **모든 지오메트리**: SRID 4326 (WGS84 위경도) 사용
- **면적 자동 계산**: PostGIS `ST_Area(geography)` 트리거
- **Room 자동 할당**: 장비 삽입 시 `ST_Contains`로 자동 Room 매핑
- **updated_at 자동 업데이트**: 트리거 함수 `update_timestamp()`
- **백엔드-RS 전용 마이그레이션**: Rust 프로젝트에 15개 SQL 파일 별도 존재
- **데이터 무결성**: `ON DELETE CASCADE`로 부모 삭제 시 자식 자동 삭제

---

## 4. 백엔드 (Python FastAPI)

### 4.1 개요
- **프레임워크**: FastAPI 0.115
- **ORM**: SQLAlchemy 2.0 + GeoAlchemy2
- **마이그레이션**: Alembic (그러나 실제로는 raw SQL 사용)
- **포트**: 8000 (개발), Docker 내부
- **실행**: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

### 4.2 API 라우터 (13개)

| 라우터 | 경로 | 주요 기능 |
|--------|------|----------|
| **buildings** | `/api/buildings` | CRUD, 중복 검사 (409), 주소 자동 지오코딩 |
| **floors** | `/api/floors` | CRUD, Building별 Floor 목록 |
| **upload** | `/api/floors` | DXF/Image/IFC/GLB 업로드 및 파싱 |
| **geometry** | `/api/geometry` | Wall/Door/Window/Room CRUD |
| **edit_history** | `/api/edit-history` | 편집 이력 조회/복원 |
| **security_devices** | `/api/security-devices` | 보안장비 CRUD (`/api/floors/:id/devices`) |
| **export** | `/api/export` | OBJ/메타데이터 내보내기 |
| **coverage_analysis** | `/api/coverage-analysis` | 카메라 커버리지 분석 |
| **threat_analysis** | `/api/threat-analysis` | 위협 분석 |
| **pathfinding** | `/api/pathfinding` | 경로 탐색 |
| **gps_alignment** | `/api/gps-alignment` | GPS 좌표 정합 |
| **viewer** | `/api/viewer` | 뷰어 데이터 조회 |
| **point_cloud** | `/api/point-cloud` | 포인트 클라우드 처리 |

### 4.3 미들웨어 (3개)
- **RequestLoggerMiddleware**: 상관 ID(UUID) 발급, 요청/응답 로깅
- **RequestValidatorMiddleware**: 요청 본문 크기 제한 (50MB), 413 응답
- **RateLimiterMiddleware**: 슬라이딩 윈도우 (일반 100/min, 업로드 10/min), 인메모리

### 4.4 주요 서비스
- **input_processors/**: DXF/Image/IFC 프로세서 (파일별 파싱)
- **geometry_service.py**: 지오메트리 비즈니스 로직
- **geocoding_service.py**: OpenStreetMap Nominatim 주소→좌표 변환
- **coverage_analysis_service.py**: 카메라 커버리지 계산
- **obj_exporter.py**: OBJ 포맷 내보내기
- **dxf_exporter.py**: DXF 포맷 내보내기
- **pathfinding_service.py**: 경로 탐색 알고리즘
- **ppm_service.py**: PPM 이미지 처리

### 4.5 업로드 처리 파이프라인
```
도면 파일 업로드
    │
    ├── DXF (.dxf) → DxfProcessor (ezdxf 라이브러리)
    │   → Wall/LineString + Door/Window/Point 추출
    │
    ├── Image (.png/.jpg) → ImageProcessor (OpenCV)
    │   → Step A-G 파이프라인: 이진화 → 선 검출 → 벽/문/창/방 분류
    │   → scale_px_per_meter 기반 좌표 변환
    │
    ├── IFC (.ifc) → IfcProcessor (ifcopenshell)
    │   → IfcWall/IfcDoor/IfcWindow/IfcSpace 추출
    │   → 로컬 좌표 → WGS84 변환
    │   → UTF-8/EUC-KR/CP949 인코딩 자동 감지
    │
    └── GLB (.glb/.gltf) → GLB 업로드
        → 외부 참조 파일(bin/texture) 자동 추출
        → 텍스처 URI 정규화
```

### 4.6 의존성 (핵심)
```
fastapi, uvicorn, sqlalchemy, psycopg2-binary, geoalchemy2, alembic
redis, hiredis, pydantic, pydantic-settings
opencv-python, opencv-contrib-python, numpy, scipy, scikit-image, pillow
ezdxf, ifcopenshell
python-dotenv, python-jose, passlib
pytest, pytest-asyncio, httpx
```

---

## 5. 백엔드-RS (Rust Axum)

### 5.1 개요
- **프레임워크**: Axum 0.8 (Tokio 기반)
- **ORM**: SQLx 0.8 (PostgreSQL, runtime-tokio)
- **GIS**: geozero 0.14 (with-wkb, with-postgis-sqlx)
- **포트**: 3000
- **상태**: FastAPI에서 Rust로 마이그레이션 중 (FastAPI가 메인)

### 5.2 API 라우트 (37개 파일)
- `auth.rs` - JWT 인증 (argon2 비밀번호, jsonwebtoken)
- `buildings.rs` - 건물 CRUD
- `floors.rs` - 층 CRUD
- `walls.rs` - 벽 CRUD
- `geometry.rs` - 지오메트리
- `security_devices.rs` - 보안장비
- `device_status.rs` - 장비 상태
- `upload.rs`, `upload_dxf.rs`, `upload_ifc.rs`, `upload_image.rs` - 업로드
- `websocket.rs` - WebSocket (WsState, 100개 버퍼)
- `events.rs` - 이벤트
- `alarms.rs` - 알람
- `audit.rs` - 감사 로그
- `dashboard.rs` - 대시보드
- `point_cloud.rs` - 포인트 클라우드
- `alignment.rs`, `gps_alignment.rs` - 정합
- `viewer.rs` - 뷰어
- `validation.rs` - 검증 (/validation/)
- `pathfinding.rs` - 경로 탐색
- `export_obj.rs`, `export_metadata.rs` - 내보내기
- `batch.rs` - 배치 작업
- `proxy.rs` - 프록시
- `system_logs.rs` - 시스템 로그
- `asset_urls.rs` - 에셋 URL
- `singleton_swap.rs` - 싱글톤 교체
- `test_support.rs` - 테스트 지원
- `upload_replace.rs` - 업로드 교체
- `floor_upload_metadata.rs` - 업로드 메타데이터

### 5.3 핵심 의존성 (Cargo.toml)
```toml
axum = { version = "0.8", features = ["multipart", "ws"] }
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio", "uuid", "chrono", "json"] }
tower-http = { version = "0.6", features = ["cors", "fs", "trace"] }
geozero = { version = "0.14", features = ["with-wkb", "with-postgis-sqlx"] }
reqwest = { version = "0.12", features = ["json", "multipart"] }
dxf = "0.6"
las = { version = "0.9", features = ["laz-parallel"] }
ply-rs-bw = "3.0"
nalgebra = "0.33"
jsonwebtoken = "10.3.0"
argon2 = "0.5.3"
genpdf = "0.2.0"
rust_xlsxwriter = "0.94.0"
```

### 5.4 백엔드-RS 특이사항
- **WebSocket 내장**: Axum WS 기능으로 실시간 통신
- **5GB Body Limit**: `DefaultBodyLimit::max(5 * 1024 * 1024 * 1024)`
- **인증/인가 구현됨**: JWT + Argon2 (FastAPI는 제외되어 있음)
- **CORS**: Permissive (CorsLayer::permissive())
- **오디트 미들웨어**: 모든 요청 감사 로깅
- **Potree 지원**: 포인트 클라우드 Potree 파일 서빙
- **IFC 샘플 디렉토리**: `/api/ifc-samples` 정적 서빙

---

## 6. 프론트엔드 (React + TypeScript)

### 6.1 개요
- **프레임워크**: React 18 + TypeScript 5.7
- **빌드**: Vite 6
- **라우팅**: React Router DOM 7.11
- **상태 관리**: Zustand 5
- **스타일링**: Tailwind CSS 4 + CSS 커스텀 속성
- **HTTP 클라이언트**: Axios
- **폼**: React Hook Form + Zod
- **3D**: Three.js + @react-three/fiber + @react-three/drei
- **맵**: Leaflet, react-leaflet, MapLibre GL, react-map-gl, deck.gl, Cesium
- **차트**: Recharts
- **테스트**: Vitest (단위), Playwright (E2E)

### 6.2 페이지 구성 (15개)

| 경로 | 페이지 | 워크플로우 단계 |
|------|--------|----------------|
| `/home` | HomePage | 랜딩 |
| `/dashboard` | DashboardPage | KPI + 건물 그리드 |
| `/projects` | ProjectsPage | Step 1: 프로젝트 선택 |
| `/data-sources` | DataSourcesPage | Step 2: 데이터 업로드 |
| `/editor/:buildingId` | EditorPage | Step 3: 3D 편집 + 장비 배치 |
| `/alignment` | AlignmentPage | Step 5: GPS 정합 |
| `/validation` | ValidationPage | Step 6: 검증 + 뷰어 |
| `/models` | ModelsPage | 모델 관리 |
| `/point-cloud` | PointCloudPage | 포인트 클라우드 |
| `/devices` | DevicesPage | 장비 관리 |
| `/anchors` | AnchorsPage | 앵커/맵 통합 |
| `/monitor` | MonitorPage | 실시간 모니터링 |
| `/settings` | SettingsPage | 시스템 설정 |
| `/login` | LoginPage | JWT 로그인 |
| `/point-cloud-qa` | PointCloudMeshQaPage | PC QA |

### 6.3 Zustand 스토어 (10개)

| 스토어 | 설명 |
|--------|------|
| **buildingStore** (1270줄) | 가장 큰 스토어. Buildings/Floors/Geometry/Devices 전반 관리 |
| **workflowStore** | 워크플로우 단계 관리 (localStorage 영속화) |
| **layerStore** | 레이어 가시성 관리 |
| **sessionStore** | 사용자 세션 (role, workspace) |
| **eventStore** | 이벤트 관리 |
| **historyStore** | 편집 이력 |
| **themeStore** | 테마 설정 |
| **toastStore** | 토스트 알림 |
| **languageStore** | 다국어 (i18n) |
| **apiConfigStore** | API URL 설정 (localStorage) |

### 6.4 API 클라이언트 (12개)

| 클라이언트 | 설명 |
|-----------|------|
| **client.ts** | Axios 인스턴스 + JWT 인터셉터 + 401 리디렉션 |
| **buildingApi.ts** | 건물 CRUD |
| **geometryApi.ts** | 벽/문/창/방 CRUD |
| **securityDeviceApi.ts** | 보안장비 CRUD |
| **uploadApi.ts** | DXF/Image/IFC 업로드 |
| **exportApi.ts** | OBJ/메타데이터 내보내기 |
| **viewerApi.ts** | 뷰어 데이터 |
| **pointCloudApi.ts** | 포인트 클라우드 |
| **gpsAlignmentApi.ts** | GPS 정합 |
| **pathfindingApi.ts** | 경로 탐색 |
| **types.ts** | API 요청/응답 타입 |

**JWT 인증 플로우**:
- localStorage에 `jwt_token`, `user_role`, `user_name` 저장
- Axios request interceptor가 모든 요청에 `Authorization: Bearer` 헤더 추가
- 401 응답 시 자동 `/login` 리다이렉트
- `x-authenticated-role` 헤더로 역할 전달

### 6.5 컴포넌트 계층 구조 (47개)

```
components/
├── ui/ (23개)         - Alert, Badge, Button, Card, Collapsible, Dropdown,
│                         FormField, IconButton, KpiCard, Modal, Panel,
│                         ResizablePanel, SlideInPanel, Slider, Spinner,
│                         StatusBadge, Tabs, Tooltip 등
├── editor/ (8개)      - DrawingToolbar, EditorToolbar, AlignmentStepsGuide,
│                         AnchorPointWorkflow, OSMAlignmentWorkflow 등
├── device/ (4개)      - DeviceDetailDrawer, DeviceListItem, DeviceTypeSelector,
│                         EnhancedDevicePanel
├── layout/ (4개)      - BuildingRequiredGuard, PageHeader, PageShell
├── grid/              - 그리드 관련
├── layer/             - 레이어 관련
├── workflow/          - 워크플로우 UI
├── dashboard/         - 대시보드 위젯
├── monitor/           - 모니터링 위젯
├── validation/        - 검증 관련
├── settings/          - 설정 관련
├── pointcloud/        - 포인트 클라우드 뷰어
├── hooks/             - 컴포넌트 레벨 훅
└── 핵심 컴포넌트:
    ├── UnifiedViewer.tsx      - 2D/3D 통합 뷰어 (1500+ 라인)
    ├── Canvas2DRenderer.tsx   - 2D 캔버스 렌더러 (585줄)
    ├── Canvas3DRenderer.tsx   - 3D Three.js 렌더러 (439줄)
    ├── CanvasIFCRenderer.tsx  - IFC 전용 렌더러
    ├── PropertyEditor.tsx     - 속성 편집기
    ├── SelectionBox.tsx       - 선택 박스
    └── DockingLayout.tsx      - 도킹 레이아웃 (react-mosaic)
```

### 6.6 캔버스 2D 아키텍처

**순수 함수 기반 모듈화** (총 150+ 테스트):
```
Canvas2DRender.ts (458줄)
  └── renderCanvas2D() - 메인 렌더링 함수
  └── renderSelectionHighlight() - 선택 강조
  └── renderDragPreview() - 드래그 프리뷰
  └── renderSnapPoints() - 스냅 포인트
  └── renderAlignmentGuides() - 정렬 가이드

Canvas2DEventHandlers.ts (387줄)
  └── findWallHandle(), findDeviceHandle()
  └── determineCursorStyle(), handleMouseClick/Move/Up/Down()

Canvas2DSelection.ts (445줄)
  └── performClickTest(), updateSelectionOnClick()
  └── getSelectedEntity()

Canvas2DRenderEnhancements.ts (320줄)
  └── 고급 렌더링 (드래그 프리뷰, 스냅, 정렬)
```

### 6.7 캔버스 3D 아키텍처

**Three.js 기반, Canvas2D와 동일 패턴**:
```
Canvas3DRender.ts (430줄)
  └── renderScene3D() - 씬 전체 렌더링
  └── renderWalls3D() / renderDoors3D() / renderWindows3D()
  └── renderRooms3D() / renderSecurityDevices3D()
  └── renderSelectedHighlight3D() / renderAnchorMarkers3D()

Canvas3DEventHandlers.ts (267줄)
  └── findWallHandle3D(), findDeviceHandle3D()
  └── handleMouseClick3D(), handleMouseMove3D()
  └── handleAnchorPick3D()

Canvas3DSelection.ts (260줄)
  └── performClickTest3D() (Raycasting)
  └── updateSelectionOnClick3D() / toggleSelection3D()

Canvas3DRenderUtils.ts (220줄)
  └── calculate3DBounds(), getFloorZOffset()
  └── setupLighting(), setupCamera()
  └── normalizeWall3D(), createWallCloneForSelection()

Canvas3DInteractionUtils.ts
  └── CameraViewPreset 등
```

### 6.8 좌표계 (매우 중요 ★)

``` 
Canvas2D:        X (좌우 = DXF X),  Y (상하 = DXF Y)
Canvas3D (Y-up): X (좌우 = DXF X),  Y (상하 = 높이),  Z (앞뒤 = DXF Y 변환)

WGS84 → 로컬 변환: coordinateTransformUtils.ts
  - wgs84ToLocal(lng, lat, origin) → {x, y} (미터 단위)
  - localToWgs84(x, y, origin) → {lng, lat}
  - 건물의 origin_longitude/latitude 기준점 사용
```

### 6.9 핵심 유틸 (shared/utils/)
```
renderingUtils.ts       (253줄) - Bounds 계산, Origin 설정
coordinateTransformUtils.ts (408줄) - WGS84 ↔ 로컬 좌표 변환
geometryUtils.ts        - 지오메트리 유틸
entityMetadata.ts       - 엔티티 메타데이터
alignmentUtils.ts       - 정합 유틸
floorAlignmentUtils.ts  - 층 정합
modelNormalizationUtils.ts - 모델 정규화
nominatimGeocoder.ts    - Nominatim 지오코딩
RoomAutoUtils.ts        - 방 자동 생성
SnapAndAlignmentManager.ts - 스냅/정렬 매니저
SelectionAndPickingManager.ts - 선택/피킹 매니저
drawAxisIndicator3D.ts  - 3D 축 표시
```

---

## 7. 마이크로서비스

### 7.1 IFC Processor (포트 8001)
- **용도**: IFC 파일 파싱 전용
- **기술**: Python FastAPI + ifcopenshell
- **API**: `POST /process-ifc`, `GET /health`
- **처리**: IfcWall/IfcDoor/IfcWindow/IfcSpace → WGS84 변환
- **특징**: EUC-KR/CP949 인코딩 자동 감지, 로컬→WGS84 좌표 변환

### 7.2 Image Processor (포트 8002)
- **용도**: 도면 이미지 파싱
- **기술**: Python FastAPI + OpenCV + scikit-image
- **API**: `POST /process-image`, `POST /extract-lines`, `GET /health`
- **처리**: Step A-G 파이프라인 (이진화 → 선 검출 → 벽/문/창/방 분류)
- **파라미터**: scale_px_per_meter, profile_id(AUTO/A1/A2/A3), 다양한 옵션
- **특징**: DrawingProfile 기반 최적화, 품질 진단, Opening Detection

### 7.3 DXF Export Service (포트 8003)
- **용도**: 빌딩 데이터를 DXF 파일로 내보내기
- **기술**: Python FastAPI + ezdxf
- **API**: `POST /export/dxf`, `POST /export/dxf/stats`, `GET /health`
- **처리**: JSON 빌딩 데이터 → AutoCAD DXF 파일 생성
- **특징**: 통계 정보 함께 반환, 임시 파일 자동 삭제

---

## 8. 인프라스트럭처

### 8.1 Docker Compose (6개 서비스)

```yaml
services:
  postgres:      # postgis/postgis:15-3.4, 포트 5432
  redis:         # redis:7-alpine, 포트 6379
  backend-rs:    # Rust Axum, 포트 3000 (볼륨: uploads, IFC_Folder)
  ifc-processor: # Python IFC, 포트 8001
  image-processor: # Python Image, 포트 8002
  frontend:      # React+Vite, 포트 5173 (볼륨: ./frontend)
  dxf-export:    # Python DXF, 포트 8003
```

### 8.2 네트워크
- `building_network` (bridge) - 모든 서비스 연결
- 프론트엔드 → `/api` 프록시 → `backend-rs:3000` (Docker) / `localhost:8000` (로컬)

### 8.3 볼륨
- `postgres_data` - DB 데이터 영속성
- `redis_data` - Redis 데이터
- `./workspace/uploads:/app/uploads` - 업로드 파일 (호스트 바인드)
- `./IFC_Folder:/app/IFC_Folder:ro` - IFC 샘플 (읽기 전용)

### 8.4 CI/CD (GitHub Actions)
- `ci.yml` - 5 jobs (테스트, 린트, 빌드)
- `docker-build.yml` - 4 services Docker 빌드 검증

### 8.5 포트 매핑 (개발 환경)

| 서비스 | 포트 | 비고 |
|--------|------|------|
| Frontend (Vite) | 5173 | dev server |
| Backend (FastAPI) | 8000 | Python |
| Backend-RS (Axum) | 3000 | Rust |
| PostgreSQL | 5432 | PostGIS |
| Redis | 6379 | - |
| IFC Processor | 8001 | Python |
| Image Processor | 8002 | Python |
| DXF Export | 8003 | Python |

---

## 9. 디자인 시스템

### 9.1 테마: SOC Professional Dark

```css
/* Base surfaces */
--color-surface: #0a0e17;          /* 가장 어두운 배경 */
--color-surface-raised: #111827;   /* 살짝 올린 표면 */
--color-panel: #1e2330;            /* 패널 배경 */
--color-panel-raised: #252b3b;     /* 강조 패널 */

/* Sidebar (좌측 네비게이션) */
--color-sidebar: #0d1117;
--color-sidebar-text: #8892b0;
--color-sidebar-text-active: #ffffff;

/* Primary accent (전기 파랑) */
--color-primary: #3b82f6;
--color-primary-hover: #2563eb;

/* Status colors */
--color-danger: #ef4444;           /* 알람/에러 */
--color-warning: #eab308;          /* 주의 */
--color-success: #22c55e;          /* 정상 */
--color-info: #3b82f6;             /* 정보 */

/* Text hierarchy */
--color-text-primary: #f0f2f5;     /* 고대비 */
--color-text-secondary: #9ca3af;   /* 중간 */
--color-text-tertiary: #6b7280;    /* 낮음 */

/* Entity colors (Canvas) */
--color-entity-wall: #90a4ae;
--color-entity-door: #a1887f;
--color-entity-window: #64b5f6;
```

### 9.2 레이아웃
- **DashboardLayout**: Sidebar + Header + Content 영역
- **DockingLayout**: react-mosaic-component 기반 분할 창
- **SlideInPanel**: 설정/속성 패널 (좌측 슬라이드)
- **ResizablePanel**: 리사이즈 가능한 패널

---

## 10. 워크플로우 ★중요

### 10.1 사용자 워크플로우 (6단계)

```
Step 1: 프로젝트 선택 (/projects)
  └── Building 생성/선택
  └── 건물명, 주소 입력 → 자동 지오코딩

Step 2: 데이터 소스 업로드 (/data-sources)
  └── DXF / PNG/JPG / IFC / GLB 업로드
  └── 서버 파싱 → Wall/Door/Window/Room 추출
  └── 층별로 업로드 (floor_number 지정)

Step 3: 3D 편집 (/editor/:buildingId)
  └── 2D/3D 뷰어 전환 (UnifiedViewer)
  └── Geometry 편집 (벽/문/창/방 CRUD)
  └── 보안 장비 배치 (Camera/Sensor/Alarm/Access Control)
  └── 속성 편집 (PropertyEditor)
  └── 도구: 그리기, 선택, 삭제, 숨김 레이어

Step 4: (생략 - 좌표 정합과 통합?)

Step 5: GPS 정합 (/alignment)
  └── WGS84 좌표 ↔ 로컬 좌표 변환
  └── 3점 정합, OSM 기반 정합
  └── 앵커 포인트 관리

Step 6: 검증 및 뷰어 (/validation)
  └── Geometry 검증
  └── 커버리지 분석 (카메라 시야각)
  └── 최종 뷰어
```

### 10.2 워크플로우 스토어
- `workflowStore.ts`에서 단계 관리
- mode별 step list 검증 및 복원
- localStorage에 진행률 저장 (`loadProgress()`)

### 10.3 현재 상태 (약 40% 완료)
- **입력 영역**: 60% (DXF, Image, IFC 업로드 완료)
- **편집 영역**: 86% (Geometry 편집, Device 배치, 저장)
- **운영 영역**: 0% (운영 Viewer, CCTV 연동, Dashboard 미구현)
- **좌표 정합**: 22%
- **검증**: 13%
- **권한/운영관리**: 10%
- **성능/대용량**: 20%

---

## 11. 재개발 주의사항

### 11.1 기술적 주의사항

#### 좌표계 일관성 ★매우중요
- 모든 지오메트리는 **WGS84 (SRID 4326)** 기반 위경도
- 프론트엔드에서는 `wgs84ToLocal()`로 로컬 미터 좌표 변환 후 렌더링
- Canvas3D는 **Y-up** 좌표계 (DXF Y → Three.js Z 변환 필요)
- 건물의 `origin_longitude/latitude`가 모든 좌표 변환의 기준점
- 2D와 3D 간 좌표 정합이 프로젝트의 가장 큰 난제 중 하나

#### 백엔드 이중 구조
- **FastAPI** (Python, 포트 8000) = 현재 메인 운영
- **Axum** (Rust, 포트 3000) = 차세대 마이그레이션 중
- 두 백엔드가 동일한 DB를 바라보지만 API 엔드포인트 구조가 다름
- 재개발 시 **Rust Axum**을 기준으로 하는 것을 권장 (더 많은 기능, WebSocket 내장, 인증 구현됨)

#### 업로드 처리
- DXF: ezdxf 라이브러리로 파싱, LineString → Wall
- 이미지: OpenCV Step A-G 파이프라인 (복잡한 컴퓨터 비전 처리)
- IFC: ifcopenshell 필요 (설치 까다로움, 별도 Docker 서비스로 분리)
- GLB: 텍스처 URI 정규화 필수
- 최대 업로드 크기: 5GB (백엔드-RS 기준)

#### 인증/인가
- FastAPI 백엔드: **인증 미구현** (사용자 요청으로 제외)
- Rust 백엔드: **JWT + Argon2 구현됨** (jsonwebtoken + argon2 크레이트)
- 프론트엔드: JWT 토큰 localStorage 저장, Axios 인터셉터로 모든 요청에 추가
- 401 응답 시 자동 `/login` 리다이렉트
- 재개발 시 인증/인가를 처음부터 포함할지 결정 필요

#### WebSocket
- Rust 백엔드에만 구현 (FastAPI에는 없음)
- `api/websocket.rs`: WsState (100개 버퍼), 브로드캐스팅
- 프론트엔드 `useWebSocket.ts`: 지수 백오프 + jitter (±25%) 재연결
- 이벤트 푸시, 실시간 알람, 협업 편집에 사용

#### Material 캐싱 (3D 성능)
- `SharedMaterials` 싱글톤 패턴 사용
- 매 프레임 `THREE.MeshStandardMaterial` 생성 방지
- **메모리 관리**: 매 프레임마다 메시 재생성 금지, `scene.remove()` 후 제거
- **Raycasting**: `camera.updateMatrixWorld()` 필수 호출
- **인스턴싱**: 대량 geometry는 InstancedMesh 고려

#### 현재 알려진 이슈
1. `react-map-gl` 모듈 누락
2. `CoverageHeatmapViewer.tsx` 타입 에러
3. `EditorPage.tsx` props 에러
4. 3D 검은 화면: `wgs84ToLocal` import 누락, origin 설정 문제
5. RoomUpdate `points→boundary` 필드 불일치 (프론트-백엔드 간)

### 11.2 개발 환경 설정
```
# 필수 설치
- Node.js 22+
- Python 3.11+
- Rust (최신 nightly)
- Docker Desktop
- PostgreSQL 15 + PostGIS (또는 Docker)

# 로컬 개발
docker-compose up postgres redis   # DB만 Docker로
cd frontend && npm run dev          # Vite dev server :5173
cd backend && uvicorn app.main:app  # FastAPI :8000
cd backend-rs && cargo run          # Axum :3000

# 중요한 .env 변수
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/total_building_db
UPLOAD_DIR=./uploads
IFC_SAMPLE_DIR=../IFC_Folder
VITE_API_BASE_URL=http://localhost:8000  # 또는 http://localhost:3000
```

### 11.3 재개발 전략 제안

#### Option A: Python FastAPI로 처음부터 재개발 (추천)
- **이유**: 가장 안정적이고 완성도 높음, 많은 테스트 존재
- **단점**: Rust만의 WebSocket/성능 기능 포기

#### Option B: Rust Axum으로 재개발 (장기적)
- **이유**: 더 나은 성능, WebSocket 내장, 인증 구현됨
- **단점**: 상대적으로 덜 검증됨, FastAPI의 많은 서비스 코드 포기

#### Option C: 듀얼 트랙 유지
- **이유**: 기존 FastAPI 유지하면서 Rust로 점진적 마이그레이션
- **단점**: 유지보수 복잡도 2배

**권장**: Option A (Python FastAPI)로 깔끔하게 재개발하고, 필요시 Rust는 별도로 점진적 도입

---

## 12. 개발 로드맵 (재개발 순서)

### Phase 1: 프로젝트 기반 (1-2주) -- 완료
- [x] 프로젝트 생성 (workspace/ 기반 monorepo)
- [x] Docker Compose 설정 (PostgreSQL + PostGIS + Redis)
- [x] FastAPI 기본 구조 (main.py, db.py, 모델, 라우터)
- [x] React + Vite + TypeScript 설정 (CSS 커스텀 속성, Tailwind 미사용)
- [x] Building/Floor CRUD API
- [x] ProjectsPage Building 목록/생성 UI
- [x] 기본 CI/CD 파이프라인

### Phase 2: 핵심 API (2-3주) -- 일부 완료
- [x] Building CRUD API (중복 검사 포함)
- [x] Floor CRUD API
- [x] DXF/Image/IFC 업로드 API (파일 저장 + 메타데이터)
- [x] Geometry API (Wall/Room CRUD - models, schemas, router, tests)
- [x] Door/Window API (CRUD)
- [x] Security Device API (CRUD)

### Phase 3: 프론트엔드 기본 (2-3주) -- 일부 완료
- [x] 라우팅 및 레이아웃 (AppShell, Sidebar, Outlet)
- [x] 페이지: Projects, DataSources, Editor, Alignment 등 7개
- [x] 업로드 폼 (DataSourcesPage, 파일 업로드 + 건물/층 연동)
- [x] Workflow Store (Zustand)
- [x] API 클라이언트 (fetch 기반, client.ts)

### Phase 4: 2D/3D 뷰어 (3-4주) ★가장 어려움
- [x] Canvas 2D 렌더러 (HTML5 Canvas, 그리드/벽/방/스케일바)
- [x] Canvas 2D 이벤트/선택/스냅
- [x] Three.js 3D 씬 설정 (@react-three/fiber, OrbitControls, Grid)
- [x] Canvas 3D 렌더러 (벽 mesh, 방 area, Extrude)
- [x] 2D/3D 뷰어 통합 (EditorPage, view mode toggle)
- [x] 좌표 변환 유틸 (coordinateTransform.ts, WGS84/local)

### Phase 5: 편집 기능 (2-3주)
- [x] Geometry 편집 (DrawingToolbar, PropertyPanel, 선택/벽 그리기/삭제)
- [x] 보안 장비 배치 (DeviceTypeSelector, 드래그 드롭)
- [x] 선택/강조/레이어 관리
- [x] 편집 이력 (Undo/Redo)
- [x] 숨김 레이어, 필터링

### Phase 6: 고급 기능 (3-4주)
- [x] GPS 정합 (Alignment 페이지)
- [x] 포인트 클라우드 (LAS/LAZ/Potree)
- [x] 커버리지 분석
- [x] 경로 탐색 (Pathfinding)
- [x] 내보내기 (OBJ/DXF/PDF/CSV)
- [x] WebSocket 실시간 통신

### Phase 7: 운영/완성 (2-3주)
- [x] 모니터링 페이지 (대시보드, 알람)
- [x] 검증 페이지 (Validation)
- [x] 성능 최적화 (인스턴싱, LOD, 지연 로딩)
- [x] i18n 다국어
- [x] 접근성 (aria, 키보드 네비게이션)
- [x] E2E 테스트 (Playwright)
- [x] 문서화

### 예상 총 소요: **3-4개월** (1인 풀타임 기준)

### 현재 진행 상황 (2026-07-07)
- Phase 1 완료
- Phase 2: Building/Floor CRUD + 업로드 API + Geometry API + Door/Window API + Security Device API 완료
- Phase 3: 라우팅/레이아웃/페이지/스토어/API 클라이언트 + DataSourcesPage 업로드 폼 완료
- Phase 4: 2D/3D 뷰어 (Canvas2DViewer + ThreeJSViewer + EditorPage 통합) + Canvas 이벤트/선택/스냅 완료
- Phase 5: Geometry 편집 + 보안 장비 배치 + Undo/Redo + 선택/레이어 관리 완료
- Phase 6: GPS 정합 (AlignmentPage + 앵커 포인트 + OSM 지도 + Helmert 변환) 완료
- Phase 6: 포인트 클라우드 + 커버리지 분석 + 경로 탐색 + WebSocket 모니터링 완료
- Phase 6: 내보내기 (ExportPage + OBJ/DXF/PDF/CSV + DXF backend fallback) 완료
- Phase 7: 모니터링/검증/i18n/접근성/지연 로딩/E2E/문서화 완료
**스택 변경사항**:
- Tailwind 대신 CSS 커스텀 속성 (SOC Professional Dark 테마 유지)
- Axios 대신 fetch 기반 경량 클라이언트
- JWT 인증 제외 (MVP 단계)
- Rust Axum 백엔드 제외 (Python FastAPI 단일 트랙)
- 마이크로서비스 제외 (단일 FastAPI 서버)

**다음 단계**: 보안 장비 배치 / 레이어 관리 / 편집 이력 (Undo/Redo)

---

## 부록: 주요 파일 참조

### 프론트엔드 핵심 파일
| 파일 | 설명 | 중요도 |
|------|------|--------|
| `frontend/src/App.tsx` | 메인 라우터 (워크플로우 페이지 연결) | ★★★ |
| `frontend/src/store/buildingStore.ts` | 가장 큰 스토어 (1270줄) | ★★★ |
| `frontend/src/api/client.ts` | API 클라이언트 + JWT 인터셉터 | ★★★ |
| `frontend/src/shared/utils/coordinateTransformUtils.ts` | WGS84 ↔ 로컬 변환 | ★★★ |
| `frontend/src/components/UnifiedViewer.tsx` | 2D/3D 통합 뷰어 (1500+줄) | ★★★ |
| `frontend/src/services/geometryRenderer.ts` | Three.js 지오메트리 렌더링 | ★★☆ |
| `frontend/src/components/Canvas2DRenderer.tsx` | 2D 캔버스 렌더러 | ★★☆ |
| `frontend/src/components/Canvas3DRenderer.tsx` | 3D 씬 렌더러 | ★★☆ |
| `frontend/src/pages/EditorPage.tsx` | 메인 편집 페이지 | ★★★ |
| `frontend/src/pages/DataSourcesPage.tsx` | 업로드 페이지 | ★★☆ |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket 재연결 훅 | ★★☆ |

### 백엔드 핵심 파일
| 파일 | 설명 | 중요도 |
|------|------|--------|
| `backend/app/main.py` | FastAPI 앱 진입점 (+startup 마이그레이션) | ★★★ |
| `backend/app/db.py` | DB 엔진/세션 설정 | ★★★ |
| `backend/app/api/buildings.py` | Building CRUD (+지오코딩) | ★★★ |
| `backend/app/api/upload.py` | 파일 업로드 (DXF/Image/IFC/GLB) | ★★★ |
| `backend/app/api/geometry.py` | Geometry CRUD | ★★★ |
| `backend/app/models/*.py` | SQLAlchemy 모델 (10개) | ★★★ |
| `backend/app/services/input_processors/` | DXF/Image/IFC 파서 | ★★★ |
| `backend/migrations/001_initial_schema.sql` | 전체 DB 스키마 | ★★★ |
| `backend/app/middleware/rate_limiter.py` | Rate Limiting | ★☆☆ |
| `backend/app/middleware/request_logger.py` | 요청 로깅 | ★☆☆ |

### Rust 백엔드 핵심 파일
| 파일 | 설명 | 중요도 |
|------|------|--------|
| `backend-rs/src/main.rs` | Axum 앱 진입점 (라우트 등록) | ★★★ |
| `backend-rs/src/api/websocket.rs` | WebSocket 구현 | ★★★ |
| `backend-rs/src/api/auth.rs` | JWT 인증 | ★★★ |
| `backend-rs/src/config.rs` | 환경 설정 | ★★★ |

---

> **이 문서는 building-editor 프로젝트의 전체 분석을 바탕으로 작성되었습니다.**
> **재개발 시 이 문서를 참고하여 A-Z까지 빠짐없이 구현하세요.**

---

## Codex UI 마이그레이션 진행 현황 (2026-07-07)

- [x] 홈 페이지: 시작/워크플로우 개념을 가져와 현재 블랙/그레이 셸에 적용
- [x] 프로젝트 페이지: 프로젝트 선택 및 층 관리 레이아웃 도입
- [x] 데이터 소스 페이지: 층 선택기, 상태 패널, Image/DXF/DWG/IFC/GLB/GLTF/PointCloud 5개 업로드 분기 도입 (소스별 옵션 포함); 분기 카드는 소스 유형만 선택, 업로드 존에 이모지/대상 업로드 라벨/예시 플로우/지원 포맷/DXF-DWG 및 GLB-GLTF 가이드 노트 배치, 파일 선택기는 전용 Choose File 버튼으로 열리고 리셋 버튼이 옆에 위치
- [x] 3D 에디터 페이지: 좌측 층/건물 패널, 중앙 2D/3D/분할 뷰포트, 플로팅 도구, 뷰모드 바, 우측 설정/속성 패널, Beta 전체층 팝업, 참조형 업로드/내보내기 팝업 플로우로 재구성, 레이어 리셋 제거, 보안장치 새로고침 추가, 배치된 3D 장치 마커에 글로우/조명 효과 업그레이드
- [x] 앱 워크플로우 컨트롤: Build 워크플로우 진행 상황을 콘텐츠 영역 상단으로 이동, 하단 바는 Previous/Next/End Workflow 내비게이션만 표시
- [x] GPS 정렬 페이지: 메서드 분리, 뷰모드 전환, 모델 앵커 선택, OSM 타일 맵 패널, Origin/Point1/Point2 GPS 마킹, 정렬 계산/적용 플로우를 갖춘 참조형 OSM/Cesium 정렬 워크스페이스로 재구축
- [x] 검증 페이지: 점수 패널 및 검증 체크리스트 재구축
- [x] 대시보드 페이지: 4개 KPI 카드, buildings API 기반 건물 인벤토리 그리드, 최근 이벤트 피드, 모델/장치/정렬 준비 상태 신호, 블랙/그레이 반응형 스타일의 참조형 SOC 대시보드로 재구축
- [x] 모델 관리 페이지: 건물 컨텍스트 선택기, Image/DXF/IFC/GLB 소스 상태 카드, PointCloud 게이트웨이, 층 분리 결과 테이블, 에디터/데이터소스 액션, 업로드/층 API 연동을 갖춘 참조형 모델 소스 허브로 재구축
- [x] PointCloud 페이지: 건물/층 선택기, 4개 상태 카드, 워크플로우 가이드, 업로드/연결 탭, 연결된 소스 카드, 다음 단계 에디터 카드를 갖춘 참조 페이지 레이아웃 재도입, 현재 백엔드 업로드 API를 통한 LAS/LAZ/PLY 업로드 유지
- [x] 장치 관리 페이지: KPI 카드, 에디터 연결 인벤토리, 유형 분포, 선택 장치 상세, 배치 가이드, 정리된 장치 라벨, CAM/SNS/ALM/ACS 약어를 에디터 매칭 장치 아이콘으로 대체한 참조형 운영 핸드오프로 재구축
- [x] 앵커/맵 페이지: 앵커 테이블, 실제 GPS 마커 위치의 OSM 타일 맵 패널, 공통 OSM/Cesium 스타일 맵 렌더러를 사용한 정렬 요약 재구축
- [x] 모니터 페이지: 상단 컨트롤 바, 건물/층 트리, 공간 모니터 뷰포트, 장치/이벤트 우측 탭, 하단 로그/카메라 패널, 레이어 토글, 실시간 데모 이벤트를 갖춘 참조형 운영 콘솔로 재구축
- [x] 백엔드 참조 마이그레이션 시작: 비교 백엔드 분석 및 현재 프로젝트 FastAPI 엔드포인트 추가 (건물 업데이트, OSM 맵 설정, 건물/층 공간 설정, GPS 3포인트/단일/배치 어파인 정렬, pytest 커버리지)
- [x] PointCloud 유지보수: 백엔드 파일 업로드 검증/상태 처리 강화, 업로드된 PointCloud 자산을 에디터 포인트클라우드/3D 씬 객체 생성에 연결
- [x] PointCloud 렌더링 상한: 에디터 포인트클라우드 생성 시 500,000 포인트 상한 설정, 자산 로딩 중 포인트 생성 애니메이션 추가
- [x] 에디터 전체층 팝업 유지보수: 참조형 층 목록, 적층 미리보기, X/Z/R 조정 모드, 드래그/휠/홀드 컨트롤, 밝기 토글, 기준점 선택, 마커 크기 제어, 리셋 플로우를 갖춘 Beta 층 적층 팝업 재구축
- [x] 페이지 헤더 정리: 모든 페이지 제목/설명 헤더를 블랙/그레이 UI에 맞춘 컴팩트한 모던 커맨드바 스타일로 통일
- [x] 백엔드 프로젝트 데이터 설계/개발: Image/DXF/DWG/IFC/PointCloud/보안장치의 건물 범위 자산 메타데이터 및 객체 배치 스토리지 추가, 객체별 변환값 및 프로젝트 요약 API
- [x] Docker LAN 접근: 프론트엔드/API 컴포즈 포트를 `0.0.0.0`으로 개방, Postgres/Redis는 로컬 전용 유지, 백엔드 LAN CORS 정규식 추가, `http://<HOST_PC_IP>:5174`를 통한 동일 네트워크 접근 문서화
- [x] 임시 인터넷 접근: 백엔드/데이터베이스 포트를 비공개로 유지하면서 임시 `trycloudflare.com` HTTPS URL을 통해 외부 네트워크에서 로컬 Docker UI에 접근 가능한 Cloudflare Tunnel 컴포즈 오버레이 추가
- [x] 에디터 뷰 분리: PointCloud 자산을 일반 3D 뷰에서 분리, PointCloud 객체 생성을 전용 PointCloud 뷰로 이동, 에디터 좌측 패널의 중복 건물/레이어 섹션 제거
- [x] 에디터 사이드바/렌더 안정화: 라이브 Docker UI에서 좌측 빌딩 블록이 한 번만 렌더링됨을 확인, 외부 drei HDR 환경 프리셋 제거로 HDR 자산 로드 실패 시 3D 씬 충돌 방지
- [x] GPS 정렬 페이지 재구성: 뷰모드 분할 컨트롤 제거, 중앙을 3D 모델 오버레이가 있는 단일 OSM 맵으로 재구축, Set Reference Points 버튼으로 열리는 Reference Point 팝업 추가, 시/도/구/동 선택과 맵 클릭 좌표가 동기화되도록 연결

## 외부 접근 / 공용 경로 계획

- [x] 동일 네트워크 접근: Docker Compose가 프론트엔드와 API만 `0.0.0.0`으로 노출하여, 동일 LAN의 다른 PC에서 `http://<HOST_PC_IP>:5174`로 접근 가능
- [x] 임시 외부 접근: Cloudflare Tunnel 지원을 위한 `workspace/docker-compose.tunnel.yml` 추가. `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build` 실행 후 `cloudflared` 로그에서 `https://....trycloudflare.com` URL 복사
- [x] 백엔드/API 경로 보존: 외부 터널이 프론트엔드 컨테이너를 가리키고, 프론트엔드가 Docker 내부 백엔드로 `/api` 프록시 유지. Postgres/Redis 노출 및 백엔드/데이터베이스 포트의 직접적인 인터넷 개방 방지
- [ ] 영구 공용 도메인: 실제 도메인을 Cloudflare에 연결, named tunnel 생성, `https://spatial.example.com`과 같은 호스트명을 `http://frontend:5173`에 매핑
- [x] HTTPS 프로덕션 게이트웨이: Vite 개발 서버를 영구 노출하는 대신 HTTPS, 압축, 보안 헤더, 정적 프론트엔드 서빙을 갖춘 프로덕션 리버스 프록시 프로필 추가
- [x] 접근 제어: 영구 외부 URL 공유 전에 로그인/세션 또는 토큰 기반 접근 추가
- [x] 환경 분리: local, tunnel-demo, staging, production 환경 파일을 분리하여 CORS, URL, 업로드 제한, 데이터베이스 설정이 혼용되지 않도록 함

### 영구 도메인 연결 시 사용자 작업

- [ ] 도메인 구매 또는 보유 도메인 준비
- [ ] Cloudflare 계정에 도메인 추가
- [ ] 도메인 등록기관에서 Cloudflare가 안내하는 네임서버로 변경
- [ ] Cloudflare 대시보드 또는 `cloudflared` CLI에서 named tunnel 생성
- [ ] 생성된 tunnel ID와 credentials JSON 파일을 확보
- [ ] 연결할 실제 호스트명 결정 예: `spatial.example.com`
- [ ] `workspace/cloudflare-tunnel.config.example.yml`의 `tunnel`, `credentials-file`, `hostname` 값을 실제 값으로 교체
- [ ] `workspace/.env.production.example` 또는 실제 `.env.production`의 `CORS_ORIGIN_REGEX`, `API_ACCESS_TOKEN`, `POSTGRES_PASSWORD`를 운영 값으로 교체
- [ ] Docker production/tunnel 실행 후 Cloudflare DNS에서 hostname이 tunnel로 연결되는지 확인
- [ ] 외부 접속 테스트: `https://<실제도메인>` 접속, 로그인/API/업로드/모니터 WebSocket 동작 확인

## 향후 개발 권장 사항 (우선순위별)

### 🔴 Critical Path (필수)

- [x] **프로젝트 저장/로드 워크플로우**: 모든 건물 프로젝트가 층, 업로드, 모델 자산, 장치 위치, 정렬 상태, 앵커/맵 데이터, 대시보드 상태를 백엔드 스토리지에서 복원하도록 보장
- [x] **실제 객체 배치 영속화**: 에디터 보안장치/객체 배치 변경사항을 새로운 백엔드 객체 배치 API에 직접 연결 (실행취소/재실행 히스토리 포함)
- [x] **인증 및 권한 부여**: 사용자 로그인, 역할 권한, 프로젝트 수준 접근 제어, 건물/프로젝트 데이터 API 가드 추가

### 🟡 High Priority (우선)

- [x] **영구 파일 파이프라인**: 업로드된 Image/DXF/DWG/IFC/GLB/GLTF/PointCloud 파일을 메타데이터, 처리 상태, 썸네일, 파생 지오메트리 레코드와 함께 저장
- [x] **프로덕션 Docker 프로필**: 빌드된 프론트엔드 자산, non-root 컨테이너, 헬스체크, 재시작 정책, 백업 볼륨을 갖춘 프로덕션 컴포즈 파일 추가
- [x] **보안 기준**: 속도 제한, 요청 로깅, 업로드 바이러스/유형 검증, 소스 유형별 파일 크기 제한, 시크릿 관리 추가
- [x] **데이터베이스 마이그레이션**: 자동 테이블 생성 방식을 Alembic 마이그레이션으로 대체하여 안전한 스키마 진화
- [x] **CI 품질 게이트**: 모든 PR에서 백엔드 pytest/ruff 및 프론트엔드 lint/build/playwright 검사 실행

### 2026-07-10 필수 1~3 반영

- [x] 현재 선택 건물 저장소(`projectStore`)를 추가하고 Projects/Data Sources/Editor/Alignment/Validation/Monitor/Models/PointCloud가 같은 건물 컨텍스트를 우선 사용하도록 연결
- [x] 에디터 보안장치 배치를 `PUT /api/buildings/{building_id}/object-placements/sync`로 일괄 동기화하여 중간 실패 가능성을 줄이고 백엔드 객체 배치 API를 저장 기준으로 사용
- [x] 로그인 API, 선택적 API 토큰 미들웨어, 프론트 API 토큰 헤더 연결, 인증/배치 동기화 백엔드 테스트 추가

### 2026-07-10 우선 1~5 반영

- [x] 업로드 파일 소스별 확장자/크기 검증, 파이프라인 `derivative_records`, 썸네일 URI, 영구 파일 URI 메타데이터 추가
- [x] `docker-compose.prod.yml`, 백엔드/프론트 프로덕션 Dockerfile, nginx 정적 서빙/프록시, 헬스체크/재시작/백업 볼륨 구성 추가
- [x] API 요청 로깅, IP 기반 분당 레이트리밋, 선택적 토큰 인증과 업로드 유형 검증을 보안 기준으로 반영
- [x] Alembic 초기 구성 및 `0001_initial_schema` 마이그레이션 추가
- [x] CI를 Node 24 기반 프론트 lint/test/build/e2e 및 백엔드 ruff/pytest 게이트로 확장

### 🟢 Nice-to-Have (선택)

- [x] **Cesium/OSM 프로덕션 강화**: 타일 제공자 구성, 오프라인/폴백 맵 동작, GPS 정확도 메타데이터, 정렬 감사 로그 추가
- [x] **Editor 패널 사용성 보강**: Properties 패널의 선택 객체별 편집 입력값, 좌표/크기 직접 수정, 디바이스 이름/타입 수정, 변경 즉시 자동 저장 UX 추가
- [x] **프로젝트 선택 일관성**: Alignment/Validation/Monitor가 첫 번째 building을 기본값으로 쓰는 흐름을 명시적 현재 프로젝트 선택/전역 프로젝트 컨텍스트로 통합

### 2026-07-11 Cesium/OSM 프로덕션 강화 반영

- [x] OSM 타일 프록시에 provider URL/name 설정값, 로컬 디스크 캐시, stale-cache 재사용, 생성형 fallback SVG 타일을 추가해 외부 타일 서버 장애 시에도 Alignment/Monitor 지도 평면이 완전히 검정 화면으로 무너지지 않도록 보강
- [x] `/api/osm-tiles/status` 상태 API를 추가하고 Alignment 우측 워크플로우 패널 및 Monitor 지도 HUD에 provider/cache/fallback 상태를 표시
- [x] GPS 3점 정합 API 응답에 RMSE meter, 평균/최대 오차, quality 등급을 포함하는 정확도 메타데이터를 추가
- [x] `alignment_audit_logs` 테이블과 `/api/gps-alignment/buildings/{building_id}/audit-logs` API를 추가해 3점 정합 실행 이력, 제어점, 행렬, 정확도 결과를 건물 단위로 추적
- [x] Alignment 프론트 정합 실행 시 기존 로컬 화면 계산은 유지하면서 백엔드 3점 정합 API를 호출해 정확도 계산과 감사 로그가 함께 저장되도록 연결
- [x] **WebSocket 실시간 레이어**: 실시간 업로드 진행률, 장치 상태 업데이트, 모니터 이벤트, 다중 사용자 편집 알림 구현
- [x] **내보내기 파이프라인**: 백엔드 데이터에서 다운로드 가능한 프로젝트 패키지, DXF/OBJ/GLB/PDF 보고서, 검증 요약 생성

### 2026-07-10 도메인 제외 운영 준비 반영

- [x] `.env.local/.env.tunnel-demo/.env.staging/.env.production` 예시 파일과 Cloudflare named tunnel 설정 템플릿 추가
- [x] Nginx 프로덕션 게이트웨이에 압축, 캐시, 보안 헤더, WebSocket upgrade 프록시 추가
- [x] FastAPI `/api/realtime/ws` WebSocket 이벤트 채널과 모니터 WebSocket URL 연동
- [x] FastAPI `/api/exports/{dxf,csv,package}` 백엔드 Export API와 프론트 Export Package 다운로드 연결
- [x] Editor Properties 패널에서 벽/방/장치 이름, 타입, 좌표, 크기, 각도 직접 편집 및 기존 자동 저장 흐름 연동
- [x] Editor Properties 입력 UX 보강: 필드 포커스 시 한 번만 undo 히스토리를 기록하고 입력 중에는 상태만 갱신하도록 변경해 숫자/텍스트 입력마다 히스토리가 과도하게 쌓이는 문제를 줄임
- [x] Editor Properties 저장 상태 표시: 패널 상단에 자동 저장 상태 배지를 추가하고, 숫자 입력 draft/검증/blur 복원 처리로 잘못된 값이 씬 상태를 깨뜨리지 않도록 보강

## Recent Corrections

- [x] Monitor 포트 연결 추적 및 문서화: Cloudflare Tunnel → Nginx (`monitor.nginx.conf`, port 8082) → monitor_frontend (`MONITOR_PORT=9011`) 경로 분석 완료. `workspace/nginx/monitor.nginx.conf`가 `/monitor/` 경로를 `http://monitor_frontend:9011`로 프록시하고, MONITOR_PORT가 docker-compose와 `.env.docker`를 통해 전달됨을 확인. tunnel 외부 접근 시 `/monitor/` 경로로 컨테이너 모니터링 UI 접근 가능.
- [x] Alignment 빌드 수리: 현재 Alignment 페이지에서 오래된 비교 프로젝트 임포트 제거, 기존 OSM 정렬 컴포넌트/훅 복원, 3컬럼 정렬 워크스페이스 유지, 프론트엔드 프로덕션 빌드 통과 확인
- [x] 프로젝트 영속화 우선 1/2 백엔드 기반: 에디터/정렬/뷰 상태 복원을 위한 건물 단위 프로젝트 스냅샷 저장/로드 API 추가, 업로드 시 자동 프로젝트 자산 등록, 업로드 파이프라인 상태 추적, 연결된 자산 상태 동기화, 프로젝트 데이터/스냅샷/파이프라인 사용을 위한 프론트엔드 API 클라이언트 추가
- [x] 프로젝트 영속화 우선 1/2 프론트엔드 연결: Data Sources가 백엔드에서 건물 프로젝트 스냅샷을 로드/저장하도록 연결, 복원된 스냅샷 상태 표시, 소스별 업로드 파이프라인 상세 조회, 현재 블랙/그레이 UI에 연결된 자산/다음 액션 상태 표시
- [x] 에디터 영속화 step 1: 에디터 보안 장치 배치가 백엔드 `object_placements` 저장소를 사용할 수 있도록 프론트엔드 객체 배치 API 클라이언트(list/create/delete) 추가
- [x] 에디터 영속화 step 2: Undo/Redo 히스토리를 오염시키지 않도록 벽, 방, 보안 장치, 가시 레이어, 스냅 모드에 대한 에디터 스토어 복원 지원 추가
- [x] 에디터 영속화 step 3: Editor 페이지를 백엔드 프로젝트 스냅샷에 연결하여 로드 시 건물 단위 에디터 상태, 선택된 층, 뷰 모드, PointCloud 업로드 참조가 복원되도록 함
- [x] 에디터 영속화 step 4: Editor에서 프로젝트 스냅샷으로 디바운스 자동 저장 추가, 배치된 보안 장치를 변환 메타데이터와 함께 백엔드 객체 배치 레코드에 동기화
- [x] 에디터 영속화 step 5: 컴팩트한 에디터 자동 저장 상태 표시줄 추가, 영속화 연결 후 프론트엔드 빌드, 백엔드 pytest, backend ruff 검증 완료
- [x] 프로젝트 스냅샷 섹션 병합: 프론트엔드 프로젝트 스냅샷 쓰기를 페이지별 섹션 병합 방식으로 변경하여 Data Sources, Editor, Alignment, PointCloud 상태가 서로 덮어쓰지 않도록 함
- [x] Alignment 영속화 확장: 활성 건물/층 로드, OSM 원점, 층, 카메라 모드, 정렬 방식, 앵커 선택, GPS 입력, 행렬/RMSE, 변환된 GPS, 빌보드 상태를 프로젝트 스냅샷에서 복원
- [x] Alignment 자동 저장: GPS 정렬 워크플로우 변경사항에 대한 디바운스 스냅샷 영속화 및 컴팩트 저장 상태 UI 추가
- [x] PointCloud 영속화 확장: 선택된 건물 층, 활성 탭, 체크된 업로드 ID, 업로드 가시성 컨텍스트를 프로젝트 스냅샷에서 복원
- [x] PointCloud 자동 저장: 선택된 PointCloud 업로드 ID, 준비된 업로드 ID, 활성 탭, 선택된 층, 업데이트 타임스탬프를 저장하여 Editor/PointCloud 뷰 연속성 확보
- [x] 업로드 파이프라인 step 1: 기존 업로드 동작을 유지하면서 queued/validating/converting/preview_ready 단계로 업로드 상태 계약 확장
- [x] 업로드 파이프라인 step 2: Image, DXF/DWG, IFC, GLB/GLTF, PointCloud 소스 유형별 파이프라인 메타데이터 추가 (지원 포맷, 파생 출력물, 프리뷰 준비 상태, 실패 사유 포함)
- [x] 업로드 파이프라인 step 3: 프로젝트 자산 메타데이터에 파이프라인 단계, 진행률, 저장 파일명, 파일 크기, 지원 포맷, 파생 출력 레코드 추가
- [x] 업로드 파이프라인 step 4: Data Sources에 파이프라인 단계/진행률 표시, ready/preview_ready 자산의 Models 상태 해석 수정, PointCloud 상태 처리 확장
- [x] 업로드 파이프라인 step 5: 파이프라인 상세/진행률/실패 메타데이터에 대한 프론트엔드 빌드, 백엔드 pytest, backend ruff, 백엔드 계약 커버리지 검증 완료
- [x] Validation 비교 UI 이식: 현재 Validation 페이지를 비교 프로젝트의 KPI + 층 체크리스트 + 중앙 3D 검증 프리뷰 + 우측 요약/이슈 패널 레이아웃으로 재구축, 현재 프로젝트의 실제 에디터/정렬 검증 계산 및 블랙/그레이 테마 유지
- [x] GPS 정렬 3D 보정: 가짜 2D OSM/객체 오버레이를 실제 Three.js 3D 정렬 뷰로 대체 (OSM 스타일 지면, 도로/그리드 레이어, 모델 객체, 궤도 컨트롤, GPS 참조 마커 포함)
- [x] PointCloud 실제 파일 렌더링: 백엔드에서 업로드된 포인트클라우드 파일/프리뷰 URL 노출, 50만 포인트 제한의 캐시된 LAS Float32 프리뷰 엔드포인트 추가, 에디터 PointCloud 뷰가 합성 나선/원 플레이스홀더 대신 실제 업로드된 LAS/PLY 데이터에서 샘플링된 포인트를 렌더링하도록 변경
- [x] PointCloud LAS RGB 색상 반영: 백엔드 프리뷰를 `XYZRGB` 바이너리로 확장하고, 3D PointCloud View에서 업로드 파일의 색상 정보를 vertex color로 표시하도록 수정.
- [x] PointCloud 원본 LAS fallback 색상 반영: 프리뷰 API를 사용할 수 없는 경우에도 브라우저 LAS 파서가 RGB 필드를 읽어 표시하도록 보강.
- [x] PointCloud 연결 목록 유지보수: 업로드된 파일 카드에 선택/해제 가능한 체크박스, 전체 선택/해제, 단일 삭제 버튼을 추가하고 삭제 시 원본 파일 및 프리뷰 캐시를 정리하도록 백엔드 API 추가.
- [x] PointCloud 객체 생성 안정화: 대용량 RGB 프리뷰 생성 중 화면이 비지 않도록 1만 포인트 빠른 프리뷰를 먼저 표시하고 이후 최대 50만 포인트 프리뷰로 교체하는 progressive 로딩 및 LAS 메모리맵 샘플링 적용.
- [x] PointCloud 200만 포인트 및 색상 보정: LAS point format 3/5 RGB 오프셋을 28번으로 수정, 잘못된 이전 RGB 캐시를 피하도록 preview cache v2 적용, 최대 2,000,000점 렌더링으로 상향, 원본 RGB가 더 선명하게 보이도록 포인트 투명 블렌딩 제거 및 렌더 DPR 최적화.
- [x] Alignment OSM 패널 복원: 정렬 페이지 중앙 뷰가 전용 참조 맵 패널과 함께 OSM 타일 맵을 표시하도록 유지, 우측 패널을 원점 선택 → 3점 매칭 → 적용/저장 검토의 이전 스타일 3단계 OSM 정렬 워크플로우로 복원
- [x] Alignment 비교 UI 이식: 정렬 페이지를 비교 프로젝트의 3컬럼 워크플로우 레이아웃으로 재구축 (좌측 방식/층/뷰 컨트롤, 중앙 실제 3D OSM/모델 뷰, 우측 OSM 정렬 워크플로우 패널 - 현재 블랙/그레이 인터페이스 스타일 적용)
- [x] Alignment UI 정리: GPS 정렬 페이지를 현재 블랙/그레이 디자인 토큰으로 강제 전환, 중앙 3D OSM 뷰 확대, OSM 폴백 맵 렌더링 복원, 잠긴 단계 상태 및 호버 가이드가 있는 우측 OSM 워크플로우 패널 재구축, 좌측/뷰/우측 섹션 수직 정렬
- [x] Alignment 뷰 오버레이 수정: 과도하게 큰 좌표/푸터 HUD 요소로 인한 전체 캔버스 어두운 오버레이 제거, 가시적인 OSM 폴백 레이어 추가, 로컬 Docker 프론트엔드에서 맵/모델 뷰가 정상 표시됨을 확인
- [x] Alignment 3D 맵 구조 수정: DOM/배경 맵 레이어 제거, 회색 3D 씬 배경 복원, OSM 이미지를 건물 모델 아래 텍스처 처리된 Three.js 지면 객체로만 유지
- [x] Alignment 맵 평면 가시성: OSM 지면 위에 도로/녹지/건물 Footprint 세부 정보를 얇은 Three.js 평면 지오메트리로 추가하여 맵이 화면 배경이 아닌 3D 바닥 객체로 인식되도록 함
- [x] Alignment OSM 타일 일관성: 백엔드 OSM 타일 프록시 추가, 참조 포인트 팝업 맵과 3D 정렬 지면이 동일한 `/api/osm-tiles` 이미지를 사용하도록 변경, 임시 합성 맵 디테일 레이어 제거
- [x] Alignment 맵 가림 현상 수정: OSM 지면 텍스처를 가리고 있던 데모 건물 층 슬래브 제거, 건물 벽/객체 아래에서 팝업과 동일한 타일 이미지가 보이도록 함
- [x] Alignment 3D 마커 가시성: GPS 원점/Point1/Point2 마커 링, 구체, 글로우 강도, 텍스트 라벨 확대하여 선택된 참조 및 3포인트 정렬 대상을 3D 뷰에서 더 쉽게 식별 가능하도록 개선
- [x] 로그인/계정 UI 이식: 현재 프로젝트 스타일의 LoginPage, 로컬 계정/세션 역할 스토어, `/login` 라우트, 역할 전환 및 계정 추가 항목이 있는 상단바 계정 드롭다운 추가
- [x] 로그인 라우트 분리: `/login`을 AppShell 외부로 이동하여 계정 추가 시 메인 사이드바/상단바 없이 독립적인 전체 화면 로그인 페이지가 열리도록 함 (비교 프로젝트 플로우와 일치)
- [x] 상단바 계정 메뉴 레이어링: 상단바 스태킹 컨텍스트 및 계정 드롭다운 z-index 상향 조정하여 역할/계정 추가 메뉴가 워크플로우/콘텐츠 UI 위에 렌더링되고 클릭 가능하도록 함
- [x] Monitor 비교 프로젝트 UI 이식: 완료 배너, 상단 컨트롤 바, 좌측 장치 검색/필터 패널, 중앙 공간 모니터 뷰포트, 우측 건물/층 및 실시간 이벤트 패널, 하단 로그/카메라 스트립 구조로 재구성하고 현재 블랙/그레이 디자인 시스템에 맞춤
- [x] Monitor 지도/이벤트 피드 개선: 중앙 공간뷰 명칭을 지도로 변경하고 OSM 지도 평면 위 3D 모델/장치가 올라간 형태로 재구성, 실시간 이벤트 필터와 피드 항목을 한 줄 중심의 슬림 UI로 리사이징하며 약 8개 높이의 내부 스크롤 목록으로 조정
- [x] Monitor 지도 뷰 재수정: 잘못된 SVG 지도 목업을 제거하고 alignment 페이지와 동일한 OSM 타일 기반 Three.js/Cesium 스타일 바닥 평면 위에 층별 3D 오브젝트와 보안 장치 마커를 렌더링하도록 변경
- [x] Monitor 지도 뷰 alignment 연동 보정: alignment의 `building_map_settings` 좌표/줌을 모니터에서 읽어 OSM 타일 바닥 이미지를 동일하게 표시하고, 임의 층 박스 대신 3D 편집의 벽/룸/장치 데이터를 지도 위 3D 오브젝트로 렌더링하도록 수정
- [x] Monitor alignment 기준점 위치 반영: alignment 프로젝트 스냅샷의 `buildingOrigin`, `osmQuadZoom`, `osmQuadScale`, `alignmentMatrix`를 모니터에서 읽고, 3D 편집의 벽/룸/장치 좌표를 GPS 좌표로 변환한 뒤 OSM 지도 평면 위 위치로 재투영하도록 수정
- [x] Alignment OSM 원점 선택 클릭 보정: 원점 선택 팝업에서 타일/마커 배치 기준과 클릭 좌표 계산 기준을 동일한 지도 실측 크기로 통일하고, 원점 선택 지도 최대 확대를 z19까지 올려 더 세밀한 기준점 선택이 가능하도록 수정
- [x] Alignment 3D 모델 더미 제거: alignment 중앙 3D View의 `DemoBuildingModel`을 제거하고, 프로젝트 스냅샷의 `editor` 섹션에서 복원한 3D 편집 벽/룸/보안장치 데이터를 OSM 3D 지도 위에 실제 로컬 좌표계로 렌더링하도록 수정
- [x] Validation 3D View 저장 모델 복원: validation 페이지 진입 시 첫 번째 building의 `project-snapshot.editor`를 직접 읽어 3D 편집 벽/룸/보안장치 데이터를 Editor store에 복원하고, editor 페이지를 먼저 방문하지 않아도 validation View 오브젝트가 생성되도록 수정
- [x] Editor Properties 패널 폭 확장: editor 우측 패널 기본 폭을 320px에서 400px로 늘리고, Properties 내부 정보 행을 2열 그리드로 정리해 좌표/크기/ID 값이 좁게 잘리지 않도록 수정
