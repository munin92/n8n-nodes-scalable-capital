import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMcpResponse } from '../nodes/ScalableCapital/parseResponse.ts';

test('passes a parsed JSON body through untouched', () => {
	const body = { jsonrpc: '2.0', id: 1, result: { tools: [] } };
	assert.deepEqual(parseMcpResponse(body, 'application/json'), body);
});

test('parses a JSON string body', () => {
	const parsed = parseMcpResponse('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}', 'application/json');
	assert.equal(parsed?.result?.ok, true);
});

test('reads the answer out of an SSE stream', () => {
	const sse = ['event: message', 'data: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}', '', ''].join('\n');
	const parsed = parseMcpResponse(sse, 'text/event-stream');
	assert.equal(parsed?.id, 7);
	assert.equal(parsed?.result?.ok, true);
});

test('skips progress notifications and keeps the reply that carries the id', () => {
	const sse = [
		'data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":1}}',
		'',
		'data: {"jsonrpc":"2.0","id":3,"result":{"done":true}}',
		'',
	].join('\n');
	const parsed = parseMcpResponse(sse, 'text/event-stream');
	assert.equal(parsed?.id, 3);
	assert.equal(parsed?.result?.done, true);
});

test('keeps a JSON-RPC error so the caller can surface it', () => {
	const sse = 'data: {"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"Method not found"}}\n\n';
	assert.equal(parseMcpResponse(sse, 'text/event-stream')?.error?.code, -32601);
});

test('returns undefined for an empty body', () => {
	assert.equal(parseMcpResponse('', 'text/event-stream'), undefined);
	assert.equal(parseMcpResponse(undefined), undefined);
});

test('ignores a [DONE] sentinel', () => {
	const sse = 'data: {"jsonrpc":"2.0","id":9,"result":{}}\n\ndata: [DONE]\n\n';
	assert.equal(parseMcpResponse(sse, 'text/event-stream')?.id, 9);
});
