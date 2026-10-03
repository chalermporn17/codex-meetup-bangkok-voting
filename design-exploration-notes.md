# Provisional design exploration

The first round compared five Game Boy-inspired galleries with a vote dialog. The user then shortlisted Pocket Town and Trainer Index and requested two variations of each alongside their originals: six choices, then a firm stop for selection. These remain alternatives, not an approved production design system. The original five-direction comparison is available through `?originals`. Impeccable seed 98eff838 assigned candidate five in round one; the user's explicitly pinned set overrides the random tournament.

## Skill roles

Impeccable governs the Operate gallery and dialog, accessibility, responsive behavior, and finish review. Design Taste governs the Persuade introduction and comparison composition; its marketing restrictions do not remove necessary repeated project entries. Motion Design contributes cause-and-effect movement language, not a commissioned film. Frontend Workflow coordinates the five examples. Ponytail full keeps the existing HTML/CSS/JS stack and native dialogs. Imagegen provides the original pixel-town raster.

## Direction contracts

### Pocket Town

THESIS: the meetup is a shared town square, with a real project gallery directly below it. OWN-WORLD: sage terrain, lavender pixel shadows in the original illustration, pale dialogue surfaces, dark green outlines, Silkscreen display with Manrope body. STORY: recognize the event, browse the six example builds, inspect a prompt, cast a vote. FIRST VIEWPORT: a left-hand invitation with 45-minute/one-prompt/one-vote facts beside a generous original town illustration; the gallery begins immediately below. FORM: approved candidate one, seed 98eff838 overridden by the explicit five-direction brief. Signature: stepped project marker and short dialogue entrance. Dials: variance 8, motion 5, density 4. FINISH: reviewed local prototype, documented provisional tokens, original raster provenance; user choice remains open.

### Classic LCD

THESIS: a usable landscape handheld, not a miniature emulator. OWN-WORLD: four olive roles within gray handheld casing; pixel headings, bevel-like display border, compact directory. STORY: choose from a readable list and review one project at a time. FIRST VIEWPORT: short event header above a large LCD, selector left and project preview right, decorative controls below. FORM: approved candidate two. Signature: stepped selection and short preview replacement. Dials: 6/4/5. FINISH: same review scope; no production direction selected.

### Yellow Cartridge

THESIS: every build is a collectible cartridge. OWN-WORLD: yellow paperboard, deep blue lettering, pale cartridge cases and original live-type packaging artwork. STORY: the event invitation leads into a complete shelf of six projects. FIRST VIEWPORT: large left-aligned invitation beside a tilted type-led game box; cartridge gallery below. FORM: approved candidate three. Signature: selected cartridge lifts 7px; confirmation settles in. Dials: 8/5/4. FINISH: same review scope.

### Clear Shell

THESIS: expose the work through a generous screen inside translucent hardware. OWN-WORLD: gray/green shell, smoky frame, acid-lime active controls, screws and connector traces as hardware detail. STORY: choose a project beside the large preview and take an explicit action. FIRST VIEWPORT: compact event title and facts above a two-column clear device, preview left and tactile directory right. FORM: approved candidate four. Signature: 200ms preview replacement and pressed controls. Dials: 7/5/4. FINISH: same review scope.

### Trainer Index

THESIS: the collection is a field guide to community projects. OWN-WORLD: brick-red clamshell casing, pale screen, muted green controls, functional list/detail hierarchy. STORY: select an entry, inspect its screenshot and prompt, then vote. FIRST VIEWPORT: compact heading above a hinged open device; directory left and selected-project screen right. FORM: approved candidate five. Signature: selection indicator and page-like preview replacement. Dials: 7/4/5. FINISH: same review scope.

## Shared interaction and accessibility

All directions use the same six working illustrative projects. Native `dialog` owns protected focus and Escape behavior. Pending requests are invalidated when the voting dialog closes. One normalized email owns one in-memory vote; replacement requires explicit confirmation. No scores are fabricated as live event results. Pixel type is reserved for display and compact metadata; forms and descriptions use Manrope. Motion lasts 150-200ms, and reduced motion removes transitions. Color variables use `light-dark()` with a system default and explicit preview override. Screenshots remain unfiltered in all themes.

## Provisional implementation tokens

Snapshot of `design-exploration/styles.css`, 2026-10-03. Each pair is light / dark. These values describe the five local alternatives; none is a selected production palette.

