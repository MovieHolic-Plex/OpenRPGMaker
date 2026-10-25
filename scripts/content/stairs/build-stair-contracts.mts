// 계단 입구 계약 굽기 — src/assets/stairContracts.json (번들 소유, 계약 형태는 src/project/stairs/contract.ts).
//
//   1) 번들 타일셋(src/assets/*Tileset.json)에서 계단·사다리·에스컬레이터·바닥 구멍 키트를 고른다(INCLUDE/EXCLUDE).
//   2) 키트 칸 통행(1층이 비면 걷는 바닥을 가정) + 이름표 낱말로 계약을 유도한다(source: derived).
//   3) tiledata/stairs/overrides.json — 4배 확대 그림을 보고 사람이 확인·고친 값(source: checked)으로 덮는다.
//   4) 손 도트 실내 사양(조립기) 물건을 같은 그림의 키트와 칸 번호로 맞춰 objects 표(키트 id + lift)를 만든다.
//
// 실행: npx --no-install tsx scripts/content/stairs/build-stair-contracts.mts [--dump /tmp/stair/derived.json]
// 그림은 다시 그리지 않는다 — 계약은 그림을 읽는 메타데이터다.
import fs from "node:fs";
import path from "node:path";

type Rel = [number, number];
type Side = "N" | "S" | "E" | "W" | "any";
interface Contract {
  leads: "up" | "down" | "same"; w: number; h: number; trigger: Rel[]; approach: Rel[]; side: Side; passable: Rel[];
  mode: "walk" | "bump"; exit?: Rel[]; source: "derived" | "checked"; note: string;
}
interface Pass { up: boolean; down: boolean; left: boolean; right: boolean }
interface Tileset {
  id: string; passability: Pass[]; priority: string[]; tileMeta?: unknown;
  structureKits?: { id: string; name?: string; width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[]; ai?: { description?: string; placementRules?: string } }[];
}

const ROOT = process.cwd();
const ASSETS = path.join(ROOT, "src/assets");
const OVERRIDES = path.join(ROOT, "tiledata/stairs/overrides.json");
const OUT = path.join(ASSETS, "stairContracts.json");

const INCLUDE = /stair|계단|ladder|사다리|escalat|에스컬|hatch|ramp-(?:up|down)|stairwell|trapdoor|뚜껑문|star seal open|subway-entrance|underpass|crypt/iu;
// 계단 그림이 아니거나(가구·건물·무늬), 층·단을 잇지 않는 장식(벽에 기댄 사다리·관중석·늑목)은 뺀다.
const EXCLUDE = /vase|bell rope|bunk|tier |observing|dome|bleachers|lecture|kiosk|egg|flower|fire-truck|bath|water-tank|cooling|water-tower|-bed|buttress|owl-wall|door|roof-deck|watchtower|serving-hatch|unte|manhole$|pave-manhole|gnd-manhole|street-manhole|library ladder|lib-ladder|stock-ladder|wall-bars|granary|pod-car|airlock|hab-module|hut|cabin|longhouse|manor|garden|house|log|roof-h|block-|jetty|bridge|coop|thatch|stall|chaya|ziggurat|mausoleum|gallery|fire-escape|coin-parking|mansion|kominka|rooftop-dish|ml-step|stair-hut|deck-plate|sf-bunk|fire-cabinet|desert-oasis|elevator|bd-castle|ph-|sn-|stair-transition|ramp-arrow|sf-hatch-floor/iu;
const TRAPDOOR_OK = /trapdoor/iu;

const DOWN = /내려가|내려오|아래로|아래층|하강|하행|\bdown\b|-down|구멍|hatch|trapdoor|뚜껑문|지하|crypt|underpass|star seal open|▼/iu;
const UP = /올라가|오르|오름|위로|위층|상행|\bup\b|-up|▲|loft/iu;

function blocked(p: Pass | undefined): boolean { return !p || !(p.up || p.down || p.left || p.right); }

/** 칸 통행: 1층이 비면 걷는 바닥 위에 찍는다고 본다. 위층부터 ★(priority upper 이고 막히지 않음)는 건너뛴다. */
function cellPassable(ts: Tileset, lower: number, upper: number): boolean | null {
  if (lower < 0 && upper < 0) return null;
  const deciding = (t: number) => {
    if (t < 0 || t >= ts.passability.length) return null;
    const p = ts.passability[t];
    if (!blocked(p) && ts.priority[t] === "upper") return null; // ★
    return p ?? null;
  };
  const d = deciding(upper) ?? (lower >= 0 ? ts.passability[lower] ?? null : { up: true, down: true, left: true, right: true });
  return !blocked(d ?? undefined);
}

