// src/project/workshopQuickTerrain.ts
/**
 * 공방 「한 번에 만들기」 지형 — 빠른 길(2026-10-23). 지금 맵 칩셋에 이미 있는 자동 타일(물·길·모랫길)의
 * **모양(가장자리 변형·움직이는 칸)은 그대로 두고 재질 색만** 글에 맞게 바꿔 같은 칩셋에 새 그룹으로 덧붙인다.
 *
 * 왜: 고정판 tile-gen 으로 처음부터 그리면 한 벌에 15~25분이 걸리고 실측 두 번 모두 독립 검수에서 떨어졌다
 * (용암 24분 SEAM·READ, 이끼 돌바닥 15분 READ). 「딸깍」 요구에는 몇 초 안에 이음매가 보장된 지형이 필요하다 —
 * 원본 그룹의 칸 모양을 그대로 쓰므로 이음매·가장자리 판정은 원본과 같다. 새로 그리는 길은 「자세히」에 남긴다.
 *
 * - 재질 색 = 원본 그룹 속 칸(사방이 이어진 칸, 모든 프레임)에 쓰인 색. 가장자리 칸에서 그 색(과 아주 가까운 색)만 바꾸고,
 *   나머지(물가의 풀·흙)는 원본 그대로 둔다 — 지금 맵 땅과 이어진다.
 * - 바꾸는 법: 재질 색의 밝기 순위(화소 수로 잰 누적 비율)를 글의 색 단계(어두움→밝음 5단)에 옮긴다 — 밝은 물결 → 밝은 용암 줄기,
 *   어두운 물 시트라도 단계 전체에 고르게 퍼진다(첫 시험: 밝기 그대로 옮기니 용암이 거의 검붉었다).
 * - 칸: 새 업로드 그림(16칸 폭) → tileGrafts(원본 칩셋 번들 끝·다른 이식 끝 뒤 새 줄). 통행·층·지형 값은 원본 칸 것.
 * - 같은 글·같은 원본이면 같은 그림 해시 → 다시 만들어도 늘지 않는다.
 * 순수 함수(브라우저·노드 공용). 칩셋 그림 읽기·PNG 쓰기는 부르는 쪽이 한다(editor/workshop/oneClick/quickTerrain.ts).
 */
import type { AutotileGroup, PassFlag, TileAiMetadata, TilesetDef } from "./types";

export const QUICK_TERRAIN_ASSET_PREFIX = "wsterrain_";
const GROUP_MARK = "@wt-";
const SHEET_COLUMNS = 16;
const PASS: PassFlag = { up: true, down: true, left: true, right: true };

export interface Rgba8Image { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }

