# Daymark

A calm, self-hosted personal productivity workspace: quick capture, an Inbox, notes and a daily journal, tasks with subtasks and recurrence, reminders with real notifications, a calendar, projects and tags, global search, a weekly review, and a few optional AI helpers that use **your own Groq API key**.

Single-user, local-first, and fast. Everything except the AI features works offline from any AI service; all data lives in one SQLite file you own.

> Product name, accent and colors are easy to change — see [Customization](#customization).

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Configuration (.env)](#configuration-env)
- [Optional AI with Groq](#optional-ai-with-groq)
- [Notifications: what works out of the box](#notifications-what-works-out-of-the-box)
- [Using Daymark from your phone or another device](#using-daymark-from-your-phone-or-another-device)
- [Data, backups and restore](#data-backups-and-restore)
- [Deployment notes](#deployment-notes)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Customization](#customization)
- [Known limitations](#known-limitations)

---

## Features

**Capture and Inbox**
- Global quick capture (`Q`, the sidebar button, or the floating **+** on mobile) for tasks, notes, reminders and ideas.
- Understands shorthand: natural dates (“fri 5pm”, “in 2 hours”, “next tue”), `#tags`, `!high`/`!urgent`, `+Project`, and prefixes like `remind:` or `idea:`. Parsed bits are shown as removable chips before you save.
- Anything captured without a project or date lands in the **Inbox**, where you can turn ideas into tasks or notes, move items into projects, tag them, set dates or reminders, switch a task ↔ note, archive or delete.

**Tasks**
- Title, notes, status (To do / In progress / Completed), priority (Low → Urgent), due date and optional time, reminder, project, tags, subtasks, linked note, timestamps.
- Recurring tasks (daily, weekdays, weekly, monthly, yearly, every *N*). Completing one keeps the finished instance as history and creates the next occurrence exactly once (late completions skip past dates).
- Views: **My Day**, **All Tasks** (filter by status, due window, priority, project, tag, text; sort; group by project/priority/status/date), **Upcoming** (14 days + overdue), **Completed** (grouped by day), per-project lists.
- Manual ordering (move up/down) in My Day and in “Manual” sort.
- “Break down” suggests subtasks with AI (optional, previewed before anything is added).

**Notes and knowledge**
- Markdown editor with toolbar and shortcuts (bold, italic, headings, lists, checklists, quotes, code, links), list continuation, Write / Split / Preview modes. Checklists are clickable in preview.
- Debounced autosave with a visible save state, a local draft copy (nothing lost if the network or server fails), a flush on tab close, and **conflict detection** when the same note was edited in another tab or device.
- Pinned notes, list and grid views, search by title and content, tags, projects, archive/restore, duplicate, Markdown export.
- Templates: Daily Journal, Meeting Notes, Study Notes, Project Notes, Brain Dump.
- Relationships: link tasks to notes, create a task from selected text, link related notes, `[[Note title]]` wiki links, and a backlinks list.
- **Journal**: one entry per day, opened from a template.

**Reminders and calendar**
- Standalone reminders or reminders attached to tasks/notes; upcoming / due / done / dismissed states; snooze (10 min → tomorrow); recurring reminders; history.
- In-app alerts, system notifications, and optional web push — see [Notifications](#notifications-what-works-out-of-the-box).
- Calendar with **Month**, **Week** and **Day/agenda** views; tasks, completed tasks and reminders are visually distinct; create a task or reminder for any selected day; `.ics` export.

**Everything else**
- Dashboard (“What should I focus on today?”): greeting, quick capture, today's priorities, overdue, due today, upcoming reminders, this week, recent notes, Inbox preview, progress ring. Sections can be hidden and reordered in Settings.
- Projects with icon, color, description and progress; lightweight tag management (rename, recolor, delete).
- Global search and command palette (`Ctrl/⌘ K`) across tasks, notes, projects and reminders, with quick actions and keyboard navigation. More shortcuts: press `?`.
- Weekly review with real counts, a reflection box, and an optional AI summary of the items *you* choose to share.
- Settings: theme (light/dark/system), accent color, display name, timezone, week start, date/time formats, default priority, default reminder time, snooze length, dashboard layout, notifications, AI status, backups.
- JSON backup export and validated import (merge or replace with a dry-run preview), notes as a Markdown `.zip`, calendar `.ics`.
- Responsive from 320 px phones to wide desktops (bottom navigation on mobile, collapsible sidebar on desktop), installable as a PWA, light/dark themes, keyboard accessible, reduced-motion support.
- Optional password protection (`APP_PASSWORD`) for anything beyond localhost.

---

## Quick start

Requirements: **Node.js 20.9+** (developed on Node 26) and npm.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Configure environment
cp .env.example .env          # then edit .env if you want AI, a password or push

# 3. Create the database (applies migrations to prisma/daymark.db)
npm run setup

# 4a. Development
npm run dev                   # http://localhost:3000

# 4b. …or production
npm run build
npm start                     # http://localhost:3000  (PORT=4000 npm start to change)
```

> **npm 11+/12 note:** newer npm versions block package install scripts unless approved. This repo's `package.json` already approves the ones Daymark needs (`prisma`, `@prisma/client`, `@prisma/engines`, `esbuild`, `unrs-resolver`). If `npm install` warns about blocked scripts anyway, run `npm install-scripts approve <package>` for those, or run `npx prisma generate` manually.

Want to look around first? Load demo content **into a separate database**:

```bash
DATABASE_URL="file:./demo.db" npx prisma migrate deploy
DATABASE_URL="file:./demo.db" npm run db:seed-demo
DATABASE_URL="file:./demo.db" npm run dev
```

The seeder never runs automatically and refuses to touch a database that already has content unless you pass `--force`.

---

## Configuration (.env)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | SQLite file, relative to `prisma/`. Default `file:./daymark.db`. Keep it on persistent storage. |
| `APP_PASSWORD` | recommended off-localhost | Enables a sign-in page. Without it, anyone who can reach the server can read your data. |
| `SESSION_SECRET` | no | Signs the session cookie. Defaults to a value derived from `APP_PASSWORD`. Changing either signs you out everywhere. |
| `GROQ_API_KEY` | no | Enables the AI features. Leave empty to disable AI completely. |
| `GROQ_MODEL` | no | Groq model ID. Default `openai/gpt-oss-20b`. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Enables web push (notifications while the app is closed). |

`.env` is git-ignored. `.env.example` contains placeholders only. Never put secrets in variables prefixed with `NEXT_PUBLIC_`.

---

## Optional AI with Groq

AI is an enhancement, never a requirement. With no key, AI buttons simply don't appear and every other feature works.

### Setup

1. Create a key at <https://console.groq.com/keys>.
2. Put it in `.env`:
   ```bash
   GROQ_API_KEY="gsk_..."
   GROQ_MODEL="openai/gpt-oss-20b"
   ```
3. Restart the server. In **Settings → AI assistance**, click **Check connection**. This calls Groq's model-list endpoint (it uses no completion tokens) and confirms that the key works and that `GROQ_MODEL` is available to your account. If the model isn't available, it lists the ones that are.

### Model choice

Checked against Groq's documentation on 2026-10-29:

- [Models](https://console.groq.com/docs/models) lists `openai/gpt-oss-20b` and `openai/gpt-oss-120b` as production models. The Llama production models are marked Enterprise. `qwen/qwen3.8-27b` and others are *preview* models, which may be removed at short notice.
- The default is **`openai/gpt-oss-20b`**: fast, supports strict JSON-schema Structured Outputs, and has the same base request limits as the 120b model. Switch to `openai/gpt-oss-120b` for higher-quality writing.
- Always confirm availability for *your* account with **Check connection**. Models change; nothing in the code assumes a specific one. For gpt-oss models Daymark sends `reasoning_effort: "low"` and `include_reasoning: false`. Other models receive standard parameters, and JSON-object mode is used for structured output.

Docs: [Quickstart](https://console.groq.com/docs/quickstart) · [Models](https://console.groq.com/docs/models) · [Rate limits](https://console.groq.com/docs/rate-limits) · [OpenAI compatibility](https://console.groq.com/docs/openai) · [Structured outputs](https://console.groq.com/docs/structured-outputs). Your account's exact free-tier limits are listed at <https://console.groq.com/settings/limits>.

### Features

| Where | Action | What is sent |
|---|---|---|
| Note → **AI** menu | Summarize; Extract tasks; Suggest a title | The current note, or your selection (max 12,000 chars) |
| Note → **AI** menu | Shorten / Clarify / Reorganize / Fix grammar | Only the selected text (max 8,000 chars) |
| Task details → **Break down** | Suggest subtasks | Task title, notes (max 4,000 chars) and existing subtask titles |
| Weekly Review → **Generate review** | Short review | The task/note **titles** you choose to include, plus your reflection — never note contents |

Every result is shown as an **editable preview**. Nothing changes until you choose Insert, Replace, Use title, Add selected or Create tasks. Extracted tasks are validated against a schema and created only after you confirm.

### Cost and reliability safeguards

- Calls happen only after an explicit click. There is no background processing, no automatic summarization, no embeddings, and no RAG.
- The key is server-side only and is never sent to the browser or logged. Note content is not logged.
- Inputs are size-bounded, and outputs are capped with `max_completion_tokens` (400–3000 depending on the action).
- The SDK runs with **no automatic retries**. A local guard allows at most 15 AI requests per minute per server process.
- Rate limits (HTTP 429, including `retry-after`), invalid keys, unavailable or decommissioned models, oversized input, malformed model output, timeouts and network errors all produce a clear message. Requests can be cancelled from the UI.
- All AI code is in `src/server/ai/`, plus the request/response schemas in `src/lib/ai-schemas.ts`. Changing provider or model affects only those files.

---

## Notifications: what works out of the box

Browser timers can't deliver notifications when no Daymark tab is open. Here is exactly what each layer does.

| Layer | Works when | Setup |
|---|---|---|
| **Reminder persistence** | Always | None. Reminders are stored in the database and stay *due* until you mark them done, snooze or dismiss them. A denied permission never drops a reminder. |
| **In-app alerts** | A Daymark tab is open | None. The app checks every 30 s, on tab focus, and with a precise timer for the next reminder. Due reminders appear as a persistent toast with **Done** and **Snooze**, plus a badge in the navigation. Multiple tabs don't duplicate alerts (reminders are claimed atomically). |
| **System notifications** | A Daymark tab is open, even in the background | Allow notifications (Reminders page or Settings). Requires a secure context: `http://localhost` or HTTPS. On Android these come through the service worker, with Done/Snooze buttons. |
| **Web push** | The app or tab is **closed**, as long as the server is running | Generate VAPID keys and add them to `.env`. Run Daymark as a long-lived Node server (`npm start`), use HTTPS (or localhost), then turn on **Settings → Notifications → Push notifications on this device**. Use **Send test** to verify. |

Enable web push:

```bash
npm run vapid          # prints a public and private key
# add them to .env:
# VAPID_PUBLIC_KEY="..."
# VAPID_PRIVATE_KEY="..."
# VAPID_SUBJECT="mailto:you@example.com"
npm run build && npm start
```

When VAPID keys are present, `src/instrumentation.ts` starts a scheduler inside the Node server. Every 30 s it sends a push for each newly due reminder. Each reminder is claimed in the database first, so it is never sent twice, and reminders more than 12 h stale are skipped. This needs a persistent server process. It does **not** run on serverless platforms. iOS supports web push only for apps added to the Home Screen (iOS 16.4+).

---

## Using Daymark from your phone or another device

Daymark is a single-user app. Keep it private.

1. **Set a password** in `.env`: `APP_PASSWORD="a long passphrase"`, then restart.
2. **Recommended: Tailscale** (or another private VPN). Install Tailscale on the server and your phone. `tailscale serve 3000` gives you a private **HTTPS** URL, and HTTPS is required for system notifications, push and PWA install.
3. **Same Wi-Fi only:** `npm start -- -H 0.0.0.0` (or `next dev -H 0.0.0.0`), then open `http://<computer-ip>:3000`. Everything works, but browsers block notifications and service workers on plain-HTTP non-localhost origins.
4. **Install as an app:** in Chrome or Edge use **Install app**. On iOS Safari use **Share → Add to Home Screen**.

Don't expose Daymark to the public internet without `APP_PASSWORD` **and** HTTPS. A reverse proxy such as Caddy provides automatic TLS. Behind a proxy that terminates TLS, session cookies are marked `Secure` in production. Set `INSECURE_COOKIES=1` only if you must serve production over plain HTTP on a trusted network.

---

## Data, backups and restore

All data is in the SQLite file named by `DATABASE_URL` (default `prisma/daymark.db`, plus `-wal`/`-shm` files while running; WAL mode is enabled).

**Backups**

```bash
npm run db:backup                 # consistent copy → backups/daymark-<timestamp>.db (safe while running)
npm run db:backup -- --keep 14    # …and keep only the 14 newest
```

Schedule it with cron, for example daily at 2 am:

```cron
0 2 * * * cd /path/to/daymark && npm run db:backup -- --keep 30 >> backups/backup.log 2>&1
```

**Restore a database backup:** stop the app, copy the backup over `prisma/daymark.db` (delete any `daymark.db-wal`/`-shm` files), and start again.

**In-app export and import** (Settings → Data & backups):
- **Full backup (JSON):** everything, including settings, in a documented, versioned format (`src/lib/backup-schema.ts`).
- **Notes as Markdown (.zip):** one `.md` file per note with YAML front matter, in folders by project, journal and archive.
- **Calendar (.ics):** open dated tasks and pending reminders.
- **Import:** the file is validated first, and a dry-run table shows what will happen.
  - **Merge** (default) adds only items that don't already exist. Existing data is never modified.
  - **Replace** requires typing `REPLACE`. It first writes a snapshot of your current data to `backups/pre-import-<timestamp>.json`, then restores the backup in a single transaction.

---

## Deployment notes

- Daymark needs **a persistent filesystem** for SQLite. Good fits: your own machine, a home server or NAS, a small VPS, or a Docker host with a mounted volume. Serverless platforms such as Vercel or Netlify functions **do not** keep a local SQLite file, so data would be lost.
- Run `npm run setup` (migrations) on each deploy before `npm start`.
- **Moving to PostgreSQL later:** all DB access goes through Prisma in `src/server/services/*`. Enumerations are validated strings, and dates are ISO strings or UTC timestamps. Switch `provider = "postgresql"` in `prisma/schema.prisma`, point `DATABASE_URL` at Postgres, create a fresh migration, and move data with the JSON export/import. Search uses Prisma `contains`, which is case-sensitive on Postgres; add `mode: "insensitive"` there.

---

## Testing

```bash
npm run lint          # ESLint (Next.js + React Compiler rules)
npm run typecheck     # tsc --noEmit (strict)
npm test              # Vitest: unit + integration tests (uses an isolated prisma/test.db)
npm run build         # production build
npx playwright install chromium   # once
npm run test:e2e      # Playwright E2E against the production build (isolated prisma/e2e.db)
```

The integration tests run the real services against a freshly migrated SQLite database. The AI tests run against a local mock of Groq's OpenAI-compatible API, so they need no key or network. The E2E suite starts `next start` on port 3210 with its own database. Run `npm run build` before `npm run test:e2e`.

**Last results (2026-10-29, Node 26.12, Linux):**

| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` | ✅ 0 errors |
| `npm test` | ✅ 61 / 61 tests passed (7 files) |
| `npm run build` | ✅ succeeded |
| `npm run test:e2e` | ✅ 17 / 17 passed (14 desktop @1440 px, 3 mobile on a Pixel 7 profile, including overflow checks at 320/375/768/1024 px) |

Covered: note create/edit/autosave/reload/delete, checklist toggling, conflict detection; task create/complete/reopen, recurrence history, subtasks, filters and search; inbox processing; reminders (create, claim-once, snooze, reschedule, recurring, in-app delivery) and calendar display; theme/accent/settings persistence across browsers; JSON/Markdown/ICS export and validated import (merge never overwrites); AI disabled without a key, and AI success, rate-limit, server-error and bad-output handling against a mock Groq; mobile navigation, touch targets, and no horizontal overflow.

Not verified automatically: calls to the real Groq API (no key in this environment), real push delivery to a phone (needs HTTPS and a device), and Safari/Firefox (E2E ran on Chromium only).

---

## Project structure

```
prisma/
  schema.prisma            # data model (SQLite)
  migrations/              # versioned migrations
scripts/                   # backup-db, seed-demo, generate-icons
public/sw.js               # service worker: notifications + push (no offline caching)
src/
  config/brand.ts          # product name & theme colors
  proxy.ts                 # optional password gate (Next 16 "proxy", formerly middleware)
  instrumentation.ts       # web-push scheduler (only when VAPID keys are set)
  app/
    (app)/…                # pages: dashboard, inbox, today, upcoming, calendar, tasks,
                           #        notes, journal, reminders, projects, review, completed,
                           #        archive, settings
    api/…                  # route handlers: search, notes autosave, ai, export, import,
                           #        reminders poll/actions, push
    login/                 # sign-in page (when APP_PASSWORD is set)
  server/
    db.ts                  # Prisma client (WAL, busy timeout)
    services/              # business logic + queries (tasks, notes, reminders, inbox, …)
    actions/               # server actions: validation → service → revalidate
    ai/                    # Groq client, error mapping, operations
    push.ts, http.ts, mappers.ts, action-result.ts
  lib/                     # shared, framework-free: dates, recurrence, capture parser,
                           #   validation (Zod), templates, backup schema, AI schemas
  components/
    ui/                    # shadcn/ui primitives
    app/                   # shell: sidebar, mobile nav, quick capture, palette, shortcuts
    tasks/ notes/ reminders/ calendar/ inbox/ projects/ settings/ review/ dashboard/ common/
tests/                     # Vitest unit + integration tests
e2e/                       # Playwright end-to-end tests
docs/ARCHITECTURE.md       # design decisions and implementation checklist
```

---

## Customization

- **Name and tagline:** `src/config/brand.ts`. Icons are generated from `public/icons/icon.svg` with `node scripts/generate-icons.mjs`.
- **Accent colors:** pick one in Settings. Add or change options in `src/app/globals.css` (`[data-accent="…"]`), `ACCENTS` in `src/lib/constants.ts`, and `ACCENT_SWATCHES` in `src/lib/colors.ts`.
- **Palette and typography:** CSS variables at the top of `src/app/globals.css`. Fonts (Geist and Newsreader) are set in `src/app/layout.tsx`.
- **Note templates:** `src/lib/templates.ts`.
- **Dashboard sections:** toggle and reorder in Settings. Definitions are in `DASHBOARD_SECTIONS`.

---

## Known limitations

- **Single user.** There are no accounts or sharing. `APP_PASSWORD` is a simple shared-secret gate meant for a personal server.
- **No offline mode.** The service worker handles notifications only. Pages and data need the server, and the app doesn't claim offline sync.
- **Push needs extra setup:** VAPID keys, a long-running server and HTTPS. Without them, notifications only appear while a Daymark tab is open.
- **Calendar sync:** `.ics` export only. There is no two-way sync with Google or Apple calendars, no events with durations, and no drag-and-drop rescheduling.
- **Recurring tasks** only show the next occurrence on the calendar, not a projected series. The `.ics` export does include `RRULE`s.
- **Reordering** uses Move up/Move down (keyboard and touch friendly), not drag and drop.
- **Search** uses SQLite `LIKE` (case-insensitive for ASCII only). This is fine for personal data volumes. FTS5 would be the next step for very large libraries.
- **Notes editor** is a Markdown text editor with live preview, not WYSIWYG rich text.
- **The `npm audit` warnings** come from build-time CLIs (Prisma's config loader and the shadcn CLI), not from code that runs in the app.
