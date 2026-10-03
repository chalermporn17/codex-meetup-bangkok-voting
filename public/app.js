const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const promptModal = document.querySelector("#prompt-modal");
const voteModal = document.querySelector("#vote-modal");
const editModal = document.querySelector("#edit-modal");
const gameModal = document.querySelector("#game-modal");
let playingProject = null;
let gameOpener = null;
let gameScrollY = 0;
let gameRoute = null;
let gameLoadingTimer = null;

let eventState = null;
let projects = [];
let adminDashboard = null;
let adminFilter = "pending";
let adminScoreTimer = null;
let adminScoreRefreshing = false;
let publicVoteTimer = null;
let publicVoteRefreshing = false;
let toastTimer = null;
let screenshotPreviewUrl = null;

class ApiError extends Error {
  constructor(message, status, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...options });
  } catch {
    throw new Error("Could not connect. Check your connection and try again.");
  }
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === "object" && body?.error ? body.error : "Something went wrong. Please try again.";
    const code = typeof body === "object" && typeof body?.code === "string" ? body.code : "";
    throw new ApiError(message, response.status, code);
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
          <span class="brand-kicker">DevDay Exchange Community:</span>
          <span class="brand-title">Bangkok</span>
        </span>
      </a>
      <nav class="nav" aria-label="Challenge navigation">
        <a href="/" data-nav ${active === "home" ? 'aria-current="page"' : ""}>Challenge</a>
        <a href="/submit" data-nav ${active === "submit" ? 'aria-current="page"' : ""}>Submit</a>
        <a href="/gallery" data-nav ${active === "gallery" ? 'aria-current="page"' : ""}>Gallery</a>
        ${eventState?.resultsPublished ? `<a href="/results" data-nav ${active === "results" ? 'aria-current="page"' : ""}>Results</a>` : ""}
      </nav>
    </div>`;
  return header;
}

function publicFooter() {
  const footer = element("footer", "site-footer");
  footer.innerHTML = `DevDay Exchange Community: Bangkok · <a href="/manual" data-nav>User manual</a> · <a href="/admin" data-nav>Organizer</a>`;
  return footer;
}

function publicShell(active, main) {
  const shell = element("div", "app-shell");
  shell.append(publicHeader(active), main, publicFooter());
  app.replaceChildren(shell);
}

function routePath() {
  const path = window.location.pathname.replace(/\/+$/u, "") || "/";
  if (
    path === "/submit" ||
    path === "/gallery" ||
    path === "/results" ||
    path === "/manual" ||
    path === "/admin" ||
    path === "/admin/votes" ||
    path === "/admin/manual" ||
    path === "/admin/live" ||
    path === "/admin/total-vote-only-view"
  ) return path;
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
    <section class="town-intro" aria-labelledby="challenge-title">
      <div class="town-copy">
        <div class="status-pill ${status.className}">${status.label}</div>
        <h1 id="challenge-title">Build once.<br />Ship it.</h1>
        <p>Explore the one-shot builds from your community. Find a favorite. Cast your vote.</p>
        <div class="town-facts" aria-label="Challenge rules">
          <span><b>45</b> minutes</span><span><b>1</b> prompt</span><span><b>1</b> vote</span>
        </div>
        <div class="town-actions">
          <a class="button button-primary" href="#projects">Explore projects</a>
          ${eventState.submissionsOpen ? '<a class="button button-secondary" href="/submit" data-nav>Submit project</a>' : ''}
        </div>
      </div>
      <div class="town-world">
        <img src="/assets/pocket-town.webp" width="1536" height="1024" fetchpriority="high" alt="A pixel-art town square with trees, visitors, and a community garden." />
        <span class="world-sign">Welcome, builders.</span>
      </div>
    </section>`;
  const gallery = element("section", "town-gallery");
  gallery.id = "projects";
  gallery.tabIndex = -1;
  gallery.setAttribute("aria-labelledby", "home-projects-title");
  gallery.innerHTML = `<div class="page-head"><div><h2 id="home-projects-title">Projects</h2><p>Accepted builds from the community.</p></div>
    ${eventState.votingOpen ? `<div class="live-vote-total" id="gallery-live-votes">Live · ${eventState.votesCast} vote${eventState.votesCast === 1 ? "" : "s"}</div>` : ''}</div>`;
  appendProjectGallery(gallery);
  main.append(gallery);
  publicShell("home", main);
  document.title = "DevDay Exchange Community: Bangkok";
  startPublicVoteUpdates();
}

function renderSubmit() {
  const whitelistValidationEnabled =
    eventState.emailWhitelistValidationEnabled !== false;
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
  document.title = "Submit · DevDay Exchange Community: Bangkok";

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
        <span>Email</span>
        <input name="email" type="email" maxlength="254" autocomplete="email" required />
        <span class="field-meta"><span>${whitelistValidationEnabled ? "Use an email from the event whitelist." : "Any valid email is accepted while whitelist validation is off."}</span></span>
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
        <textarea name="originalPrompt" minlength="20" maxlength="1000000" rows="10" placeholder="Paste the exact prompt" required></textarea>
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
      <div class="form-message" id="submission-error" role="alert" aria-live="assertive"></div>
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
  zone.querySelector(".upload-preview")?.remove();
  zone.prepend(preview);
}

async function handleProjectSubmission(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const errorTarget = form.querySelector("#submission-error");
  errorTarget.replaceChildren();
  setBusy(button, true, "Submitting…");
  try {
    await api("/api/submissions", { method: "POST", body: new FormData(form) });
    const content = document.querySelector("#submission-content");
    content.innerHTML = `
      <div class="success-state" tabindex="-1">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h2>Project submitted</h2>
        <p>It will appear after organizer approval.</p>
        <a class="button button-secondary" href="/gallery" data-nav>Gallery</a>
      </div>`;
    content.querySelector(".success-state").focus();
    showToast("Project submitted for organizer review.");
  } catch (error) {
    errorTarget.append(element("div", "inline-error", error.message));
    errorTarget.tabIndex = -1;
    errorTarget.focus();
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
  link.setAttribute("aria-label", `Play ${project.title} by ${project.publisherName}`);
  link.setAttribute("aria-haspopup", "dialog");
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openGame(project, link);
  });

  const imageWrap = element("div", "project-image-wrap");
  const image = element("img", "project-image");
  image.src = project.screenshotUrl;
  image.alt = `${project.title} project screenshot`;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.remove();
    imageWrap.append(element("span", "image-unavailable", "Screenshot unavailable"));
  }, { once: true });
  imageWrap.append(image);
  if (Number.isInteger(project.rank)) {
    imageWrap.append(element("span", "rank-badge", `#${project.rank}`));
  }

  const body = element("div", "project-body");
  body.append(
    element("h2", "", project.title),
    element("p", "publisher", `By ${project.publisherName}`),
    element("p", "project-description", project.description)
  );
  link.append(imageWrap, body);

  const footer = element("div", "card-footer");
  const actions = element("div", "card-actions");
  const playButton = element("button", "button button-primary button-small", "▶ Play");
  playButton.type = "button";
  playButton.dataset.playId = project.id;
  playButton.setAttribute("aria-label", `Play ${project.title}`);
  playButton.setAttribute("aria-haspopup", "dialog");
  playButton.addEventListener("click", () => openGame(project, playButton));
  actions.append(playButton);
  const externalLink = element("a", "button button-secondary button-small", "Open in new tab ↗");
  externalLink.href = project.projectUrl;
  externalLink.target = "_blank";
  externalLink.rel = "noopener noreferrer";
  externalLink.setAttribute("aria-label", `Open ${project.title} in new tab`);
  actions.append(externalLink);
  const promptButton = element("button", "button button-secondary button-small", "Prompt");
  promptButton.type = "button";
  promptButton.addEventListener("click", () => openPrompt(project));
  if (eventState.votingOpen) {
    const voteButton = element("button", "button button-secondary button-small", "Vote");
    voteButton.type = "button";
    voteButton.addEventListener("click", () => openVote(project));
    actions.append(voteButton);
  }
  actions.append(promptButton);
  footer.append(actions);
  if (Number.isInteger(project.voteCount)) {
    footer.append(element("span", "vote-count", `${project.voteCount} vote${project.voteCount === 1 ? "" : "s"}`));
  }
  card.append(link, footer);
  return card;
}

