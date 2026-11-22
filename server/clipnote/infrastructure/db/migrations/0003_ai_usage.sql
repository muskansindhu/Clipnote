-- Daily count of AI calls per user (UTC day), used to cap model spend.

CREATE TABLE IF NOT EXISTS ai_usage (
    user_id TEXT    NOT NULL,
    day     DATE    NOT NULL,
    calls   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);
