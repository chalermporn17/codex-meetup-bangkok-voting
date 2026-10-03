ALTER TABLE submissions ADD COLUMN email TEXT;

CREATE UNIQUE INDEX idx_submissions_email
  ON submissions(email)
  WHERE email IS NOT NULL;

CREATE TABLE submission_email_whitelist (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