function appendProjectGallery(container) {
  if (projects.length === 0) {
    const empty = element("div", "empty-state");
    empty.innerHTML = `<img src="/icon.svg" alt="" /><h2>No projects yet</h2><p>Accepted projects will appear here.</p>`;
    container.append(empty);
  } else {
    const grid = element("section", "gallery-grid");
    grid.setAttribute("aria-label", "Accepted project gallery");
    for (const project of projects) grid.append(createProjectCard(project));
    container.append(grid);
  }
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
      <p>Pick a game, press Play, and try it here.</p>
    </div>
    <div class="gallery-status-group">
      <div class="status-pill ${status.className}">${status.label}</div>
      ${eventState.votingOpen ? `<div class="live-vote-total" id="gallery-live-votes">Live · ${eventState.votesCast} vote${eventState.votesCast === 1 ? "" : "s"}</div>` : ""}
    </div>`;
  main.append(head);

  appendProjectGallery(main);
  publicShell("gallery", main);
  document.title = `${eventState.resultsPublished ? "Results" : "Gallery"} · DevDay Exchange Community: Bangkok`;
  startPublicVoteUpdates();
}

function createRankingRow(project, maxVotes) {
  const voteCount = Number(project.voteCount) || 0;
  const percentage = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
  const row = element("article", "ranking-row");
  const rank = element("span", "ranking-rank", `#${project.rank}`);
  const main = element("div", "ranking-main");
  const label = element("div", "ranking-label");
  const projectLink = element("a", "ranking-project", project.title);
  projectLink.href = project.projectUrl;
  projectLink.target = "_blank";
  projectLink.rel = "noopener noreferrer";
  const votes = element("strong", "ranking-votes", `${voteCount} vote${voteCount === 1 ? "" : "s"}`);
  label.append(projectLink, votes);

  const publisher = element("p", "ranking-publisher", `By ${project.publisherName}`);
  const track = element("div", "ranking-track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", `${project.title}: ${voteCount} votes`);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(maxVotes));
  track.setAttribute("aria-valuenow", String(voteCount));
  const bar = element("span", "ranking-bar");
  bar.style.width = `${percentage}%`;
  track.append(bar);
  main.append(label, publisher, track);
  row.append(rank, main);
  return row;
}

function renderResults() {
  if (!eventState.resultsPublished) {
    history.replaceState({}, "", "/gallery");
    renderGallery();
    return;
  }

  const main = element("main", "page page-narrow");
  main.id = "main";
  const head = element("div", "page-head");
  head.innerHTML = `
    <div>
      <p class="eyebrow">Final results</p>
      <h1>Ranking</h1>
      <p>Final project ranking by audience votes.</p>
    </div>
    <div class="status-pill">Results live</div>`;
  main.append(head);

  if (projects.length === 0) {
    const empty = element("div", "empty-state");
    empty.innerHTML = `<img src="/icon.svg" alt="" /><h2>No results</h2><p>No accepted projects are available.</p>`;
    main.append(empty);
  } else {
    const panel = element("section", "ranking-panel");
    panel.setAttribute("aria-label", "Final project ranking");
    const maxVotes = Math.max(1, ...projects.map((project) => Number(project.voteCount) || 0));
    for (const project of projects) panel.append(createRankingRow(project, maxVotes));
    main.append(panel);
  }

  publicShell("results", main);
  document.title = "Final results · DevDay Exchange Community: Bangkok";
}