function kitText(k: NonNullable<Tileset["structureKits"]>[number]): string {
  return `${k.id} ${k.name ?? ""} ${k.ai?.description ?? ""} ${k.ai?.placementRules ?? ""}`;
}

function derive(ts: Tileset, k: NonNullable<Tileset["structureKits"]>[number]): Contract {
  const w = k.width, h = k.height;
  const grid: (boolean | null)[][] = k.rows.map((r) => r.tiles.map((t, x) => cellPassable(ts, t, r.upperTiles?.[x] ?? -1)));
  const passable: Rel[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y]?.[x] === true) passable.push([x, y]);
  const text = kitText(k);
  const name = `${k.id} ${k.name ?? ""}`;
  const leads: Contract["leads"] = DOWN.test(name) ? "down" : UP.test(name) ? "up" : DOWN.test(text) && !UP.test(text) ? "down" : UP.test(text) ? "up" : "same";
  // 1×1 바닥 구멍(해치·뚜껑문·한 칸 내려가는 계단)은 옆 아무 바닥에서나 들어선다.
  if (w === 1 && h === 1 && grid[0]![0] === true) {
    return { leads, w, h, trigger: [[0, 0]], approach: [[0, 1], [-1, 0], [1, 0], [0, -1]], side: "any", passable, mode: "walk", source: "derived", note: "" };
  }
  // 기본: 3/4 시점의 계단은 카메라(남쪽)를 보고 남쪽에서 들어선다. 맨 아래 줄부터 위로 올라가며 밟는 칸 줄을 찾는다.
  const bottom = h - 1;
  const bottomPass = Array.from({ length: w }, (_, x) => x).filter((x) => grid[bottom]?.[x] === true);
  if (bottomPass.length) {
    const exit: Rel[] = [];
    if (leads === "same") {
      // 위 끝: 맨 위 밟는 줄의 열들, 그 한 칸 위.
      for (let y = 0; y < h; y++) {
        const cols = Array.from({ length: w }, (_, x) => x).filter((x) => grid[y]?.[x] === true);
        if (cols.length) { for (const x of cols) exit.push([x, y - 1]); break; }
      }
    }
    return {
      leads, w, h, trigger: leads === "same" ? [] : bottomPass.map((x) => [x, bottom] as Rel), approach: bottomPass.map((x) => [x, h] as Rel),
      side: "S", passable, mode: "walk", ...(exit.length ? { exit } : {}), source: "derived", note: "",
    };
  }
  // 맨 아래 줄이 막힌 그림: 그림이 있는 칸에 부딪혀 탄다.
  const art = Array.from({ length: w }, (_, x) => x).filter((x) => (k.rows[bottom]?.tiles[x] ?? -1) >= 0 || (k.rows[bottom]?.upperTiles?.[x] ?? -1) >= 0);
  return { leads, w, h, trigger: art.map((x) => [x, bottom] as Rel), approach: art.map((x) => [x, h] as Rel), side: "S", passable, mode: "bump", source: "derived", note: "" };
}