| Role | Pocket Town | Classic LCD | Yellow Cartridge | Clear Shell | Trainer Index |
| --- | --- | --- | --- | --- | --- |
| Page | `#eaf0dc / #1b2d25` | `#e4e4d9 / #1e251c` | `#f5d34f / #2b2a20` | `#e2e5e2 / #1e2424` | `#eee9d9 / #242b29` |
| Surface | `#f9f9ec / #2a4031` | `#d6e1b4 / #233b2b` | `#fff5c9 / #3b3a29` | `#f5f6ef / #2b3332` | `#f6f2dd / #293d36` |
| Text | `#243d30 / #edf0d8` | `#2d4229 / #d2e0a4` | `#243778 / #f3d768` | `#273c34 / #eef1e9` | `#293f36 / #f0ecd5` |
| Secondary text | `#526548 / #b7c5ad` | `#4d603d / #b6c493` | `#414b70 / #d6c690` | `#51635a / #b9c7bc` | `#54675a / #bac8b9` |
| Border | `#829572 / #66816b` | `#879867 / #698259` | `#ab943d / #8f8254` | `#9aaa9e / #677c70` | `#859784 / #6c8372` |
| Action / selection | `#365e43 / #d2e79d` | `#354e2e / #c6d990` | `#263b89 / #f2d560` | `#354d33 / #d0f468` | `#374e41 / #d7dfa5` |
| Text on action | `#fbfaee / #203224` | `#e3edc6 / #263b25` | `#fff5ce / #243373` | `#e1f89a / #263520` | `#f7f3df / #263a2d` |
| Quiet fill | `#e2e9d2 / #334733` | `#c1cd98 / #334d31` | `#e7c34c / #514a28` | `#d6ded2 / #3d4c40` | `#e2e5c9 / #3d5242` |

Shared typography is locally hosted Silkscreen Regular (`monospace` fallback) for pixel headings and Manrope 200–800 (`system-ui, sans-serif` fallback) for body and forms. Paragraph line-height is 1.65; prompt text is 13px/1.85. Mobile descriptions resolve to 14px. Display sizes vary by world rather than sharing a production scale.

The content width is capped at 1240px with 32px side margins, reducing to 16px below 767px. Intermediate adjustments start at 1050px. Three-column galleries and list/detail devices become single-column compositions on mobile. Shared primary buttons are square; project actions are 42px high on desktop and at least 44px on mobile. Dialogs are capped at 510px, with 38px padding (24px on mobile), square corners, and a `0 24px 80px #15251d55` shadow. Focus outlines are 3px with a 5px offset.

Distinct material values remain provisional: Pocket Town uses a 2px dialogue border and a 14px selection marker; Classic LCD uses a 9px display frame and a `12px 12px 48px 12px` casing radius; Yellow Cartridge uses `15px 15px 4px 4px` cases and a 7px selected lift; Clear Shell uses a 34px enclosure radius, 24px action radii, and fixed lime `#d0ed83` active controls; Trainer Index uses casing `#9f443a`, inherited casing text `#f8edce`, instruction text `#f4e4c7`, and an 8px inset screen frame.

Shared transitions last 150ms; dialog entry lasts 180ms in four steps; preview and selection motion lasts 200ms. The reduced-motion rule removes transitions and animations and restores automatic scrolling. Validation and limitations are recorded in [validation.md](design-exploration/validation.md).

## References actually inspected

- User images: Game Boy Color town, original olive handheld gameplay, yellow cartridge box art. These establish era, pixel clustering, landscape palette, and packaging scale. Their images are inspiration, not shipped assets.
- https://developers.openai.com/modretro : handheld framing and relationship between project selection and the game screen.
- https://21st.dev/@theorcdev/library/8bitcn : pixel-border and dialogue vocabulary; no component code copied, no package installed.
- https://play.studio/work/open-ai-dev : a coherent pixel-based event identity rather than incidental decoration.
- Taste Vault `castle.png`: crisp raster edges and quiet text space; `stillness-voxel.png`: landscape as an organizing visual. Neither supplies the palette, serif typography, or a shipped asset.
- Existing `public/index.html`, `public/app.js`, and `public/styles.css`, plus rendered home/gallery: incumbent navy/violet rounded system is replaced in prototypes only. Event identity, content truth, navigation meanings, and vote semantics are preserved.

## Round two: provisional family variations

