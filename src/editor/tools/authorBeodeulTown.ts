import { naturalizeBeodeulHamlet } from './beodeulHamletTools';
import { harmonizeBeodeulDaylight } from './beodeulLightTools';
// author_beodeul_town — 버들항 문법으로 마을·도시를 블록 키트 조립으로 깐다(2026-10-01).
// 버들항(beodeul_city)은 한 채씩 집을 놓는 타일셋이 아니라 「가로 격자 → 블록 키트(bd-block-*) → 길 이음 → 공원·가로수」
// 순서로 조립하는 타일셋이다. author_village 는 숲마을 전용 절차 생성기라 버들항을 받지 못한다(village-tileset-mismatch).
// 이 도구는 scripts/content/lib/beodeul-layout-specs.ts 의 "blocks" 배치(검증 끝난 조립 순서)를 크기에 맞게 매개변수화한 것이다.
// 원본 도시 배치를 베끼지 않는다: 열 폭·띠 높이·블록 종류·공원 자리를 크기와 seed 로 새로 고른다.
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import type { GameMap, Project } from "@/project/types";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { assertMapIdAvailable } from "./mapHelpers";
import { MAP_TOOLS } from "./mapTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { BEODEUL_VILLAGE_THEMES, buildBeodeulVillage, themeDefaultSize, type BeodeulVillageTheme } from "./beodeulVillage";

import { buildSmallBeodeulVillage } from "./beodeulSmallVillage";
import { addBeodeulVillageChurch } from './beodeulArchitectureTools';
import { clearBeodeulGroundDressing, dressBeodeulGround } from "./beodeulGroundTools";

const BEODEUL_TILESET_ID = "beodeul_city";
const PAVING = "버들항 길 포석";
const GRASS = "버들항 풀밭";
const COL_WIDTHS = [20, 14] as const; // 블록 폭(키트가 있는 폭만)
const MIN_W = 16;
const MIN_H = 10;
const DEFAULT_W = 60;
const DEFAULT_H = 60;
const HARBOUR_W = 83;
const HARBOUR_H = 15;

const createMapTool = requireTool(MAP_TOOLS, "create_map");
const fillRegionTool = requireTool(CONSTRUCTION_TOOLS_V3, "fill_region");
const stampObjectTool = requireTool(SHARED_OBJECT_TOOLS, "stamp_object");

interface Rect { x: number; y: number; w: number; h: number }
interface BlockKit { id: string; kind: string; w: number; h: number }
interface PlacedBlock { id: string; x: number; y: number; w: number; h: number }
interface Seg { start: number; size: number; gapAfter: number }

