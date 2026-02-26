# Interceptors

[Back to README](../README.md) | [CLI Reference](cli-reference.md)

TypeScript files in `.htap/interceptors/` that intercept HTTP traffic as it passes through the proxy. They can return mock responses, modify upstream responses, or just observe.

```bash
htap interceptors init    # scaffold an example
htap interceptors reload  # reload after editing
```

## Mock

Return a response without hitting upstream:

```typescript
import type { Interceptor } from "@mtford/htap/interceptors";

export default {
  name: "mock-users",
  match: (req) => req.path === "/api/users",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify([{ id: 1, name: "Alice" }]),
  }),
} satisfies Interceptor;
```

## Mock Fictional Domains (Virtual Hosts)

Interceptors can mock completely non-existent domains too — no upstream DNS/host is required, as long as your request goes through the htap proxy.

```typescript
import type { Interceptor } from "@mtford/htap/interceptors";

export default {
  name: "fake-api",
  match: (req) => req.host === "my-fake-api.local" && req.path === "/users",
  handler: async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify([{ id: 1, name: "Mock User" }]),
  }),
} satisfies Interceptor;
```

Try it:

```bash
curl -x "$HTTP_PROXY" http://my-fake-api.local/users
curl -x "$HTTPS_PROXY" --cacert .htap/ca.pem https://my-fake-api.local/users
```

For HTTPS clients, trust the htap CA (`.htap/ca.pem`) so TLS validation succeeds.

## Modify

Forward to upstream, then alter the response:

```typescript
import type { Interceptor } from "@mtford/htap/interceptors";

export default {
  name: "inject-header",
  match: (req) => req.host.includes("example.com"),
  handler: async (ctx) => {
    const response = await ctx.forward();
    return { ...response, headers: { ...response.headers, "x-debug": "htap" } };
  },
} satisfies Interceptor;
```

## Observe

Log traffic without altering it:

```typescript
import type { Interceptor } from "@mtford/htap/interceptors";

export default {
  name: "log-api",
  match: (req) => req.path.startsWith("/api/"),
  handler: async (ctx) => {
    ctx.log(`${ctx.request.method} ${ctx.request.url}`);
    const response = await ctx.forward();
    ctx.log(`  -> ${response.status}`);
    return response;
  },
} satisfies Interceptor;
```

## Query Past Traffic

Interceptors can query the traffic database via `ctx.htap`. This lets you build mocks that react to what's already happened — rate limiting, conditional failures, responses based on prior requests:

```typescript
import type { Interceptor } from "@mtford/htap/interceptors";

export default {
  name: "rate-limit",
  match: (req) => req.path.startsWith("/api/"),
  handler: async (ctx) => {
    // Count how many requests this endpoint has seen in the last minute
    const since = new Date(Date.now() - 60_000).toISOString();
    const count = await ctx.htap.countRequests({
      path: ctx.request.path,
      since,
    });

    if (count >= 10) {
      return {
        status: 429,
        headers: { "retry-after": "60" },
        body: JSON.stringify({ error: "rate_limited" }),
      };
    }

    return ctx.forward();
  },
} satisfies Interceptor;
```

## Handler Context

| Property        | Description                               |
| --------------- | ----------------------------------------- |
| `ctx.request`   | The incoming request (frozen, read-only)  |
| `ctx.forward()` | Forward to upstream, returns the response |
| `ctx.htap`    | Query captured traffic (see below)        |
| `ctx.log(msg)`  | Write to `.htap/htap.log`             |

### `ctx.htap`

| Method                                       | Description                                  |
| -------------------------------------------- | -------------------------------------------- |
| `countRequests(filter?)`                     | Count matching requests                      |
| `listRequests({ filter?, limit?, offset? })` | List request summaries                       |
| `getRequest(id)`                             | Full request details by ID                   |
| `searchBodies({ query, ...filter? })`        | Full-text search through bodies              |
| `queryJsonBodies({ json_path, ...filter? })` | Extract values from JSON bodies via JSONPath |

## How Interceptors Work

- Any `.ts` file in `.htap/interceptors/` is loaded automatically
- Files load alphabetically; first match wins
- `match` is optional — omit it to match everything
- Hot-reloads on file changes, or run `htap interceptors reload`
- 30s handler timeout, 5s match timeout
- Errors fall through gracefully (never crashes the proxy)
- `ctx.log()` writes to `.htap/htap.log` since `console.log` goes nowhere in the daemon
- Use `satisfies Interceptor` for full intellisense
