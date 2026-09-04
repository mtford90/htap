# httap demo

A tiny, self-contained project for trying httap: a mock API, a traffic
generator that calls it through the proxy, and two example interceptors
showing the config-as-code pillar. No network access required.

Everything below runs from the **repository root**, after `pnpm install &&
pnpm build`.

## Quick start (one command)

```bash
pnpm demo
```

This starts httap against this directory, seeds a burst of traffic, and
prints the command to open the TUI.

## The three-command flow

Run each of these from the repository root.

**1. Start httap**

```bash
eval "$(node dist/cli/index.js --dir examples/demo on)"
```

Starts the daemon (isolated in `examples/demo/.httap/`) and loads the two
interceptors below.

**2. Start the traffic generator**

```bash
node examples/demo/app/traffic.mjs
```

Starts the local mock API and immediately fires a burst of GET/POST/PUT/DELETE
requests through the proxy — JSON, HTML, a binary image, a large report body,
a redirect chain, a slow request, and a couple of 4xx/5xx errors. It then
keeps polling every 0.7–2.5s so the TUI shows live arrivals, like a real app.
Leave this running; press `Ctrl+C` to stop.

**3. Open the TUI**

In another terminal:

```bash
node dist/cli/index.js --dir examples/demo tui
```

## A short tour

Once the TUI is open:

| Try                                   | Key                         |
| ------------------------------------- | --------------------------- |
| Navigate the request list             | `j` / `k` (or arrow keys)   |
| Filter — try `users` or `body:error`  | `/`                         |
| Open a request's detail panel         | `Tab`                       |
| Open a JSON body in the JSON explorer | `Enter` on a JSON body      |
| See which requests were mocked/tagged | `L` (interceptor event log) |
| Export a request as cURL/HAR/etc.     | `e`                         |
| Scroll                                | mouse wheel                 |

The recorded `demo.tape` scrolls with `Ctrl+d` / `Ctrl+u` instead of the mouse wheel because vhs 0.11.0 has no scripted way to deliver wheel events to the child TUI process; the TUI's own mouse wheel support is unaffected.

Look for `GET /api/quote` in the list — it's fully mocked (never reaches the
mock API) and `/api/users`, `/api/report`, etc. are tagged with an
`x-httap-demo` response header. Both show up with the interceptor badge; open
the interceptor event log (`L`) to see which interceptor handled each one.

## Config-as-code

`.httap/interceptors/` has two examples (see
[Interceptors](../../docs/interceptors.md) for the full pattern reference):

- **`01-tag-demo-requests.ts`** — forwards every `/api/*` request to the real
  mock API, then adds an `x-httap-demo: tagged` response header. Shows up in
  the TUI as **modified**.
- **`02-mock-quote.ts`** — fully mocks `GET /api/quote` with a canned
  response, no upstream call. Shows up in the TUI as **mocked**.

Edit either file and run `httap --dir examples/demo daemon restart` to see
your changes take effect (interceptor changes are picked up when a session
starts; use a full restart rather than `interceptors reload` if a match
function itself changes).

## What's in here

```
examples/demo/
├── README.md
├── app/
│   ├── api.mjs        # mock API: JSON/HTML/binary responses, errors, redirects, a slow endpoint
│   └── traffic.mjs     # starts the mock API and drives traffic through the httap proxy
└── .httap/
    └── interceptors/   # the two example interceptors above (committed; everything else in
                         # .httap/ — the database, certs, sockets — is gitignored runtime state)
```

## Resetting

To start over with a clean slate:

```bash
node dist/cli/index.js --dir examples/demo requests clear --yes
node dist/cli/index.js --dir examples/demo daemon stop
```
