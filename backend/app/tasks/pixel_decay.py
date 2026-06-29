from ..services.database import get_supabase


async def cleanup_expired_pixels() -> int:
    """Delete pixels where expires_at < now().
    Returns number of deleted rows.
    """
    supabase = get_supabase()
    result = (
        supabase.table("pixels")
        .delete()
        .lt("expires_at", "now()")
        .execute()
    )
    deleted = len(result.data) if result.data else 0
    return deleted
