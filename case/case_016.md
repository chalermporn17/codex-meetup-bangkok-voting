# CASE-016: iPhone Pro portrait UI

## Purpose

Verify that participant and organizer interfaces remain readable and usable on an iPhone Pro-sized portrait viewport.

## Test information

| Field | Value |
| --- | --- |
| Priority | P1 |
| Type | Responsive UI, mobile usability |
| Actor | Participant, voter, organizer |
| Destructive | No |
| Viewport | `393 x 852` CSS pixels |
| Device profile | iPhone 15 Pro-like portrait layout |

This case checks the Chromium layout at iPhone dimensions. It does not replace a test on physical iOS Safari.

## Preconditions

- Start the application at `http://localhost:3000`.
- Confirm that `/healthz` returns HTTP 200.
- Keep submissions open and voting closed.
- Keep one valid long-boundary submission in the organizer list.
- Sign in as the organizer before protected-route checks.

## Procedure

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Set the viewport to `393 x 852`. Open Home. | The document width is 393 pixels. Content uses the available width. There is no horizontal page scroll. |
| 2 | Use the mobile header links to open Submit and Gallery. | Each link works. Labels do not overlap or leave the viewport. |
| 3 | Inspect the Home hero, event statistics, workflow card, and footer. | Text remains readable. Cards fit the viewport. No content is cut off. |
| 4 | Open Submit and inspect each field, the screenshot control, confirmation control, and submit button. | Form controls fit within the form. Text areas can scroll vertically. The primary submit button is at least 44 pixels high. |
| 5 | Open Gallery and User manual. | Empty, card, instruction, and navigation layouts fit the viewport. |
| 6 | Open Event Control. Inspect statistics, state controls, whitelist, filters, and submission cards. | Sections stack without overlap. The document has no horizontal overflow. |
| 7 | Select each submission filter, including the last item in the filter row. | The filter row scrolls inside its own area when required. The selected tab exposes `aria-selected="true"`. |
| 8 | Inspect a 100-character team name, 120-character title, 200-character description, 254-character email, 2,000-character URL, and 20,000-character prompt. | Long unbroken text wraps or scrolls inside its intended control. It does not expand or clip the card, page, or dialog. |
| 9 | Open the maximum-length project in Gallery, Prompt, Vote, Results, Event Control, Edit submission, and Admin scoreboard. | Public cards, rankings, live-score rows, dialog headings, and dialog content remain within the viewport. |
| 10 | Open Edit submission. Scroll from the heading to the footer actions. | The dialog fits horizontally, scrolls vertically, and keeps all fields and actions reachable. |
| 11 | Open Admin scoreboard, Total-vote-only view, and Admin manual. | Each page fits the viewport. Score and navigation content remains readable. |
| 12 | Measure visible links and buttons. | Each mobile touch target is at least `44 x 44` CSS pixels or is inside a larger clickable label or card. |
| 13 | Inspect browser console errors after all routes. | The console contains no application errors. |

## Route coverage

- `/`
- `/submit`
- `/gallery`
- `/results`
- `/manual`
- `/admin`
- `/admin/live`
- `/admin/total-vote-only-view`
- `/admin/manual`

## Result record

Record these measurements for each run:

- Viewport width and height.
- Document client width and scroll width.
- Any element with unintended horizontal overflow.
- Form field, link, and button dimensions.
- Dialog client size and scroll size.
- Touch-target dimensions below 44 pixels.
- Long-content lengths and internal scroll widths.
- Console error count.
