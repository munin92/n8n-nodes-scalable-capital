import type { IExecuteFunctions, ILoadOptionsFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { PROTOCOL_VERSION, parseMcpResponse, type McpTool } from './parseResponse';
import { errorDetail } from './errorDetail';
import { ensureAccessToken, type TokenStore } from './tokenStore';

export { PROTOCOL_VERSION, parseMcpResponse, errorDetail };
export type { McpTool };

export class McpSession {
	private sessionId?: string;
	private nextId = 1;
	private initialised = false;
	private toolCache?: McpTool[];
	private bearer?: string;

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

	/**
	 * Holt das Access-Token. Der rotierende Refresh-Token lebt im
	 * Workflow-Static-Store, das Credential liefert nur den Startwert - siehe
	 * tokenStore.ts fuer den Grund.
	 */
	private async token(): Promise<string> {
		if (this.bearer) return this.bearer;

		const c = await this.ctx.getCredentials(this.credentialType);
		// Trim: a pasted value often carries a trailing newline or space, and the
		// server then rejects it as an unknown client.
		const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
		const tokenUrl = str(c.tokenUrl) || 'https://mcp.scalable.capital/token';

		const root = this.ctx.getWorkflowStaticData('global') as Record<string, unknown>;
		const store = ((root.scalableCapital as TokenStore) ??= {});

		this.bearer = await ensureAccessToken(
			store,
			{
				clientId: str(c.clientId),
				refreshToken: str(c.refreshToken),
				accessToken: str(c.accessToken),
			},
			{
				now: () => Date.now(),
				post: async (form) => {
					try {
						const raw = (await this.ctx.helpers.httpRequest({
							method: 'POST',
							url: tokenUrl,
							headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
							body: new URLSearchParams(form).toString(),
						})) as string;
						return typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
					} catch (error) {
						throw new NodeOperationError(
							this.ctx.getNode(),
							`Token refresh rejected by ${tokenUrl}: ${errorDetail(error)}`,
						);
					}
				},
			},
		).catch((error: Error) => {
			if (error instanceof NodeOperationError) throw error;
			throw new NodeOperationError(this.ctx.getNode(), error.message);
		});

		return this.bearer;
	}

	private async rpc(method: string, params?: Record<string, unknown>, notification = false) {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Authorization: `Bearer ${await this.token()}`,
		};
		if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
		if (this.initialised) headers['MCP-Protocol-Version'] = PROTOCOL_VERSION;

		const body: Record<string, unknown> = { jsonrpc: '2.0', method };
		if (params) body.params = params;
		if (!notification) body.id = this.nextId++;

		const response = await this.ctx.helpers.httpRequest({
			method: 'POST',
			url: this.url,
			headers,
			body,
			json: true,
			returnFullResponse: true,
		});

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
