# Local prototype validation

Recorded 2026-10-03. Both rounds use six labeled sample projects and in-memory voting. Final direction remains unselected; production implementation and publishing are deferred.

## First round

Scope: Pocket Town, Classic LCD, Yellow Cartridge, Clear Shell, and Trainer Index. These results are historical; the application tests were not rerun in round two.

| Check | Result / evidence |
| --- | --- |
| Existing application tests | 11 `npm test` checks passed. |
| Shared interaction regression | 17 checks passed; [interaction-checks.json](screenshots/interaction-checks.json), driven by `browser-check.mjs`. Covers email focus and validation, pending submission, normalization, one active vote, explicit replacement and cancellation, idempotency, prompt matching, Escape/focus restoration, failure recovery, closed voting, loading, empty state, and retry. |
| Responsive layouts | All 15 direction/viewport combinations passed at 1440, 834, and 390px; images loaded and document width matched viewport width. [responsive-checks.json](screenshots/responsive-checks.json). |
| Long titles | All five directions retained the long sample title without horizontal overflow at 320px. [narrow-checks.json](screenshots/narrow-checks.json). |
| Dark theme | All five directions passed at 1280px; `screenshots/*-dark.jpg`. |
| Independent finish review | Reviewer inspected 20 direction captures plus voting and comparison views, then verified the contrast correction in all four refreshed Trainer Index captures. Final disposition: ready to present all five local prototypes for selection. |
| Contrast correction | Casing changed to `#9f443a`: `#f8edce` text measures 5.35:1; `#f4e4c7` instruction text measures 4.99:1. All four refreshed Trainer Index captures verified legible. |
| Reduced motion | CSS inspected: animations/transitions are disabled and smooth scrolling is removed under `prefers-reduced-motion: reduce`. OS preference emulation was not performed. |
| Artwork delivery | Town artwork uses an approximately 386KB WebP; the approximately 2.5MB generated PNG and exact prompt remain preserved. See [asset provenance](assets/PROVENANCE.md). |

## Round two

Scope: Town Square, Town Journal, Field Console, and Card Catalog alongside the two shortlisted originals. Existing original styles and render branches are preserved.

| Check | Result / evidence |
| --- | --- |
| Interaction regression | 68 checks passed, 17 per variation, covering the shared prompt, voting, replacement, recovery, and gallery states. [round-two-interaction-checks.json](screenshots/round-two-interaction-checks.json). |
| Responsive layouts | All 12 variation/viewport combinations passed at 1440, 834, and 390px with no horizontal overflow and all images loaded. Four long-title cases at 320px and four confirmation checks also passed. [round-two-responsive-checks.json](screenshots/round-two-responsive-checks.json). |
| Dark theme | All four variations captured and reviewed at the user's actual 1163px browser width; `screenshots/*-dark.jpg`. |
| Comparison and archive | Six-choice comparison passed at 1440, 390, and the current 1163px width. The `?originals` archive retains five original choices with correct links. [Desktop capture](screenshots/round-two-comparison-desktop.jpg), [mobile capture](screenshots/round-two-comparison-mobile.jpg). |
| Independent finish review | Fresh review accepted all 16 required variation captures plus two comparison captures. Disposition: SHIP for local selection, with no material findings. |
| Contrast | Town Journal secondary text: 6.1:1 light / 7:1 dark; action text: 6.6:1 / 8.17:1. Index casing text: 5.35:1. Map control text: 7.12:1. |
| Source checks | Node syntax checks passed for app, overview, data, and browser-check modules. One detector run on the changed variations and overview returned no findings (`/tmp/gameboy-round-two-detect.json`). |
| Asset provenance | Scan covered 49 rasters with zero missing provenance records. The original town artwork is reused; no new raster artwork was generated. |
| Validation limits | Reduced-motion CSS was inspected; OS preference emulation was not performed. Production tests were not rerun this round; the 11 passing tests above belong to round one. No Lighthouse run. |

These checks validate local demonstration behavior, not live whitelist services, database persistence, production traffic, or a full accessibility certification. Simulated failures and votes do not contact production APIs. Performance scores are not claimed. User selection is required before a production design system, broader screens, or deployment work.

## Selected Pocket Town animation

2026-10-03: 11 dedicated motion checks and the 17 shared voting/prompt checks passed in the browser; see [town-motion-checks.json](screenshots/town-motion-checks.json) and runnable `browser-motion-check.mjs`. Checks cover four sprites, running animation, keyboard pause, held positions, pause persistence after rerender, resume, and automatic offscreen pause. Desktop 1440px, tablet 834px, and mobile 390px rendered without horizontal overflow; screenshots are `town-animated-*.jpg`. The document visibility handler and reduced-motion CSS/listener were inspected in source; OS reduced-motion emulation was not performed. The changed motion stylesheet's detector run found no issues. Production tests were not rerun for this isolated prototype animation.
