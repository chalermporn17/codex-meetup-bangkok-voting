const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const promptModal = document.querySelector("#prompt-modal");
const voteModal = document.querySelector("#vote-modal");
const editModal = document.querySelector("#edit-modal");

let eventState = null;
let projects = [];
let adminDashboard = null;
let adminFilter = "pending";
let toastTimer = null;
let screenshotPreviewUrl = null;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === "object" && body?.error ? body.error : "Something went wrong. Please try again.";
    throw new ApiError(message, response.status);
  }
  return body;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show${isError ? " error" : ""}`;
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 4200);
}

function setBusy(button, busy, busyLabel = "Working…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
  }
}

function statusCopy(state) {
  if (state.resultsPublished) return { label: "Results live", className: "" };
  if (state.votingOpen) return { label: "Voting open", className: "voting" };
  if (state.submissionsOpen) return { label: "Submissions open", className: "" };
  return { label: "Under review", className: "closed" };
}

function publicHeader(active) {
  const header = element("header", "site-header");
  header.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="/" data-nav>
        <img src="/icon.svg" alt="" width="38" height="38" />
        <span class="brand-copy">
          <span class="brand-kicker">Codex Community Meetup</span>
          <span class="brand-title">Bangkok #3</span>
        </span>
      </a>
      <nav class="nav" aria-label="Challenge navigation">
        <a href="/submit" data-nav ${active === "submit" ? 'aria-current="page"' : ""}>Submit</a>
        <a href="/gallery" data-nav ${active === "gallery" ? 'aria-current="page"' : ""}>Gallery</a>
      </nav>
    </div>`;
  return header;
}

function publicFooter() {
  const footer = element("footer", "site-footer");
  footer.innerHTML = `Codex Community Meetup Bangkok #3 · <a href="/admin" data-nav>Organizer</a>`;
  return footer;
}

function publicShell(active, main) {
  const shell = element("div", "app-shell");
  shell.append(publicHeader(active), main, publicFooter());
  app.replaceChildren(shell);
}

function routePath() {
  const path = window.location.pathname.replace(/\/+$/u, "") || "/";
  if (path === "/submit" || path === "/gallery" || path === "/admin") return path;
  return "/";
}

async function loadPublicData() {
  [eventState, { projects }] = await Promise.all([
    api("/api/public/state"),
    api("/api/public/projects")
  ]);
}

function renderHome() {
  const main = element("main", "page");
  main.id = "main";
  const status = statusCopy(eventState);
  main.innerHTML = `
    <section class="hero" aria-labelledby="challenge-title">
      <img class="hero-art" src="/meetup-brand.png" alt="Codex Community Meetup Bangkok" />
      <div class="hero-copy">
        <div class="status-pill ${status.className}">${status.label}</div>
        <p class="eyebrow">One-shot challenge</p>
        <h1 id="challenge-title">Build once.<br />Ship it.</h1>
        <p class="hero-lead">45 minutes · one prompt</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/submit" data-nav>Submit project</a>
          <a class="button button-secondary" href="/gallery" data-nav>Gallery</a>
        </div>
      </div>
    </section>
    <div class="info-strip" aria-label="Event details">
      <div class="info-item"><span>Build</span><strong>45 min</strong></div>
      <div class="info-item"><span>Prompt</span><strong>1</strong></div>
      <div class="info-item"><span>Vote</span><strong>1</strong></div>
    </div>
    <section class="workflow" aria-label="How it works">
      <strong>Build → Submit → Vote</strong>
      <span>Accepted projects go to the gallery.</span>
    </section>`;
  publicShell("home", main);
  document.title = "One-Shot Build Challenge · Bangkok";
}

