// 오프닝 QA 픽스처 보정 — 시작 맵이 «지금 번들에 있는» 칩셋으로 그려지게 만든다.
//
// 왜 필요한가(실측 2026-10-16): run-1 픽스처의 시작 맵(map_blank_start)은 easyrpg_chipset_combined_town 을
// 쓰는데, 그 시트는 2026-10-07 저작권 정리로 번들(BUNDLED_EASYRPG_CHIPSET_ASSETS)에서 빠졌다. 그래서
// player.html 은 오프닝 뒤 handoff 에서 «빠진 그림» 격자를 그린다. 픽스처 사본의 시작 맵을 번들 칩셋
// (기본: beodeul_city) 위로 다시 칠해, handoff 가 실제 마을로 이어지게 한다.
//
// 정본·라이브 서비스·원격 저장에는 아무것도 쓰지 않는다. 입력 프로젝트 JSON 은 «사본»이어야 한다.
//   bun scripts/qa/opening-pixel-fixture.mts --in <project.json> --out <project.json> [--window x,y]
//       [--tileset beodeul_city] [--source tiledata/beodeul-city/map.json] [--render <out.png>]
import fs from 'node:fs';
import path from 'node:path';
import { ensureBundledTilesets, ensureBundledResourceProfiles } from '../../src/project/defaults/defaultAssets.ts';
import { renderMapPng } from '../qa-game/render.mts';
import type { Project } from '../../src/project/types.ts';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const inFile = arg('in');
const outFile = arg('out');
if (!inFile || !outFile || inFile === outFile) throw Error('Usage: opening-pixel-fixture.mts --in <project.json> --out <different.json> [--window x,y]');
const tilesetId = arg('tileset', 'beodeul_city')!;
const sourcePath = arg('source', 'tiledata/beodeul-city/map.json')!;

// 편집기의 로드 경로(src/project/store.ts)가 늘 하는 것과 같다: 옛 저장본에 번들 타일셋을 보강한다.
// (이 픽스처는 2026-10-07 정리 이전 기본 타일셋만 들고 있어 beodeul_city 가 없다.)
const project = JSON.parse(fs.readFileSync(inFile, 'utf8')) as Project;
const addedTilesets = ensureBundledTilesets(project);
const addedProfiles = ensureBundledResourceProfiles(project);
const map = project.maps[project.startMapId];
if (!map) throw Error(`start map ${project.startMapId} missing`);
if (!project.tilesets[tilesetId]) throw Error(`tileset ${tilesetId} is not in the project: ${Object.keys(project.tilesets).join(', ')}`);

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as { width: number; height: number; lowerTiles: number[]; upperTiles: number[] };
const windowRaw = arg('window');
const window = windowRaw ? windowRaw.split(',').map(Number) : [];
const wx = Number.isInteger(window[0]) ? window[0]! : 78;
const wy = Number.isInteger(window[1]) ? window[1]! : 13;
if (wx < 0 || wy < 0 || wx + map.width > source.width || wy + map.height > source.height) throw Error(`window ${wx},${wy} does not fit the ${source.width}x${source.height} source`);

const lower: number[] = [];
const upper: number[] = [];
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const i = (wy + y) * source.width + (wx + x);
    lower.push(source.lowerTiles[i]!);
    upper.push(source.upperTiles[i]!);
  }
}

// 옛 칩셋 정의는 남겨 둔다(다른 맵이 아직 쓸 수 있다) — 시작 맵만 번들 칩셋으로 갈아탄다.
const patched: Project = { ...project, maps: { ...project.maps, [map.id]: { ...map, tilesetId, tileSize: project.tilesets[tilesetId]!.tileSize, lowerTiles: lower, upperTiles: upper } } };
fs.writeFileSync(outFile, JSON.stringify(patched));

const out: Record<string, unknown> = {
  in: inFile, out: outFile, startMapId: patched.startMapId, window: { x: wx, y: wy }, tilesetId,
  addedTilesets, addedProfiles,
  tilesetPresent: Object.keys(patched.tilesets).length, emptyLowerCells: lower.filter((t) => t < 0).length, emptyUpperCells: upper.filter((t) => t >= 0).length === 0 ? 0 : upper.filter((t) => t < 0).length,
};
const renderPath = arg('render');
if (renderPath) {
  const { png, note } = renderMapPng(patched, patched.maps[map.id]!, 2);
  fs.writeFileSync(renderPath, png);
  out.render = renderPath;
  out.renderNote = note ?? null;
}
console.log(JSON.stringify(out, null, 1));
