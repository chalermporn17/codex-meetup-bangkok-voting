# CASE-005: Successful project submission

## Purpose

Verify that a whitelisted participant can submit one valid project and that the project enters organizer review as pending.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional |
| Actor | Participant, organizer |
| Destructive | Yes, creates test data |

## Preconditions

- Submissions are open.
- Whitelist validation is enabled.
- `builder.one@example.com` is on the whitelist and has no prior submission.
- A valid PNG, JPEG, or WebP image smaller than 8 MB is available.

## Test data

| Field | Value |
| --- | --- |
| Participant / team | `Prompt Pilots` |
| Email | `builder.one@example.com` |
| Project title | `Bangkok Builder Map` |
| Description | `Find the right collaborator at the meetup in seconds.` |
| Complete original prompt | `Build a mobile-first tool that helps meetup attendees find collaborators by skill.` |
| Public project link | `https://example.com/builder-map` |
| Screenshot | Valid test image |

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/submit`. | The status is `Submissions open`. The full submission form is visible. |
| 2 | Enter the participant, email, title, description, prompt, and URL. | Each field accepts the value. The description counter matches the entered character count. |
| 3 | Select the screenshot. | An image preview replaces the upload instruction. |
| 4 | Select the challenge-rules confirmation. | The checkbox becomes selected. |
| 5 | Select `Submit project`. | The button shows `Submitting…` and does not allow a second click while the request is active. |
| 6 | Wait for the response. | The page shows `Project submitted` and says that organizer approval is required. A success toast appears. |
| 7 | Open `/gallery`. | The pending project is not visible. |
| 8 | Sign in as organizer and open the Pending filter. | The project appears once with the submitted title, participant, normalized email, description, time, screenshot, and project link. |
| 9 | Check the dashboard statistics. | Total and Pending each increased by one. Accepted and Rejected did not increase. |

## Postconditions

- One pending submission exists for `builder.one@example.com`.
- The uploaded screenshot is available to the organizer.
- No vote exists for the project.

## Automation notes

Use `setInputFiles` or its equivalent for the screenshot. Assert success from the page and from the organizer view. Do not depend only on the POST response.
