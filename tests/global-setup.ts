import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/** Creates a fresh SQLite database for the integration tests from the real migrations. */
export default function setup() {
  const db = path.resolve(__dirname, "../prisma/test.db");
  for (const f of [db, `${db}-journal`, `${db}-wal`, `${db}-shm`]) rmSync(f, { force: true });
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}
