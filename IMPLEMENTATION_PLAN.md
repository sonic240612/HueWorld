# HueWorld 구현 계획서

## 기술 스택 요약

| 레이어 | 기술 | 비고 |
|--------|------|------|
| Frontend | React 18 + Vite + TypeScript | SPA |
| Map | MapLibre GL JS | WebGL 기반 |
| Map Tiles | OpenFreeMap (다크 테마) | 무료 |
| 실시간 통신 | Supabase Realtime | WebSocket |
| Backend | Python FastAPI | REST API only |
| Database | Supabase (PostgreSQL + PostGIS) | BaaS |
| Deploy | Vercel (Frontend + Serverless Backend) | |

---

## 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                        │
│  ┌──────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │Onboarding│  │    Map (MapLibre)     │  │    Dashboard      │  │
│  │Overlay   │  │  ┌────────────────┐   │  │ ┌─────────────┐  │  │
│  │          │  │  │ LEDPixelLayer   │   │  │ │ GlobalMood  │  │  │
│  │"오늘의   │  │  │ (GeoJSON src)   │   │  │ │ (radial     │  │  │
│  │ 기분은?" │  │  │                │   │  │ │  gradient)  │  │  │
│  └────┬─────┘  │  └────────────────┘   │  │ └─────────────┘  │  │
│       │        │  ┌────────────────┐   │  │ ┌─────────────┐  │  │
│  ┌────▼─────┐  │  │ZoomAggregator │   │  │ │CountryRank  │  │  │
│  │MoodSlider│  │  │(clustering)   │   │  │ └─────────────┘  │  │
│  │(rgb 보간) │  │  └────────────────┘   │  └───────────────────┘  │
│  └──────────┘  └──────────────────────┘                         │
│       │                    │                                     │
│       ▼                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Supabase Realtime Client (WebSocket subscription)         │  │
│  │  channel: "pixels" → on INSERT → update GeoJSON source     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
              ┌────────────┼────────────────┐
              │ REST       │ Realtime       │
              │ (fetch)    │ (broadcast)    │
              ▼            ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Supabase (BaaS)                               │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │  PostgreSQL + PostGIS│  │  Realtime (WebSocket Broadcast) │  │
│  │                     │  │  → 모든 클라이언트에 변경 전파   │  │
│  │  pixels table       │  └──────────────────────────────────┘  │
│  │  location(GEOGRAPHY)│                                         │
│  │  color, session_id  │                                         │
│  │  created_at 등      │                                         │
│  └─────────────────────┘                                         │
└──────────────────────────────────────────────────────────────────┘
                           ▲
                           │ REST (INSERT, SELECT, 집계)
                           │
┌──────────────────────────────────────────────────────────────────┐
│              FastAPI (Vercel Serverless)                          │
│                                                                   │
│  POST /api/pixels       → INSERT pixel (jitter 적용)              │
│  GET  /api/pixels       → bbox 기반 픽셀 조회                     │
│  GET  /api/stats/global → 전 세계 평균 색상                       │
│  GET  /api/stats/viewport → 현재 viewport dominant color         │
│  GET  /api/stats/countries → 국가별 감정 랭킹                    │
│  GET  /api/stats/region → 특정 영역 감정 분석                     │
│                                                                   │
│  Background Tasks (Cron):                                         │
│  - 매시간 expired(24h) 픽셀 DELETE                                │
└──────────────────────────────────────────────────────────────────┘
```

### 데이터 흐름: 픽셀 제출

```
User A: 슬라이더 조절 → 손을 뗌
  → POST /api/pixels { lat, lng, color, session_id }
    → FastAPI: jitter 적용 → Supabase INSERT
      → Supabase Realtime: "pixels" 채널에 INSERT 이벤트 발행
        → User A (WebSocket): 새 픽셀 수신 → GeoJSON 업데이트 → LED 렌더링
        → User B (WebSocket): 새 픽셀 수신 → GeoJSON 업데이트 → LED 렌더링
        → User C (WebSocket): ...
```

---

## 데이터베이스 스키마

```sql
-- PostGIS 활성화
CREATE EXTENSION IF NOT EXISTS postgis;

