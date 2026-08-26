# Contributing

Thanks for looking. This is a small package with a few sharp edges that are not
obvious from the code, so they are written down here rather than rediscovered.

## Getting set up

```bash
npm ci          # not `npm install` — see the eslint pin below
npm run build
npm run lint
npm test
```

Node 24 is what CI uses and what n8n itself runs (n8n 2.36.7 ships Node 24.18).
`engines` allows Node 20.15+ because that is what older n8n installations have —
the package is loaded by n8n, not run standalone.

## Testing against a real n8n

Unit tests cover the pure parts. They do not send a single request, so they
cannot catch a wrongly encoded body or a class that fails to load. Two bugs
shipped that way before this note existed.

For anything touching the transport or the credential, load the built package
into a real n8n and watch what arrives:

```bash
npm run build && npm pack
docker run -d --name n8ntest -u 0 \
  -e N8N_ENCRYPTION_KEY=test -e N8N_CUSTOM_EXTENSIONS=/custom \
  -v "$PWD/custom:/custom" n8nio/n8n:2.36.7
```

Put a stub server behind the endpoint and have it record what it receives —
content type, headers, body. Asserting on the stub's log is the only thing that
caught the form-encoding bug and the refresh-token rotation.

## Sharp edges

**`eslint` is pinned to an exact version.** `@n8n/eslint-plugin-community-nodes`
declares it as an exact peer. A caret range resolves higher, `npm install`
accepts it and `npm ci` refuses it — so CI breaks while your machine is fine.
Dependabot is configured to leave eslint alone; it moves when the plugin does.

**Do not use `NodeConnectionTypes.Main` in the node description.** The community
loader instantiates the class with `new`, which runs the field initialisers.
`n8n-workflow` is a peer dependency, and a shared `~/.n8n/nodes` often holds an
older copy without that constant. The result is a `TypeError`, which n8n reports
as *"Class could not be found"* — a message that sends you looking in entirely
the wrong place. Use the string literal with a cast.

**Do not lint `package.json` through the type-aware parser.** ESLint 9 skips a
file that no config matches and exits 0, so the package rules silently never
ran. The plugin's rules walk `ObjectExpression` from typescript-estree, not
`JSONObjectExpression`, so `jsonc-eslint-parser` makes them find nothing while
appearing configured.

**The Scalable server rotates refresh tokens.** Every refresh invalidates the
previous one. The credential field is a seed; the live token lives in the
workflow's static data. A credential therefore belongs to exactly one workflow.

## Commits and releases

Conventional Commits — semantic-release reads them and every push to `main`
publishes. `fix:` bumps the patch, `feat:` the minor, `BREAKING CHANGE:` the
major. Use `chore:` for anything that should not cut a release.

Do not edit the version in `package.json`; semantic-release owns it.

Publishing runs through npm [trusted publishing](https://docs.npmjs.com/trusted-publishers)
with no token in the repository, and sets provenance. `main` is protected
against force pushes and deletion.

## What a good change looks like

State what you measured, not what you expect. A commit message that says which
status code came back, and what the control query returned, is worth more than
one that says the fix works.