function renderUserManual() {
  const whitelistValidationEnabled =
    eventState.emailWhitelistValidationEnabled !== false;
  const main = element("main", "page page-narrow");
  main.id = "main";
  main.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Help</p>
        <h1>User manual</h1>
        <p>Use this guide to submit a project, vote, and view the final results.</p>
      </div>
    </div>
    <div class="manual-grid">
      <section class="manual-card">
        <p class="eyebrow">Play</p>
        <h2>Try the submitted games</h2>
        <ol>
          <li>Open the <a href="/gallery" data-nav>Gallery</a> and select <strong>Play</strong> on a project.</li>
          <li>Click or tap inside the game to use its controls. Choose <strong>Fullscreen</strong> for more room when supported.</li>
          <li>Choose <strong>Next game</strong> to try another project, or <strong>Vote</strong> while voting is open.</li>
          <li>Close the player to return to your place in the gallery. Closing or switching games ends the current session.</li>
        </ol>
        <p class="manual-note">If a game does not appear, use <strong>Open in new tab</strong>. Some sites only work in their own tab.</p>
      </section>
      <section class="manual-card">
        <p class="eyebrow">Submit</p>
        <h2>Submit your project</h2>
        <ol>
          <li>${whitelistValidationEnabled ? "Confirm with staff that your email is on the whitelist." : "Use a valid email address. Whitelist validation is currently off."}</li>
          <li>Open <a href="/submit" data-nav>Submit</a>.</li>
          <li>Enter the project details, complete original prompt, public link, and screenshot.</li>
          <li>Confirm the challenge rules and select <strong>Submit project</strong>.</li>
          <li>Wait for staff to accept the project before it appears in the gallery.</li>
        </ol>
        <p class="manual-note">Each email can submit one project. A repeated email warning does not remove your form content.</p>
      </section>
      <section class="manual-card">
        <p class="eyebrow">Vote</p>
        <h2>Vote for a project</h2>
        <ol>
          <li>Open the <a href="/gallery" data-nav>Gallery</a> while voting is open.</li>
          <li>Select <strong>Vote</strong> on the project that you choose.</li>
          <li>Enter ${whitelistValidationEnabled ? "your whitelisted" : "a valid"} email address and submit the vote.</li>
          <li>If you already voted, confirm only when you want to change your vote.</li>
        </ol>
        <p class="manual-note">Each email has one active vote. Changing a vote moves it to the selected project.</p>
      </section>
      <section class="manual-card">
        <p class="eyebrow">Results</p>
        <h2>View voting information</h2>
        <ul>
          <li>The gallery shows a small live total while voting is open.</li>
          <li>The <strong>Results</strong> tab appears after staff publishes the final results.</li>
          <li>The Results page shows project ranks, vote totals, and vote bars.</li>
        </ul>
      </section>
      <section class="manual-card">
        <p class="eyebrow">Help</p>
        <h2>Contact staff</h2>
        <p>Contact event staff if your email is not accepted, you submitted by mistake, or you must submit again.</p>
      </section>
    </div>`;
  publicShell("manual", main);
  document.title = "User manual · DevDay Exchange Community: Bangkok";
}

function stopPublicVoteUpdates() {
  if (publicVoteTimer !== null) clearInterval(publicVoteTimer);
  publicVoteTimer = null;
  publicVoteRefreshing = false;
}

async function refreshPublicVoteTotal() {
  const target = document.querySelector("#gallery-live-votes");
  const requestPath = routePath();
  if (publicVoteRefreshing || !["/", "/gallery"].includes(requestPath)) return;
  publicVoteRefreshing = true;
  try {
    const state = await api("/api/public/state");
    if (routePath() !== requestPath) return;
    if (target) target.textContent = `${state.votingOpen ? "Live" : "Voting closed"} · ${state.votesCast} vote${state.votesCast === 1 ? "" : "s"}`;
    const phaseChanged = eventState.votingOpen !== state.votingOpen ||
      eventState.resultsPublished !== state.resultsPublished ||
      eventState.submissionsOpen !== state.submissionsOpen ||
      eventState.acceptedCount !== state.acceptedCount;
    eventState = state;
    if (gameModal.open) syncGameControls();
    if (phaseChanged) {
      voteModal.close();
      await renderRoute();
    }
  } catch {
    if (target) target.textContent = "Vote total temporarily unavailable. Reconnecting…";
  } finally {
    publicVoteRefreshing = false;
  }
}

function startPublicVoteUpdates() {
  stopPublicVoteUpdates();
  publicVoteTimer = setInterval(refreshPublicVoteTotal, 3_000);
}

function getVoteErrorTarget(form = document.querySelector("#vote-form")) {
  let target = form.querySelector("#vote-error");
  if (target) return target;
  target = element("div", "form-message vote-error");
  target.id = "vote-error";
  target.tabIndex = -1;
  target.setAttribute("role", "alert");
  target.setAttribute("aria-live", "assertive");
  form.querySelector(".modal-head").after(target);
  return target;
}

function showVoteError(target, message) {
  target.replaceChildren(element("div", "inline-error", message));
  requestAnimationFrame(() => target.focus());
}

function syncGameControls() {
  document.querySelector("#game-vote").hidden = !eventState?.votingOpen;
  document.querySelector("#game-next").disabled = projects.length < 2;
  document.querySelector("#game-fullscreen").hidden = !(document.fullscreenEnabled &&
    typeof document.querySelector("#game-shell").requestFullscreen === "function");
  const phaseLabel = eventState?.votingOpen
    ? "Voting open"
    : eventState?.resultsPublished ? "Free play · Results are published" : "Free play · Voting is closed";
  const phase = document.querySelector("#game-phase");
  if (phase.textContent !== phaseLabel) phase.textContent = phaseLabel;
}

function openGame(project, opener) {
  if (typeof gameModal.showModal !== "function") {
    window.open(project.projectUrl, "_blank", "noopener,noreferrer");
    return;
  }
  if (!gameModal.open) {
    gameOpener = opener;
    gameScrollY = window.scrollY;
    gameRoute = routePath();
    document.documentElement.classList.add("game-is-open");
    gameModal.showModal();
  }
  playingProject = project;
  document.querySelector("#game-title").textContent = project.title;
  const index = projects.findIndex((entry) => entry.id === project.id);
  document.querySelector("#game-position").textContent = `Now playing · ${index + 1} of ${projects.length}`;
  document.querySelector("#game-external").href = project.projectUrl;
  syncGameControls();
  clearTimeout(gameLoadingTimer);
  const stage = document.querySelector("#game-stage");
  const status = document.querySelector("#game-status");
  stage.replaceChildren();
  // Never give a same-origin submitted page scripts plus same-origin sandbox access.
  const url = new URL(project.projectUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.origin === location.origin) {
    status.textContent = "Open this project in a new tab to play.";
    stage.append(element("p", "game-unavailable", "This project opens in its own tab. Use the link below to play."));
    return;
  }
  const frame = element("iframe", "game-frame");
  frame.title = `${project.title} — playable game`;
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-pointer-lock");
  frame.setAttribute("allow", "fullscreen");
  frame.setAttribute("allowfullscreen", "");
  frame.referrerPolicy = "no-referrer";
  status.textContent = "Loading game…";
  const fallback = () => {
    status.textContent = "Game not showing? Try opening it in a new tab.";
  };
  // Cross-origin load events cannot tell us whether the host refused embedding.
  // Keep an external link visible even after load, without claiming play succeeded.
  frame.addEventListener("load", () => {
    if (!frame.isConnected) return;
    clearTimeout(gameLoadingTimer);
    status.textContent = "Click or tap inside to play. Blank screen?";
  });
  frame.addEventListener("error", () => {
    if (!frame.isConnected) return;
    clearTimeout(gameLoadingTimer);
    fallback();
  });
  frame.src = url.href;
  stage.append(frame);
  gameLoadingTimer = setTimeout(fallback, 12_000);
}

async function exitGameFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
  }
}

async function closeGame() {
  await exitGameFullscreen();
  gameModal.close();
}

gameModal.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeGame();
});
gameModal.addEventListener("close", () => {
  clearTimeout(gameLoadingTimer);
  document.querySelector("#game-stage").replaceChildren();
  gameModal.classList.remove("game-expanded");
  document.querySelector("#game-fullscreen").textContent = "Fullscreen";
  document.documentElement.classList.remove("game-is-open");
  playingProject = null;
  if (routePath() === gameRoute) {
    window.scrollTo({ top: gameScrollY, behavior: "instant" });
    if (gameOpener?.isConnected) gameOpener.focus({ preventScroll: true });
    else document.querySelector("[data-play-id]")?.focus({ preventScroll: true });
  }
  gameOpener = null;
});
document.querySelector("#close-game").addEventListener("click", closeGame);
document.querySelector("#game-next").addEventListener("click", () => {
  if (!playingProject || projects.length < 2) return;
  const index = projects.findIndex((project) => project.id === playingProject.id);
  openGame(projects[(index + 1) % projects.length]);
});
document.querySelector("#game-vote").addEventListener("click", async () => {
  await exitGameFullscreen();
  if (playingProject && eventState?.votingOpen) openVote(playingProject);
});
document.querySelector("#game-fullscreen").addEventListener("click", async () => {
  if (gameModal.classList.contains("game-expanded")) {
    gameModal.classList.remove("game-expanded");
    document.querySelector("#game-fullscreen").textContent = "Fullscreen";
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector("#game-shell").requestFullscreen();
  } catch {
    gameModal.classList.add("game-expanded");
    document.querySelector("#game-fullscreen").textContent = "Restore size";
    document.querySelector("#game-status").textContent = "Expanded to fit this window.";
  }
});
document.addEventListener("fullscreenchange", () => {
  document.querySelector("#game-fullscreen").textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
});

function openPrompt(project) {
  document.querySelector("#prompt-title").textContent = project.title;
  document.querySelector("#prompt-content").textContent = project.originalPrompt;
  promptModal.showModal();
}

function openVote(project) {
  document.querySelector("#vote-project-title").textContent = `Vote for ${project.title}`;
  document.querySelector("#vote-project-id").value = project.id;
  document.querySelector("#vote-voter-email").value = "";
  document.querySelector("#vote-email-help").textContent =
    eventState.emailWhitelistValidationEnabled !== false
      ? "Enter an email from the event whitelist. You can change your vote later."
      : "Enter a valid email address. You can change your vote later.";
  getVoteErrorTarget().replaceChildren();
  voteModal.showModal();
  setTimeout(() => document.querySelector("#vote-voter-email").focus(), 50);
}

async function renderPublic(path) {
  try {
    await loadPublicData();
    if (path === "/submit") renderSubmit();
    else if (path === "/gallery") renderGallery();
    else if (path === "/results") renderResults();
    else if (path === "/manual") renderUserManual();
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
  stopAdminScoreUpdates();
  clearTimeout(toastTimer);
  toast.textContent = "";
  toast.className = "toast";
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
  document.title = "Organizer · DevDay Exchange Community: Bangkok";
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
    await renderRoute();
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
        <span><h1>Organizer</h1><p>DevDay Exchange Community: Bangkok</p></span>
      </a>
      <div class="admin-header-actions">
        <nav class="toolbar-actions admin-header-links" aria-label="Organizer links">
          <a class="button button-secondary button-small" href="/admin/votes" data-nav>Voter audit</a>
          <a class="button button-secondary button-small" href="/gallery" target="_blank" rel="noopener">Gallery ↗</a>
          <a class="button button-secondary button-small" href="/admin/manual" data-nav>Admin manual</a>
        </nav>
        <button class="button button-secondary button-small admin-logout" id="admin-logout" type="button">Log out</button>
      </div>
    </div>`;
  return header;
}

