import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, test } from "node:test";
import { createVotingApplication, createVotingServer } from "../src/app.js";

const temporaryDirectories = new Set();
const runningApplications = new Set();
const sessionSecret = "test-session-secret-with-more-than-32-characters";

async function startApplication(dataDirectory) {
  const application = createVotingServer({
    adminPassword: "test-admin-password",
    cookieSecure: false,
    dataDirectory,
    logger: { error() {} },
    sessionSecret
  });
  await new Promise((resolve, reject) => {
    application.server.once("error", reject);
    application.server.listen(0, "127.0.0.1", resolve);
  });
  const address = application.server.address();
  assert(address && typeof address === "object");
  application.origin = `http://127.0.0.1:${address.port}`;
  runningApplications.add(application);
  return application;
}

async function stopApplication(application) {
  if (!runningApplications.has(application)) return;
  application.server.closeAllConnections();
  await new Promise((resolve) => application.server.close(resolve));
  application.close();
  runningApplications.delete(application);
}

async function newDataDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "codex-meetup-voting-"));
  temporaryDirectories.add(directory);
  return directory;
}

function projectForm(
  email = "builder@example.com",
  originalPrompt = "Build a mobile-first map that helps meetup attendees find collaborators by skill."
) {
  const form = new FormData();
  form.set("publisherName", "Prompt Pilots");
  form.set("email", email);
  form.set("title", "Bangkok Builder Map");
  form.set("description", "A fast map for finding people to build with at the meetup.");
  form.set("originalPrompt", originalPrompt);
  form.set("projectUrl", "https://example.com/builder-map");
  form.set("confirmed", "true");
  form.set(
    "screenshot",
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
      type: "image/png"
    }),
    "project.png"
  );
  return form;
}

async function login(origin) {
  const response = await fetch(`${origin}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "test-admin-password" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

function seedAuditProjects(database) {
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  const insert = database.prepare(
    `INSERT INTO submissions
      (id, publisher_name, title, description, original_prompt, project_url,
       screenshot_key, screenshot_content_type, status)
     VALUES (?, 'Audit Team', ?, 'A project for vote audit testing.',
       'Build a project for testing audience vote history.', 'https://example.com',
       ?, 'image/png', 'accepted')`
  );
  ids.forEach((id, index) => insert.run(id, `Project ${index + 1}`, `submissions/${id}.png`));
  database.exec("UPDATE app_settings SET value = '1' WHERE key = 'voting_open'");
  database.exec("UPDATE app_settings SET value = '0' WHERE key = 'email_whitelist_validation_enabled'");
  return ids;
}

function submitAuditVote(application, voterEmail, submissionId, options = {}) {
  return fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(options.cookie ? { cookie: options.cookie } : {}) },
    body: JSON.stringify({ voterEmail, submissionId, replaceExisting: options.replaceExisting ?? false })
  });
}

async function readAudit(application, cookie, query = "") {
  const response = await fetch(`${application.origin}/api/admin/votes${query}`, { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}

function deleteAuditVote(application, cookie, vote, extraHeaders = {}) {
  return fetch(`${application.origin}/api/admin/votes/by-email`, {
    method: "DELETE",
    headers: { "content-type": "application/json", cookie, ...extraHeaders },
    body: JSON.stringify({ voterEmail: vote.voterEmail, voteId: vote.id, submissionId: vote.submissionId })
  });
}

afterEach(async () => {
  for (const application of [...runningApplications]) await stopApplication(application);
  for (const directory of temporaryDirectories) await rm(directory, { recursive: true, force: true });
  temporaryDirectories.clear();
});

test("rejects example deployment credentials", () => {
  assert.throws(
    () =>
      createVotingApplication({
        adminPassword: "replace-with-a-strong-admin-passphrase",
        dataDirectory: "/tmp/not-created-because-validation-runs-first",
        sessionSecret
      }),
    /Replace the example ADMIN_PASSWORD/u
  );
  assert.throws(
    () =>
      createVotingApplication({
        adminPassword: "test-admin-password",
        dataDirectory: "/tmp/not-created-because-validation-runs-first",
        sessionSecret: "replace-with-at-least-32-random-characters"
      }),
    /Replace the example SESSION_SECRET/u
  );
});

test("preserves existing votes when the voter email migration runs", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("CREATE TABLE submissions (id TEXT PRIMARY KEY)");
  database.exec("INSERT INTO submissions (id) VALUES ('existing-submission')");
  database.exec(await readFile(new URL("../migrations/0002_attendee_votes.sql", import.meta.url), "utf8"));
  database
    .prepare(
      `INSERT INTO attendee_votes
        (id, submission_id, voter_name, voter_name_normalized, browser_token_hash)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run("existing-vote", "existing-submission", "Palm", "palm", "existing-browser-hash");

  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(await readFile(new URL("../migrations/0004_voter_email.sql", import.meta.url), "utf8"));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  assert.deepEqual(
    { ...database.prepare("SELECT id, submission_id, voter_email FROM attendee_votes").get() },
    {
      id: "existing-vote",
      submission_id: "existing-submission",
      voter_email: null
    }
  );
  database.close();
});

