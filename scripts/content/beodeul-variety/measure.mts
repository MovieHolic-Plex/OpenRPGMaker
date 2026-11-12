// 버들항 기물 «닮음» 재기(모델 없음) — 저장된 게임·명세 은행 결과의 버들항 맵에서 어떤 기물 킷이 몇 번, 몇 게임에 놓였는지 센다.
//
//   bun scripts/content/beodeul-variety/measure.mts --out <결과.json> <판 폴더 | project 폴더 | project.json | 그것들을 품은 폴더>...
//
// 왜(오너 2026-11-12): «모든 게임을 비슷하게 생성하니 동일 카테고리의 오브젝트들을 다양하게 생성하는 게 좀 필요할듯. 버들항부터 해봐».
// 방법: 맵의 칸 그림(네 층 + 겹침 스택)에서 킷의 칸 행렬을 찾는다(큰 킷 먼저, 한 칸은 한 킷에만). structurePlacements 는 스탬프 도구가 남긴 것만
//       있어 구성기가 직접 깐 소품을 놓치므로 쓰지 않는다. 종류(category)는 낱말 목록이 아니라 킷 이름의 끝 낱말 — 이름 찾기(existingMatches)가
//       «끝 낱말» 로 묶는 것과 같은 묶음이다. 같은 종류의 그림 수는 지금 번들 버들항 타일셋의 role=prop 킷에서 센다.
// 지표: 종류마다 top-1 몫(가장 많이 놓인 그림이 그 종류 놓임에서 차지하는 몫) · 쓴 그림 수/있는 그림 수 · 놓인 게임 수.
//       «게임 사이 닮음» = 그 종류를 놓은 게임 가운데 가장 흔한 그림 한 장을 쓴 게임의 몫(게임마다 한 표).
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../read-project-sqlite.mts";
import { bundledTilesetById } from "../../../src/project/defaults/defaultAssets.ts";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const outAt = argv.indexOf("--out");
const outFile = outAt >= 0 ? argv[outAt + 1]! : "";
const inputs = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--out");
if (!inputs.length) throw new Error("measure.mts --out <json> <폴더…>");

type Source = { id: string; load: () => Project };
function sources(input: string, depth = 3): Source[] {
  const p = path.resolve(input);
  if (!fs.existsSync(p)) return [];
  if (p.endsWith(".json")) return [{ id: path.basename(path.dirname(p)), load: () => JSON.parse(fs.readFileSync(p, "utf8")) as Project }];
  if (fs.existsSync(path.join(p, "project.sqlite"))) return [{ id: path.basename(p) === "project" ? path.basename(path.dirname(p)) : path.basename(p), load: () => readProjectSqlite(p) }];
  if (fs.existsSync(path.join(p, "project.json"))) return sources(path.join(p, "project.json"));
  // 판 폴더(<판>/project/project.sqlite) — 그 판의 끝 저장본 하나만(옆의 snapshots·session·judge 사본은 같은 게임의 중간 판이다).
  if (fs.existsSync(path.join(p, "project", "project.sqlite"))) return sources(path.join(p, "project"));
  if (depth === 0 || !fs.statSync(p).isDirectory()) return [];
  return fs.readdirSync(p).sort().flatMap((n) => (n.startsWith(".") || n === "assets" || n === "maps" ? [] : sources(path.join(p, n), depth - 1)));
}

/** 킷 이름 → 종류(끝 낱말). «버들항 소품 노점: 치즈·고기 2×4» → 노점 · «버들항 광산 골짜기 마을 · 통 1×1» → 통. */
export function categoryOf(kit: StructureKitDef): string {
  let name = (kit.name ?? kit.id).replace(/\s*\d+×\d+.*$/u, "").replace(/\([^)]*\)/gu, "").trim();
  if (name.includes(" · ")) name = name.split(" · ").pop()!;
  name = name.replace(/^버들항\s+(소품|기물)\s+/u, "").replace(/^(버들항|외곽|왕도)\s+/u, "");
  name = name.split(":")[0]!.split("·")[0]!.trim();
  const words = name.split(/\s+/u).filter((w) => !/^[A-Z]$|^\d+$/u.test(w));
  return words[words.length - 1] ?? name;
}

