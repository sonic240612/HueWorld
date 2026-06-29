-- HueWorld: 초기 데이터베이스 스키마
-- PostGIS 확장 활성화
CREATE EXTENSION IF NOT EXISTS postgis;

-- 픽셀 테이블
CREATE TABLE IF NOT EXISTS pixels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location      GEOGRAPHY(Point, 4326) NOT NULL,
  color         CHAR(7) NOT NULL,           -- hex color: #00FF00
  raw_lat       DOUBLE PRECISION,           -- jitter 전 원본 위도 (디버깅용)
  raw_lng       DOUBLE PRECISION,           -- jitter 전 원본 경도 (디버깅용)
  session_id    UUID NOT NULL,              -- 익명 세션 식별자
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pixels_location
  ON pixels USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_pixels_created_at
  ON pixels (created_at);

CREATE INDEX IF NOT EXISTS idx_pixels_expires_at
  ON pixels (expires_at);

CREATE INDEX IF NOT EXISTS idx_pixels_session_id
  ON pixels (session_id);

-- Realtime 활성화 (INSERT 이벤트만 구독)
ALTER PUBLICATION supabase_realtime ADD TABLE pixels;

-- 자동으로 expires_at 설정하는 트리거 (선택사항)
CREATE OR REPLACE FUNCTION set_pixel_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_pixel_expiry ON pixels;
CREATE TRIGGER trg_set_pixel_expiry
  BEFORE INSERT ON pixels
  FOR EACH ROW
  EXECUTE FUNCTION set_pixel_expiry();

-- 주기적 만료 픽셀 정리 (선택사항: pg_cron 필요)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-expired-pixels', '0 * * * *',
--   $$DELETE FROM pixels WHERE expires_at < NOW()$$
-- );
