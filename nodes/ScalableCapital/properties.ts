/**
 * Baut die n8n-Eigenschaften aus dem erzeugten Werkzeugkatalog.
 *
 * Bewusst frei von Laufzeit-Importen aus n8n (nur Typen), damit sich die
 * Ableitung einzeln pruefen laesst - 39 Werkzeuge mit 98 Feldern faellt ein
 * Fehler sonst erst in der Oberflaeche auf.
 */
import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

import type { ScalableField, ScalableTool } from './tools.generated';

type Sichtbar = NonNullable<IDisplayOptions['show']>;

const NUR_V2: Sichtbar = { '@version': [2] };

/** Aus `portfolioId` wird `Portfolio ID`, aus `fromTime` `From Time`. */
export function titel(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.replace(/\bId\b/g, 'ID')
		.replace(/\bIsins\b/g, 'ISINs')
		.replace(/\bIsin\b/g, 'ISIN');
}

function feld(f: ScalableField, sichtbar: Sichtbar): INodeProperties {
	const basis = {
		displayName: titel(f.name),
		name: f.name,
		required: f.required || undefined,
		description: f.description || undefined,
		displayOptions: { show: sichtbar },
	};

	switch (f.kind) {
		case 'boolean':
			return { ...basis, type: 'boolean', default: false };
		case 'number':
			return {
				...basis,
				type: 'number',
				default: f.minimum ?? 0,
				typeOptions: {
					...(f.minimum !== undefined ? { minValue: f.minimum } : {}),
					...(f.maximum !== undefined ? { maxValue: f.maximum } : {}),
				},
			};
		case 'options':
			return {
				...basis,
				type: 'options',
				default: f.options?.[0] ?? '',
				options: (f.options ?? []).map((o) => ({ name: titel(o), value: o })),
			};
		case 'csv':
			return {
				...basis,
				type: 'string',
				default: '',
				placeholder: 'wert1, wert2',
				description: [f.description, 'Mehrere Werte durch Komma trennen.']
					.filter(Boolean)
					.join(' '),
			};
		case 'json':
			// oneOf-Vereinigungen und verschachtelte Objekte bleiben JSON. Sie
			// flach zu klopfen hiesse, eine Struktur zu erfinden, die der Server
			// nicht kennt - betrifft nur die Handelswerkzeuge.
			return { ...basis, type: 'json', default: '{}' };
		default:
			return { ...basis, type: 'string', default: '' };
	}
}

export function buildProperties(tools: ScalableTool[]): INodeProperties[] {
	const ressourcen = [...new Map(tools.map((t) => [t.resource, t.resourceName])).entries()].sort(
		(a, b) => a[1].localeCompare(b[1]),
	);

	const props: INodeProperties[] = [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: NUR_V2 },
			options: [
				...ressourcen.map(([value, name]) => ({ name, value })),
				{
					name: 'Advanced',
					value: 'advanced',
					description: 'Call any tool by name, or list the catalogue the server offers',
				},
			],
			default: ressourcen[0]?.[0] ?? 'advanced',
		},
	];

	for (const [resource] of ressourcen) {
		const eigene = tools.filter((t) => t.resource === resource);
		props.push({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { ...NUR_V2, resource: [resource] } },
			options: eigene.map((t) => ({
				name: t.title,
				value: t.tool,
				description: t.description || undefined,
				action: t.title,
			})),
			default: eigene[0]?.tool ?? '',
		});
	}

	for (const t of tools) {
		const sichtbar = { ...NUR_V2, resource: [t.resource], operation: [t.tool] };
		const pflicht = t.fields.filter((f) => f.required);
		const optional = t.fields.filter((f) => !f.required);

		// Pflichtfelder stehen oben. Sie in eine Sammlung zu stecken, die man
		// erst aufklappen muss, war der Bedienfehler der Securo-Node: dort ist
		// `q` pflicht, versteckt, und ohne den Wert antwortet der Server 422.
		for (const f of pflicht) props.push(feld(f, sichtbar));

		if (optional.length) {
			props.push({
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add field',
				default: {},
				displayOptions: { show: sichtbar },
				// In einer Sammlung darf kein displayOptions stehen - die Sichtbarkeit
				// regelt die Sammlung selbst.
				options: optional.map((f) => {
					const eintrag = { ...feld(f, sichtbar) };
					delete eintrag.displayOptions;
					return eintrag;
				}),
			});
		}
	}

	return props;
}

/** Setzt die Feldwerte zu dem Argumentobjekt zusammen, das der MCP erwartet. */
export function buildArguments(
	t: ScalableTool,
	lies: (name: string, fallback?: unknown) => unknown,
): Record<string, unknown> {
	const args: Record<string, unknown> = {};
	const zusatz = (lies('additionalFields', {}) ?? {}) as Record<string, unknown>;

	for (const f of t.fields) {
		const roh = f.required ? lies(f.name, undefined) : zusatz[f.name];
		const wert = deuten(f, roh);
		if (wert !== undefined) args[f.name] = wert;
	}
	return args;
}

function deuten(f: ScalableField, roh: unknown): unknown {
	if (roh === undefined || roh === null) return undefined;

	if (f.kind === 'csv') {
		const teile = String(roh)
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		return teile.length ? teile : undefined;
	}

	if (f.kind === 'json') {
		if (typeof roh !== 'string') return roh;
		const s = roh.trim();
		// Ein leeres Objekt ist der Vorgabewert des Feldes und bedeutet
		// "nicht gesetzt", nicht "sende {}".
		if (!s || s === '{}') return undefined;
		try {
			return JSON.parse(s);
		} catch (e) {
			// Bewusst ein einfacher Error: dieses Modul haelt sich frei von
			// n8n-Laufzeitimporten, damit die Ableitung einzeln pruefbar bleibt.
			// Der Knoten setzt daraus einen NodeOperationError.
			// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
			throw new Error(`Field "${titel(f.name)}" is not valid JSON: ${(e as Error).message}`);
		}
	}

	if (f.kind === 'number') {
		const n = Number(roh);
		return Number.isFinite(n) ? n : undefined;
	}

	if (f.kind === 'boolean') return roh === true || roh === 'true';

	// Leere Zeichenketten sind "nicht ausgefuellt". Ein Pflichtfeld leer zu
	// lassen faellt beim Server auf, nicht hier - dessen Fehlermeldung ist
	// genauer als jede, die ich hier erfinden koennte.
	const s = String(roh).trim();
	return s === '' ? undefined : s;
}
