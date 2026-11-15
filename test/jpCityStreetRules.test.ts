// 일본 도시 새 거리(fable_street 조각)의 구성 규칙 — 거리 종류 열 가지 × 씨앗 여러 개의 계획을 검사한다(모델·그림 없음).
// 왜(오너 2026-11-15 «확대해서 보면 엉망진창인 게 너무많다»): 옛 거리는 소품이 차도 위에 서고, 담이 허공에서 끝나고, 같은 그림이 한 화면에 줄지어 섰다.
// 규칙은 구성기의 검사 함수(auditFable) 하나가 센다 — 여기서는 규칙마다 어긴 것이 0 인지 본다. 측정 스크립트(scripts/qa/jpStreetPlanDump.mts)도 같은 함수를 쓴다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { laneCells } from "@/ai/v2/place/placementRules";
import { createBlankProject } from "@/project/defaults";
import { blankFillTileFor, createStarterMap } from "@/project/defaults/defaultMaps";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { planJpCityScene, STREET_BAKED, type ScenePlan } from "@/project/jpCitySceneComposer";
import { Occ } from "@/project/jpCitySceneCtx";
import { auditFable } from "@/project/jpCitySceneFable";
import { SCENE_BUILDINGS, SCENE_KINDS, SCENE_SIZES } from "@/project/jpCitySceneKinds";
import { GROUND_FAMILIES, STREET_PIECES, STREET_RUNS, streetKitId } from "@/project/jpCityStreetPieces";
import { inMainWalkComponent, mainWalkComponent } from "@/project/walkComponent";

const W = 60, H = 48, SEEDS = 12;
const plans: { id: string; seed: number; plan: ScenePlan; audit: string[] }[] = [];
for (const k of SCENE_KINDS) for (let seed = 1; seed <= SEEDS; seed++) {
  const plan = planJpCityScene({ mapId: "m", width: W, height: H, seed, key: `game-${"abcdefgh"[seed % 8]}`, kind: k.id, style: k.styles[0] as never, fable: true });
  plans.push({ id: k.id, seed, plan, audit: auditFable(plan.fable!) });
}
const TARMAC = GROUND_FAMILIES.indexOf("tarmac");
/** 그 칸을 지나는 아스팔트가 가로·세로 모두 두 칸 넘게 이어지는가. */
function wideTarmac(g: Uint8Array, x: number, y: number): boolean {
  let h = 1, v = 1;
  for (let k = x - 1; k >= 0 && g[y * W + k] === TARMAC; k--) h++;
  for (let k = x + 1; k < W && g[y * W + k] === TARMAC; k++) h++;
  for (let k = y - 1; k >= 0 && g[k * W + x] === TARMAC; k--) v++;
  for (let k = y + 1; k < H && g[k * W + x] === TARMAC; k++) v++;
  return Math.min(h, v) >= 2;
}
/** 규칙 이름으로 시작하는 위반 줄(지도 이름을 붙여). */
const broken = (...rules: string[]) => plans.flatMap((p) => p.audit.filter((v) => rules.some((r) => v.startsWith(r))).map((v) => `${p.id}#${p.seed} ${v}`)).slice(0, 8);