type Ramp = readonly string[];
/** 재질 색 단계(어두움 → 밝음). 낱말은 앞에서부터 맞춘다. */
const MATERIALS: readonly { readonly words: RegExp; readonly name: string; readonly liquid: boolean; readonly hard?: boolean; readonly ramp: Ramp }[] = [
  { words: /(용암|마그마|lava|magma)/iu, name: "용암", liquid: true, ramp: ["#2a0906", "#6e140a", "#b8320c", "#f0780f", "#ffd84a"] },
  { words: /(독|오염|poison|toxic|산성)/iu, name: "독", liquid: true, ramp: ["#1a0a24", "#46195a", "#77368c", "#a66cc0", "#dab8e8"] },
  { words: /(늪|진흙탕|swamp|bog|marsh)/iu, name: "늪", liquid: true, ramp: ["#1b2210", "#333d1b", "#53572a", "#777340", "#a19a63"] },
  { words: /(피 ?웅덩이|핏물|blood)/iu, name: "핏물", liquid: true, ramp: ["#2a0505", "#560a0b", "#871313", "#b72820", "#e05c4a"] },
  { words: /(깊은 ?물|심해|deep)/iu, name: "깊은 물", liquid: true, ramp: ["#050e28", "#0b224e", "#133c78", "#2b61a4", "#5b90cc"] },
  { words: /(얼음|빙판|빙하|ice|frozen)/iu, name: "얼음", liquid: true, ramp: ["#3b6c8c", "#68a1c0", "#9dcbe0", "#cee9f3", "#f3fbff"] },
  { words: /(눈|설원|snow)/iu, name: "눈", liquid: false, ramp: ["#7d91a6", "#a8bbcb", "#cfdbe5", "#e9f0f5", "#ffffff"] },
  { words: /(사막|모래|sand|desert|해변|beach)/iu, name: "모래", liquid: false, ramp: ["#76572c", "#a67f48", "#c8a569", "#dfc38d", "#f2e1b6"] },
  { words: /(돌|자갈|포장|보도|석재|cobble|stone|paving|road|도로)/iu, name: "돌", liquid: false, hard: true, ramp: ["#2e2e34", "#54545c", "#797981", "#a1a1a7", "#c8c8cb"] },
  { words: /(꽃|풀|잔디|초원|이끼|meadow|grass|moss)/iu, name: "풀", liquid: false, ramp: ["#1e3c14", "#2e5c1e", "#49802f", "#6ea446", "#a2ce6d"] },
  { words: /(흙|진흙|오솔길|길|dirt|mud|path|trail)/iu, name: "흙", liquid: false, ramp: ["#3a2414", "#5b3a20", "#7c5430", "#9f7545", "#c39b69"] },
  { words: /(물|연못|호수|강|바다|pond|lake|river|sea|water)/iu, name: "물", liquid: true, ramp: ["#0d2a4a", "#1a4e80", "#2e77af", "#59a2d5", "#a7d5ef"] },
];
/** 색 낱말 — 재질 낱말이 없을 때. */
const COLOURS: readonly (readonly [RegExp, Ramp])[] = [
  [/(빨간|붉은|빨강|red)/iu, ["#2a0606", "#5e0e0e", "#931c18", "#c63a2a", "#ec7a5a"]],
  [/(파란|푸른|파랑|blue)/iu, ["#0d2350", "#1a3d82", "#2c5fb6", "#4f8ad8", "#93bff0"]],
  [/(초록|녹색|green)/iu, ["#123a1a", "#1f5a28", "#33803a", "#55a855", "#92d08a"]],
  [/(보라|자주|purple|violet)/iu, ["#1c0d30", "#3a1c5e", "#5c318c", "#8556b8", "#b896e0"]],
  [/(노란|황금|금빛|노랑|yellow|gold)/iu, ["#5a3e08", "#8e6a12", "#c39a22", "#e7c43f", "#fff07a"]],
  [/(분홍|핑크|pink)/iu, ["#5a1a36", "#8e3460", "#c15a8a", "#e48ab0", "#fbc4da"]],
  [/(검은|까만|어두운|black|dark)/iu, ["#0a0a0e", "#1a1a22", "#2c2c38", "#44445a", "#62627e"]],
  [/(흰|하얀|white)/iu, ["#8e98a4", "#b3bcc6", "#d3dae1", "#ebeff3", "#ffffff"]],
];

export interface QuickMaterial { readonly name: string; readonly liquid: boolean; readonly hard: boolean; readonly ramp: Ramp }

/** 글 → 재질(색 단계·물 같은 것인지). 모르는 글은 색 낱말 → 그래도 없으면 흙. */
/** 「바닥·땅·길」이라고 하면 물가(둑·벽이 있는 웅덩이)가 아니라 땅 모양을 쓴다 — 「용암 바닥」이 벽돌 운하로 나왔다(2026-10-23 UX 검수). */
const FLOOR_WORDS = /(바닥|땅|길|들판|지면|floor|ground|path|field)/iu;

export function quickMaterialOf(text: string): QuickMaterial {
  const hit = MATERIALS.find((m) => m.words.test(text));
  const colour = COLOURS.find(([pattern]) => pattern.test(text))?.[1];
  if (hit) return { name: hit.name, liquid: hit.liquid && !FLOOR_WORDS.test(text), hard: hit.hard === true, ramp: colour && !/(용암|lava|magma)/iu.test(text) ? colour : hit.ramp };
  if (colour) return { name: "색 바닥", liquid: false, hard: false, ramp: colour };
  return { name: "흙", liquid: false, hard: false, ramp: MATERIALS.find((m) => m.name === "흙")!.ramp };
}

