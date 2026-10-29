import { DatabaseZap } from "lucide-react";
import { brand } from "@/config/brand";

/** Shown when the database is missing or not migrated, instead of a crash page. */
export function SetupRequired({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <DatabaseZap className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-semibold">{brand.name} needs its database</h1>
      <p className="text-sm text-muted-foreground">
        The app couldn&apos;t open its database. If this is a fresh install, initialize it with:
      </p>
      <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 text-sm">
        cp .env.example .env{"\n"}npm run setup
      </pre>
      <p className="text-sm text-muted-foreground">Then restart the server and reload this page.</p>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Technical details</summary>
        <p className="mt-2 break-words font-mono">{message.slice(0, 600)}</p>
      </details>
    </main>
  );
}
