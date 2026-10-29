import { execSync } from "node:child_process";

/**
 * Recreates the integration-test schema ("test" in the local Postgres from
 * docker-compose.yml, separate from your data in "public") from the real migrations.
 */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: TEST_DB, DIRECT_URL: TEST_DB };
  execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", { env, input: `DROP SCHEMA IF EXISTS "${schemaOf(TEST_DB)}" CASCADE;`, stdio: ["pipe", "pipe", "pipe"] });
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
}

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://daymark:daymark@localhost:5434/daymark?schema=test";

const schemaOf = (url: string) => new URL(url).searchParams.get("schema") ?? "public";
