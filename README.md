# SupportDesk

A shared inbox and embeddable customer chat, built with React, TypeScript, Express, Socket.IO, MongoDB and BullMQ. The visual direction is quiet and editorial: warm neutrals, forest green, serif headings and a compact three-column inbox.

## Start here

Requires Node.js 22 and Docker Desktop with its Linux engine running.

```powershell
npm ci
Copy-Item .env.example .env
# Replace JWT_SECRET and SEED_ADMIN_PASSWORD in .env before starting.
docker compose up -d --build
docker compose exec api npm run seed
npm run dev:web
```

Open **http://127.0.0.1:5173**. Choose **Sign in to live workspace**, then use `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env`. Seeded secondary agents have random passwords; create your own teammates to test multiple accounts. The seed is repeatable and never overwrites existing passwords or conversations.

The frontend opens in a **labeled design preview** when no staff token is present. Preview data is in memory and resets on refresh. Preview agent creation is intentionally disabled. Sign in to use the actual API and persistent records.

For frontend-only review, `npm ci` followed by `npm run dev:web` is enough. Docker is not needed for preview mode.

### Run the API outside Docker

```powershell
docker compose up -d mongo redis mail
npm run seed
npm run dev
# A separate terminal:
npm run worker
```

Mailpit captures development reminder emails at **http://127.0.0.1:8025**. The default reminder delay is five minutes. Set `REMINDER_DELAY_MS=15000` for a quick demonstration, then restart the API. Inspect retained BullMQ failures in the `unanswered` queue using your preferred Redis/BullMQ tooling.

## Demonstrate the complete flow

1. Sign in as the seeded administrator. Create another agent under Teammates if desired.
2. Open `/widget` in a separate browser window. Start a conversation with a name, email and subject, then send a message. Customer sessions use session storage; an independent browser profile provides another customer identity.
3. In the staff inbox, choose the new conversation, assign it to yourself and reply. Watch the customer window receive the reply without refreshing.
4. Type in either window to see temporary typing indicators on the other side. Reading a staff reply in the customer window updates the staff read state.
5. Set Pending, then send a customer message. The conversation reopens. Resolve it after replying.
6. Disconnect the network briefly. A failed send exposes Retry; retry preserves the same client ID. Reconnection fetches missed messages through the REST cursor API.
7. Leave a new customer message unanswered for the configured delay. Check Mailpit. Answer before the delay to see the worker skip the reminder.

Use **Chat widget → Copy embed code** to embed the launcher on another website. The launcher uses a shadow root and an iframe, keeping host page styles separate. The iframe runs on the frontend origin; API CORS permits that frontend, rather than every embedding website.

## Structure

```text
src/                 React inbox, team management and customer widget
public/widget.js     Dependency-free embed launcher
server/app.ts        Validated REST routes and consistent errors
server/auth.ts       JWT issuance, session verification and access checks
server/models.ts     MongoDB schemas and indexes
server/messaging.ts  Durable messages, idempotency and inbox updates
server/sockets.ts    Authenticated rooms, messages and typing
server/queue.ts      Delayed BullMQ reminder scheduling
server/worker.ts     Reminder processing and SMTP delivery
server/seed.ts       Repeatable local seed
tests/               API tests, socket transport tests and reminder policy tests
compose.yml          API, worker, MongoDB, Redis and development mail
.github/workflows/   Tests, TypeScript/frontend build and Docker build
```

## Engineering decisions

- A customer JWT binds a customer ID to one conversation ID. Staff membership is checked against the database on REST requests and socket events. All active agents can access the single business inbox; assignment records responsibility rather than changing access rights.
- Passwords are hashed with bcrypt. Only administrators create or deactivate accounts. Authentication failures use a generic response; login and customer-session creation are rate limited. The UI stores tokens in session storage, reducing persistence across browser sessions, but XSS would still expose them. A larger deployment should assess cookie-based staff sessions and CSRF protection.
- Messages live in their own collection. A unique `(conversation, senderId, clientId)` index makes retries idempotent. Message persistence precedes success acknowledgement. Monotonic conversation metadata updates can be repeated after a partially failed attempt.
- REST is the durable read/write path used by the UI; Socket.IO broadcasts new messages and inbox changes. A `message:send` event offers the same validated write path for other clients. Reconnect recovery uses an ascending ObjectId cursor, in batches of 50; history pagination goes backward. Clients merge by client-generated ID.
- Read markers are durable and advance monotonically. Typing expires in the browser after 2.5 seconds and is throttled at the socket server. Read indicators update live; the UI does not currently restore prior read indicators after a browser refresh.
- The inbox is paginated by immutable creation ID so that updates cannot move rows between pages. It is shown newest-created first. Customer and subject search escape regular expressions; message search uses MongoDB's text index. For larger datasets, replace the bounded customer lookup and message-ID search with Atlas Search or an aggregation pipeline.
- Each customer message schedules a delayed job with a stable job ID. Before sending, the worker rechecks status and whether the message remains the newest unanswered customer message. Exponential retry and retained failed jobs support operational inspection. Notification records skip jobs already marked sent.
- SMTP cannot guarantee exactly-once delivery if a worker dies after sending but before recording success. A deterministic Message-ID helps mail infrastructure deduplicate where supported. Queue scheduling also has no transactional MongoDB outbox yet: retrying a failed send repairs queue scheduling, but a crash with no retry could miss a reminder. These are documented limits rather than exactly-once claims.
- This is a single-business implementation. It does not claim multitenant isolation, attachments, outbound email conversations, password reset, invitation email, full audit logging or production monitoring.

## Validation

```powershell
npm run build
npm test
docker build -t supportdesk:local .
```

Jest and Supertest cover credentials, route guards, customer isolation, assignment validation, successful assignment, read-marker validation, duplicate message handling and reminder policy. Socket tests run a real local Socket.IO server/client pair for authorization, room access, message acknowledgement, duplicate handling and reconnection. Database methods are mocked in these tests; they do not replace a full MongoDB/Redis end-to-end run. Follow the demonstration above to validate persistence and mail against the Compose services.

## Deploy

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the free-hosting blueprint, one-click recruiter demo access and deployment instructions.

The frontend can be built as a Vite static site on Vercel. Set `VITE_API_URL` to the HTTPS origin of the deployed API with no trailing slash, then rebuild. `vercel.json` supplies the widget route fallback. Socket.IO connects directly to the persistent API host; it is not hosted as a Vercel function.

Deploy the API and worker as separate persistent processes from the included Dockerfile, using `npm start` and `npm run worker`. Supply managed MongoDB and Redis URLs, a strong JWT secret, production SMTP settings and `WEB_ORIGIN` equal to the frontend HTTPS origin. Configure the API host for WebSocket upgrades. Keep MongoDB and Redis private; Compose host ports are loopback-only for local development. If using a reverse proxy, configure Express proxy trust for that specific infrastructure before relying on per-client rate limits.

No deployment has been created automatically, and the repository contains no production credentials.
