#!/usr/bin/env npx tsx
/**
 * Seed script — populates the local .htap database with realistic example requests.
 * Works directly against the storage layer (no daemon or network needed).
 *
 * Usage:
 *   npx tsx scripts/seed.ts          # seed with defaults
 *   npx tsx scripts/seed.ts --clear   # clear existing data first
 */

import * as path from "node:path";
import { RequestRepository } from "../src/daemon/storage.js";
import { ensureHtapDir, getHtapPaths } from "../src/shared/project.js";
import type { CapturedRequest, InterceptionType } from "../src/shared/types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const CLEAR_FIRST = process.argv.includes("--clear");

// Session definitions — each represents a different source
const SESSIONS = [
  { id: "seed-node", label: "node-app", pid: 10001, source: "node" },
  { id: "seed-python", label: "flask-api", pid: 10002, source: "python3" },
  { id: "seed-curl", label: "manual-testing", pid: 10003, source: "curl" },
  { id: "seed-ruby", label: "rails-app", pid: 10004, source: "ruby" },
  { id: "seed-daemon", label: "daemon", pid: 10005, source: "daemon" },
] as const;

// ---------------------------------------------------------------------------
// Request templates
// ---------------------------------------------------------------------------

interface SeedRequest {
  sessionId: string;
  source: string;
  method: string;
  url: string;
  host: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody?: string;
  durationMs: number;
  interceptedBy?: string;
  interceptionType?: InterceptionType;
  saved?: boolean;
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "application/json", accept: "application/json", ...extra };
}

function _htmlHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "text/html; charset=utf-8", accept: "text/html", ...extra };
}

function formHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "application/x-www-form-urlencoded", ...extra };
}

// -- Node.js app requests (typical API client) --

const nodeRequests: SeedRequest[] = [
  {
    sessionId: "seed-node",
    source: "node",
    method: "GET",
    url: "https://api.github.com/repos/mtford90/htap",
    host: "api.github.com",
    path: "/repos/mtford90/htap",
    requestHeaders: jsonHeaders({
      authorization: "Bearer ghp_xxxxxxxxxxxx",
      "user-agent": "node-fetch/3.3.2",
    }),
    responseStatus: 200,
    responseHeaders: {
      "content-type": "application/json; charset=utf-8",
      "x-ratelimit-remaining": "58",
    },
    responseBody: JSON.stringify({
      id: 12345,
      name: "htap",
      full_name: "mtford90/htap",
      stargazers_count: 42,
    }),
    durationMs: 187,
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "POST",
    url: "https://api.stripe.com/v1/charges",
    host: "api.stripe.com",
    path: "/v1/charges",
    requestHeaders: jsonHeaders({
      authorization: "Bearer sk_test_xxxx",
      "user-agent": "Stripe/v1 node",
    }),
    requestBody: JSON.stringify({
      amount: 2000,
      currency: "gbp",
      source: "tok_visa",
      description: "Order #1234",
    }),
    responseStatus: 201,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      id: "ch_3abc123",
      amount: 2000,
      currency: "gbp",
      status: "succeeded",
    }),
    durationMs: 342,
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/posts",
    host: "jsonplaceholder.typicode.com",
    path: "/posts",
    requestHeaders: jsonHeaders({ "user-agent": "axios/1.7.2" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json; charset=utf-8" },
    responseBody: JSON.stringify([
      {
        id: 1,
        userId: 1,
        title: "sunt aut facere repellat provident",
        body: "quia et suscipit...",
      },
      { id: 2, userId: 1, title: "qui est esse", body: "est rerum tempore..." },
    ]),
    durationMs: 95,
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "PUT",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    host: "jsonplaceholder.typicode.com",
    path: "/posts/1",
    requestHeaders: jsonHeaders({ "user-agent": "axios/1.7.2" }),
    requestBody: JSON.stringify({ id: 1, title: "updated title", body: "updated body", userId: 1 }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json; charset=utf-8" },
    responseBody: JSON.stringify({
      id: 1,
      title: "updated title",
      body: "updated body",
      userId: 1,
    }),
    durationMs: 112,
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "DELETE",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    host: "jsonplaceholder.typicode.com",
    path: "/posts/1",
    requestHeaders: jsonHeaders({ "user-agent": "axios/1.7.2" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json; charset=utf-8" },
    responseBody: "{}",
    durationMs: 78,
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "POST",
    url: "https://api.openai.com/v1/chat/completions",
    host: "api.openai.com",
    path: "/v1/chat/completions",
    requestHeaders: jsonHeaders({
      authorization: "Bearer sk-xxxx",
      "user-agent": "OpenAI/Node 4.0.0",
    }),
    requestBody: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello, world!" }],
      max_tokens: 100,
    }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      id: "chatcmpl-abc123",
      choices: [{ message: { role: "assistant", content: "Hello! How can I assist you today?" } }],
      usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 },
    }),
    durationMs: 1843,
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "GET",
    url: "https://registry.npmjs.org/htap",
    host: "registry.npmjs.org",
    path: "/htap",
    requestHeaders: jsonHeaders({ "user-agent": "npm/10.2.0 node/v20.11.0" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      name: "htap",
      "dist-tags": { latest: "0.3.1" },
      versions: {},
    }),
    durationMs: 234,
  },
  // A request that's still pending (no response yet)
  {
    sessionId: "seed-node",
    source: "node",
    method: "GET",
    url: "https://api.slow-service.example.com/v2/data",
    host: "api.slow-service.example.com",
    path: "/v2/data",
    requestHeaders: jsonHeaders({ "user-agent": "node-fetch/3.3.2" }),
    responseStatus: 0, // will be handled specially — no response
    responseHeaders: {},
    durationMs: 0,
  },
];

