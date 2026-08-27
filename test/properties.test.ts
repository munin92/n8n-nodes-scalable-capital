import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildArguments, buildProperties, titel } from '../nodes/ScalableCapital/properties.ts';
import { TOOLS, type ScalableTool } from '../nodes/ScalableCapital/tools.generated.ts';

const props = buildProperties(TOOLS);
const finde = (name: string, resource?: string, operation?: string) =>
	props.find(
		(p) =>
			p.name === name &&
			(!resource || (p.displayOptions?.show?.resource as string[])?.includes(resource)) &&
			(!operation || (p.displayOptions?.show?.operation as string[])?.includes(operation)),
	);

test('titel macht aus Schluesselnamen lesbare Beschriftungen', () => {
	assert.equal(titel('portfolioId'), 'Portfolio ID');
	assert.equal(titel('fromTime'), 'From Time');
	assert.equal(titel('isin'), 'ISIN');
	assert.equal(titel('underlyingIsin'), 'Underlying ISIN');
	assert.equal(titel('pageSize'), 'Page Size');
});

test('jede erzeugte Eigenschaft haengt an Version 2, damit Version 1 unberuehrt bleibt', () => {
	for (const p of props) {
		assert.deepEqual(
			p.displayOptions?.show?.['@version'],
			[2],
			`${p.name} ist nicht auf Version 2 beschraenkt`,
		);
	}
});

test('jedes Werkzeug ist ueber genau eine Ressource erreichbar', () => {
	const resource = finde('resource');
	assert.ok(resource, 'Resource-Feld fehlt');
	const werte = new Set((resource!.options as Array<{ value: string }>).map((o) => o.value));
	for (const t of TOOLS) {
		assert.ok(werte.has(t.resource), `${t.tool}: Ressource ${t.resource} steht nicht zur Auswahl`);
		const op = props.find(
			(p) =>
				p.name === 'operation' &&
				(p.displayOptions?.show?.resource as string[])?.includes(t.resource),
		);
		assert.ok(op, `keine Operationsliste fuer ${t.resource}`);
		const ops = (op!.options as Array<{ value: string }>).map((o) => o.value);
		assert.ok(ops.includes(t.tool), `${t.tool} fehlt in der Operationsliste`);
	}
	assert.ok(werte.has('advanced'), 'Advanced-Ausweg fehlt');
});

test('Pflichtfelder stehen oben, nicht in der Sammlung', () => {
	for (const t of TOOLS) {
		for (const f of t.fields.filter((x) => x.required)) {
			const p = finde(f.name, t.resource, t.tool);
			assert.ok(p, `${t.tool}: Pflichtfeld ${f.name} ist nicht als eigenes Feld sichtbar`);
			assert.equal(p!.required, true, `${t.tool}.${f.name} ist nicht als required markiert`);
		}
		const sammlung = finde('additionalFields', t.resource, t.tool);
		if (sammlung) {
			const drin = (sammlung.options as Array<{ name: string }>).map((o) => o.name);
			for (const f of t.fields.filter((x) => x.required)) {
				assert.ok(!drin.includes(f.name), `${t.tool}: Pflichtfeld ${f.name} steckt in der Sammlung`);
			}
		}
	}
});

test('Feldtypen folgen dem Schema', () => {
	// pageSize ist integer mit 1..100 - das muss als Zahl mit Grenzen ankommen.
	const trans = TOOLS.find((t) => t.tool === 'list_portfolio_transactions')!;
	const sammlung = finde('additionalFields', trans.resource, trans.tool)!;
	const opts = sammlung.options as Array<Record<string, unknown>>;
	const seite = opts.find((o) => o.name === 'pageSize')!;
	assert.equal(seite.type, 'number');
	assert.deepEqual(seite.typeOptions, { minValue: 1, maxValue: 100 });

	// venue hat ein enum -> Auswahlliste statt Freitext.
	const kauf = TOOLS.find((t) => t.tool === 'preview_buy_order')!;
	const kaufSammlung = finde('additionalFields', kauf.resource, kauf.tool)!;
	const venue = (kaufSammlung.options as Array<Record<string, unknown>>).find(
		(o) => o.name === 'venue',
	)!;
	assert.equal(venue.type, 'options');
	assert.deepEqual(
		(venue.options as Array<{ value: string }>).map((o) => o.value),
		['gettex', 'xetra', 'eix'],
	);
});

test('buildArguments laesst Leeres weg und wandelt Kommalisten', () => {
	const t = TOOLS.find((x) => x.tool === 'list_portfolio_transactions')!;
	const args = buildArguments(t, (name, fallback) => {
		if (name === 'additionalFields') {
			return {
				portfolioId: 'abc',
				pageSize: 100,
				cursor: '',
				transactionTypes: 'buy, sell',
				searchTerm: '   ',
			};
		}
		return fallback;
	});
	assert.deepEqual(args, {
		portfolioId: 'abc',
		pageSize: 100,
		transactionTypes: ['buy', 'sell'],
	});
});

test('buildArguments liest Pflichtfelder von oben', () => {
	const t = TOOLS.find((x) => x.tool === 'get_transaction_details')!;
	const args = buildArguments(t, (name, fallback) => {
		if (name === 'transactionId') return 'tx-1';
		if (name === 'additionalFields') return {};
		return fallback;
	});
	assert.deepEqual(args, { transactionId: 'tx-1' });
});

test('ein leeres JSON-Feld bedeutet nicht gesetzt, kaputtes JSON meldet sich', () => {
	const fake: ScalableTool = {
		tool: 'x',
		title: 'X',
		description: '',
		readOnly: true,
		resource: 'account',
		resourceName: 'Account',
		fields: [{ name: 'payload', required: true, kind: 'json' }],
	};
	assert.deepEqual(
		buildArguments(fake, (n) => (n === 'payload' ? '{}' : {})),
		{},
	);
	assert.deepEqual(
		buildArguments(fake, (n) => (n === 'payload' ? '{"a":1}' : {})),
		{ payload: { a: 1 } },
	);
	assert.throws(
		() => buildArguments(fake, (n) => (n === 'payload' ? '{kaputt' : {})),
		/not valid JSON/,
	);
});

test('der Katalog deckt sich mit dem Schnappschuss des Servers', async () => {
	const { readFileSync } = await import('node:fs');
	const roh = JSON.parse(readFileSync(new URL('../scripts/tools.snapshot.json', import.meta.url), 'utf8'));
	assert.equal(TOOLS.length, roh.length, 'erzeugte Tabelle und Schnappschuss sind verschieden gross');
	const namen = new Set(TOOLS.map((t) => t.tool));
	for (const t of roh) assert.ok(namen.has(t.name), `${t.name} fehlt in der erzeugten Tabelle`);
});
