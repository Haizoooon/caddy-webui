import { getConfig, getLocalCa, getLocalCaCertificates } from "@/lib/caddy/admin";
import { requireApiAuth } from "@/lib/guards";
import { errorResponse, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireApiAuth();
  if (denied) return denied;

  try {
    const config = await getConfig();
    const policies = (config.apps?.tls?.automation?.policies ?? []).map((policy) => ({
      subjects: policy.subjects ?? [],
      issuers: (policy.issuers ?? []).map((issuer) => issuer.module ?? "unknown"),
    }));

    let localCa = null;
    let certificates: string | null = null;

    try {
      const ca = await getLocalCa();
      if (ca) {
        localCa = {
          name: ca.name ?? "Caddy Local Authority",
          rootCommonName: ca.root_common_name ?? "",
          intermediateCommonName: ca.intermediate_common_name ?? "",
          rootCertificate: ca.root_certificate ?? "",
        };
        certificates = await getLocalCaCertificates();
      }
    } catch {
      // The local CA is provisioned lazily; absence is not an error.
      localCa = null;
      certificates = null;
    }

    return ok({ policies, localCa, certificates });
  } catch (error) {
    return errorResponse(error);
  }
}
