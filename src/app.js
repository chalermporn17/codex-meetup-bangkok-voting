import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./database.js";

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_PROMPT_CHARACTERS = 1_000_000;
const MAX_WHITELIST_EMAILS = 5_000;
const DUPLICATE_EMAIL_MESSAGE =
  "This email already has a submission. If you submitted by mistake or want to submit again, contact the staff.";
const SCREENSHOT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const SCREENSHOT_CONTENT_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
const STATIC_CONTENT_TYPES = new Map([
  [".ttf", "font/ttf"],
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"]
]);
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");
const defaultMigrationsDirectory = fileURLToPath(
  new URL("../migrations", import.meta.url)
);
const defaultPublicDirectory = fileURLToPath(new URL("../public", import.meta.url));

class RequestTooLargeError extends Error {}

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function hmac(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function passwordMatches(candidate, expected) {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createAdminToken(secret) {
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: Date.now() + 12 * 60 * 60 * 1000, nonce: randomUUID() })
  ).toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function sessionCookie(name, value, maxAge, cookieSecure) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict"
  ];
  if (cookieSecure) parts.push("Secure");
  return parts.join("; ");
}

function isAdmin(request, config) {
  const token = cookieValue(request, "event_admin");
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  if (!secureEqual(signature, hmac(payload, config.sessionSecret))) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function formText(form, key) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validPublicUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function normalizeEmail(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function validEmail(value) {
  return (
    value.length >= 3 &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
  );
}

function hasValidImageSignature(bytes, contentType) {
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
      Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
      Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
    );
  }
  return false;
}

function isUploadedFile(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number" &&
    typeof value.type === "string"
  );
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function publicState(database) {
  const settings = Object.fromEntries(
    database
      .prepare(
        `SELECT key, value FROM app_settings
          WHERE key IN (
            'submissions_open',
            'voting_open',
            'results_published',
            'email_whitelist_validation_enabled'
          )`
      )
      .all()
      .map((row) => [row.key, row.value])
  );
  const acceptedCount = Number(
    database
      .prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'accepted'")
      .get().count
  );
  const votesCast = Number(
    database.prepare("SELECT COUNT(*) AS count FROM attendee_votes").get().count
  );

  return json({
    submissionsOpen: settings.submissions_open === "1",
    votingOpen: settings.voting_open === "1",
    resultsPublished: settings.results_published === "1",
    emailWhitelistValidationEnabled:
      settings.email_whitelist_validation_enabled !== "0",
    acceptedCount,
    votesCast
  });
}

