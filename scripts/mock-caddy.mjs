#!/usr/bin/env node
/**
 * Minimal mock of the Caddy Admin API for local UI development.
 *
 *   node scripts/mock-caddy.mjs
 *   CADDY_ADMIN_URL=http://localhost:2019 npm run dev
 *
 * It keeps the configuration in memory and implements the handful of
 * endpoints CaddyWeb uses. Do not use it in production.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 2019);
const HOST = process.env.HOST || "127.0.0.1";

let config = {};
let revision = 0;
let etag = '"config-0"';

const localCa = {
  id: "local",
  name: "Caddy Local Authority (mock)",
  root_common_name: "Caddy Local Authority - 2026 ECC Root",
  intermediate_common_name: "Caddy Local Authority - ECC Intermediate",
  root_certificate: [
    "-----BEGIN CERTIFICATE-----",
    "MIIBmTCCAT+gAwIBAgIQMOCKCERTIFICATEFORLOCALDEVELOPMENTONLY0000",
    "-----END CERTIFICATE-----",
  ].join("\n"),
};

function send(res, status, body, headers = {}) {
  const isJson = body !== null && typeof body === "object";
  res.writeHead(status, {
    "Content-Type": isJson ? "application/json" : "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : String(body ?? ""));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function bumpEtag() {
  revision += 1;
  etag = `"config-${revision}"`;
}

function collectUpstreams() {
  const upstreams = [];
  const servers = config?.apps?.http?.servers ?? {};
  const walk = (routes) => {
    for (const route of routes ?? []) {
      for (const handler of route.handle ?? []) {
        if (handler.handler === "reverse_proxy") {
          for (const upstream of handler.upstreams ?? []) {
            if (upstream.dial) {
              upstreams.push({ address: upstream.dial, num_requests: 0, fails: 0 });
            }
          }
        }
        if (Array.isArray(handler.routes)) walk(handler.routes);
      }
    }
  };
  for (const server of Object.values(servers)) walk(server.routes);
  return upstreams;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  console.log(`${method} ${path}`);

  if (path === "/config/" && method === "GET") {
    return send(res, 200, config, { ETag: etag });
  }

  if (path === "/load" && method === "POST") {
    try {
      const body = await readBody(req);
      const next = JSON.parse(body || "{}");
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        return send(res, 400, { error: "config must be a JSON object" });
      }
      config = next;
      bumpEtag();
      return send(res, 200, {});
    } catch (error) {
      return send(res, 400, { error: `loading config: ${error.message}` });
    }
  }

  if (path === "/reverse_proxy/upstreams" && method === "GET") {
    return send(res, 200, collectUpstreams());
  }

  if (path === "/pki/ca/local" && method === "GET") {
    return send(res, 200, localCa);
  }

  if (path === "/pki/ca/local/certificates" && method === "GET") {
    return send(res, 200, localCa.root_certificate);
  }

  if (path === "/adapt" && method === "POST") {
    const caddyfile = await readBody(req);
    const host = /^([a-z0-9.*-]+\.[a-z0-9.-]+)\s*\{/im.exec(caddyfile)?.[1] ?? "example.com";
    return send(res, 200, {
      apps: {
        http: {
          servers: {
            srv0: {
              listen: [":443"],
              routes: [
                {
                  match: [{ host: [host] }],
                  handle: [
                    { handler: "encode", encodings: { gzip: {}, zstd: {} } },
                    { handler: "reverse_proxy", upstreams: [{ dial: "localhost:3000" }] },
                  ],
                  terminal: true,
                },
              ],
            },
          },
        },
      },
    });
  }

  if (path.startsWith("/pki/ca/")) {
    return send(res, 404, { error: "no such CA" });
  }

  return send(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Mock Caddy Admin API listening on http://${HOST}:${PORT}`);
  console.log("Start the panel with: CADDY_ADMIN_URL=http://localhost:2019 npm run dev");
});
