-- Keep snapshots without foreign keys so history survives vote and project removal.
CREATE TABLE vote_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_id TEXT NOT NULL,
  voter_email TEXT,
  previous_voter_email TEXT,
  action TEXT NOT NULL CHECK(action IN (
    'imported', 'selected', 'switched', 'reassigned',
    'removed', 'reset', 'submission_removed'
  )),
  previous_submission_id TEXT,
  previous_project_title TEXT,
  submission_id TEXT,
  project_title TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

CREATE INDEX idx_vote_audit_vote ON vote_audit_log(vote_id, id DESC);

-- Only the current selection is known for votes recorded before this migration.
INSERT INTO vote_audit_log (vote_id, voter_email, action, submission_id, project_title)
SELECT v.id, v.voter_email, 'imported', v.submission_id, s.title
FROM attendee_votes v JOIN submissions s ON s.id = v.submission_id
ORDER BY v.created_at, v.id;
