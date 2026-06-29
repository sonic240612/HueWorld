from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routes.pixels import router as pixels_router
from .routes.stats import router as stats_router

app = FastAPI(
    title="HueWorld API",
    description="실시간 글로벌 감정 지도 백엔드",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pixels_router)
app.include_router(stats_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "HueWorld"}
