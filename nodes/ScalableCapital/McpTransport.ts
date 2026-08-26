import type { IExecuteFunctions, ILoadOptionsFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { PROTOCOL_VERSION, parseMcpResponse, type McpTool } from './parseResponse';
import { errorDetail } from './errorDetail';

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
	 * Holt das Access-Token. Mit refreshToken wird es bei jedem Lauf frisch
	 * getauscht - Scalable laesst n8ns Web-Rueckleitung nicht registrieren, der
	 * Browser-Teil laeuft also einmalig ausserhalb, der Refresh hier.
	 */
	private async token(): Promise<string> {
		if (this.bearer) return this.bearer;

		const c = await this.ctx.getCredentials(this.credentialType);
		const refreshToken = (c.refreshToken as string) ?? '';
		const clientId = (c.clientId as string) ?? '';

		if (refreshToken && clientId) {
			const body = new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: clientId,
			}).toString();
			// No `json: true` here. It makes n8n send Content-Type application/json,
			// which this server does not parse as a token request at all:
			//   form-encoded -> 400 invalid_grant   ("refresh token is invalid...")
			//   json         -> 400 invalid_request ("grant_type is required")
			// The second is what a wrongly encoded request looks like.
			let raw: string;
			try {
				raw = (await this.ctx.helpers.httpRequest({
					method: 'POST',
					url: (c.tokenUrl as string) || 'https://mcp.scalable.capital/token',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body,
				})) as string;
			} catch (error) {
				// Surface the server's own error_description - "request failed with
				// status 400" on its own says nothing about what to fix. The body
				// sits in different places depending on how n8n wraps axios, so try
				// each of them rather than guess one.
				const detail = errorDetail(error);
				throw new NodeOperationError(
					this.ctx.getNode(),
					`Token refresh rejected by ${(c.tokenUrl as string) || 'the token endpoint'}: ${detail}`,
				);
			}

			const parsed = (typeof raw === 'string' ? JSON.parse(raw || '{}') : raw) as {
				access_token?: string;
			};
			if (!parsed?.access_token) {
				throw new NodeOperationError(
					this.ctx.getNode(),
					'Token refresh returned no access_token. Get a new refresh token with scripts/get-refresh-token.mjs.',
				);
			}
			this.bearer = parsed.access_token;
			return this.bearer;
		}

		const accessToken = (c.accessToken as string) ?? '';
		if (!accessToken) {
			throw new NodeOperationError(
				this.ctx.getNode(),
				'No credentials: set Client ID and Refresh Token (recommended), or an Access Token.',
			);
		}
		this.bearer = accessToken;
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
