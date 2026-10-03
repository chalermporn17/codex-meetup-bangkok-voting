# Codex Meetup Voting — Docker deployment

This project combines the event voting backend and the Sites frontend into one service.

The service uses these local resources:

- A SQLite database at `/app/data/voting.sqlite`.
- Screenshot files under `/app/data/uploads/submissions`.
- A Docker named volume named `voting-data` for persistent data.

The service does not use Cloudflare Workers, D1, R2, or the Sites proxy.

## Start the service

1. Create the environment file:

   ```sh
   cp .env.example .env
   ```

2. Set a strong `ADMIN_PASSWORD` in `.env`.

3. Generate and set `SESSION_SECRET`:

   ```sh
   openssl rand -hex 32
   ```

4. Build and start the service:

   ```sh
   docker compose up --build -d
   ```

5. Open these pages:

   - Public site: <http://localhost:3000>
   - User manual: <http://localhost:3000/manual>
   - Organizer page: <http://localhost:3000/admin>
   - Admin manual: <http://localhost:3000/admin/manual>
   - Organizer live score: <http://localhost:3000/admin/live>
   - Organizer total-vote-only view: <http://localhost:3000/admin/total-vote-only-view>
   - Health check: <http://localhost:3000/healthz>

6. Sign in to the organizer page and configure email access.

Email whitelist validation is enabled by default. When validation is enabled, the service accepts one project submission for each whitelisted email address. Audience voting uses the same whitelist.

The organizer can disable whitelist validation from the Event Control page. When validation is disabled, any valid email address can submit and vote. The saved whitelist remains visible and editable. Each email can still submit once and have one active vote.

The organizer can add or remove one email at a time. The organizer can also replace the complete whitelist with the bulk editor. A voter can select another project and confirm a vote change.

The organizer page links to two live views. **Total-vote-only view** shows one large total with no project details. **Admin scoreboard** shows the detailed project scores on a separate page. The Event Control page does not show score details. Both views refresh every three seconds. The public gallery shows a small live total while voting is open. The **Reset all votes** action permanently removes all recorded votes after confirmation.

The public navigation shows a **Results** tab after the organizer publishes the results. This page shows the final project ranking with vote bars. The tab stays hidden before publication.

Use `docker compose logs -f voting` to view service logs.

## Cloudflare Tunnel profile

The optional `tunnel` profile runs `cloudflared` for a remotely managed Cloudflare Tunnel.

1. Create the tunnel and its public hostname in Cloudflare.
2. Set the tunnel origin service to `http://voting:3000`.
3. Add the tunnel token to `.env`:

   ```dotenv
   TUNNEL_TOKEN=your-cloudflare-tunnel-token
   ```

4. Set `COOKIE_SECURE=true` because the public hostname uses HTTPS.
5. Start the application and tunnel:

   ```sh
   docker compose --profile tunnel up --build -d
   ```

The tunnel container requires a non-empty `TUNNEL_TOKEN`. If the token is missing or invalid, `cloudflared` stops and reports the error in its logs.

View the tunnel logs:

```sh
docker compose --profile tunnel logs -f tunnel
```

The token is passed through the container environment. It is not included in the `cloudflared` command.

## Stop or update the service

Stop the service and keep all data:

```sh
docker compose down
```

Rebuild the service after a source update:

```sh
docker compose up --build -d
```

The service applies new database migrations automatically when it starts. Existing submissions and email whitelist settings remain available after migrations.

Do not use `docker compose down -v` unless you intend to delete the SQLite database and all screenshots.

## HTTPS deployment

Place a reverse proxy in front of port 3000 when the service is available on the internet.

Set `COOKIE_SECURE=true` when users access the public URL through HTTPS. Keep it `false` for direct local HTTP access.

## Back up local data

The `voting-data` volume contains the SQLite database and all screenshots. Stop writes before you copy the volume data. You can stop the service with `docker compose down`, or close submissions and voting from the organizer page.

The SQLite database uses write-ahead logging. Copy the complete `/app/data` directory so the backup includes the database, WAL file, and screenshots.

## Run tests

Build the image, then run the integration tests:

```sh
docker build -t codex-meetup-voting-test .
docker run --rm codex-meetup-voting-test npm test
```

The tests use temporary directories. They do not write to the deployment volume.

## Existing Cloudflare data

This source bundle does not include live D1 records or R2 screenshots. The Docker service starts with an empty local database. Export and import the live Cloudflare data separately if you must preserve it.
