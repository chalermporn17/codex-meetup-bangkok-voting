# CASE-001: Service startup and public route smoke test

## Purpose

Verify that the Docker service starts, the health check succeeds, and all public entry routes load the single-page application.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Smoke, deployment |
| Actor | Visitor |
| Destructive | No |

## Preconditions

- Docker and Docker Compose are available.
- `.env` contains a strong `ADMIN_PASSWORD` and a session secret of at least 32 characters.
- Port 3000 is available, or `PORT` specifies another available host port.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Run `docker compose up --build -d`. | The `voting` container starts and stays running. |
| 2 | Run `docker compose ps`. | The service becomes healthy after the health-check start period. |
| 3 | Open `/healthz`. | The response status is 200. The JSON body is `{ "status": "ok" }`. |
| 4 | Open `/`. | The page loads without a server error. The heading `Build once. Ship it.` is visible. |
| 5 | Open `/submit`. | The Submit page loads. It shows either the project form or the closed-submission message. |
| 6 | Open `/gallery`. | The Gallery page loads. It shows projects or `No projects yet`. |
| 7 | Open `/manual`. | The User manual page loads. |
| 8 | Open `/results` before results are published. | The application replaces the route with `/gallery`. The unpublished ranking is not visible. |
| 9 | Open an unknown UI route such as `/not-a-real-page`. | The application loads the home page without exposing a directory listing or server stack trace. |
| 10 | Check the browser console and Network panel. | There are no uncaught errors. Required CSS, JavaScript, SVG, PNG, and API requests succeed. |

## Additional checks

- Verify that HTML responses include `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a restrictive permissions policy.
- Verify that static content uses `Cache-Control: no-cache`.
- Verify that an unknown `/api/...` or `/media/...` path returns JSON status 404 and does not return `index.html`.

## Cleanup

Run `docker compose down`. Do not add `-v` unless the test environment data must be deleted.

## Automation notes

Wait for `/healthz` before browser navigation. Do not use a fixed startup delay. Capture container logs if startup or health checks fail.
