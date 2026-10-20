# Verification record

Verified on 20 October 2026.

**User story:** A visitor starts a website chat, an authenticated agent receives and owns the conversation, both exchange messages, and the agent resolves the request. MongoDB stores history; Redis/BullMQ delays reminders until the worker checks whether the customer still needs a reply.

| Boundary | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `npm run build` completed its strict `tsc --noEmit` check. |
| Production frontend | Passed | Vite production build completed; approximately 305 kB JavaScript / 95 kB gzip. |
| Automated checks | Passed | 2 Jest suites, 19 tests: API guards, credentials, assignment, duplicate messages, read-marker validation, reminder policy, real Socket.IO transport, restricted public demo access, and combined frontend/widget hosting. Database calls are mocked. |
| Local frontend server | Passed | HTTP 200 at the local preview URL. |
| Inbox UI | Passed in design preview | Reply submission, status filtering, customer search and selection behavior checked through the browser. |
| Team and widget UI | Passed in design preview | Team screen, installation instructions, customer conversation form and sent-message feedback checked. |
| Responsive layout | Passed | Desktop at 1440 × 900; mobile at 390 × 844, with document width 385 and no horizontal overflow. Message scrolling no longer moves the outer page. |
| MongoDB/Redis persistence | Passed on hosted demo | Atlas seeded successfully; API and worker started with managed Redis. A customer conversation and both message directions survived a browser reload. Queue delivery was not verified. |
| Worker/SMTP delivery | Not configured on hosted demo | Worker starts with Redis. Policy tests passed; SMTP credentials are not configured, so email delivery is not verified. |
| Docker image | Passed in GitHub Actions | Container build passed in the public repository CI. |
| Hosting | Live | https://supportdesk-api-wau7.onrender.com/ — Render reports live; password-free agent demo login, customer session creation, messages in both directions without refresh, read acknowledgement, assignment, resolution, and history reload verified in the browser. |

The preview is explicitly labeled and uses memory-only sample data. It is not evidence of a successful production database connection. See README for the local live-workspace walkthrough, deployment steps and documented reliability limits.
