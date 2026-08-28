import Script from 'next/script';

export default function ChallengePage() {
  return (
    <>
      <link rel="stylesheet" href="/styles.css" />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div id="app">
        <main className="loading-screen" id="main">
          <img src="/icon.svg" width="54" height="54" alt="" />
          <p>Opening the challenge…</p>
        </main>
      </div>
      <div className="toast" id="toast" role="status" aria-live="polite" />

      <dialog className="modal prompt-modal" id="prompt-modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Complete original prompt</p>
            <h2 id="prompt-title">Project prompt</h2>
          </div>
          <button
            className="icon-button"
            data-close-dialog="prompt-modal"
            aria-label="Close prompt"
          >
            ×
          </button>
        </div>
        <pre id="prompt-content" />
        <div className="modal-actions">
          <button className="button button-secondary" id="copy-prompt" type="button">
            Copy prompt
          </button>
          <button
            className="button button-primary"
            data-close-dialog="prompt-modal"
            type="button"
          >
            Done
          </button>
        </div>
      </dialog>

      <dialog className="modal vote-modal" id="vote-modal">
        <form id="vote-form">
          <div className="modal-head">
            <div>
              <p className="eyebrow">Audience vote</p>
              <h2 id="vote-project-title">Vote for this project</h2>
            </div>
            <button
              className="icon-button"
              data-close-dialog="vote-modal"
              type="button"
              aria-label="Close voting form"
            >
              ×
            </button>
          </div>
          <p className="modal-copy">One vote per attendee.</p>
          <label className="field">
            <span>Your name / Codex handle</span>
            <input
              id="vote-voter-name"
              name="voterName"
              autoComplete="name"
              maxLength={80}
              required
            />
          </label>
          <input id="vote-project-id" name="submissionId" type="hidden" />
          <div className="modal-actions">
            <button
              className="button button-secondary"
              data-close-dialog="vote-modal"
              type="button"
            >
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              Confirm vote
            </button>
          </div>
        </form>
      </dialog>

      <dialog className="modal edit-modal" id="edit-modal">
        <form id="edit-form">
          <div className="modal-head">
            <div>
              <p className="eyebrow">Organizer review</p>
              <h2>Edit submission</h2>
            </div>
            <button
              className="icon-button"
              data-close-dialog="edit-modal"
              type="button"
              aria-label="Close editor"
            >
              ×
            </button>
          </div>
          <input id="edit-id" type="hidden" />
          <div className="form-grid">
            <label className="field">
              <span>Participant or team</span>
              <input id="edit-publisher" maxLength={100} required />
            </label>
            <label className="field">
              <span>Project title</span>
              <input id="edit-title" maxLength={120} required />
            </label>
            <label className="field field-wide">
              <span>Short description</span>
              <textarea id="edit-description" maxLength={200} rows={3} required />
            </label>
            <label className="field field-wide">
              <span>Public project link</span>
              <input id="edit-url" type="url" required />
            </label>
            <label className="field">
              <span>Decision</span>
              <select id="edit-status" defaultValue="pending">
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="field">
              <span>
                Replace screenshot <small>optional</small>
              </span>
              <input id="edit-screenshot" type="file" accept="image/jpeg,image/png,image/webp" />
            </label>
            <label className="field field-wide">
              <span>
                Original prompt <small>read-only</small>
              </span>
              <textarea id="edit-prompt" rows={7} readOnly />
            </label>
          </div>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              data-close-dialog="edit-modal"
              type="button"
            >
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              Save submission
            </button>
          </div>
        </form>
      </dialog>

      <Script src="/app.js" strategy="afterInteractive" />
    </>
  );
}