const LIQUID = /(water|canal|lake|river|sea|pond|물|강|바다|호수|운하|연못)/iu;
const HARD = /(road|stone|cobble|pave|포석|돌|포장)/iu;
const SOFT = /(sand|dirt|lane|mud|path|모래|흙|오솔)/iu;
const SKIP = /(farmland|경작|ceiling|천장|wall|벽|roof|지붕)/iu;

/** 이 칩셋에서 바탕이 될 자동 타일 그룹 — 물 같은 재질은 물 그룹, 돌은 길, 그 밖은 모랫길·흙길. 그림이 바탕 시트 안에 다 있어야 한다. */
export function pickQuickTerrainSource(tileset: TilesetDef, material: QuickMaterial, sheetCount: number): AutotileGroup | null {
  const eligible = (tileset.autotileGroups ?? []).filter((group) => !group.composer && !group.phaseVariants && group.layer !== "upper"
    && !group.id.includes(GROUP_MARK) && !SKIP.test(`${group.id} ${group.name}`) && Object.keys(group.variantMap).length > 0
    && group.memberTileIds.length > 0 && group.memberTileIds.every((tile) => tile >= 0 && tile < sheetCount));
  const named = (pattern: RegExp) => eligible.find((group) => pattern.test(`${group.id} ${group.name}`));
  if (material.liquid) return named(LIQUID) ?? named(SOFT) ?? eligible[0] ?? null;
  if (material.hard) return named(HARD) ?? named(SOFT) ?? eligible.find((g) => !LIQUID.test(`${g.id} ${g.name}`)) ?? null;
  return named(SOFT) ?? named(HARD) ?? eligible.find((g) => !LIQUID.test(`${g.id} ${g.name}`)) ?? null;
}

const interiorTile = (group: AutotileGroup): number => group.variantMap["255"] ?? group.memberTileIds[0]!;

