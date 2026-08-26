/**
 * Pure helper, deliberately free of n8n imports so it can be unit tested without
 * loading the n8n runtime.
 */

/** Digs the response body out of whatever shape n8n/axios threw. */
export function errorDetail(error: unknown): string {
	const e = error as {
		response?: { data?: unknown; body?: unknown };
		cause?: { response?: { data?: unknown; body?: unknown }; error?: unknown };
		error?: unknown;
		description?: string;
		message?: string;
	};
	const candidates = [
		e?.response?.data,
		e?.response?.body,
		e?.cause?.response?.data,
		e?.cause?.response?.body,
		e?.cause?.error,
		e?.error,
		e?.description,
	];
	for (const c of candidates) {
		if (c === undefined || c === null || c === '') continue;
		if (typeof c === 'string') return c;
		try {
			return JSON.stringify(c);
		} catch {
			/* keep looking */
		}
	}
	return e?.message ?? String(error);
}
