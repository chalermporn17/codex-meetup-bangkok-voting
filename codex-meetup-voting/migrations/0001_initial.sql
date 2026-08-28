PRAGMA foreign_keys = ON;

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('submissions_open', '1'),
  ('voting_open', '0'),
  ('results_published', '0');

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  publisher_name TEXT NOT NULL CHECK(length(publisher_name) BETWEEN 2 AND 100),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 120),
  description TEXT NOT NULL CHECK(length(description) BETWEEN 5 AND 200),
  original_prompt TEXT NOT NULL CHECK(length(original_prompt) BETWEEN 20 AND 20000),
  project_url TEXT NOT NULL CHECK(length(project_url) <= 2000),
  screenshot_key TEXT NOT NULL,
  screenshot_content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_submissions_status_submitted
  ON submissions(status, submitted_at DESC);

CREATE TABLE voter_codes (
  code TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE REFERENCES voter_codes(code) ON DELETE RESTRICT,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_votes_submission ON votes(submission_id);