-- 픽셀 테이블
CREATE TABLE pixels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location      GEOGRAPHY(Point, 4326) NOT NULL,
  color         CHAR(7) NOT NULL,           -- hex: #00FF00
  raw_location  GEOGRAPHY(Point, 4326),     -- jitter 전 원본 (디버깅용, 운영 시 제거)
  session_id    UUID NOT NULL,              -- 익명 세션 식별자
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 인덱스
CREATE INDEX idx_pixels_location      ON pixels USING GIST (location);
CREATE INDEX idx_pixels_created_at    ON pixels (created_at);
CREATE INDEX idx_pixels_expires_at    ON pixels (expires_at);

-- Realtime 활성화 (Supabase)
-- Project Settings → Realtime → "pixels" 테이블 INSERT 이벤트 subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE pixels;
```

---

## 프로젝트 구조

```
HueWorld/
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   ├── HueMap.tsx              # MapLibre GL JS 래퍼
│   │   │   │   ├── LEDPixelLayer.tsx        # GeoJSON → LED 스타일 렌더링
│   │   │   │   └── ZoomAggregator.ts        # 줌 레벨별 집계 로직
│   │   │   ├── MoodSlider/
│   │   │   │   └── MoodSlider.tsx           # 3-point color interpolation slider
│   │   │   ├── Dashboard/
│   │   │   │   ├── GlobalMood.tsx           # radial-gradient 글로벌 무드 LED
│   │   │   │   ├── CountryRanking.tsx       # 국가별 랭킹 리스트
│   │   │   │   └── RegionalMood.tsx         # 지역 선택 시 dominant color
│   │   │   ├── Onboarding/
│   │   │   │   └── OnboardingOverlay.tsx    # 첫 접속 overlay
│   │   │   └── common/
│   │   │       └── CoolDown.tsx             # 제출 후 쿨다운 표시
│   │   ├── hooks/
│   │   │   ├── useGeolocation.ts            # 브라우저 GPS
│   │   │   ├── usePixels.ts                 # Supabase Realtime 구독 + 상태
│   │   │   └── useMoodSlider.ts             # 슬라이더 상태 + 색상 계산
│   │   ├── services/
│   │   │   ├── api.ts                       # FastAPI REST 호출
│   │   │   └── supabase.ts                  # Supabase 클라이언트 (Realtime)
│   │   ├── utils/
│   │   │   ├── color.ts                     # hex ↔ rgb, interpolation, avg
│   │   │   ├── coordinates.ts               # jitter, grid snap, bbox
│   │   │   └── aggregation.ts               # 색상 클러스터링, dominant color
│   │   ├── types/
│   │   │   └── index.ts                     # 공통 타입 정의
│   │   ├── constants/
│   │   │   └── index.ts                     # 색상 기준값, 쿨다임 시간 등
│   │   ├── App.tsx                          # 메인 앱 (레이아웃, 라우팅)
│   │   └── main.tsx                         # 진입점
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── vercel.json
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                          # FastAPI 앱 생성, CORS, 라우터 등록
│   │   ├── config.py                        # 환경변수 설정
│   │   ├── models/
│   │   │   ├── pixel.py                     # Pydantic 모델 (PixelCreate, PixelResponse)
│   │   │   └── stats.py                     # StatsResponse 모델
│   │   ├── routes/
│   │   │   ├── pixels.py                    # POST /api/pixels, GET /api/pixels
│   │   │   └── stats.py                     # GET /api/stats/*
│   │   ├── services/
│   │   │   ├── database.py                  # Supabase/PostgreSQL 클라이언트
│   │   │   └── aggregation.py               # PostGIS 집계 쿼리
│   │   └── tasks/
│   │       └── pixel_decay.py               # 만료 픽셀 삭제 태스크
│   ├── requirements.txt
│   └── vercel.json
├── supabase/
│   └── migrations/
│       └── 001_init.sql
└── AGENTS.md                                # 프로젝트 컨텍스트 (opencode 용)
```

---

## 상세 구현 로드맵

### Phase 1: 프로젝트 셋업 (Day 1)

**목표**: 개발 환경 구축 및 배포 파이프라인 구성

| 작업 | 상세 |
|------|------|
| 1.1 | `npm create vite@latest frontend -- --template react-ts` |
| 1.2 | MapLibre GL JS, @maplibre/maplibre-gl-directions 등 의존성 설치 |
| 1.3 | FastAPI 프로젝트 생성, requirements.txt (`fastapi, uvicorn, supabase, psycopg2-binary, python-dotenv`) |
| 1.4 | Supabase 프로젝트 생성, PostGIS 활성화, 001_init.sql 실행 |
| 1.5 | Supabase API 키를 `.env`에 설정, Vercel 연동 |
| 1.6 | Vercel: frontend 배포 + backend Serverless Function 배포 |
| 1.7 | 로컬 개발 스크립트 (`npm run dev`, `uvicorn app.main:app --reload`) |

**체크포인트**: `http://localhost:5173`에서 빈 지도 렌더링 + GPS 권한 요청까지 동작 확인

