export interface Env {
  DB: D1Database;
  SCREENSHOTS: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}

type SettingRow = { key: string; value: string };
type CountRow = { count: number };
type ProjectRow = {
  id: string;
  publisher_name: string;
  title: string;
  description: string;
  original_prompt: string;
  project_url: string;
  screenshot_key: string;
  submitted_at: string;
  vote_count: number;
};
type AdminSubmissionRow = ProjectRow & {
  screenshot_content_type: string;
  status: "pending" | "accepted" | "rejected";
  updated_at: string;
};

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const SCREENSHOT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string): string {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function passwordMatches(candidate: string, expected: string): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected))
  ]);
  return constantTimeEqual(
    bytesToBase64Url(new Uint8Array(candidateHash)),
    bytesToBase64Url(new Uint8Array(expectedHash))
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createAdminToken(secret: string): Promise<string> {
  const payload = textToBase64Url(
    JSON.stringify({ expiresAt: Date.now() + 12 * 60 * 60 * 1000, nonce: crypto.randomUUID() })
  );
  return `${payload}.${await hmac(payload, secret)}`;
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const token = cookieValue(request, "event_admin");
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  if (!constantTimeEqual(signature, await hmac(payload, env.SESSION_SECRET))) return false;

  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as { expiresAt?: unknown };
    return typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

async function publicState(env: Env): Promise<Response> {
  const [settingsResult, acceptedResult] = await env.DB.batch([
    env.DB.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('submissions_open', 'voting_open', 'results_published')"
    ),
    env.DB.prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'accepted'")
  ]);

  const settings = Object.fromEntries(
    (settingsResult.results as SettingRow[]).map((row) => [row.key, row.value])
  );
  const acceptedCount = Number((acceptedResult.results[0] as CountRow | undefined)?.count ?? 0);

  return json({
    submissionsOpen: settings.submissions_open === "1",
    votingOpen: settings.voting_open === "1",
    resultsPublished: settings.results_published === "1",
    acceptedCount
  });
}

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function hasValidImageSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

async function createSubmission(request: Request, env: Env): Promise<Response> {
  const open = await env.DB.prepare(
    "SELECT value FROM app_settings WHERE key = 'submissions_open'"
  ).first<string>("value");
  if (open !== "1") {
    return json({ error: "Submissions are closed." }, { status: 409 });
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return json({ error: "Use the project submission form." }, { status: 415 });
  }

  const form = await request.formData();
  if (formText(form, "website")) {
    return json({ error: "Submission could not be accepted." }, { status: 400 });
  }

  const publisherName = formText(form, "publisherName");
  const title = formText(form, "title");
  const description = formText(form, "description");
  const originalPrompt = formText(form, "originalPrompt");
  const projectUrl = formText(form, "projectUrl");
  const confirmed = formText(form, "confirmed");
  const screenshot = form.get("screenshot");

  if (publisherName.length < 2 || publisherName.length > 100) {
    return json({ error: "Participant or team name must be 2–100 characters." }, { status: 400 });
  }
  if (title.length < 2 || title.length > 120) {
    return json({ error: "Project title must be 2–120 characters." }, { status: 400 });
  }
  if (description.length < 5 || description.length > 200) {
    return json({ error: "Description must be 5–200 characters." }, { status: 400 });
  }
  if (originalPrompt.length < 20 || originalPrompt.length > 20_000) {
    return json({ error: "Complete prompt must be 20–20,000 characters." }, { status: 400 });
  }
  if (!validPublicUrl(projectUrl) || projectUrl.length > 2_000) {
    return json({ error: "Enter a valid public project URL." }, { status: 400 });
  }
  if (confirmed !== "true") {
    return json({ error: "Confirm the challenge rules before submitting." }, { status: 400 });
  }
  if (!(screenshot instanceof File)) {
    return json({ error: "Upload a project screenshot." }, { status: 400 });
  }

  const extension = SCREENSHOT_TYPES.get(screenshot.type);
  if (!extension || screenshot.size === 0 || screenshot.size > MAX_SCREENSHOT_BYTES) {
    return json({ error: "Screenshot must be a JPG, PNG, or WebP under 8 MB." }, { status: 400 });
  }

  const screenshotBytes = new Uint8Array(await screenshot.arrayBuffer());
  if (!hasValidImageSignature(screenshotBytes, screenshot.type)) {
    return json({ error: "Screenshot file does not match its image type." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const screenshotKey = `submissions/${id}.${extension}`;
  await env.SCREENSHOTS.put(screenshotKey, screenshotBytes, {
    httpMetadata: {
      contentType: screenshot.type,
      cacheControl: "public, max-age=31536000, immutable"
    },
    customMetadata: { submissionId: id }
  });

  try {
    await env.DB.prepare(
      `INSERT INTO submissions
        (id, publisher_name, title, description, original_prompt, project_url, screenshot_key, screenshot_content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        publisherName,
        title,
        description,
        originalPrompt,
        projectUrl,
        screenshotKey,
        screenshot.type
      )
      .run();
  } catch (error) {
    await env.SCREENSHOTS.delete(screenshotKey);
    throw error;
  }

  return json(
    { id, message: "Project submitted for organizer review." },
    { status: 201 }
  );
}

async function adminLogin(request: Request, env: Env): Promise<Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the admin login form." }, { status: 415 });
  }
  const body = (await request.json()) as { password?: unknown };
  if (typeof body.password !== "string" || !(await passwordMatches(body.password, env.ADMIN_PASSWORD))) {
    return json({ error: "Incorrect admin passphrase." }, { status: 401 });
  }

  const headers = new Headers();
  headers.set(
    "set-cookie",
    `event_admin=${await createAdminToken(env.SESSION_SECRET)}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`
  );
  return json({ authenticated: true }, { headers });
}

function validModerationStatus(value: unknown): value is "pending" | "accepted" | "rejected" {
  return value === "pending" || value === "accepted" || value === "rejected";
}

async function moderateSubmission(
  request: Request,
  env: Env,
  submissionId: string
): Promise<Response> {
  if (!(await isAdmin(request, env))) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the moderation form." }, { status: 415 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const publisherName = typeof body.publisherName === "string" ? body.publisherName.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const projectUrl = typeof body.projectUrl === "string" ? body.projectUrl.trim() : "";

  if (publisherName.length < 2 || publisherName.length > 100) {
    return json({ error: "Participant or team name must be 2–100 characters." }, { status: 400 });
  }
  if (title.length < 2 || title.length > 120) {
    return json({ error: "Project title must be 2–120 characters." }, { status: 400 });
  }
  if (description.length < 5 || description.length > 200) {
    return json({ error: "Description must be 5–200 characters." }, { status: 400 });
  }
  if (!validPublicUrl(projectUrl) || projectUrl.length > 2_000) {
    return json({ error: "Enter a valid public project URL." }, { status: 400 });
  }
  if (!validModerationStatus(body.status)) {
    return json({ error: "Choose pending, accepted, or rejected." }, { status: 400 });
  }

  const result = await env.DB.prepare(
    `UPDATE submissions
       SET publisher_name = ?, title = ?, description = ?, project_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(publisherName, title, description, projectUrl, body.status, submissionId)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return json({ error: "Submission not found." }, { status: 404 });
  }
  return json({ saved: true, status: body.status });
}

async function publicProjects(env: Env): Promise<Response> {
  const [projectsResult, publishedResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT s.id, s.publisher_name, s.title, s.description, s.original_prompt,
              s.project_url, s.screenshot_key, s.submitted_at, COUNT(v.id) AS vote_count
         FROM submissions s
         LEFT JOIN attendee_votes v ON v.submission_id = s.id
        WHERE s.status = 'accepted'
        GROUP BY s.id, s.publisher_name, s.title, s.description, s.original_prompt,
                 s.project_url, s.screenshot_key, s.submitted_at`
    ),
    env.DB.prepare("SELECT value FROM app_settings WHERE key = 'results_published'")
  ]);

  const results = projectsResult.results as ProjectRow[];
  const resultsPublished = (publishedResult.results[0] as { value?: string } | undefined)?.value === "1";
  results.sort((left, right) => {
    if (resultsPublished && Number(right.vote_count) !== Number(left.vote_count)) {
      return Number(right.vote_count) - Number(left.vote_count);
    }
    return left.submitted_at.localeCompare(right.submitted_at) || left.id.localeCompare(right.id);
  });

  let previousVotes: number | null = null;
  let currentRank = 0;

  return json({
    projects: results.map((project, index) => {
      const voteCount = Number(project.vote_count);
      if (resultsPublished && voteCount !== previousVotes) currentRank = index + 1;
      previousVotes = voteCount;
      return {
        id: project.id,
        publisherName: project.publisher_name,
        title: project.title,
        description: project.description,
        originalPrompt: project.original_prompt,
        projectUrl: project.project_url,
        screenshotUrl: `/media/${project.screenshot_key}`,
        submittedAt: project.submitted_at,
        ...(resultsPublished ? { voteCount, rank: currentRank } : {})
      };
    })
  });
}

async function updateEventState(request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(request, env))) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the event controls." }, { status: 415 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  for (const key of ["submissionsOpen", "votingOpen", "resultsPublished"]) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      return json({ error: "Event controls must be true or false." }, { status: 400 });
    }
  }

  const [settingsResult, acceptedResult] = await env.DB.batch([
    env.DB.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('submissions_open', 'voting_open', 'results_published')"
    ),
    env.DB.prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'accepted'")
  ]);
  const current = Object.fromEntries(
    (settingsResult.results as SettingRow[]).map((row) => [row.key, row.value === "1"])
  );
  let submissionsOpen = (body.submissionsOpen as boolean | undefined) ?? current.submissions_open;
  const votingOpen = (body.votingOpen as boolean | undefined) ?? current.voting_open;
  let resultsPublished = (body.resultsPublished as boolean | undefined) ?? current.results_published;

  if (votingOpen) {
    const acceptedCount = Number((acceptedResult.results[0] as CountRow | undefined)?.count ?? 0);
    if (acceptedCount === 0) {
      return json({ error: "Accept at least one project before opening voting." }, { status: 409 });
    }
    submissionsOpen = false;
    resultsPublished = false;
  }
  if (resultsPublished && votingOpen) {
    return json({ error: "Close voting before publishing results." }, { status: 409 });
  }

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'submissions_open'"
    ).bind(submissionsOpen ? "1" : "0"),
    env.DB.prepare(
      "UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'voting_open'"
    ).bind(votingOpen ? "1" : "0"),
    env.DB.prepare(
      "UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'results_published'"
    ).bind(resultsPublished ? "1" : "0")
  ]);

  return json({ submissionsOpen, votingOpen, resultsPublished });
}

async function castVote(request: Request, env: Env): Promise<Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the voting form." }, { status: 415 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const voterName = typeof body.voterName === "string"
    ? body.voterName.normalize("NFKC").trim().replace(/\s+/gu, " ")
    : "";
  const normalizedName = voterName.toLocaleLowerCase("en-US");
  const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
  if (voterName.length < 2 || voterName.length > 80) {
    return json({ error: "Enter your name or Codex handle." }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/u.test(submissionId)) {
    return json({ error: "Choose a valid project." }, { status: 400 });
  }

  const currentToken = cookieValue(request, "meetup_vote_device");
  const browserToken = currentToken && /^[0-9a-f]{64}$/u.test(currentToken)
    ? currentToken
    : Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const browserTokenHash = await sha256Hex(browserToken);

  const [stateResult, projectResult, nameResult, browserResult] = await env.DB.batch([
    env.DB.prepare("SELECT value FROM app_settings WHERE key = 'voting_open'"),
    env.DB.prepare("SELECT id FROM submissions WHERE id = ? AND status = 'accepted'").bind(submissionId),
    env.DB.prepare("SELECT id FROM attendee_votes WHERE voter_name_normalized = ?").bind(normalizedName),
    env.DB.prepare("SELECT id FROM attendee_votes WHERE browser_token_hash = ?").bind(browserTokenHash)
  ]);
  if ((stateResult.results[0] as { value?: string } | undefined)?.value !== "1") {
    return json({ error: "Voting is closed." }, { status: 409 });
  }
  if (projectResult.results.length === 0) {
    return json({ error: "This project is not available for voting." }, { status: 404 });
  }
  if (nameResult.results.length > 0 || browserResult.results.length > 0) {
    return json({ error: "You have already voted." }, { status: 409 });
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO attendee_votes
         (id, submission_id, voter_name, voter_name_normalized, browser_token_hash)
       SELECT ?, s.id, ?, ?, ?
         FROM submissions s
        WHERE s.id = ? AND s.status = 'accepted'
          AND EXISTS (
            SELECT 1 FROM app_settings setting
             WHERE setting.key = 'voting_open' AND setting.value = '1'
          )`
    )
      .bind(crypto.randomUUID(), voterName, normalizedName, browserTokenHash, submissionId)
      .run();
    if ((result.meta.changes ?? 0) !== 1) {
      return json({ error: "Vote could not be recorded." }, { status: 409 });
    }
  } catch {
    return json({ error: "You have already voted." }, { status: 409 });
  }

  const headers = new Headers();
  headers.set(
    "set-cookie",
    `meetup_vote_device=${browserToken}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Strict`
  );
  return json({ recorded: true, message: "Vote recorded." }, { status: 201, headers });
}

async function adminDashboard(request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(request, env))) {
    return json({ error: "Admin login required." }, { status: 401 });
  }

  const [settingsResult, submissionsResult, voteStatsResult, resultRows] = await env.DB.batch([
    env.DB.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('submissions_open', 'voting_open', 'results_published')"
    ),
    env.DB.prepare(
      `SELECT s.id, s.publisher_name, s.title, s.description, s.original_prompt, s.project_url,
              s.screenshot_key, s.screenshot_content_type, s.status, s.submitted_at, s.updated_at,
              COUNT(v.id) AS vote_count
         FROM submissions s
         LEFT JOIN attendee_votes v ON v.submission_id = s.id
        GROUP BY s.id, s.publisher_name, s.title, s.description, s.original_prompt, s.project_url,
                 s.screenshot_key, s.screenshot_content_type, s.status, s.submitted_at, s.updated_at
        ORDER BY s.submitted_at DESC, s.id DESC`
    ),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM attendee_votes"
    ),
    env.DB.prepare(
      `SELECT s.id, s.title, s.publisher_name, COUNT(v.id) AS vote_count
         FROM submissions s
         LEFT JOIN attendee_votes v ON v.submission_id = s.id
        WHERE s.status = 'accepted'
        GROUP BY s.id, s.title, s.publisher_name
        ORDER BY vote_count DESC, s.submitted_at ASC, s.id ASC`
    )
  ]);
  const settings = Object.fromEntries(
    (settingsResult.results as SettingRow[]).map((row) => [row.key, row.value === "1"])
  );
  const submissions = submissionsResult.results as AdminSubmissionRow[];
  const voteStats = (voteStatsResult.results[0] ?? {}) as { count?: number };
  const counts = { pending: 0, accepted: 0, rejected: 0 };
  for (const submission of submissions) counts[submission.status] += 1;

  const rankedResults = (resultRows.results as Array<{
    id: string;
    title: string;
    publisher_name: string;
    vote_count: number;
  }>).map((result, index, all) => {
    const voteCount = Number(result.vote_count);
    const earlierDifferent = all.findIndex((entry) => Number(entry.vote_count) === voteCount);
    return {
      id: result.id,
      title: result.title,
      publisherName: result.publisher_name,
      voteCount,
      rank: earlierDifferent + 1 || index + 1
    };
  });

  return json({
    state: {
      submissionsOpen: settings.submissions_open,
      votingOpen: settings.voting_open,
      resultsPublished: settings.results_published
    },
    stats: {
      total: submissions.length,
      ...counts,
      votesCast: Number(voteStats.count ?? 0)
    },
    submissions: submissions.map((submission) => ({
      id: submission.id,
      publisherName: submission.publisher_name,
      title: submission.title,
      description: submission.description,
      originalPrompt: submission.original_prompt,
      projectUrl: submission.project_url,
      screenshotUrl: `/media/${submission.screenshot_key}`,
      status: submission.status,
      submittedAt: submission.submitted_at,
      updatedAt: submission.updated_at
    })),
    resultsHidden: settings.voting_open,
    results: settings.voting_open ? [] : rankedResults
  });
}

