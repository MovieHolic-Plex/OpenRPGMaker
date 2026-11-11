// 끝맺음 마감 단계 × 테마 표(모델 없음): 테마 맵마다(세계 열 벌의 모든 종류 + 마법 학교·일본 도시·한국 거리·조선·버들항 던전 주제)
// 그 단계가 고치려는 상황을 심고 단계의 함수를 돌려 무엇을 했는지 적는다 — ok(맞게 함) · none(아무것도 안 함) · wrong(잘못 함) ·
// gap(그림이 없어 못 했고 v2.art-gap 으로 적음) · eye(했고, 그림을 열어 봐야 판정) · n/a. 한 일이 있는 칸은 앞·뒤 그림을 <outDir>/pic 에 남긴다(1배로 열어 본다).
//   bun scripts/qa/assistant-v2/stageMatrix.mts <outDir> [테마,테마…]
// 버들항 마을·던전은 맵 하나에 1~2분이 걸린다 — 테마를 나눠 여러 프로세스로 돌린다. 문서 openwiki/assistant-v2.md 「끝맺음 단계 × 칩셋 표」.
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { objectClusterAt } from "../../../src/project/objectFootprint.ts";
import { stage as chaserHidingStage } from "../../../src/ai/v2/finish/lanes/stages/chaser-hiding.ts";
import { WORLDS, worldPlaceSpec } from "../../../src/ai/v2/place/world.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { tileLabel } from "../../../src/ai/v2/place/cells.ts";
import { reachableCells, unreachableEvents } from "../../../src/ai/v2/judge/eventReach.ts";
import { dressBareCaveGates } from "../../../src/ai/v2/place/caveGates.ts";
import { dressBareSealSteps, seatEntranceSteps, dressPickupSteps } from "../../../src/ai/v2/story/stepArt.ts";
import { dressInteriorExits, kitOf } from "../../../src/ai/v2/place/exitDress.ts";
import { dropBuriedTransfers, doorFloorTransfers } from "../../../src/ai/v2/place/exitTransfers.ts";
import { clearTargetFronts, repairEventReach } from "../../../src/ai/v2/place/reachRepairs.ts";
import { lockBareHouseDoors } from "../../../src/ai/v2/place/lockedDoors.ts";
import { placementProblems } from "../../../src/ai/v2/place/placementRules.ts";
import { pickTransferSpot } from "../../../src/ai/v2/place/transferSpot.ts";
import { buildingEntrances } from "../../../src/ai/v2/place/entrances.ts";
import { renderMapPng } from "../../qa-game/render.mts";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Src { theme: string; kind: string; indoor: boolean; danger: boolean; project: any; mapId: string; doors: { x: number; y: number; kit?: string }[]; note: string }

function mkRun(project: any, mapId?: string): any {
  const ctx: any = { project, currentMapId: mapId ?? project.startMapId, assistantRun: true };
  const calls: any[] = [];
  return { ctx, calls, call: (tool: string, args: any) => { let r; try { r = runTool(ctx, tool, args); } catch (e) { r = { ok: false, summary: `${tool} threw ${(e as Error).message}` }; } calls.push({ tool, args, ok: r.ok, summary: String(r.summary ?? "").slice(0, 200) }); return r; } };
}

function buildOne(theme: string, kind: string, spec: any, flags: { indoor?: boolean; danger?: boolean }): Src | { theme: string; kind: string; error: string } {
  const project = createBlankProject();
  const run = mkRun(project);
  const builder = builderFor(spec);
  if (!builder) return { theme, kind, error: "no builder" };
  let res: any;
  try { res = builder.build(run, spec); } catch (e) { return { theme, kind, error: `threw ${(e as Error).message.slice(0, 200)}` }; }
  if (!res.ok || !res.mapIds?.length) return { theme, kind, error: String(res.summary).slice(0, 240) };
  const mapId = res.entrance?.mapId ?? res.mapIds[0];
  const p = run.ctx.project;
  const map = p.maps[mapId];
  // 앵커: 시작점이 이 맵이 아니면 들어오는 칸을 시작으로
  if (p.startMapId !== mapId || !isPassable(p, map, p.startPos.x, p.startPos.y)) {
    const e = res.entrance && res.entrance.mapId === mapId ? res.entrance : undefined;
    let spot = e && isPassable(p, map, e.x, e.y) ? { x: e.x, y: e.y } : undefined;
    if (!spot) for (let y = map.height - 1; y >= 0 && !spot; y--) for (let x = 0; x < map.width && !spot; x++) if (isPassable(p, map, x, y)) spot = { x, y };
    run.ctx.project = { ...run.ctx.project, startMapId: mapId, startPos: spot };
  }
  return { theme, kind, indoor: !!flags.indoor, danger: !!flags.danger, project: run.ctx.project, mapId, doors: (res.state?.doors ?? []) as any[], note: String(res.summary).slice(0, 120) };
}

