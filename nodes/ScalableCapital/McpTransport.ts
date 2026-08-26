import type { IExecuteFunctions, ILoadOptionsFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { PROTOCOL_VERSION, parseMcpResponse, type McpTool } from './parseResponse';

export { PROTOCOL_VERSION, parseMcpResponse };
export type { McpTool };

export class McpSession {
	private sessionId?: string;
	private nextId = 1;
	private initialised = false;
	private toolCache?: McpTool[];

	private ctx: IExecuteFunctions | ILoadOptionsFunctions;
	private url: string;
	private credentialType: string;

	constructor(
		ctx: IExecuteFunctions | ILoadOptionsFunctions,
		url: string,
		credentialType = 'scalableCapitalMcpApi',
	) {
		this.ctx = ctx;
		this.url = url;
		this.credentialType = credentialType;
	}

	private async rpc(method: string, params?: Record<string, unknown>, notification = false) {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
		};
		if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
		if (this.initialised) headers['MCP-Protocol-Version'] = PROTOCOL_VERSION;

		const body: Record<string, unknown> = { jsonrpc: '2.0', method };
		if (params) body.params = params;
		if (!notification) body.id = this.nextId++;

		const response = await this.ctx.helpers.httpRequestWithAuthentication.call(
			this.ctx,
			this.credentialType,
			{ method: 'POST', url: this.url, headers, body, json: true, returnFullResponse: true },
		);

		const captured = response.headers?.['mcp-session-id'] ?? response.headers?.['Mcp-Session-Id'];
		if (typeof captured === 'string' && captured) this.sessionId = captured;

		if (notification) return undefined;

		const parsed = parseMcpResponse(response.body, String(response.headers?.['content-type'] ?? ''));
		if (!parsed) {
			throw new NodeOperationError(this.ctx.getNode(), `Empty response from MCP for "${method}"`);
		}
		if (parsed.error) {
			throw new NodeApiError(this.ctx.getNode(), parsed.error as unknown as JsonObject, {
				message: `MCP error on "${method}": ${parsed.error.message}`,
			});
		}
		return parsed.result;
	}

	async init() {
		if (this.initialised) return;
		await this.rpc('initialize', {
			protocolVersion: PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: 'n8n-nodes-scalable-capital', version: '0.1.0' },
		});
		this.initialised = true;
		await this.rpc('notifications/initialized', undefined, true);
	}

	/** Cached: the read-only gate asks for the catalogue on every item. */
	async listTools(): Promise<McpTool[]> {
		if (this.toolCache) return this.toolCache;
		await this.init();
		const tools: McpTool[] = [];
		let cursor: string | undefined;
		do {
			const result = (await this.rpc('tools/list', cursor ? { cursor } : undefined)) ?? {};
			tools.push(...((result.tools as McpTool[]) ?? []));
			cursor = result.nextCursor as string | undefined;
		} while (cursor);
		this.toolCache = tools;
		return tools;
	}

	async callTool(name: string, args: Record<string, unknown>) {
		await this.init();
		return (await this.rpc('tools/call', { name, arguments: args })) ?? {};
	}
}
