import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { listNotes } from "@/server/services/notes";
import { taskContext } from "@/server/actions/context";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { JournalOpenButton } from "@/components/notes/journal-open-button";
import { formatISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage() {
  const ctx = await taskContext();
  const entries = await listNotes({ journal: "only" });
  const todayEntry = entries.find((e) => e.journalDate === ctx.today);
  const byMonth = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = e.journalDate!.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader
        title="Journal"
        description="One entry per day. A quiet place for intentions and reflection."
        actions={<JournalOpenButton existingId={todayEntry?.id} />}
      />
      {entries.length === 0 ? (
        <EmptyState icon={BookOpen} title="Your journal is empty" description="Start today's entry — it opens with a gentle Daily Journal template." />
      ) : (
        <div className="space-y-8">
          {[...byMonth.entries()].map(([month, list]) => (
            <section key={month} aria-labelledby={`m-${month}`}>
              <h2 id={`m-${month}`} className="mb-2 border-b pb-1.5 px-2 font-display text-lg font-semibold">
                {formatISO(`${month}-01`, "MMMM yyyy")}
              </h2>
              <ul className="divide-y divide-border/60">
                {list.map((e) => (
                  <li key={e.id}>
                    <Link href={`/notes/${e.id}`} className="flex items-baseline gap-4 rounded-lg px-2 py-2.5 hover:bg-muted/60">
                      <span className="w-24 shrink-0 text-sm font-medium tabular-nums">
                        {e.journalDate === ctx.today ? "Today" : formatISO(e.journalDate!, "EEE d")}
                      </span>
                      <span className="line-clamp-1 min-w-0 flex-1 text-sm text-muted-foreground">{e.excerpt || "Empty entry"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
