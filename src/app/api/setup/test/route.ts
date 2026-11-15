import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import {
  loadDbConfig,
  testDbConnection,
  type DbConfig,
} from "@/lib/db-config";
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
    const result = await testDbConnection(existing);
    return ok({ test: result });
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

  const result = await testDbConnection(config);
  if (!result.ok) {
    return fail(
      `Could not connect: ${result.error ?? "unknown error"}`,
      502,
    );
  }

  return ok({ test: result });
}
