import os
from typing import Optional
from supabase import create_client, Client
from ..config import settings


_supabase: Optional[Client] = None


def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
        key = settings.supabase_key or os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise ValueError("Supabase credentials not configured")
        _supabase = create_client(url, key)
    return _supabase