test("runs the submission, moderation, voting, and results flow", async () => {
  const dataDirectory = await newDataDirectory();
  let application = await startApplication(dataDirectory);

  const initialStateResponse = await fetch(`${application.origin}/api/public/state`);
  assert.equal(initialStateResponse.status, 200);
  assert.deepEqual(await initialStateResponse.json(), {
    submissionsOpen: true,
    votingOpen: false,
    resultsPublished: false,
    emailWhitelistValidationEnabled: true,
    acceptedCount: 0,
    votesCast: 0
  });

  const adminCookie = await login(application.origin);
  const whitelistResponse = await fetch(`${application.origin}/api/admin/email-whitelist`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ emails: ["Builder@Example.com", "second@example.com", "builder@example.com"] })
  });
  assert.equal(whitelistResponse.status, 200);
  assert.deepEqual(await whitelistResponse.json(), {
    saved: true,
    emails: ["builder@example.com", "second@example.com"]
  });

  const unlistedResponse = await fetch(`${application.origin}/api/submissions`, {
    method: "POST",
    body: projectForm("not-listed@example.com")
  });
  assert.equal(unlistedResponse.status, 403);

  const submissionResponse = await fetch(`${application.origin}/api/submissions`, {
    method: "POST",
    body: projectForm()
  });
  assert.equal(submissionResponse.status, 201);
  const submission = await submissionResponse.json();
  assert.match(submission.id, /^[0-9a-f-]{36}$/u);

  const duplicateResponse = await fetch(`${application.origin}/api/submissions`, {
    method: "POST",
    body: projectForm("Builder@Example.com")
  });
  assert.equal(duplicateResponse.status, 409);
  assert.deepEqual(await duplicateResponse.json(), {
    error: "This email already has a submission. If you submitted by mistake or want to submit again, contact the staff.",
    code: "EMAIL_ALREADY_SUBMITTED"
  });

  const moderationResponse = await fetch(
    `${application.origin}/api/admin/submissions/${submission.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        publisherName: "Prompt Pilots BKK",
        title: "Bangkok Builder Map",
        description: "Find the right collaborator at the meetup in seconds.",
        projectUrl: "https://example.com/builder-map",
        status: "accepted"
      })
    }
  );
  assert.equal(moderationResponse.status, 200);

  const alternateSubmissionId = "22222222-2222-4222-8222-222222222222";
  application.database
    .prepare(
      `INSERT INTO submissions
        (id, publisher_name, title, description, original_prompt, project_url,
         screenshot_key, screenshot_content_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'accepted')`
    )
    .run(
      alternateSubmissionId,
      "Alternate Team",
      "Alternate Project",
      "A second accepted project for vote-change testing.",
      "Build a second accepted project that can receive a changed audience vote.",
      "https://example.com/alternate",
      `submissions/${submission.id}.png`,
      "image/png"
    );

  const openVotingResponse = await fetch(`${application.origin}/api/admin/state`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ submissionsOpen: false, votingOpen: true, resultsPublished: false })
  });
  assert.equal(openVotingResponse.status, 200);

  const publishWhileVotingResponse = await fetch(`${application.origin}/api/admin/state`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ resultsPublished: true })
  });
  assert.equal(publishWhileVotingResponse.status, 409);
  assert.deepEqual(await publishWhileVotingResponse.json(), {
    error: "Close voting before publishing results."
  });

  const unlistedVoteResponse = await fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voterEmail: "not-listed@example.com", submissionId: submission.id })
  });
  assert.equal(unlistedVoteResponse.status, 403);

  const voteResponse = await fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voterEmail: "Builder@Example.com", submissionId: submission.id })
  });
  assert.equal(voteResponse.status, 201);
  assert.deepEqual(await voteResponse.json(), {
    recorded: true,
    changed: false,
    message: "Vote recorded."
  });
  const voteCookie = voteResponse.headers.get("set-cookie").split(";")[0];
  const liveVotingResponse = await fetch(`${application.origin}/api/admin/live-scores`, {
    headers: { cookie: adminCookie }
  });
  const liveVoting = await liveVotingResponse.json();
  assert.equal(liveVoting.votingOpen, true);
  assert.equal(liveVoting.votesCast, 1);
  assert.equal(liveVoting.results[0].voteCount, 1);

  const publicVotingStateResponse = await fetch(`${application.origin}/api/public/state`);
  assert.equal(publicVotingStateResponse.status, 200);
  assert.deepEqual(await publicVotingStateResponse.json(), {
    submissionsOpen: false,
    votingOpen: true,
    resultsPublished: false,
    emailWhitelistValidationEnabled: true,
    acceptedCount: 2,
    votesCast: 1
  });

  const repeatedVoteResponse = await fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: voteCookie },
    body: JSON.stringify({ voterEmail: "builder@example.com", submissionId: submission.id })
  });
  assert.equal(repeatedVoteResponse.status, 409);
  assert.deepEqual(await repeatedVoteResponse.json(), {
    error: "You have already voted. Confirm if you want to change your vote to this project.",
    code: "VOTE_ALREADY_EXISTS",
    existingSubmissionId: submission.id
  });

  const changedVoteResponse = await fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: voteCookie },
    body: JSON.stringify({
      voterEmail: "builder@example.com",
      submissionId: alternateSubmissionId,
      replaceExisting: true
    })
  });
  assert.equal(changedVoteResponse.status, 200);
  assert.deepEqual(await changedVoteResponse.json(), {
    recorded: true,
    changed: true,
    message: "Vote changed."
  });
  assert.equal(
    application.database
      .prepare("SELECT submission_id FROM attendee_votes WHERE voter_email = ?")
      .get("builder@example.com").submission_id,
    alternateSubmissionId
  );

  const restoredVoteResponse = await fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: voteCookie },
    body: JSON.stringify({
      voterEmail: "builder@example.com",
      submissionId: submission.id,
      replaceExisting: true
    })
  });
  assert.equal(restoredVoteResponse.status, 200);
  application.database.prepare("DELETE FROM submissions WHERE id = ?").run(alternateSubmissionId);

  const closeVotingResponse = await fetch(`${application.origin}/api/admin/state`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ submissionsOpen: false, votingOpen: false, resultsPublished: true })
  });
  assert.equal(closeVotingResponse.status, 200);

  const projectsResponse = await fetch(`${application.origin}/api/public/projects`);
  const projects = await projectsResponse.json();
  assert.deepEqual(projects.projects[0], {
    id: submission.id,
    publisherName: "Prompt Pilots BKK",
    title: "Bangkok Builder Map",
    description: "Find the right collaborator at the meetup in seconds.",
    originalPrompt:
      "Build a mobile-first map that helps meetup attendees find collaborators by skill.",
    projectUrl: "https://example.com/builder-map",
    screenshotUrl: `/media/submissions/${submission.id}.png`,
    submittedAt: projects.projects[0].submittedAt,
    voteCount: 1,
    rank: 1
  });

  const screenshotResponse = await fetch(
    `${application.origin}${projects.projects[0].screenshotUrl}`
  );
  assert.equal(screenshotResponse.status, 200);
  assert.equal(screenshotResponse.headers.get("content-type"), "image/png");

  await stopApplication(application);
  application = await startApplication(dataDirectory);
  const persistedProjectsResponse = await fetch(`${application.origin}/api/public/projects`);
  const persistedProjects = await persistedProjectsResponse.json();
  assert.equal(persistedProjects.projects.length, 1);
  assert.equal(persistedProjects.projects[0].voteCount, 1);

  const uploadFiles = await readdir(join(dataDirectory, "uploads", "submissions"));
  assert.deepEqual(uploadFiles, [`${submission.id}.png`]);

  const dashboardResponse = await fetch(`${application.origin}/api/admin/dashboard`, {
    headers: { cookie: adminCookie }
  });
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.submissions[0].email, "builder@example.com");
  assert.equal(dashboard.state.emailWhitelistValidationEnabled, true);
  assert.deepEqual(dashboard.emailWhitelist, ["builder@example.com", "second@example.com"]);
  assert.equal(dashboard.results[0].voteCount, 1);

  const liveScoresResponse = await fetch(`${application.origin}/api/admin/live-scores`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(liveScoresResponse.status, 200);
  assert.deepEqual(await liveScoresResponse.json(), {
    votingOpen: false,
    votesCast: 1,
    results: [
      {
        id: submission.id,
        title: "Bangkok Builder Map",
        publisherName: "Prompt Pilots BKK",
        voteCount: 1,
        rank: 1
      }
    ]
  });

  const unauthorizedResetResponse = await fetch(`${application.origin}/api/admin/votes`, {
    method: "DELETE"
  });
  assert.equal(unauthorizedResetResponse.status, 401);
  const resetResponse = await fetch(`${application.origin}/api/admin/votes`, {
    method: "DELETE",
    headers: { cookie: adminCookie }
  });
  assert.equal(resetResponse.status, 200);
  assert.deepEqual(await resetResponse.json(), { reset: true, removedCount: 1 });
  const scoresAfterResetResponse = await fetch(`${application.origin}/api/admin/live-scores`, {
    headers: { cookie: adminCookie }
  });
  const scoresAfterReset = await scoresAfterResetResponse.json();
  assert.equal(scoresAfterReset.votesCast, 0);
  assert.equal(scoresAfterReset.results[0].voteCount, 0);

  const deleteResponse = await fetch(
    `${application.origin}/api/admin/submissions/${submission.id}`,
    { method: "DELETE", headers: { cookie: adminCookie } }
  );
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await deleteResponse.json(), { removed: true });
  assert.deepEqual(await readdir(join(dataDirectory, "uploads", "submissions")), []);
});

test("can disable whitelist validation without clearing the saved whitelist", async () => {
  const application = await startApplication(await newDataDirectory());
  const adminCookie = await login(application.origin);

  const whitelistResponse = await fetch(`${application.origin}/api/admin/email-whitelist`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ emails: ["listed@example.com"] })
  });
  assert.equal(whitelistResponse.status, 200);

  const blockedSubmissionResponse = await fetch(`${application.origin}/api/submissions`, {
    method: "POST",
    body: projectForm("unlisted@example.com")
  });
  assert.equal(blockedSubmissionResponse.status, 403);

  const disableResponse = await fetch(`${application.origin}/api/admin/state`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ emailWhitelistValidationEnabled: false })
  });
  assert.equal(disableResponse.status, 200);
  assert.deepEqual(await disableResponse.json(), {
    submissionsOpen: true,
    votingOpen: false,
    resultsPublished: false,
    emailWhitelistValidationEnabled: false
  });

  const dashboardWhileDisabledResponse = await fetch(
    `${application.origin}/api/admin/dashboard`,
    { headers: { cookie: adminCookie } }
  );
  const dashboardWhileDisabled = await dashboardWhileDisabledResponse.json();
  assert.equal(dashboardWhileDisabled.state.emailWhitelistValidationEnabled, false);
  assert.deepEqual(dashboardWhileDisabled.emailWhitelist, ["listed@example.com"]);

  const submissionResponse = await fetch(`${application.origin}/api/submissions`, {
    method: "POST",
    body: projectForm("unlisted@example.com")
  });
  assert.equal(submissionResponse.status, 201);
  const submission = await submissionResponse.json();

  const moderationResponse = await fetch(
    `${application.origin}/api/admin/submissions/${submission.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        publisherName: "Prompt Pilots",
        title: "Bangkok Builder Map",
        description: "A fast map for finding people to build with at the meetup.",
        projectUrl: "https://example.com/builder-map",
        status: "accepted"
      })
    }
  );
  assert.equal(moderationResponse.status, 200);

  const openVotingResponse = await fetch(`${application.origin}/api/admin/state`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ votingOpen: true })
  });
  assert.equal(openVotingResponse.status, 200);

  const unlistedVoteResponse = await fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      voterEmail: "unlisted-voter@example.com",
      submissionId: submission.id
    })
  });
  assert.equal(unlistedVoteResponse.status, 201);

  const enableResponse = await fetch(`${application.origin}/api/admin/state`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ emailWhitelistValidationEnabled: true })
  });
  assert.equal(enableResponse.status, 200);

  const blockedVoteResponse = await fetch(`${application.origin}/api/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      voterEmail: "another-unlisted-voter@example.com",
      submissionId: submission.id
    })
  });
  assert.equal(blockedVoteResponse.status, 403);

  const finalDashboardResponse = await fetch(`${application.origin}/api/admin/dashboard`, {
    headers: { cookie: adminCookie }
  });
  const finalDashboard = await finalDashboardResponse.json();
  assert.equal(finalDashboard.state.emailWhitelistValidationEnabled, true);
  assert.deepEqual(finalDashboard.emailWhitelist, ["listed@example.com"]);
});

test("accepts prompts up to 1,000,000 characters", async () => {
  const application = await startApplication(await newDataDirectory());
  const adminCookie = await login(application.origin);

  const disableResponse = await fetch(`${application.origin}/api/admin/state`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ emailWhitelistValidationEnabled: false })
  });
  assert.equal(disableResponse.status, 200);

  const maximumPrompt = "p".repeat(1_000_000);
  const acceptedResponse = await fetch(`${application.origin}/api/submissions`, {
    method: "POST",
    body: projectForm("maximum@example.com", maximumPrompt)
  });
  assert.equal(acceptedResponse.status, 201);
  assert.equal(
    application.database
      .prepare("SELECT length(original_prompt) AS length FROM submissions WHERE email = ?")
      .get("maximum@example.com").length,
    1_000_000
  );

  const rejectedResponse = await fetch(`${application.origin}/api/submissions`, {
    method: "POST",
    body: projectForm("too-large@example.com", `${maximumPrompt}p`)
  });
  assert.equal(rejectedResponse.status, 400);
  assert.deepEqual(await rejectedResponse.json(), {
    error: "Complete prompt must be 20–1,000,000 characters."
  });
});

test("keeps accepted games playable in every non-voting phase", async () => {
  const application = await startApplication(await newDataDirectory());
  const ids = seedAuditProjects(application.database);
  application.database.prepare("UPDATE submissions SET status = 'pending' WHERE id = ?").run(ids[1]);

  for (const phase of [
    { submissions: '1', results: '0' },
    { submissions: '0', results: '0' },
    { submissions: '0', results: '1' }
  ]) {
    const setting = application.database.prepare("UPDATE app_settings SET value = ? WHERE key = ?");
    setting.run('0', 'voting_open');
    setting.run(phase.submissions, 'submissions_open');
    setting.run(phase.results, 'results_published');
    const state = await (await fetch(`${application.origin}/api/public/state`)).json();
    assert.equal(state.votingOpen, false);
    const { projects } = await (await fetch(`${application.origin}/api/public/projects`)).json();
    assert.equal(projects.length, 1, 'Only accepted games remain visible');
    assert.equal(projects[0].id, ids[0]);
    assert.equal(projects[0].projectUrl, 'https://example.com');
    assert.equal('voteCount' in projects[0], phase.results === '1');
    const vote = await submitAuditVote(application, 'player@example.test', ids[0]);
    assert.equal(vote.status, 409, 'Playing does not enable closed voting');
  }
});

test("serves the frontend and protects organizer routes", async () => {
  const application = await startApplication(await newDataDirectory());

  const pageResponse = await fetch(`${application.origin}/gallery`);
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get("content-type"), /^text\/html/u);
  const pageHtml = await pageResponse.text();
  assert.match(pageHtml, /One-Shot Build Challenge/u);
  assert.match(pageHtml, /id="vote-error"/u);
  assert.match(pageHtml, /app\.js\?v=20261003-2/u);
  assert.match(pageHtml, /styles\.css\?v=20261003-1/u);

  const policy = pageResponse.headers.get("content-security-policy");
  assert.match(policy, /frame-src https: http:/u);
  assert.match(policy, /frame-ancestors 'none'/u);
  assert.match(policy, /script-src 'self'/u);
  assert.match(pageHtml, /frame-src https: http:/u);

  const appScriptResponse = await fetch(`${application.origin}/app.js?v=20261003-2`);
  assert.equal(appScriptResponse.status, 200);
  assert.equal(appScriptResponse.headers.get("cache-control"), "no-cache");
  const appScript = await appScriptResponse.text();
  assert.match(appScript, /name="originalPrompt" minlength="20" maxlength="1000000"/u);
  assert.match(
    appScript,
    /document\.querySelector\("#vote-form"\)\.addEventListener\("submit", async \(event\) => \{\s+event\.preventDefault\(\);\s+const form = event\.currentTarget;\s+const button = form\.querySelector\('button\[type="submit"\]'\);\s+const errorTarget = getVoteErrorTarget\(form\);/u
  );

  for (const [path, type] of [["/pocket-town.css", "text/css"], ["/assets/pocket-town.webp", "image/webp"], ["/assets/silkscreen.ttf", "font/ttf"], ["/assets/manrope.ttf", "font/ttf"]]) {
    const asset = await fetch(`${application.origin}${path}`);
    assert.equal(asset.status, 200);
    assert.ok(asset.headers.get("content-type").startsWith(type));
    assert.ok((await asset.arrayBuffer()).byteLength > 0);
  }

  const userManualPageResponse = await fetch(`${application.origin}/manual`);
  assert.equal(userManualPageResponse.status, 200);
  assert.match(userManualPageResponse.headers.get("content-type"), /^text\/html/u);
  assert.match(await userManualPageResponse.text(), /One-Shot Build Challenge/u);

  const liveScorePageResponse = await fetch(`${application.origin}/admin/live`);
  assert.equal(liveScorePageResponse.status, 200);
  assert.match(liveScorePageResponse.headers.get("content-type"), /^text\/html/u);
  assert.match(await liveScorePageResponse.text(), /One-Shot Build Challenge/u);

  const totalVotesPageResponse = await fetch(`${application.origin}/admin/total-vote-only-view`);
  assert.equal(totalVotesPageResponse.status, 200);
  assert.match(totalVotesPageResponse.headers.get("content-type"), /^text\/html/u);
  assert.match(await totalVotesPageResponse.text(), /One-Shot Build Challenge/u);

  const auditPageResponse = await fetch(`${application.origin}/admin/votes`);
  assert.equal(auditPageResponse.status, 200);
  assert.match(auditPageResponse.headers.get("content-type"), /^text\/html/u);

  const adminManualPageResponse = await fetch(`${application.origin}/admin/manual`);
  assert.equal(adminManualPageResponse.status, 200);
  assert.match(adminManualPageResponse.headers.get("content-type"), /^text\/html/u);
  assert.match(await adminManualPageResponse.text(), /One-Shot Build Challenge/u);

  const resultsPageResponse = await fetch(`${application.origin}/results`);
  assert.equal(resultsPageResponse.status, 200);
  assert.match(resultsPageResponse.headers.get("content-type"), /^text\/html/u);
  assert.match(await resultsPageResponse.text(), /One-Shot Build Challenge/u);

  const healthResponse = await fetch(`${application.origin}/healthz`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: "ok" });

  const dashboardResponse = await fetch(`${application.origin}/api/admin/dashboard`);
  assert.equal(dashboardResponse.status, 401);
  assert.deepEqual(await dashboardResponse.json(), { error: "Admin login required." });
});

test("audits vote changes and removes only the selected email vote", async () => {
  const dataDirectory = await newDataDirectory();
  let application = await startApplication(dataDirectory);
  const cookie = await login(application.origin);
  const [first, second] = seedAuditProjects(application.database);
  const initial = await submitAuditVote(application, "Voter@Example.com", first);
  assert.equal(initial.status, 201);
  const voterCookie = initial.headers.get("set-cookie").split(";")[0];
  assert.equal((await submitAuditVote(application, "other@example.com", first)).status, 201);
  const originalAudit = await readAudit(application, cookie);
  const staleVote = originalAudit.votes.find((vote) => vote.voterEmail === "voter@example.com");
  assert.equal(staleVote.projectTitle, "Project 1");
  assert.equal(originalAudit.history.length, 2);
  assert.equal(originalAudit.history[1].action, "selected");

  assert.equal((await submitAuditVote(application, "voter@example.com", second)).status, 409);
  assert.equal((await readAudit(application, cookie)).history.length, 2);
  assert.equal((await submitAuditVote(application, "voter@example.com", second, { replaceExisting: true })).status, 200);
  let audit = await readAudit(application, cookie, "?email=VOTER%40EXAMPLE.COM");
  assert.equal(audit.votes.length, 1);
  assert.equal(audit.votes[0].submissionId, second);
  assert.equal(audit.history[0].action, "switched");
  assert.equal(audit.history[0].previousProjectTitle, "Project 1");
  assert.equal(audit.history[0].projectTitle, "Project 2");
  assert.equal(audit.history[0].previousVoterEmail, "voter@example.com");
  assert.equal((await submitAuditVote(application, "voter@example.com", second, { replaceExisting: true })).status, 200);
  assert.equal((await readAudit(application, cookie)).history.length, 3, "no switch event for the same selection");

  assert.equal((await fetch(`${application.origin}/api/admin/votes`)).status, 401);
  assert.equal((await deleteAuditVote(application, "", audit.votes[0])).status, 401);
  assert.equal((await deleteAuditVote(application, cookie, audit.votes[0], { "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await deleteAuditVote(application, cookie, audit.votes[0], { "content-type": "text/plain" })).status, 415);
  assert.equal((await deleteAuditVote(application, cookie, { ...audit.votes[0], voterEmail: "invalid" })).status, 400);
  assert.equal((await deleteAuditVote(application, cookie, staleVote)).status, 409);
  const remove = await deleteAuditVote(application, cookie, { ...audit.votes[0], voterEmail: " VOTER@example.com " });
  assert.equal(remove.status, 200);
  assert.deepEqual(await remove.json(), { removed: true, voterEmail: "voter@example.com" });
  assert.equal((await deleteAuditVote(application, cookie, audit.votes[0])).status, 409);
  audit = await readAudit(application, cookie);
  assert.deepEqual(audit.votes.map((vote) => vote.voterEmail), ["other@example.com"]);
  assert.equal(audit.history[0].action, "removed");
  assert.equal(audit.history[0].previousProjectTitle, "Project 2");
  const scores = await (await fetch(`${application.origin}/api/admin/live-scores`, { headers: { cookie } })).json();
  assert.equal(scores.votesCast, 1);
  assert.equal(scores.results.find((project) => project.id === second).voteCount, 0);
  assert.equal((await submitAuditVote(application, "voter@example.com", first, { cookie: voterCookie })).status, 201);
  assert.equal((await deleteAuditVote(application, cookie, staleVote)).status, 409, "an old vote ID cannot remove a new vote");

  application.database.prepare("UPDATE submissions SET title = 'Renamed project' WHERE id = ?").run(first);
  assert.equal((await fetch(`${application.origin}/api/admin/votes`, { method: "DELETE", headers: { cookie } })).status, 200);
  audit = await readAudit(application, cookie);
  assert.equal(audit.votes.length, 0);
  assert.deepEqual(audit.history.slice(0, 2).map((entry) => entry.action), ["reset", "reset"]);
  assert.equal(audit.history[0].previousProjectTitle, "Renamed project");
  assert.equal(audit.history.at(-1).projectTitle, "Project 1", "old titles are preserved");
  assert.equal((await submitAuditVote(application, "voter@example.com", first, { cookie: voterCookie })).status, 201);
  assert.equal((await fetch(`${application.origin}/api/admin/submissions/${first}`, { method: "DELETE", headers: { cookie } })).status, 200);
  audit = await readAudit(application, cookie);
  assert.equal(audit.votes.length, 0);
  assert.equal(audit.history[0].action, "submission_removed");
  assert.equal(audit.history[0].previousSubmissionId, first);
  assert.equal(audit.history[0].previousProjectTitle, "Renamed project");
  await stopApplication(application);
  application = await startApplication(dataDirectory);
  assert.deepEqual(await readAudit(application, cookie), audit, "history survives a restart and project removal");
});

test("imports existing votes once without inventing earlier vote changes", async () => {
  const directory = await newDataDirectory();
  const database = new DatabaseSync(join(directory, "voting.sqlite"));
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY)");
  const migrations = await readdir(new URL("../migrations", import.meta.url));
  for (const file of migrations.filter((name) => name < "0007").sort()) {
    database.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
    database.prepare("INSERT INTO schema_migrations VALUES (?)").run(file);
  }
  const [first] = seedAuditProjects(database);
  const insert = database.prepare(
    `INSERT INTO attendee_votes (id, submission_id, voter_email, browser_token_hash, created_at)
     VALUES (?, ?, ?, ?, '2026-01-01 00:00:00')`
  );
  insert.run("existing-vote", first, "existing@example.com", "existing-browser");
  insert.run("legacy-vote", first, null, "legacy-browser");
  database.close();
  let application = await startApplication(directory);
  const cookie = await login(application.origin);
  const audit = await readAudit(application, cookie);
  assert.equal(audit.votes.length, 2);
  assert.equal(audit.votes.find((vote) => vote.id === "legacy-vote").voterEmail, null);
  assert.equal(audit.history.length, 2);
  for (const entry of audit.history) {
    assert.equal(entry.action, "imported");
    assert.equal(entry.projectTitle, "Project 1");
    assert.equal(entry.previousSubmissionId, null);
    assert.notEqual(entry.occurredAt, "2026-01-01 00:00:00");
  }
  assert.deepEqual(application.database.prepare("PRAGMA foreign_key_check").all(), []);
  await stopApplication(application);
  application = await startApplication(directory);
  assert.deepEqual(await readAudit(application, cookie), audit);
});

test("records browser vote email changes and paginates filtered history", async () => {
  const application = await startApplication(await newDataDirectory());
  const cookie = await login(application.origin);
  const [first, second] = seedAuditProjects(application.database);
  const initial = await submitAuditVote(application, "first@example.com", first);
  const voterCookie = initial.headers.get("set-cookie").split(";")[0];
  assert.equal((await submitAuditVote(application, "next@example.com", first, { cookie: voterCookie, replaceExisting: true })).status, 200);
  let audit = await readAudit(application, cookie, "?email=first%40example.com");
  assert.equal(audit.votes.length, 0);
  assert.equal(audit.history[0].action, "reassigned");
  assert.equal(audit.history[0].previousVoterEmail, "first@example.com");
  assert.equal(audit.history[0].voterEmail, "next@example.com");
  for (let index = 0; index < 104; index += 1) {
    assert.equal((await submitAuditVote(application, "next@example.com", index % 2 === 0 ? second : first, { replaceExisting: true })).status, 200);
  }
  audit = await readAudit(application, cookie, `?email=next%40example.com&submissionId=${first}`);
  assert.equal(audit.history.length, 100);
  assert.notEqual(audit.nextBefore, null);
  const older = await readAudit(application, cookie, `?email=next%40example.com&submissionId=${first}&before=${audit.nextBefore}`);
  assert.equal(older.history.length, 5);
  assert.equal(older.nextBefore, null);
  assert(older.history.every((entry) => entry.id < audit.nextBefore));
  assert.equal(new Set([...audit.history, ...older.history].map((entry) => entry.id)).size, 105);
  assert.deepEqual((await readAudit(application, cookie, "?email=%25")).history, [], "search treats percent literally");
  for (const query of ["?before=0", "?before=abc", "?before=1.5", `?email=${"a".repeat(255)}`]) {
    assert.equal((await fetch(`${application.origin}/api/admin/votes${query}`, { headers: { cookie } })).status, 400);
  }
});

test("rolls back vote writes when the audit log cannot be written", async () => {
  const application = await startApplication(await newDataDirectory());
  const cookie = await login(application.origin);
  const [first, second] = seedAuditProjects(application.database);
  assert.equal((await submitAuditVote(application, "voter@example.com", first)).status, 201);
  const audit = await readAudit(application, cookie);
  application.database.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON vote_audit_log
    BEGIN SELECT RAISE(ABORT, 'Audit storage unavailable'); END;`);
  assert.equal((await submitAuditVote(application, "new@example.com", first)).status, 500);
  assert.equal((await submitAuditVote(application, "voter@example.com", second, { replaceExisting: true })).status, 500);
  assert.equal((await deleteAuditVote(application, cookie, audit.votes[0])).status, 500);
  assert.equal((await fetch(`${application.origin}/api/admin/votes`, { method: "DELETE", headers: { cookie } })).status, 500);
  assert.equal((await fetch(`${application.origin}/api/admin/submissions/${first}`, { method: "DELETE", headers: { cookie } })).status, 500);
  assert.deepEqual(await readAudit(application, cookie), audit);
  assert.equal(application.database.prepare("SELECT COUNT(*) AS count FROM submissions").get().count, 2);
});