/** 묶음 — 나무·밟는 풀꽃(칸 이름표의 꼬리표 tree·decal, 자연물 킷 bd-org) / 던전 기물(킷 태그) / 마을·들 기물. 낱말 목록이 아니라 굽기가 단 꼬리표다. */
export function scopeOf(kit: StructureKitDef, tileset: TilesetDef): "scatter" | "dungeon" | "object" {
  const tags = kit.ai?.tags ?? [];
  const first = kit.rows.flatMap((row) => row.upperTiles ?? []).find((tile) => tile >= 0);
  const tileTags = first === undefined ? [] : tileset.tileMeta?.[first]?.tags ?? [];
  if (tags.includes("tree") || tileTags.includes("tree") || tileTags.includes("decal") || kit.id.startsWith("bd-org-")) return "scatter";
  if (tags.includes("던전") && !tags.includes("마을") && !tags.includes("필드")) return "dungeon";
  return "object";
}

type KitCells = { kit: StructureKitDef; cells: { dx: number; dy: number; tile: number }[] };
function kitCells(tileset: TilesetDef): KitCells[] {
  const out: KitCells[] = [];
  for (const kit of tileset.structureKits ?? []) {
    if (kit.ai?.role !== "prop") continue;
    const cells: KitCells["cells"] = [];
    kit.rows.forEach((row, dy) => {
      for (const layer of [row.tiles, row.upperTiles]) (layer ?? []).forEach((tile, dx) => { if (typeof tile === "number" && tile >= 0) cells.push({ dx, dy, tile }); });
    });
    if (cells.length) out.push({ kit, cells });
  }
  // 큰 킷 먼저 — 작은 킷이 큰 킷의 일부 칸을 가로채지 않게.
  return out.sort((a, b) => b.cells.length - a.cells.length || a.kit.id.localeCompare(b.kit.id));
}

const LAYERS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;
const STACKS = ["lowerTileStacks", "upperTileStacks"] as const;
function cellTiles(map: GameMap): Set<number>[] {
  const n = map.width * map.height;
  const cells = Array.from({ length: n }, () => new Set<number>());
  const m = map as unknown as Record<string, unknown>;
  for (const key of LAYERS) { const layer = m[key]; if (Array.isArray(layer)) layer.forEach((t, i) => { if (typeof t === "number" && t >= 0 && i < n) cells[i]!.add(t); }); }
  for (const key of STACKS) {
    const stacks = m[key] as Record<string, number[]> | undefined;
    if (!stacks) continue;
    for (const [cell, tiles] of Object.entries(stacks)) {
      const at = cell.includes(",") ? (() => { const [x, y] = cell.split(",").map(Number); return y! * map.width + x!; })() : Number(cell);
      if (at >= 0 && at < n) for (const t of tiles ?? []) if (typeof t === "number" && t >= 0) cells[at]!.add(t);
    }
  }
  return cells;
}

export type Placement = { kit: string; x: number; y: number };
export function placementsOf(map: GameMap, kits: readonly KitCells[]): { placed: Placement[]; propCells: number; coveredPropCells: number } {
  const cells = cellTiles(map);
  const where = new Map<number, number[]>();
  cells.forEach((set, i) => { for (const t of set) { const a = where.get(t); if (a) a.push(i); else where.set(t, [i]); } });
  const claimed = new Set<string>();
  const placed: Placement[] = [];
  for (const { kit, cells: kc } of kits) {
    const anchor = kc[0]!;
    for (const at of where.get(anchor.tile) ?? []) {
      const x = (at % map.width) - anchor.dx, y = Math.floor(at / map.width) - anchor.dy;
      if (x < 0 || y < 0 || x + kit.width > map.width || y + kit.height > map.height) continue;
      if (!kc.every((c) => cells[(y + c.dy) * map.width + x + c.dx]!.has(c.tile) && !claimed.has(`${x + c.dx},${y + c.dy},${c.tile}`))) continue;
      for (const c of kc) claimed.add(`${x + c.dx},${y + c.dy},${c.tile}`);
      placed.push({ kit: kit.id, x, y });
    }
  }
  return { placed, propCells: 0, coveredPropCells: claimed.size };
}

