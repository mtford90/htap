#!/usr/bin/env npx tsx
/**
 * Simulate script — continuously sends HTTP requests through the running htap proxy
 * so they appear live in the TUI. Useful for manual testing of real-time features.
 *
 * Usage:
 *   npx tsx scripts/simulate.ts                # default: 50–200ms intervals, 1 concurrent
 *   npx tsx scripts/simulate.ts --fast         # 10–50ms intervals
 *   npx tsx scripts/simulate.ts --flood        # no delay, 10 concurrent
 *   npx tsx scripts/simulate.ts --min 0 --max 100 --concurrency 5
 *   npm run simulate -- --flood
 */

import * as http from "node:http";
import * as path from "node:path";
import { readProxyPort } from "../src/shared/project.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface SimOptions {
  minIntervalMs: number;
  maxIntervalMs: number;
  concurrency: number;
}

function parseArgs(): SimOptions {
  const args = process.argv.slice(2);

  // Presets
  if (args.includes("--flood")) {
    return { minIntervalMs: 0, maxIntervalMs: 0, concurrency: 10 };
  }
  if (args.includes("--fast")) {
    return { minIntervalMs: 10, maxIntervalMs: 50, concurrency: 1 };
  }

  // Custom flags
  const defaults: SimOptions = { minIntervalMs: 50, maxIntervalMs: 200, concurrency: 1 };

  const minIdx = args.indexOf("--min");
  if (minIdx !== -1 && args[minIdx + 1]) {
    defaults.minIntervalMs = Number(args[minIdx + 1]);
  }

  const maxIdx = args.indexOf("--max");
  if (maxIdx !== -1 && args[maxIdx + 1]) {
    defaults.maxIntervalMs = Number(args[maxIdx + 1]);
  }

  const concIdx = args.indexOf("--concurrency");
  if (concIdx !== -1 && args[concIdx + 1]) {
    defaults.concurrency = Number(args[concIdx + 1]);
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// Request templates
// ---------------------------------------------------------------------------

interface SimRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "application/json", accept: "application/json", ...extra };
}

function formHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "application/x-www-form-urlencoded", ...extra };
}

