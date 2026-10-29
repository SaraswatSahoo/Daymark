// Recreates the isolated e2e schema in the local Postgres before the test server starts.
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL;
const schema = new URL(url).searchParams.get("schema");
if (!schema || schema === "public") throw new Error("e2e needs a dedicated schema, e.g. ?schema=e2e");
const env = { ...process.env, DIRECT_URL: url };
execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", { env, input: `DROP SCHEMA IF EXISTS "${schema}" CASCADE;`, stdio: ["pipe", "inherit", "inherit"] });
execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
