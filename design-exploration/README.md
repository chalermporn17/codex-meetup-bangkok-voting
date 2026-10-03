# Game Boy frontend exploration

Six shortlisted local browser versions for Codex Community Meetup Bangkok #3: the original Pocket Town and Trainer Index, plus two variations of each. Open the comparison page and choose a version before any production integration. The original five-direction round remains available at `?originals`.

## Preview

From the repository root:

```sh
python3 -m http.server 4611 --bind 127.0.0.1 --directory design-exploration
```

Open http://127.0.0.1:4611/ . Each shortlisted version has a direct URL:

- `app.html?direction=town` — original Pocket Town
- `app.html?direction=town-map` — Town Square
- `app.html?direction=town-journal` — Town Journal
- `app.html?direction=index` — original Trainer Index
- `app.html?direction=index-console` — Field Console
- `app.html?direction=index-catalog` — Card Catalog

The original `lcd`, `yellow`, and `shell` URLs also remain available.

## Try it

- Select a project, open its working sample, or read and copy its prompt.
- Vote with a valid example email such as `builder@example.test`.
- Vote for another project with the same email to test the explicit vote-change confirmation.
- Use Preview controls for gallery states, vote errors, whitelist rejection, long titles, and light/dark appearance.
- Reset demo votes or reload to clear memory. No browser storage or production API is used.

The six projects are working illustrative demos authored for this exploration. Their thumbnails are browser screenshots of `demos.html`; they are not real participant submissions. Prices in the lunch demo are examples. All votes are simulated.

## Design boundaries

Plain HTML, CSS, and JavaScript. No dependencies or framework conversion. Nothing under `public/`, `src/`, or `migrations/` was modified. The static preview binds only to loopback and serves only this folder. No deployment is part of this work.

Screenshots are in `screenshots/`. Design rationale, references, and motion choices are in `../design-exploration-notes.md`. Font licenses and raster provenance are in `assets/`.
