# Public recruiter deployment

The included blueprint deploys a public demonstration with the frontend, real-time API and worker on Render, backed by MongoDB Atlas. A split Vercel frontend is also supported. Configure the accounts and secrets described below before publishing.

## Preserve the current stack

**Simplest option:** deploy the whole application on Render using the included blueprint, and connect MongoDB Atlas. `SERVE_FRONTEND=true` lets Express serve the production frontend and the embeddable widget alongside the API. Render supplies its public origin automatically, and the frontend uses same-origin requests. This option does not need Vercel access.

- Frontend: Vercel Hobby, using the existing Vite build and `vercel.json`.
- API and worker: the included Render free web-service blueprint (`render.yaml`). Both processes run inside one web service to avoid requiring a paid standalone background worker.
- Database: a separate MongoDB Atlas free cluster for fictional demo data.
- Queue: the blueprint includes a free Render Key Value instance, connected over the private network with public access disabled and `noeviction` configured for BullMQ. Render allows only one free Key Value instance per workspace; reuse or explicitly resolve an existing one instead of selecting a paid plan.
- Reminder mail: an SMTP account configured through host environment variables. Render free services block outbound SMTP ports 25, 465 and 587, so the blueprint uses port 2525; supply a provider supporting that port. Never put SMTP credentials in the frontend or repository.

Vercel has introduced native WebSocket support, including Socket.IO with WebSocket transport. Hosting the full backend there is also possible, but requires a serverless entry point, external cross-instance pub/sub, and a durable replacement for the continuously running BullMQ worker. The Render blueprint preserves the existing Express/BullMQ design instead.

Neon is a Postgres database. Using it for this MongoDB/Mongoose project would require an intentional database migration; it is not a drop-in server host.

## Public demo access

Set `DEMO_LOGIN_ENABLED=true` on the API and run the seed. This creates a dedicated agent account with a random, undisclosed password. `/api/auth/demo` issues an agent token only when this feature is enabled. It never issues an administrator token.

Set these Vercel build environment variables:

```text
VITE_API_URL=https://YOUR_API_HOST
VITE_PUBLIC_DEMO=true
```

The sign-in dialog then shows **Explore the live demo**, with no password or signup required. Staff login remains available separately. Set the API's `WEB_ORIGIN` to the exact public Vercel origin, then redeploy both sides after changing their environment.

The demo is a shared workspace. Use a separate database containing fictional data only. Recruiters can start a customer chat in another browser window, claim it from the inbox, exchange messages and resolve it.

## Free-tier behavior

Render free web services sleep after inactivity. The first visit may take time to wake up, and reminder work will also pause while the service sleeps. This does not provide an always-on worker guarantee. Confirm current provider limits before launch and use no paid plan without the owner's approval.

Free Render Key Value has no disk persistence, so queued reminders can be lost when it restarts. Conversation history stays in MongoDB Atlas. These limits are acceptable for a clearly labeled portfolio demonstration, but must not be described as production queue durability.

Provider references: [Render free instances](https://render.com/docs/free), [Render Blueprint reference](https://render.com/docs/blueprint-spec), [Vercel WebSockets](https://vercel.com/docs/functions/websockets).

## Release checklist

1. Connect Render and MongoDB Atlas. Restore Vercel team access only if choosing a separate Vercel frontend.
2. Provision only confirmed free resources; set secrets through the host dashboards or connected secret tools.
3. Deploy the API, seed the demo database, and verify `/api/health`.
4. With the combined Render blueprint, the frontend is already included and the demo-login flag is set. For a separate Vercel frontend, configure its public API origin and demo-login flag before deployment.
5. Open the public URL without Vercel login. Verify demo login, real chat in two windows, refresh persistence, reconnect recovery and resolution.
6. Test reminder emails separately and record any free-tier scheduling limitation.

Do not describe the memory-only design preview as a live backend demonstration.
