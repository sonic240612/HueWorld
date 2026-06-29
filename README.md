# HueWorld

실시간 글로벌 무드 맵. 사람들이 지금 느끼는 감정을 색깔로 표현하고, 어두운 세계 지도에 LED 픽셀로 시각화합니다.

> **🌐 [https://hueworld.vercel.app](https://hueworld.vercel.app)**

## Features

- **Mood 선택** — 슬라이더로 초록(GOOD) → 노랑(OK) → 빨강(BAD) 사이에서 감정 색상 선택
- **글로벌 맵** — MapLibre GL JS + OpenFreeMap 다크 스타일, 확대/축소에 따라 격자/포인트 전환
- **실시간 업데이트** — Supabase Realtime + 5초 폴링 폴백, 새 픽셀이 즉시 나타남
- **프라이버시** — GPS 좌표를 ±100m 랜덤 지터, 세션 전용 UUID, 계정 불필요
- **대시보드** — 글로벌 평균 무드, 지역별 분포(Good/Okay/Bad), 국가별 랭킹 (top 10)
- **픽셀 Decay** — 24시간 TTL, 처음 12시간 100% 불투명, 이후 12시간 선형 페이드아웃
- **Cool-down** —同一 세션 5초 간격 제한으로 API 남용 방지

## Tech Stack

| 계층 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite |
| Map | MapLibre GL JS + OpenFreeMap (dark style) |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL + PostGIS (Supabase) |
| Realtime | Supabase Realtime (WebSocket) |
| Deploy | Vercel (Frontend + Serverless Backend) |
| Auth | 익명 세션 UUID (서버 저장 없음) |

## Architecture

**[https://hueworld.vercel.app](https://hueworld.vercel.app)** — 웹 브라우저에서 바로 접속

```
Browser (hueworld.vercel.app)
  │
  ├── MapLibre GL JS (OpenFreeMap tiles)
  ├── Supabase Realtime (WebSocket) ───┐
  └── REST API (fetch) ──── FastAPI (hueworld-api.vercel.app)
                                    │
                                    └── Supabase (PostgreSQL + PostGIS)
```

- Frontend와 Backend는 별도 Vercel 프로젝트로 분리
- 프론트엔드는 `VITE_API_BASE_URL` 환경변수로 백엔드 URL 지정
- Supabase Realtime으로 WebSocket 직접 구독 (5초 HTTP 폴링 폴백)

## Directory Structure

```
hueworld/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱 진입점
│   │   ├── config.py            # 환경변수 설정
│   │   ├── models/pixel.py      # Pydantic 모델
│   │   ├── routes/pixels.py     # /api/pixels endpoint
│   │   ├── routes/stats.py      # /api/stats endpoint
│   │   └── services/
│   │       ├── store.py         # DB 저장소 (Supabase / in-memory 폴백)
│   │       ├── countries.py     # 국가 경계 lookup (Ray Casting)
│   │       └── database.py      # Supabase 클라이언트
│   ├── requirements.txt
│   └── vercel.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # 메인 앱
│   │   ├── components/
│   │   │   ├── Map/HueMap.tsx   # MapLibre 지도
│   │   │   ├── Controls/        # MoodSlider, SessionControls
│   │   │   ├── Dashboard/       # GlobalMood, RegionalMood, CountryRanking
│   │   │   └── common/          # Toast 알림
│   │   ├── hooks/               # usePixels, useGeolocation
│   │   ├── services/            # api.ts, supabase.ts
│   │   └── utils/               # aggregation, color, decay
│   ├── package.json
│   └── vercel.json
└── supabase/
    └── migrations/001_init.sql  # 초기 스키마
```

## Deployment

### Vercel (Production)

두 개의 Vercel 프로젝트가 필요합니다:

| 프로젝트 | URL | Root Directory | Framework |
|----------|-----|----------------|-----------|
| `hueworld` | `https://hueworld.vercel.app` | `frontend/` | Vite |
| `hueworld-api` | `https://hueworld-api.vercel.app` | `backend/` | Python |

GitHub 연결 시 각 프로젝트의 Root Directory를 위와 같이 설정하면 `main` 브랜치 푸시 시 자동 배포됩니다.

### Environment Variables (Vercel)

**hueworld (frontend)**: `VITE_API_BASE_URL` → `https://hueworld-api.vercel.app/api`

**hueworld-api (backend)**: 위 표의 Backend 변수 전체 설정

### Cleanup

Vercel Hobby 플랜은 Cron 미지원으로 만료 픽셀 정리는 수동 호출:

```bash
curl -X POST https://hueworld-api.vercel.app/api/pixels/cleanup
```

외부 스케줄러(cron-job.org 등)를 사용해 주기적 호출 가능합니다.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/pixels` | 새 픽셀 제출 (body: `{lat, lng, color, session_id}`) |
| `GET` | `/api/pixels` | 바운딩 박스 내 픽셀 조회 (`sw_lat, sw_lng, ne_lat, ne_lng`) |
| `GET` | `/api/stats/global` | 글로벌 평균 색상 + 픽셀 수 |
| `GET` | `/api/stats/viewport` | 현재 뷰포트 통계 |
| `GET` | `/api/stats/countries` | 국가별 픽셀 랭킹 (top 10) |
| `GET` | `/api/stats/region` | 특정 좌표 반경 내 분포 (`lat, lng, radius_km`) |
| `POST` | `/api/pixels/cleanup` | 만료 픽셀 일괄 삭제 |

## Privacy

- 위치 정보는 ±100m 랜덤 지터 후 저장됩니다
- session_id는 브라우저 `crypto.randomUUID()`로 생성된 익명 UUID입니다
- 개인 식별 정보는 저장되지 않습니다
- 픽셀 데이터는 24시간 후 자동 만료됩니다
