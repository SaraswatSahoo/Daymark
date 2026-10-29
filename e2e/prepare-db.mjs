// Recreates the isolated e2e database before the test server starts.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const db = path.resolve(import.meta.dirname, "../prisma/e2e.db");
for (const f of [db, `${db}-journal`, `${db}-wal`, `${db}-shm`]) rmSync(f, { force: true });
execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: "file:./e2e.db" }, stdio: "inherit" });
