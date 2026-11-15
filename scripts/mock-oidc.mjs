import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const PORT = Number(process.env.PORT || 4010);
const ISSUER = `http://localhost:${PORT}/`;
const CLIENT_ID = "caddyweb";

const { publicKey, privateKey } = await generateKeyPair("RS256", {
  modulusLength: 2048,
});
const jwk = await exportJWK(publicKey);
jwk.kid = "mock-key";
jwk.alg = "RS256";
jwk.use = "sig";

const codes = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/.well-known/openid-configuration") {
    return json(res, 200, {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}authorize`,
      token_endpoint: `${ISSUER}token`,
      jwks_uri: `${ISSUER}jwks`,
      userinfo_endpoint: `${ISSUER}userinfo`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    });
  }

  if (url.pathname === "/authorize") {
    if (url.searchParams.get("client_id") !== CLIENT_ID) {
      return json(res, 400, { error: "invalid_client" });
    }

    const redirectUri = url.searchParams.get("redirect_uri");
    if (!redirectUri) return json(res, 400, { error: "invalid_request" });

    const code = randomBytes(16).toString("base64url");
    codes.set(code, {
      nonce: url.searchParams.get("nonce") ?? "",
      challenge: url.searchParams.get("code_challenge") ?? "",
      createdAt: Date.now(),
    });

    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    target.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { location: target.toString() });
    return res.end();
  }

  if (url.pathname === "/token" && req.method === "POST") {
    const body = new URLSearchParams(await readBody(req));
    const code = body.get("code") ?? "";
    const record = codes.get(code);
    codes.delete(code);

    if (!record) return json(res, 400, { error: "invalid_grant" });

    const verifier = body.get("code_verifier") ?? "";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    if (challenge !== record.challenge) {
      return json(res, 400, { error: "invalid_grant", error_description: "PKCE mismatch" });
    }

    const idToken = await new SignJWT({
      sub: "user-123",
      preferred_username: "alice",
      name: "Alice Example",
      email: "alice@example.com",
      email_verified: true,
      groups: ["caddy-admins", "developers"],
      nonce: record.nonce,
    })
      .setProtectedHeader({ alg: "RS256", kid: "mock-key" })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    return json(res, 200, {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 300,
      id_token: idToken,
    });
  }

  if (url.pathname === "/jwks") {
    return json(res, 200, { keys: [jwk] });
  }

  return json(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock OIDC provider on ${ISSUER}`);
});