const SIDE_KO: Record<Side, string> = { N: "북쪽", S: "남쪽", E: "동쪽", W: "서쪽", any: "어느 쪽이든(옆 바닥)" };
const FACING: Record<Exclude<Side, "any">, string> = { N: "북(up)", S: "남(down)", E: "동(right)", W: "서(left)" };
function note(c: Contract): string {
  const cells = (l: Rel[]) => l.map(([x, y]) => `(${x},${y})`).join(" ");
  const lead = c.leads === "up" ? "올라가는 계단 — 위층으로 오른다" : c.leads === "down" ? "내려가는 계단 — 아래층으로 내려간다" : "올라가는 계단 — 같은 맵 안의 단(층 이동 없음)";
  const OPP: Record<Exclude<Side, "any">, Exclude<Side, "any">> = { N: "S", S: "N", E: "W", W: "E" };
  const verb = c.leads === "down" ? "내려갈" : "오를";
  const facing = c.side === "any" ? `${verb} 때 앞 칸에서 계단 쪽을 본다` : `${verb} 때 ${FACING[OPP[c.side]]}을 보고 들어선다`;
  const arrive = c.leads === "same" ? (c.exit?.length ? "도착: 위 끝 바닥(아래 좌표)" : "도착: 단 위") : "도착: 이동 이벤트가 정한 " + (c.leads === "up" ? "위층" : "아래층") + " 칸";
  const how = c.leads === "same" ? "걸어서 올라선다" : c.mode === "walk" ? "이동 이벤트는 이동 칸(계단 그림 칸)에" : "이동 칸이 막힌 그림이라 이벤트를 이동 칸에 priority same 으로 두고 앞 칸에서 부딪힌다";
  return `${lead}. 들어서는 쪽 ${SIDE_KO[c.side]}: 앞 칸 ${cells(c.approach)} 은 비운 바닥이어야 한다. ${facing}. ${arrive}. `
    + (c.trigger.length ? `이동 칸 ${cells(c.trigger)} — ${how}. ` : `${how}. `)
    + (c.exit?.length ? `위 끝 ${cells(c.exit)} 이 이어지는 바닥. ` : "")
    + (c.leads === "same" ? "" : `다른 층에서 도착하면 앞 칸에 내려 계단을 등지고 ${c.side === "any" ? "앞 칸 쪽" : FACING[c.side]}을 본다. `)
    + "좌표는 키트 왼쪽 위 기준.";
}

// 몬스터 수집 칩셋(oprn-monster·Emerald 재채색)은 JSON 이 아니라 코드가 만든다 — 같은 키트 배치를 쓰므로 같이 굽는다.
const { MONSTER_KIT_CHIPSET_ASSETS } = await import("../../../src/assets/monsterKitAssets");
const { createMonsterKitTileset } = await import("../../../src/project/defaults/monsterKit");
const emeraldIndex = JSON.parse(fs.readFileSync(path.join(ASSETS, "emeraldMonsterKitIndex.json"), "utf8")) as { id: string; sourceTextureKey: string }[];
const codeTilesets: Tileset[] = [];
for (const a of MONSTER_KIT_CHIPSET_ASSETS) {
  const base = createMonsterKitTileset(a.textureKey) as unknown as Tileset;
  codeTilesets.push(base);
  for (const e of emeraldIndex.filter((x) => x.sourceTextureKey === a.textureKey)) codeTilesets.push({ ...base, id: e.id });
}
const sourceOf = new Map(emeraldIndex.map((e) => [e.id, `monster_${e.sourceTextureKey.replace(/^tex_monster_/u, "")}`]));

const overrides: Record<string, Record<string, Partial<Contract> & { drop?: boolean }>> = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, "utf8")) : {};
const kitsOut: Record<string, Record<string, Contract>> = {};
const tilesets = new Map<string, Tileset>();
const allTilesets = [
  ...fs.readdirSync(ASSETS).filter((f) => /Tileset\.json$/u.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(ASSETS, f), "utf8")) as Tileset),
  ...codeTilesets,
];
for (const ts of allTilesets) {
  tilesets.set(ts.id, ts);
  for (const k of ts.structureKits ?? []) {
    const label = `${k.id} ${k.name ?? ""}`;
    const ov = overrides[ts.id]?.[k.id] ?? overrides[sourceOf.get(ts.id) ?? ""]?.[k.id];
    const picked = ov ? !ov.drop : INCLUDE.test(label) && (!EXCLUDE.test(label) || TRAPDOOR_OK.test(label));
    if (!picked) continue;
    const base = derive(ts, k);
    const { why, drop: _drop, ...fields } = (ov ?? {}) as Partial<Contract> & { why?: string; drop?: boolean };
    const merged: Contract = { ...base, ...fields, source: ov ? "checked" : "derived" } as Contract;
    if (merged.leads === "same") {
      // 같은 맵 안의 단: 이동 칸 없음. 위 끝 = 앞 칸 열마다 맨 위 밟는 칸의 한 칸 위.
      merged.trigger = [];
      if (!fields.exit) {
        const pass = new Set(merged.passable.map(([x, y]) => `${x},${y}`));
        const exit: Rel[] = [];
        for (const [ax] of merged.approach) {
          let top = -1;
          for (let y = 0; y < merged.h; y++) if (pass.has(`${ax},${y}`)) { top = y; break; }
          if (top >= 0) exit.push([ax, top - 1]);
        }
        merged.exit = exit;
      }
    } else delete merged.exit;
    merged.note = note(merged) + (why ? ` (확인: ${why})` : "");
    (kitsOut[ts.id] ??= {})[k.id] = merged;
  }
}
for (const [tsId, m] of Object.entries(overrides)) for (const id of Object.keys(m)) if (!m[id]!.drop && !kitsOut[tsId]?.[id]) console.warn(`[stairs] override ${tsId}/${id} — 키트가 없다`);

