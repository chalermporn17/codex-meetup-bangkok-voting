# CASE-003: Organizer authentication and protected pages

## Purpose

Verify organizer sign-in, sign-out, session use, and protection of organizer data and pages.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional, security |
| Actor | Organizer |
| Destructive | No |

## Preconditions

- The service uses a known test `ADMIN_PASSWORD`.
- Start with a browser context that has no cookies.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/admin`. | The organizer login form is visible. Event Control data is not visible. |
| 2 | Enter an incorrect passphrase and select `Sign in`. | The page shows `Incorrect admin passphrase.` The dashboard does not load. |
| 3 | Enter the correct passphrase and select `Sign in`. | Event Control loads with statistics, controls, whitelist management, and submission review. |
| 4 | Reload `/admin`. | The session remains authenticated. The login form does not appear. |
| 5 | Open `/admin/manual`. | The protected admin manual loads. |
| 6 | Open `/admin/live`. | The protected Admin scoreboard loads. |
| 7 | Open `/admin/total-vote-only-view`. | The protected Total votes view loads. |
| 8 | Inspect the organizer session cookie. | `event_admin` is HttpOnly, SameSite=Strict, Path=/, and has a 12-hour maximum age. It is Secure when `COOKIE_SECURE=true`. |
| 9 | Select `Log out`. | The login form appears and the organizer cookie expires. |
| 10 | Use browser Back, then open `/admin` again. | Protected data does not reappear. The login form remains visible. |
| 11 | In a clean unauthenticated context, request `/api/admin/dashboard` and `/api/admin/live-scores`. | Each request returns 401 with `Admin login required.` |

## Negative checks

- Submit blank JSON, malformed JSON, or a non-JSON request to the login endpoint. The server must not authenticate the request.
- Modify one character in the organizer cookie. The session must become unauthenticated.
- Do not record the real passphrase, session secret, or complete session cookie in test evidence.

## Automation notes

Create separate browser contexts for authenticated and unauthenticated checks. Save authenticated storage state only in a temporary test output directory.