async function createSubmission(request, context) {
  const { database, submissionsDirectory } = context;
  const open = database
    .prepare("SELECT value FROM app_settings WHERE key = 'submissions_open'")
    .get()?.value;
  if (open !== "1") {
    return json({ error: "Submissions are closed." }, { status: 409 });
  }
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return json({ error: "Use the project submission form." }, { status: 415 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "The project submission form is invalid." }, { status: 400 });
  }
  if (formText(form, "website")) {
    return json({ error: "Submission could not be accepted." }, { status: 400 });
  }

  const publisherName = formText(form, "publisherName");
  const email = normalizeEmail(formText(form, "email"));
  const title = formText(form, "title");
  const description = formText(form, "description");
  const originalPrompt = formText(form, "originalPrompt");
  const projectUrl = formText(form, "projectUrl");
  const confirmed = formText(form, "confirmed");
  const screenshot = form.get("screenshot");

  if (publisherName.length < 2 || publisherName.length > 100) {
    return json({ error: "Participant or team name must be 2–100 characters." }, { status: 400 });
  }
  if (!validEmail(email)) {
    return json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (title.length < 2 || title.length > 120) {
    return json({ error: "Project title must be 2–120 characters." }, { status: 400 });
  }
  if (description.length < 5 || description.length > 200) {
    return json({ error: "Description must be 5–200 characters." }, { status: 400 });
  }
  if (originalPrompt.length < 20 || originalPrompt.length > MAX_PROMPT_CHARACTERS) {
    return json({ error: "Complete prompt must be 20–1,000,000 characters." }, { status: 400 });
  }
  if (!validPublicUrl(projectUrl) || projectUrl.length > 2_000) {
    return json({ error: "Enter a valid public project URL." }, { status: 400 });
  }
  if (confirmed !== "true") {
    return json({ error: "Confirm the challenge rules before submitting." }, { status: 400 });
  }
  if (!isUploadedFile(screenshot)) {
    return json({ error: "Upload a project screenshot." }, { status: 400 });
  }

  const extension = SCREENSHOT_TYPES.get(screenshot.type);
  if (!extension || screenshot.size === 0 || screenshot.size > MAX_SCREENSHOT_BYTES) {
    return json({ error: "Screenshot must be a JPG, PNG, or WebP under 8 MB." }, { status: 400 });
  }
  const duplicate = database.prepare("SELECT id FROM submissions WHERE email = ?").get(email);
  if (duplicate) {
    return json({ error: DUPLICATE_EMAIL_MESSAGE, code: "EMAIL_ALREADY_SUBMITTED" }, { status: 409 });
  }
  const whitelistValidationEnabled =
    database
      .prepare(
        "SELECT value FROM app_settings WHERE key = 'email_whitelist_validation_enabled'"
      )
      .get()?.value !== "0";
  const whitelisted = whitelistValidationEnabled
    ? database
        .prepare("SELECT email FROM submission_email_whitelist WHERE email = ?")
        .get(email)
    : true;
  if (!whitelisted) {
    return json(
      { error: "This email is not on the submission whitelist. Contact the staff for help." },
      { status: 403 }
    );
  }
  const screenshotBytes = new Uint8Array(await screenshot.arrayBuffer());
  if (!hasValidImageSignature(screenshotBytes, screenshot.type)) {
    return json({ error: "Screenshot file does not match its image type." }, { status: 400 });
  }

  const id = randomUUID();
  const fileName = `${id}.${extension}`;
  const screenshotKey = `submissions/${fileName}`;
  const screenshotPath = join(submissionsDirectory, fileName);
  await writeFile(screenshotPath, screenshotBytes, { flag: "wx", mode: 0o600 });

  try {
    const result = database
      .prepare(
        `INSERT INTO submissions
          (id, publisher_name, email, title, description, original_prompt, project_url, screenshot_key, screenshot_content_type)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE COALESCE(
            (
              SELECT value FROM app_settings
               WHERE key = 'email_whitelist_validation_enabled'
            ),
            '1'
          ) = '0'
             OR EXISTS (
               SELECT 1 FROM submission_email_whitelist WHERE email = ?
             )`
      )
      .run(
        id,
        publisherName,
        email,
        title,
        description,
        originalPrompt,
        projectUrl,
        screenshotKey,
        screenshot.type,
        email
      );
    if (Number(result.changes) !== 1) {
      await unlink(screenshotPath).catch(() => undefined);
      return json(
        { error: "This email is not on the submission whitelist. Contact the staff for help." },
        { status: 403 }
      );
    }
  } catch (error) {
    await unlink(screenshotPath).catch(() => undefined);
    const duplicateSubmission = database.prepare("SELECT id FROM submissions WHERE email = ?").get(email);
    if (duplicateSubmission) {
      return json({ error: DUPLICATE_EMAIL_MESSAGE, code: "EMAIL_ALREADY_SUBMITTED" }, { status: 409 });
    }
    throw error;
  }

  return json({ id, message: "Project submitted for organizer review." }, { status: 201 });
}

async function adminLogin(request, config) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the admin login form." }, { status: 415 });
  }
  const body = await readJson(request);
  if (
    !body ||
    typeof body.password !== "string" ||
    !passwordMatches(body.password, config.adminPassword)
  ) {
    return json({ error: "Incorrect admin passphrase." }, { status: 401 });
  }

  return json(
    { authenticated: true },
    {
      headers: {
        "set-cookie": sessionCookie(
          "event_admin",
          createAdminToken(config.sessionSecret),
          43_200,
          config.cookieSecure
        )
      }
    }
  );
}

function validModerationStatus(value) {
  return value === "pending" || value === "accepted" || value === "rejected";
}