/** 그룹이 쓰는 칸 전부(멤버·속 변형) + 그 칸의 움직이는 프레임. 순서 = 새 시트 칸 순서. */
export function quickTerrainTiles(tileset: TilesetDef, group: AutotileGroup): { tiles: number[]; strips: { base: number; frames: number; fps: number }[] } {
  const roots = [...new Set([...group.memberTileIds, ...Object.values(group.variantMap), ...(group.interiorVariants ?? []).flat()])].filter((t) => t >= 0);
  const stripOf = new Map((tileset.animationStrips ?? []).map((strip) => [strip.baseTile, strip]));
  const tiles: number[] = [];
  const strips: { base: number; frames: number; fps: number }[] = [];
  const seen = new Set<number>();
  for (const root of roots) {
    if (seen.has(root)) continue;
    const strip = stripOf.get(root);
    const frames = strip && strip.frames > 1 ? strip.frames : 1;
    if (frames > 1) strips.push({ base: tiles.length, frames, fps: strip!.fps });
    for (let f = 0; f < frames; f++) { tiles.push(root + f); seen.add(root + f); }
  }
  return { tiles, strips };
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lum = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * 원본 칸들을 잘라 재질 색만 바꾼 새 시트(16칸 폭). sheet = 원본 칩셋 바탕 그림(투명색 뺀 것).
 * 재질 색 = 속 칸(+프레임)의 불투명 색. 가장자리 칸은 그 색과 RGB 거리 24 안쪽만 바꾼다.
 */
export function recolorQuickTerrain(sheet: Rgba8Image, tileSize: number, tiles: readonly number[], interiorTiles: readonly number[], ramp: Ramp): Rgba8Image {
  const perRow = Math.floor(sheet.width / tileSize);
  const at = (tile: number, x: number, y: number) => (((Math.floor(tile / perRow) * tileSize + y) * sheet.width) + (tile % perRow) * tileSize + x) * 4;
  // 재질 색마다 화소 수 → 밝기 순 누적 비율(가운데)을 색 단계 위치로 쓴다 — 어두운 물 시트도 단계 전체에 고르게 퍼진다.
  const counts = new Map<number, number>();
  for (const tile of interiorTiles) {
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
      const i = at(tile, x, y);
      if (sheet.data[i + 3]! < 128) continue;
      const key = (sheet.data[i]! << 16) | (sheet.data[i + 1]! << 8) | sheet.data[i + 2]!;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const keyLum = (key: number) => lum((key >> 16) & 255, (key >> 8) & 255, key & 255);
  const sorted = [...counts.keys()].sort((a, b) => keyLum(a) - keyLum(b));
  const total = sorted.reduce((sum, key) => sum + counts.get(key)!, 0) || 1;
  const rank = new Map<number, number>();
  let run = 0;
  for (const key of sorted) { const n = counts.get(key)!; rank.set(key, (run + n / 2) / total); run += n; }
  const steps = ramp.map(hexRgb);
  const toRamp = (t: number): [number, number, number] => steps[Math.max(0, Math.min(steps.length - 1, Math.round(t * (steps.length - 1))))]!;
  const materialRgb = sorted.map((key) => [key, (key >> 16) & 255, (key >> 8) & 255, key & 255] as const);
  /** 가장자리 칸의 색 → 재질이면 단계 위치(0~1), 아니면 null. 재질 색과 RGB 거리 24 안쪽이면 가장 가까운 재질 색의 위치. */
  const near = new Map<number, number | null>();
  const placeOf = (key: number, r: number, g: number, b: number): number | null => {
    const exact = rank.get(key);
    if (exact !== undefined) return exact;
    if (near.has(key)) return near.get(key)!;
    let best: number | null = null, bestD = 24 * 24 + 1;
    for (const [mk, mr, mg, mb] of materialRgb) {
      const d = (mr - r) ** 2 + (mg - g) ** 2 + (mb - b) ** 2;
      if (d < bestD) { bestD = d; best = rank.get(mk)!; }
    }
    near.set(key, best);
    return best;
  };
  const rows = Math.max(1, Math.ceil(tiles.length / SHEET_COLUMNS));
  const out: Rgba8Image = { width: SHEET_COLUMNS * tileSize, height: rows * tileSize, data: new Uint8ClampedArray(SHEET_COLUMNS * tileSize * rows * tileSize * 4) };
  tiles.forEach((tile, k) => {
    const ox = (k % SHEET_COLUMNS) * tileSize, oy = Math.floor(k / SHEET_COLUMNS) * tileSize;
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
      const i = at(tile, x, y);
      const o = ((oy + y) * out.width + ox + x) * 4;
      const r = sheet.data[i]!, g = sheet.data[i + 1]!, b = sheet.data[i + 2]!, a = sheet.data[i + 3]!;
      const place = a >= 128 ? placeOf((r << 16) | (g << 8) | b, r, g, b) : null;
      if (place !== null) {
        const [nr, ng, nb] = toRamp(place);
        out.data[o] = nr; out.data[o + 1] = ng; out.data[o + 2] = nb; out.data[o + 3] = a;
      } else {
        out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = a;
      }
    }
  });
  return out;
}

export interface QuickTerrainInstall {
  readonly title: string;
  readonly source: AutotileGroup;
  readonly tiles: readonly number[];
  readonly strips: readonly { readonly base: number; readonly frames: number; readonly fps: number }[];
  readonly asset: { readonly id: string; readonly dataUrl: string; readonly width: number; readonly height: number };
}

export interface QuickTerrainResult { readonly groupId: string; readonly brushTile: number; readonly base: number; readonly added: number }

const rowAligned = (count: number, perRow: number): number => Math.ceil(Math.max(0, count) / Math.max(1, perRow)) * Math.max(1, perRow);

/** 새 그림을 칩셋에 덧붙이고 원본 그룹을 본뜬 새 그룹을 더한다(project 제자리 — store.update 초안에 대고 부른다). 같은 그림이면 다시 붙이지 않는다. */
export function installQuickTerrain(
  project: { tilesets: Record<string, TilesetDef>; assets?: { uploaded: Record<string, unknown> } },
  tilesetId: string,
  input: QuickTerrainInstall,
): QuickTerrainResult {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) throw new Error(`칩셋이 없습니다: ${tilesetId}`);
  const groupId = `${input.source.id}${GROUP_MARK}${input.asset.id.slice(QUICK_TERRAIN_ASSET_PREFIX.length, QUICK_TERRAIN_ASSET_PREFIX.length + 8)}`;
  const existing = (tileset.autotileGroups ?? []).find((group) => group.id === groupId);
  if (existing) {
    const graft = (tileset.tileGrafts ?? []).find((g) => g.sourceChipset === input.asset.id && g.sourceTile === 0);
    return { groupId, brushTile: interiorTile(existing), base: graft?.targetTile ?? 0, added: 0 };
  }
  if (project.assets && !project.assets.uploaded[input.asset.id]) {
    project.assets.uploaded[input.asset.id] = {
      id: input.asset.id, name: `공방 지형 · ${input.title}`, kind: "tileset", generatedBy: "workshop", dataUrl: input.asset.dataUrl,
      meta: { tileSize: tileset.tileSize, width: input.asset.width, height: input.asset.height },
    };
  }
  const others = (tileset.tileGrafts ?? []).reduce((max, g) => Math.max(max, g.targetTile + 1), 0);
  const base = rowAligned(Math.max(others, tileset.count), tileset.tilesPerRow);
  while (tileset.passability.length < base) tileset.passability.push({ ...PASS });
  while (tileset.priority.length < base) tileset.priority.push("lower");
  while (tileset.terrain.length < base) tileset.terrain.push(0);
  if (tileset.tileMeta) while (tileset.tileMeta.length < base) tileset.tileMeta.push({ label: "지형 칸 자리(빈 칸)", description: "", source: "user" } as TileAiMetadata);
  tileset.tileGrafts ??= [];
  const remap = new Map<number, number>();
  input.tiles.forEach((tile, k) => {
    const id = base + k;
    remap.set(tile, id);
    tileset.tileGrafts!.push({ sourceChipset: input.asset.id, sourceTile: k, targetTile: id, sourceTileSize: tileset.tileSize, sourceTilesPerRow: SHEET_COLUMNS });
    tileset.passability[id] = { ...(tileset.passability[tile] ?? PASS) };
    tileset.priority[id] = tileset.priority[tile] ?? "lower";
    tileset.terrain[id] = tileset.terrain[tile] ?? 0;
    if (tileset.tileMeta) tileset.tileMeta[id] = { label: `${input.title} · 공방 지형`, description: `${input.source.name} 모양을 본뜬 공방 지형`, source: "user" } as TileAiMetadata;
  });
  tileset.count = Math.max(tileset.count, base + input.tiles.length);
  const re = (tile: number): number => remap.get(tile) ?? tile;
  const members = input.source.memberTileIds.map(re);
  const group: AutotileGroup = {
    id: groupId,
    name: input.title,
    ...(input.source.neighborhood ? { neighborhood: input.source.neighborhood } : {}),
    memberTileIds: members,
    variantMap: Object.fromEntries(Object.entries(input.source.variantMap).map(([mask, tile]) => [mask, re(tile)])),
    ...(input.source.interiorVariants ? { interiorVariants: input.source.interiorVariants.map((row) => row.map(re)) } : {}),
    ...(input.source.edgeConnects ? { edgeConnects: true } : {}),
    ...(input.source.outsideConnects ? { outsideConnects: true } : {}),
  };
  tileset.autotileGroups = [...(tileset.autotileGroups ?? []), group];
  if (input.strips.length) tileset.animationStrips = [...(tileset.animationStrips ?? []), ...input.strips.map((s) => ({ baseTile: base + s.base, frames: s.frames, fps: s.fps }))];
  return { groupId, brushTile: interiorTile(group), base, added: input.tiles.length };
}

export { interiorTile as quickTerrainInteriorTile };
