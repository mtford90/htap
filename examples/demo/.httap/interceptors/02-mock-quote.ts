// Config-as-code demo: fully mock one endpoint instead of hitting the real
// mock API. Shows up in the TUI as "mocked" (the M badge, no upstream call).
import type { Interceptor } from "@mtford/httap/interceptors";

const QUOTES = [
  "The best way to predict the future is to implement it.",
  "Simplicity is the soul of efficiency.",
  "Programs must be written for people to read.",
];

export default {
  name: "mock-quote",
  match: (req) => req.method === "GET" && req.path === "/api/quote",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quote: QUOTES[Math.floor(Math.random() * QUOTES.length)] }),
  }),
} satisfies Interceptor;