describe("jp_city new street rules (fable_street pieces)", () => {
  it("covers all ten street kinds over many seeds and names only pieces that exist", () => {
    expect(SCENE_KINDS.length).toBe(10);
    expect(plans.length).toBe(10 * SEEDS);
    expect(broken("unknown piece")).toEqual([]);
    for (const p of plans) expect(p.plan.fable!.placed.length, `${p.id}#${p.seed}`).toBeGreaterThan(40);
  });

  it("keeps the carriageway clear: only vehicles and road markings cover a road cell", () => {
    expect(broken("on-carriageway")).toEqual([]);
  });

  it("stands every prop on its anchor class (wall, kerb, lot, road, water)", () => {
    expect(broken("anchor-")).toEqual([]);
    // 혼자 서지 않는 조각(대나무 가림 울·석등·물확·수도·헛간·개집·빨래)은 벽·건물 옆이거나 걷는 길 곁에 붙어 선다
    expect(broken("loose-piece")).toEqual([]);
  });

  it("closes every boundary run — no end in mid-air — and opens a house lot with one gate", () => {
    expect(broken("loose-run-end")).toEqual([]);
    // 주택가 지도마다 집 필지 셋 이상이 길 선의 담 키트(jp-bldg-f-kaki-*)와 대문 하나로 닫힌다. 담이 허공에서 끝나지 않는다 · 필지에 대문 하나 · 대문은 현관 앞이고 현관까지 걷는 칸 · 한 필지 한 담 종류는 auditFable 의 kaki-* 규칙이 본다(위 0건 시험).
    for (const p of plans.filter((q) => ["jutaku", "kawa-jutaku", "tera-machi"].includes(q.id))) {
      const k = p.plan.fable!.kaki;
      expect(k.filter((q) => q.gate).length, `${p.id}#${p.seed} walled house lots`).toBeGreaterThanOrEqual(3);
      expect(new Set(k.filter((q) => !q.gate).map((q) => q.id)).size, `${p.id}#${p.seed} wall kinds`).toBeGreaterThanOrEqual(2);
    }
    // 대문은 필지마다 하나: 같은 줄에서 대문끼리 붙어 서지 않는다
    for (const p of plans) for (const r of p.plan.fable!.runs) for (const a of r.gates) for (const b of r.gates) if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x), `${p.id}#${p.seed} ${r.family}`).toBeGreaterThan(2);
  });

  it("never overlaps two props and never lets the map edge cut one", () => {
    expect(broken("overlap", "cut-by-edge")).toEqual([]);
  });

  it("shows the same prop picture at most once in a 20×15 window (trees, boundary runs and floor pieces excepted)", () => {
    expect(broken("repeat-in-window")).toEqual([]);
  });

  it("puts an edge piece wherever two ground materials meet", () => {
    expect(broken("bare-seam")).toEqual([]);
  });

  it("paves kerb-less lanes with the lane surface, keeps stone paving to the temple approach, the old alley and shrine grounds, and bridges carry parapets", () => {
    const fam = (p: (typeof plans)[number], name: string) => { const i = GROUND_FAMILIES.indexOf(name as never); let n = 0; for (const v of p.plan.fable!.gfam) if (v === i) n++; return n; };
    for (const p of plans) {
      const stone = p.id === "monzen" || p.id === "roji";
      // 돌길은 참배길(monzen)·옛 골목(roji) 종류와 신사 경내의 참배길(본전 앞 두 칸 폭)에만 깔린다
      const shrine = p.plan.placed.some((b) => b.kit?.cat === "sacred");
      const gate = p.plan.steps.some((s) => /jp-bldg-f-(torii|sanmon)$/.test(String((s.args as { objectId?: string }).objectId)));
      if (!stone) expect(fam(p, "alley"), `${p.id}#${p.seed} stone paving`).toBeLessThanOrEqual(shrine || gate ? 2 * 16 : 0);
      // 차가 다니는 칸은 아스팔트(연석 큰길)이거나 생활도로 포장이거나, 돌길 종류의 돌길이다
      const f = p.plan.fable!;
      for (let i = 0; i < f.occ.length; i++) if (f.occ[i] === Occ.Road) expect(["tarmac", "lane", ...(stone ? ["alley"] : [])], `${p.id}#${p.seed} road cell ${i}`).toContain(GROUND_FAMILIES[f.gfam[i]!]);
    }
    expect(plans.filter((p) => p.id === "jutaku").every((p) => fam(p, "lane") > 200 && fam(p, "laneside") > 60)).toBe(true);
    // 세로 길이 강을 건너는 지도에는 다리 난간이 양옆에 선다
    const river = plans.filter((p) => fam(p, "water") > 0 && p.plan.fable!.roads.some((r) => r.dir === "v"));
    expect(river.length).toBeGreaterThan(10);
    for (const p of river) {
      const parapets = p.plan.fable!.placed.filter((q) => q.name.startsWith("bridge-"));
      expect(parapets.filter((q) => q.name.endsWith("-n")).length, `${p.id}#${p.seed} bridge ends`).toBeGreaterThanOrEqual(2);
      expect(parapets.filter((q) => q.name.startsWith("bridge-w")).length).toBe(parapets.filter((q) => q.name.startsWith("bridge-e")).length);
    }
  });

  it("marks lanes by road class — alleys none, one-lane edge lines, two-lane a centre line — unbroken outside crossings", () => {
    expect(broken("alley-marking", "edge-line-gap", "centre-line-gap", "centre-line-on-one-lane")).toEqual([]);
    expect(plans.some((p) => p.plan.fable!.roads.some((r) => r.cls === "one"))).toBe(true);
    expect(plans.some((p) => p.plan.fable!.roads.some((r) => r.cls === "alley"))).toBe(true);
    // 키 큰 지도(60×64)에서도 규칙이 지켜지고 두 차로 큰길(중앙선)이 선다
    let two = 0;
    for (const kind of ["ekimae", "zakkyo"]) for (let seed = 1; seed <= 8; seed++) {
      const tall = planJpCityScene({ mapId: "m", width: 60, height: 64, seed, key: "game-a", kind, style: "shopping", fable: true });
      expect(auditFable(tall.fable!), `${kind}#${seed} 60×64`).toEqual([]);
      two += tall.fable!.roads.filter((r) => r.cls === "two").length;
    }
    expect(two).toBeGreaterThan(0);
  });

  it("keeps earlier measures: no building picture twice on a map, road share and dead strips stay low", () => {
    let overRoad = 0, overDead = 0;
    const roadShare = new Map<(typeof plans)[number], number>();
    for (const p of plans) {
      const looks = p.plan.placed.filter((b) => b.kit).map((b) => b.kit!.look ?? b.kit!.id);
      expect(new Set(looks).size, `${p.id}#${p.seed} repeated building`).toBe(looks.length);
      const f = p.plan.fable!;
      const thing = new Uint8Array(W * H);
      const mark = (x0: number, y0: number, w: number, h: number) => { for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) thing[y * W + x] = 1; };
      for (const b of p.plan.placed) mark(b.x, b.y, b.w, b.foot - b.y + 1);
      for (const q of f.placed) if (STREET_PIECES[q.name]?.layer !== "floor" && STREET_PIECES[q.name]?.layer !== "ground") mark(q.x, q.y, q.w, q.h);
      for (const k of f.kaki) mark(k.x, k.y, k.w, k.h);
      let road = 0, dead = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (GROUND_FAMILIES[f.gfam[i]!] === "tarmac" && !thing[i]) { if (f.occ[i] === Occ.Road && wideTarmac(f.gfam, x, y)) road++; continue; }   // 폭 두 칸이 넘는 아스팔트 차도 몫(생활도로 포장·주차장 아스팔트는 차도도 죽은 띠도 아니다)
        if (thing[i] || ["water", "lane", "laneside"].includes(GROUND_FAMILIES[f.gfam[i]!]!) || f.occ[i] === Occ.Road) continue;   // 물·길은 죽은 띠가 아니다
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && thing[yy * W + xx]) { near = true; break; } }
        if (!near) dead++;
      }
      roadShare.set(p, road / (W * H));
      if (road / (W * H) > 0.19) overRoad++;
      if (dead / (W * H) > 0.03) overDead++;
      expect(road / (W * H), `${p.id}#${p.seed} road share`).toBeLessThanOrEqual(0.22);
      expect(dead / (W * H), `${p.id}#${p.seed} dead strips`).toBeLessThanOrEqual(0.04);
    }
    // 19% 를 넘는 것은 두 차로 큰길이 선 역 앞 종류의 몇 씨앗뿐이다
    expect(overRoad).toBeLessThanOrEqual(Math.ceil(plans.length * 0.08));
    expect(plans.filter((p) => p.id !== "ekimae").every((p) => roadShare.get(p)! <= 0.19)).toBe(true);
    expect(overDead).toBeLessThanOrEqual(Math.ceil(plans.length * 0.03));
  });

  it("places only new jp-bldg-f-* kits, each picture once per map, wall to wall, ten or more shops on a 60-cell shop street", () => {
    let near = 0, touching = 0;
    for (const p of plans) {
      const kits = p.plan.placed.filter((b) => b.kit);
      expect(kits.every((b) => b.kit!.id.startsWith("jp-bldg-f-")), `${p.id}#${p.seed} old kit`).toBe(true);
      // 문 열은 키트에서 읽은 사전 그대로다(entrance 부품)
      for (const b of kits) expect(b.doors, b.kit!.id).toEqual(SCENE_BUILDINGS.find((q) => q.id === b.kit!.id)!.doors);
      if (!["arcade", "ichiba", "monzen", "roji", "zakkyo", "ekimae"].includes(p.id)) continue;
      const rows = new Map<number, typeof kits>();
      for (const b of kits) if (b.kit!.cat !== "house") rows.set(b.foot, [...(rows.get(b.foot) ?? []), b]);
      const longest = [...rows.values()].sort((a, b) => b.length - a.length)[0] ?? [];
      expect(longest.length, `${p.id}#${p.seed} shops in the longest row`).toBeGreaterThanOrEqual(p.id === "ekimae" || p.id === "zakkyo" ? 8 : 10);   // 고층 종류는 12칸 초대형·역사 정면이 줄에 선다
      // 벽 맞댐: 같은 줄에서 가까이(두 칸 안) 선 이웃은 거의 다 틈 없이 붙는다(남는 틈은 두 칸 골목 길)
      for (const row of rows.values()) {
        const sorted = [...row].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++) { const gap = sorted[i]!.x - (sorted[i - 1]!.x + sorted[i - 1]!.w); if (gap <= 2) { near++; if (gap === 0) touching++; } }
      }
    }
    expect(touching / near, `wall-to-wall ${touching}/${near}`).toBeGreaterThanOrEqual(0.97);
  });

  it("stands a medium building (convenience store, supermarket, bank, post office, police box, clinic, cram school, bath) only at a block end, never between two neighbours", () => {
    let seen = 0;
    for (const p of plans) {
      const kits = p.plan.placed.filter((b) => b.kit);
      for (const m of kits.filter((b) => b.kit!.cat === "medium")) {
        seen++;
        const left = kits.some((b) => b !== m && b.foot === m.foot && b.x + b.w === m.x), right = kits.some((b) => b !== m && b.foot === m.foot && b.x === m.x + m.w);
        expect(left && right, `${p.id}#${p.seed} ${m.kit!.id} at ${m.x},${m.foot}`).toBe(false);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(plans.length);   // 지도마다 평균 한 채는 선다
  });

  it("stands large and extra-large buildings at a street end of a block, each kind once per map, one extra-large at most on the tall kinds, car mouths open to the street", () => {
    let large = 0, xl = 0, station = 0;
    for (const p of plans) {
      const f = p.plan.fable!, kits = p.plan.placed.filter((b) => b.kit);
      const big = kits.filter((b) => b.kit!.cat === "large" || b.kit!.cat === "xlarge");
      for (const m of big) {
        const left = kits.some((b) => b !== m && b.foot === m.foot && b.x + b.w === m.x), right = kits.some((b) => b !== m && b.foot === m.foot && b.x === m.x + m.w);
        expect(left && right, `${p.id}#${p.seed} ${m.kit!.id} at ${m.x},${m.foot}`).toBe(false);
      }
      expect(new Set(big.map((b) => b.kit!.role)).size, `${p.id}#${p.seed} same large kind twice`).toBe(big.length);
      const xs = kits.filter((b) => b.kit!.cat === "xlarge"), st = kits.filter((b) => b.kit!.role === "station-front");
      expect(xs.length, `${p.id}#${p.seed} extra-large`).toBeLessThanOrEqual(1);
      expect(st.length, `${p.id}#${p.seed} station fronts`).toBeLessThanOrEqual(1);
      if (xs.length) expect(["ekimae", "zakkyo"], `${p.id}#${p.seed}`).toContain(p.id);
      if (st.length) expect(p.id).toBe("ekimae");
      expect(kits.filter((b) => b.kit!.role === "sento" || b.kit!.role === "big-bath").length, `${p.id}#${p.seed} baths`).toBeLessThanOrEqual(1);
      large += big.length - xs.length; xl += xs.length; station += st.length;
      // 차가 드나드는 입(차고·구급차 자리·주차장 입구) 앞 세 줄에는 담·난간이 서지 않는다
      for (const b of kits) if (b.kit!.bay) for (let x = b.x + b.kit!.bay[0]; x < b.x + b.kit!.bay[0] + b.kit!.bay[1]; x++) for (let y = b.foot + 1; y <= Math.min(H - 1, b.foot + 3); y++) {
        expect(f.occ[y * W + x], `${p.id}#${p.seed} ${b.kit!.id} bay ${x},${y}`).not.toBe(Occ.Wall);
      }
    }
    expect(large).toBeGreaterThanOrEqual(20);
    expect(xl).toBeGreaterThanOrEqual(6);
    expect(station).toBeGreaterThanOrEqual(3);
  });

  it("gives the strip behind a shop row a use with an edge: no earth or lawn against a shop's back wall, one fenced vacant lot per map at most", () => {
    for (const p of plans) {
      expect(p.plan.pieces.filter((q) => q === "vacant" || q === "construction").length, `${p.id}#${p.seed} bare-earth lots (vacant, building site)`).toBeLessThanOrEqual(1);
      if (!["arcade", "ichiba", "ekimae", "monzen"].includes(p.id)) continue;
      const f = p.plan.fable!;
      for (const b of p.plan.placed) if (b.kit && !["house", "apartment", "sacred"].includes(b.kit.cat) && b.y >= 1) for (let x = b.x; x < b.x + b.w; x++) {
        expect(["earth", "lawn"], `${p.id}#${p.seed} behind ${b.kit.id} at ${x},${b.y - 1}`).not.toContain(GROUND_FAMILIES[f.gfam[(b.y - 1) * W + x]!]);
      }
    }
  });

  it("stands the temple gate only on a deep precinct of tera-machi — gate on the street line, hall behind it on the same axis, stone lanterns in pairs along the approach — and one shrine gate per map at most", () => {
    let gates = 0;
    for (const p of plans) {
      const f = p.plan.fable!;
      const steps = p.plan.steps.map((s) => s.args as { objectId?: string; x?: number; y?: number });
      const sanmon = steps.filter((a) => String(a.objectId).endsWith("/jp-bldg-f-sanmon")), torii = steps.filter((a) => String(a.objectId).endsWith("/jp-bldg-f-torii"));
      expect(sanmon.length + torii.length, `${p.id}#${p.seed} gates`).toBeLessThanOrEqual(1);
      for (const g of sanmon) {
        gates++;
        expect(p.id).toBe("tera-machi");
        const [gw] = SCENE_SIZES["jp-bldg-f-sanmon"]!;
        const hall = p.plan.placed.find((b) => b.kit?.cat === "sacred" && b.foot < g.y! && b.x + b.doors[0]! >= g.x! && b.x + b.doors[0]! < g.x! + gw);
        expect(hall, `${p.id}#${p.seed} hall behind the gate`).toBeDefined();
        expect(g.y! - hall!.foot, `${p.id}#${p.seed} approach depth`).toBeGreaterThanOrEqual(6);
        const lanterns = f.placed.filter((q) => q.name === "lantern-stone" && q.y > hall!.foot && q.y < g.y! && q.x >= g.x! && q.x < g.x! + gw);
        expect(lanterns.length, `${p.id}#${p.seed} lanterns`).toBeGreaterThanOrEqual(4);
        for (const l of lanterns) expect(lanterns.filter((q) => q.y === l.y).length, `${p.id}#${p.seed} lantern pair at y=${l.y}`).toBe(2);
      }
    }
    expect(gates).toBeGreaterThanOrEqual(3);
  });

  it("every piece and every boundary-run member the composer names is a baked kit", () => {
    expect(STREET_BAKED).toBe(true);
    for (const [name, p] of Object.entries(STREET_PIECES)) for (const g of p.grounds?.length ? p.grounds : [undefined]) expect(SCENE_SIZES[streetKitId(name, g)], streetKitId(name, g)).toEqual([p.w, p.h]);
    for (const [family, r] of Object.entries(STREET_RUNS)) for (const n of [r.mid, ...r.mids, r.endL, r.endR, r.sideL, r.sideR, r.nw, r.ne, r.sw, r.se, ...(r.gate ?? [])]) if (n) expect(STREET_PIECES[n], `${family}: ${n}`).toBeDefined();
    for (const f of GROUND_FAMILIES.slice(1)) expect(SCENE_SIZES[`jp-st-gnd-${f}`], f).toBeDefined();
  });

  it("builds real maps from the baked pieces: every door reachable, asphalt is a lane for passers-by and pavement is not", () => {
    for (const [style, seed] of [["shopping", 1], ["residential", 2], ["shotengai", 2], ["shitamachi", 3]] as const) {
      const project = createBlankProject();
      const tileset = createJpCityTileset();
      project.tilesets[JP_CITY_ID] = tileset;
      const hub = createStarterMap();
      Object.assign(hub, { id: "hub", name: "거리", tilesetId: JP_CITY_ID, width: W, height: H });
      hub.lowerTiles = new Array(W * H).fill(blankFillTileFor(JP_CITY_ID));
      hub.upperTiles = new Array(W * H).fill(-1);
      project.maps.hub = hub;
      const ctx = { project, assistantRun: true, lookKey: "game-a" };
      const res = runTool(ctx, "compose_jp_city_street", { mapId: "hub", style, seed, replace: true }, { dryRun: false });
      expect(res.ok, res.summary).toBe(true);
      const map = ctx.project.maps.hub!;
      const walk = mainWalkComponent(ctx.project, map);
      const doors = (map.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building")).map((l) => /문 앞 접근칸 \((\d+),(\d+)\)/u.exec(l.note ?? "")).filter((m): m is RegExpExecArray => !!m);
      expect(doors.length, `${style} seed ${seed}`).toBeGreaterThanOrEqual(6);
      for (const m of doors) expect(inMainWalkComponent(walk, map, { x: Number(m[1]), y: Number(m[2]) }), `${style} seed ${seed} door front (${m[1]},${m[2]})`).toBe(true);
      const group = (id: string) => new Set(tileset.tileGroups?.find((g) => g.id === id)?.tileIds ?? []);
      const tarmac = group("jp:fable-street:gnd-tarmac"), pave = group("jp:fable-street:gnd-pave");
      expect(tarmac.size).toBeGreaterThan(0);
      const lanes = laneCells(ctx.project, map);
      let onTarmac = 0, onPave = 0, paveAsLane = 0, tarmacAsLane = 0;
      map.lowerTiles.forEach((t, i) => { if (tarmac.has(t)) { onTarmac++; if (lanes.has(i)) tarmacAsLane++; } else if (pave.has(t)) { onPave++; if (lanes.has(i)) paveAsLane++; } });
      expect(onPave, `${style} seed ${seed} pavement cells`).toBeGreaterThan(100);
      expect(paveAsLane, `${style} seed ${seed} pavement read as a lane`).toBe(0);
      if (onTarmac) expect(tarmacAsLane / onTarmac, `${style} seed ${seed} asphalt read as a lane`).toBeGreaterThan(0.9);
    }
  });
});