// -- Python app requests --

const pythonRequests: SeedRequest[] = [
  {
    sessionId: "seed-python",
    source: "python3",
    method: "POST",
    url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
    host: "hooks.slack.com",
    path: "/services/T00000000/B00000000/XXXXXXXX",
    requestHeaders: jsonHeaders({ "user-agent": "python-requests/2.31.0" }),
    requestBody: JSON.stringify({ text: "Deployment successful: v2.4.1 to production" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "text/html" },
    responseBody: "ok",
    durationMs: 156,
  },
  {
    sessionId: "seed-python",
    source: "python3",
    method: "GET",
    url: "https://api.weatherapi.com/v1/current.json?key=xxxx&q=London",
    host: "api.weatherapi.com",
    path: "/v1/current.json?key=xxxx&q=London",
    requestHeaders: jsonHeaders({ "user-agent": "python-httpx/0.25.0" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      location: { name: "London", country: "United Kingdom" },
      current: { temp_c: 12.0, condition: { text: "Partly cloudy" } },
    }),
    durationMs: 289,
  },
  {
    sessionId: "seed-python",
    source: "python3",
    method: "POST",
    url: "https://api.sendgrid.com/v3/mail/send",
    host: "api.sendgrid.com",
    path: "/v3/mail/send",
    requestHeaders: jsonHeaders({
      authorization: "Bearer SG.xxxx",
      "user-agent": "python-requests/2.31.0",
    }),
    requestBody: JSON.stringify({
      personalizations: [{ to: [{ email: "user@example.com" }] }],
      from: { email: "noreply@myapp.com" },
      subject: "Your weekly report",
    }),
    responseStatus: 202,
    responseHeaders: { "content-type": "application/json" },
    responseBody: "",
    durationMs: 421,
  },
  {
    sessionId: "seed-python",
    source: "python3",
    method: "GET",
    url: "https://api.github.com/users/octocat",
    host: "api.github.com",
    path: "/users/octocat",
    requestHeaders: jsonHeaders({ "user-agent": "python-httpx/0.25.0" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json; charset=utf-8" },
    responseBody: JSON.stringify({ login: "octocat", id: 583231, type: "User", public_repos: 8 }),
    durationMs: 203,
  },
  {
    sessionId: "seed-python",
    source: "python3",
    method: "POST",
    url: "https://api.twilio.com/2010-04-01/Accounts/AC000/Messages.json",
    host: "api.twilio.com",
    path: "/2010-04-01/Accounts/AC000/Messages.json",
    requestHeaders: formHeaders({
      authorization: "Basic dXNlcjpwYXNz",
      "user-agent": "python-requests/2.31.0",
    }),
    requestBody: "To=%2B447911123456&From=%2B15017122661&Body=Your+code+is+123456",
    responseStatus: 201,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ sid: "SM123", status: "queued" }),
    durationMs: 567,
  },
];

// -- curl requests (manual testing) --

const curlRequests: SeedRequest[] = [
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://httpbin.org/get?foo=bar&baz=qux",
    host: "httpbin.org",
    path: "/get?foo=bar&baz=qux",
    requestHeaders: { "user-agent": "curl/8.4.0", accept: "*/*" },
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      args: { foo: "bar", baz: "qux" },
      url: "https://httpbin.org/get?foo=bar&baz=qux",
    }),
    durationMs: 134,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://httpbin.org/status/404",
    host: "httpbin.org",
    path: "/status/404",
    requestHeaders: { "user-agent": "curl/8.4.0", accept: "*/*" },
    responseStatus: 404,
    responseHeaders: { "content-type": "text/html; charset=utf-8" },
    responseBody: "",
    durationMs: 98,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://httpbin.org/status/500",
    host: "httpbin.org",
    path: "/status/500",
    requestHeaders: { "user-agent": "curl/8.4.0", accept: "*/*" },
    responseStatus: 500,
    responseHeaders: { "content-type": "text/html; charset=utf-8" },
    responseBody: "",
    durationMs: 87,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "POST",
    url: "https://httpbin.org/post",
    host: "httpbin.org",
    path: "/post",
    requestHeaders: {
      "user-agent": "curl/8.4.0",
      "content-type": "application/json",
      accept: "*/*",
    },
    requestBody: JSON.stringify({ message: "testing from curl" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ json: { message: "testing from curl" } }),
    durationMs: 145,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://example.com/",
    host: "example.com",
    path: "/",
    requestHeaders: { "user-agent": "curl/8.4.0", accept: "*/*" },
    responseStatus: 200,
    responseHeaders: { "content-type": "text/html; charset=UTF-8" },
    responseBody: "<html><body><h1>Example Domain</h1></body></html>",
    durationMs: 52,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://httpbin.org/headers",
    host: "httpbin.org",
    path: "/headers",
    requestHeaders: {
      "user-agent": "curl/8.4.0",
      accept: "*/*",
      "x-custom-header": "hello-htap",
      authorization: "Bearer test-token-123",
    },
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ headers: { "X-Custom-Header": "hello-htap" } }),
    durationMs: 110,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "PATCH",
    url: "https://httpbin.org/patch",
    host: "httpbin.org",
    path: "/patch",
    requestHeaders: {
      "user-agent": "curl/8.4.0",
      "content-type": "application/json",
      accept: "*/*",
    },
    requestBody: JSON.stringify({ partial: "update" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ json: { partial: "update" } }),
    durationMs: 123,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://httpbin.org/delay/2",
    host: "httpbin.org",
    path: "/delay/2",
    requestHeaders: { "user-agent": "curl/8.4.0", accept: "*/*" },
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ url: "https://httpbin.org/delay/2" }),
    durationMs: 2134,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://httpbin.org/status/301",
    host: "httpbin.org",
    path: "/status/301",
    requestHeaders: { "user-agent": "curl/8.4.0", accept: "*/*" },
    responseStatus: 301,
    responseHeaders: { "content-type": "text/html", location: "https://httpbin.org/redirect/1" },
    responseBody: "",
    durationMs: 91,
  },
];

