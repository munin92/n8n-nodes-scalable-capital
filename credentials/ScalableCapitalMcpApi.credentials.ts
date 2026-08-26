import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * Kein Erben von n8ns oAuth2Api: dessen Rueckleitung ist eine Web-URL
 * (https://<host>/rest/oauth2-credential/callback), und die weist Scalable ab.
 * Am 2026-08-26 gegen /register gemessen:
 *
 *   https://n8n.../rest/oauth2-credential/callback -> 400 invalid_redirect_uri
 *       "Web clients may only register exact redirect URIs from the approved
 *        SaaS allowlist."
 *   http://localhost:8080/callback                 -> 201, client_id vergeben
 *   http://127.0.0.1:33418/callback                -> 201
 *
 * Nur Loopback-Clients also. Der Browser-Teil laeuft deshalb einmalig von Hand
 * (MCP Inspector o. ae.); der Refresh braucht keinen Browser und laeuft in der
 * Node. Mit clientId + refreshToken laeuft die Node unbeaufsichtigt.
 */
export class ScalableCapitalMcpApi implements ICredentialType {
	name = 'scalableCapitalMcpApi';

	icon = {
		light: 'file:../nodes/ScalableCapital/scalableCapital.light.svg',
		dark: 'file:../nodes/ScalableCapital/scalableCapital.dark.svg',
	} as const;

	displayName = 'Scalable Capital MCP API';

	documentationUrl = 'https://github.com/munin92/n8n-nodes-scalable-capital';


	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			description:
				'From a loopback registration at https://mcp.scalable.capital/register. Together with a refresh token this keeps the node running unattended.',
		},
		{
			displayName: 'Refresh Token',
			name: 'refreshToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Obtained once through the loopback authorization flow with scope offline_access. The node exchanges it for a fresh access token on every run.',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Only needed without a refresh token. Expires within the hour, so it suits a quick try rather than a schedule.',
		},
		{
			displayName: 'MCP Endpoint',
			name: 'endpoint',
			type: 'string',
			default: 'https://mcp.scalable.capital/mcp',
		},
		{
			displayName: 'Token Endpoint',
			name: 'tokenUrl',
			type: 'string',
			default: 'https://mcp.scalable.capital/token',
		},
	];
}