function renderSubmit() {
  const main = element("main", "page");
  main.id = "main";
  main.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Submit</p>
        <h1>Your project</h1>
      </div>
      <div class="status-pill ${eventState.submissionsOpen ? "" : "closed"}">${eventState.submissionsOpen ? "Submissions open" : "Submissions closed"}</div>
    </div>
    <div class="submission-layout">
      <section class="form-panel" aria-labelledby="submission-form-title">
        <h2 id="submission-form-title" class="honeypot">Project submission form</h2>
        <div id="submission-content"></div>
      </section>
      <aside class="side-panel">
        <p class="eyebrow">Check first</p>
        <h2>Before submitting</h2>
        <ol>
          <li>Public link works.</li>
          <li>Screenshot is clear.</li>
          <li>Prompt is exact.</li>
        </ol>
      </aside>
    </div>`;
  publicShell("submit", main);
  document.title = "Submit · One-Shot Build Challenge";

  const content = document.querySelector("#submission-content");
  if (!eventState.submissionsOpen) {
    content.innerHTML = `
      <div class="success-state">
        <div class="success-icon">—</div>
        <h2>Submissions are closed</h2>
        <p>Accepted projects will appear in the gallery.</p>
        <a class="button button-secondary" href="/gallery" data-nav>Gallery</a>
      </div>`;
    return;
  }

  content.innerHTML = `
    <form id="submission-form" class="form-grid">
      <label class="field">
        <span>Participant / team</span>
        <input name="publisherName" maxlength="100" autocomplete="name" required />
      </label>
      <label class="field">
        <span>Project title</span>
        <input name="title" maxlength="120" required />
      </label>
      <label class="field field-wide">
        <span>Short description</span>
        <textarea name="description" maxlength="200" rows="3" placeholder="What does it do?" required></textarea>
        <span class="field-meta"><span></span><span id="description-count">0 / 200</span></span>
      </label>
      <label class="field field-wide">
        <span>Complete original prompt</span>
        <textarea name="originalPrompt" minlength="20" maxlength="20000" rows="10" placeholder="Paste the exact prompt" required></textarea>
      </label>
      <label class="field field-wide">
        <span>Public project link</span>
        <input name="projectUrl" type="url" maxlength="2000" inputmode="url" placeholder="https://…" required />
      </label>
      <label class="field upload-field">
        <span>Project screenshot</span>
        <span class="upload-zone" id="upload-zone">
          <input name="screenshot" type="file" accept="image/jpeg,image/png,image/webp" required />
          <span class="upload-copy" id="upload-copy"><strong>Choose screenshot</strong><span>JPG, PNG or WebP · 8 MB max</span></span>
        </span>
      </label>
      <label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off" /></label>
      <label class="check-row">
        <input name="confirmed" type="checkbox" value="true" required />
        <span>I confirm this was built in 45 minutes from one prompt, with no follow-up prompts or restricted content.</span>
      </label>
      <button class="button button-accent form-submit" type="submit">Submit project</button>
    </form>`;

  const form = document.querySelector("#submission-form");
  const description = form.elements.description;
  const counter = document.querySelector("#description-count");
  description.addEventListener("input", () => {
    counter.textContent = `${description.value.length} / 200`;
  });
  form.elements.screenshot.addEventListener("change", handleScreenshotPreview);
  form.addEventListener("submit", handleProjectSubmission);
}

function handleScreenshotPreview(event) {
  const file = event.target.files?.[0];
  const zone = document.querySelector("#upload-zone");
  if (!file || !zone) return;
  if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
  screenshotPreviewUrl = URL.createObjectURL(file);
  const preview = element("img", "upload-preview");
  preview.src = screenshotPreviewUrl;
  preview.alt = "Selected project screenshot preview";
  zone.querySelector("#upload-copy")?.remove();
  zone.prepend(preview);
}

async function handleProjectSubmission(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, "Submitting…");
  try {
    await api("/api/submissions", { method: "POST", body: new FormData(form) });
    const content = document.querySelector("#submission-content");
    content.innerHTML = `
      <div class="success-state">
        <div class="success-icon">✓</div>
        <h2>Project submitted</h2>
        <p>It will appear after organizer approval.</p>
        <a class="button button-secondary" href="/gallery" data-nav>Gallery</a>
      </div>`;
    showToast("Project submitted for organizer review.");
  } catch (error) {
    showToast(error.message, true);
    setBusy(button, false);
  }
}

function createProjectCard(project) {
  const card = element("article", "project-card");
  const link = element("a", "project-link");
  link.href = project.projectUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Open ${project.title} by ${project.publisherName}`);

  const imageWrap = element("div", "project-image-wrap");
  const image = element("img", "project-image");
  image.src = project.screenshotUrl;
  image.alt = `${project.title} project screenshot`;
  image.loading = "lazy";
  image.decoding = "async";
  imageWrap.append(image);
  if (Number.isInteger(project.rank)) {
    imageWrap.append(element("span", "rank-badge", `#${project.rank}`));
  }

  const body = element("div", "project-body");
  body.append(
    element("h2", "", project.title),
    element("p", "publisher", `By ${project.publisherName}`),
    element("p", "project-description", project.description),
    element("span", "project-open-hint", "Open ↗")
  );
  link.append(imageWrap, body);

  const footer = element("div", "card-footer");
  const actions = element("div", "card-actions");
  const promptButton = element("button", "button button-secondary button-small", "Prompt");
  promptButton.type = "button";
  promptButton.addEventListener("click", () => openPrompt(project));
  actions.append(promptButton);
  if (eventState.votingOpen) {
    const voteButton = element("button", "button button-accent button-small", "Vote");
    voteButton.type = "button";
    voteButton.addEventListener("click", () => openVote(project));
    actions.append(voteButton);
  }
  footer.append(actions);
  if (Number.isInteger(project.voteCount)) {
    footer.append(element("span", "vote-count", `${project.voteCount} vote${project.voteCount === 1 ? "" : "s"}`));
  }
  card.append(link, footer);
  return card;
}

