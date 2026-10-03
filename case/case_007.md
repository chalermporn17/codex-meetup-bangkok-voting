# CASE-007: Submission moderation and public gallery

## Purpose

Verify Pending, Accepted, and Rejected review actions. Verify that only accepted projects appear in the public gallery.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional |
| Actor | Organizer, visitor |
| Destructive | Yes, changes moderation state |

## Preconditions

- Projects A and B exist as pending submissions.
- Sign in as organizer.
- Voting is closed and results are hidden.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open Event Control. | The Pending filter is selected. Both submissions appear. Counts show Total 2 and Pending 2. |
| 2 | Select `Accept` for Project A. | A success toast says the project was published to the gallery. Pending becomes 1 and Accepted becomes 1. |
| 3 | Open `/gallery` in a public context. | Project A appears. Project B does not appear. |
| 4 | Check Project A's card. | Screenshot, title, participant, description, project-open hint, and Prompt button are correct. There is no Vote button while voting is closed. |
| 5 | Select the Project A card. | The public project URL opens in a new tab with `noopener noreferrer` behavior. |
| 6 | Select `Prompt`. | A modal shows the exact original prompt and the Project A title. |
| 7 | Select `Copy prompt`. | The clipboard receives the exact prompt and the toast says `Prompt copied.` |
| 8 | Close the prompt with Done, the close icon, and a click on the dialog backdrop in separate runs. | Each supported action closes the dialog. |
| 9 | Return to organizer and select `Reject` for Project B. | Pending becomes 0 and Rejected becomes 1. Project B stays absent from the gallery. |
| 10 | Select each filter: Pending, Accepted, Rejected, and All. | Each filter shows the correct submissions and count. The selected chip has `aria-selected=true`. |
| 11 | Change Project B from Rejected to Accepted. | Project B appears in the Accepted filter and public gallery. |
| 12 | Change Project A from Accepted to Rejected. | Project A disappears from the public gallery after refresh. Existing Project B remains. |

## Ordering check

Before result publication, accepted projects use submission order. After result publication, CASE-014 verifies vote order.

## Automation notes

Use two browser contexts so that organizer cookies do not affect public assertions. For external-link checks, intercept the new page or inspect the link attributes instead of depending on `example.com` network access.
