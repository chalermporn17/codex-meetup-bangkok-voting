import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import "../src/index";

describe("event voting public API", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM attendee_votes"),
      env.DB.prepare("DELETE FROM votes"),
      env.DB.prepare("DELETE FROM voter_codes"),
      env.DB.prepare("DELETE FROM submissions"),
      env.DB.prepare("UPDATE app_settings SET value = '1' WHERE key = 'submissions_open'"),
      env.DB.prepare("UPDATE app_settings SET value = '0' WHERE key IN ('voting_open', 'results_published')")
    ]);
  });

  it("reports the initial event state", async () => {
    const response = await exports.default.fetch("https://event.test/api/public/state");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      submissionsOpen: true,
      votingOpen: false,
      resultsPublished: false,
      acceptedCount: 0
    });
  });

  it("accepts a complete project submission with an uploaded screenshot", async () => {
    const form = new FormData();
    form.set("publisherName", "Prompt Pilots");
    form.set("title", "Bangkok Builder Map");
    form.set("description", "A fast map for finding people to build with at the meetup.");
    form.set("originalPrompt", "Build a mobile-first map that helps meetup attendees find collaborators by skill.");
    form.set("projectUrl", "https://example.com/builder-map");
    form.set("confirmed", "true");
    form.set(
      "screenshot",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "project.png", {
        type: "image/png"
      })
    );

    const response = await exports.default.fetch(
      new Request("https://event.test/api/submissions", { method: "POST", body: form })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: expect.any(String),
      message: "Project submitted for organizer review."
    });
  });

  it("publishes an organizer-approved project to the gallery without changing its prompt", async () => {
    const form = new FormData();
    form.set("publisherName", "Prompt Pilots");
    form.set("title", "Bangkok Builder Map");
    form.set("description", "A fast map for finding people to build with at the meetup.");
    form.set("originalPrompt", "Build a mobile-first map that helps meetup attendees find collaborators by skill.");
    form.set("projectUrl", "https://example.com/builder-map");
    form.set("confirmed", "true");
    form.set(
      "screenshot",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "project.png", {
        type: "image/png"
      })
    );
    const submissionResponse = await exports.default.fetch(
      new Request("https://event.test/api/submissions", { method: "POST", body: form })
    );
    const submission = (await submissionResponse.json()) as { id: string };

    const loginResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" })
      })
    );
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";

    const moderationResponse = await exports.default.fetch(
      new Request(`https://event.test/api/admin/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          publisherName: "Prompt Pilots BKK",
          title: "Bangkok Builder Map",
          description: "Find the right collaborator at the meetup in seconds.",
          projectUrl: "https://example.com/builder-map",
          status: "accepted"
        })
      })
    );
    const galleryResponse = await exports.default.fetch("https://event.test/api/public/projects");
    const gallery = (await galleryResponse.json()) as {
      projects: Array<{
        id: string;
        publisherName: string;
        originalPrompt: string;
        screenshotUrl: string;
      }>;
    };

    expect(loginResponse.status).toBe(200);
    expect(cookie).toContain("event_admin=");
    expect(moderationResponse.status).toBe(200);
    expect(gallery.projects).toHaveLength(1);
    expect(gallery.projects[0]).toMatchObject({
      id: submission.id,
      publisherName: "Prompt Pilots BKK",
      originalPrompt: "Build a mobile-first map that helps meetup attendees find collaborators by skill."
    });

    const screenshotResponse = await exports.default.fetch(
      `https://event.test${gallery.projects[0].screenshotUrl}`
    );
    expect(screenshotResponse.status).toBe(200);
    expect(screenshotResponse.headers.get("content-type")).toBe("image/png");
  });

  it("enforces one vote per name and browser and publishes results only after voting closes", async () => {
    const form = new FormData();
    form.set("publisherName", "Prompt Pilots");
    form.set("title", "Bangkok Builder Map");
    form.set("description", "A fast map for finding people to build with at the meetup.");
    form.set("originalPrompt", "Build a mobile-first map that helps meetup attendees find collaborators by skill.");
    form.set("projectUrl", "https://example.com/builder-map");
    form.set("confirmed", "true");
    form.set(
      "screenshot",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "project.png", {
        type: "image/png"
      })
    );
    const submissionResponse = await exports.default.fetch(
      new Request("https://event.test/api/submissions", { method: "POST", body: form })
    );
    const submission = (await submissionResponse.json()) as { id: string };
    const loginResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" })
      })
    );
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    await exports.default.fetch(
      new Request(`https://event.test/api/admin/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          publisherName: "Prompt Pilots",
          title: "Bangkok Builder Map",
          description: "A fast map for finding people to build with at the meetup.",
          projectUrl: "https://example.com/builder-map",
          status: "accepted"
        })
      })
    );

    const openResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/state", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ submissionsOpen: false, votingOpen: true, resultsPublished: false })
      })
    );
    const voteRequest = (voterName: string, deviceCookie = "") =>
      new Request("https://event.test/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json", ...(deviceCookie ? { cookie: deviceCookie } : {}) },
        body: JSON.stringify({ voterName, submissionId: submission.id })
      });
    const voteResponse = await exports.default.fetch(voteRequest("Palm"));
    const voteCookie = voteResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    const repeatedNameResponse = await exports.default.fetch(voteRequest(" palm "));
    const repeatedBrowserResponse = await exports.default.fetch(voteRequest("Arut", voteCookie));
    const secondAttendeeResponse = await exports.default.fetch(voteRequest("Nina"));
    const hiddenResultsResponse = await exports.default.fetch("https://event.test/api/public/projects");
    const hiddenResults = (await hiddenResultsResponse.json()) as { projects: Array<Record<string, unknown>> };

    await exports.default.fetch(
      new Request("https://event.test/api/admin/state", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ submissionsOpen: false, votingOpen: false, resultsPublished: true })
      })
    );
    const publishedResponse = await exports.default.fetch("https://event.test/api/public/projects");
    const published = (await publishedResponse.json()) as {
      projects: Array<{ id: string; rank: number; voteCount: number }>;
    };

    expect(openResponse.status).toBe(200);
    expect(voteResponse.status).toBe(201);
    expect(voteCookie).toContain("meetup_vote_device=");
    expect(repeatedNameResponse.status).toBe(409);
    expect(repeatedBrowserResponse.status).toBe(409);
    expect(secondAttendeeResponse.status).toBe(201);
    expect(hiddenResults.projects[0]).not.toHaveProperty("voteCount");
    expect(published.projects[0]).toMatchObject({ id: submission.id, rank: 1, voteCount: 2 });
  });

  it("gives the organizer a complete review queue, screenshot replacement, and logout", async () => {
    const form = new FormData();
    form.set("publisherName", "Ship Happens");
    form.set("title", "Prompt Museum");
    form.set("description", "Browse the one-shot prompts created during the meetup.");
    form.set("originalPrompt", "Create a polished museum of one-shot prompts with accessible project cards.");
    form.set("projectUrl", "https://example.com/prompt-museum");
    form.set("confirmed", "true");
    form.set(
      "screenshot",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "project.png", {
        type: "image/png"
      })
    );
    const submissionResponse = await exports.default.fetch(
      new Request("https://event.test/api/submissions", { method: "POST", body: form })
    );
    const submission = (await submissionResponse.json()) as { id: string };
    const loginResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "test-admin-password" })
      })
    );
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
    const dashboardResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/dashboard", { headers: { cookie } })
    );
    const dashboard = (await dashboardResponse.json()) as {
      submissions: Array<{ id: string; status: string; originalPrompt: string }>;
      stats: { total: number; pending: number; votesCast: number };
    };
    const replacement = new FormData();
    replacement.set(
      "screenshot",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "replacement.jpg", { type: "image/jpeg" })
    );
    const replacementResponse = await exports.default.fetch(
      new Request(`https://event.test/api/admin/submissions/${submission.id}/screenshot`, {
        method: "POST",
        headers: { cookie },
        body: replacement
      })
    );
    const replacementBody = (await replacementResponse.json()) as { screenshotUrl: string };
    const removedCodesResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/voter-codes", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ count: 3 })
      })
    );
    const logoutResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/logout", { method: "POST", headers: { cookie } })
    );
    const afterLogoutResponse = await exports.default.fetch(
      new Request("https://event.test/api/admin/dashboard", {
        headers: { cookie: logoutResponse.headers.get("set-cookie")?.split(";")[0] ?? "" }
      })
    );

    expect(dashboardResponse.status).toBe(200);
    expect(dashboard.stats).toMatchObject({ total: 1, pending: 1, votesCast: 0 });
    expect(dashboard.submissions[0]).toMatchObject({
      id: submission.id,
      status: "pending",
      originalPrompt: "Create a polished museum of one-shot prompts with accessible project cards."
    });
    expect(replacementResponse.status).toBe(200);
    expect(replacementBody.screenshotUrl).toMatch(/^\/media\/submissions\/[0-9a-f-]{36}\.jpg$/u);
    expect(removedCodesResponse.status).toBe(404);
    expect(logoutResponse.status).toBe(200);
    expect(afterLogoutResponse.status).toBe(401);
  });
});