async function moderateSubmission(request, context, submissionId) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the moderation form." }, { status: 415 });
  }
  const body = await readJson(request);
  if (!body || typeof body !== "object") {
    return json({ error: "The moderation form is invalid." }, { status: 400 });
  }

  const publisherName = typeof body.publisherName === "string" ? body.publisherName.trim() : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const projectUrl = typeof body.projectUrl === "string" ? body.projectUrl.trim() : "";
  if (publisherName.length < 2 || publisherName.length > 100) {
    return json({ error: "Participant or team name must be 2–100 characters." }, { status: 400 });
  }
  if (email !== null && email !== "" && !validEmail(email)) {
    return json({ error: "Enter a valid email address." }, { status: 400 });
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

  let result;
  try {
    result = database
      .prepare(
        `UPDATE submissions
           SET publisher_name = ?, email = COALESCE(?, email), title = ?, description = ?,
               project_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(publisherName, email || null, title, description, projectUrl, body.status, submissionId);
  } catch (error) {
    const duplicate = email
      ? database.prepare("SELECT id FROM submissions WHERE email = ? AND id != ?").get(email, submissionId)
      : null;
    if (duplicate) {
      return json({ error: DUPLICATE_EMAIL_MESSAGE, code: "EMAIL_ALREADY_SUBMITTED" }, { status: 409 });
    }
    throw error;
  }
  if (Number(result.changes) === 0) {
    return json({ error: "Submission not found." }, { status: 404 });
  }
  return json({ saved: true, status: body.status });
}

async function replaceEmailWhitelist(request, context) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the email whitelist form." }, { status: 415 });
  }
  const body = await readJson(request);
  if (
    !body ||
    !Array.isArray(body.emails) ||
    body.emails.length > MAX_WHITELIST_EMAILS ||
    body.emails.some((value) => typeof value !== "string")
  ) {
    return json({ error: `Enter no more than ${MAX_WHITELIST_EMAILS.toLocaleString("en-US")} emails.` }, { status: 400 });
  }

  const emails = [...new Set(body.emails.map((value) =>
    typeof value === "string" ? normalizeEmail(value) : ""
  ))].filter(Boolean).sort();
  if (emails.some((emailAddress) => !validEmail(emailAddress))) {
    return json({ error: "One or more email addresses are invalid." }, { status: 400 });
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM submission_email_whitelist").run();
    const insert = database.prepare("INSERT INTO submission_email_whitelist (email) VALUES (?)");
    for (const emailAddress of emails) insert.run(emailAddress);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return json({ saved: true, emails });
}

function publicProjects(database) {
  const projects = database
    .prepare(
      `SELECT s.id, s.publisher_name, s.title, s.description, s.original_prompt,
              s.project_url, s.screenshot_key, s.submitted_at, COUNT(v.id) AS vote_count
         FROM submissions s
         LEFT JOIN attendee_votes v ON v.submission_id = s.id
        WHERE s.status = 'accepted'
        GROUP BY s.id, s.publisher_name, s.title, s.description, s.original_prompt,
                 s.project_url, s.screenshot_key, s.submitted_at`
    )
    .all();
  const resultsPublished =
    database
      .prepare("SELECT value FROM app_settings WHERE key = 'results_published'")
      .get()?.value === "1";

  projects.sort((left, right) => {
    if (resultsPublished && Number(right.vote_count) !== Number(left.vote_count)) {
      return Number(right.vote_count) - Number(left.vote_count);
    }
    return left.submitted_at.localeCompare(right.submitted_at) || left.id.localeCompare(right.id);
  });

  let previousVotes = null;
  let currentRank = 0;
  return json({
    projects: projects.map((project, index) => {
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

async function updateEventState(request, context) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the event controls." }, { status: 415 });
  }
  const body = await readJson(request);
  if (!body || typeof body !== "object") {
    return json({ error: "The event controls are invalid." }, { status: 400 });
  }
  for (const key of [
    "submissionsOpen",
    "votingOpen",
    "resultsPublished",
    "emailWhitelistValidationEnabled"
  ]) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      return json({ error: "Event controls must be true or false." }, { status: 400 });
    }
  }

  const current = Object.fromEntries(
    database
      .prepare(
        `SELECT key, value FROM app_settings
          WHERE key IN (
            'submissions_open',
            'voting_open',
            'results_published',
            'email_whitelist_validation_enabled'
          )`
      )
      .all()
      .map((row) => [row.key, row.value === "1"])
  );
  let submissionsOpen = body.submissionsOpen ?? current.submissions_open;
  const votingOpen = body.votingOpen ?? current.voting_open;
  let resultsPublished = body.resultsPublished ?? current.results_published;
  const emailWhitelistValidationEnabled =
    body.emailWhitelistValidationEnabled ??
    current.email_whitelist_validation_enabled ??
    true;

  if (body.resultsPublished === true && votingOpen) {
    return json({ error: "Close voting before publishing results." }, { status: 409 });
  }

  if (votingOpen) {
    const acceptedCount = Number(
      database
        .prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'accepted'")
        .get().count
    );
    if (acceptedCount === 0) {
      return json({ error: "Accept at least one project before opening voting." }, { status: 409 });
    }
    submissionsOpen = false;
    resultsPublished = false;
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const update = database.prepare(
      "UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?"
    );
    update.run(submissionsOpen ? "1" : "0", "submissions_open");
    update.run(votingOpen ? "1" : "0", "voting_open");
    update.run(resultsPublished ? "1" : "0", "results_published");
    update.run(
      emailWhitelistValidationEnabled ? "1" : "0",
      "email_whitelist_validation_enabled"
    );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return json({
    submissionsOpen,
    votingOpen,
    resultsPublished,
    emailWhitelistValidationEnabled
  });
}

async function castVote(request, context) {
  const { config, database } = context;
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the voting form." }, { status: 415 });
  }
  const body = await readJson(request);
  if (!body || typeof body !== "object") {
    return json({ error: "The voting form is invalid." }, { status: 400 });
  }
  const voterEmail = typeof body.voterEmail === "string" ? normalizeEmail(body.voterEmail) : "";
  const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
  const replaceExisting = body.replaceExisting === true;
  if (!validEmail(voterEmail)) {
    return json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/u.test(submissionId)) {
    return json({ error: "Choose a valid project." }, { status: 400 });
  }
  if (body.replaceExisting !== undefined && typeof body.replaceExisting !== "boolean") {
    return json({ error: "The vote confirmation is invalid." }, { status: 400 });
  }

  const currentToken = cookieValue(request, "meetup_vote_device");
  const browserToken =
    currentToken && /^[0-9a-f]{64}$/u.test(currentToken)
      ? currentToken
      : randomBytes(32).toString("hex");
  const browserTokenHash = sha256Hex(browserToken);

  database.exec("BEGIN IMMEDIATE");
  let transactionOpen = true;
  let changed = false;
  try {
    const eventSettings = Object.fromEntries(
      database
        .prepare(
          `SELECT key, value FROM app_settings
            WHERE key IN ('voting_open', 'email_whitelist_validation_enabled')`
        )
        .all()
        .map((row) => [row.key, row.value])
    );
    const votingOpen = eventSettings.voting_open === "1";
    if (!votingOpen) {
      database.exec("ROLLBACK");
      transactionOpen = false;
      return json({ error: "Voting is closed." }, { status: 409 });
    }
    const project = database
      .prepare("SELECT id, title FROM submissions WHERE id = ? AND status = 'accepted'")
      .get(submissionId);
    if (!project) {
      database.exec("ROLLBACK");
      transactionOpen = false;
      return json({ error: "This project is not available for voting." }, { status: 404 });
    }
    const whitelistValidationEnabled =
      eventSettings.email_whitelist_validation_enabled !== "0";
    const whitelisted = whitelistValidationEnabled
      ? database
          .prepare("SELECT email FROM submission_email_whitelist WHERE email = ?")
          .get(voterEmail)
      : true;
    if (!whitelisted) {
      database.exec("ROLLBACK");
      transactionOpen = false;
      return json(
        { error: "This email is not on the voting whitelist. Contact the staff for help." },
        { status: 403 }
      );
    }

    const emailVote = database
      .prepare("SELECT id, submission_id, voter_email FROM attendee_votes WHERE voter_email = ?")
      .get(voterEmail);
    const browserVote = database
      .prepare("SELECT id, submission_id, voter_email FROM attendee_votes WHERE browser_token_hash = ?")
      .get(browserTokenHash);
    const priorVote = emailVote ?? browserVote;
    if (priorVote) {
      if (!replaceExisting) {
        database.exec("ROLLBACK");
        transactionOpen = false;
        return json(
          {
            error: "You have already voted. Confirm if you want to change your vote to this project.",
            code: "VOTE_ALREADY_EXISTS",
            existingSubmissionId: priorVote.submission_id
          },
          { status: 409 }
        );
      }

      if (emailVote) {
        database
          .prepare("UPDATE attendee_votes SET submission_id = ? WHERE id = ?")
          .run(submissionId, emailVote.id);
      } else {
        database
          .prepare("UPDATE attendee_votes SET submission_id = ?, voter_email = ? WHERE id = ?")
          .run(submissionId, voterEmail, browserVote.id);
      }
      if (priorVote.submission_id !== submissionId || priorVote.voter_email !== voterEmail) {
        recordVoteEvent(database, {
          voteId: priorVote.id,
          voterEmail,
          previousVoterEmail: priorVote.voter_email,
          action: priorVote.submission_id !== submissionId ? "switched" : "reassigned",
          previousSubmissionId: priorVote.submission_id,
          previousProjectTitle: database.prepare("SELECT title FROM submissions WHERE id = ?")
            .get(priorVote.submission_id).title,
          submissionId,
          projectTitle: project.title
        });
      }
      changed = true;
    } else {
      const voteId = randomUUID();
      database
        .prepare(
          `INSERT INTO attendee_votes
            (id, submission_id, voter_email, browser_token_hash)
           VALUES (?, ?, ?, ?)`
        )
        .run(voteId, submissionId, voterEmail, browserTokenHash);
      recordVoteEvent(database, {
        voteId, voterEmail, action: "selected", submissionId, projectTitle: project.title
      });
    }
    database.exec("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK");
    if (!String(error.message).includes("UNIQUE constraint failed")) throw error;
    return json(
      {
        error: "You have already voted. Confirm if you want to change your vote to this project.",
        code: "VOTE_ALREADY_EXISTS"
      },
      { status: 409 }
    );
  }

  return json(
    {
      recorded: true,
      changed,
      message: changed ? "Vote changed." : "Vote recorded."
    },
    {
      status: changed ? 200 : 201,
      headers: {
        "set-cookie": sessionCookie(
          "meetup_vote_device",
          browserToken,
          7_776_000,
          config.cookieSecure
        )
      }
    }
  );
}

function recordVoteEvent(database, event) {
  database.prepare(
    `INSERT INTO vote_audit_log
      (vote_id, voter_email, previous_voter_email, action,
       previous_submission_id, previous_project_title, submission_id, project_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.voteId, event.voterEmail, event.previousVoterEmail ?? null, event.action,
    event.previousSubmissionId ?? null, event.previousProjectTitle ?? null,
    event.submissionId ?? null, event.projectTitle ?? null
  );
}

function recordVoteRemovals(database, action, submissionId = null) {
  database.prepare(
    `INSERT INTO vote_audit_log
      (vote_id, voter_email, action, previous_submission_id, previous_project_title)
     SELECT v.id, v.voter_email, ?, v.submission_id, s.title
     FROM attendee_votes v JOIN submissions s ON s.id = v.submission_id
     WHERE (? IS NULL OR v.submission_id = ?)`
  ).run(action, submissionId, submissionId);
}

function adminVoteAudit(request, context) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const email = normalizeEmail(params.get("email") ?? "");
  const submissionId = params.get("submissionId") || null;
  const before = params.has("before") ? Number(params.get("before")) : null;
  if (
    email.length > 254 ||
    (submissionId !== null && !/^[0-9a-f-]{36}$/u.test(submissionId)) ||
    (before !== null && (!Number.isSafeInteger(before) || before < 1))
  ) {
    return json({ error: "The vote audit filter is invalid." }, { status: 400 });
  }
  const projects = database.prepare(
    `SELECT s.id, s.title, s.publisher_name AS publisherName, s.status,
            COUNT(v.id) AS voteCount
     FROM submissions s LEFT JOIN attendee_votes v ON v.submission_id = s.id
     GROUP BY s.id ORDER BY s.title COLLATE NOCASE, s.id`
  ).all();
  let project = submissionId ? projects.find((entry) => entry.id === submissionId) : null;
  if (submissionId && !project) {
    const snapshot = database.prepare(
      `SELECT CASE WHEN submission_id = ? THEN project_title ELSE previous_project_title END AS title
       FROM vote_audit_log WHERE submission_id = ? OR previous_submission_id = ?
       ORDER BY id DESC LIMIT 1`
    ).get(submissionId, submissionId, submissionId);
    if (!snapshot) return json({ error: "Project not found in vote records." }, { status: 404 });
    project = { id: submissionId, title: snapshot.title, publisherName: null, status: "removed", voteCount: 0 };
  }
  const votes = database.prepare(
    `SELECT v.id, v.voter_email AS voterEmail, v.submission_id AS submissionId,
            s.title AS projectTitle, s.status AS projectStatus, v.created_at AS createdAt
     FROM attendee_votes v JOIN submissions s ON s.id = v.submission_id
     WHERE instr(COALESCE(v.voter_email, ''), ?) > 0
       AND (? IS NULL OR v.submission_id = ?)
     ORDER BY v.voter_email, v.id`
  ).all(email, submissionId, submissionId);
  const history = database.prepare(
    `SELECT id, vote_id AS voteId, voter_email AS voterEmail,
            previous_voter_email AS previousVoterEmail, action,
            previous_submission_id AS previousSubmissionId,
            previous_project_title AS previousProjectTitle,
            submission_id AS submissionId, project_title AS projectTitle,
            occurred_at AS occurredAt
     FROM vote_audit_log
     WHERE (instr(COALESCE(voter_email, ''), ?) > 0
            OR instr(COALESCE(previous_voter_email, ''), ?) > 0)
       AND (? IS NULL OR submission_id = ? OR previous_submission_id = ?)
       AND (? IS NULL OR id < ?)
     ORDER BY id DESC LIMIT 101`
  ).all(email, email, submissionId, submissionId, submissionId, before, before);
  const hasMore = history.length > 100;
  if (hasMore) history.pop();
  return json({ votes, history, projects, project, nextBefore: hasMore ? history.at(-1).id : null });
}

async function removeVoteByEmail(request, context) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Use the voter audit page to remove a vote." }, { status: 415 });
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return json({ error: "Use the voter audit page on this site." }, { status: 403 });
  }
  const body = await readJson(request);
  const voterEmail = typeof body?.voterEmail === "string" ? normalizeEmail(body.voterEmail) : "";
  if (!validEmail(voterEmail) || typeof body?.voteId !== "string" || typeof body?.submissionId !== "string") {
    return json({ error: "Choose a voter email and its current vote." }, { status: 400 });
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    const vote = database.prepare(
      `SELECT v.id, v.submission_id, s.title
       FROM attendee_votes v JOIN submissions s ON s.id = v.submission_id
       WHERE v.voter_email = ?`
    ).get(voterEmail);
    if (!vote || vote.id !== body.voteId || vote.submission_id !== body.submissionId) {
      database.exec("ROLLBACK");
      return json({ error: "This vote changed or was removed. Refresh the list and try again." }, { status: 409 });
    }
    recordVoteEvent(database, {
      voteId: vote.id, voterEmail, action: "removed",
      previousSubmissionId: vote.submission_id, previousProjectTitle: vote.title
    });
    database.prepare("DELETE FROM attendee_votes WHERE id = ?").run(vote.id);
    database.exec("COMMIT");
    return json({ removed: true, voterEmail });
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function rankedAdminResults(database) {
  const resultRows = database
    .prepare(
      `SELECT s.id, s.title, s.publisher_name, COUNT(v.id) AS vote_count
         FROM submissions s
         LEFT JOIN attendee_votes v ON v.submission_id = s.id
        WHERE s.status = 'accepted'
        GROUP BY s.id, s.title, s.publisher_name
        ORDER BY vote_count DESC, s.submitted_at ASC, s.id ASC`
    )
    .all();

  return resultRows.map((result, index, all) => {
    const voteCount = Number(result.vote_count);
    const firstIndex = all.findIndex((entry) => Number(entry.vote_count) === voteCount);
    return {
      id: result.id,
      title: result.title,
      publisherName: result.publisher_name,
      voteCount,
      rank: firstIndex >= 0 ? firstIndex + 1 : index + 1
    };
  });
}

function adminLiveScores(request, context) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }

  const votingOpen =
    database.prepare("SELECT value FROM app_settings WHERE key = 'voting_open'").get()?.value === "1";
  const votesCast = Number(
    database.prepare("SELECT COUNT(*) AS count FROM attendee_votes").get().count
  );
  return json({ votingOpen, votesCast, results: rankedAdminResults(database) });
}

