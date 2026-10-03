# CASE-004: Email whitelist management and validation switch

## Purpose

Verify single-email and bulk whitelist operations. Verify that the validation switch controls both submission and voting access without deleting the saved list.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional |
| Actor | Organizer, participant, voter |
| Destructive | Yes, test data only |

## Preconditions

- Sign in as organizer.
- Use a clean database.
- Keep whitelist validation enabled.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Locate Email whitelist. | The list is empty and shows `No email addresses are saved in the whitelist.` |
| 2 | Add `Builder.One@Example.com`. | The toast confirms the add. The list stores and shows `builder.one@example.com`. The count is 1. |
| 3 | Try to add the same email with different capitalization and spaces. | The UI reports that the email is already on the whitelist. No duplicate appears. |
| 4 | Add participant B and both voter emails. | Four unique, normalized email addresses appear in sorted order. |
| 5 | Open Bulk edit. Enter addresses separated by spaces, commas, semicolons, and new lines. Include a duplicate. Select Replace whitelist. | Separators are accepted. Duplicates are removed. Addresses are lowercased, sorted, and the complete old list is replaced. |
| 6 | Put an invalid address in Bulk edit and save. | The toast shows `One or more email addresses are invalid.` The previously saved list remains unchanged. |
| 7 | Remove one address with its Remove button. | The address disappears and the count decreases by one. |
| 8 | With validation enabled, submit with an unlisted valid email. | Submission is rejected with `This email is not on the submission whitelist. Contact the staff for help.` |
| 9 | Select `Disable validation`. | The control shows Disabled. The page says that any valid email can submit and vote. The saved list remains visible. |
| 10 | Submit a valid project with an unlisted email. | The submission succeeds. |
| 11 | Accept the project and open voting. Vote with another unlisted valid email. | The vote succeeds. |
| 12 | Select `Enable validation`. | The saved whitelist returns to active use and has not changed. |
| 13 | Vote with a new unlisted email. | The vote is rejected with the voting whitelist message. |

## Boundary checks

- The whitelist accepts at most 5,000 input items.
- Replacing the list with no emails creates an empty saved list.
- An empty list with validation enabled blocks all new submissions and votes.

## Cleanup

Reset the test database or replace the whitelist with the standard test addresses.

## Automation notes

After each save, wait for the dashboard reload. Do not only check the toast. Check the visible normalized list and count.
