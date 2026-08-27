#!/usr/bin/env node
/**
 * Erzeugt nodes/ScalableCapital/tools.generated.ts aus dem MCP-Werkzeugkatalog.
 *
 * Der Katalog kommt vom Server selbst (tools/list) und liegt als Schnappschuss
 * in scripts/tools.snapshot.json. Neu holen laesst er sich mit der Node selbst:
 * Operation "List Available Tools" ausfuehren und das Ergebnis hierher schreiben.
 * Ein eigener Abruf im Generator scheidet aus - der MCP verlangt OAuth, und das
 * Refresh-Token rotiert bei jedem Zugriff.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = join(hier, '..');

// Zuordnung Werkzeug -> Ressource. Erste passende Regel gewinnt.
// Faengt eine Regel ein neues Werkzeug nicht, bricht der Generator ab: lieber
// ein roter Build als ein Werkzeug, das stillschweigend im falschen Menue
// landet oder ganz verschwindet.
const REGELN = [
  [/^ping$|^get_account_profile$|^list_accessible_portfolios$/, 'account', 'Account'],
  [/overnight/, 'overnight', 'Overnight Savings'],
  [/portfolio_group/, 'portfolioGroup', 'Portfolio Group'],
  [/^(preview|submit)_(buy|sell)_order$|^cancel_order$|^list_order_venues$/, 'order', 'Order'],
  [/savings_plan/, 'savingsPlan', 'Savings Plan'],
  [/watchlist/, 'watchlist', 'Watchlist'],
  [/price_alert/, 'priceAlert', 'Price Alert'],
  [/securit|derivative/, 'security', 'Security'],
  [/portfolio|transaction/, 'portfolio', 'Portfolio'],
];

function ressourceVon(name) {
  for (const [muster, wert, anzeige] of REGELN) {
    if (muster.test(name)) return { resource: wert, resourceName: anzeige };
  }
  return null;
}

/** Uebersetzt eine JSON-Schema-Eigenschaft in ein n8n-Feld. */
function feldVon(name, schema, pflicht) {
  const beschreibung = (schema.description || '').trim();
  const gemeinsam = { name, required: pflicht, description: beschreibung || undefined };

  if (Array.isArray(schema.enum) && schema.enum.length) {
    return { ...gemeinsam, kind: 'options', options: schema.enum.map(String) };
  }
  if (schema.type === 'boolean') return { ...gemeinsam, kind: 'boolean' };
  if (schema.type === 'integer' || schema.type === 'number') {
    return {
      ...gemeinsam,
      kind: 'number',
      minimum: typeof schema.minimum === 'number' ? schema.minimum : undefined,
      maximum: typeof schema.maximum === 'number' ? schema.maximum : undefined,
    };
  }
  if (schema.type === 'array') {
    // Listen von Skalaren nimmt der Nutzer als Kommaliste entgegen; alles
    // andere waere geraten.
    const eintrag = schema.items || {};
    if (!eintrag.type || eintrag.type === 'string' || eintrag.type === 'number') {
      return { ...gemeinsam, kind: 'csv' };
    }
    return { ...gemeinsam, kind: 'json' };
  }
  if (schema.type === 'string') return { ...gemeinsam, kind: 'string' };

  // oneOf/anyOf-Vereinigungen und verschachtelte Objekte (nur bei den
  // Handelswerkzeugen) bleiben JSON. Sie flach zu klopfen hiesse, eine
  // Struktur zu erfinden, die der Server so nicht kennt.
  return { ...gemeinsam, kind: 'json' };
}

const katalog = JSON.parse(readFileSync(join(wurzel, 'scripts/tools.snapshot.json'), 'utf8'));

const ohneRegel = [];
const werkzeuge = [];

for (const t of katalog) {
  const r = ressourceVon(t.name);
  if (!r) {
    ohneRegel.push(t.name);
    continue;
  }
  const schema = t.inputSchema || {};
  const pflicht = new Set(schema.required || []);
  const felder = Object.entries(schema.properties || {}).map(([n, s]) => feldVon(n, s, pflicht.has(n)));
  // Pflichtfelder zuerst - sie gehoeren an die Oberflaeche, nicht in eine
  // Sammlung, die man erst aufklappen muss.
  felder.sort((a, b) => Number(b.required) - Number(a.required));
  werkzeuge.push({
    tool: t.name,
    title: t.title || t.name,
    description: t.description || '',
    readOnly: !!t.readOnly,
    ...r,
    fields: felder,
  });
}

if (ohneRegel.length) {
  console.error('Keine Ressourcenregel fuer:', ohneRegel.join(', '));
  console.error('Regel in scripts/generate.mjs ergaenzen, dann erneut erzeugen.');
  process.exit(1);
}

werkzeuge.sort((a, b) =>
  a.resourceName.localeCompare(b.resourceName) || a.title.localeCompare(b.title),
);

const kopf = `// ERZEUGT - nicht von Hand aendern.
// Quelle: scripts/tools.snapshot.json (MCP tools/list), erzeugt mit scripts/generate.mjs.
// Neu erzeugen: npm run generate

export interface ScalableField {
\tname: string;
\trequired: boolean;
\tdescription?: string;
\tkind: 'string' | 'number' | 'boolean' | 'options' | 'csv' | 'json';
\toptions?: string[];
\tminimum?: number;
\tmaximum?: number;
}

export interface ScalableTool {
\ttool: string;
\ttitle: string;
\tdescription: string;
\treadOnly: boolean;
\tresource: string;
\tresourceName: string;
\tfields: ScalableField[];
}

export const TOOLS: ScalableTool[] = ${JSON.stringify(werkzeuge, null, '\t')};
`;

writeFileSync(join(wurzel, 'nodes/ScalableCapital/tools.generated.ts'), kopf);

const jeRessource = {};
for (const w of werkzeuge) jeRessource[w.resourceName] = (jeRessource[w.resourceName] || 0) + 1;
console.log(`${werkzeuge.length} Werkzeuge in ${Object.keys(jeRessource).length} Ressourcen:`);
for (const [r, n] of Object.entries(jeRessource).sort()) console.log(`  ${r}: ${n}`);
console.log(`${werkzeuge.reduce((s, w) => s + w.fields.length, 0)} Felder insgesamt`);
