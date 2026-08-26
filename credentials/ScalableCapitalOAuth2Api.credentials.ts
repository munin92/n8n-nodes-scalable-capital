import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * Erbt von n8ns generischem oAuth2Api, damit n8n den Flow selbst fuehrt und den
 * Zugang ueber den Refresh-Token wach haelt. Ein eingefuegtes Access-Token
 * laeuft nach etwa einer Stunde ab und legt jede Automatisierung still.
 *
 * Die Werte stammen aus der Discovery des Servers, nicht aus Annahmen:
 *   GET https://mcp.scalable.capital/.well-known/oauth-authorization-server
 *   -> authorization_endpoint, token_endpoint, code_challenge_methods ["S256"],
 *      token_endpoint_auth_methods ["none"], scopes [openid, profile, offline_access]
 */
export class ScalableCapitalOAuth2Api implements ICredentialType {
	name = 'scalableCapitalOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Scalable Capital OAuth2 API';

	documentationUrl = 'https://github.com/munin92/n8n-nodes-scalable-capital';

	icon = {
		light: 'file:../nodes/ScalableCapital/scalableCapital.light.svg',
		dark: 'file:../nodes/ScalableCapital/scalableCapital.dark.svg',
	} as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'pkce',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://mcp.scalable.capital/authorize',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://mcp.scalable.capital/token',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			// offline_access ist der Grund, warum n8n spaeter erneuern kann.
			default: 'openid profile offline_access',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			// Der Server fuehrt token_endpoint_auth_methods: ["none"] - ein
			// oeffentlicher Client, also keine Anmeldung per Header.
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
		{
			displayName: 'MCP Endpoint',
			name: 'endpoint',
			type: 'string',
			default: 'https://mcp.scalable.capital/mcp',
		},
	];
}