function renderGallery() {
  const main = element("main", "page");
  main.id = "main";
  const status = statusCopy(eventState);
  const head = element("div", "page-head");
  head.innerHTML = `
    <div>
      <p class="eyebrow">Gallery</p>
      <h1>${eventState.resultsPublished ? "Results" : "Projects"}</h1>
      <p>Tap a project to open it.</p>
    </div>
    <div class="status-pill ${status.className}">${status.label}</div>`;
  main.append(head);

  if (projects.length === 0) {
    const empty = element("div", "empty-state");
    empty.innerHTML = `<img src="/icon.svg" alt="" /><h2>No projects yet</h2><p>Accepted projects will appear here.</p>`;
    main.append(empty);
  } else {
    const grid = element("section", "gallery-grid");
    grid.setAttribute("aria-label", "Accepted project gallery");
    for (const project of projects) grid.append(createProjectCard(project));
    main.append(grid);
  }
  publicShell("gallery", main);
  document.title = `${eventState.resultsPublished ? "Results" : "Gallery"} · One-Shot Build Challenge`;
}

function openPrompt(project) {
  document.querySelector("#prompt-title").textContent = project.title;
  document.querySelector("#prompt-content").textContent = project.originalPrompt;
  promptModal.showModal();
}

function openVote(project) {
  document.querySelector("#vote-project-title").textContent = `Vote for ${project.title}`;
  document.querySelector("#vote-project-id").value = project.id;
  document.querySelector("#vote-voter-name").value = "";
  voteModal.showModal();
  setTimeout(() => document.querySelector("#vote-voter-name").focus(), 50);
}

async function renderPublic(path) {
  try {
    await loadPublicData();
    if (path === "/submit") renderSubmit();
    else if (path === "/gallery") renderGallery();
    else renderHome();
  } catch (error) {
    renderLoadError(error.message);
  }
}

function renderLoadError(message) {
  const main = element("main", "page page-narrow");
  main.id = "main";
  const empty = element("div", "empty-state");
  empty.innerHTML = `<img src="/icon.svg" alt="" /><h2>Could not open the challenge</h2>`;
  empty.append(element("p", "", message));
  const retry = element("button", "button button-secondary", "Try again");
  retry.type = "button";
  retry.addEventListener("click", renderRoute);
  empty.append(retry);
  main.append(empty);
  publicShell("", main);
}

