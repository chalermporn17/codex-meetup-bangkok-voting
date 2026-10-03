# CASE-006: Submission validation, duplicate email, and closed state

## Purpose

Verify field boundaries, screenshot checks, one-submission-per-email behavior, form-data retention after a server error, and the closed-submission view.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Negative, boundary |
| Actor | Participant, organizer |
| Destructive | Yes, creates test data |

## Preconditions

- Submissions are open.
- Whitelist validation is enabled.
- `builder.one@example.com` and `builder.two@example.com` are listed.
- Participant A already has one submission.

## Validation matrix

Submit each row with all other values valid.

| Input | Invalid value | Expected result |
| --- | --- | --- |
| Participant / team | 1 character | `Participant or team name must be 2–100 characters.` |
| Email | `not-an-email` | Browser validation blocks submit or the app shows `Enter a valid email address.` |
| Project title | 1 character | `Project title must be 2–120 characters.` |
| Description | 4 characters | `Description must be 5–200 characters.` |
| Complete original prompt | 19 characters | Browser validation blocks submit or the app shows `Complete prompt must be 20–20,000 characters.` |
| Public project link | `javascript:alert(1)` or a non-HTTP URL | `Enter a valid public project URL.` |
| Screenshot | Missing | Browser validation blocks submit or the app asks for a screenshot. |
| Screenshot | Empty, unsupported, or larger than 8 MB | `Screenshot must be a JPG, PNG, or WebP under 8 MB.` |
| Screenshot | PNG MIME type with non-PNG bytes | `Screenshot file does not match its image type.` |
| Confirmation | Not selected | Browser validation blocks submit or the app asks for confirmation. |
| Hidden Website field | Any non-empty value | `Submission could not be accepted.` |

## Duplicate and closed-state procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Fill the form with valid new project data but use `Builder.One@Example.com`. | The form is complete and the email differs only by case from an existing submission. |
| 2 | Submit the form. | The app shows the duplicate-submission warning and does not create a second record. |
| 3 | Inspect all entered fields. | Text, checkbox state, and selected screenshot remain available. The user can correct the email without re-entering the project. |
| 4 | Change only the email to `builder.two@example.com` and submit. | The submission succeeds once. |
| 5 | As organizer, close submissions. Open or reload `/submit`. | The form is not visible. `Submissions are closed` and a Gallery action are visible. |
| 6 | Try to send a submission request from a form that was open before the state changed. | The app shows `Submissions are closed.` No record or screenshot is created. |
| 7 | Reopen submissions. | The form becomes available again after reload or navigation. |

## Boundary confirmation

Also run successful checks at the exact accepted boundaries: team name 2 and 100 characters, title 2 and 120, description 5 and 200, and prompt 20 and 20,000.

## Automation notes

Use a direct request only for cases that browser constraints prevent. Keep at least one UI test for every visible error region. Check that errors are shown in the form and announced by the alert region.