function resetAllVotes(request, context) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }

  const attendeeVoteCount = Number(
    database.prepare("SELECT COUNT(*) AS count FROM attendee_votes").get().count
  );
  const legacyVoteCount = Number(
    database.prepare("SELECT COUNT(*) AS count FROM votes").get().count
  );
  database.exec("BEGIN IMMEDIATE");
  try {
    recordVoteRemovals(database, "reset");
    database.prepare("DELETE FROM attendee_votes").run();
    database.prepare("DELETE FROM votes").run();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return json({ reset: true, removedCount: attendeeVoteCount + legacyVoteCount });
}

function adminDashboard(request, context) {
  const { config, database } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }

  const settings = Object.fromEntries(
    database
      .prepare(
        `SELECT key, value FROM app_settings
          WHERE key IN (
            'submissions_open',
            'voting_open',
            'results_published',
            'email_whitelist_validation_enabled'
          )`
      )
      .all()
      .map((row) => [row.key, row.value === "1"])
  );
  const submissions = database
    .prepare(
      `SELECT s.id, s.publisher_name, s.email, s.title, s.description, s.original_prompt, s.project_url,
              s.screenshot_key, s.screenshot_content_type, s.status, s.submitted_at, s.updated_at,
              COUNT(v.id) AS vote_count
         FROM submissions s
         LEFT JOIN attendee_votes v ON v.submission_id = s.id
        GROUP BY s.id, s.publisher_name, s.email, s.title, s.description, s.original_prompt, s.project_url,
                 s.screenshot_key, s.screenshot_content_type, s.status, s.submitted_at, s.updated_at
        ORDER BY s.submitted_at DESC, s.id DESC`
    )
    .all();
  const emailWhitelist = database
    .prepare("SELECT email FROM submission_email_whitelist ORDER BY email")
    .all()
    .map((row) => row.email);
  const votesCast = Number(
    database.prepare("SELECT COUNT(*) AS count FROM attendee_votes").get().count
  );
  const counts = { pending: 0, accepted: 0, rejected: 0 };
  for (const submission of submissions) counts[submission.status] += 1;

  return json({
    state: {
      submissionsOpen: settings.submissions_open,
      votingOpen: settings.voting_open,
      resultsPublished: settings.results_published,
      emailWhitelistValidationEnabled:
        settings.email_whitelist_validation_enabled ?? true
    },
    stats: { total: submissions.length, ...counts, votesCast },
    submissions: submissions.map((submission) => ({
      id: submission.id,
      publisherName: submission.publisher_name,
      email: submission.email,
      title: submission.title,
      description: submission.description,
      originalPrompt: submission.original_prompt,
      projectUrl: submission.project_url,
      screenshotUrl: `/media/${submission.screenshot_key}`,
      status: submission.status,
      submittedAt: submission.submitted_at,
      updatedAt: submission.updated_at
    })),
    emailWhitelist,
    results: rankedAdminResults(database)
  });
}