function renderAdminLogin(message = "") {
  const shell = element("div", "admin-shell login-wrap");
  const card = element("main", "login-card");
  card.id = "main";
  card.innerHTML = `
    <img src="/icon.svg" alt="" width="56" height="56" />
    <p class="eyebrow">Organizer only</p>
    <h1>Challenge control room</h1>
    <div id="admin-login-error"></div>
    <form id="admin-login-form">
      <input class="honeypot" name="username" autocomplete="username" value="organizer" tabindex="-1" aria-hidden="true" />
      <label class="field"><span>Admin passphrase</span><input name="password" type="password" autocomplete="current-password" required /></label>
      <button class="button button-accent" type="submit">Sign in</button>
    </form>`;
  shell.append(card);
  app.replaceChildren(shell);
  if (message) {
    const error = element("div", "inline-error", message);
    document.querySelector("#admin-login-error").append(error);
  }
  document.title = "Organizer · One-Shot Build Challenge";
  document.querySelector("#admin-login-form").addEventListener("submit", handleAdminLogin);
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  setBusy(button, true, "Signing in…");
  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: form.elements.password.value })
    });
    await renderAdmin();
  } catch (error) {
    renderAdminLogin(error.message);
  }
}

function adminHeader() {
  const header = element("header", "admin-header");
  header.innerHTML = `
    <div class="admin-header-inner">
      <a class="brand" href="/admin" data-nav>
        <img src="/icon.svg" alt="" width="38" height="38" />
        <span><h1>Organizer</h1><p>Bangkok #3</p></span>
      </a>
      <div class="toolbar-actions">
        <a class="button button-secondary button-small" href="/gallery" target="_blank" rel="noopener">View gallery ↗</a>
        <button class="button button-secondary button-small" id="admin-logout" type="button">Log out</button>
      </div>
    </div>`;
  return header;
}

function statCard(label, value) {
  const card = element("div", "stat");
  card.append(element("span", "", label), element("strong", "", String(value)));
  return card;
}

function controlCard(label, activeLabel, copy, buttonLabel, buttonClass, onClick, disabled = false) {
  const card = element("article", "control-card");
  const copyWrap = element("div");
  copyWrap.append(element("span", "", label), element("strong", "", activeLabel));
  if (copy) copyWrap.append(element("p", "", copy));
  const button = element("button", `button ${buttonClass} button-small`, buttonLabel);
  button.type = "button";
  button.disabled = disabled;
  button.addEventListener("click", () => onClick(button));
  card.append(copyWrap, button);
  return card;
}

function renderAdminDashboard(data) {
  const shell = element("div", "admin-shell");
  const main = element("main", "admin-page");
  main.id = "main";

  const head = element("div", "page-head");
  head.innerHTML = `<div><p class="eyebrow">Organizer</p><h1>Event control</h1></div>`;
  main.append(head);

  const stats = element("section", "stat-grid");
  stats.setAttribute("aria-label", "Challenge statistics");
  stats.append(
    statCard("Total", data.stats.total),
    statCard("Pending", data.stats.pending),
    statCard("Accepted", data.stats.accepted),
    statCard("Rejected", data.stats.rejected),
    statCard("Votes cast", data.stats.votesCast)
  );
  main.append(stats);

  const controls = element("section", "control-grid");
  controls.setAttribute("aria-label", "Event controls");
  controls.append(
    controlCard(
      "Submissions",
      data.state.submissionsOpen ? "Open" : "Closed",
      "",
      data.state.submissionsOpen ? "Close submissions" : "Open submissions",
      "button-secondary",
      (button) => changeEventState({ submissionsOpen: !data.state.submissionsOpen }, button)
    ),
    controlCard(
      "Audience voting",
      data.state.votingOpen ? "Open" : "Closed",
      "",
      data.state.votingOpen ? "Close voting" : "Open voting",
      data.state.votingOpen ? "button-danger" : "button-accent",
      (button) => changeEventState({ votingOpen: !data.state.votingOpen }, button)
    ),
    controlCard(
      "Public results",
      data.state.resultsPublished ? "Published" : "Hidden",
      data.state.votingOpen ? "Close voting first." : "",
      data.state.resultsPublished ? "Hide results" : "Publish results",
      "button-secondary",
      (button) => changeEventState({ resultsPublished: !data.state.resultsPublished }, button),
      data.state.votingOpen
    )
  );
  main.append(controls);

  const submissionsPanel = element("section", "admin-panel");
  submissionsPanel.innerHTML = `
    <div class="admin-section-head">
      <div><p class="eyebrow">Review</p><h2>Submissions</h2></div>
    </div>
    <div class="filter-chips" id="submission-filters" role="tablist" aria-label="Filter submissions"></div>
    <div class="admin-list" id="admin-submissions"></div>`;
  main.append(submissionsPanel);

  const resultsPanel = element("section", "admin-panel");
  resultsPanel.innerHTML = `
    <div class="admin-section-head">
      <div><p class="eyebrow">Final count</p><h2>Results</h2>${data.resultsHidden ? "<p>Hidden while voting is open.</p>" : ""}</div>
    </div>
    <div class="results-list" id="admin-results"></div>`;
  main.append(resultsPanel);

  shell.append(adminHeader(), main);
  app.replaceChildren(shell);
  document.title = "Organizer · One-Shot Build Challenge";
  document.querySelector("#admin-logout").addEventListener("click", handleAdminLogout);
  renderSubmissionFilters(data);
  renderAdminSubmissions(data);
  renderAdminResults(data);
}

