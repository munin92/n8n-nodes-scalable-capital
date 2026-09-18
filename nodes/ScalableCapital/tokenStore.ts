/**
 * Access-Token-Haltung mit rotierendem Refresh-Token.
 *
 * Scalable gibt bei JEDEM Refresh ein neues refresh_token aus und entwertet das
 * alte (am 2026-08-26 am echten Konto ausgeloest). Ein fest im Credential
 * hinterlegtes Token traegt damit genau einen Lauf. Der jeweils aktuelle Stand
 * lebt deshalb im Workflow-Static-Store; das Credential liefert nur den
 * Startwert.
 *
 * Der Store allein traegt nicht: n8n sichert Static Data nur nach einem
 * erfolgreichen Trigger-Lauf. Handlaeufe und abgebrochene Laeufe verwerfen das
 * rotierte Token (2026-09-17: invalid_grant). Mit `persist` wandert jedes neue
 * Token zusaetzlich ins Credential zurueck.
 *
 * Bewusst frei von n8n-Importen, damit die Faelle einzeln pruefbar sind.
 */

export interface TokenStore {
	accessToken?: string;
	/** Ablauf als Millisekunden-Zeitstempel. */
	expiresAt?: number;
	/** Der zuletzt ausgegebene Refresh-Token; schlaegt den aus dem Credential. */
	refreshToken?: string;
	/** Credential-Wert, als `refreshToken` geschrieben wurde. Weicht das Credential ab, ist es neuer. */
	seed?: string;
}

export interface TokenResponse {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
}

export interface RefreshDeps {
	post(form: Record<string, string>): Promise<TokenResponse>;
	now(): number;
	/** Schreibt ein rotiertes Refresh-Token ins Credential zurueck. */
	persist?(refreshToken: string): Promise<void>;
	/** Meldet einen gescheiterten Rueckschrieb, ohne den Lauf abzubrechen. */
	warn?(message: string): void;
}

const LEGACY_KEY = 'scalableCapital';

/**
 * Ein Store je Credential: zwei Credentials in einem Workflow verglichen sonst
 * das eine mit dem `seed` des anderen. Einen Store aus aelteren Versionen
 * uebernimmt das erste Credential, das ihn findet.
 */
export function storeFor(root: Record<string, unknown>, credentialId: string | undefined): TokenStore {
	const key = credentialId ? `${LEGACY_KEY}:${credentialId}` : LEGACY_KEY;
	if (root[key] === undefined && key !== LEGACY_KEY && root[LEGACY_KEY] !== undefined) {
		root[key] = root[LEGACY_KEY];
		delete root[LEGACY_KEY];
	}
	return ((root[key] as TokenStore) ??= {});
}

/**
 * Reihenfolge der Kandidaten. Das Credential gewinnt, sobald es sich seit dem
 * Schreiben des Stores geaendert hat - neu eingefuegt oder per `persist`
 * nachgezogen. Ohne `seed` (Store aus aelteren Versionen) bleibt der Store vorn.
 */
export function refreshCandidates(store: TokenStore, credentialToken: string): string[] {
	const credentialNewer =
		store.seed !== undefined && credentialToken !== '' && credentialToken !== store.seed;
	const order = credentialNewer
		? [credentialToken, store.refreshToken]
		: [store.refreshToken, credentialToken];
	return [...new Set(order.filter((t): t is string => !!t))];
}

const isInvalidGrant = (error: unknown) => /invalid_grant/.test(String((error as Error)?.message ?? error));

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

	const candidates = refreshCandidates(store, credentials.refreshToken);

	if (candidates.length && credentials.clientId) {
		let res: TokenResponse | undefined;
		let failure: unknown;
		for (const [i, refreshToken] of candidates.entries()) {
			failure = undefined;
			try {
				res = await deps.post({
					grant_type: 'refresh_token',
					refresh_token: refreshToken,
					client_id: credentials.clientId,
				});
				break;
			} catch (error) {
				failure = error;
				// Ein abgelehnter Token verbraucht nichts; der andere Kandidat darf es versuchen.
				if (!(i < candidates.length - 1 && isInvalidGrant(error))) break;
			}
		}
		if (failure !== undefined) throw failure;
		if (!res?.access_token) {
			throw new Error(
				'Token refresh returned no access_token. Get a new refresh token with scripts/get-refresh-token.mjs.',
			);
		}
		store.accessToken = res.access_token;
		store.expiresAt = deps.now() + (res.expires_in ?? 0) * 1000;
		// Nur ueberschreiben, wenn wirklich rotiert wurde - sonst verloere ein
		// Server ohne Rotation seinen einzigen gueltigen Token.
		if (res.refresh_token) {
			store.refreshToken = res.refresh_token;
			store.seed = credentials.refreshToken;
			if (deps.persist) {
				try {
					await deps.persist(res.refresh_token);
					store.seed = res.refresh_token;
				} catch (error) {
					deps.warn?.(
						`Could not write the rotated refresh token back to the credential: ${(error as Error)?.message ?? error}`,
					);
				}
			}
		}
		return store.accessToken;
	}

	if (credentials.accessToken) return credentials.accessToken;

	throw new Error('No credentials: set Client ID and Refresh Token (recommended), or an Access Token.');
}