The six-choice comparison pairs the unchanged Pocket Town and Trainer Index originals with four scoped extensions. The original stylesheet and original render branches are preserved; variations share the existing prompt and in-memory voting logic. Skill roles remain Impeccable for UX, Design Taste for composition, Motion Design for purposeful CSS motion, Frontend Workflow in iterate mode, and Ponytail full for implementation simplicity.

| Variation | Provisional contract |
| --- | --- |
| Town Square (`town-map`) | Sage town artwork becomes a clickable map of six builds beside a dialogue detail panel. Map labels reduce to numbered controls at tablet width; map and detail stack on mobile. Selection reveals the detail in four steps over 200ms. |
| Town Journal (`town-journal`) | Lavender and cream frame the reused town image and numbered journal rows. Each entry keeps its preview, description, prompt, and vote actions together; rows stack on mobile. |
| Field Console (`index-console`) | Brick-red casing holds one wide project display and six selector keys. Keys form three columns below 1050px and precede the display on mobile. Selection replaces the display with a 200ms movement of 5px. |
| Card Catalog (`index-catalog`) | A red field-guide header introduces all six project cards together. The grid moves from three to two to one column, keeping direct project actions visible. |

Changed token snapshot from `design-exploration/variants.css` (light / dark):

| Town Journal role | Value |
| --- | --- |
| Page / surface | `#ebe7ed / #292531`; `#fbf7eb / #38343f` |
| Text / secondary text | `#40384f / #f2e9da`; `#65596f / #cfc0d2` |
| Border / quiet fill | `#9e8ea5 / #88798c`; `#e3dbe7 / #4b4156` |
| Action / text on action | `#655371 / #d5c0e5`; `#fff9e9 / #322a3b` |

Town Square retains the Pocket Town palette; map controls use `#f9f5df` with `#2d4235` text, switching to `#365e43` with `#fffbe7` text when selected. Both Index variations retain the Trainer Index palette and `#9f443a` casing with `#f8edce` text. Field Console adds a `#69372f` screen surround and `#70352f` selector keys. Typography, dialog behavior, focus treatment, and reduced-motion support remain shared. New entry animations run only when reduced motion is not requested.

The [21st.dev 8bitcn reference](https://21st.dev/@theorcdev/library/8bitcn) was reconsulted for map, dialogue, quest-log, and selector grammar. No component code was copied and no dependency was added. No new raster artwork was generated; Town Square and Town Journal reuse the original town asset. The four extensions and the comparison passed independent finish review for local selection; detailed evidence is in [validation.md](design-exploration/validation.md).

## Selected direction — 2026-10-03

The user chose the original Pocket Town (`app.html?direction=town`). Its original split introduction and town illustration, sage palette, project-card gallery, and dialogue-style voting are the accepted visual baseline. The other alternatives remain available for reference; they are not selected.

This completes the selection checkpoint. No production routes, API contracts, backend, database, live records, or publishing changes have been made. Production integration and broader screens remain subsequent work.

## Pocket Town character motion — 2026-10-03

The user requested characters from their attached Pokémon references and motion within the selected original town. Four characters from the supplied sprite sheet now appear as CSS background windows over the original illustration: Pikachu and Eevee follow separate short routes with stepped footfall motion, Gengar floats, and Bulbasaur breathes gently. The composition, gallery, prompts, and voting stay intact. The supplied sheet is preserved at `design-exploration/assets/town-character-reference.png`; runtime contrast and multiply blending remove its paper backdrop without creating a replacement bitmap. Built-in sprite generation was attempted but rejected by the image tool; no generated sprite asset is used.

Motion is isolated to the illustration, uses native CSS transforms, and adds no dependency. A keyboard-accessible Pause town / Play town control preserves the user's pause across gallery renders. The scene pauses offscreen or while the document is hidden. Reduced-motion preference disables the decorative loops and labels the control Motion reduced. No production integration or publishing is included.


## Public frontend integration — 2026-10-03

The user approved applying the original Pocket Town to the real public site, with no deployment. `public/pocket-town.css` scopes its tokens and components to public routes; `public/app.js` uses existing APIs and renders real accepted projects on the landing page and gallery. Submission, voting, published results, and help share the selected palette and type. No added Pokémon characters or animation controls are present. The organizer theme is preserved. Verification and isolated-fixture screenshots are in `frontend-validation/`; sample records are not bundled into the production frontend.
