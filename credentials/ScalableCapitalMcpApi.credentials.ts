import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ScalableCapitalMcpApi implements ICredentialType {
	name = 'scalableCapitalMcpApi';

	icon = { light: 'file:../nodes/ScalableCapital/scalableCapital.light.svg', dark: 'file:../nodes/ScalableCapital/scalableCapital.dark.svg' } as const;

	displayName = 'Scalable Capital MCP API';

	documentationUrl = 'https://github.com/munin92/n8n-nodes-scalable-capital';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'OAuth 2.1 bearer token for the Scalable Capital MCP endpoint. Obtain it yourself — Scalable states login must not be completed by an AI agent.',
		},
		{
			displayName: 'MCP Endpoint',
			name: 'endpoint',
			type: 'string',
			default: 'https://mcp.scalable.capital/mcp',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { Authorization: '=Bearer {{$credentials.accessToken}}' },
		},
	};

	// An expired token answers 401 with a WWW-Authenticate resource_metadata
	// pointer, so a plain initialize is enough to tell good from bad.
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			baseURL: '={{$credentials.endpoint}}',
			url: '',
			headers: { Accept: 'application/json, text/event-stream' },
			body: {
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 'n8n-credential-test', version: '0.1.0' },
				},
			},
		},
	};
}