---

### Phase 2: 코어 지도 & 무드 슬라이더 (Day 2-3)

**목표**: 지도 위에 내 위치 표시 + 슬라이더로 색상 선택 → 서버 전송

#### 2.1. MapLibre GL JS + OpenFreeMap

```tsx
// HueMap.tsx - 핵심
const map = new maplibregl.Map({
  container: mapContainer.current!,
  style: 'https://tiles.openfreemap.org/styles/maptiler-dark',  // 다크 테마
  center: [0, 20],  // default
  zoom: 2,
});
```

#### 2.2. Geolocation

```tsx
// useGeolocation.ts
// - navigator.geolocation.getCurrentPosition() → 사용자 위치 획득
// - 권한 거부 시: 서울 (37.5665, 126.978) 기본 좌표 사용
// - 성공 시: map.flyTo({ center: [lng, lat], zoom: 12 })
```

#### 2.3. MoodSlider

```tsx
// useMoodSlider.ts
// - 기준 색상: GOOD=#00FF00, OK=#FFFF00, BAD=#FF0000
// - 슬라이더 값 [0, 1] → RGB linear interpolation
//   value 0.0 → #00FF00 (초록)
//   value 0.5 → #FFFF00 (노랑)
//   value 1.0 → #FF0000 (빨강)
function interpolateColor(t: number): string {
  if (t <= 0.5) return lerp('#00FF00', '#FFFF00', t * 2);
  else return lerp('#FFFF00', '#FF0000', (t - 0.5) * 2);
}
```

#### 2.4. 제출 플로우

```
onSliderRelease(color)
  → POST /api/pixels { lat, lng, color, session_id }
  → 쿨다운 시작 (5초)
  → 성공 시: Supabase Realtime 통해 전파
  → 실패 시: 토스트 메시지
```

**체크포인트**: 슬라이더 조작 → 지도 위에 내 LED 픽셀 생성 확인

---

### Phase 3: 백엔드 & 데이터베이스 (Day 4-5)

**목표**: FastAPI REST API 완성 + Supabase 연동 + 프라이버시

#### 3.1. FastAPI Routes

```python
# POST /api/pixels
# Request: { lat: float, lng: float, color: str, session_id: str }
# Response: { id: str, success: bool }

# GET /api/pixels?sw_lat=...&sw_lng=...&ne_lat=...&ne_lng=...&limit=5000
# Response: { pixels: [{ id, lat, lng, color, session_id, created_at }] }

# GET /api/stats/global
# Response: { avg_color: str, pixel_count: int }

# GET /api/stats/viewport?sw_lat=...&sw_lng=...&ne_lat=...&ne_lng=...
# Response: { dominant_color: str, color_distribution: { color: count }[] }

# GET /api/stats/countries
# Response: { countries: [{ country: str, avg_color: str, pixel_count: int }] }

# GET /api/stats/region?lat=...&lng=...&radius_km=...
# Response: { avg_color: str, top_colors: [{ color: str, count: int }] }
```

#### 3.2. 프라이버시 (Jitter)

```python
# coordinates.py
import random, math

def apply_jitter(lat: float, lng: float, max_meters: float = 100.0) -> tuple[float, float]:
    # 100m ≈ 0.001° at equator
    offset_deg = max_meters / 111_320
    lat += random.uniform(-offset_deg, offset_deg)
    lng += random.uniform(-offset_deg, offset_deg)
    return round(lat, 5), round(lng, 5)
```