function renderSubmissionFilters(data) {
  const filters = document.querySelector("#submission-filters");
  filters.replaceChildren();
  const options = [
    ["pending", `Pending ${data.stats.pending}`],
    ["accepted", `Accepted ${data.stats.accepted}`],
    ["rejected", `Rejected ${data.stats.rejected}`],
    ["all", `All ${data.stats.total}`]
  ];
  for (const [value, label] of options) {
    const button = element("button", `filter-chip${adminFilter === value ? " active" : ""}`, label);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", adminFilter === value ? "true" : "false");
    button.addEventListener("click", () => {
      adminFilter = value;
      renderSubmissionFilters(data);
      renderAdminSubmissions(data);
    });
    filters.append(button);
  }
}

function renderAdminSubmissions(data) {
  const target = document.querySelector("#admin-submissions");
  target.replaceChildren();
  const filtered = data.submissions.filter((submission) => adminFilter === "all" || submission.status === adminFilter);
  if (filtered.length === 0) {
    target.append(element("p", "modal-copy", `No ${adminFilter === "all" ? "" : `${adminFilter} `}submissions.`));
    return;
  }

  for (const submission of filtered) {
    const card = element("article", "admin-card");
    const image = element("img", "admin-thumb");
    image.src = submission.screenshotUrl;
    image.alt = `${submission.title} screenshot`;
    image.loading = "lazy";

    const copy = element("div", "admin-main");
    const status = element("span", `status-badge ${submission.status}`, submission.status);
    const title = element("h3", "", submission.title);
    const publisher = element("p", "publisher", `By ${submission.publisherName}`);
    const description = element("p", "", submission.description);
    const submitted = element("p", "", `Submitted ${formatBangkokTime(submission.submittedAt)}`);
    const projectLink = element("a", "project-open-hint", "Open project ↗");
    projectLink.href = submission.projectUrl;
    projectLink.target = "_blank";
    projectLink.rel = "noopener noreferrer";
    copy.append(status, title, publisher, description, submitted, projectLink);

    const actions = element("div", "admin-actions");
    const edit = element("button", "button button-secondary button-small", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openEditSubmission(submission));
    actions.append(edit);
    if (submission.status !== "accepted") {
      const accept = element("button", "button button-accent button-small", "Accept");
      accept.type = "button";
      accept.addEventListener("click", () => quickModerate(submission, "accepted", accept));
      actions.append(accept);
    }
    if (submission.status !== "rejected") {
      const reject = element("button", "button button-danger button-small", "Reject");
      reject.type = "button";
      reject.addEventListener("click", () => quickModerate(submission, "rejected", reject));
      actions.append(reject);
    }
    card.append(image, copy, actions);
    target.append(card);
  }
}

function renderAdminResults(data) {
  const target = document.querySelector("#admin-results");
  target.replaceChildren();
  if (data.resultsHidden) {
    target.append(element("p", "modal-copy", "Results unlock for organizers when voting closes."));
    return;
  }
  if (data.results.length === 0) {
    target.append(element("p", "modal-copy", "No accepted projects to rank yet."));
    return;
  }
  for (const result of data.results) {
    const row = element("article", "result-row");
    const rank = element("span", "result-rank", `#${result.rank}`);
    const copy = element("div");
    copy.append(element("h3", "", result.title), element("p", "", `By ${result.publisherName}`));
    row.append(rank, copy, element("span", "result-votes", `${result.voteCount} vote${result.voteCount === 1 ? "" : "s"}`));
    target.append(row);
  }
}

