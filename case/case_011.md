# CASE-011: Duplicate vote and vote change

## Purpose

Verify one active vote per email and browser device. Verify the confirm, cancel, and successful vote-change paths.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional, concurrency rule |
| Actor | Voter, organizer |
| Destructive | Yes, moves votes |

## Preconditions

- Projects A and B are accepted.
- Voting is open.
- Voter A already voted for Project A in the current browser context.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Vote for Project A again with Voter A email. | A browser confirmation says that the user already voted and asks whether to change the vote to this project. |
| 2 | Select Cancel. | The dialog remains available or closes only through an explicit close action. The stored vote remains on Project A. Total votes remain 1. |
| 3 | Vote for Project B with Voter A email. At the change confirmation, select OK. | The button shows `Changing…`. The dialog closes. A `Vote changed.` toast appears. |
| 4 | Check organizer scores. | Project A decreases to 0. Project B increases to 1. Total votes remain 1. |
| 5 | Use a new clean browser context. Vote with the same Voter A email. Confirm the change. | The existing email vote moves to the selected project. No second vote is created. |
| 6 | In the original browser context, try a different listed email that has no prior email vote. | The device-level prior vote is detected. A change confirmation appears. |
| 7 | Confirm the device-level change. | The single existing vote moves and becomes associated with the entered email. Total remains 1. |
| 8 | Start two nearly simultaneous vote requests for the same email from two contexts. | At most one active vote exists. One request can succeed. The other must receive the duplicate/change response. |

## Required assertions

- A changed vote updates the existing record. It does not insert a second record.
- Cancelling the confirmation does not change any score.
- Email comparison is normalized for case and surrounding spaces.
- The live total counts active vote records, not the number of vote attempts.

## Automation notes

Register the confirmation-dialog handler before selecting Confirm vote. For the concurrency check, use two isolated pages and coordinate request release if the framework supports request routing.