#### 3.3. Supabase Realtime 구독

```tsx
// supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 'pixels' 테이블 INSERT 구독
const channel = supabase
  .channel('pixels-realtime')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'pixels' },
    (payload) => {
      // 새 픽셀 수신 → pixels 상태에 추가
      onNewPixel(payload.new as Pixel);
    }
  )
  .subscribe();
```

#### 3.4. Cool-down

```python
# routes/pixels.py - 서버 측 검증
from datetime import datetime, timedelta

COOLDOWN_SECONDS = 5
last_submission: dict[str, datetime] = {}

async def check_cooldown(session_id: str) -> bool:
    now = datetime.utcnow()
    if session_id in last_submission:
        elapsed = (now - last_submission[session_id]).total_seconds()
        if elapsed < COOLDOWN_SECONDS:
            return False  # cool-down 중
    last_submission[session_id] = now
    return True
```

**체크포인트**: REST API curl 테스트 통과 + Supabase Realtime으로 실시간 픽셀 수신 확인

---

### Phase 4: 실시간 동기화 & 줌 집계 (Day 6-7)

**목표**: 실시간 픽셀이 지도 위에 LED 스타일로 렌더링 + 줌 레벨별 집계

#### 4.1. LED Pixel Layer

```tsx
// LEDPixelLayer.tsx
// MapLibre GeoJSON 소스 + circle 레이어 사용

map.addSource('pixels', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
});

map.addLayer({
  id: 'led-pixels',
  type: 'circle',
  source: 'pixels',
  paint: {
    'circle-color': ['get', 'color'],
    'circle-radius': [
      'interpolate', ['exponential', 0.5],
      ['zoom'],
      0, 0.5,     // 줌 0: 반경 0.5px
      5, 1,       // 줌 5: 반경 1px
      10, 3,      // 줌 10: 반경 3px
      15, 8,      // 줌 15: 반경 8px
      18, 16,     // 줌 18: 반경 16px
    ],
    'circle-blur': 0.8,             // LED 글로우 효과
    'circle-opacity': [
      'case',
      ['boolean', ['feature-state', 'isMine'], false],
      1.0,        // 내 픽셀은 full opacity
      0.7,        // 남의 픽셀
    ],
    'circle-stroke-width': 0,
  },
});
```

#### 4.2. 줌 집계 (Zoom Aggregation)

```tsx
// ZoomAggregator.ts
// 줌 레벨에 따라 표시 방식을 전환

const AGGREGATION_ZOOM_THRESHOLD = 6;  // 줌 6 이하부터 집계

function getPixelData(zoom: number, pixels: Pixel[]): GeoJSON {
  if (zoom >= AGGREGATION_ZOOM_THRESHOLD) {
    // 개별 픽셀 표시 (고배율)
    return toPointFeatures(pixels);
  } else {
    // 격자 집계 (저배율)
    const grid = aggregateToGrid(pixels, zoom);
    return toPolygonFeatures(grid);
  }
}

function aggregateToGrid(pixels: Pixel[], zoom: number): GridCell[] {
  // zoom 0: 전 세계 1개 셀
  // zoom 1: 2×2 = 4개 셀
  // zoom 5: 32×32 = 1024개 셀
  const gridSize = Math.pow(2, zoom);
  // 각 셀 내 픽셀 색상 평균
  // 셀에 픽셀이 없으면 빈 셀 (렌더링 안 함)
}
```

#### 4.3. 새 픽셀 Ripple 효과

