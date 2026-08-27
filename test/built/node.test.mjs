import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Laeuft gegen dist, nicht gegen die Quellen, und laedt die Klasse mit require -
// genau wie n8ns Community-Lader. Wirft dabei ein Feld-Initialisierer, meldet
// n8n das als "Class could not be found"; mit n8n-workflow 1.82.0 ist uns das
// schon einmal passiert. Diese Datei ist die Gegenprobe.
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '../..');
const req = createRequire(join(wurzel, 'package.json'));
const { ScalableCapital } = req('./dist/nodes/ScalableCapital/ScalableCapital.node.js');

const node = new ScalableCapital();
const props = node.description.properties;
const zeigt = (p, schluessel) => p.displayOptions?.show?.[schluessel];

test('die Klasse laesst sich instanziieren wie vom Community-Lader', () => {
	assert.ok(node.description, 'keine Beschreibung');
	assert.equal(typeof node.execute, 'function');
	assert.deepEqual(node.description.inputs, ['main']);
	assert.deepEqual(node.description.outputs, ['main']);
});

test('die Node fuehrt beide Versionen', () => {
	assert.deepEqual(node.description.version, [1, 2]);
});

test('jede Eigenschaft gehoert genau einer Version', () => {
	for (const p of props) {
		const v = zeigt(p, '@version');
		assert.ok(Array.isArray(v), `${p.displayName} (${p.name}) ist keiner Version zugeordnet`);
		assert.equal(v.length, 1, `${p.name} haengt an mehreren Versionen`);
		assert.ok([1, 2].includes(v[0]), `${p.name} zeigt auf eine unbekannte Version`);
	}
});

test('Version 1 sieht unveraendert aus - bestehende Workflows haengen daran', () => {
	const v1 = props.filter((p) => zeigt(p, '@version')[0] === 1);
	assert.deepEqual(
		v1.map((p) => p.name),
		['operation', 'toolName', 'toolArguments', 'options'],
		'Version 1 hat andere Felder als vorher',
	);

	const op = v1.find((p) => p.name === 'operation');
	assert.deepEqual(op.options.map((o) => o.value), ['executeTool', 'listTools']);
	assert.equal(op.default, 'executeTool');

	for (const name of ['toolName', 'toolArguments', 'options']) {
		const p = v1.find((x) => x.name === name);
		assert.deepEqual(zeigt(p, 'operation'), ['executeTool'], `${name}: Sichtbarkeit veraendert`);
	}

	assert.equal(v1.find((p) => p.name === 'resource'), undefined, 'Version 1 sieht ein Resource-Feld');
});

test('Version 2 bietet Ressourcen und behaelt den Rohzugriff', () => {
	const v2 = props.filter((p) => zeigt(p, '@version')[0] === 2);
	const resource = v2.find((p) => p.name === 'resource');
	assert.ok(resource, 'Version 2 hat kein Resource-Feld');

	const werte = resource.options.map((o) => o.value);
	assert.ok(werte.includes('advanced'), 'Rohzugriff fehlt');
	assert.ok(werte.length > 5, `nur ${werte.length} Ressourcen - zu wenig`);

	const roh = v2.find((p) => p.name === 'toolName');
	assert.deepEqual(zeigt(roh, 'resource'), ['advanced']);
});
