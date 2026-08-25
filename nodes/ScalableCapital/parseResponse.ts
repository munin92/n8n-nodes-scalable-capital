/**
 * Pure parsing helpers. Deliberately free of n8n imports so they can be unit
 * tested without loading the n8n runtime.
 */

export const PROTOCOL_VERSION = '2025-06-18';

export interface McpTool {
	name: string;
	title?: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
}

export interface JsonRpcResponse {
	jsonrpc: '2.0';
	id?: number | string;
	result?: Record<string, unknown>;
	error?: { code: number; message: string; data?: unknown };
}

/**
 * A Streamable-HTTP response may be a single JSON object or an SSE stream, and
 * the server picks — so both shapes have to be handled on every call.
 */
export function parseMcpResponse(body: unknown, contentType = ''): JsonRpcResponse | undefined {
	if (body && typeof body === 'object') return body as JsonRpcResponse;

	const text = String(body ?? '');
	if (!text.trim()) return undefined;

	if (!contentType.includes('text/event-stream') && !text.startsWith('event:') && !text.includes('\ndata:') && !text.startsWith('data:')) {
		return JSON.parse(text) as JsonRpcResponse;
	}

	// Take the last data payload that carries a JSON-RPC id — earlier events may
	// be progress notifications, which have no id and are not the answer.
	let last: JsonRpcResponse | undefined;
	for (const line of text.split(/\r?\n/)) {
		if (!line.startsWith('data:')) continue;
		const payload = line.slice(5).trim();
		if (!payload || payload === '[DONE]') continue;
		let parsed: JsonRpcResponse;
		try {
			parsed = JSON.parse(payload) as JsonRpcResponse;
		} catch {
			continue;
		}
		if (parsed.id !== undefined || parsed.error) last = parsed;
	}
	return last;
}