async function* sources(only?: (theme: string, kind: string) => boolean): AsyncGenerator<Src | { theme: string; kind: string; error: string }> {
  const want = (t: string, k: string) => !only || only(t, k);
  for (const world of WORLDS) {
    for (const kind of world.kinds) {
      if (!want(world.id, kind.id)) continue;
      const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
      yield buildOne(world.id, kind.id, spec, { indoor: kind.indoor, danger: kind.danger });
    }
  }
  const extras: [string, string, any, { indoor?: boolean; danger?: boolean }][] = [
    ["joseon", "village", { type: "village", name: "조선 마을", style: "joseon", salt: 7 }, {}],
    ["joseon", "interior", { type: "interior", name: "조선 주막", style: "joseon", salt: 7 }, { indoor: true }],
    ["wizarding", "village", { type: "village", name: "마법 학교 뜰", style: "wizarding", salt: 7 }, {}],
    ["wizarding", "interior", { type: "interior", name: "마법 학교 교실", style: "wizarding", salt: 7 }, { indoor: true }],
    ["jp_city", "street", { type: "street", name: "상점가", style: "jp-modern", salt: 7 }, {}],
    ["jp_city", "house", { type: "house", name: "일본 가정집", style: "jp-modern", salt: 7 }, { indoor: true }],
    ["modern_kr", "street", { type: "street", name: "서울 골목", style: "kr-modern", salt: 7 }, {}],
    ["dungeon", "forest", { type: "dungeon", name: "깊은 숲", theme: "forest", size: "small", salt: 7 }, { danger: true }],
    ["dungeon", "pyramid", { type: "dungeon", name: "피라미드", theme: "pyramid", size: "small", salt: 7 }, { danger: true }],
    ["dungeon", "ice", { type: "dungeon", name: "얼음 동굴", theme: "ice", size: "small", salt: 7 }, { danger: true }],
  ];
  for (const [theme, kind, spec, flags] of extras) if (want(theme, kind)) {
    let got = buildOne(theme, kind, spec, flags);
    for (let t = 0; t < 8 && "error" in got && /불러오는 중/u.test(got.error); t++) { await new Promise((r) => setTimeout(r, 1500)); got = buildOne(theme, kind, spec, flags); }
    yield got;
  }
}

const lay = (map: any, k: string, x: number, y: number): number => (map[k]?.[y * map.width + x] ?? -1);
function labelsAt(project: any, map: any, x: number, y: number): string[] {
  return ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].map((k) => tileLabel(project, map, map[k]?.[y * map.width + x])).filter(Boolean);
}
/** 걸어 닿는, 윗층 그림 없는, 이벤트 없는, 둘레가 트인 칸 — (cx,cy) 에서 가까운 순. */
function openSpots(project: any, map: any, opts: { margin?: number; needBelow?: boolean; clear?: number } = {}): { x: number; y: number }[] {
  const reach = reachableCells(project, map);
  if (!reach) return [];
  const m = opts.margin ?? 3, w = map.width;
  const upper = (x: number, y: number) => lay(map, "upperTiles", x, y) >= 0 || lay(map, "upperOverlayTiles", x, y) >= 0;
  const out: { x: number; y: number; s: number }[] = [];
  const evs = new Set(map.events.map((e: any) => e.y * w + e.x));
  const clear = opts.clear ?? 1;
  for (let y = m; y < map.height - m; y++) for (let x = m; x < w - m; x++) {
    if (!reach[y * w + x] || upper(x, y)) continue;
    let ok = true;
    for (let dy = -clear; dy <= clear && ok; dy++) for (let dx = -clear; dx <= clear && ok; dx++) { const xx = x + dx, yy = y + dy; if (!isPassable(project, map, xx, yy) || upper(xx, yy) || evs.has(yy * w + xx)) ok = false; }
    if (!ok) continue;
    if (map.events.some((e: any) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 3)) continue;
    out.push({ x, y, s: Math.abs(x - w / 2) + Math.abs(y - map.height / 2) });
  }
  return out.sort((a, b) => a.s - b.s);
}
const withMap = (project: any, mapId: string, patch: (m: any) => any) => ({ ...project, maps: { ...project.maps, [mapId]: patch(structuredClone(project.maps[mapId])) } });
function mkEvent(id: string, name: string, x: number, y: number, pages: any[]): any {
  return { id, name, x, y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages: pages.map((p, i) => ({ id: `${id}_p${i}`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [], ...p })) };
}
function diffTiles(a: any, b: any): { n: number; cells: { x: number; y: number; k: string }[] } {
  const cells: { x: number; y: number; k: string }[] = [];
  for (const k of ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"]) for (let i = 0; i < a.width * a.height; i++) if ((a[k]?.[i] ?? -1) !== (b[k]?.[i] ?? -1)) cells.push({ x: i % a.width, y: Math.floor(i / a.width), k });
  return { n: cells.length, cells };
}

// ───────────────────────── 단계마다: 상황을 심고 → 단계 함수 → 판정 ─────────────────────────

const out = process.argv[2]!;
const onlyTheme = process.argv[3];   // 쉼표로 나눈 테마 id(없으면 전부)
fs.mkdirSync(`${out}/pic`, { recursive: true });
type V = "ok" | "none" | "gap" | "wrong" | "n/a" | "eye";
interface Cell { stage: string; theme: string; kind: string; v: V; detail: string; pic?: string }
const rows: Cell[] = [];
const rec = (s: Src, stage: string, v: V, detail: string, pic?: string) => { rows.push({ stage, theme: s.theme, kind: s.kind, v, detail, ...(pic ? { pic } : {}) }); };

const bp = (project: any, mapName: string, event: string, action: string, gives: string) => ({ ...project, gameBlueprint: { title: "시험", genre: "모험", request: "모험 게임 하나 만들어 줘.", playerGoal: "끝까지 간다.", steps: [{ id: "s1", place: mapName, event, action, needs: "", gives, feeling: "호기심" }], ending: { name: "끝", how: "끝났다.", feeling: "안도" } } });
const savePair = (name: string, a: any, am: any, b: any, bm: any, at?: { x: number; y: number }) => {
  fs.writeFileSync(`${out}/pic/${name}.before.png`, renderMapPng(a, am).png);
  fs.writeFileSync(`${out}/pic/${name}.after.png`, renderMapPng(b, bm).png);
  if (at) fs.writeFileSync(`${out}/pic/${name}.at.txt`, `${at.x},${at.y},${am.width},${am.height}`);
  return name;
};
function addHelperMap(run: any, tilesetId: string, role?: string): string | undefined {
  const made = run.call("create_map", { name: role === "dungeon" ? "시험 던전" : "시험 옆 맵", width: 20, height: 15, tilesetId });
  const id = made.data?.mapId;
  if (!made.ok || !id) return undefined;
  if (role) run.call("set_map_properties", { mapId: id, mapRole: role });
  return id;
}
const passableIn = (p: any, m: any) => { for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) if (isPassable(p, m, x, y)) return { x, y }; return { x: 1, y: 1 }; };
const transferPage = (mapId: string, x: number, y: number) => ({ graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, commands: [{ kind: "transfer", mapId, x, y, direction: "down" }] });

