/**
 * Rueckschrieb ins eigene Credential ueber n8ns Public API
 * (`PATCH /api/v1/credentials/{id}`, seit n8n 2.4, Scope `credential:update`).
 * `isPartialData` fuehrt die Felder mit den gespeicherten zusammen - ohne das
 * ersetzt n8n das ganze Datenobjekt und Client ID samt Endpunkten waeren weg.
 *
 * Bewusst frei von n8n-Importen, damit es ohne Laufzeit pruefbar ist.
 */

export interface WriteBackRequest {
	method: 'PATCH';
	url: string;
	headers: Record<string, string>;
	body: { data: Record<string, string>; isPartialData: true };
}

/** Nimmt die Basis-URL mit oder ohne `/api/v1` und mit oder ohne Schraegstrich. */
export function credentialWriteBackRequest(
	apiUrl: string,
	apiKey: string,
	credentialId: string,
	data: Record<string, string>,
): WriteBackRequest {
	const base = apiUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '');
	return {
		method: 'PATCH',
		url: `${base}/api/v1/credentials/${encodeURIComponent(credentialId)}`,
		headers: { 'X-N8N-API-KEY': apiKey.trim(), 'Content-Type': 'application/json' },
		body: { data, isPartialData: true },
	};
}