```tsx
// LEDPixelLayer.tsx - ripple 애니메이션
// 새 픽셀이 추가될 때:
// 1. circle-radius를 일시적으로 2배로 증가
// 2. circle-opacity를 0.3 → 0.7로 천천히 증가
// 3. MapLibre feature-state로 애니메이션

function animateNewPixel(pixelId: string) {
  const duration = 1000; // 1초
  const startTime = performance.now();

  function frame(time: number) {
    const progress = (time - startTime) / duration;
    if (progress >= 1) return;

    const radius = 1 + (1 - progress) * 2;   // 점점 작아짐
    const opacity = 0.3 + progress * 0.7;     // 점점 선명해짐

    map.setFeatureState(
      { source: 'pixels', id: pixelId },
      { rippleRadius: radius, rippleOpacity: opacity }
    );
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

#### 4.4. Viewport 기반 픽셀 페칭

```tsx
// 지도 이동/확대/축소 시 viewport 내 픽셀만 fetch
map.on('moveend', async () => {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const data = await api.getPixelsInBbox(sw.lat, sw.lng, ne.lat, ne.lng);
  updatePixelSource(data.pixels);
});
```

**체크포인트**: 실시간으로 다른 사용자 픽셀 확인 + 줌 인/아웃 시 부드러운 집계 전환

---

### Phase 5: 대시보드 & 통계 (Day 8-9)

**목표**: Global Mood LED (radial gradient + map 연동), 국가 랭킹, 지역 분석

#### 5.1. Global Mood (radial gradient + viewport 연동)

```tsx
// GlobalMood.tsx
// - 중심: 전 세계 평균 색상 (GET /api/stats/global)
// - 외곽: 현재 viewport dominant color (GET /api/stats/viewport)
// - radial-gradient로 부드럽게 연결
// - LED glow가 지도 영역으로 번져나가는 효과

interface GlobalMoodProps {
  globalAvgColor: string;    // ex) "#88CC44"
  viewportDominant: string;  // ex) "#CC6633"
}

function GlobalMood({ globalAvgColor, viewportDominant }: GlobalMoodProps) {
  // 중심부는 전 세계 평균, 바깥으로 갈수록 viewport 색상으로 전환
  const gradientStyle = {
    background: `radial-gradient(
      circle at 50% 50%,
      ${globalAvgColor} 0%,
      ${globalAvgColor} 35%,
      blendColors(globalAvgColor, viewportDominant, 0.5) 60%,
      ${viewportDominant} 85%,
      transparent 100%
    )`,
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    filter: 'blur(1px) drop-shadow(0 0 15px ${viewportDominant})',
  };

  return (
    <div className="global-mood-container">
      <div className="global-mood-led" style={gradientStyle} />
      <div className="global-mood-glow-spill" style={{
        background: `radial-gradient(
          ellipse at 50% 100%,
          ${viewportDominant}44 0%,
          transparent 70%
        )`,
        // LED 아래쪽으로 glow가 번져 지도와 연결되는 효과
      }} />
      <div className="global-mood-label">
        🌍 Global Mood
      </div>
    </div>
  );
}
```

**시각적 효과 설명**:

```
     ┌────────────────────┐
     │  ┌──────────────┐  │
     │  │   🟢→🟡→🔴  │  │  ← radial gradient LED
     │  │  (global avg)│  │     중심: 전 세계 평균
     │  └──────┬───────┘  │     외곽: viewport dominant
     │         │ glow spill│
     │    ┌────┴────┐     │
     │    │  번짐 효과  │     ← 지도 위로 glow 확장
     │    └─────────┘     │
     └────────┼───────────┘
              │
     ┌────────▼────────────────────┐
     │      Map (viewport pixels)  │
     │   🟢 🟡 🔴 🟢 🟡          │  ← glow가 실제 픽셀 색상과
     │   🔴 🟡 🟢 🟡 🔴          │     자연스럽게 블렌딩
     └─────────────────────────────┘
```

**업데이트 주기**:
- `globalAvgColor`: 30초마다 polling (전체 집계는 부하가 있으므로)
- `viewportDominant`: 지도 `moveend`/`zoomend` 이벤트发生时마다 갱신
- 색상 전환 시 CSS `transition: background 0.8s ease-in-out` 적용

#### 5.2. Country Ranking

```sql
-- backend 쿼리
SELECT
  c.name AS country,
  AVG(p.color) AS avg_color,  -- 실제로는 R/G/B 각각 AVG 후 재조합
  COUNT(*) AS pixel_count
