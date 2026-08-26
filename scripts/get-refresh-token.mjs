#!/usr/bin/env node
/**
 * Holt einmalig client_id und refresh_token fuer den Scalable-Capital-MCP.
 *
 * Scalable registriert nur Loopback-Rueckleitungen - eine Web-URL, wie n8n sie
 * serverseitig benutzt, weist der Server ab (400 invalid_redirect_uri,
 * "approved SaaS allowlist"). Deshalb laeuft der Browser-Teil hier lokal.
 *
 *   node scripts/get-refresh-token.mjs
 *
 * Das Skript laeuft auf deinem Rechner, die Werte erscheinen nur in deiner
 * Konsole. Danach in das n8n-Credential eintragen.
 */
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const AS = 'https://mcp.scalable.capital';
const PORT = Number(process.env.PORT ?? 8765);
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const b64 = (b) => b.toString('base64url');

const verifier = b64(randomBytes(32));
const challenge = b64(createHash('sha256').update(verifier).digest());
const state = b64(randomBytes(16));

const post = async (path, body, form = false) => {
	const res = await fetch(`${AS}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
		body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
	});
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(`${path}: HTTP ${res.status}, keine JSON-Antwort: ${text.slice(0, 200)}`);
	}
	if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${json.error ?? ''} ${json.error_description ?? ''}`);
	return json;
};

const reg = await post('/register', {
	client_name: 'n8n-nodes-scalable-capital',
	redirect_uris: [REDIRECT],
	grant_types: ['authorization_code', 'refresh_token'],
	response_types: ['code'],
	token_endpoint_auth_method: 'none',
	scope: 'openid profile offline_access',
});
console.log(`client_id: ${reg.client_id}\n`);

const authUrl =
	`${AS}/authorize?response_type=code&client_id=${encodeURIComponent(reg.client_id)}` +
	`&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent('openid profile offline_access')}` +
	`&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;

const code = await new Promise((resolve, reject) => {
	const server = createServer((req, res) => {
		const url = new URL(req.url, REDIRECT);
		if (url.pathname !== '/callback') return res.end();
		const err = url.searchParams.get('error');
		res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end(err ? `Fehlgeschlagen: ${err}` : 'Fertig - zurueck ins Terminal.');
		server.close();
		if (err) return reject(new Error(`${err}: ${url.searchParams.get('error_description') ?? ''}`));
		if (url.searchParams.get('state') !== state) return reject(new Error('state stimmt nicht'));
		resolve(url.searchParams.get('code'));
	});
	server.listen(PORT, '127.0.0.1', () => {
		console.log(`Browser oeffnet sich. Falls nicht, diese URL aufrufen:\n${authUrl}\n`);
		spawn('xdg-open', [authUrl], { stdio: 'ignore', detached: true }).on('error', () => {});
	});
	setTimeout(() => { server.close(); reject(new Error('Zeitueberschreitung nach 5 Minuten')); }, 300_000);
});

const tok = await post('/token', {
	grant_type: 'authorization_code',
	code,
	redirect_uri: REDIRECT,
	client_id: reg.client_id,
	code_verifier: verifier,
}, true);

if (!tok.refresh_token) {
	console.error('\nKein refresh_token erhalten - lief offline_access wirklich mit?');
	process.exit(1);
}
console.log('\nIn das n8n-Credential eintragen:\n');
console.log(`  Client ID     : ${reg.client_id}`);
console.log(`  Refresh Token : ${tok.refresh_token}`);
console.log(`\n(Access-Token laeuft in ${tok.expires_in ?? '?'} s ab - das erneuert die Node selbst.)`);
