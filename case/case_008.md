# CASE-008: Edit, screenshot replacement, and submission removal

## Purpose

Verify organizer editing, screenshot replacement, duplicate email protection, and complete removal of a submission and its votes.

## Test information

| Field | Value |
| --- | --- |
| Priority | P1 |
| Type | Functional, destructive |
| Actor | Organizer, visitor |
| Destructive | Yes |

## Preconditions

- Projects A and B exist with different participant emails.
- Project A is accepted and has at least one vote.
- A replacement image with a different visible design and valid signature is available.
- Sign in as organizer.

## Edit procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Select `Edit` for Project A. | The Edit submission dialog opens with current values. Original prompt is visible and read-only. |
| 2 | Change participant, email, title, description, public URL, and status. Select a replacement image. | The selected values remain in the dialog until save. |
| 3 | Select `Save submission`. | The button shows `Saving…`. The dialog closes. A `Submission saved.` toast appears. |
| 4 | Reopen the submission and check the card. | All editable values and the status are updated. The original prompt did not change. |
| 5 | Open the gallery when the saved status is Accepted. | Updated text, link, and replacement screenshot appear. The old screenshot URL is no longer used. |
| 6 | Try to change Project A email to Project B email. | The duplicate-submission warning appears. Project A keeps its prior email. |
| 7 | Try invalid text lengths, invalid email, invalid URL, invalid image type, and a signature mismatch. | Each save is rejected with the applicable validation message. Valid stored data remains unchanged. |

## Removal procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Select `Remove` for Project A. | A confirmation names the project and warns that votes and the screenshot will also be removed. |
| 2 | Select Cancel. | The submission, screenshot, and vote remain. Statistics do not change. |
| 3 | Select Remove again and confirm. | A `Submission removed.` toast appears. The submission disappears from all organizer filters. |
| 4 | Reload the public gallery. | Project A is absent. |
| 5 | Check organizer vote totals and scores. | Votes for Project A were deleted. Other project votes remain. |
| 6 | Request the removed screenshot URL. | The response is 404. |
| 7 | Submit a new project with the removed participant email while access rules allow it. | The email can be used again because the old submission no longer exists. |

## Automation notes

Capture the old media URL before replacement and before removal. Verify actual media responses, not only image elements.
