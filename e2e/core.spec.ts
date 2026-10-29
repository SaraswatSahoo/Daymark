import { expect, test, type Page } from "@playwright/test";

async function capture(page: Page, kind: "Task" | "Note" | "Reminder" | "Idea", text: string) {
  await page.keyboard.press("q");
  const dialog = page.getByRole("dialog", { name: "Quick capture" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: kind }).click();
  await dialog.getByLabel(kind, { exact: true }).fill(text);
  await dialog.getByRole("button", { name: new RegExp(`^Save ${kind}`, "i") }).click();
  await expect(dialog).toBeHidden();
}

test.describe.configure({ mode: "serial" });

test("dashboard renders with empty states and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
  await expect(page.getByText("A clear day")).toBeVisible();
  expect(errors).toEqual([]);
});

test("quick capture → inbox → move to a project", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Name").fill("Thesis");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Thesis");

  await capture(page, "Task", "Read three papers #research");
  await page.goto("/inbox");
  await expect(page.getByText("Read three papers")).toBeVisible();

  await page.getByRole("combobox", { name: "Project" }).first().click();
  await page.getByRole("option", { name: "Thesis" }).click();
  await expect(page.getByText("Moved to project")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Inbox zero")).toBeVisible();

  await page.goto("/projects");
  await page.getByRole("link", { name: /Thesis/ }).first().click();
  await expect(page.getByText("Read three papers")).toBeVisible();
});

test("ideas can be converted into notes", async ({ page }) => {
  await page.goto("/");
  await capture(page, "Idea", "App that reminds me to water plants");
  await page.goto("/inbox");
  await page.getByRole("button", { name: "Process" }).click();
  await page.getByRole("button", { name: "Make it a note" }).click();
  await expect(page).toHaveURL(/\/notes\/.+/);
  await expect(page.getByLabel("Title")).toHaveValue("App that reminds me to water plants");
});

test("create, edit, autosave, reload and delete a note", async ({ page }) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: "New note" }).first().click();
  await expect(page).toHaveURL(/\/notes\/.+/);
  await page.getByLabel("Title").fill("Lecture 5 — Thermodynamics");
  await page.getByLabel("Note content").fill("## Key ideas\n- [ ] Review entropy\n- Energy is conserved");
  await expect(page.getByRole("status").filter({ hasText: /Saved/ })).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByLabel("Title")).toHaveValue("Lecture 5 — Thermodynamics");
  // Preview mode renders Markdown; checklist items are clickable.
  await expect(page.getByRole("heading", { name: "Key ideas" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Mark item as done" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Saved/ })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Mark item as not done" })).toBeChecked();

  // Search finds it by content.
  await page.goto("/notes?q=entropy");
  await expect(page.getByRole("link", { name: /Lecture 5/ })).toBeVisible();

  await page.getByRole("link", { name: /Lecture 5/ }).click();
  await page.getByRole("button", { name: "More note actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await page.goto("/notes?q=entropy");
  await expect(page.getByText("No notes match")).toBeVisible();
});

test("create, complete and reopen tasks in My Day", async ({ page }) => {
  await page.goto("/today");
  const add = page.getByLabel("Add a task to My Day");
  await add.fill("Finish problem set !high");
  await add.press("Enter");
  await expect(page.getByRole("button", { name: "Open task: Finish problem set" })).toBeVisible();

  await page.getByRole("checkbox", { name: 'Complete "Finish problem set"' }).click();
  await expect(page.getByText("Task completed")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/1 of 1 done/)).toBeVisible();

  await page.goto("/completed");
  await expect(page.getByText("Finish problem set")).toBeVisible();
});

test("task details: due date, subtasks and recurrence", async ({ page }) => {
  await page.goto("/tasks");
  const add = page.getByLabel("Add a task");
  await add.fill("Weekly lab report");
  await add.press("Enter");
  await page.getByRole("button", { name: "Open task: Weekly lab report" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByLabel("Title")).toHaveValue("Weekly lab report");
  await sheet.getByLabel("Due", { exact: true }).fill("2030-01-07");
  await sheet.getByLabel("Add subtask").fill("Collect data");
  await sheet.getByLabel("Add subtask").press("Enter");
  await expect(sheet.getByLabel("Subtask: Collect data")).toBeVisible();
  await sheet.getByRole("combobox", { name: "Repeat" }).click();
  await page.getByRole("option", { name: "Every week(s)" }).click();
  await sheet.getByRole("button", { name: "Close task details" }).click();

  await expect(page.getByText("0/1")).toBeVisible();
  await page.getByRole("checkbox", { name: 'Complete "Weekly lab report"' }).click();
  await expect(page.getByText(/Next occurrence/)).toBeVisible();
  await page.reload();
  // The completed instance is kept as history; a new open occurrence exists.
  await expect(page.getByRole("button", { name: "Open task: Weekly lab report" })).toHaveCount(1);
  await page.goto("/completed");
  await expect(page.getByText("Weekly lab report")).toBeVisible();
});

test("filter tasks by priority and due date", async ({ page }) => {
  await page.goto("/tasks");
  const add = page.getByLabel("Add a task");
  await add.fill("Urgent thing !urgent");
  await add.press("Enter");
  await expect(page.getByRole("button", { name: "Open task: Urgent thing" })).toBeVisible();
  await add.fill("Calm thing !low");
  await add.press("Enter");
  await expect(page.getByRole("button", { name: "Open task: Calm thing" })).toBeVisible();

  await page.goto("/tasks?priority=3");
  await expect(page.getByRole("button", { name: "Open task: Urgent thing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open task: Calm thing" })).toHaveCount(0);

  await page.goto("/tasks?q=calm");
  await expect(page.getByRole("button", { name: "Open task: Calm thing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open task: Urgent thing" })).toHaveCount(0);
});

test("reminders: create, see on calendar, reschedule", async ({ page }) => {
  await page.goto("/reminders");
  await page.getByRole("button", { name: "New reminder" }).click();
  const dialog = page.getByRole("dialog", { name: "New reminder" });
  await dialog.getByLabel("Remind me to…").fill("Submit scholarship form");
  await dialog.getByLabel("Date").fill("2030-01-08");
  await dialog.getByLabel("Time").fill("10:30");
  await dialog.getByRole("button", { name: "Set reminder" }).click();
  await expect(page.getByText(/Reminder set for/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Submit scholarship form/ })).toBeVisible();

  await page.goto("/calendar?view=month&date=2030-01-08");
  await expect(page.getByRole("button", { name: /^Submit scholarship form/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Weekly lab report/ }).first()).toBeVisible();

  // Reschedule.
  await page.getByRole("button", { name: /^Submit scholarship form/ }).first().click();
  const edit = page.getByRole("dialog", { name: "Reminder" });
  await edit.getByLabel("Date").fill("2030-01-09");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Reminder updated")).toBeVisible();
  await page.goto("/calendar?view=day&date=2030-01-09");
  await expect(page.getByText("Submit scholarship form").first()).toBeVisible();
});