function statCard(label, value, valueId = "") {
  const card = element("div", "stat");
  const strong = element("strong", "", String(value));
  if (valueId) strong.id = valueId;
  card.append(element("span", "", label), strong);
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
  stopAdminScoreUpdates();
  const whitelistValidationEnabled =
    data.state.emailWhitelistValidationEnabled !== false;
  const shell = element("div", "admin-shell");
  const main = element("main", "admin-page");
  main.id = "main";

  const head = element("div", "page-head");
  head.innerHTML = `
    <div><p class="eyebrow">Organizer</p><h1>Event control</h1></div>
    <div class="toolbar-actions">
      <a class="button button-secondary button-small" href="/admin/total-vote-only-view" data-nav>Total-vote-only view</a>
      <a class="button button-secondary button-small" href="/admin/live" data-nav>Admin scoreboard</a>
    </div>`;
  main.append(head);

  const stats = element("section", "stat-grid");
  stats.setAttribute("aria-label", "Challenge statistics");
  stats.append(
    statCard("Total", data.stats.total),
    statCard("Pending", data.stats.pending),
    statCard("Accepted", data.stats.accepted),
    statCard("Rejected", data.stats.rejected),
    statCard("Votes cast", data.stats.votesCast, "admin-votes-cast")
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
    ),
    controlCard(
      "Whitelist validation",
      whitelistValidationEnabled ? "Enabled" : "Disabled",
      whitelistValidationEnabled
        ? "Only listed emails can submit and vote."
        : "Any valid email can submit and vote.",
      whitelistValidationEnabled ? "Disable validation" : "Enable validation",
      whitelistValidationEnabled ? "button-danger" : "button-accent",
      (button) => changeEventState(
        { emailWhitelistValidationEnabled: !whitelistValidationEnabled },
        button
      )
    )
  );
  main.append(controls);

  const voteActionsPanel = element("section", "admin-panel");
  voteActionsPanel.innerHTML = `
    <div class="admin-section-head">
      <div>
        <p class="eyebrow">Vote records</p>
        <h2>Manage votes</h2>
        <p>Review votes by email, or remove all active votes to restart voting. Audit history stays available.</p>
      </div>
      <div class="toolbar-actions">
        <a class="button button-secondary button-small" href="/admin/votes" data-nav>View voters and audit log</a>
        <button class="button button-danger button-small" id="reset-all-votes" type="button" ${data.stats.votesCast === 0 ? "disabled" : ""}>Reset all votes</button>
      </div>
    </div>`;
  main.append(voteActionsPanel);

  const emailPanel = element("section", "admin-panel");
  emailPanel.innerHTML = `
    <div class="admin-section-head">
      <div>
        <p class="eyebrow">Email access</p>
        <h2>Email whitelist</h2>
        <p>${whitelistValidationEnabled ? "Only these email addresses can submit and vote." : "Validation is off. This saved list does not restrict submissions or votes."} Each email can submit once.</p>
      </div>
      <span class="list-count">${data.emailWhitelist.length} email${data.emailWhitelist.length === 1 ? "" : "s"}</span>
    </div>
    <form class="email-add-form" id="email-add-form">
      <label class="field">
        <span>Add one email</span>
        <input name="email" type="email" maxlength="254" autocomplete="off" required />
      </label>
      <button class="button button-accent button-small" type="submit">Add email</button>
    </form>
    <div class="email-list" id="email-whitelist-list"></div>
    <details class="bulk-editor">
      <summary>Bulk edit the whole whitelist</summary>
      <form id="email-bulk-form">
        <label class="field">
          <span>Whitelist emails</span>
          <textarea id="email-bulk-input" rows="8" spellcheck="false" autocomplete="off"></textarea>
          <span class="field-meta"><span>Use spaces, commas, or new lines. Commas change to new lines as you type.</span></span>
        </label>
        <button class="button button-secondary button-small" type="submit">Replace whitelist</button>
      </form>
    </details>`;
  main.append(emailPanel);

  const submissionsPanel = element("section", "admin-panel");
  submissionsPanel.innerHTML = `
    <div class="admin-section-head">
      <div><p class="eyebrow">Review</p><h2>Submissions</h2></div>
    </div>
    <div class="filter-chips" id="submission-filters" role="tablist" aria-label="Filter submissions"></div>
    <div class="admin-list" id="admin-submissions"></div>`;
  main.append(submissionsPanel);

  shell.append(adminHeader(), main);
  app.replaceChildren(shell);
  document.title = "Organizer · DevDay Exchange Community: Bangkok";
  document.querySelector("#admin-logout").addEventListener("click", handleAdminLogout);
  document.querySelector("#reset-all-votes").addEventListener("click", (event) => resetAllVotes(event.currentTarget));
  renderEmailWhitelist(data);
  renderSubmissionFilters(data);
  renderAdminSubmissions(data);
}

function parseEmailList(value) {
  return [...new Set(value
    .split(/[\s,;]+/u)
    .map((email) => email.normalize("NFKC").trim().toLocaleLowerCase("en-US"))
    .filter(Boolean))].sort();
}

