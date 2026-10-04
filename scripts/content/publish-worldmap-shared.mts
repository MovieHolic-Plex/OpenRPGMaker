// Publish only human-selected icons and canonical, reloaded geography examples to the host's local catalog.
// Run through publish-worldmap-shared.mjs; no LegacyDb/network writes.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { openLocalProjectStore } from '../../electron/local-store/store';
import { createBlankProject } from '../../src/project/defaults';
import { WORLDMAP_SELECTED_ICONS } from '../../src/project/defaults/worldmapSelected';
import { readSharedContentLibrary, publishSharedContent, sharedContentFile } from '../lib/sharedContentSqlite';
import { renderMapPng } from '../qa-game/render.mts';
import type { SharedContentLibrary } from '../../src/project/sharedContentSchema';
import type { TilesetReferenceCategory } from '../../src/project/tilesetReferences';
import type { Project, GameMap, TilesetDef } from '../../src/project/types';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const pngUrl = (b: Buffer) => 'data:image/png;base64,' + b.toString('base64');
function thumbnail(bytes: Buffer, factor: number) {
  const src = PNG.sync.read(bytes), dst = new PNG({width: Math.ceil(src.width/factor),height: Math.ceil(src.height/factor)});
  for (let y=0;y<dst.height;y++)for(let x=0;x<dst.width;x++) {
    const a=(Math.min(src.height-1,y*factor)*src.width+Math.min(src.width-1,x*factor))*4, b=(y*dst.width+x)*4;
    src.data.copy(dst.data,b,a,a+4);
  }
  return PNG.sync.write(dst);
}
const empty = (sourceProjectId: string): SharedContentLibrary => ({ version: 1, projectDefaults: true,
  sourceProjectId, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, regions: {}, previews: {} });
