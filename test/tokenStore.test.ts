import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ensureAccessToken, type TokenStore } from '../nodes/ScalableCapital/tokenStore.ts';

const creds = (o = {}) => ({ clientId: 'cid', refreshToken: 'seed-rt', accessToken: '', ...o });

function fakePost(responses: object[]) {
	const calls: Record<string, string>[] = [];
	let i = 0;
	return {
		calls,
		post: async (form: Record<string, string>) => {
			calls.push(form);
			return responses[Math.min(i++, responses.length - 1)];
		},
	};
}

test('first run uses the credential seed and stores what came back', async () => {
	const store: TokenStore = {};
	const f = fakePost([{ access_token: 'at-1', refresh_token: 'rt-2', expires_in: 1200 }]);
	const at = await ensureAccessToken(store, creds(), { post: f.post, now: () => 1_000_000 });
	assert.equal(at, 'at-1');
	assert.equal(f.calls[0].refresh_token, 'seed-rt');
	assert.equal(store.refreshToken, 'rt-2');
	assert.equal(store.expiresAt, 1_000_000 + 1_200_000);
});

test('a still-valid access token is reused, so no rotation is burned', async () => {
	const store: TokenStore = { accessToken: 'at-1', expiresAt: 2_000_000, refreshToken: 'rt-2' };
	const f = fakePost([{ access_token: 'sollte-nicht-passieren' }]);
	const at = await ensureAccessToken(store, creds(), { post: f.post, now: () => 1_000_000 });
	assert.equal(at, 'at-1');
	assert.equal(f.calls.length, 0, 'kein Refresh bei gueltigem Token');
});

test('expiry skew forces a refresh shortly before the token dies', async () => {
	const store: TokenStore = { accessToken: 'at-1', expiresAt: 1_030_000, refreshToken: 'rt-2' };
	const f = fakePost([{ access_token: 'at-2', refresh_token: 'rt-3', expires_in: 1200 }]);
	await ensureAccessToken(store, creds(), { post: f.post, now: () => 1_000_000 });
	assert.equal(f.calls.length, 1, 'innerhalb des Sicherheitsabstands wird erneuert');
});

test('the SECOND refresh uses the rotated token, never the seed again', async () => {
	const store: TokenStore = {};
	const f = fakePost([
		{ access_token: 'at-1', refresh_token: 'rt-2', expires_in: 1200 },
		{ access_token: 'at-2', refresh_token: 'rt-3', expires_in: 1200 },
	]);
	let clock = 1_000_000;
	const deps = { post: f.post, now: () => clock };
	await ensureAccessToken(store, creds(), deps);
	clock += 1_300_000; // abgelaufen
	await ensureAccessToken(store, creds(), deps);
	assert.deepEqual(
		f.calls.map((c) => c.refresh_token),
		['seed-rt', 'rt-2'],
	);
	assert.equal(store.refreshToken, 'rt-3');
});

test('a server without rotation keeps its single refresh token', async () => {
	const store: TokenStore = {};
	const f = fakePost([{ access_token: 'at-1', expires_in: 1200 }]);
	await ensureAccessToken(store, creds(), { post: f.post, now: () => 1_000_000 });
	assert.equal(store.refreshToken, undefined);
	// naechster Lauf greift wieder auf den Startwert zurueck
	const f2 = fakePost([{ access_token: 'at-2', expires_in: 1200 }]);
	await ensureAccessToken({ ...store, expiresAt: 0 }, creds(), { post: f2.post, now: () => 9_000_000 });
	assert.equal(f2.calls[0].refresh_token, 'seed-rt');
});

test('falls back to a pasted access token when no refresh token is configured', async () => {
	const f = fakePost([{}]);
	const at = await ensureAccessToken({}, creds({ refreshToken: '', accessToken: 'paste' }), {
		post: f.post,
		now: () => 0,
	});
	assert.equal(at, 'paste');
	assert.equal(f.calls.length, 0);
});

