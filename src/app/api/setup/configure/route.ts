import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import {
  loadDbConfig,
  saveDbConfig,
  testDbConnection,
  type DbConfig,
} from "@/lib/db-config";
import { audit, databaseStatus, getPool, resetPool } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  database: z.string().trim().min(1).max(64),
  user: z.string().trim().min(1).max(128),
  password: z.string().max(1000).optional(),
  ssl: z.boolean(),
  sslRejectUnauthorized: z.boolean(),
});

export async function POST(request: Request) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  const existing = loadDbConfig();
  if (existing?.source === "env") {
    return fail(
      "Database settings are managed by environment variables and cannot be changed here.",
      409,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Please check the database fields.", 422);

  const password = parsed.data.password || existing?.password || "";
  if (!password) return fail("Database password is required.", 422);

  const config: DbConfig = {
    host: parsed.data.host,
    port: parsed.data.port,
    database: parsed.data.database,
    user: parsed.data.user,
    password,
    ssl: parsed.data.ssl,
    sslRejectUnauthorized: parsed.data.sslRejectUnauthorized,
    source: "file",
  };

  const test = await testDbConnection(config);
  if (!test.ok) {
    return fail(`Could not connect: ${test.error ?? "unknown error"}`, 502);
  }

  try {
    saveDbConfig(config);
    await resetPool();
    await getPool();
    await audit(auth.user.username, "database.configure", config.host, config.database);
    return ok({ database: await databaseStatus(), version: test.version });
  } catch (error) {
    console.error("[caddyweb] database setup:", error);
    return fail(
      error instanceof Error
        ? `Connection succeeded, but schema setup failed: ${error.message}`
        : "Schema setup failed.",
      500,
    );
  }
}
