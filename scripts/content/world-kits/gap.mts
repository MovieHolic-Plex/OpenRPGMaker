// 테마 칩셋 빈칸 재고(모델 없음, 그리지 않는다) — 조수가 게임 한 편을 통째로 짓는 테마 칩셋 아홉이 버들항에 견줘 무엇이 모자란지 키트와 구성기 출력에서 잰다.
//
//   bun scripts/content/world-kits/gap.mts <out.json> [--seeds 6] [--saves <저장 폴더 목록 파일>] [--bank harness-data/assistant-capability/spec-bank] [--only <칩셋,…>]
//
// 씨앗마다 게임 열쇠(lookKey)가 다르다 — 씨앗 n 은 «게임 n» 이다. 조수 실행처럼 그 게임의 변형 그림·바닥 재질을 고른다(변형이 없는 칩셋은 열쇠와 무관하다).
//
// 재는 것
//  ① 키트 수(역할별)·종류별 그림 장수(kinds.json 의 낱말 표 — 키트 id 토막이 통째로 같을 때만) · 건물은 종류와 크기
//  ② 바닥 재질 가짓수(걷는 지형 그룹을 변주·방향 꼬리를 떼어 묶는다 — 가장자리 조각은 뺀다)
//  ③ 그 칩셋의 구성 도구를 종류(style/kind)마다 씨앗 여섯으로 짜서 «실제로 놓이는 키트» 와 놓인 횟수, 깔린 바닥 재질, 씨앗 사이 닮음(놓인 키트 집합의 자카드 평균)
//  ④ 놓이는데 그림이 한 장뿐인 종류(«게임마다 같은 그림») · 버들항에는 있고 이 칩셋에는 없는 종류
//  ⑤ (--saves) 저장된 조수 게임에서 그 칩셋 맵 수·게임 수와 놓인 키트 — 구성기 여섯 씨앗에는 안 나오는데 저장본에는 놓인 키트 = v2 빌더·조수가 따로 놓은 것
//  ⑥ (--bank) 명세 은행에서 그 칩셋을 쓰는 명세·맵 수
// 놓인 키트는 맵에서 키트의 칸 배열이 통째로 맞는 자리를 센다(구성기 내부 표를 읽지 않는다 — 결과를 본다).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools";
import { getTool } from "../../../src/editor/tools/toolRegistry";
import { readProjectSqlite } from "../read-project-sqlite.mts";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "../../../src/project/types";

