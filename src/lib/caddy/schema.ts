import { z } from "zod";

export const siteKinds = [
  "reverse_proxy",
  "file_server",
  "filemanager",
  "redirect",
  "respond",
  "custom",
] as const;

export type SiteKind = (typeof siteKinds)[number];

export const tlsModes = ["auto", "internal"] as const;
export type TlsMode = (typeof tlsModes)[number];

export const SITE_KIND_META: Record<
  SiteKind,
  { label: string; short: string; description: string; tone: string }
> = {
  reverse_proxy: {
    label: "Reverse Proxy",
    short: "Proxy",
    description: "Forward a subdomain to an app on a host and port.",
    tone: "info",
  },
  file_server: {
    label: "Static Site",
    short: "Files",
    description: "Serve a folder of files, with an optional directory listing.",
    tone: "success",
  },
  filemanager: {
    label: "File Manager",
    short: "Manager",
    description: "Browse a folder over the web. Protected by a login.",
    tone: "purple",
  },
  redirect: {
    label: "Redirect",
    short: "Redirect",
    description: "Send visitors to another address with a 301, 302, 307 or 308.",
    tone: "warning",
  },
  respond: {
    label: "Respond",
    short: "Respond",
    description: "Return a fixed status code and body, e.g. a maintenance page.",
    tone: "muted",
  },
  custom: {
    label: "Custom Handler",
    short: "Custom",
    description: "Paste a raw Caddy handler array for anything else.",
    tone: "danger",
  },
};

const HOST_RE =
  /^(?=.{1,253}$)(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Returns a normalized hostname, or null when the value is not a usable host. */
export function normalizeHost(value: string): string | null {
  let host = value.trim().toLowerCase();
  if (!host) return null;

  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  }

  host = host.split("/")[0];

  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end === -1) return null;
    host = host.slice(0, end + 1);
  } else if (host.includes(":") && !host.includes("::")) {
    host = host.split(":")[0];
  }

  host = host.replace(/\.$/, "");

  if (host === "localhost") return host;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  if (host.includes(":") && /^[0-9a-f:]+$/i.test(host)) return host;
  if (!HOST_RE.test(host)) return null;

  return host;
}

export function parseHostList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

/** Normalizes an upstream dial address such as localhost:3000. */
export function normalizeUpstream(value: string): { value?: string; error?: string } {
  let address = value.trim();
  if (!address) return { error: "Upstream is required." };
  if (address.startsWith("unix/")) return { value: address };

  let scheme = "";
  const withScheme = /^(https?):\/\/(.+)$/i.exec(address);
  if (withScheme) {
    scheme = withScheme[1].toLowerCase();
    address = withScheme[2];
  }

  address = address.replace(/\/+$/, "");
  if (address.includes("/")) {
    return { error: "Use a host:port address, not a URL path." };
  }

  if (address.startsWith("[")) {
    if (!/^\[[0-9a-f:]+\](:\d+)?$/i.test(address)) {
      return { error: "Invalid IPv6 address." };
    }
    if (!/:\d+$/.test(address)) {
      address += scheme === "https" ? ":443" : ":80";
    }
    return { value: address };
  }

  if (!/^[^:\s]+:\d{1,5}$/.test(address)) {
    if (/^[^:\s]+$/.test(address)) {
      address += scheme === "https" ? ":443" : ":80";
    } else {
      return { error: "Use host:port, for example localhost:3000." };
    }
  }

  const port = Number(address.split(":").pop());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: "Port must be between 1 and 65535." };
  }

  return { value: address };
}

export function normalizePath(value: string): string {
  const path = value.trim();
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

const authSchema = z.object({
  enabled: z.boolean().default(false),
  username: z.string().trim().max(64).default(""),
  password: z.string().max(128).default(""),
});

export const siteInputSchema = z
  .object({
    kind: z.enum(siteKinds),
    hosts: z.array(z.string().trim().min(1).max(253)).min(1, "Add at least one hostname."),
    path: z.string().trim().max(512).default(""),
    tls: z.enum(tlsModes).default("auto"),
    upstreams: z.array(z.string().trim().min(1).max(253)).default([]),
    root: z.string().trim().max(512).default(""),
    browse: z.boolean().default(false),
    spaFallback: z.boolean().default(false),
    redirectTo: z.string().trim().max(1024).default(""),
    redirectCode: z
      .number()
      .int()
      .refine((value) => [301, 302, 307, 308].includes(value), "Use 301, 302, 307 or 308.")
      .default(302),
    respondStatus: z.number().int().min(200).max(599).default(200),
    respondBody: z.string().max(40000).default(""),
    encode: z.boolean().default(true),
    auth: authSchema.default({ enabled: false, username: "", password: "" }),
    customHandlers: z.string().max(200000).default(""),
    serverName: z.string().trim().max(64).optional(),
  })
  .superRefine((input, ctx) => {
    for (const host of input.hosts) {
      if (!normalizeHost(host)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hosts"],
          message: `"${host}" is not a valid hostname.`,
        });
      }
    }

    if (input.kind === "reverse_proxy") {
      if (input.upstreams.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["upstreams"],
          message: "Add at least one upstream.",
        });
      }
      for (const upstream of input.upstreams) {
        const result = normalizeUpstream(upstream);
        if (result.error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["upstreams"],
            message: result.error,
          });
        }
      }
      if (input.auth.enabled && !input.auth.username) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["auth", "username"],
          message: "Username is required when basic auth is enabled.",
        });
      }
    }

    if (input.kind === "file_server" || input.kind === "filemanager") {
      if (!input.root.startsWith("/")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["root"],
          message: "Use an absolute path, for example /srv/www.",
        });
      }
      if (input.auth.enabled && !input.auth.username) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["auth", "username"],
          message: "Username is required when basic auth is enabled.",
        });
      }
    }

    if (input.kind === "redirect") {
      if (!isHttpUrl(input.redirectTo) && !input.redirectTo.includes("{")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["redirectTo"],
          message: "Use an http:// or https:// destination.",
        });
      }
    }

    if (input.kind === "custom") {
      try {
        const parsed = JSON.parse(input.customHandlers);
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("not an array");
        for (const handler of parsed) {
          if (!handler || typeof handler !== "object" || typeof handler.handler !== "string") {
            throw new Error("missing handler name");
          }
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customHandlers"],
          message: "Enter a JSON array of Caddy handler objects.",
        });
      }
    }
  });

export type SiteInput = z.infer<typeof siteInputSchema>;
export type SiteAuthInput = z.infer<typeof authSchema>;

export function emptySiteInput(kind: SiteKind = "reverse_proxy"): SiteInput {
  return {
    kind,
    hosts: [],
    path: "",
    tls: "auto",
    upstreams: kind === "reverse_proxy" ? ["localhost:3000"] : [],
    root: kind === "file_server" || kind === "filemanager" ? "/srv/www" : "",
    browse: kind === "filemanager",
    spaFallback: false,
    redirectTo: "",
    redirectCode: 302,
    respondStatus: 200,
    respondBody: "",
    encode: true,
    auth: {
      enabled: kind === "filemanager",
      username: "admin",
      password: "",
    },
    customHandlers:
      kind === "custom"
        ? JSON.stringify(
            [
              {
                handler: "static_response",
                status_code: 200,
                body: "Hello from Caddy",
              },
            ],
            null,
            2,
          )
        : "",
  };
}

export function formatZodError(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