async function removeSubmission(request, context, submissionId) {
  const { config, database, submissionsDirectory } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }

  const existing = database
    .prepare("SELECT screenshot_key FROM submissions WHERE id = ?")
    .get(submissionId);
  if (!existing) return json({ error: "Submission not found." }, { status: 404 });

  database.exec("BEGIN IMMEDIATE");
  try {
    recordVoteRemovals(database, "submission_removed", submissionId);
    database.prepare("DELETE FROM votes WHERE submission_id = ?").run(submissionId);
    database.prepare("DELETE FROM attendee_votes WHERE submission_id = ?").run(submissionId);
    database.prepare("DELETE FROM submissions WHERE id = ?").run(submissionId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  const fileName = existing.screenshot_key.replace(/^submissions\//u, "");
  await unlink(join(submissionsDirectory, fileName)).catch(() => undefined);
  return json({ removed: true });
}

async function replaceScreenshot(request, context, submissionId) {
  const { config, database, submissionsDirectory } = context;
  if (!isAdmin(request, config)) {
    return json({ error: "Admin login required." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return json({ error: "Upload a replacement screenshot." }, { status: 415 });
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "The screenshot upload is invalid." }, { status: 400 });
  }
  const screenshot = form.get("screenshot");
  if (!isUploadedFile(screenshot)) {
    return json({ error: "Upload a replacement screenshot." }, { status: 400 });
  }
  const extension = SCREENSHOT_TYPES.get(screenshot.type);
  if (!extension || screenshot.size === 0 || screenshot.size > MAX_SCREENSHOT_BYTES) {
    return json({ error: "Screenshot must be a JPG, PNG, or WebP under 8 MB." }, { status: 400 });
  }
  const screenshotBytes = new Uint8Array(await screenshot.arrayBuffer());
  if (!hasValidImageSignature(screenshotBytes, screenshot.type)) {
    return json({ error: "Screenshot file does not match its image type." }, { status: 400 });
  }

  const existing = database
    .prepare("SELECT screenshot_key FROM submissions WHERE id = ?")
    .get(submissionId);
  if (!existing) return json({ error: "Submission not found." }, { status: 404 });

  const fileName = `${randomUUID()}.${extension}`;
  const screenshotKey = `submissions/${fileName}`;
  const screenshotPath = join(submissionsDirectory, fileName);
  await writeFile(screenshotPath, screenshotBytes, { flag: "wx", mode: 0o600 });
  try {
    database
      .prepare(
        `UPDATE submissions
            SET screenshot_key = ?, screenshot_content_type = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
      )
      .run(screenshotKey, screenshot.type, submissionId);
  } catch (error) {
    await unlink(screenshotPath).catch(() => undefined);
    throw error;
  }

  const oldFileName = existing.screenshot_key.replace(/^submissions\//u, "");
  await unlink(join(submissionsDirectory, oldFileName)).catch(() => undefined);
  return json({ saved: true, screenshotUrl: `/media/${screenshotKey}` });
}

function adminLogout(config) {
  return json(
    { authenticated: false },
    {
      headers: {
        "set-cookie": sessionCookie("event_admin", "", 0, config.cookieSecure)
      }
    }
  );
}

function adminSession(request, config) {
  return json({ authenticated: isAdmin(request, config) });
}

async function screenshotResponse(request, context, key) {
  if (!/^submissions\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/u.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const fileName = key.replace(/^submissions\//u, "");
  let bytes;
  try {
    bytes = await readFile(join(context.submissionsDirectory, fileName));
  } catch (error) {
    if (error?.code === "ENOENT") return new Response("Not found", { status: 404 });
    throw error;
  }

  const headers = new Headers({
    "cache-control": "public, max-age=31536000, immutable",
    "content-length": String(bytes.byteLength),
    "content-type": SCREENSHOT_CONTENT_TYPES.get(extname(fileName)) ?? "application/octet-stream"
  });
  return new Response(request.method === "HEAD" ? null : bytes, { headers });
}

function safePublicPath(publicDirectory, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const requestedFile = decodedPath === "/" || extname(decodedPath) === "" ? "index.html" : decodedPath.slice(1);
  const absolutePath = resolve(publicDirectory, requestedFile);
  const root = resolve(publicDirectory);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) return null;
  return absolutePath;
}

async function serveStatic(request, context, pathname) {
  const filePath = safePublicPath(context.publicDirectory, pathname);
  if (!filePath) return new Response("Not found", { status: 404 });

  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EISDIR") {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }
  const extension = extname(filePath).toLowerCase();
  const headers = new Headers({
    "cache-control": "no-cache",
    "content-length": String(bytes.byteLength),
    "content-type": STATIC_CONTENT_TYPES.get(extension) ?? "application/octet-stream"
  });
  return new Response(request.method === "HEAD" ? null : bytes, { headers });
}

async function routeRequest(request, context) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method === "GET" && pathname === "/healthz") {
    context.database.prepare("SELECT 1").get();
    return json({ status: "ok" });
  }
  if (request.method === "GET" && pathname === "/api/public/state") {
    return publicState(context.database);
  }
  if (request.method === "GET" && pathname === "/api/public/projects") {
    return publicProjects(context.database);
  }
  if (request.method === "POST" && pathname === "/api/submissions") {
    return createSubmission(request, context);
  }
  if (request.method === "POST" && pathname === "/api/votes") {
    return castVote(request, context);
  }
  if (request.method === "POST" && pathname === "/api/admin/login") {
    return adminLogin(request, context.config);
  }
  if (request.method === "POST" && pathname === "/api/admin/logout") {
    return adminLogout(context.config);
  }
  if (request.method === "GET" && pathname === "/api/admin/session") {
    return adminSession(request, context.config);
  }
  if (request.method === "GET" && pathname === "/api/admin/dashboard") {
    return adminDashboard(request, context);
  }
  if (request.method === "GET" && pathname === "/api/admin/live-scores") {
    return adminLiveScores(request, context);
  }
  if (request.method === "GET" && pathname === "/api/admin/votes") {
    return adminVoteAudit(request, context);
  }
  if (request.method === "DELETE" && pathname === "/api/admin/votes/by-email") {
    return removeVoteByEmail(request, context);
  }
  if (request.method === "DELETE" && pathname === "/api/admin/votes") {
    return resetAllVotes(request, context);
  }
  if (request.method === "POST" && pathname === "/api/admin/state") {
    return updateEventState(request, context);
  }
  if (request.method === "PUT" && pathname === "/api/admin/email-whitelist") {
    return replaceEmailWhitelist(request, context);
  }

  const moderationMatch = pathname.match(/^\/api\/admin\/submissions\/([0-9a-f-]{36})$/u);
  if (request.method === "PATCH" && moderationMatch) {
    return moderateSubmission(request, context, moderationMatch[1]);
  }
  if (request.method === "DELETE" && moderationMatch) {
    return removeSubmission(request, context, moderationMatch[1]);
  }
  const screenshotMatch = pathname.match(
    /^\/api\/admin\/submissions\/([0-9a-f-]{36})\/screenshot$/u
  );
  if (request.method === "POST" && screenshotMatch) {
    return replaceScreenshot(request, context, screenshotMatch[1]);
  }
  const mediaMatch = pathname.match(
    /^\/media\/(submissions\/[0-9a-f-]{36}\.(?:jpg|png|webp))$/u
  );
  if ((request.method === "GET" || request.method === "HEAD") && mediaMatch) {
    return screenshotResponse(request, context, mediaMatch[1]);
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/media/")) {
    return json({ error: "Not found." }, { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }
  return serveStatic(request, context, pathname);
}

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (headers.get("content-type")?.includes("text/html")) {
    headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function requestBody(nodeRequest) {
  const contentLength = Number(nodeRequest.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    nodeRequest.resume();
    throw new RequestTooLargeError();
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of nodeRequest) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_REQUEST_BYTES) {
      nodeRequest.resume();
      throw new RequestTooLargeError();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function webRequest(nodeRequest) {
  const method = nodeRequest.method ?? "GET";
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  const requestUrl = new URL(nodeRequest.url ?? "/", "http://localhost");
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") init.body = await requestBody(nodeRequest);
  return new Request(requestUrl, init);
}

async function sendResponse(nodeResponse, requestMethod, response) {
  const securedResponse = addSecurityHeaders(response);
  const headers = {};
  for (const [name, value] of securedResponse.headers) headers[name] = value;
  const body = requestMethod === "HEAD" ? Buffer.alloc(0) : Buffer.from(await securedResponse.arrayBuffer());
  nodeResponse.writeHead(securedResponse.status, headers);
  nodeResponse.end(body);
}

function validateOptions(options) {
  if (typeof options.adminPassword !== "string" || options.adminPassword.length < 8) {
    throw new Error("ADMIN_PASSWORD must contain at least 8 characters.");
  }
  if (options.adminPassword.startsWith("replace-with-")) {
    throw new Error("Replace the example ADMIN_PASSWORD before deployment.");
  }
  if (typeof options.sessionSecret !== "string" || options.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  if (options.sessionSecret.startsWith("replace-with-")) {
    throw new Error("Replace the example SESSION_SECRET before deployment.");
  }
}

export function createVotingApplication(options) {
  validateOptions(options);
  const dataDirectory = resolve(options.dataDirectory);
  const submissionsDirectory = join(dataDirectory, "uploads", "submissions");
  mkdirSync(submissionsDirectory, { recursive: true, mode: 0o700 });

  const database = openDatabase(
    options.databasePath ?? join(dataDirectory, "voting.sqlite"),
    options.migrationsDirectory ?? defaultMigrationsDirectory
  );
  const context = {
    config: {
      adminPassword: options.adminPassword,
      sessionSecret: options.sessionSecret,
      cookieSecure: options.cookieSecure ?? false
    },
    database,
    publicDirectory: options.publicDirectory ?? defaultPublicDirectory,
    submissionsDirectory
  };
  const logger = options.logger ?? console;

  const handler = async (nodeRequest, nodeResponse) => {
    try {
      const request = await webRequest(nodeRequest);
      const response = await routeRequest(request, context);
      await sendResponse(nodeResponse, request.method, response);
    } catch (error) {
      if (error instanceof RequestTooLargeError) {
        await sendResponse(
          nodeResponse,
          nodeRequest.method ?? "GET",
          json({ error: "Request body is too large." }, { status: 413 })
        );
        return;
      }
      logger.error("Request failed.", error);
      if (!nodeResponse.headersSent) {
        await sendResponse(
          nodeResponse,
          nodeRequest.method ?? "GET",
          json({ error: "Internal server error." }, { status: 500 })
        );
      } else {
        nodeResponse.destroy();
      }
    }
  };

  return {
    close() {
      database.close();
    },
    database,
    handler
  };
}

export function createVotingServer(options) {
  const application = createVotingApplication(options);
  const server = createServer(application.handler);
  return { ...application, server };
}