const bundle = bundledTilesetById("beodeul_city") as TilesetDef | undefined;
if (!bundle) throw new Error("번들 beodeul_city 가 없다");
const bundleKits = kitCells(bundle);
// 변형 킷(ai.variantOf)은 원본 킷의 종류로 센다 — 같은 종류의 다른 그림이다.
const kitById = new Map(bundleKits.map((k) => [k.kit.id, k.kit]));
const familyKit = (kit: StructureKitDef): StructureKitDef => (kit.ai?.variantOf && kitById.get(kit.ai.variantOf)) || kit;
const catOfKit = new Map(bundleKits.map((k) => [k.kit.id, categoryOf(familyKit(k.kit))]));
const scopeOfCat = new Map<string, string>();
for (const k of bundleKits) { const c = categoryOf(familyKit(k.kit)); const s = scopeOf(familyKit(k.kit), bundle); if (!scopeOfCat.has(c) || s === "object") scopeOfCat.set(c, s); }
const available = new Map<string, string[]>();
for (const [kit, cat] of catOfKit) available.set(cat, [...(available.get(cat) ?? []), kit]);
const propTile = new Set<number>();
(bundle.tileMeta ?? []).forEach((m, i) => { if (m?.tags?.includes("prop")) propTile.add(i); });

type GameRow = { id: string; title: string; maps: { name: string; w: number; h: number; placed: Placement[]; propTagCells: number; propTagCovered: number }[] };
const games: GameRow[] = [];
const seen = new Set<string>();
for (const src of inputs.flatMap((i) => sources(i))) {
  let project: Project;
  try { project = src.load(); } catch (e) { console.error(`${src.id}: 못 연다 — ${String(e).slice(0, 120)}`); continue; }
  const maps = Object.values(project.maps ?? {}).filter((m) => m.tilesetId === "beodeul_city");
  if (!maps.length) continue;
  // 같은 판의 사본(before/…·…-final)은 한 번만 — 맵 칸이 같으면 같은 게임이다.
  const print = maps.map((m) => `${m.width}x${m.height}:${(m.upperTiles ?? []).slice(0, 4000).join(",")}`).join("|");
  const key = print; // 맵 칸 글자열 그대로가 열쇠다(같은 칸이면 같은 게임)
  if (seen.has(key)) { console.error(`${src.id}: 앞 판과 같은 맵 — 건너뜀`); continue; }
  seen.add(key);
  const row: GameRow = { id: src.id, title: project.meta?.title ?? "", maps: [] };
  for (const map of maps) {
    const r = placementsOf(map, bundleKits);
    const cells = cellTiles(map);
    let tagCells = 0;
    for (const set of cells) for (const t of set) if (propTile.has(t)) { tagCells++; break; }
    const covered = new Set(r.placed.flatMap((p) => { const k = bundleKits.find((b) => b.kit.id === p.kit)!; return k.cells.filter((c) => propTile.has(c.tile)).map((c) => `${p.x + c.dx},${p.y + c.dy}`); }));
    row.maps.push({ name: map.name ?? map.id, w: map.width, h: map.height, placed: r.placed, propTagCells: tagCells, propTagCovered: covered.size });
  }
  games.push(row);
  console.error(`${src.id}: 맵 ${row.maps.length} · 놓인 기물 ${row.maps.reduce((n, m) => n + m.placed.length, 0)}`);
}

