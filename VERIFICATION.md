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
| MongoDB/Redis persistence | Not verified here | Docker engine was unavailable. Docker Desktop could not start because its required installation registry key was missing. |
| Worker/SMTP delivery | Not verified here | Needs the Compose services. Policy tests passed; actual mail delivery needs the local walkthrough. |
| Docker image | Not built here | Requires a working Docker engine. CI includes a Docker build check. |
| Hosting | Not deployed | Deployment configuration and instructions are included. |

The preview is explicitly labeled and uses memory-only sample data. It is not evidence of a successful production database connection. See README for the local live-workspace walkthrough, deployment steps and documented reliability limits.
