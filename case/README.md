# End-to-end test suite

This directory contains manual test cases that are ready for automation with Playwright, Cypress, or another browser E2E tool.

## Test environment

- Base URL: `http://localhost:3000`
- Organizer URL: `http://localhost:3000/admin`
- Admin passphrase: use `ADMIN_PASSWORD` from the test environment
- Browser baseline: current Chromium
- Additional browser coverage: current Firefox and WebKit
- Desktop viewport: `1440 x 900`
- Mobile viewport: `393 x 852` for an iPhone 15 Pro-like portrait layout
- Time zone for displayed submission times: `Asia/Bangkok`

Start each destructive case with a clean test database unless the case says otherwise. Do not run destructive cases against event data.

## Standard test data

| Item | Value |
| --- | --- |
| Participant A | `Prompt Pilots` |
| Participant A email | `builder.one@example.com` |
| Participant B | `Bangkok Builders` |
| Participant B email | `builder.two@example.com` |
| Voter A email | `voter.one@example.com` |
| Voter B email | `voter.two@example.com` |
| Project A | `Bangkok Builder Map` |
| Project B | `Meetup Matchmaker` |
| Public URL A | `https://example.com/builder-map` |
| Public URL B | `https://example.com/meetup-matchmaker` |
| Valid prompt | `Build a mobile-first tool that helps meetup attendees find collaborators by skill.` |
| Valid description | `Find the right collaborator at the meetup in seconds.` |
| Valid image | A small PNG, JPEG, or WebP file with a valid file signature |

Use unique email addresses when a case does not reset the database.

## Execution order

| Case | Title | Priority |
| --- | --- | --- |
| [case_001](case_001.md) | Service startup and public route smoke test | P0 |
| [case_002](case_002.md) | Public navigation and event-state labels | P1 |
| [case_003](case_003.md) | Organizer authentication and protected pages | P0 |
| [case_004](case_004.md) | Email whitelist management and validation switch | P0 |
| [case_005](case_005.md) | Successful project submission | P0 |
| [case_006](case_006.md) | Submission validation, duplicate email, and closed state | P0 |
| [case_007](case_007.md) | Submission moderation and public gallery | P0 |
| [case_008](case_008.md) | Edit, screenshot replacement, and submission removal | P1 |
| [case_009](case_009.md) | Event lifecycle controls and transition rules | P0 |
| [case_010](case_010.md) | First vote and live public total | P0 |
| [case_011](case_011.md) | Duplicate vote and vote change | P0 |
| [case_012](case_012.md) | Voting validation and unavailable projects | P0 |
| [case_013](case_013.md) | Organizer live views and vote reset | P1 |
| [case_014](case_014.md) | Result publication, ranking, and ties | P0 |
| [case_015](case_015.md) | Persistence, responsive layout, and accessibility smoke test | P1 |
| [case_016](case_016.md) | iPhone Pro portrait UI | P1 |

## Result record

Record these items for each run:

- Build or commit identifier.
- Test environment and browser version.
- Start and end time.
- Result: `Passed`, `Failed`, `Blocked`, or `Not run`.
- Screenshot or video for each failure.
- Console error and failed network request details.
- Defect link, if applicable.

The test passes only when every required expected result is true.