const REQUEST_POOL: SimRequest[] = [
  // -- Node.js app requests --
  {
    method: "GET",
    url: "http://api.github.com/repos/mtford90/htap",
    headers: jsonHeaders({
      authorization: "Bearer ghp_xxxxxxxxxxxx",
      "user-agent": "node-fetch/3.3.2",
    }),
  },
  {
    method: "POST",
    url: "http://api.stripe.com/v1/charges",
    headers: jsonHeaders({
      authorization: "Bearer sk_test_xxxx",
      "user-agent": "Stripe/v1 node",
    }),
    body: JSON.stringify({
      amount: 2000,
      currency: "gbp",
      source: "tok_visa",
      description: "Order #1234",
    }),
  },
  {
    method: "GET",
    url: "http://jsonplaceholder.typicode.com/posts",
    headers: jsonHeaders({ "user-agent": "axios/1.7.2" }),
  },
  {
    method: "PUT",
    url: "http://jsonplaceholder.typicode.com/posts/1",
    headers: jsonHeaders({ "user-agent": "axios/1.7.2" }),
    body: JSON.stringify({ id: 1, title: "updated title", body: "updated body", userId: 1 }),
  },
  {
    method: "DELETE",
    url: "http://jsonplaceholder.typicode.com/posts/1",
    headers: jsonHeaders({ "user-agent": "axios/1.7.2" }),
  },
  {
    method: "POST",
    url: "http://api.openai.com/v1/chat/completions",
    headers: jsonHeaders({
      authorization: "Bearer sk-xxxx",
      "user-agent": "OpenAI/Node 4.0.0",
    }),
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello, world!" }],
      max_tokens: 100,
    }),
  },
  {
    method: "GET",
    url: "http://registry.npmjs.org/htap",
    headers: jsonHeaders({ "user-agent": "npm/10.2.0 node/v20.11.0" }),
  },

  // -- Python app requests --
  {
    method: "POST",
    url: "http://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
    headers: jsonHeaders({ "user-agent": "python-requests/2.31.0" }),
    body: JSON.stringify({ text: "Deployment successful: v2.4.1 to production" }),
  },
  {
    method: "GET",
    url: "http://api.weatherapi.com/v1/current.json?key=xxxx&q=London",
    headers: jsonHeaders({ "user-agent": "python-httpx/0.25.0" }),
  },
  {
    method: "POST",
    url: "http://api.sendgrid.com/v3/mail/send",
    headers: jsonHeaders({
      authorization: "Bearer SG.xxxx",
      "user-agent": "python-requests/2.31.0",
    }),
    body: JSON.stringify({
      personalizations: [{ to: [{ email: "user@example.com" }] }],
      from: { email: "noreply@myapp.com" },
      subject: "Your weekly report",
    }),
  },
  {
    method: "GET",
    url: "http://api.github.com/users/octocat",
    headers: jsonHeaders({ "user-agent": "python-httpx/0.25.0" }),
  },
  {
    method: "POST",
    url: "http://api.twilio.com/2010-04-01/Accounts/AC000/Messages.json",
    headers: formHeaders({
      authorization: "Basic dXNlcjpwYXNz",
      "user-agent": "python-requests/2.31.0",
    }),
    body: "To=%2B447911123456&From=%2B15017122661&Body=Your+code+is+123456",
  },

  // -- curl requests --
  {
    method: "GET",
    url: "http://httpbin.org/get?foo=bar&baz=qux",
    headers: { "user-agent": "curl/8.4.0", accept: "*/*" },
  },
  {
    method: "GET",
    url: "http://httpbin.org/json",
    headers: { "user-agent": "curl/8.4.0", accept: "*/*" },
  },
  {
    method: "GET",
    url: "http://httpbin.org/ip",
    headers: { "user-agent": "curl/8.4.0", accept: "*/*" },
  },
  {
    method: "POST",
    url: "http://httpbin.org/post",
    headers: {
      "user-agent": "curl/8.4.0",
      "content-type": "application/json",
      accept: "*/*",
    },
    body: JSON.stringify({ message: "testing from curl" }),
  },
  {
    method: "GET",
    url: "http://httpbin.org/user-agent",
    headers: { "user-agent": "curl/8.4.0", accept: "*/*" },
  },
  {
    method: "GET",
    url: "http://httpbin.org/headers",
    headers: {
      "user-agent": "curl/8.4.0",
      accept: "*/*",
      "x-custom-header": "hello-htap",
      authorization: "Bearer test-token-123",
    },
  },
  {
    method: "PATCH",
    url: "http://httpbin.org/patch",
    headers: {
      "user-agent": "curl/8.4.0",
      "content-type": "application/json",
      accept: "*/*",
    },
    body: JSON.stringify({ partial: "update" }),
  },

  // -- Ruby/Rails requests --
  {
    method: "GET",
    url: "http://api.heroku.com/apps",
    headers: jsonHeaders({
      authorization: "Bearer heroku-token",
      "user-agent": "Faraday v2.7.0",
    }),
  },
  {
    method: "POST",
    url: "http://api.stripe.com/v1/customers",
    headers: formHeaders({
      authorization: "Bearer sk_test_xxxx",
      "user-agent": "Stripe/v1 RubyBindings/10.0.0",
    }),
    body: "email=customer%40example.com&name=Jane+Doe",
  },
  {
    method: "GET",
    url: "http://api.github.com/rate_limit",
    headers: jsonHeaders({ "user-agent": "Octokit Ruby Gem 8.0.0" }),
  },

  // -- Error-provoking requests --
  {
    method: "POST",
    url: "http://api.stripe.com/v1/charges",
    headers: jsonHeaders({ authorization: "Bearer sk_test_expired" }),
    body: JSON.stringify({ amount: 5000, currency: "usd" }),
  },
  {
    method: "POST",
    url: "http://jsonplaceholder.typicode.com/posts",
    headers: jsonHeaders({ "user-agent": "python-requests/2.31.0" }),
    body: JSON.stringify({ title: "New post", body: "Lorem ipsum", userId: 1 }),
  },
  {
    method: "GET",
    url: "http://jsonplaceholder.typicode.com/users/1",
    headers: jsonHeaders({ "user-agent": "Faraday v2.7.0" }),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)] as T;
}

const REQUEST_TIMEOUT_MS = 5000;

function sendRequest(proxyPort: number, template: SimRequest): Promise<{ status: number }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

  return new Promise<{ status: number }>((resolve, reject) => {
    const parsed = new URL(template.url);

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: proxyPort,
      path: template.url,
      method: template.method,
      headers: {
        ...template.headers,
        host: parsed.host,
      },
      signal: ac.signal,
    };

    const req = http.request(options, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
    });

    req.on("error", (err) => reject(err));

    if (template.body) {
      req.write(template.body);
    }

    req.end();
  }).finally(() => clearTimeout(timer));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function runWorker(proxyPort: number, opts: SimOptions): Promise<void> {
  while (true) {
    const template = pickRandom(REQUEST_POOL);

    try {
      const { status } = await sendRequest(proxyPort, template);
      const parsed = new URL(template.url);
      console.log(`${template.method.padEnd(7)} ${status}  ${parsed.host}${parsed.pathname}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ERROR   ${template.method.padEnd(7)} ${template.url} — ${message}`);
    }

    if (opts.maxIntervalMs > 0) {
      await sleep(randomInt(opts.minIntervalMs, opts.maxIntervalMs));
    }
  }
}

async function main(): Promise<void> {
  const opts = parseArgs();

  console.log("htap simulate script");
  console.log("======================\n");

  const proxyPort = readProxyPort(PROJECT_ROOT);

  if (proxyPort === undefined) {
    console.error("No proxy port found — is the daemon running? (htap on)");
    process.exit(1);
  }

  console.log(`Proxy port: ${proxyPort}`);
  console.log(`Interval: ${opts.minIntervalMs}–${opts.maxIntervalMs}ms`);
  console.log(`Concurrency: ${opts.concurrency}`);
  console.log("Press Ctrl+C to stop.\n");

  const workers = Array.from({ length: opts.concurrency }, () => runWorker(proxyPort, opts));
  await Promise.all(workers);
}

main();
