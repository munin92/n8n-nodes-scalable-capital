import assert from 'node:assert/strict';
import { test } from 'node:test';

import { credentialWriteBackRequest } from '../nodes/ScalableCapital/credentialWriteBack.ts';

test('builds a partial PATCH against the public API', () => {
	const r = credentialWriteBackRequest('http://n8n:5678', ' key ', 'abc', { refreshToken: 'rt' });
	assert.equal(r.method, 'PATCH');
	assert.equal(r.url, 'http://n8n:5678/api/v1/credentials/abc');
	assert.equal(r.headers['X-N8N-API-KEY'], 'key');
	assert.deepEqual(r.body, { data: { refreshToken: 'rt' }, isPartialData: true });
});

test('accepts the base URL with /api/v1 and a trailing slash', () => {
	for (const base of ['http://n8n:5678/', 'http://n8n:5678/api/v1', 'http://n8n:5678/api/v1/']) {
		assert.equal(credentialWriteBackRequest(base, 'k', 'abc', {}).url, 'http://n8n:5678/api/v1/credentials/abc');
	}
});
