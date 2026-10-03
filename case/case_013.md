# CASE-013: Organizer live views and vote reset

## Purpose

Verify detailed live scores, the total-vote-only view, three-second updates, authentication loss, and the destructive vote-reset flow.

## Test information

| Field | Value |
| --- | --- |
| Priority | P1 |
| Type | Functional, live update, destructive |
| Actor | Organizer, voter |
| Destructive | Yes, deletes votes |

## Preconditions

- Projects A and B are accepted.
- Voting is open.
- Sign in as organizer in one browser context.
- Keep a separate voter context ready.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/admin/live`. | Admin scoreboard shows Live score, current total, project ranks, participant names, and vote counts. |
| 2 | Open `/admin/total-vote-only-view` in another organizer page. | Only the large total and Back to admin action are visible. Project titles, participants, ranks, and per-project scores are absent. |
| 3 | Cast a vote for Project A from the voter context. | Within one refresh interval plus tolerance, both admin views update. Scoreboard shows Project A=1 and total=1. Total-only view shows 1. |
| 4 | Cast a second vote for Project B with another voter. | Both views update to total 2. Each project shows 1 vote. Equal scores use the same rank. |
| 5 | Close voting. | The scoreboard status changes to `Voting closed` with the final total. Stored scores remain visible. |
| 6 | Return to Event Control. | Votes cast is 2. Reset all votes is enabled. |
| 7 | Select `Reset all votes`, then cancel the confirmation. | No vote changes. The button remains enabled. |
| 8 | Select Reset all votes again and confirm. | The toast says `2 votes reset.` Votes cast becomes 0 and the button becomes disabled. |
| 9 | Reopen the live views or wait for refresh. | The total is 0. Each accepted project shows 0 votes. |
| 10 | Expire or remove the organizer session while a live view is open. | On the next refresh, protected score data is replaced by the organizer login view. |

## Privacy checks

- Live score responses and pages do not show voter email addresses.
- The total-vote-only view does not show project details.
- An unauthenticated user cannot retrieve `/api/admin/live-scores`.

## Automation notes

Use polling assertions with a timeout greater than three seconds. Do not wait a fixed three seconds and assume the refresh completed.