for await (const s of sources(onlyTheme ? (t) => onlyTheme.split(",").includes(t) : undefined)) {
  if ("error" in s) { console.log(`ERR ${s.theme}/${s.kind}: ${s.error}`); continue; }
  const tag = `${s.theme}__${s.kind}`;
  const P0 = s.project, M0 = P0.maps[s.mapId], w = M0.width;
  const outdoor = !s.indoor;
  const spots = openSpots(P0, M0, { margin: outdoor ? 5 : 2, clear: outdoor ? 2 : 1 });
  const spot = spots[0];
  const kit = kitOf(P0, M0);

  // ── pickup-chests
  try {
    if (!spot) rec(s, "pickup-chests", "n/a", "no open spot");
    else {
      const ev = mkEvent("ev_t_sword", "용사의 검", spot.x, spot.y, [{ commands: [{ kind: "text", body: "용사의 검을 얻었다." }, { kind: "changeItem", itemId: "item_x", operation: "increase", amount: 1 }, { kind: "setSwitch", switchId: "sw_sword", value: true }] }, { conditions: [{ kind: "switch", switchId: "sw_sword", value: true }], commands: [{ kind: "text", body: "더는 볼 것이 없다." }] }]);
      const p1 = bp(withMap(P0, s.mapId, (m) => { m.events.push(ev); return m; }), M0.name, "용사의 검", "용사의 검을 얻는다", "용사의 검");
      const run = mkRun(p1, s.mapId);
      const notes = dressPickupSteps(run, s.mapId);
      const m2 = run.ctx.project.maps[s.mapId], e2 = m2.events.find((e: any) => e.id === ev.id);
      const g = e2.pages[0].graphic ?? {};
      const shown = !g.transparent && (g.sprite || g.tileId > 0);
      const lost = unreachableEvents(run.ctx.project, s.mapId).filter((id: string) => !unreachableEvents(p1, s.mapId).includes(id));
      if (!notes.length) rec(s, "pickup-chests", "none", "no note");
      else rec(s, "pickup-chests", shown && !lost.length ? "ok" : "wrong", `${notes[0]} shown=${!!shown} lost=${lost.length}`, savePair(`pickup__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, m2, e2));
    }
  } catch (e) { rec(s, "pickup-chests", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── seal-step-art
  try {
    if (!spot) rec(s, "seal-step-art", "n/a", "no open spot");
    else {
      const ev = mkEvent("ev_t_seal", "고대의 봉인", spot.x, spot.y, [{ commands: [{ kind: "text", body: "봉인이 풀렸다." }, { kind: "setSwitch", switchId: "sw_seal", value: true }] }]);
      const p1 = bp(withMap(P0, s.mapId, (m) => { m.events.push(ev); return m; }), M0.name, "고대의 봉인", "봉인을 푼다", "봉인 해제");
      const run = mkRun(p1, s.mapId);
      const gaps: any[] = [];
      const notes = dressBareSealSteps(run, s.mapId, gaps);
      const m2 = run.ctx.project.maps[s.mapId];
      const d = diffTiles(p1.maps[s.mapId], m2);
      if (!notes.length) rec(s, "seal-step-art", gaps.length ? "gap" : "none", `${gaps.length ? `recorded art gap «${gaps[0].want}» · ` : ""}` + `step «고대의 봉인» stays invisible on ${outdoor ? "ground" : "floor"} (tileset ${M0.tilesetId})`);
      else rec(s, "seal-step-art", d.n > 0 ? "ok" : "wrong", `${notes[0]} tiles=${d.n}`, savePair(`seal__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, m2, spot));
    }
  } catch (e) { rec(s, "seal-step-art", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── cave-gates (바깥 맵)
  try {
    if (!outdoor) rec(s, "cave-gates", "n/a", "indoor");
    else {
      const gs = openSpots(P0, M0, { margin: 6, clear: 2 })[0];
      if (!gs) rec(s, "cave-gates", "n/a", "no open spot");
      else {
        const run = mkRun(structuredClone(P0), s.mapId);
        const dId = addHelperMap(run, M0.tilesetId, "dungeon");
        if (!dId) rec(s, "cave-gates", "n/a", "helper map failed");
        else {
          const dm = run.ctx.project.maps[dId], land = passableIn(run.ctx.project, dm);
          let p1 = withMap(run.ctx.project, s.mapId, (m) => { m.events.push(mkEvent("ev_t_cave", "", gs.x, gs.y, [transferPage(dId, land.x, land.y)])); return m; });
          p1 = withMap(p1, dId, (m) => { m.events.push(mkEvent("ev_t_back", "", land.x, Math.max(0, land.y - 1), [transferPage(s.mapId, gs.x, gs.y + 1)])); return m; });
          run.ctx.project = p1;
          const bare0 = placementProblems(p1, p1.maps[s.mapId]).filter((p: any) => p.kind === "door-bare").length;
          const gaps: any[] = [];
          const notes = dressBareCaveGates(run, s.mapId, gaps);
          const m2 = run.ctx.project.maps[s.mapId];
          const bare1 = placementProblems(run.ctx.project, m2).filter((p: any) => p.kind === "door-bare").length;
          const d = diffTiles(p1.maps[s.mapId], m2);
          const acted = notes.some((n: string) => /세웠다|지우고/u.test(n));
          if (!acted) rec(s, "cave-gates", gaps.length ? "gap" : "none", `${gaps.length ? `recorded art gap «${gaps[0].want}» · ` : ""}bare cave entrance stays (door-bare flagged ${bare0}→${bare1}) ${notes[0] ?? `tileset ${M0.tilesetId} is not beodeul_city`}`.slice(0, 200));
          else rec(s, "cave-gates", bare1 === 0 && d.n > 0 ? "ok" : "wrong", `${notes[0]} bare ${bare0}→${bare1} tiles=${d.n}`.slice(0, 220), savePair(`cave__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, m2, gs));
        }
      }
    }
  } catch (e) { rec(s, "cave-gates", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── entrance-seating (바깥 맵: 굴 입구처럼 보이는 그림이 있으면 그 곁에 「동굴 입구」 단계를 심는다)
  try {
    if (!outdoor) rec(s, "entrance-seating", "n/a", "indoor");
    else {
      const CAND = /동굴|굴 ?입구|갱구|cave|mouth|굴 ?문|hollow|구멍|터널|tunnel|갱도|mine|입구/iu;
      const STAGE_ART = /굴\s?문|굴\s?입구|갱구|구멍|동굴\s?입구|hollow|adit|cave mouth|cave entrance/iu;
      const found = new Map<string, { x: number; y: number; n: number }>();
      for (let y = 0; y < M0.height; y++) for (let x = 0; x < w; x++) for (const l of labelsAt(P0, M0, x, y)) if (CAND.test(l)) { const b = l.replace(/\s*\([^)]*\)\s*$/u, ""); const f = found.get(b) ?? { x, y, n: 0 }; f.n++; found.set(b, f); }
      if (!found.size) rec(s, "entrance-seating", "n/a", "no cave/entrance-like art on this map");
      else {
        const list = [...found].map(([b, f]) => `${b}×${f.n}${STAGE_ART.test(b) ? "✓" : "✗"}`).join(" | ");
        const first = [...found.values()][0]!;
        const near = openSpots(P0, M0, { margin: 2, clear: 1 }).sort((a, b) => (Math.abs(a.x - first.x) + Math.abs(a.y - first.y)) - (Math.abs(b.x - first.x) + Math.abs(b.y - first.y)))[0];
        if (!near) rec(s, "entrance-seating", "n/a", `art: ${list} but no open spot`);
        else {
          const ev = mkEvent("ev_t_ent", "동굴 입구", near.x, near.y, [{ commands: [{ kind: "text", body: "안에서 바람이 분다." }, { kind: "setSwitch", switchId: "sw_ent", value: true }] }]);
          const p1 = bp(withMap(P0, s.mapId, (m) => { m.events.push(ev); return m; }), M0.name, "동굴 입구", "동굴 입구를 살핀다", "동굴의 바람");
          const run = mkRun(p1, s.mapId);
          const notes = seatEntranceSteps(run, s.mapId);
          const e2 = run.ctx.project.maps[s.mapId].events.find((e: any) => e.id === ev.id);
          const moved = e2.x !== near.x || e2.y !== near.y;
          if (!moved) rec(s, "entrance-seating", "none", `step stays at (${near.x},${near.y}), ${Math.abs(near.x - first.x) + Math.abs(near.y - first.y)} from art · art: ${list}`.slice(0, 300));
          else rec(s, "entrance-seating", "eye", `${notes[0]} on «${labelsAt(run.ctx.project, run.ctx.project.maps[s.mapId], e2.x, e2.y).join("/")}» · art: ${list}`.slice(0, 300), savePair(`entrance__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, run.ctx.project.maps[s.mapId], e2));
        }
      }
    }
  } catch (e) { rec(s, "entrance-seating", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── locked-house-doors (바깥 맵)
  try {
    if (!outdoor) rec(s, "locked-house-doors", "n/a", "indoor");
    else {
      const run = mkRun(structuredClone(P0), s.mapId);
      const notes = lockBareHouseDoors(run, s.mapId);
      const m2 = run.ctx.project.maps[s.mapId];
      const locked = m2.events.filter((e: any) => e.id.startsWith("ev_locked_door_"));
      const ents = buildingEntrances(P0, M0);
      const offEntrance = locked.filter((e: any) => !ents.some((d: any) => d.x === e.x && d.y === e.y)).length;
      // 눌러도 아무 일도 없는 입구 — 걸어 가 설 수 있는 문인데 문 칸·문 앞에 이벤트가 하나도 없다(아무도 못 서는 문 앞은 세지 않는다).
      const reach0 = reachableCells(P0, M0);
      const standable = ents.filter((d: any) => !reach0 || reach0[d.front.y * w + d.front.x]);
      const silent = standable.filter((d: any) => !m2.events.some((e: any) => Math.abs(e.x - d.x) <= 1 && e.y >= d.y && e.y <= d.y + 1));
      const onBump = locked.filter((e: any) => (e.pages ?? []).some((p: any) => p.trigger?.kind !== "action")).length;
      const detail = `building entrances ${ents.length} (front reachable ${standable.length}) · lines ${locked.length} (off an entrance ${offEntrance}, answering a bump ${onBump}) · silent ${silent.length} · builder house doors ${s.doors.length}`;
      if (offEntrance || onBump) rec(s, "locked-house-doors", "wrong", detail);
      else if (silent.length) rec(s, "locked-house-doors", "none", detail);
      else if (locked.length) rec(s, "locked-house-doors", "ok", detail, savePair(`locked__${tag}`, P0, M0, run.ctx.project, m2, locked[0]));
      else rec(s, "locked-house-doors", "n/a", detail);
      void notes;
    }
  } catch (e) { rec(s, "locked-house-doors", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── interior-exits
  try {
    if (!kit) rec(s, "interior-exits", s.indoor ? "none" : "n/a", s.indoor ? `room has no roomKit (tileset ${M0.tilesetId}) — stage never runs here` : "outdoor, no roomKit");
    else if (outdoor) {
      const sp = spot ?? { x: 2, y: 2 };
      const ev = mkEvent("ev_t_gate", "낡은 성문", sp.x, sp.y, [{ commands: [{ kind: "text", body: "굳게 닫혀 있다." }] }]);
      const p1 = withMap(P0, s.mapId, (m) => { m.events.push(ev); return m; });
      const run = mkRun(p1, s.mapId);
      const res = dressInteriorExits(run, s.mapId);
      const m2 = run.ctx.project.maps[s.mapId];
      const d = diffTiles(p1.maps[s.mapId], m2);
      const e2 = m2.events.find((e: any) => e.id === ev.id);
      const moved = e2.x !== sp.x || e2.y !== sp.y;
      const natural = dressInteriorExits(mkRun(structuredClone(P0), s.mapId), s.mapId).notes;
      if (d.n || moved || natural.length) rec(s, "interior-exits", "wrong", `OUTDOOR map treated as a room: tiles changed ${d.n}, door event moved ${moved} · ${[...res.notes, ...natural.map((n: string) => `(natural) ${n}`)].join(" / ")}`.slice(0, 400), savePair(`intexit__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, m2, sp));
      else rec(s, "interior-exits", "ok", "outdoor map with a roomKit tileset: left alone");
    } else {
      const run = mkRun(structuredClone(P0), s.mapId);
      const res = dressInteriorExits(run, s.mapId);
      const m2 = run.ctx.project.maps[s.mapId];
      const d = diffTiles(M0, m2);
      rec(s, "interior-exits", res.notes.length ? "eye" : "ok", res.notes.length ? `${res.notes.join(" / ")} tiles=${d.n}`.slice(0, 300) : "kit room, nothing to fix", res.notes.length ? savePair(`intexit__${tag}`, P0, M0, run.ctx.project, m2) : undefined);
    }
  } catch (e) { rec(s, "interior-exits", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── door-floor-transfers (바닥 한가운데 투명 이동 칸)
  try {
    const sp = openSpots(P0, M0, { margin: 2, clear: 1 })[0];
    if (!sp) rec(s, "door-floor-transfers", "n/a", "no open spot");
    else {
      const run = mkRun(structuredClone(P0), s.mapId);
      const oId = addHelperMap(run, M0.tilesetId);
      if (!oId) rec(s, "door-floor-transfers", "n/a", "helper map failed");
      else {
        const om = run.ctx.project.maps[oId], land = passableIn(run.ctx.project, om);
        let p1 = withMap(run.ctx.project, s.mapId, (m) => { m.events.push(mkEvent("ev_t_floor", "", sp.x, sp.y, [transferPage(oId, land.x, land.y)])); return m; });
        p1 = withMap(p1, oId, (m) => { m.events.push(mkEvent("ev_t_fback", "", land.x, Math.max(0, land.y - 1), [transferPage(s.mapId, sp.x, sp.y + 1)])); return m; });
        run.ctx.project = p1;
        // 단계가 주는 것과 같게: 장소 기록의 종류(방·바깥).
        const gaps: any[] = [];
        const notes = doorFloorTransfers(run, s.mapId, s.indoor ? "room" : "outdoor", gaps);
        const m2 = run.ctx.project.maps[s.mapId], e2 = m2.events.find((e: any) => e.id === "ev_t_floor");
        const moved = e2.x !== sp.x || e2.y !== sp.y;
        const d = diffTiles(p1.maps[s.mapId], m2);
        if (!moved && !d.n) rec(s, "door-floor-transfers", !s.indoor ? "n/a" : gaps.length ? "gap" : "none", s.indoor ? `${gaps.length ? `recorded art gap «${gaps[0].want}» · ` : ""}` + `transparent floor transfer stays mid-floor (${kit ? `kit room: ${notes[0] ?? "no wall spot"}` : `no roomKit, tileset ${M0.tilesetId}`})` : "outdoor: not a room");
        else rec(s, "door-floor-transfers", outdoor ? "wrong" : "eye", `${notes.join(" / ")} tiles=${d.n}`.slice(0, 300), savePair(`floor__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, m2, e2));
      }
    }
  } catch (e) { rec(s, "door-floor-transfers", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── buried-transfers
  try {
    const reach = reachableCells(P0, M0);
    let buried: { x: number; y: number } | undefined;
    for (let y = 1; y < M0.height - 1 && !buried; y++) for (let x = 1; x < w - 1 && !buried; x++) if (!isPassable(P0, M0, x, y) && lay(M0, "upperTiles", x, y) >= 0 && reach?.[(y + 1) * w + x] && !M0.events.some((e: any) => e.x === x && e.y === y)) buried = { x, y };
    const sp = spots[0];
    if (!buried || !sp) rec(s, "buried-transfers", "n/a", "no furniture cell with a reachable front");
    else {
      const run = mkRun(structuredClone(P0), s.mapId);
      const oId = addHelperMap(run, M0.tilesetId);
      const land = oId ? passableIn(run.ctx.project, run.ctx.project.maps[oId]) : { x: 1, y: 1 };
      const p1 = withMap(run.ctx.project, s.mapId, (m) => { m.events.push(mkEvent("ev_t_buried", "", buried!.x, buried!.y, [transferPage(oId!, land.x, land.y)]), mkEvent("ev_t_twin", "", sp.x, sp.y, [transferPage(oId!, land.x, land.y)])); return m; });
      run.ctx.project = p1;
      const notes = dropBuriedTransfers(run, s.mapId);
      const gone = !run.ctx.project.maps[s.mapId].events.some((e: any) => e.id === "ev_t_buried");
      const twin = run.ctx.project.maps[s.mapId].events.some((e: any) => e.id === "ev_t_twin");
      rec(s, "buried-transfers", gone && twin ? "ok" : notes.length ? "wrong" : "none", `${notes[0] ?? "kept"}`.slice(0, 160));
    }
  } catch (e) { rec(s, "buried-transfers", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── target-fronts (대상 앞 칸을 막는 물건)
  try {
    const reach = reachableCells(P0, M0);
    const seen = new Set<string>();
    const tries: string[] = [];
    let acted = 0, seatKept = 0, nonSeatRemoved = 0, planted = 0;
    const SEATISH = /의자|걸상|스툴|벤치|장의자|방석|좌석|소파|안락|chair|stool|bench|seat|sofa|couch|cushion|zabuton|pew/iu;
    for (let y = 1; y < M0.height - 2 && planted < 8; y++) for (let x = 1; x < w - 1 && planted < 8; x++) {
      if (!reach?.[y * w + x] || isPassable(P0, M0, x, y + 1) || M0.events.some((e: any) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) continue;
      const cl = objectClusterAt(P0, M0, x, y + 1);
      if (!cl || seen.has(cl.label) || cl.cells.length > 4) continue;
      seen.add(cl.label); planted++;
      const ev = mkEvent("ev_t_npc", "단서를 아는 사람", x, y, [{ graphic: { sprite: { id: "tex_x", frame: 0 } }, commands: [{ kind: "text", body: "…" }] }]);
      const p1 = withMap(P0, s.mapId, (m) => { m.events.push(ev); return m; });
      const run = mkRun(p1, s.mapId);
      const notes = clearTargetFronts(run, s.mapId);
      const seat = SEATISH.test(cl.label);
      if (notes.length) { acted++; if (!seat) nonSeatRemoved++; tries.push(`removed «${cl.label}»${seat ? "" : "(NOT a seat)"}`); if (acted === 1) savePair(`front__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, run.ctx.project.maps[s.mapId], { x, y }); }
      else { if (seat) seatKept++; tries.push(`kept «${cl.label}»${seat ? "(seat!)" : ""}`); }
    }
    if (!planted) rec(s, "target-fronts", "n/a", "no small object blocking a reachable cell's front");
    else rec(s, "target-fronts", nonSeatRemoved ? "wrong" : acted ? "ok" : seatKept ? "none" : "n/a", `${planted} planted: ${tries.join(" · ")}`.slice(0, 400), acted ? `front__${tag}` : undefined);
  } catch (e) { rec(s, "target-fronts", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── event-reach (닿지 못하는 진행 이벤트 → 닿는 칸) + 이름의 물건 그림 깔기
  try {
    const reach = reachableCells(P0, M0);
    let pit: { x: number; y: number } | undefined;
    for (let y = 2; y < M0.height - 2 && !pit; y++) for (let x = 2; x < w - 2 && !pit; x++) {
      if (isPassable(P0, M0, x, y) || M0.events.some((e: any) => e.x === x && e.y === y)) continue;
      if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !reach?.[(y + dy!) * w + x + dx!])) pit = { x, y };
    }
    if (!pit) rec(s, "event-reach", "n/a", "no enclosed cell");
    else {
      for (const [name, key] of [["잠든 장치", "plain"], ["책상 서랍의 쪽지", "host"]] as const) {
        const ev = mkEvent(`ev_t_lost_${key}`, name, pit.x, pit.y, [{ commands: [{ kind: "text", body: "…" }, { kind: "setSwitch", switchId: "sw_l", value: true }] }]);
        const p1 = withMap(P0, s.mapId, (m) => { m.events.push(ev); return m; });
        const run = mkRun(p1, s.mapId);
        const lost = unreachableEvents(p1, s.mapId).filter((id: string) => id === ev.id);
        const fixed = lost.length ? repairEventReach(run, s.mapId, lost) : { moved: [], stuck: ["not flagged unreachable"], noArt: [] };
        const m2 = run.ctx.project.maps[s.mapId], e2 = m2.events.find((e: any) => e.id === ev.id);
        const still = unreachableEvents(run.ctx.project, s.mapId).includes(ev.id);
        const d = diffTiles(p1.maps[s.mapId], m2);
        const stage = key === "plain" ? "event-reach" : "event-reach(host name)";
        const on = labelsAt(run.ctx.project, m2, e2.x, e2.y).map((l: string) => l.replace(/\s*\([^)]*\)\s*$/u, "")).join("/");
        const invisibleOnBare = fixed.noArt.length > 0;
        if (still) rec(s, stage, fixed.moved.length ? "wrong" : "none", `still unreachable · ${[...fixed.moved, ...fixed.stuck].join(" / ")}`.slice(0, 240));
        else rec(s, stage, d.n ? "eye" : invisibleOnBare ? "gap" : "ok", `${fixed.moved.join(" / ")} · on «${on}» · tiles stamped ${d.n}${invisibleOnBare ? ` · recorded art gap «${fixed.noArt[0].want}»` : ""}`.slice(0, 300), d.n ? savePair(`reach_${key}__${tag}`, p1, p1.maps[s.mapId], run.ctx.project, m2, e2) : undefined);
      }
    }
  } catch (e) { rec(s, "event-reach", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── chaser-hiding (추격자가 있는 실내)
  try {
    if (!s.indoor || !spot) rec(s, "chaser-hiding", "n/a", s.indoor ? "no open spot" : "outdoor");
    else {
      const ev = mkEvent("ev_t_chaser", "쫓는 그림자", spot.x, spot.y, [{ graphic: { sprite: { id: "tex_x", frame: 0 } }, trigger: { kind: "eventTouch" }, movement: { type: "chase", speed: 3, frequency: 3 }, commands: [{ kind: "gameOver" }] }]);
      const p1 = withMap(P0, s.mapId, (m) => { m.events.push(ev); return m; });
      // 단계 파일을 그대로 돌린다 — 숨을 가구가 없을 때 «못 한 것» 기록(v2.art-gap)이 남는지까지 본다.
      const emitted: any[] = [];
      const env: any = { ctx: { project: p1 }, emit: (e: any) => emitted.push(e) };
      const notes: string[] = [];
      chaserHidingStage.run({ env, session: { missingArt: new Set<string>() }, notes } as any, "");
      const hides = env.ctx.project.maps[s.mapId].events.filter((e: any) => e.id.startsWith("ev_hide_"));
      const gap = emitted.find((e) => e.name === "v2.art-gap");
      rec(s, "chaser-hiding", hides.length ? "eye" : gap ? "gap" : "none", hides.length ? `hiding at ${notes.join(" · ")}`.slice(0, 220) : `0 hiding spots${gap ? ` · recorded art gap «${gap.data.want}»` : ""} — ${notes[0] ?? ""}`.slice(0, 220));
    }
  } catch (e) { rec(s, "chaser-hiding", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }

  // ── (helper) pickTransferSpot — 장소 잇기가 쓰는 이동 칸 자리
  try {
    for (const side of ["south", "north"] as const) {
      const run = mkRun(structuredClone(P0), s.mapId);
      // 건너편이 방일 때(건물 입구를 써도 된다) 고르는 자리.
      const got = pickTransferSpot(run, s.mapId, { side, outdoor, buildingDoor: true });
      const m2 = run.ctx.project.maps[s.mapId];
      const d = diffTiles(M0, m2);
      if (!got) { rec(s, `transferSpot(${side})`, "none", "undefined → caller falls back to an edge cell"); continue; }
      // 맵을 바꿨거나(문 그림을 지어내 깔았다) 건물 입구가 아닌 칸을 문이라고 했으면 잘못.
      const at = got.doorAt;
      const offEntrance = !!at && !buildingEntrances(P0, M0).some((e) => e.x === at.x && e.y === at.y);
      const v: V = d.n || offEntrance ? "wrong" : "ok";
      rec(s, `transferSpot(${side})`, v, `${got.note} → (${got.x},${got.y})${got.doorAt ? ` doorAt(${got.doorAt.x},${got.doorAt.y})` : ""}${offEntrance ? " — not a building entrance" : ""} tiles stamped ${d.n}`.slice(0, 260), v !== "ok" ? savePair(`spot_${side}__${tag}`, P0, M0, run.ctx.project, m2, got.doorAt ?? got) : undefined);
    }
    // 건너편을 모르거나 바깥 맵일 때는 집 문을 자리로 주지 않는다(집에 들어갔는데 다른 바깥 맵으로 나오게 된다).
    if (outdoor) {
      const plain = pickTransferSpot(mkRun(structuredClone(P0), s.mapId), s.mapId, { side: "south", outdoor });
      rec(s, "transferSpot(outdoor↔outdoor)", plain?.doorAt ? "wrong" : plain ? "ok" : "none", plain ? `${plain.note}${plain.doorAt ? " — a building door between two outdoor maps" : ""}` : "undefined → caller falls back to an edge cell");
    } else rec(s, "transferSpot(outdoor↔outdoor)", "n/a", "indoor");
  } catch (e) { rec(s, "transferSpot", "wrong", `threw ${(e as Error).message.slice(0, 120)}`); }
  console.error(`done ${tag}`);
}
fs.writeFileSync(`${out}/rows${onlyTheme ? `-${onlyTheme.replace(/,/g, "_")}` : ""}.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${r.stage.padEnd(24)} ${`${r.theme}/${r.kind}`.padEnd(30)} ${r.v.padEnd(5)} ${r.detail}`);
// 단계 × 테마 표(맵 수): W 잘못 · N 아무것도 안 함 · G 그림이 없어 못 했고 그렇게 적음 · E 그림을 열어 봐야 함 · R 맞음 · - 해당 없음
const themes = [...new Set(rows.map((r) => r.theme))], stages = [...new Set(rows.map((r) => r.stage))];
const LETTER: Record<V, string> = { wrong: "W", none: "N", gap: "G", eye: "E", ok: "R", "n/a": "" };
const cellOf = (stage: string, theme: string) => { const n: Record<string, number> = {}; for (const r of rows) if (r.stage === stage && r.theme === theme && LETTER[r.v]) n[LETTER[r.v]] = (n[LETTER[r.v]] ?? 0) + 1; return "WNGER".split("").filter((k) => n[k]).map((k) => `${k}${n[k]}`).join("") || "-"; };
console.log(`\n${"".padEnd(24)} ${themes.map((t) => t.slice(0, 9).padEnd(10)).join("")}`);
for (const s of stages) console.log(`${s.padEnd(24)} ${themes.map((t) => cellOf(s, t).padEnd(10)).join("")}`);
const total: Record<string, number> = {}; for (const r of rows) total[r.v] = (total[r.v] ?? 0) + 1;
console.log(`\n맵 칸 ${rows.length}: ${Object.entries(total).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
