/**
 * 재검수 — 현재 번들 테마 칩셋의 조각(구조 키트·바닥 타일 그룹)을 시트에서 합성해 새 프로필로 다시 판정받는다.
 *
 * 영수증이 그림 화소 해시 + 프로필 해시에 묶이므로, 같은 조각은 이미 현재 프로필 영수증이 있으면 건너뛴다(중단 후 이어 돌리기).
 * 규칙 v4 로 프로필 해시가 바뀌면 옛 영수증 전부가 무효가 된다 — 이 경로가 그것을 테마 단위로 다시 채운다.
 * 보정이 통과한 프로필에서만 영수증을 쓴다(--audit 은 영수증 없이 보고서만, 미보정 프로필에서도 허용).
 *
 * 조각 종류는 키트 이름의 낱말로 짐작한다(건물·나무·그 밖). 짐작이 틀리면 --map <json> 으로
 * {"<키트 id>": {"kind": "...", "styleKind": "..."}} 를 덮어 줄 수 있다. 낱말 분류는 보고서에 그대로 남는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import type { ObjectGateKind, ObjectGateStyleKind } from '../../_core/objectGate';

export type RereviewPiece = { png: string; kind: ObjectGateKind; styleKind: ObjectGateStyleKind; name: string; label: string; theme: string };

/** 현재 번들 테마 칩셋 — 시트와 타일셋 정의. farm 은 버들항 시트 안의 bd-farm-* 키트(기준 칩셋 자체는 재검수 대상이 아니다). */
export const REREVIEW_THEMES: Record<string, { tileset: string; sheet: string; kitPrefix?: string }> = {
  farm: { tileset: 'src/assets/beodeulCityTileset.json', sheet: 'public/assets/beodeul-city/beodeul-city-chipset.png', kitPrefix: 'bd-farm-' },
  gothic: { tileset: 'src/assets/gothicManorTileset.json', sheet: 'public/assets/gothic-manor/gothic-manor-chipset.png' },
  campus: { tileset: 'src/assets/modernCampusTileset.json', sheet: 'public/assets/modern-campus/modern-campus-chipset.png' },
  snow: { tileset: 'src/assets/snowNorthTileset.json', sheet: 'public/assets/snow-north/snow-north-chipset.png' },
  desert: { tileset: 'src/assets/desertEastTileset.json', sheet: 'public/assets/desert-east/desert-east-chipset.png' },
  sengoku: { tileset: 'src/assets/sengokuEdoTileset.json', sheet: 'public/assets/sengoku-edo/sengoku-edo-chipset.png' },
  modern_city: { tileset: 'src/assets/modernCityTileset.json', sheet: 'public/assets/modern-city/modern-city-chipset.png' },
  sf: { tileset: 'src/assets/sfStationTileset.json', sheet: 'public/assets/sf-station/sf-station-chipset.png' },
  sky: { tileset: 'src/assets/skyIslandTileset.json', sheet: 'public/assets/sky-island/sky-island-chipset.png' },
  pirate: { tileset: 'src/assets/pirateIslesTileset.json', sheet: 'public/assets/pirate-isles/pirate-isles-chipset.png' },
  prehistoric: { tileset: 'src/assets/prehistoricTileset.json', sheet: 'public/assets/prehistoric/prehistoric-chipset.png' },
  steampunk: { tileset: 'src/assets/steampunkCityTileset.json', sheet: 'public/assets/steampunk-city/steampunk-city-chipset.png' },
};

type Kit = { id: string; name: string; width: number; height: number; rows: Array<{ tiles?: number[]; upperTiles?: number[] }> };
type Group = { id: string; name: string; role?: string; tileIds: number[] };
type Tileset = { tilesPerRow: number; tileSize?: number; structureKits: Kit[]; tileGroups: Group[] };

const BUILDING = /집|주택|오두막|가게|상점|여관|공장|창고|교회|성당|신전|사원|탑|궁|회관|도장|움집|천막|건물|저택|본관|별관|기숙사|도서관|체육관|강당|격납고|관제|반응로|역|술도가|찻집|대장간|온천|마치야|헛간|닭장|등대|성문|천수각|망루|house|hut|cabin|tavern|warehouse|office|hall|tower|school|lab|hangar|dome|module|hab|inn|shop|station|keep|temple|shrine|barn|coop|church|lighthouse|fort|factory/i;
const TREE = /나무|소나무|야자|덤불|관목|고사리|소철|갈대|철쭉|tree|palm|bush|pine|fern|cycad|banana|hedge|shrub|birch|willow|reed|grass-tuft/i;

