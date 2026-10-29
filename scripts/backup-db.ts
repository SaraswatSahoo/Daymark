/**
 * Full JSON backup of the database (the same format as Settings → Data & backups).
 *
 *   npm run db:backup                 # → backups/daymark-YYYY-MM-DDTHH-MM-SS.json
 *   npm run db:backup -- --keep 14    # also delete all but the 14 newest backups
 *
 * Works against any DATABASE_URL, including Neon. Restore with Settings → Import
 * (Merge or Replace). Runs with `--conditions=react-server` so `server-only` allows it.
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/server/db";
import { exportAll } from "../src/server/services/backup";

async function main() {
  const keepIdx = process.argv.indexOf("--keep");
  const keep = keepIdx > -1 ? Number(process.argv[keepIdx + 1]) : 0;
  const dir = path.resolve(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `daymark-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);

  try {
    writeFileSync(file, JSON.stringify(await exportAll(), null, 2));
  } finally {
    await db.$disconnect();
  }
  const size = statSync(file).size;
  console.log(`Backup written: ${path.relative(process.cwd(), file)} (${(size / 1024).toFixed(1)} KB)`);

  if (keep > 0) {
    const backups = readdirSync(dir)
      .filter((f) => /^daymark-.*\.json$/.test(f))
      .sort()
      .reverse();
    for (const old of backups.slice(keep)) {
      rmSync(path.join(dir, old));
      console.log(`Removed old backup: ${old}`);
    }
  }
}

main().catch((e) => {
  console.error("Backup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