FROM pixels p
JOIN countries c ON ST_Within(p.location, c.geom)
WHERE p.expires_at > NOW()
GROUP BY c.name
ORDER BY pixel_count DESC
LIMIT 20;
```

#### 5.3. Regional Mood

```tsx
// RegionalMood.tsx
// 지도에서 특정 영역 선택 (드래그 박스)
// → POST /api/stats/region
// → 해당 영역의 dominant color + 분포 표시
```

#### 5.4. Pixel Decay (Fade-out)

```tsx
// 픽셀 투명도를 생성 시간에 따라 계산
function getPixelOpacity(createdAt: Date): number {
  const age = (Date.now() - createdAt.getTime()) / 1000 / 60 / 60; // hours
  const maxAge = 24; // 24시간
  if (age >= maxAge) return 0;
  // 처음 12시간: 0.8 유지
  // 이후 12시간: 0.8 → 0 으로 선형 감소
  if (age < maxAge / 2) return 0.8;
  return 0.8 * (1 - (age - maxAge / 2) / (maxAge / 2));
}
```

**체크포인트**: Global Mood LED가 지도 viewport에 따라 그라데이션 변화 + 국가별 랭킹 표시

---

### Phase 6: 타임랩스 & 최적화 (Day 10-11)

**목표**: 감정 타임랩스 + 성능 최적화 + UI 마무리

#### 6.1. Mood Time-lapse

```tsx
// 시간 범위를 지정하여 픽셀 재생
// API: GET /api/pixels?start=2026-06-27T00:00:00Z&end=2026-06-28T00:00:00Z
// 프론트: requestAnimationFrame으로 시간을 진행시키며
//         해당 시간 범위의 픽셀을 순차적으로 표시

interface TimeLapseProps {
  startTime: Date;
  endTime: Date;
  speed: number; // 배속 (1x, 10x, 60x ...)
}
```

#### 6.2. 백엔드 Pixel Decay Cron

```python
# tasks/pixel_decay.py
async def cleanup_expired_pixels():
    """매시간 실행: expires_at < NOW() 인 픽셀 DELETE"""
    await supabase.table('pixels') \
        .delete() \
        .lt('expires_at', 'now()') \
        .execute()
```

- Vercel Cron Jobs 사용 (`vercel.json`에 `"crons"` 설정)
- 또는 외부 서비스 (EasyCron, cron-job.org) 로 대체

#### 6.3. 성능 최적화

| 항목 | 방법 |
|------|------|
| Viewport 쿼리 | PostGIS `ST_MakeEnvelope` + `&&` 연산자로 공간 인덱스 활용 |
| 픽셀 제한 | 한 번에 최대 5000개 픽셀 반환, 초과 시 무작위 샘플링 |
| 리렌더링 최적화 | React `useMemo`, `useCallback`으로 불필요한 재계산 방지 |
| WebSocket 배치 | 폭주 시 여러 이벤트를 batch 처리 |
| MapLibre 성능 | GeoJSON 소스 업데이트 시 `cluster: true` 옵션 검토 |

#### 6.4. 에러 핸들링

| 상태 | UI |
|------|-----|
| Loading | Map 위 스켈레톤 or 펄스 애니메이션 |
| GPS 권한 거부 | "위치를 알 수 없어 서울에서 시작합니다" 토스트 |
| 네트워크 오류 | "연결이 불안정합니다" 표시 + 재시도 버튼 |
| Empty state | "아직 이 지역에는 감정이 없어요. 첫 번째로 기록해보세요!" |
| Cool-down | 슬라이더 아래 5초 카운트다운 프로그레스 |

---

## UI/UX 디자인 사양

### 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  ┌──────────────┐              ┌──────────────────────┐ │
│  │   Dashboard   │              │   Header (minimal)   │ │
│  │  ┌──────────┐ │              │                      │ │
│  │  │ Global   │ │              │  [HueWorld 로고]     │ │
│  │  │ Mood LED │ │              │                      │ │
│  │  └──────────┘ │              └──────────────────────┘ │
│  │  ┌──────────┐ │                                       │
│  │  │ Country  │ │         ┌────────────────────────┐    │
│  │  │ Ranking  │ │         │                        │    │
│  │  └──────────┘ │         │     World Map          │    │
│  │               │         │     (MapLibre)         │    │
│  │               │         │                        │    │
│  └──────────────┘          │                        │    │
│                            │                        │    │
│  ┌─────────────────────────┴────────────────────────┘    │
│  │  MoodSlider: 🟢━━━━━●━━━━━🔴                     │    │
│  │              좋음     중간     안좋음              │    │
│  │              [지금 기록하기] 쿨다운: 0초             │    │
│  └──────────────────────────────────────────────────────┘
```

