#!/usr/bin/env node
// Tiny mock API for the httap demo — Node built-ins only, no dependencies.
//
// Exposes a handful of endpoints covering the traffic shapes httap is built
// to show off: JSON, HTML, binary, a redirect chain, a slow response, a
// large body, and both client and server errors.

import * as http from "node:http";

const USERS = [
  { id: 1, name: "Ada Lovelace", role: "engineer" },
  { id: 2, name: "Grace Hopper", role: "engineer" },
  { id: 3, name: "Margaret Hamilton", role: "lead" },
];

// 1x1 transparent PNG, decoded to bytes at request time.
const PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const SLOW_ENDPOINT_DELAY_MS = 2000;
const LARGE_REPORT_ROW_COUNT = 2000;

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", ...extraHeaders });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function buildReport() {
  return {
    generatedAt: new Date().toISOString(),
    rows: Array.from({ length: LARGE_REPORT_ROW_COUNT }, (_, i) => ({
      id: i + 1,
      metric: "requests_per_minute",
      value: Math.round(Math.random() * 1000),
    })),
  };
}

function userIdFromPath(pathname) {
  const match = /^\/api\/users\/(\d+)$/.exec(pathname);
  return match ? Number(match[1]) : undefined;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;
  const { method } = req;

  if (pathname === "/api/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (pathname === "/api/users" && method === "GET") {
    return sendJson(res, 200, USERS);
  }

  if (pathname === "/api/users" && method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const created = { id: USERS.length + 1, role: "engineer", ...body };
    return sendJson(res, 201, created);
  }

  const userId = userIdFromPath(pathname);
  if (userId !== undefined) {
    const user = USERS.find((u) => u.id === userId);

    if (method === "GET") {
      return user ? sendJson(res, 200, user) : sendJson(res, 404, { error: "user not found" });
    }
    if (method === "PUT") {
      const body = JSON.parse((await readBody(req)) || "{}");
      return sendJson(res, 200, { ...user, ...body, id: userId });
    }
    if (method === "DELETE") {
      res.writeHead(204);
      return res.end();
    }
  }

  if (pathname === "/api/report") {
    return sendJson(res, 200, buildReport());
  }

  if (pathname === "/api/avatar") {
    const png = Buffer.from(PIXEL_PNG_BASE64, "base64");
    res.writeHead(200, { "content-type": "image/png" });
    return res.end(png);
  }

  if (pathname === "/page") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(
      "<!doctype html><html><body><h1>httap demo</h1><p>Rendered HTML response.</p></body></html>"
    );
  }

  if (pathname === "/api/slow") {
    await new Promise((resolve) => setTimeout(resolve, SLOW_ENDPOINT_DELAY_MS));
    return sendJson(res, 200, { note: "that took a while" });
  }

  if (pathname === "/api/broken") {
    return sendJson(res, 500, { error: "internal_server_error" });
  }

  if (pathname === "/api/secure") {
    return sendJson(res, 401, { error: "unauthorized" });
  }

  if (pathname === "/api/redirect") {
    res.writeHead(302, { location: "/api/redirect-2" });
    return res.end();
  }

  if (pathname === "/api/redirect-2") {
    res.writeHead(302, { location: "/api/users" });
    return res.end();
  }

  if (pathname === "/api/quote") {
    // Overridden by .httap/interceptors/02-mock-quote.ts — this handler only
    // runs if that interceptor is disabled, so the demo still works either way.
    return sendJson(res, 200, { quote: "Not mocked — talking to the real app." });
  }

  return sendJson(res, 404, { error: "not found", path: pathname });
}

export function startApiServer(port) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      sendJson(res, 500, { error: "handler_failed", message: String(err) });
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