function renderEmailWhitelist(data) {
  const target = document.querySelector("#email-whitelist-list");
  target.replaceChildren();
  if (data.emailWhitelist.length === 0) {
    target.append(element("p", "modal-copy", "No email addresses are saved in the whitelist."));
  } else {
    for (const email of data.emailWhitelist) {
      const row = element("div", "email-row");
      row.append(element("span", "", email));
      const remove = element("button", "button button-danger button-small", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${email} from the whitelist`);
      remove.addEventListener("click", () => saveEmailWhitelist(
        data.emailWhitelist.filter((item) => item !== email),
        remove,
        "Email removed from the whitelist."
      ));
      row.append(remove);
      target.append(row);
    }
  }

  const addForm = document.querySelector("#email-add-form");
  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = addForm.elements.email.value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
    if (data.emailWhitelist.includes(email)) {
      showToast("This email is already on the whitelist.", true);
      return;
    }
    await saveEmailWhitelist([...data.emailWhitelist, email], addForm.querySelector("button"), "Email added to the whitelist.");
  });

  const bulkForm = document.querySelector("#email-bulk-form");
  const bulkInput = document.querySelector("#email-bulk-input");
  bulkInput.value = data.emailWhitelist.join(" ");
  bulkInput.addEventListener("input", () => {
    bulkInput.value = bulkInput.value.replace(/[,;]+/gu, "\n");
  });
  bulkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveEmailWhitelist(parseEmailList(bulkInput.value), bulkForm.querySelector("button"), "Email whitelist replaced.");
  });
}

async function saveEmailWhitelist(emails, button, successMessage) {
  setBusy(button, true, "Saving…");
  try {
    await api("/api/admin/email-whitelist", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emails })
    });
    showToast(successMessage);
    await renderAdmin();
  } catch (error) {
    showToast(error.message, true);
    setBusy(button, false);
  }
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
    const email = element("p", "submission-email", submission.email || "No email recorded");
    const description = element("p", "", submission.description);
    const submitted = element("p", "", `Submitted ${formatBangkokTime(submission.submittedAt)}`);
    const projectLink = element("a", "project-open-hint", "Open project ↗");
    projectLink.href = submission.projectUrl;
    projectLink.target = "_blank";
    projectLink.rel = "noopener noreferrer";
    copy.append(status, title, publisher, email, description, submitted, projectLink);

    const actions = element("div", "admin-actions");
    const edit = element("button", "button button-secondary button-small", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openEditSubmission(submission));
    const voters = projectVotersLink(submission.id, "View voters", "button button-secondary button-small");
    voters.setAttribute("aria-label", `View voters for ${submission.title}`);
    actions.append(edit, voters);
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
    const remove = element("button", "button button-danger button-small", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => removeSubmission(submission, remove));
    actions.append(remove);
    card.append(image, copy, actions);
    target.append(card);
  }
}

async function removeSubmission(submission, button) {
  if (!window.confirm(`Remove "${submission.title}"? This also removes its votes and screenshot.`)) return;
  setBusy(button, true, "Removing…");
  try {
    await api(`/api/admin/submissions/${submission.id}`, { method: "DELETE" });
    showToast("Submission removed.");
    await renderAdmin();
  } catch (error) {
    showToast(error.message, true);
    setBusy(button, false);
  }
}

function renderAdminResults(data) {
  const target = document.querySelector("#admin-results");
  if (!target) return;
  target.replaceChildren();
  const votesCast = data.votesCast ?? data.stats?.votesCast ?? 0;
  const votingOpen = data.votingOpen ?? data.state?.votingOpen ?? false;
  const votesValue = document.querySelector("#admin-votes-cast");
  if (votesValue) votesValue.textContent = String(votesCast);
  const resetButton = document.querySelector("#reset-all-votes");
  if (resetButton) resetButton.disabled = votesCast === 0;
  const status = document.querySelector("#live-score-status");
  if (status) {
    status.textContent = votingOpen
      ? `Live · ${votesCast} vote${votesCast === 1 ? "" : "s"} · updates every 3 seconds`
      : `Voting closed · ${votesCast} vote${votesCast === 1 ? "" : "s"}`;
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
    const voters = element("div", "result-voter-actions");
    const votersLink = projectVotersLink(result.id, "View voters", "result-voter-link");
    votersLink.setAttribute("aria-label", `View voters for ${result.title}`);
    voters.append(element("span", "result-votes", `${result.voteCount} vote${result.voteCount === 1 ? "" : "s"}`), votersLink);
    row.append(rank, copy, voters);
    target.append(row);
  }
}

function stopAdminScoreUpdates() {
  if (adminScoreTimer !== null) clearInterval(adminScoreTimer);
  adminScoreTimer = null;
  adminScoreRefreshing = false;
}

async function refreshAdminScores() {
  const resultsTarget = document.querySelector("#admin-results");
  const totalTarget = document.querySelector("#total-vote-only-count");
  if (adminScoreRefreshing || (!resultsTarget && !totalTarget)) return;
  adminScoreRefreshing = true;
  try {
    const scores = await api("/api/admin/live-scores");
    if (resultsTarget) renderAdminResults(scores);
    if (totalTarget) totalTarget.textContent = String(scores.votesCast);
  } catch (error) {
    if (error.status === 401) renderAdminLogin();
  } finally {
    adminScoreRefreshing = false;
  }
}

function startAdminScoreUpdates() {
  adminScoreTimer = setInterval(refreshAdminScores, 3_000);
}

async function resetAllVotes(button) {
  if (!window.confirm("Reset all votes? This permanently removes every active vote. The audit log will stay available.")) return;
  setBusy(button, true, "Resetting…");
  try {
    const result = await api("/api/admin/votes", { method: "DELETE" });
    showToast(`${result.removedCount} vote${result.removedCount === 1 ? "" : "s"} reset.`);
    await renderAdmin();
  } catch (error) {
    showToast(error.message, true);
    setBusy(button, false);
  }
}

function formatBangkokTime(value, includeSeconds = false) {
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit", year: "numeric" } : {})
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

function projectVotersLink(submissionId, label, className = "vote-project-link") {
  const link = element("a", className, label);
  link.href = `/admin/votes?${new URLSearchParams({ project: submissionId })}`;
  link.dataset.nav = "";
  return link;
}

function renderVoteAuditEntry(entry) {
  const labels = {
    selected: "Vote selected", switched: "Vote switched", reassigned: "Email changed",
    removed: "Vote removed", reset: "Votes reset", submission_removed: "Project removed",
    imported: "Existing vote"
  };
  const item = element("li", `vote-audit-entry vote-audit-${entry.action}`);
  const head = element("div", "vote-audit-entry-head");
  const meta = element("div", "vote-audit-entry-meta");
  const time = element("time", "", formatBangkokTime(entry.occurredAt, true));
  time.dateTime = `${entry.occurredAt.replace(" ", "T")}Z`;
  meta.append(element("span", "vote-audit-action", labels[entry.action] || "Vote updated"), time);
  head.append(meta, element("strong", "vote-audit-voter", entry.voterEmail || "Email not recorded"));
  item.append(head);

  function projectField(label, id, title, tone) {
    const field = element("dl", `vote-audit-project-field ${tone}`);
    const term = element("dt", "", label);
    const value = element("dd");
    value.append(projectVotersLink(id, title));
    field.append(term, value);
    return field;
  }

  const change = element("div", "vote-audit-change");
  if (entry.action === "switched") {
    change.classList.add("vote-audit-transfer");
    const arrow = element("span", "vote-audit-arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    change.append(
      projectField("From", entry.previousSubmissionId, entry.previousProjectTitle, "vote-audit-from"),
      arrow,
      projectField("To", entry.submissionId, entry.projectTitle, "vote-audit-to")
    );
  } else if (["removed", "reset", "submission_removed"].includes(entry.action)) {
    change.append(projectField("Removed vote for", entry.previousSubmissionId, entry.previousProjectTitle, "vote-audit-from"));
  } else {
    change.append(projectField("Selected project", entry.submissionId, entry.projectTitle, "vote-audit-to"));
  }
  item.append(change);

  if (["reassigned", "switched"].includes(entry.action) && entry.previousVoterEmail !== entry.voterEmail) {
    const note = element("p", "vote-audit-note", "Previous email for this browser vote: ");
    note.append(element("strong", "", entry.previousVoterEmail || "Email not recorded"));
    item.append(note);
  }
  const notes = {
    removed: "Removed by admin. This vote no longer counts.",
    reset: "Removed by admin when all votes were reset.",
    submission_removed: "Removed by admin with the project.",
    imported: "Selection recorded when audit logging started. Earlier changes are unavailable."
  };
  if (notes[entry.action]) item.append(element("p", "vote-audit-note", notes[entry.action]));
  return item;
}

async function renderAdminVoteAudit() {
  stopAdminScoreUpdates();
  const pageParams = new URLSearchParams(window.location.search);
  const selectedProjectId = pageParams.get("project") || "";
  const shell = element("div", "admin-shell");
  const main = element("main", "admin-page vote-audit-page");
  main.id = "main";
  main.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Organizer · Vote records</p><h1>${selectedProjectId ? "Project voters" : "Voter audit"}</h1>
        <p>${selectedProjectId ? "Review this project’s current voters and vote history." : "See which project each email selected and review vote changes."}</p></div>
      <a class="button button-secondary button-small" href="/admin" data-nav>Back to Event Control</a>
    </div>
    <section class="admin-panel project-voters-summary" id="project-voters-summary" aria-label="Selected project" hidden></section>
    <section class="admin-panel">
      <form class="vote-audit-search" id="vote-audit-search">
        <label class="field"><span>Project</span>
          <select name="project" id="vote-audit-project-filter" disabled><option value="">All projects</option></select>
        </label>
        <label class="field"><span>Search by email</span>
          <input name="email" type="search" maxlength="254" placeholder="Email or part of an email" autocomplete="off" />
        </label>
        <div class="toolbar-actions">
          <button class="button button-primary button-small" type="submit">Search</button>
          <button class="button button-secondary button-small" id="vote-audit-clear" type="button">Clear</button>
          <button class="button button-secondary button-small" id="vote-audit-refresh" type="button">Refresh</button>
        </div>
      </form>
      <p class="vote-audit-status" id="vote-audit-status" role="status">Loading vote records…</p>
      <p class="form-message" id="vote-audit-error" role="alert" hidden></p>
    </section>
    <section class="admin-panel" aria-labelledby="current-votes-title">
      <div class="admin-section-head"><div><h2 id="current-votes-title">${selectedProjectId ? "Current voters" : "Current votes"}</h2>
        <p>${selectedProjectId ? "Only voters who currently choose this project are listed here." : "Each row is one active vote. Select a project name to view its voters."} Removing a vote keeps its history.</p></div></div>
      <div id="current-votes"></div>
    </section>
    <section class="admin-panel" aria-labelledby="vote-history-title">
      <div class="admin-section-head"><div><h2 id="vote-history-title">Audit log</h2>
        <p>${selectedProjectId ? "Includes selections, switches to or from this project, and removals. " : ""}Newest first · Bangkok time (UTC+7). Select a project name to view its voters.</p></div></div>
      <ol class="vote-audit-log" id="vote-audit-log"></ol>
      <button class="button button-secondary button-small" id="vote-audit-more" type="button" hidden>Load older records</button>
    </section>`;
  shell.append(adminHeader(), main);
  app.replaceChildren(shell);
  document.title = selectedProjectId ? "Project voters · Organizer" : "Voter audit · Organizer";
  main.parentElement.querySelector("#admin-logout").addEventListener("click", handleAdminLogout);
  const form = main.querySelector("#vote-audit-search");
  const status = main.querySelector("#vote-audit-status");
  const errorTarget = main.querySelector("#vote-audit-error");
  const currentVotes = main.querySelector("#current-votes");
  const history = main.querySelector("#vote-audit-log");
  const more = main.querySelector("#vote-audit-more");
  const projectSelect = form.elements.project;
  const projectSummary = main.querySelector("#project-voters-summary");
  let filter = pageParams.get("email") || "";
  form.elements.email.value = filter;
  let nextBefore = null;
  let loading = false;

  function renderProjectScope(data) {
    projectSelect.replaceChildren(element("option", "", "All projects"));
    projectSelect.firstElementChild.value = "";
    const choices = [...data.projects];
    if (data.project?.status === "removed") choices.push(data.project);
    for (const project of choices) {
      const option = element("option", "", `${project.title} · ${project.voteCount} vote${project.voteCount === 1 ? "" : "s"}${project.status === "removed" ? " · removed" : ""}`);
      option.value = project.id;
      projectSelect.append(option);
    }
    projectSelect.value = selectedProjectId;
    projectSelect.disabled = false;
    projectSummary.hidden = !data.project;
    if (!data.project) return;
    projectSummary.replaceChildren();
    const copy = element("div", "project-voters-copy");
    copy.append(element("p", "eyebrow", "Selected project"), element("h2", "", data.project.title));
    const detail = data.project.status === "removed"
      ? "Project removed. Audit history is still available."
      : `By ${data.project.publisherName} · ${data.project.status}`;
    copy.append(element("p", "modal-copy", detail));
    const count = element("div", "project-voters-count");
    count.append(element("strong", "", String(data.project.voteCount)), element("span", "", "Current votes"));
    const back = element("a", "button button-secondary button-small", "All projects and voters");
    back.href = "/admin/votes";
    back.dataset.nav = "";
    projectSummary.append(copy, count, back);
    document.title = `${data.project.title} · Project voters`;
  }

  function updateFilterUrl() {
    const params = new URLSearchParams();
    if (selectedProjectId) params.set("project", selectedProjectId);
    if (filter) params.set("email", filter);
    window.history.replaceState({}, "", `/admin/votes${params.size ? `?${params}` : ""}`);
  }

  function showError(error) {
    if (!main.isConnected) return;
    if (error.status === 401) {
      renderAdminLogin();
      return;
    }
    errorTarget.textContent = error.message;
    errorTarget.hidden = false;
  }

  function renderVotes(votes) {
    currentVotes.replaceChildren();
    if (!votes.length) {
      currentVotes.append(element("p", "modal-copy", filter ? "No current voters match this email search." : selectedProjectId ? "This project has no current voters." : "No active votes."));
      return;
    }
    const table = element("table", "vote-audit-table");
    table.innerHTML = `<thead><tr><th scope="col">Voter email</th><th scope="col">Selected project</th><th scope="col">Action</th></tr></thead>`;
    const tbody = element("tbody");
    for (const vote of votes) {
      const row = element("tr");
      const email = element("td", "vote-audit-email");
      email.append(element("strong", "", vote.voterEmail || "Email not recorded"));
      email.dataset.label = "Voter email";
      const project = element("td", "vote-audit-project");
      project.dataset.label = "Selected project";
      project.append(projectVotersLink(vote.submissionId, vote.projectTitle));
      if (vote.projectStatus !== "accepted") project.append(element("small", "", `Project status: ${vote.projectStatus}`));
      const actions = element("td");
      actions.dataset.label = "Action";
      const button = element("button", "button button-danger button-small", "Remove vote");
      button.type = "button";
      button.disabled = !vote.voterEmail;
      button.setAttribute("aria-label", `Remove vote for ${vote.voterEmail || "email not recorded"}`);
      if (!vote.voterEmail) button.title = "This legacy vote has no email and cannot be removed by email.";
      button.addEventListener("click", async () => {
        if (loading || !window.confirm(`Remove the vote from ${vote.voterEmail} for “${vote.projectTitle}”? The audit log will keep this removal. The voter can vote again while voting is open.`)) return;
        loading = true;
        setBusy(button, true, "Removing…");
        try {
          await api("/api/admin/votes/by-email", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ voterEmail: vote.voterEmail, voteId: vote.id, submissionId: vote.submissionId })
          });
          if (main.isConnected) showToast(`Vote removed for ${vote.voterEmail}.`);
          loading = false;
          await loadRecords();
        } catch (error) {
          loading = false;
          setBusy(button, false);
          if (error.status === 409) await loadRecords();
          showError(error);
        }
      });
      actions.append(button);
      row.append(email, project, actions);
      tbody.append(row);
    }
    table.append(tbody);
    currentVotes.append(table);
  }

  async function loadRecords(append = false) {
    if (loading || !main.isConnected) return;
    loading = true;
    errorTarget.hidden = true;
    const buttons = [...form.querySelectorAll("button"), more];
    buttons.forEach((button) => { button.disabled = true; });
    const params = new URLSearchParams({ email: filter });
    if (selectedProjectId) params.set("submissionId", selectedProjectId);
    if (append && nextBefore !== null) params.set("before", String(nextBefore));
    try {
      const data = await api(`/api/admin/votes?${params}`);
      if (!main.isConnected) return;
      renderProjectScope(data);
      renderVotes(data.votes);
      if (!append) history.replaceChildren();
      for (const entry of data.history) history.append(renderVoteAuditEntry(entry));
      if (!history.children.length) history.append(element("li", "modal-copy", filter ? "No audit records match this email search." : selectedProjectId ? "No vote history for this project yet." : "No vote history yet."));
      nextBefore = data.nextBefore;
      more.hidden = nextBefore === null;
      status.textContent = `${data.votes.length} active vote${data.votes.length === 1 ? "" : "s"}${filter ? " matching this email search" : ""}. Select Refresh to get the latest records.`;
    } catch (error) {
      status.textContent = "Could not load vote records. Select Refresh to try again.";
      showError(error);
    } finally {
      loading = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (loading) return;
    filter = form.elements.email.value.trim();
    updateFilterUrl();
    loadRecords();
  });
  main.querySelector("#vote-audit-clear").addEventListener("click", () => {
    if (loading) return;
    form.elements.email.value = "";
    filter = "";
    updateFilterUrl();
    loadRecords();
  });
  projectSelect.addEventListener("change", () => {
    const params = new URLSearchParams();
    if (projectSelect.value) params.set("project", projectSelect.value);
    if (filter) params.set("email", filter);
    window.history.pushState({}, "", `/admin/votes${params.size ? `?${params}` : ""}`);
    renderRoute();
  });
  main.querySelector("#vote-audit-refresh").addEventListener("click", () => loadRecords());
  more.addEventListener("click", () => loadRecords(true));
  await loadRecords();
}