test('missing access_token in the response is reported, not swallowed', async () => {
	const f = fakePost([{ refresh_token: 'rt-2' }]);
	await assert.rejects(
		ensureAccessToken({}, creds(), { post: f.post, now: () => 0 }),
		/no access_token/,
	);
});

test('a rotated token is written back and becomes the new seed', async () => {
	const store: TokenStore = {};
	const f = fakePost([{ access_token: 'at-1', refresh_token: 'rt-2', expires_in: 1200 }]);
	const persisted: string[] = [];
	await ensureAccessToken(store, creds(), {
		post: f.post,
		now: () => 0,
		persist: async (rt) => void persisted.push(rt),
	});
	assert.deepEqual(persisted, ['rt-2']);
	assert.equal(store.seed, 'rt-2');
});

test('a failed write-back warns, keeps the run alive and the token in the store', async () => {
	const store: TokenStore = {};
	const f = fakePost([{ access_token: 'at-1', refresh_token: 'rt-2', expires_in: 1200 }]);
	const warnings: string[] = [];
	const at = await ensureAccessToken(store, creds(), {
		post: f.post,
		now: () => 0,
		persist: async () => {
			throw new Error('401');
		},
		warn: (m) => void warnings.push(m),
	});
	assert.equal(at, 'at-1');
	assert.equal(store.refreshToken, 'rt-2');
	assert.equal(store.seed, 'seed-rt', 'seed bleibt der Credential-Wert, damit der Store gewinnt');
	assert.match(warnings[0], /401/);
});

test('a credential changed since the store was written wins over the store', async () => {
	// Handlauf: Rueckschrieb gelang (Credential rt-3), der Store blieb auf rt-2.
	const store: TokenStore = { refreshToken: 'rt-2', seed: 'rt-2' };
	const f = fakePost([{ access_token: 'at-3', refresh_token: 'rt-4', expires_in: 1200 }]);
	await ensureAccessToken(store, creds({ refreshToken: 'rt-3' }), { post: f.post, now: () => 0 });
	assert.equal(f.calls[0].refresh_token, 'rt-3');
});

test('an unchanged credential leaves the store in front', async () => {
	const store: TokenStore = { refreshToken: 'rt-3', seed: 'seed-rt' };
	const f = fakePost([{ access_token: 'at-3', refresh_token: 'rt-4', expires_in: 1200 }]);
	await ensureAccessToken(store, creds(), { post: f.post, now: () => 0 });
	assert.equal(f.calls[0].refresh_token, 'rt-3');
});

test('invalid_grant on the store token falls back to the credential once', async () => {
	// Store aus aelterer Version ohne seed, frisch eingefuegtes Credential.
	const store: TokenStore = { refreshToken: 'tot' };
	const calls: string[] = [];
	const at = await ensureAccessToken(store, creds({ refreshToken: 'neu' }), {
		now: () => 0,
		post: async (form) => {
			calls.push(form.refresh_token);
			if (form.refresh_token === 'tot') throw new Error('{"error":"invalid_grant"}');
			return { access_token: 'at-neu', refresh_token: 'rt-neu', expires_in: 1200 };
		},
	});
	assert.deepEqual(calls, ['tot', 'neu']);
	assert.equal(at, 'at-neu');
});

test('other refresh errors are not retried with the second token', async () => {
	const calls: string[] = [];
	await assert.rejects(
		ensureAccessToken({ refreshToken: 'rt-2' }, creds(), {
			now: () => 0,
			post: async (form) => {
				calls.push(form.refresh_token);
				throw new Error('ECONNRESET');
			},
		}),
		/ECONNRESET/,
	);
	assert.deepEqual(calls, ['rt-2']);
});

test('no credentials at all is an explicit error', async () => {
	await assert.rejects(
		ensureAccessToken({}, creds({ clientId: '', refreshToken: '', accessToken: '' }), {
			post: fakePost([{}]).post,
			now: () => 0,
		}),
		/No credentials/,
	);
});
