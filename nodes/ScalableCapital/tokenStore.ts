/**
 * Access-Token-Haltung mit rotierendem Refresh-Token.
 *
 * Scalable gibt bei JEDEM Refresh ein neues refresh_token aus und entwertet das
 * alte (am 2026-08-26 am echten Konto ausgeloest). Ein fest im Credential
 * hinterlegtes Token traegt damit genau einen Lauf. Der jeweils aktuelle Stand
 * lebt deshalb im Workflow-Static-Store; das Credential liefert nur den
 * Startwert.
 *
 * Bewusst frei von n8n-Importen, damit die Faelle einzeln pruefbar sind.
 */

export interface TokenStore {
	accessToken?: string;
	/** Ablauf als Millisekunden-Zeitstempel. */
	expiresAt?: number;
	/** Der zuletzt ausgegebene Refresh-Token; schlaegt den aus dem Credential. */
	refreshToken?: string;
}

export interface TokenResponse {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
}

export interface RefreshDeps {
	post(form: Record<string, string>): Promise<TokenResponse>;
	now(): number;
}

/** Sicherheitsabstand, damit ein Token nicht mitten im Lauf ablaeuft. */
export const EXPIRY_SKEW_MS = 60_000;

export async function ensureAccessToken(
	store: TokenStore,
	credentials: { clientId: string; refreshToken: string; accessToken: string },
	deps: RefreshDeps,
): Promise<string> {
	// Ein noch gueltiges Token spart den Refresh - und damit eine Rotation.
	if (store.accessToken && store.expiresAt && store.expiresAt - EXPIRY_SKEW_MS > deps.now()) {
		return store.accessToken;
	}

	const refreshToken = store.refreshToken || credentials.refreshToken;

	if (refreshToken && credentials.clientId) {
		const res = await deps.post({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: credentials.clientId,
		});
		if (!res?.access_token) {
			throw new Error(
				'Token refresh returned no access_token. Get a new refresh token with scripts/get-refresh-token.mjs.',
			);
		}
		store.accessToken = res.access_token;
		store.expiresAt = deps.now() + (res.expires_in ?? 0) * 1000;
		// Nur ueberschreiben, wenn wirklich rotiert wurde - sonst verloere ein
		// Server ohne Rotation seinen einzigen gueltigen Token.
		if (res.refresh_token) store.refreshToken = res.refresh_token;
		return store.accessToken;
	}

	if (credentials.accessToken) return credentials.accessToken;

	throw new Error('No credentials: set Client ID and Refresh Token (recommended), or an Access Token.');
}
