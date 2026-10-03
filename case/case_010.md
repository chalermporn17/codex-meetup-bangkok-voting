# CASE-010: First vote and live public total

## Purpose

Verify that a listed voter can cast one vote for an accepted project while voting is open. Verify public live-total behavior.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional |
| Actor | Voter, organizer |
| Destructive | Yes, creates a vote |

## Preconditions

- Projects A and B are accepted.
- `voter.one@example.com` is on the whitelist.
- Voting is open.
- Voter A has no vote and the browser context has no `meetup_vote_device` cookie.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/gallery`. | Both accepted projects appear. Each card has a Vote button. A live total shows 0 votes. Project vote counts and ranks are not public before result publication. |
| 2 | Select Vote on Project A. | The Vote dialog names Project A. The email field is empty and receives focus. |
| 3 | Select Cancel. | The dialog closes. No vote is created. |
| 4 | Open the Vote dialog again. Enter `Voter.One@Example.com` and select `Confirm vote`. | The button shows `Recording…`. The dialog closes after success. A `Vote recorded.` toast appears. |
| 5 | Inspect cookies. | A HttpOnly, SameSite=Strict `meetup_vote_device` cookie is set for Path=/. It has a 90-day maximum age. It is Secure when configured. |
| 6 | Observe the gallery total. | The total becomes 1 immediately or on the next refresh. It then refreshes every three seconds while voting remains open. |
| 7 | Reload the gallery. | The total remains 1. Vote buttons remain available while voting is open. |
| 8 | Open the organizer scoreboard. | Project A has 1 vote, Project B has 0, and total votes are 1. |
| 9 | Close voting and reload the gallery. | Vote buttons and the live-total badge disappear. Existing vote data remains stored. |

## Postconditions

- Voter A has one active vote for Project A.
- The browser has one vote-device cookie.

## Automation notes

Do not use an arbitrary sleep to check the first total update. Wait for the total text to become 1 with a timeout longer than the three-second refresh interval.
