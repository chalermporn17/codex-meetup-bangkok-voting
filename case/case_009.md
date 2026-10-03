# CASE-009: Event lifecycle controls and transition rules

## Purpose

Verify the organizer controls for submissions, voting, public results, and whitelist validation. Verify required lifecycle rules.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional, state transition |
| Actor | Organizer |
| Destructive | Yes, changes event state |

## Preconditions

- Sign in as organizer.
- Start with submissions open, voting closed, and results hidden.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Check all four control cards. | Each card shows its current state and the correct inverse action. |
| 2 | With no accepted projects, select `Open voting`. | The app shows `Accept at least one project before opening voting.` State does not change. |
| 3 | Create and accept Project A. Select `Open voting`. | Voting opens. Submissions close automatically. Results stay hidden. |
| 4 | Open `/submit` in a public context. | The closed-submission message appears. |
| 5 | Check the Public results control. | The Publish results action is disabled and the card says `Close voting first.` |
| 6 | Try to publish results while voting is open by sending the same event-control request. | The server returns `Close voting before publishing results.` Results remain hidden. |
| 7 | Select `Close voting`. | Voting closes. The Publish results action becomes enabled. |
| 8 | Select `Publish results`. | Public results become Published. The public Results link and ranking become visible. |
| 9 | Select `Open voting` again. | Voting opens, submissions close, and published results become hidden automatically. |
| 10 | Close voting, then select `Open submissions`. | Submissions open. Voting remains closed. |
| 11 | Publish and then select `Hide results`. | The public Results link disappears. Direct `/results` navigation returns to the gallery. |
| 12 | Toggle whitelist validation off and on. | Only the access-validation state changes. The saved whitelist remains present. |
| 13 | Reload Event Control after every transition. | The state is durable and matches the action result. |

## State invariants

- Opening voting requires at least one accepted project.
- Opening voting always closes submissions.
- Opening voting always hides published results.
- Results cannot be published while voting is open.
- Disabling whitelist validation does not clear the whitelist.

## Automation notes

Model the event state explicitly in setup and cleanup. Do not depend on the result of a previous case unless the suite uses a documented serial project.
