import { getUpstreams } from "@/lib/caddy/admin";
import { requireApiAuth } from "@/lib/guards";
import { errorResponse, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireApiAuth();
  if (denied) return denied;

  try {
    return ok({ upstreams: await getUpstreams() });
  } catch (error) {
    return errorResponse(error);
  }
}