// -- Ruby/Rails requests --

const rubyRequests: SeedRequest[] = [
  {
    sessionId: "seed-ruby",
    source: "ruby",
    method: "GET",
    url: "https://api.heroku.com/apps",
    host: "api.heroku.com",
    path: "/apps",
    requestHeaders: jsonHeaders({
      authorization: "Bearer heroku-token",
      "user-agent": "Faraday v2.7.0",
    }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify([
      { id: "app-1", name: "my-rails-app", web_url: "https://my-rails-app.herokuapp.com" },
    ]),
    durationMs: 312,
  },
  {
    sessionId: "seed-ruby",
    source: "ruby",
    method: "POST",
    url: "https://api.stripe.com/v1/customers",
    host: "api.stripe.com",
    path: "/v1/customers",
    requestHeaders: formHeaders({
      authorization: "Bearer sk_test_xxxx",
      "user-agent": "Stripe/v1 RubyBindings/10.0.0",
    }),
    requestBody: "email=customer%40example.com&name=Jane+Doe",
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      id: "cus_abc123",
      email: "customer@example.com",
      name: "Jane Doe",
    }),
    durationMs: 456,
  },
  {
    sessionId: "seed-ruby",
    source: "ruby",
    method: "GET",
    url: "https://api.github.com/rate_limit",
    host: "api.github.com",
    path: "/rate_limit",
    requestHeaders: jsonHeaders({ "user-agent": "Octokit Ruby Gem 8.0.0" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json; charset=utf-8" },
    responseBody: JSON.stringify({
      resources: { core: { limit: 5000, remaining: 4987, reset: 1700000000 } },
    }),
    durationMs: 167,
  },
];

// -- Intercepted/mocked requests (from daemon session) --

const interceptedRequests: SeedRequest[] = [
  {
    sessionId: "seed-node",
    source: "node",
    method: "GET",
    url: "https://api.example.com/v1/feature-flags",
    host: "api.example.com",
    path: "/v1/feature-flags",
    requestHeaders: jsonHeaders({ "user-agent": "node-fetch/3.3.2" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ dark_mode: true, beta_features: false }),
    durationMs: 2,
    interceptedBy: "feature-flags",
    interceptionType: "mocked",
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "POST",
    url: "https://api.example.com/v1/analytics",
    host: "api.example.com",
    path: "/v1/analytics",
    requestHeaders: jsonHeaders({ "user-agent": "node-fetch/3.3.2" }),
    requestBody: JSON.stringify({ event: "page_view", page: "/dashboard" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ success: true }),
    durationMs: 245,
    interceptedBy: "analytics-logger",
    interceptionType: "modified",
  },
  {
    sessionId: "seed-python",
    source: "python3",
    method: "GET",
    url: "https://api.external-service.com/health",
    host: "api.external-service.com",
    path: "/health",
    requestHeaders: jsonHeaders({ "user-agent": "python-httpx/0.25.0" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ status: "healthy", version: "3.2.1" }),
    durationMs: 1,
    interceptedBy: "health-check-mock",
    interceptionType: "mocked",
  },
];

// -- Error responses --

const errorRequests: SeedRequest[] = [
  {
    sessionId: "seed-node",
    source: "node",
    method: "POST",
    url: "https://api.stripe.com/v1/charges",
    host: "api.stripe.com",
    path: "/v1/charges",
    requestHeaders: jsonHeaders({ authorization: "Bearer sk_test_expired" }),
    requestBody: JSON.stringify({ amount: 5000, currency: "usd" }),
    responseStatus: 401,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      error: { type: "authentication_error", message: "Invalid API Key provided" },
    }),
    durationMs: 89,
  },
  {
    sessionId: "seed-python",
    source: "python3",
    method: "POST",
    url: "https://api.example.com/v2/users",
    host: "api.example.com",
    path: "/v2/users",
    requestHeaders: jsonHeaders({ "user-agent": "python-requests/2.31.0" }),
    requestBody: JSON.stringify({ email: "not-an-email", name: "" }),
    responseStatus: 422,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      errors: [
        { field: "email", message: "Invalid email format" },
        { field: "name", message: "Name is required" },
      ],
    }),
    durationMs: 34,
  },
  {
    sessionId: "seed-curl",
    source: "curl",
    method: "GET",
    url: "https://api.unreliable-service.example.com/data",
    host: "api.unreliable-service.example.com",
    path: "/data",
    requestHeaders: { "user-agent": "curl/8.4.0", accept: "*/*" },
    responseStatus: 503,
    responseHeaders: { "content-type": "application/json", "retry-after": "30" },
    responseBody: JSON.stringify({ error: "Service temporarily unavailable" }),
    durationMs: 5023,
  },
  {
    sessionId: "seed-node",
    source: "node",
    method: "GET",
    url: "https://cdn.example.com/assets/missing-image.png",
    host: "cdn.example.com",
    path: "/assets/missing-image.png",
    requestHeaders: { "user-agent": "node-fetch/3.3.2", accept: "image/*" },
    responseStatus: 404,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ error: "Not found" }),
    durationMs: 45,
  },
  {
    sessionId: "seed-ruby",
    source: "ruby",
    method: "POST",
    url: "https://api.example.com/v1/payments",
    host: "api.example.com",
    path: "/v1/payments",
    requestHeaders: jsonHeaders({ "user-agent": "Faraday v2.7.0" }),
    requestBody: JSON.stringify({ amount: -100, currency: "gbp" }),
    responseStatus: 400,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({
      error: { code: "invalid_amount", message: "Amount must be positive" },
    }),
    durationMs: 67,
  },
];