type CatRow = { category: string; scope: string; available: number; used: number; placements: number; games: number; top: string; topShare: number; gameTop: string; gameTopShare: number; kits: Record<string, { n: number; games: number }> };
type Overall = { placements: number; weightedTop1: number; gameSame: number; categories: number };
function overallOf(rows: readonly CatRow[]): Overall {
  const placements = rows.reduce((n, r) => n + r.placements, 0);
  const multi = rows.filter((r) => r.games >= 2);
  return { placements, categories: rows.length, weightedTop1: rows.reduce((n, r) => n + r.placements * r.topShare, 0) / Math.max(1, placements),
    gameSame: multi.reduce((n, r) => n + r.gameTopShare * r.games, 0) / Math.max(1, multi.reduce((n, r) => n + r.games, 0)) };
}
function table(gs: readonly GameRow[]): { rows: CatRow[]; overall: Overall; byScope: Record<string, Overall> } {
  const byCat = new Map<string, Map<string, { n: number; games: Set<string> }>>();
  for (const g of gs) for (const m of g.maps) for (const p of m.placed) {
    const cat = catOfKit.get(p.kit)!;
    const kits = byCat.get(cat) ?? new Map(); byCat.set(cat, kits);
    const k = kits.get(p.kit) ?? { n: 0, games: new Set<string>() }; kits.set(p.kit, k);
    k.n++; k.games.add(g.id);
  }
  const rows: CatRow[] = [];
  for (const [category, kits] of byCat) {
    const placements = [...kits.values()].reduce((n, k) => n + k.n, 0);
    const gamesWith = new Set([...kits.values()].flatMap((k) => [...k.games]));
    const top = [...kits.entries()].sort((a, b) => b[1].n - a[1].n)[0]!;
    const gameTop = [...kits.entries()].sort((a, b) => b[1].games.size - a[1].games.size)[0]!;
    rows.push({ category, scope: scopeOfCat.get(category) ?? "object", available: available.get(category)?.length ?? 0, used: kits.size, placements, games: gamesWith.size, top: top[0], topShare: top[1].n / placements,
      gameTop: gameTop[0], gameTopShare: gameTop[1].games.size / gamesWith.size, kits: Object.fromEntries([...kits.entries()].sort((a, b) => b[1].n - a[1].n).map(([id, k]) => [id, { n: k.n, games: k.games.size }])) });
  }
  rows.sort((a, b) => b.placements * b.topShare - a.placements * a.topShare);
  return { rows, overall: overallOf(rows), byScope: Object.fromEntries(["object", "dungeon", "scatter"].map((sc) => [sc, overallOf(rows.filter((r) => r.scope === sc))])) };
}

const result = { at: new Date().toISOString(), bundleCount: bundle.count, propKits: bundleKits.length, games, ...table(games), availableByCategory: Object.fromEntries([...available.entries()].map(([c, k]) => [c, k])) };
if (outFile) { fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(result, null, 1)); }
const pct = (v: number) => `${Math.round(v * 100)}%`;
console.log(`게임 ${games.length} · 놓인 기물 ${result.overall.placements} · 종류 ${result.overall.categories} · 놓임 가중 top-1 ${pct(result.overall.weightedTop1)} · 게임 사이 같은 그림 ${pct(result.overall.gameSame)}`);
for (const [sc, o] of Object.entries(result.byScope)) console.log(`  ${sc}: 종류 ${o.categories} · 놓임 ${o.placements} · 가중 top-1 ${pct(o.weightedTop1)} · 게임 사이 같은 그림 ${pct(o.gameSame)}`);
console.log("묶음 | 종류 | 있는 그림 | 쓴 그림 | 놓임 | 게임 | top-1 몫 | 게임 top-1 | 가장 많이 놓인 킷");
for (const r of result.rows) console.log(`${r.scope} | ${r.category} | ${r.available} | ${r.used} | ${r.placements} | ${r.games} | ${pct(r.topShare)} | ${pct(r.gameTopShare)} | ${r.top}`);
