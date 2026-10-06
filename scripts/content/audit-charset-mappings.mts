import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { CHARSET_ASSETS } from '../../src/assets/charsetCatalog';
import { CHARSET_SEMANTICS } from '../../src/assets/charsetSemantics';
import { charsetFrameIndex, charsetFrameSource } from '../../src/assets/easyrpgRtp';
import { queryNpcGraphics } from '../../src/assets/charsetQuery';
import { installSharedCharacters, sharedCharacterSemantics } from '../../src/project/sharedCharacters';
import type { SharedContentSnapshot } from '../../src/project/sharedContentSchema';

// Read-only inventory. The visual verdict is recorded separately after opening
// every contact sheet; matching labels to themselves is not a visual audit.
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1]!;
};
const out = resolve(option('out', 'output/charset-mapping-audit'));
if (existsSync(join(out, 'inventory.json'))) throw Error('Use a new --out directory to preserve the earlier audit.');
mkdirSync(join(out, 'sources'), { recursive: true });
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sources = CHARSET_ASSETS.map(asset => {
  const path = [resolve(asset.path), resolve('public', asset.path)].find(existsSync);
  if (!path) throw Error(`Missing original charset: ${asset.textureKey}: ${asset.path}`);
  return { id: asset.textureKey, resourceId: asset.id, name: asset.fileName, path, sha256: hash(readFileSync(path)), origin: 'bundled' };
});
const dataRoot = join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'), 'oprn');
const sharedFile = resolve(option('shared-db', join(dataRoot, 'shared-content.sqlite')));
const db = new DatabaseSync(sharedFile, { readOnly: true });
let snapshot: SharedContentSnapshot;
try {
  db.exec('PRAGMA query_only=ON; BEGIN');
  const rows = db.prepare("SELECT id, revision, payload FROM content_libraries WHERE json_extract(payload, '$.characters') IS NOT NULL ORDER BY id").all() as {id: string; revision: string; payload: string}[];
  snapshot = { revision: rows.map(row => `${row.id}:${row.revision}`).join(','), libraries: Object.fromEntries(rows.map(row => [row.id, JSON.parse(row.payload)])) };
  db.exec('COMMIT');
} finally { db.close(); }
installSharedCharacters(snapshot);
for (const library of Object.values(snapshot.libraries)) {
  if (!library.projectDefaults) continue;
  for (const asset of Object.values(library.assets)) {
    if (asset.kind !== 'charset') continue;
    const match = /^data:image\/png;base64,(.+)$/s.exec(asset.dataUrl ?? '');
    if (!match) throw Error(`Shared charset has no PNG: ${asset.id}`);
    const bytes = Buffer.from(match[1]!, 'base64'), path = join(out, 'sources', `${asset.id}.png`);
    writeFileSync(path, bytes);
    sources.push({ id: asset.id, resourceId: asset.id, name: asset.name, path, sha256: hash(bytes), origin: 'shared' });
  }
}
const catalog = [...CHARSET_SEMANTICS, ...sharedCharacterSemantics()];
const semanticKeys = catalog.map(row => `${row.textureKey}#${row.characterIndex}`);
if (new Set(semanticKeys).size !== semanticKeys.length) throw Error('Duplicate semantic slot keys');
if (new Set(sources.map(source => source.id)).size !== sources.length) throw Error('Duplicate charset asset keys');
const orphanEntries = catalog.filter(row => !sources.some(source => source.id === row.textureKey) || !Number.isInteger(row.characterIndex) || row.characterIndex < 0 || row.characterIndex > 7);
if (orphanEntries.length) throw Error(`Semantics refer to unavailable slots: ${JSON.stringify(orphanEntries)}`);
const rows = sources.flatMap(source => Array.from({length: 8}, (_, characterIndex) => {
  const semantic = catalog.find(row => row.textureKey === source.id && row.characterIndex === characterIndex);
  const frame = charsetFrameIndex({characterIndex, direction: 'down', pattern: 1});
  const crop = charsetFrameSource({characterIndex, direction: 'down', pattern: 1});
  return { sourceId: source.id, characterIndex, frame, crop, semantic: semantic ?? null };
}));
const queries = catalog.map(entry => ({query: entry.label, expected: `${entry.textureKey}#${entry.characterIndex}`,
  matches: queryNpcGraphics(entry.label, 1000).map(match => ({key: `${match.entry.textureKey}#${match.entry.characterIndex}`, label: match.entry.label, score: match.score})) }));
const discovery = Object.fromEntries(['왕','king','골렘','golem','이끼 골렘','animal','동물','monster','people','object','흑발 여성 마법사','보라 머리 여성 마법사','파란 머리 여성 마법사','나무 통','금고'].map(query => [query,
  queryNpcGraphics(query,100).map(match => ({key:`${match.entry.textureKey}#${match.entry.characterIndex}`,label:match.entry.label}))]));
// Optional project census reads only relevant JSON fields, never opens an editor
// or changes a running host's database. Private project contents stay outside git.
function projectFiles(path: string): string[] {
  return readdirSync(path, {withFileTypes:true}).flatMap(entry => {
    if (['backups','.git','node_modules'].includes(entry.name)) return [];
    const file = join(path,entry.name);
    return entry.isDirectory() ? projectFiles(file) : entry.isFile() && entry.name === 'project.sqlite' ? [file] : [];
  });
}
const projects = args.includes('--projects-root') ? projectFiles(resolve(option('projects-root',dataRoot))).map(file => {
  const projectDb = new DatabaseSync(file,{readOnly:true});
  try {
    projectDb.exec('PRAGMA query_only=ON; BEGIN');
    const row = projectDb.prepare("SELECT project_id, revision, json_extract(current_json,'$.charsetLabels') AS labels, json_extract(current_json,'$.assets.uploaded') AS uploaded FROM project WHERE id=1").get() as {project_id:string;revision:number;labels:string|null;uploaded:string|null};
    const labels = JSON.parse(row.labels ?? '[]'), uploaded = Object.values(JSON.parse(row.uploaded ?? '{}')) as {id:string;name:string;kind:string}[];
    const conversations = projectDb.prepare("SELECT count(*) AS count FROM ai_conversations").get() as {count:number};
    return {file,projectId:row.project_id,revision:row.revision,labels,charsetAssets:uploaded.filter(asset=>asset.kind==='charset').map(({id,name})=>({id,name})),aiConversations:conversations.count};
  } finally { projectDb.close(); }
}) : undefined;
const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), sharedFile, sharedRevision: snapshot.revision,
  sources, rows, queries, discovery, projects,
  sourceFiles: ['src/assets/charsetSemantics.ts','src/assets/charsetAppearances.ts','src/assets/charsetQuery.ts','src/assets/easyrpgRtp.ts','src/project/sharedCharacters.ts'].map(path => ({path,sha256:hash(readFileSync(path))})) };
writeFileSync(join(out, 'inventory.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({out, sources: sources.length, bundledSources: CHARSET_ASSETS.length, semanticRows: catalog.length, physicalSlots: rows.length,
  unlabeledSlots: rows.filter(row => !row.semantic).length, labelQueryOmissions: queries.filter(row => !row.matches.some(match => match.key === row.expected)).length}));
