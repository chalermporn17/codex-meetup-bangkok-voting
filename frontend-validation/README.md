# Pocket Town public frontend validation

Verified locally on 2026-10-03. Nothing was deployed.

## Scope

The selected original Pocket Town design is integrated into the real public application: landing page with accepted projects, gallery, submission form, published results, user manual, prompt dialog, and vote dialog. The deployable files are under `public/`; no prototype toolbar, comparison routes, simulated vote store, sample records, or added Pokémon characters are included there. The organizer theme remains unchanged.

`public/pocket-town.css` is scoped to public routes and uses self-hosted Manrope and Silkscreen fonts plus the approved town illustration. Font licenses and illustration provenance accompany the assets. The only server change adds the correct font MIME type. The existing API routes, database contracts, whitelist rules, vote replacement confirmation, and unpublished-score restrictions are preserved.

## Checks

- `npm test`: 11/11 integration tests passed, including submission/moderation/voting/results, whitelist handling, organizer access protection, and delivery of the new stylesheet, image, and fonts.
- `node --check public/app.js` and `node --check src/app.js`: passed.
- `browser-checks.json`: 21 passed browser checks using the real application and an isolated temporary SQLite database.
- Desktop 1440px and mobile 390px: landing and submission pages fit without horizontal overflow; mobile form text is 16px.
- Narrow 320px: published ranking and gallery fit long unbroken titles, Thai text, emoji, and long author names.
- Prompt Escape restores focus; voting whitelist errors retain entered text and focus the error; valid vote succeeds; replacement can be cancelled or confirmed.
- Submission upload replacement shows one preview; submission success receives focus; pending projects remain outside the public gallery.
- Live event closure removes vote actions and closes the vote dialog. Closed submissions have a readable explanation.
- Connection failure shows an actionable retry; retry recovers after service restoration.
- Missing screenshots display a text fallback without a broken-image element.
- Public help remains usable on mobile; organizer login retains its existing theme.
- `contrast.json`: 12 main text/surface, button, and error combinations pass 4.5:1 in both light and dark palettes; minimum tested ratio is 5.08:1.

## Limits and preview data

The browser used the system dark theme; light-mode colors were checked mathematically, not through OS theme emulation. Reduced-motion CSS was inspected, not tested with an OS preference toggle. No screen-reader session, Safari/Firefox/device matrix, load test, or deployment check was performed. No production database, environment settings, or live votes were touched.

Screenshots show six temporary fixture projects, one test vote, and deliberately extreme data where the filename says `long` or `results`. Those fixture records are not shipped. The local preview is at http://127.0.0.1:4612/ and is not accessible to other people over the internet. The original comparison/demo remains on port 4611.