test("a due reminder is delivered in-app and can be completed", async ({ page }) => {
  await page.goto("/reminders");
  await page.getByRole("button", { name: "New reminder" }).click();
  const dialog = page.getByRole("dialog", { name: "New reminder" });
  await dialog.getByLabel("Remind me to…").fill("Take a break");
  const now = new Date(Date.now() - 60_000);
  await dialog.getByLabel("Date").fill(now.toISOString().slice(0, 10));
  await dialog.getByLabel("Time").fill(now.toISOString().slice(11, 16));
  await dialog.getByRole("button", { name: "Set reminder" }).click();
  // The notifier polls on focus/visibility; reload to trigger a poll.
  await page.reload();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Take a break" });
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await toast.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Reminder completed")).toBeVisible();
});

test("global search and command palette", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search and commands" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox", { name: "Search", exact: true }).fill("urgent");
  await expect(palette.getByRole("option", { name: /Urgent thing/ })).toBeVisible();
  await palette.getByRole("option", { name: /Urgent thing/ }).click();
  await expect(page.getByRole("dialog").getByLabel("Title")).toHaveValue("Urgent thing");
});

test("theme and accent settings persist", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: "dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "teal" }).click();
  await expect(page.getByText("Accent updated")).toBeVisible();
  await page.getByLabel("Display name").fill("Alex");
  await page.getByLabel("Display name").blur();
  await expect(page.getByText("Saved").first()).toBeVisible();

  // A fresh browser context (no localStorage) still gets the saved settings from the server.
  const ctx = await page.context().browser()!.newContext();
  const fresh = await ctx.newPage();
  await fresh.goto(page.url().replace("/settings", "/"));
  await expect(fresh.locator("html")).toHaveAttribute("data-accent", "teal");
  await expect(fresh.locator("html")).toHaveClass(/dark/);
  await expect(fresh.getByRole("heading", { level: 1 })).toContainText("Alex");
  await ctx.close();

  await page.getByRole("radio", { name: "light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("export and import a backup (merge does not duplicate)", async ({ page, request }) => {
  const res = await request.get("/api/export?format=json");
  expect(res.ok()).toBe(true);
  const backup = await res.json();
  expect(backup.app).toBe("daymark");
  expect(backup.data.tasks.length).toBeGreaterThan(0);

  await page.goto("/settings");
  await page.locator("#import-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  const dialog = page.getByRole("dialog", { name: /Import backup\.json/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 0 new items")).toBeVisible();

  const md = await request.get("/api/export?format=markdown");
  expect(md.headers()["content-type"]).toContain("application/zip");
  const ics = await request.get("/api/export?format=ics");
  expect(await ics.text()).toContain("BEGIN:VCALENDAR");

  const bad = await request.post("/api/import?mode=merge&dryRun=1", { data: { hello: "world" } });
  expect(bad.status()).toBe(400);
});

test("AI is cleanly disabled without a Groq key", async ({ page, request }) => {
  await page.goto("/settings");
  await expect(page.getByText("AI is disabled")).toBeVisible();
  const res = await request.post("/api/ai", { data: { op: "summarize", content: "hi" } });
  expect(res.status()).toBe(503);
  expect((await res.json()).code).toBe("disabled");

  await page.goto("/notes");
  await page.getByRole("button", { name: "New note" }).first().click();
  await expect(page.getByLabel("Note content")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI actions" })).toHaveCount(0);
});

test("journal opens one entry per day", async ({ page }) => {
  await page.goto("/journal");
  await page.getByRole("button", { name: /Start today's entry/ }).click();
  await expect(page).toHaveURL(/\/notes\/.+/);
  const url = page.url();
  await page.goto("/journal");
  await page.getByRole("button", { name: "Open today" }).click();
  await expect(page).toHaveURL(url);
});
