# Codex Meetup Bangkok Voting — engineer handoff

This bundle contains two source folders:

- `codex-meetup-voting`: Cloudflare Worker backend, public assets, D1 migrations, R2 screenshot storage, tests, and event guide.
- `codex-meetup-voting-sites`: ChatGPT Sites frontend. It keeps the same UI and forwards API and image requests to the deployed Worker.

## Local setup

Backend:

```sh
cd codex-meetup-voting
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

ChatGPT Sites frontend:

```sh
cd codex-meetup-voting-sites
npm install
npm run dev
```

Run `npm run check` in the backend and `npm run build` in the Sites frontend before deployment.

## Runtime services

- D1 stores submissions, event state, and votes.
- R2 stores project screenshots.
- `ADMIN_PASSWORD` and `SESSION_SECRET` are runtime secrets.
- The real `.dev.vars`, Cloudflare credentials, database contents, and uploaded screenshots are intentionally excluded from this bundle.

## Current URLs

- ChatGPT Sites: `https://codex-meetup-bangkok-voting.arut-md.chatgpt.site`
- Worker origin: `https://codex-meetup-bangkok-voting.gs5zbddkpy.workers.dev`

The Sites frontend currently uses the Worker origin defined in `codex-meetup-voting-sites/lib/proxy-upstream.ts`.
