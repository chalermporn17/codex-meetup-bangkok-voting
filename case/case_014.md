# CASE-014: Result publication, ranking, and ties

## Purpose

Verify result visibility, final vote counts, ordering, rank calculation, tie handling, vote bars, and result hiding.

## Test information

| Field | Value |
| --- | --- |
| Priority | P0 |
| Type | Functional, calculation |
| Actor | Organizer, visitor |
| Destructive | Yes, creates votes and changes state |

## Preconditions

- Projects A, B, and C are accepted in that submission order.
- Voting is open and results are hidden.
- Create the following votes: A=3, B=1, C=1.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/gallery` before publication. | Accepted projects appear, but project vote counts and rank badges are absent. Results navigation is absent. |
| 2 | Open `/results` directly. | The app changes the route to `/gallery`. No private result details appear. |
| 3 | As organizer, close voting and select `Publish results`. | Event Control shows Public results Published. |
| 4 | Reload the public site. | A Results tab appears. The gallery heading changes to Results. Cards show vote counts and rank badges. |
| 5 | Open `/results`. | The page shows Final results, Ranking, one row for each accepted project, vote totals, participants, and progress bars. |
| 6 | Check order and ranks. | Project A is first with 3 votes and rank 1. Projects B and C each have 1 vote and rank 2. The next distinct score would use competition rank 4. |
| 7 | Check tie order. | B and C keep stable submission order when their vote counts are equal. |
| 8 | Check vote-bar values. | A uses the full width. B and C use one-third of the maximum. Each progressbar has correct min, max, current value, and accessible label. |
| 9 | Select each project title in the ranking. | The configured public project URL opens in a new tab. |
| 10 | Hide results. Reload public pages. | Results navigation disappears. Gallery no longer exposes per-project counts or ranks. `/results` returns to `/gallery`. |
| 11 | Publish results with accepted projects but zero votes. | Each project shows 0 votes. Tied projects use rank 1. Bars have zero width and valid accessibility values. |
| 12 | Publish results with no accepted projects in a clean environment. | Results page shows `No results` and does not fail. |

## Calculation rules

- Sort by vote count descending after publication.
- For equal vote counts, keep submission order, then stable identifier order.
- Use competition ranking: `1, 2, 2, 4`.
- Public vote counts and ranks must not be returned before publication.

## Automation notes

Seed deterministic submissions and votes through documented setup helpers or UI flows. Do not edit production data. Assert progressbar ARIA values in addition to CSS width.
