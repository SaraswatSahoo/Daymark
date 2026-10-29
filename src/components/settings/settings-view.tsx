"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BellRing, CheckCircle2, CircleAlert, Loader2, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrioritySelect, TimeInput } from "@/components/common/fields";
import { useThemePreference, useMounted } from "@/components/app/theme-toggle";
import { NotificationStatus } from "@/components/reminders/notification-status";
import { DataSection } from "./data-section";
import { act } from "@/lib/client/action";
import { logoutAction, updateSettingsAction } from "@/server/actions/settings";
import { currentPushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/client/notifications";
import { ACCENTS, DASHBOARD_SECTIONS, DATE_FORMATS } from "@/lib/constants";
import { ACCENT_SWATCHES } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { ClientSettings } from "@/lib/types";
import type { SettingsUpdateInput } from "@/lib/validation";
import { format } from "date-fns";

function applyAccent(accent: string) {
  document.documentElement.dataset.accent = accent;
}

function Card({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <h2 id={`${id}-title`} className="font-display text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SettingsView({
  initial,
  timezones,
  ai,
  push,
  auth,
}: {
  initial: ClientSettings;
  timezones: string[];
  ai: { enabled: boolean; model: string };
  push: { enabled: boolean; publicKey: string | null };
  auth: boolean;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const { theme, setTheme } = useThemePreference();
  const [s, setS] = useState(initial);
  const [name, setName] = useState(initial.displayName);
  const [aiCheck, setAiCheck] = useState<{ ok: boolean; message: string; models?: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const browserTz = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  useEffect(() => {
    if (push.enabled) void currentPushSubscription().then((sub) => setPushOn(!!sub));
  }, [push.enabled]);

  const save = async (patch: SettingsUpdateInput, message = "Saved") => {
    const prev = s;
    setS((cur) => ({ ...cur, ...(patch as Partial<ClientSettings>) }));
    const r = await act(updateSettingsAction(patch), { success: message });
    if (!r) setS(prev);
    else if (patch.accent) applyAccent(patch.accent);
  };

  const layout = s.dashboardLayout;
  const moveSection = (i: number, d: -1 | 1) => {
    const next = [...layout];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void save({ dashboardLayout: next }, "Dashboard updated");
  };

  return (
    <div className="space-y-6">
      <Card id="profile" title="Profile">
        <Row label="Display name" htmlFor="display-name" hint="Used in your greeting.">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save({ displayName: name });
            }}
          >
            <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} onBlur={() => name !== s.displayName && save({ displayName: name })} />
          </form>
        </Row>
      </Card>

      <Card id="appearance" title="Appearance">
        <Row label="Theme">
          <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border p-0.5">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={mounted && theme === t}
                onClick={() => setTheme(t)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm capitalize text-muted-foreground",
                  mounted && theme === t && "bg-muted font-medium text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Accent color">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={s.accent === a}
                aria-label={a}
                title={a}
                onClick={() => save({ accent: a }, "Accent updated")}
                className={cn("size-8 rounded-full ring-offset-2 ring-offset-card transition-shadow", s.accent === a && "ring-2 ring-foreground")}
                style={{ background: ACCENT_SWATCHES[a] }}
              />
            ))}
          </div>
        </Row>
      </Card>

      <Card id="datetime" title="Date & time">
        <Row label="Timezone" htmlFor="tz" hint={`Determines what "today" means. Currently ${s.tz}.`}>
          <div className="flex flex-wrap gap-2">
            <Select value={s.timezone ?? s.tz} onValueChange={(v) => save({ timezone: v }, "Timezone updated").then(() => router.refresh())}>
              <SelectTrigger id="tz" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timezones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {browserTz && browserTz !== s.tz && (
              <Button variant="outline" size="sm" onClick={() => save({ timezone: browserTz }, "Timezone updated").then(() => router.refresh())}>
                Use this device ({browserTz})
              </Button>
            )}
          </div>
        </Row>
        <Row label="Week starts on" htmlFor="week-start">
          <Select value={String(s.weekStart)} onValueChange={(v) => save({ weekStart: Number(v) })}>
            <SelectTrigger id="week-start" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Monday</SelectItem>
              <SelectItem value="0">Sunday</SelectItem>
              <SelectItem value="6">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Date format" htmlFor="date-format">
          <Select value={s.dateFormat} onValueChange={(v) => save({ dateFormat: v as (typeof DATE_FORMATS)[number] })}>
            <SelectTrigger id="date-format" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {format(new Date(2026, 9, 29), f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Time format" htmlFor="time-format">
          <Select value={s.timeFormat} onValueChange={(v) => save({ timeFormat: v as "12h" | "24h" })}>
            <SelectTrigger id="time-format" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">12-hour (2:30pm)</SelectItem>
              <SelectItem value="24h">24-hour (14:30)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Card>

      <Card id="defaults" title="Tasks & reminders">
        <Row label="Default priority" htmlFor="default-priority">
          <PrioritySelect id="default-priority" value={s.defaultPriority} onChange={(p) => save({ defaultPriority: p })} className="sm:w-48" />
        </Row>
        <Row label="Default reminder time" htmlFor="default-reminder" hint="Used when a reminder has a date but no time.">
          <TimeInput id="default-reminder" value={s.defaultReminderTime} onChange={(t) => t && save({ defaultReminderTime: t })} className="sm:w-36" />
        </Row>
        <Row label="Snooze length" htmlFor="snooze">
          <Select value={String(s.defaultSnoozeMinutes)} onValueChange={(v) => save({ defaultSnoozeMinutes: Number(v) })}>
            <SelectTrigger id="snooze" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 30, 60].map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m < 60 ? `${m} minutes` : "1 hour"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Card>

      <Card id="notifications" title="Notifications" description="How reminders reach you.">
        <NotificationStatus always />
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">In-app alerts</strong> work whenever Daymark is open in a tab — always on.</li>
          <li>• <strong className="text-foreground">System notifications</strong> appear while a Daymark tab is open (even in the background) once you allow them.</li>
          <li>
            • <strong className="text-foreground">Push while closed</strong>{" "}
            {push.enabled ? "is configured on this server." : "needs VAPID keys on the server — see README → Notifications."}
          </li>
        </ul>
        {push.enabled && push.publicKey && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <BellRing className="size-4 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 text-sm">Push notifications on this device</span>
            {pushOn !== null && (
              <Switch
                checked={pushOn}
                disabled={pushBusy}
                aria-label="Push notifications on this device"
                onCheckedChange={async (v) => {
                  setPushBusy(true);
                  if (v) {
                    const r = await subscribeToPush(push.publicKey!);
                    if (r.ok) {
                      setPushOn(true);
                      toast.success("Push notifications enabled on this device");
                    } else toast.error(r.error ?? "Couldn't enable push.");
                  } else {
                    await unsubscribeFromPush();
                    setPushOn(false);
                    toast.success("Push notifications turned off on this device");
                  }
                  setPushBusy(false);
                }}
              />
            )}
            {pushOn && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data.ok) toast.success("Test notification sent");
                  else toast.error(data.error ?? "No device received the test.");
                }}
              >
                Send test
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card id="dashboard" title="Dashboard" description="Choose and order the sections on Home.">
        <ul className="divide-y rounded-lg border">
          {layout.map((sec, i) => {
            const label = DASHBOARD_SECTIONS.find((d) => d.id === sec.id)?.label ?? sec.id;
            return (
              <li key={sec.id} className="flex items-center gap-2 px-3 py-2">
                <Switch
                  checked={sec.visible}
                  aria-label={`Show ${label}`}
                  onCheckedChange={(v) =>
                    save({ dashboardLayout: layout.map((x) => (x.id === sec.id ? { ...x, visible: v } : x)) }, "Dashboard updated")
                  }
                />
                <span className={cn("flex-1 text-sm", !sec.visible && "text-muted-foreground")}>{label}</span>
                <Button variant="ghost" size="icon-xs" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => moveSection(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label={`Move ${label} down`} disabled={i === layout.length - 1} onClick={() => moveSection(i, 1)}>
                  <ArrowDown />
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card id="ai" title="AI assistance (optional)" description="Powered by your own Groq API key. Everything else works without it.">
        <div className="flex items-start gap-3 rounded-lg border p-3">
          {ai.enabled ? <Sparkles className="mt-0.5 size-4 text-brand" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 text-muted-foreground" aria-hidden />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{ai.enabled ? "AI is enabled" : "AI is disabled"}</p>
            <p className="text-muted-foreground">
              {ai.enabled ? (
                <>
                  Model: <code className="rounded bg-muted px-1">{ai.model}</code>. AI runs only when you click an AI action, sending just that note, selection or task.
                </>
              ) : (
                <>Add <code className="rounded bg-muted px-1">GROQ_API_KEY</code> to your <code className="rounded bg-muted px-1">.env</code> file and restart to enable summaries, task extraction, subtask suggestions, title ideas, rewriting and weekly reviews.</>
              )}
            </p>
          </div>
        </div>
        {ai.enabled && (
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                try {
                  const res = await fetch("/api/ai/status", { method: "POST" });
                  setAiCheck(await res.json());
                } catch {
                  setAiCheck({ ok: false, message: "Couldn't reach the server." });
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Check connection
            </Button>
            <p className="text-xs text-muted-foreground">Uses Groq&apos;s model list endpoint — no completion tokens are spent.</p>
            {aiCheck && (
              <div className={cn("rounded-lg px-3 py-2 text-sm", aiCheck.ok ? "bg-success/10" : "bg-destructive/10")} role="status">
                {aiCheck.message}
                {!aiCheck.ok && aiCheck.models && aiCheck.models.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Available: {aiCheck.models.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card id="data" title="Data & backups" description="Your data lives in a local SQLite database. Export regularly.">
        <DataSection />
      </Card>

      <Card id="security" title="Privacy & access">
        <div className="flex items-start gap-3 text-sm">
          <ShieldCheck className={cn("mt-0.5 size-4", auth ? "text-success" : "text-muted-foreground")} aria-hidden />
          <p className="min-w-0 flex-1 text-muted-foreground">
            {auth
              ? "Password protection is on (APP_PASSWORD). Sessions last 30 days."
              : "Password protection is off. That's fine on localhost; set APP_PASSWORD before opening Daymark to other devices or the internet."}
          </p>
          {auth && (
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut /> Sign out
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