async function renderAdminManual() {
  stopAdminScoreUpdates();
  try {
    const session = await api("/api/admin/session");
    if (!session.authenticated) {
      renderAdminLogin();
      return;
    }
    const shell = element("div", "admin-shell");
    const main = element("main", "admin-page manual-page");
    main.id = "main";
    main.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">Organizer help</p>
          <h1>Admin manual</h1>
          <p>Use this guide to prepare and operate the event.</p>
        </div>
        <a class="button button-secondary button-small" href="/admin" data-nav>Back to Event Control</a>
      </div>
      <div class="manual-grid">
        <section class="manual-card">
          <p class="eyebrow">1 · Access</p>
          <h2>Prepare the email whitelist</h2>
          <ol>
            <li>Use <strong>Whitelist validation</strong> to enable or disable access checks.</li>
            <li>Add or remove one email with the single-email controls.</li>
            <li>Use <strong>Bulk edit</strong> to replace the complete whitelist.</li>
            <li>Separate bulk emails with spaces, commas, semicolons, or new lines.</li>
            <li>Check the list before you enable validation.</li>
          </ol>
          <p class="manual-note">When validation is disabled, the list stays saved and editable. Any valid email can submit and vote.</p>
        </section>
        <section class="manual-card">
          <p class="eyebrow">2 · Submissions</p>
          <h2>Review submitted projects</h2>
          <ol>
            <li>Open submissions while participants build.</li>
            <li>Select <strong>Accept</strong> to add a project to the public gallery.</li>
            <li>Select <strong>Reject</strong> to keep a project out of the gallery.</li>
            <li>Select <strong>Edit</strong> to correct project information.</li>
            <li>Select <strong>Remove</strong> only when you must delete the submission.</li>
          </ol>
          <p class="manual-note warning-note">Removing a submission also removes its screenshot and votes.</p>
        </section>
        <section class="manual-card">
          <p class="eyebrow">3 · Voting</p>
          <h2>Operate audience voting</h2>
          <ol>
            <li>Select <strong>Open voting</strong>. This action closes submissions.</li>
            <li>Use <strong>Total-vote-only view</strong> to show one large live total.</li>
            <li>Use <strong>Admin scoreboard</strong> to monitor detailed project scores.</li>
            <li>Select <strong>Close voting</strong> when voting is complete.</li>
          </ol>
          <p class="manual-note">Both admin vote views refresh every three seconds.</p>
        </section>
        <section class="manual-card">
          <p class="eyebrow">4 · Results</p>
          <h2>Publish the final ranking</h2>
          <ol>
            <li>Close voting before you publish results.</li>
            <li>Check the Admin scoreboard.</li>
            <li>Select <strong>Publish results</strong>.</li>
            <li>Confirm that the public Results tab shows the final ranking.</li>
          </ol>
        </section>
        <section class="manual-card">
          <p class="eyebrow">Caution</p>
          <h2>Review and remove a voter’s vote</h2>
          <p>Open <strong>Voter audit</strong> from Event Control. Search by email to see the current project and audit log. Select <strong>Remove vote</strong> for the email, then confirm. The voter can vote again while voting is open.</p>
          <p>Select a project name or use the <strong>Project</strong> selector to view its current voters. You can also select <strong>View voters</strong> on the Admin scoreboard or a submission card. The project audit log includes votes switched away or removed.</p>
          <p class="manual-note">Vote selections, switches, and admin removals stay in the audit log. Earlier changes cannot be recovered for imported votes. Emails are supplied by voters; the service does not verify email ownership.</p>
        </section>
        <section class="manual-card">
          <p class="eyebrow">Caution</p>
          <h2>Reset all votes</h2>
          <p>Select <strong>Reset all votes</strong> only when you must restart voting. The action permanently removes every active vote after confirmation. The audit log stays available.</p>
        </section>
      </div>`;
    shell.append(adminHeader(), main);
    app.replaceChildren(shell);
    document.title = "Admin manual · Organizer";
    document.querySelector("#admin-logout").addEventListener("click", handleAdminLogout);
  } catch (error) {
    if (error.status === 401) renderAdminLogin();
    else renderAdminLogin(error.message);
  }
}

async function renderAdminLive() {
  stopAdminScoreUpdates();
  try {
    const session = await api("/api/admin/session");
    if (!session.authenticated) {
      renderAdminLogin();
      return;
    }
    const scores = await api("/api/admin/live-scores");
    const shell = element("div", "admin-shell standalone-admin-shell");
    const main = element("main", "standalone-admin-page");
    main.id = "main";
    main.innerHTML = `
      <div class="standalone-admin-top">
        <a class="brand" href="/admin" data-nav>
          <img src="/icon.svg" alt="" width="38" height="38" />
          <span><strong>DevDay Exchange Community: Bangkok</strong></span>
        </a>
        <div class="toolbar-actions">
          <a class="button button-secondary button-small" href="/admin/total-vote-only-view" data-nav>Total-vote-only view</a>
          <a class="button button-secondary button-small" href="/admin" data-nav>Back to admin</a>
        </div>
      </div>
      <section class="standalone-score-card">
        <p class="eyebrow">Admin scoreboard</p>
        <h1>Live score</h1>
        <p id="live-score-status">Updates every 3 seconds.</p>
        <div class="results-list" id="admin-results" aria-live="polite"></div>
      </section>`;
    shell.append(main);
    app.replaceChildren(shell);
    document.title = "Live score · Organizer";
    renderAdminResults(scores);
    startAdminScoreUpdates();
  } catch (error) {
    renderAdminLogin(error.message);
  }
}

async function renderAdminTotalVotes() {
  stopAdminScoreUpdates();
  try {
    const session = await api("/api/admin/session");
    if (!session.authenticated) {
      renderAdminLogin();
      return;
    }
    const scores = await api("/api/admin/live-scores");
    const shell = element("div", "admin-shell total-vote-only-shell");
    const main = element("main", "total-vote-only-page");
    main.id = "main";
    main.innerHTML = `
      <div class="total-vote-only-top">
        <a class="button button-secondary button-small" href="/admin" data-nav>Back to admin</a>
      </div>
      <section class="total-vote-only-display" aria-live="polite">
        <span class="total-vote-only-label">Total votes</span>
        <strong id="total-vote-only-count">${scores.votesCast}</strong>
      </section>`;
    shell.append(main);
    app.replaceChildren(shell);
    document.title = "Total votes · Organizer";
    startAdminScoreUpdates();
  } catch (error) {
    renderAdminLogin(error.message);
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
      email: submission.email,
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
  document.querySelector("#edit-email").value = submission.email || "";
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
        email: document.querySelector("#edit-email").value,
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
  if (gameModal.open && routePath() !== gameRoute) await closeGame();
  stopPublicVoteUpdates();
  const path = routePath();
  document.documentElement.toggleAttribute("data-public", !path.startsWith("/admin"));
  document.querySelectorAll("dialog[open]").forEach(dialog => {
    if (dialog !== gameModal) dialog.close();
  });
  if (screenshotPreviewUrl) {
    URL.revokeObjectURL(screenshotPreviewUrl);
    screenshotPreviewUrl = null;
  }
  if (path === "/admin") await renderAdmin();
  else if (path === "/admin/votes") await renderAdminVoteAudit();
  else if (path === "/admin/manual") await renderAdminManual();
  else if (path === "/admin/live") await renderAdminLive();
  else if (path === "/admin/total-vote-only-view") await renderAdminTotalVotes();
  else {
    stopAdminScoreUpdates();
    await renderPublic(path);
  }
  const main = document.querySelector("#main");
  if (main && !gameModal.open) {
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  }
  if (!gameModal.open) window.scrollTo({ top: 0, behavior: "instant" });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-nav]");
  if (!link || link.origin !== window.location.origin || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState({}, "", link.href);
  renderRoute();
});

// In-page anchors must not fire popstate, which re-renders the route and jumps to top.
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.hasAttribute("data-nav") || link.classList.contains("skip-link")) return;
  const target = document.getElementById(link.getAttribute("href").slice(1));
  if (!target) return;
  event.preventDefault();
  history.replaceState({}, "", link.getAttribute("href"));
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
});

document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  const main = document.querySelector("#main");
  if (!main) return;
  history.pushState({}, "", "#main");
  main.tabIndex = -1;
  main.focus();
  main.scrollIntoView({ block: "start" });
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`)?.close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      if (dialog === gameModal) closeGame();
      else dialog.close();
    }
  });
});