const argv = process.argv.slice(2);
const outFile = argv[0];
if (!outFile) { console.error("usage: gap.mts <out.json> [--seeds n] [--saves list.txt] [--bank dir]"); process.exit(2); }
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SEEDS = Number(opt("--seeds") ?? 6) || 6;
const ONLY = new Set((opt("--only") ?? "").split(",").filter(Boolean));
const HERE = path.dirname(new URL(import.meta.url).pathname);
type Conf = { worlds: Record<string, { tools: [string, string][]; rooms: string[] }>; reference: string; skip: string[]; kinds: [string, string, string, string[]][]; categories: Record<string, string> };
const conf = JSON.parse(fs.readFileSync(path.join(HERE, "kinds.json"), "utf8")) as Conf;
const WORD = new Map<string, { kind: string; category: string }>();
const KIND_LABEL: Record<string, string> = {};
for (const [kind, category, label, words] of conf.kinds) { KIND_LABEL[kind] = label; for (const w of words) WORD.set(w, { kind, category }); }
const SKIP = new Set(conf.skip);
const SHELL = new Set(["wall", "floor", "ceil", "deck", "roof"]);
const OUT_SIZES: [number, number][] = [[56, 44], [48, 36], [64, 48], [40, 30], [28, 20], [24, 16]];
const ROOM_SIZES: [number, number][] = [[20, 14], [16, 12], [14, 10], [24, 16], [13, 16], [18, 13], [12, 9], [28, 20], [40, 30], [56, 44]];
const blank = createBlankProject() as Project;
const entrance = (k: StructureKitDef) => ((k as { parts?: { kind?: string }[] }).parts ?? []).some((p) => p.kind === "entrance");
/** 키트 id 토막(머리의 칩셋 표시 한 토막은 뗀다). */
const tokens = (k: StructureKitDef) => k.id.toLowerCase().split(/[-_]/u).slice(1).filter((t) => t && !/^\d+$/u.test(t));
const wordOf = (t: string) => WORD.get(t) ?? (t.endsWith("s") ? WORD.get(t.slice(0, -1)) : undefined);
/** 키트의 종류·갈래. 변형 키트(ai.variantOf)는 원본의 종류다. */
function kindOf(k: StructureKitDef, byId: Map<string, StructureKitDef>, depth = 0): { kind: string; category: string } {
  const base = k.ai?.variantOf ? byId.get(k.ai.variantOf) : undefined;
  if (base && depth < 3) return kindOf(base, byId, depth + 1);
  const ts = tokens(k);
  const head = ts.find((t) => !SKIP.has(t)) ?? ts[0] ?? k.id;
  if (entrance(k) || k.ai?.role === "building") return { kind: `건물:${head}`, category: "building" };
  if (SHELL.has(ts[0] ?? "") && k.ai?.role !== "prop") return { kind: `껍데기:${ts[0]}`, category: "shell" };
  for (const t of ts) { const hit = wordOf(t); if (hit) return hit; }
  if (SHELL.has(ts[0] ?? "")) return { kind: `껍데기:${ts[0]}`, category: "shell" };
  return { kind: head, category: "other" };
}
const EDGE = /가장자리|모서리|↔|천장|밑면|하늘|기물|테\(|edge|이음/u;
/** 걷는 지형 그룹을 재질로 묶는다 — 칸 → 재질 열쇠, 재질 열쇠 → 이름. */
function groundMaterials(ts: TilesetDef): { byTile: Map<number, string>; names: Map<string, string> } {
  const byTile = new Map<number, string>(); const names = new Map<string, string>();
  for (const g of ts.tileGroups ?? []) {
    if (g.role !== "terrain" && g.role !== "path" && g.role !== "floor") continue;
    const name = g.name ?? g.id;
    if (EDGE.test(name)) continue;
    const walk = (g.tileIds ?? []).filter((t) => ts.passability[t]?.up && ts.priority[t] !== "upper");
    if (!walk.length) continue;
    let key = g.id.split(":").pop()!.toLowerCase().replace(/^[a-z]{2}-/u, "").replace(/^(at|wang)-/u, "");
    for (let i = 0; i < 3; i += 1) key = key.replace(/-(b|c|d|[a-d]\d?|\d+|alt|ph)$/u, "").replace(/-(n|s|e|w|ns|we|nw|ne|sw|se|nse|nsw|nwe|swe|nswe|h|v|i[ns][ew])$/u, "");
    const label = name.replace(/\([^)]*\)/gu, "").replace(/^모서리 왕 타일 · /u, "").split(/[.:]/u)[0]!.trim().slice(0, 24);
    if (!names.has(key) || (label.length < names.get(key)!.length && !/^[a-z]+$/u.test(label))) names.set(key, label);
    for (const t of walk) if (!byTile.has(t)) byTile.set(t, key);
  }
  return { byTile, names };
}
function kitStats(ts: TilesetDef) {
  const kits = (ts.structureKits ?? []) as StructureKitDef[];
  const byId = new Map(kits.map((k) => [k.id, k]));
  const byRole: Record<string, number> = {}; const byKind = new Map<string, { category: string; kits: string[]; sizes: Set<string> }>(); const byCategory: Record<string, number> = {};
  const kindById = new Map<string, string>();
  for (const k of kits) {
    byRole[k.ai?.role ?? "-"] = (byRole[k.ai?.role ?? "-"] ?? 0) + 1;
    const { kind, category } = kindOf(k, byId);
    const row = byKind.get(kind) ?? { category, kits: [], sizes: new Set<string>() }; row.kits.push(k.id); row.sizes.add(`${k.width}×${k.height}`); byKind.set(kind, row);
    byCategory[category] = (byCategory[category] ?? 0) + 1; kindById.set(k.id, kind);
  }
  const ground = groundMaterials(ts);
  return { kits, byRole, byKind, byCategory, ground, kindById, variants: kits.filter((k) => k.ai?.variantOf).length };
}
/** 맵에서 키트 칸 배열이 통째로 맞는 자리 수. */
function countKit(map: GameMap, kit: StructureKitDef): number {
  const W = map.width, H = map.height; let first: { dx: number; dy: number; tile: number; upper: boolean } | undefined;
  kit.rows.forEach((row, dy) => { for (let dx = 0; dx < kit.width && !first; dx++) { const up = row.upperTiles?.[dx] ?? -1, lo = row.tiles[dx] ?? -1; if (up >= 0) first = { dx, dy, tile: up, upper: true }; else if (lo >= 0) first = { dx, dy, tile: lo, upper: false }; } });
  if (!first) return 0;
  const over = map.upperOverlayTiles ?? []; let n = 0;
  const layer = first.upper ? map.upperTiles : map.lowerTiles;
  for (let i = 0; i < layer.length; i++) {
    if (layer[i] !== first.tile && !(first.upper && over[i] === first.tile)) continue;
    const ox = (i % W) - first.dx, oy = Math.floor(i / W) - first.dy;
    if (ox < 0 || oy < 0 || ox + kit.width > W || oy + kit.height > H) continue;
    let ok = true;
    for (let dy = 0; dy < kit.height && ok; dy++) for (let dx = 0; dx < kit.width && ok; dx++) {
      const j = (oy + dy) * W + ox + dx, up = kit.rows[dy]!.upperTiles?.[dx] ?? -1, lo = kit.rows[dy]!.tiles[dx] ?? -1;
      if (up >= 0 && map.upperTiles[j] !== up && over[j] !== up) ok = false;
      if (lo >= 0 && map.lowerTiles[j] !== lo) ok = false;
    }
    if (ok) n++;
  }
  return n;
}
const jaccard = (a: Set<string>, b: Set<string>) => { let both = 0; for (const x of a) if (b.has(x)) both++; const all = a.size + b.size - both; return all ? both / all : 1; };

