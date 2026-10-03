# CASE-002: Public navigation and event-state labels

## Purpose

Verify public navigation, browser history, state labels, manuals, and visibility of the Results tab.

## Test information

| Field | Value |
| --- | --- |
| Priority | P1 |
| Type | Functional, UI |
| Actor | Visitor |
| Destructive | No |

## Preconditions

- The service is healthy.
- The initial state has submissions open, voting closed, and results hidden.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/`. | The status label is `Submissions open`. Submit project and Gallery actions are visible. |
| 2 | Select `Submit project`. | The URL becomes `/submit` without a full-page error. The Submit navigation item is current. |
| 3 | Select `Gallery`. | The URL becomes `/gallery`. The Gallery navigation item is current. |
| 4 | Select the browser Back button. | The application returns to `/submit` and restores the correct view. |
| 5 | Select the browser Forward button. | The application returns to `/gallery`. |
| 6 | Select `User manual` in the footer. | `/manual` opens and shows Submit, Vote, Results, and Contact staff instructions. |
| 7 | Close submissions from Event Control, then reload `/`. | The home status is `Under review`. |
| 8 | Open voting, then reload `/` and `/gallery`. | Both views show `Voting open`. The gallery shows the live vote total. |
| 9 | Confirm the main navigation before result publication. | There is no Results link. |
| 10 | Close voting and publish results. Reload the public page. | The status is `Results live`. A Results navigation link is visible. |
| 11 | Select Results. | `/results` shows `Final results` and `Ranking`. The Results link is current. |
| 12 | Hide results and directly open `/results`. | The application redirects to `/gallery`. The Results link is hidden. |

## Expected state mapping

| State | Public label |
| --- | --- |
| Results published | `Results live` |
| Voting open | `Voting open` |
| Submissions open | `Submissions open` |
| All three closed or hidden | `Under review` |

## Automation notes

Use accessible link names and headings. Assert both the URL and the visible page state after client-side navigation.
