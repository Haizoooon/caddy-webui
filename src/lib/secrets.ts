import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey(): Buffer {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.APP_PASSWORD ||
    "caddyweb-development-secret";
  return createHash("sha256").update(`caddyweb-secret:${secret}`).digest();
}

/** Encrypts a secret with AES-256-GCM. Returns null for an empty value. */
export function encryptSecret(value: string): string | null {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** Returns null when the value is malformed or the key changed. */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const data = Buffer.from(parts[3], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