async function replaceScreenshot(
  request: Request,
  env: Env,
  submissionId: string
): Promise<Response> {
  if (!(await isAdmin(request, env))) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return json({ error: "Upload a replacement screenshot." }, { status: 415 });
  }
  const form = await request.formData();
  const screenshot = form.get("screenshot");
  if (!(screenshot instanceof File)) {
    return json({ error: "Upload a replacement screenshot." }, { status: 400 });
  }
  const extension = SCREENSHOT_TYPES.get(screenshot.type);
  if (!extension || screenshot.size === 0 || screenshot.size > MAX_SCREENSHOT_BYTES) {
    return json({ error: "Screenshot must be a JPG, PNG, or WebP under 8 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await screenshot.arrayBuffer());
  if (!hasValidImageSignature(bytes, screenshot.type)) {
    return json({ error: "Screenshot file does not match its image type." }, { status: 400 });
  }

  const existing = await env.DB.prepare(
    "SELECT screenshot_key FROM submissions WHERE id = ?"
  )
    .bind(submissionId)
    .first<{ screenshot_key: string }>();
  if (!existing) return json({ error: "Submission not found." }, { status: 404 });

  const screenshotKey = `submissions/${crypto.randomUUID()}.${extension}`;
  await env.SCREENSHOTS.put(screenshotKey, bytes, {
    httpMetadata: {
      contentType: screenshot.type,
      cacheControl: "public, max-age=31536000, immutable"
    },
    customMetadata: { submissionId }
  });
  try {
    await env.DB.prepare(
      `UPDATE submissions
          SET screenshot_key = ?, screenshot_content_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
      .bind(screenshotKey, screenshot.type, submissionId)
      .run();
  } catch (error) {
    await env.SCREENSHOTS.delete(screenshotKey);
    throw error;
  }
  await env.SCREENSHOTS.delete(existing.screenshot_key);
  return json({ saved: true, screenshotUrl: `/media/${screenshotKey}` });
}

function adminLogout(): Response {
  const headers = new Headers();
  headers.set(
    "set-cookie",
    "event_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
  );
  return json({ authenticated: false }, { headers });
}

async function adminSession(request: Request, env: Env): Promise<Response> {
  return json({ authenticated: await isAdmin(request, env) });
}

async function serveAsset(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (headers.get("content-type")?.includes("text/html")) {
    headers.set(
      "content-security-policy",
      "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    );
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function screenshotResponse(env: Env, key: string): Promise<Response> {
  if (!/^submissions\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/u.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.SCREENSHOTS.get(key);
  if (!object || !object.body) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/public/state") {
      return publicState(env);
    }
    if (request.method === "GET" && url.pathname === "/api/public/projects") {
      return publicProjects(env);
    }
    if (request.method === "POST" && url.pathname === "/api/submissions") {
      return createSubmission(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/votes") {
      return castVote(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/admin/login") {
      return adminLogin(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/admin/logout") {
      return adminLogout();
    }
    if (request.method === "GET" && url.pathname === "/api/admin/session") {
      return adminSession(request, env);
    }
    if (request.method === "GET" && url.pathname === "/api/admin/dashboard") {
      return adminDashboard(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/admin/state") {
      return updateEventState(request, env);
    }

    const moderationMatch = url.pathname.match(
      /^\/api\/admin\/submissions\/([0-9a-f-]{36})$/u
    );
    if (request.method === "PATCH" && moderationMatch) {
      return moderateSubmission(request, env, moderationMatch[1]);
    }

    const screenshotMatch = url.pathname.match(
      /^\/api\/admin\/submissions\/([0-9a-f-]{36})\/screenshot$/u
    );
    if (request.method === "POST" && screenshotMatch) {
      return replaceScreenshot(request, env, screenshotMatch[1]);
    }

    const mediaMatch = url.pathname.match(/^\/media\/(submissions\/[0-9a-f-]{36}\.(?:jpg|png|webp))$/u);
    if (request.method === "GET" && mediaMatch) {
      return screenshotResponse(env, mediaMatch[1]);
    }

    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) {
      return json({ error: "Not found." }, { status: 404 });
    }
    return serveAsset(request, env);
  }
} satisfies ExportedHandler<Env>;
