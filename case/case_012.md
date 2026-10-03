# CASE-012: Voting validation and unavailable projects

## Purpose

Verify that only valid, permitted votes for accepted projects are recorded while voting is open.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Negative, security |
| Actor | Voter, organizer |
| Destructive | Yes, test votes only |

## Preconditions

- Project A is accepted.
- Project B is pending or rejected.
- Whitelist validation is enabled.
- `voter.one@example.com` is listed. `unlisted@example.com` is not listed.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Keep voting closed and attempt a direct vote for Project A. | The request is rejected with `Voting is closed.` No cookie or vote record is created. |
| 2 | Open voting. Open the Project A Vote dialog and enter an invalid email. | Browser validation blocks submit or the error region shows `Enter a valid email address.` |
| 3 | Enter `unlisted@example.com`. | The dialog stays open. The error region shows `This email is not on the voting whitelist. Contact the staff for help.` |
| 4 | Send a vote with a malformed project identifier. | The response is `Choose a valid project.` No vote is created. |
| 5 | Send a vote for a valid-format identifier that does not exist. | The response is `This project is not available for voting.` |
| 6 | Send a vote for pending or rejected Project B. | The response is `This project is not available for voting.` |
| 7 | Disable whitelist validation and vote with a new unlisted but valid email. | The vote succeeds because email access checks are disabled. |
| 8 | With validation disabled, try an invalid email. | The vote is still rejected. Disabling validation does not disable email format validation. |
| 9 | Re-enable validation. Remove Voter A from the whitelist after Voter A has voted. Try to change that vote. | The change is rejected because the email is no longer listed. The old vote remains unchanged. |
| 10 | Close voting while a Vote dialog is already open, then submit it. | The app shows `Voting is closed.` No new vote is recorded. |

## Content-type and request checks

- A non-JSON vote request returns `Use the voting form.`
- Malformed JSON returns `The voting form is invalid.`
- A non-Boolean `replaceExisting` value returns `The vote confirmation is invalid.`

## Automation notes

Use page requests for hidden identifiers and content-type cases. Use the browser UI for visible validation, modal focus, and inline error checks.
