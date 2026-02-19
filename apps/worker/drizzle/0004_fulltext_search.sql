CREATE INDEX IF NOT EXISTS market_fulltext_idx ON market USING GIN (to_tsvector('english', title_raw || ' ' || COALESCE(headline, '')));
CREATE INDEX IF NOT EXISTS market_active_status_idx ON market (status) WHERE status = 'active';