// -- Bookmarked (saved) requests --

const savedRequests: SeedRequest[] = [
  {
    sessionId: "seed-node",
    source: "node",
    method: "POST",
    url: "https://api.stripe.com/v1/payment_intents",
    host: "api.stripe.com",
    path: "/v1/payment_intents",
    requestHeaders: jsonHeaders({ authorization: "Bearer sk_test_xxxx" }),
    requestBody: JSON.stringify({ amount: 15000, currency: "gbp", payment_method: "pm_card_visa" }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: JSON.stringify({ id: "pi_abc", status: "requires_confirmation", amount: 15000 }),
    durationMs: 398,
    saved: true,
  },
  {
    sessionId: "seed-python",
    source: "python3",
    method: "GET",
    url: "https://api.github.com/repos/mtford90/htap/issues?state=open",
    host: "api.github.com",
    path: "/repos/mtford90/htap/issues?state=open",
    requestHeaders: jsonHeaders({
      authorization: "Bearer ghp_xxxx",
      "user-agent": "python-httpx/0.25.0",
    }),
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json; charset=utf-8" },
    responseBody: JSON.stringify([
      { number: 42, title: "Add source filtering", state: "open" },
      { number: 43, title: "TUI search improvements", state: "open" },
    ]),
    durationMs: 278,
    saved: true,
  },
];

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

const ALL_REQUESTS: SeedRequest[] = [
  ...nodeRequests,
  ...pythonRequests,
  ...curlRequests,
  ...rubyRequests,
  ...interceptedRequests,
  ...errorRequests,
  ...savedRequests,
];

function seed(): void {
  console.log("htap seed script");
  console.log("==================\n");

  // Ensure .htap directory exists
  ensureHtapDir(PROJECT_ROOT);
  const { databaseFile } = getHtapPaths(PROJECT_ROOT);

  console.log(`Database: ${databaseFile}`);

  const storage = new RequestRepository(databaseFile);

  if (CLEAR_FIRST) {
    console.log("Clearing existing requests...");
    storage.clearRequests();
    console.log("Cleared.\n");
  }

  // Register sessions
  console.log("Registering sessions...");
  for (const session of SESSIONS) {
    storage.ensureSession(session.id, session.label, session.pid, session.source);
    console.log(`  ${session.source.padEnd(10)} (${session.label})`);
  }
  console.log();

  // Insert requests with staggered timestamps so they appear in a realistic order.
  // Start 5 minutes ago, space each request ~3-8 seconds apart.
  const baseTimestamp = Date.now() - 5 * 60 * 1000;
  let requestCount = 0;

  // Shuffle for a more realistic interleaved feel
  const shuffled = shuffleArray([...ALL_REQUESTS]);

  console.log("Inserting requests...");
  for (let i = 0; i < shuffled.length; i++) {
    const req = shuffled[i];
    if (!req) continue;
    const timestamp = baseTimestamp + i * (3000 + Math.floor(Math.random() * 5000));
    const isPending = req.responseStatus === 0;

    const requestData: Omit<CapturedRequest, "id"> = {
      sessionId: req.sessionId,
      source: req.source,
      timestamp,
      method: req.method,
      url: req.url,
      host: req.host,
      path: req.path,
      requestHeaders: req.requestHeaders,
      requestBody: req.requestBody ? Buffer.from(req.requestBody) : undefined,
      requestBodyTruncated: false,
      interceptedBy: req.interceptedBy,
      interceptionType: req.interceptionType,
    };

    const id = storage.saveRequest(requestData);

    // Add response data (unless it's a "pending" request)
    if (!isPending) {
      storage.updateRequestResponse(id, {
        status: req.responseStatus,
        headers: req.responseHeaders,
        body: req.responseBody ? Buffer.from(req.responseBody) : undefined,
        durationMs: req.durationMs,
        responseBodyTruncated: false,
      });
    }

    // Mark interception if present
    if (req.interceptedBy && req.interceptionType) {
      storage.updateRequestInterception(id, req.interceptedBy, req.interceptionType);
    }

    // Mark saved/bookmarked requests
    if (req.saved) {
      storage.bookmarkRequest(id);
    }

    const statusStr = isPending ? "..." : String(req.responseStatus);
    const sourceTag = `[${req.source}]`.padEnd(12);
    console.log(`  ${sourceTag} ${req.method.padEnd(7)} ${statusStr.padStart(3)}  ${req.path}`);
    requestCount++;
  }

  console.log(`\nDone! Inserted ${requestCount} requests across ${SESSIONS.length} sessions.`);
  console.log("\nRun 'htap tui' to inspect the seeded data.");

  storage.close();
}

/** Fisher-Yates shuffle */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

seed();