document.querySelector("#copy-prompt").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector("#prompt-content").textContent);
    showToast("Prompt copied.");
  } catch {
    showToast("Copy unavailable. Select the prompt text and copy it manually.", true);
  }
});

document.querySelector("#vote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const errorTarget = getVoteErrorTarget(form);
  errorTarget.replaceChildren();
  const voteBody = (replaceExisting = false) => JSON.stringify({
    voterEmail: document.querySelector("#vote-voter-email").value,
    submissionId: document.querySelector("#vote-project-id").value,
    replaceExisting
  });
  setBusy(button, true, "Recording…");
  try {
    const result = await api("/api/votes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: voteBody()
    });
    voteModal.close();
    showToast(result.message);
    if (gameModal.open) document.querySelector("#game-status").textContent = result.message;
    await refreshPublicVoteTotal();
  } catch (error) {
    if (error.code === "VOTE_ALREADY_EXISTS") {
      const confirmed = window.confirm(
        "You have already voted. Do you want to change your vote to this project?"
      );
      if (confirmed) {
        button.textContent = "Changing…";
        try {
          const result = await api("/api/votes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: voteBody(true)
          });
          voteModal.close();
          showToast(result.message);
          if (gameModal.open) document.querySelector("#game-status").textContent = result.message;
        } catch (changeError) {
          showVoteError(errorTarget, changeError.message);
        }
      }
    } else {
      showVoteError(errorTarget, error.message);
    }
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#edit-form").addEventListener("submit", handleEditSubmission);
window.addEventListener("popstate", renderRoute);
renderRoute();
