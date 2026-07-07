# Unity 개발자를 위한 HTML/TypeScript 프로젝트 구조 가이드

> **목적**: Unity 개발자 관점에서 building-editor (React + Vite + TypeScript) 프로젝트의 초기 구성과 개발 방식을 설명
> **대상 독자**: 유니티 개발은 잘 알지만 HTML/TS/React 생태계가 처음인 사람
> **작성일**: 2026-07-02
> **기반 프로젝트**: Unified Building Editor (building-editor)

---

## 목차

1. [Unity vs 이 프로젝트 구조 비교](#1-unity-vs-이-프로젝트-구조-비교)
2. [프로젝트 생성 명령어](#2-프로젝트-생성-명령어)
3. [전체 폴더 구조](#3-전체-폴더-구조)
4. [개발 모드 시작 방법](#4-개발-모드-시작-방법)
5. [초기 세팅 LLM 프롬프트](#5-초기-세팅-llm-프롬프트)
6. [Unity vs HTML/TS 개발 플로우](#6-unity-vs-htmlts-개발-플로우)
7. [유니티 개발자가 가장 헷갈릴 만한 개념](#7-유니티-개발자가-가장-헷갈릴-만한-개념)
8. [실전 팁](#8-실전-팁)

---

## 1. Unity vs 이 프로젝트 구조 비교

| Unity 개념 | 여기 (building-editor) | 설명 |
|-----------|----------------------|------|
| `Assets/Scenes/` | `frontend/src/pages/` | 씬 = 페이지. 하나의 화면 단위 |
| `Assets/Scripts/` | `frontend/src/components/` + `store/` | 컴포넌트 = MonoBehaviour 스크립트 |
| `Prefabs/` | `frontend/src/components/` | 재사용 가능한 UI 조각 |
| `ScriptableObject` | `frontend/src/store/` (Zustand) | 전역 상태 관리 + 직렬화 |
| `Resources.Load` | `frontend/src/api/` (Axios) | 네트워크 리소스 로딩 |
| `Build Settings` | `vite.config.ts` | 빌드 대상/설정 |
| `Project Settings` | `tsconfig.json` + `package.json` | 언어/컴파일러 설정 |
| `Assembly Definition (.asmdef)` | `package.json` dependencies | 외부 패키지 참조 |
| `Scene Hierarchy` | `App.tsx` (Routes) | 페이지 전환 트리 구조 |
| `Inspector` | TypeScript 타입/인터페이스 | 직렬화 필드 정의 |
| `Console (Cmd+8)` | 브라우저 DevTools (F12) | 디버그 로그 확인 |
| `Domain Reload` | Vite HMR (Hot Module Replacement) | 코드 수정 시 즉시 반영 |
| `Player Settings` | `vite.config.ts` | 빌드 옵션 |
| `Package Manager` | `npm install` 명령어 | 패키지 추가 |
| `.meta` 파일 | `package.json` + `tsconfig.json` | 설정 파일 |
| `EditorWindow` | 별도 에디터 없음 (VS Code가 전부) | Unity처럼 GUI 에디터 없음 |

---

## 2. 프로젝트 생성 명령어

### 2.1 실제 이 프로젝트를 초기화할 때 실행한 명령어들

```bash
# ============================================================
# 1. 프론트엔드 (React + Vite + TypeScript)
# ============================================================
cd frontend

# Vite로 React + TS 프로젝트 생성 (Unity의 Project Creation Wizard)
npm create vite@latest . -- --template react-ts

# ============================================================
# 2. 핵심 패키지 설치 (Unity Package Manager로 패키지 추가와 동일)
# ============================================================

# --- UI / 라우팅 ---
npm install react-router-dom         # 씬 전환 시스템 (SceneManager와 동일)
npm install tailwindcss             # CSS 프레임워크 (UI 스타일링)
npm install @tailwindcss/vite        # Tailwind + Vite 연동 플러그인
npm install lucide-react             # 아이콘 라이브러리
npm install react-hook-form          # 폼 입력 처리 (UI Toolkit)
npm install zod                      # 데이터 검증 (SerializedField validation)
npm install @radix-ui/react-tooltip  # 툴팁 (기본 UI 요소)

# --- 상태 관리 ---
npm install zustand                  # 전역 상태 관리 (ScriptableObject 느낌)

# --- 네트워크 ---
npm install axios                    # HTTP 통신 (UnityWebRequest 대체)

# --- 3D / 지도 ---
npm install three                    # 3D 엔진 (Unity Engine의 WebGL 버전)
npm install @react-three/fiber       # Three.js를 React 방식으로 래핑
npm install @react-three/drei        # Three.js 유틸 모음 (Standard Assets)
npm install camera-controls          # 카메라 제어 (CinemaMachine)
npm install maplibre-gl              # 지도 렌더링 (Mapbox)
npm install leaflet                  # 경량 지도
npm install react-leaflet            # Leaflet React 래퍼
npm install @deck.gl/core            # 대규모 지오데이터 시각화
npm install @deck.gl/layers
npm install @deck.gl/react

# --- 차트 ---
npm install recharts                 # 차트 라이브러리

# --- 가상 스크롤 ---
npm install @tanstack/react-virtual  # 대량 리스트 최적화

# --- IFC (건물 모델) ---
npm install web-ifc                  # IFC 파일 파싱
npm install @thatopen/components     # BIM 뷰어

# ============================================================
# 3. 개발 도구 (DevDependencies)
# ============================================================
npm install -D typescript            # TypeScript 컴파일러
npm install -D vite                  # 빌드 + 개발 서버
npm install -D vitest                # 단위 테스트 (Unity Test Framework)
npm install -D @playwright/test      # E2E 테스트
npm install -D eslint                # 코드 품질 검사
npm install -D @vitejs/plugin-react  # Vite + React 통합 플러그인
npm install -D @types/react          # React 타입 정의
npm install -D @types/three          # Three.js 타입 정의
```

### 2.2 Unity와의 차이점

```
Unity: Edit → Project Settings 에서 모든 설정을 GUI로 변경
여기:  모든 설정이 텍스트 파일 (JSON/TS) 로 관리됨

Unity: Window → Package Manager 에서 GUI로 설치
여기:  npm install [패키지명] 으로 터미널에서 설치
```

#### tsconfig.json (Unity의 Project Settings > Player > Configuration)

```jsonc
{
  "compilerOptions": {
    "strict": true,                  // Allow unsafe code? 과 유사
    "moduleResolution": "bundler",   // 어셈블리 참조 방식
    "jsx": "react-jsx",             // JSX 문법 활성화 (C#의 partial class 느낌)
    "target": "ES2020",             // .NET API 호환성 레벨과 동일
    "noUnusedLocals": true,         // 사용 안 하는 변수 경고
    "noUnusedParameters": true,     // 사용 안 하는 파라미터 경고
    "skipLibCheck": true,           // 외부 라이브러리 타입 검사 스킵
    "moduleDetection": "force"      // 모든 파일을 모듈로 취급
  }
}
```

#### vite.config.ts (Unity의 Build Settings)

```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react(), tailwindcss()],            // 사용할 플러그인
    
    server: {
      host: '0.0.0.0',                            // 외부 접속 허용
      port: 5173,                                  // 개발 서버 포트
      proxy: {
        '/api': { target: 'http://localhost:8000', changeOrigin: true },
        // API 요청을 백엔드로 전달 (CORS 회피)
      }
    }
  }
})
```

---

## 3. 전체 폴더 구조 (실제 이 프로젝트 기준)

```
building-editor/
│
├── frontend/                          # React SPA (Unity의 Client)
│   ├── src/
│   │   ├── pages/                     # 각 페이지 = Unity 씬
│   │   │   ├── HomePage.tsx           # 메인 화면
│   │   │   ├── ProjectsPage.tsx       # 프로젝트 목록
│   │   │   ├── EditorPage.tsx         # 편집기 (메인 게임 씬, 1500줄)
│   │   │   ├── DashboardPage.tsx      # 대시보드 (KPI)
│   │   │   ├── DevicesPage.tsx        # 장비 관리
│   │   │   └── ...
│   │   │
│   │   ├── components/                # 재사용 UI = 프리팹
│   │   │   ├── UnifiedViewer.tsx      # 2D/3D 통합 뷰어 (1500줄)
│   │   │   ├── Sidebar.tsx            # 사이드바
│   │   │   ├── PropertyPanel.tsx      # 속성 패널 (Inspector)
│   │   │   ├── CommandPalette.tsx     # 명령 팔레트 (Cmd+K)
│   │   │   └── ... (47개)
│   │   │
│   │   ├── store/                     # 전역 상태 (ScriptableObject)
│   │   │   ├── buildingStore.ts       # 건물 상태 (1270줄)
│   │   │   ├── editorStore.ts         # 편집기 상태
│   │   │   ├── workflowStore.ts       # 워크플로우 상태
│   │   │   └── ... (10개)
│   │   │
│   │   ├── api/                       # 서버 통신 (NetworkManager)
│   │   │   ├── buildingApi.ts         # 건물 API
│   │   │   ├── floorApi.ts            # 층 API
│   │   │   ├── geometryApi.ts         # 도형 API
│   │   │   └── ... (12개)
│   │   │
│   │   ├── layouts/                   # 레이아웃 템플릿
│   │   │   └── DashboardLayout.tsx    # 기본 레이아웃 (헤더 + 사이드바)
│   │   │
│   │   ├── shared/                    # 공통 유틸리티 (Utility scripts)
│   │   │   ├── types/                 # TypeScript 타입 정의
│   │   │   └── utils/                 # 유틸 함수 (22개)
│   │   │
│   │   ├── hooks/                     # React 훅 (커스텀 MonoBehaviour)
│   │   │   ├── useWebSocket.ts        # WebSocket 훅
│   │   │   └── ...
│   │   │
│   │   ├── App.tsx                    # 루트 (SceneManager + Initializer)
│   │   ├── main.tsx                   # 엔트리 포인트 (Program.Main)
│   │   └── index.css                  # 전역 스타일 + 디자인 시스템
│   │
│   ├── index.html                     # HTML 진입점
│   ├── vite.config.ts                 # 빌드 설정 (Build Settings)
│   ├── tsconfig.json                  # 타입스크립트 설정 (Project Settings)
│   └── package.json                   # 패키지 목록 + 스크립트
│
├── backend/                           # Python FastAPI 서버
│   ├── app/
│   │   ├── api/                       # REST API 엔드포인트
│   │   ├── models/                    # DB 모델 (SQLAlchemy)
│   │   ├── schemas/                   # API 요청/응답 구조
│   │   ├── services/                  # 비즈니스 로직
│   │   ├── middleware/                # 미들웨어
│   │   └── main.py                    # 서버 진입점
│   └── migrations/                    # DB 스키마 변경 이력
│
├── docker-compose.yml                 # 인프라 설정 (서버, DB, 캐시)
│
├── .llm-context/                      # LLM 컨텍스트 저장소 (권장)
│   ├── project-overview.md
│   └── architecture-rules.md
│
└── .gitignore
```

---

## 4. 개발 모드 시작 방법

### 4.1 Unity 개발 모드

```
1. 유니티 에디터 실행
2. 프로젝트 로딩 (Domain Reload)
3. ▶️ Play 버튼 클릭
4. 코드 수정 → 저장 → 다시 Play
```

### 4.2 이 프로젝트 개발 모드

```bash
# === 터미널 1: DB + 캐시 실행 (Unity 에디터 켜기) ===
docker compose up -d postgres redis

# === 터미널 2: 백엔드 실행 (= 게임 서버) ===
cd backend
.\venv\Scripts\Activate.ps1          # 가상환경 활성화
uvicorn app.main:app --reload --port 8000

# === 터미널 3: 프론트엔드 실행 (= Unity Play) ===
cd frontend
npm run dev
# → http://localhost:5173/ 접속
# → 코드 수정 → 브라우저 즉시 반영 (Vite HMR)
```

### 4.3 핵심 차이점

| 항목 | Unity | 여기 |
|------|-------|------|
| **실행 환경** | 하나의 에디터 | 3개 프로세스 (DB + 서버 + 브라우저) |
| **핫 리로드** | 느림 (Domain Reload) | 즉시 (Vite HMR, 10ms) |
| **디버깅** | Unity Console | 브라우저 F12 DevTools |
| **네트워크** | 로컬 함수 호출 | HTTP API 호출 (axios) |
| **상태 유지** | Play 중지 시 초기화 | 새로고침해도 유지 (localStorage) |

---

## 5. 초기 세팅 LLM 프롬프트

### 5.1 1단계: 프로젝트 스캐폴딩

```
"React + Vite + TypeScript 프로젝트를 frontend/에 만들어줘.
Vite 템플릿은 react-ts.
패키지: react-router-dom, zustand, axios, tailwindcss,
        three, @react-three/fiber, @react-three/drei 포함.
vite.config.ts: /api 프록시를 localhost:8000으로 설정.
tsconfig.json: strict mode, moduleResolution bundler."
```

→ `npm create vite` → `npm install` → `vite.config.ts` 설정까지 한 번에 완료

### 5.2 2단계: 앱 진입점과 라우팅

```
"App.tsx에 BrowserRouter + Routes 구성.
페이지들: /home (HomePage), /projects (ProjectsPage),
/editor/:id (EditorPage), /settings (SettingsPage), /login (LoginPage).
모든 페이지는 React.lazy()로 로딩.
DashboardLayout을 공통 레이아웃으로 사용."
```

### 5.3 3단계: 상태 관리 + API 통신

```
"Zustand store 생성: buildingStore에
- buildings: Building[] (건물 목록)
- selectedBuilding: Building | null (선택된 건물)
- fetchBuildings(), createBuilding(), updateBuilding(), deleteBuilding() 액션
- axios 기반 buildingApi.ts 생성 (GET/POST/PATCH/DELETE)
- Building 타입 정의 (id, name, address, total_floors, 등)"
```

### 5.4 4단계: 페이지 개발 (하나씩)

```
"ProjectsPage.tsx: 건물 목록 테이블.
- 생성 버튼 → 다이얼로그 열림 (이름, 주소 입력)
- 각 행에 수정/삭제 버튼
- 데이터는 buildingStore에서 가져오고, API 호출은 buildingApi.ts"
```

### 5.5 5단계: 뷰어 개발

```
"UnifiedViewer.tsx: 2D/3D 통합 뷰어.
- Three.js Canvas + @react-three/fiber
- 건물 벽(Wall)을 3D 메시로 렌더링
- OrbitControls로 카메라 회전/확대/축소
- 좌표계: WGS84 (SRID 4326), Y-up 시스템"
```

---

## 6. Unity vs HTML/TS 개발 플로우

| 항목 | Unity | HTML/TS (이 프로젝트) |
|------|-------|----------------------|
| **편집기** | Unity Editor | VS Code |
| **코드 언어** | C# | TypeScript (JavaScript의 슈퍼셋) |
| **UI 구성** | Canvas + UI Toolkit + UXML | React 컴포넌트 (JSX) |
| **스타일링** | USS / UXML | Tailwind CSS (className="flex p-4") |
| **씬 전환** | SceneManager.LoadScene | react-router-dom `<Routes>` |
| **오브젝트 참조** | GetComponent / Find | Props / Context / Store |
| **상태 저장** | PlayerPrefs / ScriptableObject | Zustand store + localStorage |
| **네트워크** | UnityWebRequest / REST | Axios (Promise 기반) |
| **3D** | Built-in RP / URP / HDRP | Three.js (WebGL 기반) |
| **카메라** | Camera 컴포넌트 | PerspectiveCamera (Three.js) |
| **빌드** | File → Build Settings | `npm run build` → dist/ |
| **배포** | .exe / APK / WebGL | nginx / Docker 정적 파일 |
| **디버깅** | Unity Console | 브라우저 F12 DevTools (Console, Network, Sources) |
| **핫 리로드** | 느림 (몇 초 ~ 수십 초) | 매우 빠름 (수 ms, 상태 유지) |
| **패키지** | Package Manager (GUI) | `npm install [패키지]` |
| **버전 관리** | .meta 파일 필수 | .gitignore만 있으면 됨 |

---

## 7. 유니티 개발자가 가장 헷갈릴 만한 개념

### 7.1 "씬(Scene)"이 아니라 "페이지(Page)"다

```tsx
// ===== Unity =====
SceneManager.LoadScene("EditorScene");
// 씬을 로드하면 기존 씬이 언로드되고 새 씬이 로드됨
// 씬 간 데이터 전달은 DontDestroyOnLoad 필요

// ===== 여기 =====
<Route path="/editor/:buildingId" element={<EditorPage />} />
// URL이 /editor/123 으로 바뀌면 EditorPage 컴포넌트가 마운트됨
// "씬 로딩"이 아니라 "컴포넌트 교체" (훨씬 가벼움)
// 데이터는 Store에 보관되므로 페이지 이동해도 유지됨
```

### 7.2 "MonoBehaviour"가 아니라 "React 컴포넌트"다

```tsx
// ===== Unity =====
public class PlayerController : MonoBehaviour {
    void Awake() { /* 최초 초기화 */ }
    void Start() { /* 활성화 시 */ }
    void Update() { /* 매 프레임 */ }
    void OnDestroy() { /* 제거 시 */ }
}

// ===== 여기 =====
function PlayerController({ speed }: { speed: number }) {
    // Awake + Start (마운트 시 1회 실행)
    useEffect(() => {
        console.log('마운트됨');
        return () => console.log('언마운트됨'); // OnDestroy
    }, []);

    // Update는 없음. React가 상태 변경 시 자동 리렌더링
    // 매 프레임 실행되는 게 아니라 "변경된 부분만 다시 그림"

    return <div>Speed: {speed}</div>;
}
```

### 7.3 "Inspector"가 아니라 "Props"다

```tsx
// ===== Unity =====
// Inspector에 public float speed; 를 노출하면
// 에디터에서 슬라이더로 조작 가능

// ===== 여기 =====
// Props로 명시적으로 전달 (Inspector 같은 GUI 편집기 없음)
function WallComponent({ wall, isSelected, onSelect }: {
    wall: Wall;
    isSelected: boolean;
    onSelect: (id: string) => void;
}) {
    return (
        <div onClick={() => onSelect(wall.id)}
             className={isSelected ? 'selected' : ''}>
            <span>{wall.name}</span>
            <span>{wall.length}m</span>
        </div>
    );
}
```

### 7.4 "Prefab"이 아니라 "컴포넌트 조합"이다

```tsx
// ===== Unity =====
// Prefab을 Hierarchy에 드래그 → 인스턴스화
// GetComponent로 자식 참조

// ===== 여기 =====
// JSX로 조합 (모든 게 코드)
function EditorPage() {
    return (
        <DashboardLayout>
            <Sidebar>
                <LayerPanel layers={layers} />
                <PropertyPanel selectedObject={selected} />
            </Sidebar>
            <main>
                <UnifiedViewer buildingId={id} />
                <Toolbar>
                    <SelectTool />
                    <DrawTool />
                </Toolbar>
            </main>
        </DashboardLayout>
    );
}
```

### 7.5 "Coroutine"이 아니라 "async/await"다

```tsx
// ===== Unity =====
IEnumerator LoadData() {
    var request = UnityWebRequest.Get("http://api/data");
    yield return request.SendWebRequest();
    Debug.Log(request.downloadHandler.text);
}

// ===== 여기 =====
async function loadData() {
    const response = await axios.get('/api/data');
    console.log(response.data);
    // throw로 에러 처리 (try/catch)
}
```

### 7.6 "ScriptableObject"가 아니라 "Zustand Store"다

```typescript
// ===== Unity =====
// [CreateAssetMenu] ScriptableObject를 만들어서
// Resources.Load로 불러오거나 참조로 연결

// ===== 여기 =====
// Zustand Store = 전역 상태 저장소
import { create } from 'zustand';

interface BuildingStore {
    buildings: Building[];
    selectedId: string | null;
    fetchBuildings: () => Promise<void>;
    selectBuilding: (id: string) => void;
}

export const useBuildingStore = create<BuildingStore>((set) => ({
    buildings: [],
    selectedId: null,

    fetchBuildings: async () => {
        const res = await axios.get('/api/buildings');
        set({ buildings: res.data });       // 상태 변경 → 자동 리렌더링
    },

    selectBuilding: (id) => {
        set({ selectedId: id });             // this.selectedId = id 와 동일
    },
}));
```

### 7.7 직렬화 (Serialization)

```tsx
// ===== Unity =====
// [SerializeField] private int hp;
// public int HP { get; set; }

// ===== 여기 =====
// TypeScript 인터페이스로 정의 (런타임에는 사라짐)
interface Building {
    id: string;
    name: string;
    address: string;
    total_floors: number;
    origin_latitude: number;
    origin_longitude: number;
    created_at: string;
    updated_at: string;
}

// Zod로 런타임 검증 (SerializedField validation 느낌)
import { z } from 'zod';
const BuildingSchema = z.object({
    name: z.string().min(1, '이름은 필수'),
    address: z.string().optional(),
    total_floors: z.number().min(1).max(200),
});
```

### 7.8 에러 처리

```tsx
// ===== Unity =====
// try/catch + Debug.LogError
// 또는 EditorGUIUtility.DisplayDialog

// ===== 여기 =====
try {
    await axios.post('/api/buildings', data);
} catch (error) {
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
            alert('이미 존재하는 건물입니다');
        } else if (error.response?.status === 422) {
            alert('입력값이 올바르지 않습니다');
        }
    }
}
```

---

## 8. 실전 팁

### 8.1 설정 파일만 알면 된다

Unity는 에디터가 GUI로 모든 걸 관리하지만,
여기는 **설정 파일 3개**만 알면 된다:

```bash
# HTML/TS 프로젝트 = 설정 파일 3개 + src/
building-editor/frontend/
├── package.json          # 패키지 목록 + 실행 스크립트 (Unity manifest.json + Project Settings)
├── tsconfig.json         # TypeScript 컴파일러 설정 (Unity Player Settings)
├── vite.config.ts        # 빌드 + 개발 서버 설정 (Unity Build Settings)
└── src/                  # 실제 코드 (Unity Assets/Scripts)
```

### 8.2 `npm run dev`만 기억하면 된다

```bash
# Unity: File → Open Project → 씬 로딩 → Play
# 여기:  npm run dev → 브라우저 열기
```

### 8.3 LLM에게 파일 수정을 부탁할 때

Unity는 `.unity` 씬 파일이 바이너리라 LLM이 수정하기 어렵지만,
여기는 **모든 게 텍스트 파일**이라 LLM이 완벽하게 수정 가능:

- `App.tsx` → 라우팅 구조
- `buildingStore.ts` → 상태 관리
- `vite.config.ts` → 빌드 설정
- `*.tsx` → 모든 페이지와 컴포넌트

### 8.4 컴파일 타임 vs 런타임

```
Unity: C# 코드를 빌드해야 에러를 알 수 있음
       (에디터에서 Live Compile은 되지만, 빌드 전엔 모든 에러 확인 불가)

여기:  tsc --noEmit 으로 즉시 타입 체크
       (저장만 해도 VSCode/LSP가 실시간으로 에러 표시)
       tsc보다 vite가 더 빠름 (esbuild 기반)
```

### 8.5 디버깅 팁

```tsx
// Unity: Debug.Log("value: " + value);
// 여기:
console.log('value:', value);        // 브라우저 Console (F12)에 출력
console.table(array);                // 표 형태로 출력
console.time('api');                  // 성능 측정
// ... api 호출 ...
console.timeEnd('api');              // "api: 234ms"

// Unity: Debug.Break()로 중단점
// 여기: 코드에 debugger; 를 넣으면 브라우저가 중단됨
```

### 8.6 가장 중요한 차이 - "상태가 곧 UI"

```
Unity: 게임 루프가 매 프레임 Update()를 호출
       → 직접 GameObject.transform.position 등을 변경
       → 엔진이 자동으로 화면을 다시 그림

여기:  상태(state)를 변경하면 React가 자동으로 UI를 다시 그림
       → set({ buildings: [...] }) 호출
       → React가 변경된 부분만 찾아서 DOM 업데이트
       → "명령형(imperative)"이 아니라 "선언형(declarative)"

쉽게 말해:
Unity는 "이 object를 여기로 옮겨!" 하고 직접 명령
React는 "상태가 이렇다" 하고 선언하면 알아서 그림
```

---

## 9. 요약 체크리스트

```
시작할 때:

□ Node.js 22+ 설치 (https://nodejs.org)
□ Docker Desktop 설치 (https://docker.com)
□ VS Code 설치 (https://code.visualstudio.com)
□ Git 설치

초기화:

□ npm create vite@latest . -- --template react-ts
□ npm install [필요한 패키지들]
□ vite.config.ts 설정 (프록시, 포트)
□ tsconfig.json 설정 (strict mode)
□ .gitignore 생성

개발할 때:

□ docker compose up -d postgres redis     (DB 실행)
□ npm run dev                              (프론트엔드 실행)
□ F12 DevTools                             (디버깅)
□ npm run build                            (빌드)

기억할 것:

□ 씬 = 페이지, 프리팹 = 컴포넌트
□ MonoBehaviour = React 컴포넌트 (useEffect + return JSX)
□ ScriptableObject = Zustand Store
□ Inspector = Props
□ UnityWebRequest = Axios
□ 모든 게 텍스트 파일이라 LLM이 다 수정 가능
```
