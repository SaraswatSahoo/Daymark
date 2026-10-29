/**
 * Consistent online backup of the SQLite database (safe while the app is running).
 *
 *   npm run db:backup                 # → backups/daymark-YYYY-MM-DDTHH-MM-SS.db
 *   npm run db:backup -- --keep 14    # also delete all but the 14 newest backups
 *
 * Uses SQLite's `VACUUM INTO`, which writes a compact, transactionally consistent copy.
 * Restore by stopping the app and copying a backup over the file named in DATABASE_URL.
 */
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

async function main() {
  const keepIdx = process.argv.indexOf("--keep");
  const keep = keepIdx > -1 ? Number(process.argv[keepIdx + 1]) : 0;
  const dir = path.resolve(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `daymark-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.db`);

  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  } finally {
    await db.$disconnect();
  }
  const size = statSync(file).size;
  console.log(`Backup written: ${path.relative(process.cwd(), file)} (${(size / 1024).toFixed(1)} KB)`);

  if (keep > 0) {
    const backups = readdirSync(dir)
      .filter((f) => /^daymark-.*\.db$/.test(f))
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