export const AUTHOR_BEODEUL_TOWN_TOOL: ToolDefinition = {
  name: "author_beodeul_town",
  description:
    "버들항(beodeul_city) 타일셋으로 마을·도시를 한 번에 시공한다. houseCount 3~5를 지정하면 40×30의 소규모 밝은 잔디 마을: 별채 박공·이층·돌집·ㄱ자·낮은 집의 서로 다른 외형, 굽은 길과 샛길·우물 마당·살림·나무 군락. 새 마을을 만들 때 기존 맵은 보존한다. theme 으로 문법을 고른다. " +
    "마을(기본 theme:\"river\" 강가 마을 · \"coast\" 포구 · \"desert\" 사막 오아시스 · \"snow\" 설원 · \"swamp\" 늪 수상 마을): " +
    "사용자가 고른 버들항 변형 마을의 문법 — 물(강·바다·못·늪)을 먼저 깔고, 굽은 큰길(폭 2) 하나가 맵을 가로지르고(강은 아치 다리로 건넘), 뒷길·이음길이 고리를 만들고(막다른 길 없음), " +
    "큰길 위 광장(우물·좌판·벤치·등)과 그 북쪽 앵커 건물(여관·회관·대상 숙소), 길을 바라보는 집(문 앞 칸 = 길, 이웃 키트 반복 없음, 간격 1~3칸), " +
    "용도별 소품 덩이(방앗간·포구 그물터·대상 마당·얼음낚시터), 바깥 밭·숲 덩이까지 짓는다. 집·소품은 bd-house-*·고른 조각 bd-pick-* 키트다. " +
    "theme:\"city\" 는 로마풍 블록 격자 도시(가로 격자 → bd-block-* 블록 → 공원·가로수, harbour:true 이고 가로 83 이상이면 항구 호수)다 — 사용자가 「도시·로마풍·대도시·블록」을 말할 때만. " +
    "mapId 없으면 버들항 새 맵을 만든다(마을 기본 56×44 안팎, 36×30~96×80 / 도시 기본 60×60). mapId 가 있으면 그 버들항 맵 전체를 비우고 다시 깐다(다른 계열 맵이면 거부). " +
    "같은 seed = 같은 마을, 다른 배치는 seed 를 바꾼다. 시공 뒤 check_city_form·check_reachability 로 점검한다(마을의 문 앞 칸은 결과 data.doors). " +
    "고칠 곳만 stamp_object(kit:beodeul_city/…)·fill_region 으로 손본다 — 집을 하나씩 author_house 로 놓지 말 것. 던전·필드는 이 도구가 아니다(참고문서 beodeul-picks-dungeon·field, 필드 길은 author_wild_route).",
  mode: "write",
  domains: ["map"],
  preservesAuthoredRaster: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "기존 버들항 맵 id. 생략하면 새 맵을 만든다." },
      name: { type: "string", description: "새 맵 이름(기본: 버들 마을)" },
      id: { type: "string", description: "새 맵 id(생략 시 자동)" },
      width: { type: "integer", description: `새 맵 가로(기본 ${DEFAULT_W}, ${MIN_W}~${MAX_TOOL_MAP_DIMENSION}). 블록 격자에 맞춰 줄어든다.` },
      height: { type: "integer", description: `새 맵 세로(기본 ${DEFAULT_H}, ${MIN_H}~${MAX_TOOL_MAP_DIMENSION}). 블록 띠에 맞춰 줄어든다.` },
      seed: { type: "integer", description: "배치 변주 시드(같은 값 = 같은 마을). 생략하면 7" },
      houseCount: {type:"integer",minimum:3,maximum:5,description:"집 3~5채의 작은 잔디 마을. 5이면 서로 다른 집 외형 5종. 생략하면 기존 테마 마을/도시."},
      church: {type:'boolean',description:'소규모 houseCount 모드에 석조 교회와 마당을 추가한다. 오른쪽 빈 띠를 포함해 폭 54칸. 기본 false.'},
      theme: { type: "string", enum: [...BEODEUL_VILLAGE_THEMES, "city"], description: "마을 문법(기본 river): river 강가 · coast 포구(바다) · desert 사막 오아시스 · snow 설원 · swamp 늪 · city 로마풍 블록 도시(도시를 말할 때만)" },
      harbour: { type: "boolean", description: `true 이고 가로 ${HARBOUR_W} 이상이면 맨 아래에 항구 호수를 붙인다(세로 ${HARBOUR_H}칸 추가).` },
    },
  },
  invalidArgsExample: { width: 60, height: 60 },
  run(draft, args) {
    if(typeof args.mapId==='string') clearBeodeulGroundDressing(draft,args.mapId);
    const result=args.houseCount===undefined?buildTown(draft,args):buildSmallBeodeulVillage(draft,args);
    const theme=String(args.theme??(args.harbour===true?'coast':'river'));
    const mapId=(result.data as {mapId?:string}|undefined)?.mapId;
    if(mapId&&args.houseCount!==undefined&&args.church===true){
      const church=addBeodeulVillageChurch(draft,mapId);
      result.data={...(result.data as Record<string,unknown>),church,width:draft.maps[mapId]!.width};
      result.summary+=' 석조 교회와 마당을 연결했습니다.';
    }
    if(mapId&&['river','coast','city'].includes(theme)) {
      const dressing=dressBeodeulGround(draft,mapId,'living',Number(args.seed??7));
      result.data={...(result.data as Record<string,unknown>),groundDressing:dressing.data};
      result.summary+=` ${dressing.summary}`;
    }
    if(mapId&&args.houseCount!==undefined){
      const composition=naturalizeBeodeulHamlet(draft,mapId);
      result.data={...(result.data as Record<string,unknown>),composition:composition.data};result.summary+=` ${composition.summary}`;
      const light=harmonizeBeodeulDaylight(draft,mapId);
      result.data={...(result.data as Record<string,unknown>),daylight:light.data};result.summary+=` ${light.summary}`;
    }
    return result;
  },
};

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

