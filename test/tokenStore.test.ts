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

test('no credentials at all is an explicit error', async () => {
	await assert.rejects(
		ensureAccessToken({}, creds({ clientId: '', refreshToken: '', accessToken: '' }), {
			post: fakePost([{}]).post,
			now: () => 0,
		}),
		/No credentials/,
	);
});
