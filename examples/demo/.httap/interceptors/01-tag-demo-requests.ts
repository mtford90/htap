// Config-as-code demo: tag every /api/ response with a custom header and log
// it. Forwards to the real mock API, so it shows up in the TUI as "modified"
// (the M badge) rather than fully mocked.
import type { Interceptor } from "@mtford/httap/interceptors";

export default {
  name: "tag-demo-requests",
  // Leave /api/quote alone — it's fully mocked by 02-mock-quote.ts, and
  // interceptors match first-wins, so this must not shadow it.
  match: (req) => req.path.startsWith("/api/") && req.path !== "/api/quote",
  handler: async (ctx) => {
    ctx.log(`${ctx.request.method} ${ctx.request.path}`);
    const response = await ctx.forward();
    return { ...response, headers: { ...response.headers, "x-httap-demo": "tagged" } };
  },
} satisfies Interceptor;
