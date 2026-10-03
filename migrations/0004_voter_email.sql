CREATE TABLE attendee_votes_with_email (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
  voter_email TEXT CHECK(
    voter_email IS NULL OR length(voter_email) BETWEEN 3 AND 254
  ),
  browser_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO attendee_votes_with_email
  (id, submission_id, voter_email, browser_token_hash, created_at)
SELECT id, submission_id, NULL, browser_token_hash, created_at
FROM attendee_votes;

DROP TABLE attendee_votes;

ALTER TABLE attendee_votes_with_email RENAME TO attendee_votes;

CREATE UNIQUE INDEX idx_attendee_votes_email
  ON attendee_votes(voter_email)
  WHERE voter_email IS NOT NULL;

CREATE INDEX idx_attendee_votes_submission
  ON attendee_votes(submission_id);