### 색상 시스템

| 요소 | 값 |
|------|-----|
| 배경색 | `#0A0A0F` (딥 블랙) |
| 지도 타일 | OpenFreeMap Dark (어두운 회색 톤) |
| 슬라이더 | `#00FF00` ↔ `#FFFF00` ↔ `#FF0000` |
| LED 글로우 | 선형 보간 + `drop-shadow` |
| 텍스트 | `#E0E0E0` |
| 강조 텍스트 | 해당 픽셀 색상 |
| Dashboard 배경 | `rgba(10, 10, 15, 0.8)` + `backdrop-filter: blur(8px)` |

---

## 마일스톤 요약

| Phase | 내용 | 기간 | 산출물 |
|-------|------|------|--------|
| 1 | 프로젝트 셋업 | Day 1 | 빈 지도 렌더링 + 배포 파이프라인 |
| 2 | 코어 지도 & 슬라이더 | Day 2-3 | 슬라이더 → 픽셀 제출 플로우 |
| 3 | 백엔드 & DB | Day 4-5 | REST API + Supabase Realtime |
| 4 | 실시간 동기화 & 줌 집계 | Day 6-7 | LED 맵 + 줌 집계 + Ripple |
| 5 | 대시보드 & 통계 | Day 8-9 | Global Mood (radial gradient) + 랭킹 |
| 6 | 타임랩스 & 최적화 | Day 10-11 | 타임랩스 + 성능 + 에러 핸들링 |
| 7 | 런칭 준비 | Day 12-13 | 모니터링 + 문서화 + 최종 QA |

---

## Global Mood LED — 최종 디자인 명세

이는 Phase 5의 핵심 기능으로, 별도로 상세히 정의합니다.

### 동작 원리

```
1. 사용자가 지도를 움직이거나 줌을 변경한다
2. moveend/zoomend 이벤트 → 현재 viewport bounds 계산
3. GET /api/stats/viewport?sw_lat=...&ne_lat=... → dominant color 반환
4. GET /api/stats/global → global average color 반환 (30초 간격)
5. CSS radial-gradient 업데이트:
   background: radial-gradient(
     at 50% 50%,
     globalAvg      0%,
     globalAvg     35%,
     blend(0.5)    60%,
     viewportDominant 85%,
     transparent  100%
   )
6. glow-spill 레이어가 지도 위로 색상을 번지게 함
7. transition: 0.8s ease-in-out 으로 부드러운 색상 전환
```

### 시각적 표현

- **형태**: 원형 LED (120×120px)
- **내부**: radial gradient (위 설명 참조)
- **외부 glow**: `drop-shadow(0 0 20px viewportDominant)` 가 지도 위에 투영
- **연결 효과**: LED 아래쪽으로 그라데이션이 번져나가며 지도의 실제 픽셀들과 시각적 연결
- **반응형**: 모바일에서는 축소하여 우측 하단에 플로팅

---

## 리스크 & 완화 전략

| 리스크 | 영향 | 완화 |
|--------|------|------|
| GPS 정밀도 부족 | 부정확한 위치 | jitter가 오히려 프라이버시 보호, 허용 오차 범위 안내 |
| 많은 동시 접속자 | DB 부하 | viewport 쿼리 최적화 + Supabase scale up |
| 악의적 사용 (도배) | 지도 오염 | session_id 기반 cool-down + IP 기반 추가 제한 |
| WebSocket 연결 끊김 | 실시간성 저하 | Supabase Realtime 자동 재연결 + polling fallback |
| OpenFreeMap 가용성 | 지도 미표시 | 타일 로드 실패 시 fallback 스타일 지정 |

---

## 추가 고려사항

- **MapLibre 커스텀 스타일**: OpenFreeMap의 다크 테마가 마음에 들지 않으면 추후 MapLibre Studio로 자체 스타일 제작 가능
- **오프라인 대응**: 서비스 특성 상 온라인 필수, 단 이전에 본 픽셀을 localStorage에 캐시하여 재방문시 빠르게 표시
- **SEO**: SPA이므로 정적 페이지 (랜딩, about)는 별도로 구성