// ── 저장된 게임(있으면): 칩셋마다 게임·맵과 놓인 키트 ──
type SavedMap = { game: string; map: GameMap };
const saved = new Map<string, SavedMap[]>();
const savesFile = opt("--saves");
let savedGames = 0;
if (savesFile) for (const dir of fs.readFileSync(savesFile, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)) {
  const at = fs.existsSync(path.join(dir, "project.sqlite")) ? dir : fs.existsSync(path.join(dir, "project", "project.sqlite")) ? path.join(dir, "project") : "";
  if (!at) continue;
  let project: Project;
  try { project = readProjectSqlite(at) as Project; } catch { continue; }
  savedGames += 1;
  for (const map of Object.values(project.maps)) {
    // 빈 시작 맵은 세지 않는다(위층 칸도 이벤트도 없다).
    if (!map.events.length && !map.upperTiles.some((t) => t >= 0)) continue;
    const list = saved.get(map.tilesetId) ?? []; list.push({ game: dir, map }); saved.set(map.tilesetId, list);
  }
}
// ── 명세 은행(있으면): 칩셋마다 명세·맵 ──
const bank: Record<string, { specs: number; maps: number }> = {};
let bankSpecs = 0;
const bankDir = opt("--bank");
if (bankDir) for (const f of fs.readdirSync(bankDir).filter((n) => n.endsWith(".json"))) {
  const spec = JSON.parse(fs.readFileSync(path.join(bankDir, f), "utf8")) as { reference?: { afterTurn?: Record<string, { maps?: { tileset?: string }[] }> } };
  const turns = Object.entries(spec.reference?.afterTurn ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const last = turns[turns.length - 1]?.[1];
  if (!last) continue;
  bankSpecs += 1;
  const seen = new Set<string>();
  for (const m of last.maps ?? []) { if (!m.tileset) continue; const row = (bank[m.tileset] ??= { specs: 0, maps: 0 }); row.maps += 1; if (!seen.has(m.tileset)) { seen.add(m.tileset); row.specs += 1; } }
}

const out: Record<string, unknown> = {};
const ref = kitStats(blank.tilesets[conf.reference]!);
const refKinds = Object.fromEntries([...ref.byKind].map(([k, v]) => [k, { category: v.category, pictures: v.kits.length, sizes: v.sizes.size }]));
out[conf.reference] = { name: blank.tilesets[conf.reference]!.name, kits: ref.kits.length, variants: ref.variants, byRole: ref.byRole, byCategory: ref.byCategory, ground: ref.ground.names.size, kinds: refKinds, saved: { games: new Set((saved.get(conf.reference) ?? []).map((s) => s.game)).size, maps: (saved.get(conf.reference) ?? []).length }, bank: bank[conf.reference] ?? { specs: 0, maps: 0 } };
for (const [id, world] of Object.entries(conf.worlds)) {
  if (ONLY.size && !ONLY.has(id)) continue;
  const ts = blank.tilesets[id]!; const st = kitStats(ts);
  const placed = new Map<string, { count: number; maps: number }>(); const groundOut = new Map<string, number>(), groundIn = new Map<string, number>(); const scenes: Record<string, unknown>[] = [];
  let composed = 0;
  for (const [toolName, key] of world.tools) {
    const tool = getTool(toolName) as { parameters?: { properties?: Record<string, { enum?: string[] }> } } | undefined;
    for (const style of tool?.parameters?.properties?.[key]?.enum ?? []) {
      const room = world.rooms.includes(style) || toolName.endsWith("_room");
      let size: [number, number] | undefined; const perSeed: (number | null)[] = []; const sets: Set<string>[] = []; let error = "";
      for (let seed = 1; seed <= SEEDS; seed++) {
        let map: GameMap | undefined;
        for (const [w, h] of size ? [size] : room ? ROOM_SIZES : OUT_SIZES) {
          const ctx = { project: structuredClone(blank), currentMapId: "m", assistantRun: true, lookKey: JSON.stringify(["project", `world-kits-game-${seed}`]) };
          if (!runTool(ctx, "create_map", { id: "m", name: "재고", width: w, height: h, tilesetId: id }).ok) continue;
          const r = runTool(ctx, toolName, { mapId: "m", [key]: style, seed }) as { ok: boolean; error?: string };
          if (!r.ok) { error = `${w}×${h}: ${String(r.error ?? "").replace(/^'[^']*' 실행 실패: /u, "").slice(0, 120)}`; continue; }
          map = ctx.project.maps.m!; size = [w, h]; break;
        }
        if (!map) { perSeed.push(null); continue; }
        composed++;
        const here = new Set<string>();
        for (const kit of st.kits) { const n = countKit(map, kit); if (!n) continue; const row = placed.get(kit.id) ?? { count: 0, maps: 0 }; row.count += n; row.maps += 1; placed.set(kit.id, row); here.add(kit.id); }
        const seen = new Set<string>();
        for (const t of map.lowerTiles) { const m = st.ground.byTile.get(t); if (m) seen.add(m); }
        for (const m of seen) (room ? groundIn : groundOut).set(m, ((room ? groundIn : groundOut).get(m) ?? 0) + 1);
        perSeed.push(here.size); sets.push(here);
      }
      let pairs = 0, sum = 0;
      for (let a = 0; a < sets.length; a++) for (let b = a + 1; b < sets.length; b++) { pairs++; sum += jaccard(sets[a]!, sets[b]!); }
      const union = new Set(sets.flatMap((s) => [...s]));
      scenes.push({ tool: toolName, style, room, size: size ? `${size[0]}×${size[1]}` : "", kitsPlacedPerSeed: perSeed, kitsAcrossSeeds: union.size, sameKits: pairs ? Math.round((sum / pairs) * 100) : null, ...(perSeed.includes(null) ? { error } : {}) });
    }
  }
  // 저장된 게임에 놓인 키트
  const savedHere = saved.get(id) ?? []; const savedPlaced = new Map<string, { count: number; games: Set<string> }>();
  for (const s of savedHere) for (const kit of st.kits) { const n = countKit(s.map, kit); if (!n) continue; const row = savedPlaced.get(kit.id) ?? { count: 0, games: new Set<string>() }; row.count += n; row.games.add(s.game); savedPlaced.set(kit.id, row); }
  const savedGamesHere = new Set(savedHere.map((s) => s.game)).size;
  // 종류마다: 그림 장수 · 놓인 그림 장수 · 놓인 횟수(구성기) · 저장본에 놓인 횟수·게임 수
  const kindRows = [...st.byKind].map(([kind, v]) => {
    const used = v.kits.filter((k) => placed.has(k)); const inSaves = v.kits.filter((k) => savedPlaced.has(k));
    return {
      kind, label: KIND_LABEL[kind] ?? kind, category: v.category, pictures: v.kits.length, sizes: [...v.sizes], picturesPlaced: used.length,
      placements: used.reduce((n, k) => n + placed.get(k)!.count, 0), maps: Math.max(0, ...used.map((k) => placed.get(k)!.maps)),
      savedPlacements: inSaves.reduce((n, k) => n + savedPlaced.get(k)!.count, 0), savedGames: new Set(inSaves.flatMap((k) => [...savedPlaced.get(k)!.games])).size, beodeul: refKinds[kind]?.pictures ?? 0, kits: v.kits,
    };
  }).sort((a, b) => b.placements - a.placements || a.kind.localeCompare(b.kind));
  const missingKinds = [...ref.byKind].filter(([kind, v]) => KIND_LABEL[kind] && !st.byKind.has(kind) && v.category !== "building").map(([kind, v]) => ({ kind, label: KIND_LABEL[kind], category: v.category, beodeul: v.kits.length }));
  // 낱말 표에는 있는데 버들항에도 이 칩셋에도 없는 종류는 «둘 다 없음» — 이야기 기물만 따로 적는다.
  const storyMissing = conf.kinds.filter(([kind, category]) => category === "story" && !st.byKind.has(kind)).map(([kind, , label]) => ({ kind, label }));
  const mapsOf = scenes.filter((s) => (s as { kitsPlacedPerSeed: (number | null)[] }).kitsPlacedPerSeed.some((n) => n !== null)).length;
  out[id] = {
    name: ts.name, kits: st.kits.length, variants: st.variants, byRole: st.byRole, byCategory: st.byCategory,
    ground: st.ground.names.size, groundNames: Object.fromEntries(st.ground.names), groundOutdoor: Object.fromEntries(groundOut), groundRoom: Object.fromEntries(groundIn),
    compositions: composed, styles: mapsOf, scenes, kitsPlacedEver: placed.size, kitsNeverPlaced: st.kits.filter((k) => !placed.has(k.id)).map((k) => k.id),
    kinds: kindRows, onePictureKindsPlaced: kindRows.filter((r) => r.pictures === 1 && r.placements > 0 && r.category !== "shell").map((r) => r.kind), missingKinds, storyMissing,
    saved: { games: savedGamesHere, maps: savedHere.length, kitsPlaced: savedPlaced.size, onlyInSaves: [...savedPlaced.keys()].filter((k) => !placed.has(k)), neverAnywhere: st.kits.filter((k) => !placed.has(k.id) && !savedPlaced.has(k.id)).map((k) => k.id) },
    bank: bank[id] ?? { specs: 0, maps: 0 },
  };
  const o = out[id] as { onePictureKindsPlaced: string[] };
  console.log(`${id}: 키트 ${st.kits.length} · 바닥 재질 ${st.ground.names.size} · 구성 ${composed}장 · 놓인 키트 ${placed.size} · 놓이는데 그림 1장인 종류 ${o.onePictureKindsPlaced.length} · 버들항에만 있는 종류 ${missingKinds.length} · 저장 게임 ${savedGamesHere}편 맵 ${savedHere.length} · 은행 명세 ${bank[id]?.specs ?? 0}`);
}
fs.writeFileSync(outFile, JSON.stringify({ seeds: SEEDS, reference: conf.reference, categories: { ...conf.categories, shell: "벽면·바닥 조각" }, kindLabels: KIND_LABEL, savedGames, bankSpecs, worlds: out }, null, 1));