function intArg(args: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
  return Math.max(min, Math.min(max, value));
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

/** 축 하나를 조각(폭/높이)과 사이 길로 나눈다. 위치는 0 기준 상대값. 조각이 avenueMin 개 이상이면 가운데 사이 길을 4칸 대로로 넓힌다
 * (대로 때문에 조각이 줄어 땅을 더 못 쓰면 대로 없이 나눈 쪽을 고른다). */
function planAxis(total: number, pick: (i: number, room: number) => number | null, trailingGap: boolean, avenueMin: number): Seg[] {
  const layout = (avenue: number): Seg[] => {
    const segs: Seg[] = [];
    let pos = 0;
    for (let i = 0; ; i += 1) {
      const room = total - pos - (trailingGap ? 2 : 0);
      const size = pick(i, room);
      if (size === null || size > room) break;
      const gap = i === avenue ? 4 : 2;
      segs.push({ start: pos, size, gapAfter: gap });
      pos += size + gap;
    }
    return segs;
  };
  const extent = (segs: Seg[]): number => (segs.length ? segs[segs.length - 1]!.start + segs[segs.length - 1]!.size : 0);
  const plain = layout(-1);
  if (plain.length < avenueMin) return plain;
  let avenue = Math.floor(plain.length / 2) - 1;
  let withAvenue = layout(avenue);
  for (let pass = 0; pass < 3; pass += 1) {
    const next = withAvenue.length >= avenueMin ? Math.floor(withAvenue.length / 2) - 1 : -1;
    if (next === avenue) break;
    avenue = next;
    withAvenue = layout(avenue);
  }
  if (avenue < 0 || withAvenue.length < avenueMin) return plain;
  return extent(withAvenue) >= extent(plain) - 2 ? withAvenue : plain;
}

function kitsOf(tileset: any): Map<string, { w: number; h: number; kit: any }> {
  const out = new Map<string, { w: number; h: number; kit: any }>();
  for (const kit of (tileset?.structureKits ?? []) as any[]) out.set(kit.id, { w: kit.width, h: kit.height, kit });
  return out;
}

function parseBlocks(tileset: any): BlockKit[] {
  const out: BlockKit[] = [];
  for (const kit of (tileset?.structureKits ?? []) as any[]) {
    const m = /^bd-block-([a-z]+)-(\d+)x(\d+)(?:-[bc])?$/.exec(kit.id);
    if (m) out.push({ id: kit.id, kind: m[1]!, w: Number(m[2]), h: Number(m[3]) });
  }
  return out;
}

function buildTown(draft: Project, args: Record<string, unknown>): ToolExecResult {
  const themeArg = typeof args.theme === "string" ? args.theme.trim() : "";
  if (themeArg && themeArg !== "city" && !(BEODEUL_VILLAGE_THEMES as readonly string[]).includes(themeArg)) {
    throw new ToolError(`theme 은 ${[...BEODEUL_VILLAGE_THEMES, "city"].join("|")} 중 하나다(받은 값: ${themeArg}).`, { code: "invalid-args" });
  }
  if (themeArg !== "city") return buildVillage(draft, args, (themeArg || (args.harbour === true ? "coast" : "river")) as BeodeulVillageTheme);
  const seed = intArg(args, "seed", 7, 0, 2 ** 31 - 1);
  const rand = rng(seed * 2654435761 + 12345);
  const warnings: string[] = [];
  const wantHarbour = args.harbour === true;
  let mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
  const creating = !mapId;

  // 1. 크기
  let W: number, H: number;
  if (creating) {
    W = intArg(args, "width", DEFAULT_W, MIN_W, MAX_TOOL_MAP_DIMENSION);
    H = intArg(args, "height", DEFAULT_H, MIN_H, MAX_TOOL_MAP_DIMENSION);
  } else {
    const existing = draft.maps[mapId];
    if (!existing) throw new ToolError(`맵이 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    W = existing.width;
    H = existing.height;
  }
  let harbour = false;
  if (wantHarbour) {
    if (W >= HARBOUR_W && H >= HARBOUR_H + MIN_H) harbour = true;
    else warnings.push(`항구 호수는 가로 ${HARBOUR_W} 이상·세로 ${HARBOUR_H + MIN_H} 이상에서만 붙는다. 이번에는 생략했다.`);
  }

  const tileset: any = draft.tilesets[BEODEUL_TILESET_ID];
  if (!tileset) throw new ToolError("이 프로젝트에는 버들항 타일셋(beodeul_city)이 없다.", { code: "beodeul-tileset-missing" });
  const kits = kitsOf(tileset);
  const blocks = parseBlocks(tileset);
  if (!blocks.length) throw new ToolError("버들항 블록 키트(bd-block-*)를 찾을 수 없다.", { code: "beodeul-kits-missing" });
  const blockSizes = new Set(blocks.map((b) => `${b.w}x${b.h}`));

  // 2. 계획: 열(가로)과 띠(세로)
  const colPlanWidth = W;
  const cols = planAxis(colPlanWidth - 2, (i, room) => {
    for (const w of [i % 3 === 2 ? 14 : 20, 20, 14]) if (w <= room && COL_WIDTHS.includes(w as 20 | 14)) return w;
    return null;
  }, false, 3).map((s) => ({ ...s, start: s.start + 2 }));
  if (!cols.length) throw new ToolError(`가로 ${W}칸에는 블록(14칸 이상)이 들어가지 않는다. 16칸 이상으로 만들 것.`, { code: "town-too-small" });
  const planH = harbour ? H - HARBOUR_H : H;
  const useChurch = planH >= 40 && cols.length >= 2;
  const bands: { y: number; h: number; gapAfter: number; church: boolean }[] = [];
  {
    const heightCycle = [13, 13, 8];
    const segs = planAxis(planH, (i, room) => {
      if (i === 0 && useChurch) return 17;
      const k = useChurch ? i - 1 : i;
      const h = heightCycle[k % heightCycle.length]!;
      if (h <= room) return h;
      return room >= 8 ? 8 : null;
    }, true, 4);
    segs.forEach((s, i) => bands.push({ y: s.start, h: s.size, gapAfter: s.gapAfter, church: useChurch && i === 0 }));
  }
  if (!bands.length) throw new ToolError(`세로 ${H}칸에는 블록 띠(8칸+길 2칸)가 들어가지 않는다. ${MIN_H}칸 이상으로 만들 것.`, { code: "town-too-small" });
  const lastCol = cols[cols.length - 1]!;
  const planW = lastCol.start + lastCol.size;
  const lastBand = bands[bands.length - 1]!;
  const planBottom = lastBand.y + lastBand.h + lastBand.gapAfter;
  if (creating) {
    W = planW;
    H = planBottom + (harbour ? HARBOUR_H : 0);
  }

  // 3. 맵
  if (creating) {
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "버들 마을";
    mapId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : uniqueId(draft, "map_beodeul", `${seed}_${W}x${H}`);
    assertMapIdAvailable(draft, mapId);
    createMapTool.run(draft, { id: mapId, name, width: W, height: H, tilesetId: BEODEUL_TILESET_ID, border: "none" });
  } else {
    const existing = draft.maps[mapId]!;
    if (existing.tilesetId !== BEODEUL_TILESET_ID && !kitsOf(draft.tilesets[existing.tilesetId]).has("bd-block-res-20x13")) {
      throw new ToolError(
        `맵 ${mapId} 는 버들항 타일셋이 아니다(${existing.tilesetId}). author_beodeul_town 은 버들항 맵에서만 쓴다. ` +
          "같은 계열의 마을은 author_village 로, 버들항으로 바꾸려면 사용자에게 칩셋 변경을 먼저 물어라.",
        { code: "beodeul-tileset-required", mapId },
      );
    }
  }
  const map = (): GameMap => draft.maps[mapId]!;
  const fill = (rect: Rect, material: string, clearUpper?: boolean): boolean => {
    try {
      fillRegionTool.run(draft, { mapId, rect, material, ...(clearUpper !== undefined ? { clearUpper } : {}) });
      return true;
    } catch {
      return false;
    }
  };
  const stamp = (kitId: string, x: number, y: number): boolean => {
    try {
      stampObjectTool.run(draft, { objectId: `kit:${BEODEUL_TILESET_ID}/${kitId}`, mapId, x, y });
      return true;
    } catch {
      return false;
    }
  };
  fill({ x: 0, y: 0, w: W, h: H }, GRASS, true);

  // 열린 풀밭 판정
  const lawn = new Set<number>();
  for (const g of (tileset.tileGroups ?? []) as any[]) if (g.id === "beodeul:grass") for (const t of g.tileIds) lawn.add(t);
  for (const [id, k] of kits) if (/^bd-ground-lawn-/.test(id)) for (const r of k.kit.rows) for (const t of r.tiles) if (t >= 0) lawn.add(t);
  const freeFor = (kitId: string, x: number, y: number, margin = 0): boolean => {
    const k = kits.get(kitId);
    if (!k) return false;
    const m = map();
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) {
      const r = k.kit.rows[j];
      const lo = r.tiles[i], up = r.upperTiles?.[i] ?? -1;
      if (lo < 0 && up < 0) continue;
      for (let dy = -margin; dy <= margin; dy += 1) for (let dx = -margin; dx <= margin; dx += 1) {
        const cx = x + i + dx, cy = y + j + dy;
        if (cx < 0 || cy < 0 || cx >= m.width || cy >= m.height) { if (dx === 0 && dy === 0) return false; continue; }
        const idx = cy * m.width + cx;
        if (m.upperTiles[idx]! >= 0 || !lawn.has(m.lowerTiles[idx]!)) return false;
      }
    }
    return true;
  };
  const dense = (rect: Rect, ids: string[], count: number, avoid: (x: number, y: number) => boolean = () => false): number => {
    const usable = ids.filter((id) => kits.has(id));
    if (!usable.length || rect.w < 1 || rect.h < 1) return 0;
    let placed = 0;
    for (let n = 0; n < count * 20 && placed < count; n += 1) {
      const id = usable[Math.floor(rand() * usable.length)]!;
      const k = kits.get(id)!;
      if (k.w > rect.w || k.h > rect.h) continue;
      const x = rect.x + Math.floor(rand() * (rect.w - k.w + 1)), y = rect.y + Math.floor(rand() * (rect.h - k.h + 1));
      let bad = false;
      for (let j = 0; j < k.h && !bad; j += 1) for (let i = 0; i < k.w; i += 1) if (avoid(x + i, y + j)) { bad = true; break; }
      if (bad || !freeFor(id, x, y) || !stamp(id, x, y)) continue;
      placed += 1;
    }
    return placed;
  };
  const onPath = (x: number, y: number): boolean => !lawn.has(map().lowerTiles[y * map().width + x]!);
  const PARK_TREES = ["bd-tree-03a8f7", "bd-tree-a80c85", "bd-tree-e9d9b3", "bd-tree-cc0fcb", "bd-tree-47e17a"];
  const PARK_PROPS = ["bd-prop-flowerbed", "bd-prop-bench_wood", "bd-prop-planter_round", "bd-tree-eef4bc"];
  const plant = (rect: Rect, thick = 1): void => {
    if (rect.w < 1 || rect.h < 1) return;
    const area = rect.w * rect.h;
    dense(rect, PARK_TREES, Math.round((area / 14) * thick), onPath);
    dense(rect, PARK_PROPS, Math.round((area / 12) * thick), onPath);
  };

  // 4. 길 격자를 먼저 깐다
  const bottom = planBottom;
  fill({ x: 0, y: 0, w: 2, h: bottom }, PAVING);
  cols.slice(0, -1).forEach((c) => fill({ x: c.start + c.size, y: 0, w: c.gapAfter, h: bottom }, PAVING));
  bands.forEach((b) => fill({ x: 0, y: b.y + b.h, w: planW, h: b.gapAfter }, PAVING));
  const churchBand = bands[0]!.church ? bands[0]! : null;
  if (churchBand) {
    const c0 = cols[0]!;
    const ax = c0.start + c0.size;
    if (planW - ax > 0) fill({ x: ax, y: churchBand.y + 8, w: planW - ax, h: 1 }, PAVING);
  }
  if (harbour) stamp("bd-harbour-lake", 0, bottom);

  // 5. 블록 고르기 + 찍기
  const placed: PlacedBlock[] = [];
  const uses: Record<string, number> = {};
  const conflicts = (id: string, x: number, y: number, w: number, h: number): boolean =>
    placed.some((p) => {
      if (p.id !== id) return false;
      const gx = Math.max(x - (p.x + p.w), p.x - (x + w)), gy = Math.max(y - (p.y + p.h), p.y - (y + h));
      return (gx < 0 && gy <= 20) || (gy < 0 && gx <= 20);
    });
  const rolePrefs = (bandIdx: number, colIdx: number, bandH: number): string[] => {
    const lastB = bandIdx === bands.length - 1 && bands.length >= 3;
    if (lastB) return ["port", "out", "market", "res", "shop"];
    const midB = bandIdx === Math.floor((bands.length - 1) / 2), midC = colIdx === Math.floor(cols.length / 2);
    if (midB && midC) return ["market", "manor", "shop", "res"];
    const base = bandH === 13 ? ["res", "shop", "manor", "res", "market", "out"] : ["res", "shop", "res", "market", "out"];
    const off = Math.floor(rand() * base.length);
    return [...base.slice(off), ...base.slice(0, off)];
  };
  const placeBlock = (x: number, y: number, w: number, h: number, prefs: string[], allowKinds?: string[]): PlacedBlock | null => {
    const pool = blocks.filter((b) => b.w === w && b.h === h && b.kind !== "church" && (allowKinds ? allowKinds.includes(b.kind) : b.kind !== "port" || prefs.includes("port")));
    if (!pool.length) return null;
    const scored = pool.map((b) => {
      const rank = prefs.indexOf(b.kind);
      return { b, score: (rank < 0 ? 9 : rank) + rand() * 1.6 + (uses[b.id] ?? 0) * 4 + (conflicts(b.id, x, y, w, h) ? 50 : 0) };
    }).sort((a, z) => a.score - z.score);
    for (const { b } of scored) {
      if (!stamp(b.id, x, y)) continue;
      const p = { id: b.id, x, y, w, h };
      placed.push(p);
      uses[b.id] = (uses[b.id] ?? 0) + 1;
      return p;
    }
    return null;
  };
  // 공원 칸: 오른쪽 끝 열, 아래에서 두 번째 띠(3열·3띠 이상일 때)
  const parkBand = bands.length >= 3 ? bands.length - 2 : -1;
  const parkCol = cols.length >= 3 ? cols.length - 1 : -1;
  const leftovers: Rect[] = [];
  bands.forEach((band, bi) => {
    cols.forEach((col, ci) => {
      if (band.church) {
        if (ci === 0) {
          const id = [`bd-block-church-${col.size}x17`].find((k) => kits.has(k));
          if (id && stamp(id, col.start, band.y)) { placed.push({ id, x: col.start, y: band.y, w: col.size, h: 17 }); uses[id] = (uses[id] ?? 0) + 1; } else leftovers.push({ x: col.start, y: band.y, w: col.size, h: 17 });
          return;
        }
        const a = placeBlock(col.start, band.y, col.size, 8, rolePrefs(bi, ci, 8), ["res", "shop", "market", "out"]);
        const b = placeBlock(col.start, band.y + 9, col.size, 8, rolePrefs(bi, ci, 8), ["res", "shop", "market", "out"]);
        if (!a) leftovers.push({ x: col.start, y: band.y, w: col.size, h: 8 });
        if (!b) leftovers.push({ x: col.start, y: band.y + 9, w: col.size, h: 8 });
        return;
      }
      if (bi === parkBand && ci === parkCol) { leftovers.push({ x: col.start, y: band.y, w: col.size, h: band.h }); return; }
      if (!blockSizes.has(`${col.size}x${band.h}`)) { leftovers.push({ x: col.start, y: band.y, w: col.size, h: band.h }); return; }
      if (!placeBlock(col.start, band.y, col.size, band.h, rolePrefs(bi, ci, band.h))) leftovers.push({ x: col.start, y: band.y, w: col.size, h: band.h });
    });
  });

  // 6. 골목 끝 잇기: 13칸 깊이 주택/상점/외곽 블록의 뒷골목이 길과 만나는 칸(바깥 한 칸씩)만 다시 포석으로
  // (길 전체를 다시 채우면 fill_region 이 블록 테두리의 한 칸 틈을 메워 길이 블록을 문다)
  for (const p of placed) {
    if (p.h !== 13 || !/^bd-block-(res|shop|out)-/.test(p.id)) continue;
    const y = p.y + 6;
    if (p.x - 1 >= 0) fill({ x: p.x - 1, y, w: 1, h: 1 }, PAVING);
    if (p.x + p.w < planW) fill({ x: p.x + p.w, y, w: 1, h: 1 }, PAVING);
  }

  // 7. 공원(대각 산책로) · 남는 땅 심기
  for (const r of leftovers) {
    const isPark = r.w >= 10 && r.h >= 8 && r.h <= 13;
    if (isPark) {
      for (let t = 0; t < r.h; t += 1) fill({ x: r.x + Math.round((t * (r.w - 3)) / Math.max(1, r.h - 1)), y: r.y + t, w: 3, h: 1 }, PAVING);
    }
    plant(r);
  }
  if (planW < W) plant({ x: planW, y: 0, w: W - planW, h: bottom });
  if (bottom < (harbour ? H - HARBOUR_H : H)) plant({ x: 0, y: bottom, w: W, h: (harbour ? H - HARBOUR_H : H) - bottom });
  if (harbour && W > HARBOUR_W) plant({ x: HARBOUR_W, y: bottom, w: W - HARBOUR_W, h: HARBOUR_H }, 2.2);

  // 8. 대로 가로수·가로등(문이나 골목이 열리지 않는 가장자리 줄)
  const crossX = new Set<number>();
  for (const x of [0, 1]) crossX.add(x);
  cols.slice(0, -1).forEach((c) => { for (let i = -1; i <= c.gapAfter; i += 1) crossX.add(c.start + c.size + i); });
  crossX.add(-1); crossX.add(2);
  const crossY = new Set<number>();
  for (const b of bands) {
    for (let i = -1; i <= b.gapAfter; i += 1) crossY.add(b.y + b.h + i);
    if (b.church) for (const y of [b.y + 7, b.y + 8, b.y + 9]) crossY.add(y);
    else if (b.h === 13) for (const y of [b.y + 5, b.y + 6, b.y + 7]) crossY.add(y);
  }
  const avenueCol = cols.findIndex((c) => c.gapAfter === 4);
  if (avenueCol >= 0) {
    const c = cols[avenueCol]!;
    const ax = c.start + c.size + 3;
    let n = 0;
    for (let y = 10; y + 2 < bottom; y += 4) {
      if ([y, y + 1, y + 2].some((v) => crossY.has(v))) continue;
      stamp(n++ % 2 ? "bd-tree-28ad5e" : "bd-prop-lamp_crook", ax, y);
    }
  }
  const avenueBand = bands.findIndex((b) => b.gapAfter === 4);
  if (avenueBand >= 0) {
    const b = bands[avenueBand]!;
    const ay = b.y + b.h + 1;
    let n = 0;
    for (let x = 4; x < planW - 1; x += 5) {
      if (crossX.has(x)) continue;
      stamp(n++ % 2 ? "bd-tree-eef4bc" : "bd-prop-lamp_crook", x, ay);
    }
  }

  const kindCount: Record<string, number> = {};
  for (const p of placed) { const k = /^bd-block-([a-z]+)-/.exec(p.id)?.[1] ?? "?"; kindCount[k] = (kindCount[k] ?? 0) + 1; }
  const planCols = cols.map((c) => c.size).join("+");
  const planBands = bands.map((b) => b.h).join("+");
  return {
    summary: `버들항 마을 ${W}×${H} (맵 ${mapId}): 블록 ${placed.length}개(${Object.entries(kindCount).map(([k, n]) => `${k} ${n}`).join(", ")}), 열 ${planCols}, 띠 ${planBands}${harbour ? ", 항구 호수 포함" : ""}. ` +
      "다음: check_city_form 과 check_reachability 로 길·문 앞 통행을 점검하고, 이름·NPC·이벤트는 그 뒤에 올린다.",
    data: {
      mapId, width: W, height: H, seed, tilesetId: BEODEUL_TILESET_ID,
      blocks: placed.map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h })),
      columns: cols.map((c) => ({ x: c.start, w: c.size })),
      bands: bands.map((b) => ({ y: b.y, h: b.h })),
      parks: leftovers.length,
      ...(harbour ? { harbour: { id: "bd-harbour-lake", x: 0, y: bottom } } : {}),
    },
    warnings: warnings.length ? warnings : undefined,
  };
}

const VILLAGE_MIN_W = 36, VILLAGE_MIN_H = 30, VILLAGE_MAX_W = 96, VILLAGE_MAX_H = 80;

function buildVillage(draft: Project, args: Record<string, unknown>, theme: BeodeulVillageTheme): ToolExecResult {
  const seed = intArg(args, "seed", 7, 0, 2 ** 31 - 1);
  const tileset: any = draft.tilesets[BEODEUL_TILESET_ID];
  if (!tileset) throw new ToolError("이 프로젝트에는 버들항 타일셋(beodeul_city)이 없다.", { code: "beodeul-tileset-missing" });
  let mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
  const [dw, dh] = themeDefaultSize(theme);
  if (!mapId) {
    const W = intArg(args, "width", dw, VILLAGE_MIN_W, VILLAGE_MAX_W);
    const H = intArg(args, "height", dh, VILLAGE_MIN_H, VILLAGE_MAX_H);
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "버들 마을";
    mapId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : uniqueId(draft, "map_beodeul", `${theme}_${seed}`);
    assertMapIdAvailable(draft, mapId);
    createMapTool.run(draft, { id: mapId, name, width: W, height: H, tilesetId: BEODEUL_TILESET_ID, border: "none" });
  } else {
    const existing = draft.maps[mapId];
    if (!existing) throw new ToolError(`맵이 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    if (existing.tilesetId !== BEODEUL_TILESET_ID) {
      throw new ToolError(
        `맵 ${mapId} 는 버들항 타일셋이 아니다(${existing.tilesetId}). author_beodeul_town 은 버들항 맵에서만 쓴다. 버들항으로 바꾸려면 사용자에게 칩셋 변경을 먼저 물어라.`,
        { code: "beodeul-tileset-required", mapId },
      );
    }
    if (existing.width < VILLAGE_MIN_W || existing.height < VILLAGE_MIN_H) {
      throw new ToolError(`마을 문법은 ${VILLAGE_MIN_W}×${VILLAGE_MIN_H} 이상 맵에서 짓는다(지금 ${existing.width}×${existing.height}). mapId 없이 새 맵을 만들 것.`, { code: "town-too-small", mapId });
    }
    existing.structurePlacements = [];
  }
  const r = buildBeodeulVillage(draft, mapId, theme, seed);
  return { summary: r.summary, data: r.data, warnings: r.warnings.length ? r.warnings : undefined };
}

function uniqueId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((m) => m.events.map((e) => e.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}
