import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pragmasApplied?: boolean };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * SQLite tuning: WAL improves concurrent reads during writes and survives crashes
 * well; a busy timeout avoids spurious "database is locked" errors.
 */
if (!globalForPrisma.pragmasApplied) {
  globalForPrisma.pragmasApplied = true;
  db.$queryRawUnsafe("PRAGMA journal_mode = WAL;")
    .then(() => db.$queryRawUnsafe("PRAGMA busy_timeout = 5000;"))
    .catch(() => {
      globalForPrisma.pragmasApplied = false;
    });
}
