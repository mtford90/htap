#!/usr/bin/env node
// Traffic generator for the httap demo.
//
// Starts the local mock API (api.mjs) and sends a varied burst of requests
// through the httap proxy, then keeps polling in the background so the TUI
// shows live arrivals — like a real app would. Run `--once` to send the
// burst and exit (used by scripts/demo.sh to seed traffic non-interactively).

import * as http from "node:http";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { startApiServer } from "./api.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PROXY_PORT_FILE = path.join(PROJECT_ROOT, ".httap", "proxy.port");

const DEMO_APP_PORT = Number(process.env.DEMO_APP_PORT ?? 4499);
const PROXY_WAIT_TIMEOUT_MS = 15_000;
const PROXY_POLL_INTERVAL_MS = 200;
const PROXY_PROBE_TIMEOUT_MS = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const BURST_STAGGER_MS = 120;
const POLL_MIN_INTERVAL_MS = 700;
const POLL_MAX_INTERVAL_MS = 2500;

const ONCE = process.argv.includes("--once");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readProxyPort() {
  if (!fs.existsSync(PROXY_PORT_FILE)) {
    return undefined;
  }
  const port = parseInt(fs.readFileSync(PROXY_PORT_FILE, "utf-8").trim(), 10);
  return Number.isNaN(port) ? undefined : port;
}

/** True if something is actually listening on the port; a stale port file after a crash is not. */
function probeProxy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(PROXY_PROBE_TIMEOUT_MS);
    const finish = (alive) => {
      socket.destroy();
      resolve(alive);
    };
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
  });
}

async function waitForProxy() {
  const deadline = Date.now() + PROXY_WAIT_TIMEOUT_MS;
  let sawPortFile = false;
  while (Date.now() < deadline) {
    const port = readProxyPort();
    if (port !== undefined) {
      sawPortFile = true;
      if (await probeProxy(port)) {
        return port;
      }
    }
    await sleep(PROXY_POLL_INTERVAL_MS);
  }
  const reason = sawPortFile
    ? `Nothing is listening on the port in ${PROXY_PORT_FILE} (stale after a crash?)`
    : `No proxy port found at ${PROXY_PORT_FILE}`;
  throw new Error(
    `${reason} — start httap first:\n` + `  eval "$(node dist/cli/index.js --dir examples/demo on)"`
  );
}

/** Send one request through the httap proxy (absolute-URI form, like a real proxy client). */
function sendThroughProxy(proxyPort, { method, url, headers, body }) {
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: proxyPort,
        path: url,
        method,
        headers: { ...headers, host: target.host },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

/** Follow redirects manually so each hop is captured as its own proxied request. */
async function requestFollowingRedirects(proxyPort, template) {
  let current = {
    method: template.method,
    url: template.url,
    headers: template.headers,
    body: template.body,
  };

  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    const response = await sendThroughProxy(proxyPort, current);
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      const next = new URL(response.headers.location, current.url).toString();
      current = { method: "GET", url: next, headers: template.headers };
      continue;
    }
    return response;
  }
  throw new Error(`too many redirects starting at ${template.url}`);
}

function appUrl(pathname) {
  return `http://127.0.0.1:${DEMO_APP_PORT}${pathname}`;
}

const jsonHeaders = { "content-type": "application/json", accept: "application/json" };

const REQUEST_POOL = [
  { label: "list users", method: "GET", url: appUrl("/api/users"), headers: jsonHeaders },
  {
    label: "create user",
    method: "POST",
    url: appUrl("/api/users"),
    headers: { ...jsonHeaders, "user-agent": "httap-demo/1.0" },
    body: JSON.stringify({ name: "New Engineer", role: "engineer" }),
  },
  { label: "get user", method: "GET", url: appUrl("/api/users/2"), headers: jsonHeaders },
  {
    label: "update user",
    method: "PUT",
    url: appUrl("/api/users/2"),
    headers: jsonHeaders,
    body: JSON.stringify({ role: "principal engineer" }),
  },
  { label: "delete user", method: "DELETE", url: appUrl("/api/users/3"), headers: jsonHeaders },
  { label: "missing user", method: "GET", url: appUrl("/api/users/999"), headers: jsonHeaders },
  { label: "html page", method: "GET", url: appUrl("/page"), headers: { accept: "text/html" } },
  {
    label: "binary avatar",
    method: "GET",
    url: appUrl("/api/avatar"),
    headers: { accept: "image/png" },
  },
  { label: "large report", method: "GET", url: appUrl("/api/report"), headers: jsonHeaders },
  { label: "server error", method: "GET", url: appUrl("/api/broken"), headers: jsonHeaders },
  { label: "unauthorized", method: "GET", url: appUrl("/api/secure"), headers: jsonHeaders },
  { label: "slow request", method: "GET", url: appUrl("/api/slow"), headers: jsonHeaders },
  {
    label: "mocked quote",
    method: "GET",
    url: appUrl("/api/quote"),
    headers: jsonHeaders,
    tag: "mocked-by-interceptor",
  },
  { label: "health check", method: "GET", url: appUrl("/api/health"), headers: jsonHeaders },
];

const REDIRECT_TEMPLATE = {
  label: "redirect chain",
  method: "GET",
  url: appUrl("/api/redirect"),
  headers: jsonHeaders,
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function sendOne(proxyPort, template) {
  try {
    const response =
      template === REDIRECT_TEMPLATE
        ? await requestFollowingRedirects(proxyPort, template)
        : await sendThroughProxy(proxyPort, template);
    console.log(`${template.method.padEnd(6)} ${response.status}  ${template.label}`);
  } catch (err) {
    console.error(`ERROR  ${template.method.padEnd(6)} ${template.label} — ${err.message}`);
  }
}

async function sendBurst(proxyPort) {
  const templates = [...REQUEST_POOL, REDIRECT_TEMPLATE];
  for (const template of templates) {
    await sendOne(proxyPort, template);
    await sleep(BURST_STAGGER_MS);
  }
}

async function pollForever(proxyPort) {
  while (true) {
    const template = pickRandom(REQUEST_POOL);
    await sendOne(proxyPort, template);
    const wait =
      POLL_MIN_INTERVAL_MS + Math.random() * (POLL_MAX_INTERVAL_MS - POLL_MIN_INTERVAL_MS);
    await sleep(wait);
  }
}

async function main() {
  console.log("httap demo traffic generator");
  console.log("=============================\n");

  const server = await startApiServer(DEMO_APP_PORT);
  console.log(`Mock API listening on http://127.0.0.1:${DEMO_APP_PORT}`);

  const proxyPort = await waitForProxy();
  console.log(`Proxying through httap on port ${proxyPort}\n`);

  console.log("Sending burst of traffic...");
  await sendBurst(proxyPort);

  if (ONCE) {
    server.close();
    console.log("\nBurst complete.");
    return;
  }

  console.log("\nBurst complete — polling in the background (Ctrl+C to stop)...\n");
  await pollForever(proxyPort);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(0));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
