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

Two credential types. **Prefer OAuth2** — an access token from this server expires
within the hour, which stops any scheduled workflow until someone pastes a new one.

### OAuth2 (recommended)

Credential **Scalable Capital OAuth2 API**. n8n runs the authorization-code + PKCE
flow itself and keeps the session alive with the refresh token. Everything except
the client ID is prefilled from the server's own discovery document:

```console
$ curl -s https://mcp.scalable.capital/.well-known/oauth-authorization-server | jq
{ "authorization_endpoint": "https://mcp.scalable.capital/authorize",
  "token_endpoint":         "https://mcp.scalable.capital/token",
  "registration_endpoint":  "https://mcp.scalable.capital/register",
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["openid", "profile", "offline_access"] }
```

`offline_access` is what makes the refresh possible.

The server issues client IDs through RFC 7591 dynamic registration, so register
once and paste the result into the credential:

```console
$ curl -sX POST https://mcp.scalable.capital/register \
    -H 'Content-Type: application/json' \
    -d '{"client_name":"n8n","redirect_uris":["<your n8n OAuth Redirect URL>"],
         "grant_types":["authorization_code","refresh_token"],
         "response_types":["code"],"token_endpoint_auth_method":"none"}'
```

Take the **OAuth Redirect URL** from the credential screen in n8n and use that exact
value as `redirect_uris`. This is a public client — leave **Client Secret** empty.

### Access Token

Credential **Scalable Capital MCP**. Paste a bearer token, for example one obtained
with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector). Simple
to get going, but it expires — use it to try things out, not to run a schedule.

Obtain either one yourself. Scalable's CLI README is explicit:

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