function portableReferences(cats: TilesetReferenceCategory[]): TilesetReferenceCategory[] {
  const result = structuredClone(cats);
  for (const cat of result) for (const image of cat.images) {
    if (image.dataUrl.startsWith('/assets/')) image.dataUrl = pngUrl(readFileSync(join('public', image.dataUrl.slice(1))));
    else if (!image.dataUrl.startsWith('data:image/')) throw Error('Reference image is not portable: '+image.id);
  }
  return result;
}
function installAtlas(lib: SharedContentLibrary, def: TilesetDef, id: string, bytes: Buffer) {
  const t = structuredClone(def), assetId = id + '_atlas';
  if (t.tileGrafts?.length) throw Error('Bake grafts before publication: '+t.id);
  t.id = id; t.name += ' (공용 DB)'; t.image = { type: 'uploaded', id: assetId };
  t.referenceDocuments = portableReferences(t.referenceDocuments ?? []);
  delete t.referenceSourceTilesetId;
  lib.tilesets[id] = t;
  lib.assets[assetId] = { id: assetId, kind: 'tileset', name: t.name, dataUrl: pngUrl(bytes),
    meta: { tileSize: t.tileSize, width: t.tilesPerRow * t.tileSize, height: Math.ceil(t.count / t.tilesPerRow) * t.tileSize } };
  return t;
}
function publish(id: string, lib: SharedContentLibrary, dry: boolean) {
  const revision = sha(JSON.stringify(lib));
  if (!dry) {
    const old = readSharedContentLibrary(id);
    if (old?.revision !== revision) publishSharedContent(id, lib, old?.revision ?? null);
    const again = readSharedContentLibrary(id);
    if (!again || again.revision !== revision || sha(JSON.stringify(again.library)) !== revision) throw Error('Shared DB reload mismatch: '+id);
  }
  return { id, file: sharedContentFile(), revision, reloaded: !dry, bytes: Buffer.byteLength(JSON.stringify(lib)),
    tilesets: Object.keys(lib.tilesets), regions: Object.keys(lib.regions ?? {}) };
}
export async function run(argv: string[]) {
  const option = (name: string, fallback: string) => { const i = argv.indexOf('--'+name); return i < 0 ? fallback : argv[i+1]!; };
  const dry = argv.includes('--dry');
  const out = resolve(option('out', 'verify-shots/worldmap-shared-db'));
  mkdirSync(out, { recursive: true });
  const blank = createBlankProject();
  const selected = empty('worldmap-human-selected');
  const selectedDef = blank.tilesets.worldmap_selected!;
  if (selectedDef.structureKits?.length !== WORLDMAP_SELECTED_ICONS.length) throw Error('Selected kit count mismatch');
  installAtlas(selected, selectedDef, 'shared_worldmap_selected', readFileSync('public/assets/worldmap-icons/worldmap-selected.png'));
  const libraries: { id: string; lib: SharedContentLibrary }[] = [{ id: 'worldmap-human-selected', lib: selected }];
  const sources = [];
  const examples = [
    ['joseon', '실제 지형 · 조선 팔도 전도', '실제 지형의 RPG 지도 사례. 마을·오프닝·엔딩은 이 지역 사본에 포함하지 않는다.'],
    ['yucatan', '실제 지형 · 유카탄 반도', '실제 유카탄 지형에 판타지 그림체를 쓴 사례. 마야 건축 고증과 완성 게임을 뜻하지 않는다.'],
  ];
  for (const [label, title, limitations] of argv.includes('--icons-only') ? [] : examples) {
    const dir = resolve(option(label!, join(homedir(), '.local/share/oprn/worldmap-real-geo-20261004-'+(label === 'yucatan' ? 'maya' : label))));
    const store = await openLocalProjectStore({ projectDir: dir });
    let p: Project, sourceProjectId: string, sourceRevision: number;
    try { const snap = store.loadSnapshot()!; p = snap.project; sourceProjectId = store.info().projectId; sourceRevision = snap.revision; }
    finally { store.close(); }
    const source = p.maps.world_map!;
    if (!source?.worldmapSource?.ops.some(op => op.op === 'continents' && op.style === 'real')) throw Error('Not a saved real-geography map: '+dir);
    const def = p.tilesets[source.tilesetId]!;
    if (def.image.type !== 'uploaded') throw Error('Canonical map atlas required');
    const asset = p.assets.uploaded[def.image.id]!;
    const bytes = asset.dataUrl ? Buffer.from(asset.dataUrl.split(',')[1]!, 'base64') : readFileSync(join(dir, 'assets', `${asset.ref!.sha256}.${asset.ref!.extension}`));
    if (asset.ref && sha(bytes) !== asset.ref.sha256) throw Error('Canonical atlas hash differs');
    const lib = empty(sourceProjectId);
    lib.projectDefaults = false; // Completed examples load on demand; only selected icons are boot defaults.
    const mapId = 'shared_worldmap_real_'+label, tilesetId = mapId+'_tiles';
    const t = installAtlas(lib, def, tilesetId, bytes);
    const map = { ...structuredClone(source), id: mapId, name: title, tilesetId } as GameMap;
    // Source transfer events stay in this frozen snapshot. The standard import defaults to no events.
    lib.maps[mapId] = map;
    const rules = ['read_region_reference에서 자료를 찾고 import_region_reference로 새 맵에 가져온다.',
      'worldmapSource의 실제 지리 범위·home·ops와 characterScale을 보존한다.',
      '선택 아이콘은 list_worldmap_icons에서 고른 뒤 참고문서 전 페이지와 그림을 읽고 stamp_worldmap_icon으로 전체 배치한다.',
      '지형 편집 후 inspect_worldmap_icon과 check_reachability로 배열·입구 접근을 확인한다.'];
    const instructions = `# ${title}\n\n${limitations}\n\n## 실제 저장된 지형 설정\n\n\`\`\`json\n${JSON.stringify(source.worldmapSource, null, 2)}\n\`\`\`\n\n${rules.map(x=>'- '+x).join('\n')}\n\n이동 이벤트는 새 목적지 맵과 연결해야 한다. includeEvents 기본값은 false다.\n`;
    const visualMap = { ...source, events: [] };
    const portable = { ...p, assets: { ...p.assets, uploaded: { ...p.assets.uploaded, [asset.id]: { ...asset, dataUrl: pngUrl(bytes) } } }, startMapId: '__no_start__' } as Project;
    const before = renderMapPng(portable, visualMap);
    const after = renderMapPng({ ...portable, tilesets: { ...portable.tilesets, [tilesetId]: t }, assets: { ...portable.assets, uploaded: { ...portable.assets.uploaded, ...lib.assets } } }, { ...map, events: [] });
    if (before.note || after.note || !before.png.equals(after.png)) throw Error('Shared map render differs: '+label);
    const docs: TilesetReferenceCategory[] = [{ id: 'worldmap-real-'+label, name: title!, description: limitations!,
      documents: [{ id: 'worldmap-real-'+label+'-guide', name: '저장된 지형·사용 절차', markdown: instructions }],
      images: [{ id: 'worldmap-real-'+label+'-image', name: '정본 지도', caption: '저장 후 다시 불러온 실제 지도 그림 (768×576 참고 사본)', dataUrl: pngUrl(thumbnail(before.png,2)) }] }];
    t.referenceDocuments = docs;
    lib.regions![mapId] = { id: mapId, name: title!, kind: 'completed-map', regionKind: 'terrain', revision: sourceRevision,
      width: map.width, height: map.height, tilesetId, preview: pngUrl(thumbnail(before.png,4)), sourceProjectId, sourceMapId: source.id,
      snapshotProjectId: sourceProjectId, rules, limitations: limitations!, referenceDocuments: docs };
    lib.previews[mapId] = lib.regions![mapId]!.preview;
    writeFileSync(join(out, label+'-shared.png'), before.png);
    sources.push({ label, projectDir: dir, projectId: sourceProjectId, revision: sourceRevision, mapId: source.id,
      mapSha256: sha(JSON.stringify(source)), atlasSha256: sha(bytes), pixelIdentical: true });
    libraries.push({ id: 'worldmap-real-'+label, lib });
  }
  // Prepare every library before any write; each CAS only changes this publication's owned row.
  const receipts = libraries.map(({id, lib}) => publish(id, lib, dry));
  const proof = { dry, selectedIcons: WORLDMAP_SELECTED_ICONS.length, sources, receipts };
  writeFileSync(join(out, 'publication.json'), JSON.stringify(proof, null, 2)+'\n');
  console.log(JSON.stringify(proof, null, 2));
}
