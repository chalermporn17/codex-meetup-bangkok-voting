CREATE TABLE attendee_votes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
  voter_name TEXT NOT NULL CHECK(length(voter_name) BETWEEN 2 AND 80),
  voter_name_normalized TEXT NOT NULL UNIQUE,
  browser_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendee_votes_submission ON attendee_votes(submission_id);
