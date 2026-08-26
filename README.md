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

| Operation | What it does |
| --- | --- |
| **List Tools** | Returns the tool catalogue the server currently offers, with a `readOnly` flag |
| **Execute Tool** | Calls one tool by name with a JSON arguments object |

The tool dropdown is populated live from `tools/list` at design time. Nothing is
hardcoded, so a tool Scalable adds later appears without a node update.

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

Create a **Scalable Capital MCP** credential and paste an OAuth 2.1 access token.

Obtain the token yourself. Scalable's README is explicit:

> For security and reliability, complete login yourself rather than via an AI agent.

The endpoint advertises standard discovery, so any OAuth 2.1 client can complete
the flow:

```console
$ curl -s https://mcp.scalable.capital/.well-known/oauth-protected-resource/mcp
{"resource":"https://mcp.scalable.capital/mcp",
 "authorization_servers":["https://mcp.scalable.capital/"],
 "resource_name":"Scalable Capital MCP"}

$ curl -s https://mcp.scalable.capital/.well-known/oauth-authorization-server | jq
{ "authorization_endpoint": "https://mcp.scalable.capital/authorize",
  "token_endpoint":         "https://mcp.scalable.capital/token",
  "registration_endpoint":  "https://mcp.scalable.capital/register",
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["openid", "profile", "offline_access"] }
```

Request `offline_access` so the token can be refreshed.

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

## License

[MIT](LICENSE)
