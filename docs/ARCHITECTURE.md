# Architecture and implementation notes

## Initial inspection (2026-10-29)

- `/home/saraswat/personal` was empty and not a Git repository, with Node 26.12 and npm 12.2.
- So the project was scaffolded with `create-next-app@16` and shadcn/ui (Radix, “nova” preset). No existing code needed preserving.

## Key decisions

| Area | Decision | Why |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript strict | Latest stable; server actions + route handlers keep DB access on the server. |
| Rendering | `cacheComponents: false`, root layout `dynamic = "force-dynamic"` | Every view reads live personal data, and the per-request model is simpler and correct here. `loading.tsx` still provides skeletons. |
| Database | PostgreSQL via **Prisma 6.19** (Neon in production, Docker locally) | Prisma 7 requires a native driver adapter. 6.19 has a built-in engine, which carries less risk on Node 26. Postgres works on serverless hosts, where a local SQLite file would not persist. |
| Dates | Calendar days are `YYYY-MM-DD` strings; instants are UTC `DateTime` | A due date means the same day in every timezone and sorts lexicographically. “Today” is always computed in the user's configured timezone (`@date-fns/tz`). Reminder recurrence keeps wall-clock time across DST. |
| Enums | Strings validated by Zod | Portable across databases, with no native enum migrations. |
| Mutations | Server actions → `run()` → service → `revalidatePath("/", "layout")` | One consistent error shape (`ActionResult`). Zod validates at the boundary. Success toasts appear only after the server confirms. |
| Note autosave | Route handler `PUT /api/notes/[id]` | It can be flushed with `fetch(…, { keepalive: true })` on page hide or unmount. An optimistic-concurrency check (`baseUpdatedAt`) prevents silent overwrites, and a localStorage draft protects against crashes or offline edits. |
| Inbox | `inbox` flag on tasks and notes plus an `InboxItem` table for raw ideas | Capture first. Organizing (project or date) clears the flag automatically. |
| Recurrence | Complete → keep history → create next instance once (checked by `seriesId` and due date) | Toggling done or undone never duplicates occurrences. |
| Reminders | Stored in the DB. Client polls `/api/reminders/poll`, which **claims** newly due reminders atomically | No duplicates across tabs, and nothing lost when permission is denied. Optional web push is sent by a scheduler started in `instrumentation.ts`. |
| Search | Prisma `contains` with `mode: "insensitive"` (Postgres ILIKE), with title matches ranked above body matches | No extra service. Indexes cover the hot filters. |
| AI | `groq-sdk`, `maxRetries: 0`, strict JSON schema for structured output, Zod-validated results, a local 15/min guard | Explicit user actions only, minimum data sent, previews before anything is applied. |
| Auth | Optional `APP_PASSWORD`, HMAC session cookie checked in `src/proxy.ts` (Web Crypto) | Enough for a private, single-user server. Off by default for localhost. |

## Data model

`Settings` (single row) · `Project` 1─* `Task`/`Note`/`Reminder` · `Tag` *─* `Task`/`Note` (implicit join tables) · `Task` 1─* `Subtask` · `Task` *─1 `Note` (related note) · `Note` *─* `Note` via `NoteLink` · `Reminder` → optional `Task` (cascade), `Note`, `Project` (set null) · `InboxItem` · `PushSubscription`.

Deleting a project keeps its tasks and notes (`SetNull`). Deleting a task deletes its subtasks and reminders (`Cascade`). Deleting a note unlinks its tasks.

## Implementation checklist

### Phase 1 — Foundation
- [x] Next.js + TypeScript + Tailwind 4 + shadcn/ui scaffold
- [x] Prisma schema, initial migration
- [x] App shell: collapsible sidebar, mobile top bar and bottom nav, menu sheet
- [x] Light, dark and system theme; accent colors; settings persisted in the DB
- [x] Shared UI: empty states, page headers, fields, confirmation dialog, skeletons

### Phase 2 — Core productivity
- [x] Quick capture with parser (dates, #tags, !priority, +project, type prefixes)
- [x] Inbox processing (convert, move to project, tag, date, reminder, archive, delete)
- [x] Notes: Markdown editor, autosave, drafts, conflicts, pin, archive, templates, links, backlinks, journal
- [x] Tasks: all fields, subtasks, filters, sorting, grouping, My Day, Upcoming, Completed, manual order
- [x] Projects (progress, archive, delete), tags (rename, recolor, delete)
- [x] Global search and command palette, keyboard shortcuts
- [x] Configurable dashboard

### Phase 3 — Scheduling
- [x] Reminders: create, edit, reschedule, snooze, done, dismiss, recurring, history
- [x] In-app notifier, system notifications via service worker, optional web push + scheduler
- [x] Recurring tasks with history
- [x] Calendar month, week and day views; ICS export

### Phase 4 — Personalization and AI
- [x] Settings (profile, appearance, date/time, defaults, notifications, dashboard, AI, data, security)
- [x] JSON export and validated import (merge/replace + dry run + pre-import snapshot), Markdown zip, DB backup script
- [x] Groq: summarize, extract tasks, title, breakdown, rewrite, weekly review; status and connection check

### Phase 5 — Quality
- [x] Unit tests (dates, recurrence, parser, editor commands, AI schemas and errors)
- [x] Integration tests (services against Postgres, AI against a mock Groq server)
- [x] Playwright E2E (desktop + mobile, overflow at 320/375/768/1024 px)
- [x] Accessibility pass: labels, focus states, dialog semantics, aria-live save state, reduced motion, 44 px touch targets
- [x] PWA manifest and icons

### Possible next steps
- [ ] Drag-and-drop reordering, plus drag to reschedule on the calendar
- [ ] Postgres full-text search for very large note libraries
- [ ] Two-way calendar sync (CalDAV / Google)
- [ ] Offline read cache in the service worker
- [ ] Time-blocked calendar events with durations