test("shows current project voters separately from incoming, outgoing, and removed vote history", async () => {
  const application = await startApplication(await newDataDirectory());
  const cookie = await login(application.origin);
  const [first, second] = seedAuditProjects(application.database);
  const third = "33333333-3333-4333-8333-333333333333";
  application.database.prepare(
    `INSERT INTO submissions
      (id, publisher_name, title, description, original_prompt, project_url,
       screenshot_key, screenshot_content_type, status)
     SELECT ?, publisher_name, title, description, original_prompt, project_url,
       screenshot_key, screenshot_content_type, status FROM submissions WHERE id = ?`
  ).run(third, first);
  assert.equal((await submitAuditVote(application, "alex@example.com", first)).status, 201);
  assert.equal((await submitAuditVote(application, "mali@example.com", first)).status, 201);
  assert.equal((await submitAuditVote(application, "alex@example.com", second, { replaceExisting: true })).status, 200);

  let audit = await readAudit(application, cookie, `?submissionId=${first}`);
  assert.equal(audit.project.id, first);
  assert.equal(audit.project.title, "Project 1");
  assert.equal(audit.project.voteCount, 1);
  assert.deepEqual(audit.votes.map((vote) => vote.voterEmail), ["mali@example.com"]);
  assert.equal(audit.history.length, 3);
  assert.equal(audit.history[0].action, "switched");
  assert.equal(audit.history[0].previousSubmissionId, first);
  assert.equal(audit.history[0].submissionId, second);
  assert.deepEqual(audit.projects.map((project) => [project.id, project.voteCount]), [[first, 1], [third, 0], [second, 1]]);

  const filtered = await readAudit(application, cookie, `?submissionId=${first}&email=ALEX%40`);
  assert.equal(filtered.votes.length, 0, "a voter who switched away is not a current voter");
  assert.equal(filtered.project.voteCount, 1, "project total is independent of email search");
  assert.equal(filtered.history.length, 2);
  assert(filtered.history.every((entry) => entry.voterEmail === "alex@example.com"));
  const incoming = await readAudit(application, cookie, `?submissionId=${second}`);
  assert.deepEqual(incoming.votes.map((vote) => vote.voterEmail), ["alex@example.com"]);
  assert.equal(incoming.history.length, 1);
  assert.equal(incoming.history[0].action, "switched");

  const empty = await readAudit(application, cookie, `?submissionId=${third}`);
  assert.equal(empty.project.title, "Project 1", "duplicate titles are filtered by project ID");
  assert.equal(empty.project.voteCount, 0);
  assert.deepEqual(empty.votes, []);
  assert.deepEqual(empty.history, []);

  assert.equal((await deleteAuditVote(application, cookie, audit.votes[0])).status, 200);
  audit = await readAudit(application, cookie, `?submissionId=${first}`);
  assert.equal(audit.project.voteCount, 0);
  assert.deepEqual(audit.votes, []);
  assert.equal(audit.history[0].action, "removed");
  assert.equal(audit.history.length, 4);

  assert.equal((await fetch(`${application.origin}/api/admin/submissions/${first}`, { method: "DELETE", headers: { cookie } })).status, 200);
  const removedProject = await readAudit(application, cookie, `?submissionId=${first}`);
  assert.equal(removedProject.project.status, "removed");
  assert.equal(removedProject.project.title, "Project 1");
  assert.equal(removedProject.project.voteCount, 0);
  assert.deepEqual(removedProject.history, audit.history, "history links still work after project deletion");

  for (const [query, status] of [[`?submissionId=invalid`, 400], ["?submissionId=44444444-4444-4444-8444-444444444444", 404]]) {
    assert.equal((await fetch(`${application.origin}/api/admin/votes${query}`, { headers: { cookie } })).status, status);
  }
  assert.equal((await fetch(`${application.origin}/api/admin/votes?submissionId=${second}`)).status, 401);
});
