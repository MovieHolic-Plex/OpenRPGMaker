// Source manuals -> identical static documents for browser and Bun worker.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../../src/project/gameAuthoringPresets/', import.meta.url);
const documents = {};
for (const id of ['common', 'romance', 'monster', 'adventure', 'mystery']) {
  const text = readFileSync(new URL(`${id}.md`, root), 'utf8').replace(/\r\n/g, '\n').trim();
  const sections = [...text.matchAll(/^## ([A-Z]\d{2}) (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(match => {
    const field = name => {
      const value = match[3].match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1];
      if (!value) throw new Error(`${id}/${match[1]} missing ${name}`);
      return value;
    };
    return { id: match[1], title: match[2], input: field('입력'), action: field('실행'), output: field('산출물'), acceptance: field('검증') };
  });
  if (!sections.length) throw new Error(`No authoring sections in ${id}`);
  documents[id] = { id, version: 1, sha256: createHash('sha256').update(text).digest('hex'), text, sections };
}
const output = `${JSON.stringify(documents, null, 2)}\n`;
const target = new URL('documents.json', root);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Authoring preset bundle is stale; run node scripts/content/prepare-game-authoring-presets.mjs');
} else writeFileSync(target, output);
console.log(`${fileURLToPath(target)}: ${Object.values(documents).map(d => `${d.id} ${d.text.length} chars / ${d.sections.length} sections`).join(', ')}`);
