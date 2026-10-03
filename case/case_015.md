# CASE-015: Persistence, responsive layout, and accessibility smoke test

## Purpose

Verify that event data survives a normal Docker restart. Verify critical workflows at desktop and mobile sizes and perform a focused accessibility smoke test.

## Test information

| Field | Value |
| --- | --- |
| Priority | P1 |
| Type | Reliability, responsive UI, accessibility |
| Actor | Participant, voter, organizer |
| Destructive | Yes, test environment only |

## Preconditions

- Use the Docker Compose service with the named `voting-data` volume.
- Add a whitelist, one accepted project with screenshot, one vote, and a known event state.
- Record expected values before restart.

## Persistence procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Run `docker compose down`. | Containers stop. The named volume remains. |
| 2 | Run `docker compose up -d`. Wait for `/healthz`. | The service becomes healthy. Database migrations do not remove data. |
| 3 | Open public and organizer pages. | The whitelist, event state, submission data, screenshot, moderation status, and vote are unchanged. |
| 4 | Request the stored screenshot. | The image still loads with the correct content type. |
| 5 | Run `docker compose up --build -d` to simulate an application update. | The rebuilt service starts and preserves the same volume data. |
| 6 | Stop and start during SQLite WAL use only after writes finish. | The database opens without corruption and `/healthz` succeeds. |

Do not run `docker compose down -v` in this case. That command deletes the test database and screenshots.

## Responsive procedure

Run these checks at `1440 x 900`, `768 x 1024`, and `390 x 844`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open Home, Submit, Gallery, Results, Event Control, and both live views. | Content fits the viewport without unintended horizontal scrolling. |
| 2 | Complete submission and voting workflows at mobile size. | Fields, buttons, dialogs, preview image, and confirmation controls remain visible and usable. |
| 3 | Open long titles, descriptions, emails, and prompts. | Text wraps or scrolls inside its intended area. It does not cover controls. |
| 4 | Open the organizer controls and submission cards. | Actions remain reachable and labels do not overlap. |

## Accessibility smoke procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Use only Tab, Shift+Tab, Enter, Space, and Escape where supported. | All interactive actions can be reached and used in a logical order. Focus is visible. |
| 2 | Select `Skip to content`. | Focus moves to the main content area. |
| 3 | Open Prompt, Vote, and Edit dialogs. | Each dialog has an accessible heading and close control. Focus moves into the dialog and does not move to hidden page controls. |
| 4 | Trigger submission and voting errors. | Error content is in an alert or assertive live region and is readable by assistive technology. |
| 5 | Inspect images. | Content screenshots have descriptive alt text. Decorative brand images use empty alt text where appropriate. |
| 6 | Inspect current navigation and organizer filters. | Current links and selected tabs expose their state through ARIA attributes. |
| 7 | Check final result bars. | Each progressbar exposes label, minimum, maximum, and current values. |
| 8 | Run an automated accessibility scan on each main route. | There are no critical or serious violations. Review moderate findings manually. |

## Automation notes

Keep persistence tests serial because they control the shared Compose volume. Use a temporary Compose project name or isolated volume in CI. Use an accessibility engine such as axe only as a supplement to keyboard checks.
