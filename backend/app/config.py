import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    database_url: str = os.getenv("DATABASE_URL", "")
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    ).split(",")
    cooldown_seconds: int = int(os.getenv("COOLDOWN_SECONDS", "5"))
    pixel_ttl_hours: int = int(os.getenv("PIXEL_TTL_HOURS", "24"))
    min_pixel_threshold: int = int(os.getenv("MIN_PIXEL_THRESHOLD", "1000"))
    max_ttl_hours: int = int(os.getenv("MAX_TTL_HOURS", "168"))
    jitter_meters: int = int(os.getenv("JITTER_METERS", "100"))


settings = Settings()
