# n8n-nodes-scalable-capital

An [n8n](https://n8n.io) community node for [Scalable Capital](https://scalable.capital),
talking to their official MCP endpoint at `https://mcp.scalable.capital/mcp`.

**Read-only by default.** See [Safety](#safety) — this is not incidental, it mirrors
a guarantee Scalable's own tooling makes.

> Not affiliated with or endorsed by Scalable Capital. This project is not
> investment advice.

## Why MCP and not the CLI

Scalable also ship an official CLI, [`scalable-cli`](https://github.com/ScalableCapital/scalable-cli).
It is the better tool at a terminal, but a poor fit for n8n. Its own capability
report says so:

```console
$ sc capabilities --json | jq .data.auth
{ "modes": ["device"], "non_interactive_modes": [] }
```

There is no non-interactive login. A node shelling out to `sc` would need a
human-refreshed broker session living inside the n8n container. The MCP endpoint
is a network call with OAuth refresh tokens (`offline_access` is advertised), which
is what a workflow engine can actually keep alive.

## Operations

Version 2 groups the server's 39 tools into resources and gives every tool real
fields, derived from the input schema the server publishes:

| Resource | Tools | Example |
| --- | --- | --- |
| Account | 3 | List Accessible Portfolios |
| Portfolio | 6 | Get Portfolio Holdings, List Portfolio Transactions |
| Portfolio Group | 7 | List Portfolio Groups |
| Security | 5 | Search Securities, Get Security Quote |
| Order | 6 | Preview Buy Order |
| Savings Plan | 5 | List Savings Plans |
| Watchlist | 3 | List Watchlist Items |
| Price Alert | 3 | List Price Alerts |
| Overnight Savings | 1 | Get Overnight Summary |
| Advanced | — | Execute Tool, List Tools |

Required arguments are ordinary fields. Optional ones sit under **Additional
Fields**. Types come from the schema: `pageSize` is a number bounded 1..100,
`venue` is a dropdown of `gettex`/`xetra`/`eix`, list arguments take a
comma-separated string. Only the trading tools keep a JSON field, for the
`oneOf` unions that describe quantity and order type — flattening those would
mean inventing a shape the server does not accept.

**Advanced** keeps the old behaviour: pick any tool by name and pass raw JSON.
That dropdown is still filled live from `tools/list`, so a tool Scalable adds
tomorrow is usable before this node is regenerated.

### Version 1

Nodes already placed in a workflow stay on version 1 and keep the raw
`Tool Name` + `Arguments` pair. Nothing about them changes. `test/built/node.test.mjs` asserts
that, field by field, against the built output.

### Regenerating the catalogue

`nodes/ScalableCapital/tools.generated.ts` is generated from
`scripts/tools.snapshot.json`, which is a copy of the server's own `tools/list`
reply:

```console
$ npm run generate
39 Werkzeuge in 9 Ressourcen: …
```

To refresh the snapshot, run the node itself with **Advanced → List Tools** and
save the result. The generator cannot fetch it: the endpoint needs OAuth, and the
refresh token rotates on every use. If Scalable adds a tool that no resource rule
matches, the generator **fails** rather than guessing — CI runs it and rejects a
snapshot that drifted from the generated file.

## Safety

Scalable's CLI declares this for every trade and savings-plan command:

```json
{ "mode": "two_phase_confirmation",
  "forbid_automatic_phase_2_execution": true,
  "confirmation_must_be_separate_step": true }
```

This node keeps that promise. **Execute Tool** refuses any tool that is not
read-only, using the server's own `readOnlyHint` / `destructiveHint` annotations
when present and a conservative name heuristic when they are absent. Overriding it
requires ticking *Allow Write Operations* per node, and you should only do that
where a person confirms each run.

Additional protection worth configuring at the CLI level (independent of n8n):
`[trade_controls]` with `allowed_isins`, `denied_isins` and `max_order_notional`.

## Authentication

Scalable Capital only registers **loopback** redirect URIs. Measured against
their registration endpoint on 2026-08-26:

```console
$ curl -sX POST https://mcp.scalable.capital/register -H 'Content-Type: application/json' \
    -d '{"redirect_uris":["https://n8n.example.com/rest/oauth2-credential/callback"], ...}'
{"error":"invalid_redirect_uri",
 "error_description":"Web clients may only register exact redirect URIs from the approved SaaS allowlist."}

$ ... -d '{"redirect_uris":["http://127.0.0.1:8765/callback"], ...}'
201  {"client_id":"..."}
```

So n8n's own OAuth2 credential cannot be used: its callback is a server-side web
URL. The browser step happens once on your machine instead, and the node handles
the refresh — which needs no browser.

### Get a refresh token (once)

```bash
node scripts/get-refresh-token.mjs
```

It registers a loopback client, opens the browser for the Scalable login, and
prints a **Client ID** and a **Refresh Token**. It runs locally; the values only
ever appear in your own console.

### Fill in the credential

| Field | |
| --- | --- |
| Client ID | from the script |
| Refresh Token | from the script — **the seed only**, see below |
| Access Token | leave empty when you have a refresh token |
| MCP Endpoint | `https://mcp.scalable.capital/mcp` |

Use **Test** in the credential: it performs the refresh and a real `initialize`
against the MCP server, so a green result means the whole chain works.

### Refresh token rotation

This server issues a **new** refresh token on every refresh and invalidates the
previous one. A token stored in the credential would therefore work exactly once.

The node keeps the current one in the workflow's static data; the credential
field is only the seed. It also caches the access token until shortly before it
expires, so a run that happens inside that window performs no refresh at all and
burns no rotation.

Two consequences worth knowing:

- **One credential per workflow.** Two workflows sharing a credential each keep
  their own static data and would invalidate each other's token.
- **If the static data is lost**, re-run the script and paste a fresh seed. The
  node then reports the server's own message — `invalid_grant` means exactly this.

Obtain the token yourself. Scalable's CLI README is explicit:

> For security and reliability, complete login yourself rather than via an AI agent.

## Install

The package is **scoped on purpose**. An unscoped `n8n-nodes-*` name is free for
anyone to register on npm, and this repository is public — so the name is known
before it is claimed. A config that installs an unclaimed name from the public
registry hands the instance to whoever registers it first. A scope belongs to the
account and cannot be taken.

In n8n: **Settings → Community nodes → Install**, then `@munin92/n8n-nodes-scalable-capital`.

Manually:

```bash
cd ~/.n8n/nodes
npm install @munin92/n8n-nodes-scalable-capital
```

## Status

Verified so far: TypeScript build, n8n community lint rules, and unit tests over
the Streamable-HTTP response parser (plain JSON, SSE, interleaved progress
notifications, JSON-RPC errors).

End-to-end in n8n 2.35.7 against a stub MCP server: the credential injects the
bearer token, the session id from `initialize` is carried on every later call,
SSE `tools/list` is parsed past an interleaved progress notification, and
`structuredContent` is unwrapped. The write guard was verified the only way that
counts — the stub recorded **zero** `tools/call` requests when a non-read-only
tool was invoked without the opt-in.

**Not yet verified against a live account** — that needs a token, which only the
account holder can obtain. If you run it, issue reports are welcome, especially
about the shape of `tools/call` results.

## Development

```bash
npm install
npm run build
npm run lint     # @n8n/eslint-plugin-community-nodes, the current official ruleset
npm test
```

Linting uses ESLint 9 with `@n8n/eslint-plugin-community-nodes`. The older
`eslint-plugin-n8n-nodes-base` is not used: its rules disagree with the current
ones (it rewrites `NodeConnectionTypes.Main` to the string literal `'main'`,
which the current plugin rejects) and its `documentationUrl` autofix mangles a
URL into camelCase.

Once published, `npx @n8n/scan-community-package @munin92/n8n-nodes-scalable-capital`
runs n8n's own security scan. It resolves the package from the registry, so it
cannot be run against a working copy.

## Releases

Versioning and `CHANGELOG.md` are driven by [semantic-release](https://semantic-release.gitbook.io)
from Conventional Commit messages: `fix:` bumps the patch, `feat:` the minor,
`BREAKING CHANGE:` the major. While the version stays on `0.x`, a `feat:` bumps
the minor rather than declaring 1.0 — the node has not been verified against a
live account yet, so claiming a stable major would be untrue.

The `Release` workflow publishes on every push to `main` via npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers) — no long-lived
token. It needs a trusted publisher configured on npmjs.com for this repository
and the workflow file `release.yml`, and the `id-token: write` permission the
workflow already declares. Do not hand-edit the version in `package.json`;
semantic-release owns it.

Publishing sets `provenance`, which is what n8n's own scanner checks:

```console
$ npx @n8n/scan-community-package @munin92/n8n-nodes-scalable-capital
```

Version 0.1.1 was published by hand to create the package (a trusted publisher
can only be configured on a package that already exists), so it carries no
attestation and will not pass that check. Every release from 0.1.2 on does.

## License

[MIT](LICENSE)