// 조립기 사양 물건 → 키트(같은 그림 칸).
const SPECS: Record<string, string> = {
  atlas_biome_interior: "handInteriorSpec.json", jp_city: "jpInteriorSpec.json", modern_city: "modernCityRoomSpec.json",
  modern_campus: "modernCampusRoomSpec.json", sengoku_edo: "sengokuEdoRoomSpec.json",
};
const objectsOut: Record<string, Record<string, { kit: string; lift: number }>> = {};
for (const [tsId, file] of Object.entries(SPECS)) {
  const spec = JSON.parse(fs.readFileSync(path.join(ASSETS, file), "utf8")) as { objects?: Record<string, { w: number; h: number; up: number; kind: string; use?: string[]; cells: [number, number, number, number][] }> };
  const ts = tilesets.get(tsId);
  const kits = Object.keys(kitsOut[tsId] ?? {}).map((id) => ts!.structureKits!.find((k) => k.id === id)!);
  for (const [oid, o] of Object.entries(spec.objects ?? {})) {
    if (o.kind === "door" || o.kind === "sidedoor") continue;
    const tiles = o.cells.map((c) => c[2]);
    if (!tiles.length) continue;
    const kit = kits.find((k) => { const all = new Set(k.rows.flatMap((r) => [...r.tiles, ...(r.upperTiles ?? [])])); return tiles.every((t) => all.has(t)); });
    if (!kit) continue;
    // 사양 원점 = 키트 원점에서 lift 줄 아래. 벽면에 딱 맞춰 박는 탈것(h1, 벽면 두 줄 높이)은 조립기가 그림을 한 줄 올리고 원점 칸을 비운다.
    const flush = o.kind === "wall" && !!o.use?.includes("travel") && o.h === 1 && Math.ceil(o.up / 16) + o.h <= 2;
    const minDy = Math.min(...o.cells.map((c) => c[1]));
    const lift = -minDy + (flush ? 1 : 0);
    (objectsOut[tsId] ??= {})[oid] = { kit: kit.id, lift };
  }
}

const data = { version: 1, kits: kitsOut, objects: objectsOut };
/** 좌표 쌍 배열은 한 줄로(사람이 diff 를 읽게). */
function compact(v: unknown): string {
  return JSON.stringify(v, null, 1).replace(/\[\s*(-?\d+),\s*(-?\d+)\s*\]/gu, "[$1,$2]").replace(/\[\s*((?:\[-?\d+,-?\d+\],?\s*)+)\]/gu, (_m, inner: string) => `[${inner.replace(/\s+/gu, "")}]`) + "\n";
}
fs.writeFileSync(OUT, compact(data));
const dumpAt = process.argv.indexOf("--dump");
if (dumpAt > 0) {
  const dump = Object.entries(kitsOut).flatMap(([tsId, m]) => Object.entries(m).map(([id, c]) => {
    const k = tilesets.get(tsId)!.structureKits!.find((x) => x.id === id)!;
    return { tileset: tsId, id, name: k.name, rows: k.rows, contract: c };
  }));
  fs.writeFileSync(process.argv[dumpAt + 1]!, JSON.stringify(dump));
}
const n = Object.values(kitsOut).reduce((a, m) => a + Object.keys(m).length, 0);
const checked = Object.values(kitsOut).reduce((a, m) => a + Object.values(m).filter((c) => c.source === "checked").length, 0);
const objs = Object.values(objectsOut).reduce((a, m) => a + Object.keys(m).length, 0);
console.log(`[stairs] 키트 ${n}개(확인 ${checked}) · 사양 물건 ${objs}개 → ${path.relative(ROOT, OUT)}`);
