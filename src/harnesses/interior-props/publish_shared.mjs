// 고른 실내 기물을 호스트 공용 SQLite의 모든 프로젝트용 팩으로 등록한다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { withTsModule } from '../../../scripts/ontology-ts-loader.mjs';
const stage = path.resolve(process.argv[2]);
const read = p => JSON.parse(fs.readFileSync(path.join(stage, p), 'utf8'));
const spec = read('src/assets/handInteriorSpec.json');
const def = read('src/assets/atlasBiomeInteriorTileset.json');
const picks = read('tiledata/hand-interior/pick/picks.json');
const report = read('tiledata/hand-interior/pick/out/baked.json');
const applied = new Map([...report.applied, ...report.resized].map(r => [r.id, r.choice]));
const sets = new Set(read('tiledata/hand-interior/new/sets.json').sets.map(s => s.id));
const missing = Object.entries(picks).filter(([id, v]) => !sets.has(id) && v.choice !== 'v5' && applied.get(id) !== v.choice);
const variantChoices = new Map(report.variants.map(r => [r.id, r.choice]));
for (const [id, v] of Object.entries(picks)) if (!sets.has(id)) {
  for (const [index, choice] of (v.variants ?? []).entries()) {
    if (variantChoices.get(`${id}#${index + 2}`) !== choice) missing.push([`${id}#${index + 2}`, {choice}]);
  }
}
if (missing.length) throw Error(`선택 ${missing.length}종 굽기 누락: ${missing.map(([id]) => id).slice(0, 12).join(', ')}`);
const id = 'oprn-hand-interior-harness', tid = 'shared_hand_interior_harness', assetId = `${tid}_atlas`;
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.join(stage, 'public/assets/atlas-interior/interior-chipset.png')).toString('base64');
const references = read('src/assets/sharedHandInteriorReferences.json').filter(r => r.tilesetId === def.id).map(r => r.category);
for (const category of references) for (const image of category.images ?? []) {
  if (image.dataUrl.startsWith('/assets/')) image.dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.join(stage, 'public', image.dataUrl)).toString('base64');
}
// 이 팩은 기존 실내 저작 도구의 고정 번들과 별도다. 실제 공용 킷 배치 경로를 먼저 안내한다.
for (const category of references) {
  category.name = '사용자가 고른 공용 기물 · 사전·배치 지침';
  category.description = '공용 하네스 팩의 정확한 칸 번호·크기·통행·사전과 예제. list_spatial_designs로 기물을 찾고 stamp_object로 배치한다.';
}
for (const category of references) for (const doc of category.documents ?? []) {
  doc.markdown = `> 공용 하네스 팩: ${tid}. 아래 칸 번호는 이 팩의 번호입니다.\n> 기물은 list_spatial_designs({kind:"object",query})에서 찾고 stamp_object({objectId:"kit:${tid}/shared_hand-interior:<기물 id>",mapId,x,y})로 배치합니다.\n> build_hand_interior_room/list_hand_interior_parts는 앱 번들의 사양을 사용하므로 이 팩의 새 기물을 그 도구에 직접 넘기지 않습니다.\n\n` + doc.markdown.replaceAll('atlas_biome_interior', tid);
}
const tileset = { ...def, id: tid, name: '실내 · 사용자가 고른 공용 기물', kind: 'custom',
  image: { type: 'uploaded', id: assetId }, referenceDocuments: references,
  structureKits: def.structureKits.map(k => ({ ...k, id: `shared_${k.id}`,
    ...(applied.has(k.id.replace(/^hand-interior:/, '')) || variantChoices.has(k.id.replace(/^hand-interior:/, ''))
      ? { ai: { ...k.ai, tags: [...new Set([...(k.ai?.tags ?? []), '사용자 선택', '슈퍼하네싱'])] } } : {}) })) };
delete tileset.textureKey; delete tileset.libraryEnd;
const library = { version: 1, projectDefaults: true, roots: [], places: {}, maps: {}, previews: {},
  sourceProjectId: 'interior-props-harness', tilesets: { [tid]: tileset },
  assets: { [assetId]: { id: assetId, kind: 'tileset', name: tileset.name, dataUrl,
    meta: { tileSize: 16, width: def.tilesPerRow * 16 } } } };
const receipt = await withTsModule('scripts/lib/sharedContentSqlite.ts', 'prop-publish.mjs', api => {
  const file = api.sharedContentFile();
  const db = new DatabaseSync(file); db.exec('PRAGMA busy_timeout=5000');
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE name='content_libraries'").get();
  const old = exists ? db.prepare('SELECT revision FROM content_libraries WHERE id=?').get(id) : undefined;
  db.close();
  // 게시 전에 이전 번호를 복원할 자료를 판본별로 보존한다. 다음 굽기는 이 판본을 기준으로 번호를 고정한다.
  const revision = createHash('sha256').update(JSON.stringify(library)).digest('hex');
  const dataDir = process.env.PROP_HARNESS_DATA || path.join(os.homedir(), '.local/share/oprn/prop-harness');
  const baseline = path.join(dataDir, 'baselines', revision);
  if (!fs.existsSync(baseline)) {
    fs.mkdirSync(path.dirname(baseline), {recursive:true});
    const temp = fs.mkdtempSync(path.join(path.dirname(baseline), '.pending-'));
    for (const rel of ['src/assets/handInteriorSpec.json', 'src/assets/atlasBiomeInteriorTileset.json',
      'public/assets/atlas-interior/interior-chipset.png', 'tiledata/hand-interior/v5-maps/maps.json']) {
      const dst = path.join(temp, rel); fs.mkdirSync(path.dirname(dst), {recursive:true}); fs.copyFileSync(path.join(stage, rel), dst);
    }
    fs.renameSync(temp, baseline);
  }
  const result = api.publishSharedContent(id, library, old?.revision ?? null, file);
  return { file, id, revision: result.revision, reloaded: true, selected: applied.size,
    objects: Object.keys(spec.objects).length, kits: tileset.structureKits.length,
    atlasSha256: createHash('sha256').update(Buffer.from(dataUrl.split(',')[1], 'base64')).digest('hex') };
});
console.log(JSON.stringify(receipt));
