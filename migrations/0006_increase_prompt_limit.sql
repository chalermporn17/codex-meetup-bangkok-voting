CREATE TEMP TABLE votes_before_prompt_limit AS
SELECT id, code, submission_id, created_at
FROM votes;

CREATE TEMP TABLE attendee_votes_before_prompt_limit AS
SELECT id, submission_id, voter_email, browser_token_hash, created_at
FROM attendee_votes;

DROP TABLE votes;
DROP TABLE attendee_votes;

CREATE TABLE submissions_with_larger_prompt (
  id TEXT PRIMARY KEY,
  publisher_name TEXT NOT NULL CHECK(length(publisher_name) BETWEEN 2 AND 100),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 120),
  description TEXT NOT NULL CHECK(length(description) BETWEEN 5 AND 200),
  original_prompt TEXT NOT NULL CHECK(length(original_prompt) BETWEEN 20 AND 1000000),
  project_url TEXT NOT NULL CHECK(length(project_url) <= 2000),
  screenshot_key TEXT NOT NULL,
  screenshot_content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email TEXT
);

INSERT INTO submissions_with_larger_prompt
  (id, publisher_name, title, description, original_prompt, project_url,
   screenshot_key, screenshot_content_type, status, submitted_at, updated_at, email)
SELECT id, publisher_name, title, description, original_prompt, project_url,
       screenshot_key, screenshot_content_type, status, submitted_at, updated_at, email
FROM submissions;

DROP TABLE submissions;
ALTER TABLE submissions_with_larger_prompt RENAME TO submissions;

CREATE INDEX idx_submissions_status_submitted
  ON submissions(status, submitted_at DESC);

CREATE UNIQUE INDEX idx_submissions_email
  ON submissions(email)
  WHERE email IS NOT NULL;

CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE REFERENCES voter_codes(code) ON DELETE RESTRICT,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO votes (id, code, submission_id, created_at)
SELECT id, code, submission_id, created_at
FROM votes_before_prompt_limit;

CREATE INDEX idx_votes_submission ON votes(submission_id);

CREATE TABLE attendee_votes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
  voter_email TEXT CHECK(
    voter_email IS NULL OR length(voter_email) BETWEEN 3 AND 254
  ),
  browser_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO attendee_votes
  (id, submission_id, voter_email, browser_token_hash, created_at)
SELECT id, submission_id, voter_email, browser_token_hash, created_at
FROM attendee_votes_before_prompt_limit;

CREATE UNIQUE INDEX idx_attendee_votes_email
  ON attendee_votes(voter_email)
  WHERE voter_email IS NOT NULL;

CREATE INDEX idx_attendee_votes_submission
  ON attendee_votes(submission_id);

DROP TABLE votes_before_prompt_limit;
DROP TABLE attendee_votes_before_prompt_limit;