function formatBangkokTime(value) {
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

async function renderAdmin() {
  try {
    const session = await api("/api/admin/session");
    if (!session.authenticated) {
      renderAdminLogin();
      return;
    }
    adminDashboard = await api("/api/admin/dashboard");
    renderAdminDashboard(adminDashboard);
  } catch (error) {
    if (error.status === 401) renderAdminLogin();
    else renderAdminLogin(error.message);
  }
}

async function changeEventState(changes, button) {
  setBusy(button, true, "Updating…");
  try {
    await api("/api/admin/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changes)
    });
    showToast("Event state updated.");
    await renderAdmin();
  } catch (error) {
    showToast(error.message, true);
    setBusy(button, false);
  }
}

async function quickModerate(submission, status, button) {
  setBusy(button, true, status === "accepted" ? "Accepting…" : "Rejecting…");
  try {
    await saveSubmission(submission, status);
    showToast(status === "accepted" ? "Project published to the gallery." : "Project rejected.");
    await renderAdmin();
  } catch (error) {
    showToast(error.message, true);
    setBusy(button, false);
  }
}

function saveSubmission(submission, status = submission.status) {
  return api(`/api/admin/submissions/${submission.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      publisherName: submission.publisherName,
      title: submission.title,
      description: submission.description,
      projectUrl: submission.projectUrl,
      status
    })
  });
}

function openEditSubmission(submission) {
  document.querySelector("#edit-id").value = submission.id;
  document.querySelector("#edit-publisher").value = submission.publisherName;
  document.querySelector("#edit-title").value = submission.title;
  document.querySelector("#edit-description").value = submission.description;
  document.querySelector("#edit-url").value = submission.projectUrl;
  document.querySelector("#edit-status").value = submission.status;
  document.querySelector("#edit-prompt").value = submission.originalPrompt;
  document.querySelector("#edit-screenshot").value = "";
  editModal.showModal();
}

async function handleEditSubmission(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const id = document.querySelector("#edit-id").value;
  setBusy(button, true, "Saving…");
  try {
    await api(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publisherName: document.querySelector("#edit-publisher").value,
        title: document.querySelector("#edit-title").value,
        description: document.querySelector("#edit-description").value,
        projectUrl: document.querySelector("#edit-url").value,
        status: document.querySelector("#edit-status").value
      })
    });
    const screenshot = document.querySelector("#edit-screenshot").files?.[0];
    if (screenshot) {
      const screenshotForm = new FormData();
      screenshotForm.set("screenshot", screenshot);
      await api(`/api/admin/submissions/${id}/screenshot`, { method: "POST", body: screenshotForm });
    }
    editModal.close();
    showToast("Submission saved.");
    await renderAdmin();
  } catch (error) {
    showToast(error.message, true);
    setBusy(button, false);
  }
}

async function handleAdminLogout() {
  try {
    await api("/api/admin/logout", { method: "POST" });
  } finally {
    adminDashboard = null;
    renderAdminLogin();
  }
}

async function renderRoute() {
  const path = routePath();
  if (path === "/admin") await renderAdmin();
  else await renderPublic(path);
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-nav]");
  if (!link || link.origin !== window.location.origin) return;
  event.preventDefault();
  history.pushState({}, "", link.href);
  renderRoute();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`)?.close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.querySelector("#copy-prompt").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.querySelector("#prompt-content").textContent);
  showToast("Prompt copied.");
});

document.querySelector("#vote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, "Recording…");
  try {
    const result = await api("/api/votes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        voterName: document.querySelector("#vote-voter-name").value,
        submissionId: document.querySelector("#vote-project-id").value
      })
    });
    voteModal.close();
    showToast(result.message);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#edit-form").addEventListener("submit", handleEditSubmission);
window.addEventListener("popstate", renderRoute);
renderRoute();