export function classifyKit(name: string, id: string): { kind: ObjectGateKind; styleKind: ObjectGateStyleKind } {
  const text = `${name} ${id}`;
  if (TREE.test(text)) return { kind: 'organic', styleKind: 'tree' };
  if (BUILDING.test(text)) return { kind: 'structure', styleKind: 'building' };
  return { kind: 'other', styleKind: 'prop' };
}

const decode = (path: string) => { const p = PNG.sync.read(readFileSync(path)); return { width: p.width, height: p.height, data: p.data }; };

function trimmed(width: number, height: number, rgba: Uint8Array) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3]! > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((y + y0) * width + x + x0) * 4, d = (y * w + x) * 4; for (let c = 0; c < 4; c++) out.data[d + c] = rgba[s + c]!; }
  return out;
}

export function collectPieces(theme: string, root: string, outDir: string, overrides: Record<string, { kind?: ObjectGateKind; styleKind?: ObjectGateStyleKind }> = {}): RereviewPiece[] {
  const cfg = REREVIEW_THEMES[theme];
  if (!cfg) throw Error(`모르는 테마 ${theme}. 테마: ${Object.keys(REREVIEW_THEMES).join(', ')}`);
  const tileset = JSON.parse(readFileSync(resolve(root, cfg.tileset), 'utf8')) as Tileset;
  const sheet = decode(resolve(root, cfg.sheet));
  const T = tileset.tileSize ?? 16, tpr = tileset.tilesPerRow;
  const draw = (dst: Uint8Array, dw: number, tid: number, dx: number, dy: number) => {
    if (tid < 0) return;
    const sx = (tid % tpr) * T, sy = Math.floor(tid / tpr) * T;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const s = ((sy + y) * sheet.width + sx + x) * 4, d = ((dy + y) * dw + dx + x) * 4, a = sheet.data[s + 3]! / 255;
      if (a === 0) continue;
      for (let c = 0; c < 3; c++) dst[d + c] = Math.round(dst[d + c]! * (1 - a) + sheet.data[s + c]! * a);
      dst[d + 3] = Math.max(dst[d + 3]!, sheet.data[s + 3]!);
    }
  };
  mkdirSync(resolve(outDir, theme), { recursive: true });
  const pieces: RereviewPiece[] = [];
  const emit = (id: string, name: string, w: number, h: number, paint: (buf: Uint8Array) => void, kinds: { kind: ObjectGateKind; styleKind: ObjectGateStyleKind }) => {
    const buf = new Uint8Array(w * h * 4); paint(buf);
    const png = trimmed(w, h, buf); if (!png) return;
    const file = resolve(outDir, theme, `${id.replace(/[^\w.-]+/g, '_')}.png`); writeFileSync(file, PNG.sync.write(png));
    const o = overrides[id] ?? {};
    pieces.push({ png: file, kind: o.kind ?? kinds.kind, styleKind: o.styleKind ?? kinds.styleKind, name, label: `${theme}/${id}`, theme });
  };
  for (const kit of tileset.structureKits) {
    if (cfg.kitPrefix && !kit.id.startsWith(cfg.kitPrefix)) continue;
    emit(kit.id, kit.name, kit.width * T, kit.height * T, buf => kit.rows.forEach((row, r) => { for (const layer of [row.tiles, row.upperTiles]) (layer ?? []).forEach((tid, c) => draw(buf, kit.width * T, tid, c * T, r * T)); }), classifyKit(kit.name, kit.id));
  }
  if (!cfg.kitPrefix) for (const g of tileset.tileGroups) {
    // 1~6칸짜리 바닥 변형 그룹만(47칸 오토타일 묶음·건물 묶음은 키트와 겹친다). 4×3 패치로 면을 본다.
    if (!g.tileIds.length || g.tileIds.length > 6) continue;
    if (g.role && !['terrain', 'water', 'wall', 'ground', 'floor', 'path'].includes(g.role)) continue;
    emit(`g-${g.id.replace(/^[^:]*:/, '')}`, g.name, 4 * T, 3 * T, buf => { for (let i = 0; i < 12; i++) draw(buf, 4 * T, g.tileIds[i % g.tileIds.length]!, (i % 4) * T, Math.floor(i / 4) * T); },
      { kind: 'terrain', styleKind: g.role === 'water' ? 'water' : g.role === 'wall' ? 'wall' : 'ground' });
  }
  return pieces;
}

export function loadOverrides(path?: string) { return path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as Record<string, { kind?: ObjectGateKind; styleKind?: ObjectGateStyleKind }> : {}; }
