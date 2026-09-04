CREATE TABLE IF NOT EXISTS rate_limits (
  key_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket
ON rate_limits(bucket);
