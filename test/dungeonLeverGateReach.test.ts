// 레버 관문은 말한 대로 갈라놓는다(2026-11-15 버들항 던전):
//   관문을 닫은 채 입구에서 레버에 닿는다 · 닫으면 못 가는 곳이 있고 열면 열린다 · 관문을 다 열면 모든 이벤트에 닿는다.
// 옛 placeLeverGate 는 계획 자리(population.lockedGate)를 믿고 놓아 고리 통로로 돌아가는 관문·관문 너머 레버가 나올 수 있었고,
// 이벤트로 막는 «막힌 바위» 는 판정(gatesThatOpenNothing)이 보지 못했다. 넓은 씨앗 훑기는 `bun scripts/qa/dungeon-gate-sweep.mts --seeds 1-200`.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { getTool } from "@/editor/tools/toolRegistry";
import { DUNGEON_TYPES } from "@/editor/dungeonKit/types";
import { auditLeverGates, dungeonStartCell, floorGateReport, gateReaches, leverGates, touchable } from "@/editor/tools/dungeonGateAudit";
import { gatesThatOpenNothing } from "@/ai/v2/judge/puzzleChecks";
import type { GameEvent, Project } from "@/project/types";

const BASE = (() => { const p = createBlankProject() as Project; applyGenrePreset(p, "adventure-jrpg"); return p; })();
// 큰 칩셋 표는 읽기만 한다 — 판마다 통째 복제하지 않는다.
const fresh = (): Project => ({ ...structuredClone({ ...BASE, tilesets: {} }), tilesets: BASE.tilesets }) as Project;

let composerRejects = 0;
/** 시공기가 그 씨앗의 배치를 스스로 물리치면(「시공기 내부 오류: 입구에서 걸어 닿지 않는 방」— 관문과 무관한 옛 결함, main 에도 있다) 빈 층 목록. */
function build(args: Record<string, unknown>): { project: Project; floors: string[]; gimmick: string | null } {
  const project = fresh();
  try {
    const res = getTool("author_dungeon")!.run(project, { name: "시험 던전", mapId: project.startMapId, ...args }) as { data: { floors: string[]; gimmick: string | null } };
    return { project, floors: res.data.floors, gimmick: res.data.gimmick };
  } catch (error) {
    if (!/시공기 내부 오류/u.test((error as Error).message)) throw error;
    composerRejects += 1;
    return { project, floors: [], gimmick: null };
  }
}

const SEEDS = [1, 2, 3] as const;
let leverGatesBuilt = 0, bridgeGatesBuilt = 0;

describe("던전 레버 관문 — 씨앗 × 종류 × 장치", () => {
  for (const type of DUNGEON_TYPES) {
    it(`${type}: 기본 장치 · 레버 · 다리 (씨앗 ${SEEDS.join("·")})`, () => {
      for (const gimmick of [undefined, "lever", "bridge"] as const) for (const seed of SEEDS) {
        const { project, floors, gimmick: placed } = build({ type, seed, ...(gimmick ? { gimmick } : {}) });
        let gates = 0;
        for (const id of floors) {
          const map = project.maps[id]!;
          const rep = floorGateReport(project, map);
          const where = `${type} ${gimmick ?? "기본"} 씨앗 ${seed} ${id}`;
          expect(rep.issues.map((i) => `${i.code}: ${i.message}`), where).toEqual([]);
          expect(rep.sealed, `${where} — 관문을 다 열어도 닿지 못하는 이벤트`).toEqual([]);
          gates += rep.gates;
        }
        if (placed === "lever") leverGatesBuilt += gates;
        if (placed === "bridge") bridgeGatesBuilt += gates;
        // 놓였다고 한 장치(레버·다리)는 어느 층에선가 실제로 관문으로 읽힌다(탑은 여러 층 — 장치는 꼭대기 층).
        if (placed === "lever" || placed === "bridge") expect(gates, `${type} ${gimmick ?? "기본"} 씨앗 ${seed} — ${placed} 장치가 관문으로 읽히지 않는다`).toBeGreaterThan(0);
      }
    }, 240_000);
  }

  it("이 시험이 빈 시험이 아니다 — 레버 관문과 다리 관문이 여럿 지어졌다", () => {
    expect(leverGatesBuilt).toBeGreaterThanOrEqual(30);
    expect(bridgeGatesBuilt).toBeGreaterThanOrEqual(1);   // 다리 장치는 걷어서 못 가는 방이 생기는 배치에만 선다 — 드물다(8씨앗 훑기 330판 중 2판)
    expect(composerRejects).toBeLessThanOrEqual(6);
  });
});

describe("관문 검사 자체", () => {
  it("레버를 관문 너머로 옮기면 lever-unreachable, 길막이를 열린 바닥으로 옮기면 gate-opens-nothing 이다", () => {
    const { project, floors } = build({ type: "cave", seed: 2, gimmick: "lever" });
    const map = project.maps[floors[0]!]!;
    const start = dungeonStartCell(map)!;
    expect(auditLeverGates(project, map)).toEqual([]);
    const [reach] = gateReaches(project, map, start);
    expect(reach).toBeDefined();
    const { gate, closed, open, gateCells } = reach!;
    // 닫으면 못 가고 열면 가는 칸 하나(관문 너머) — 레버를 거기로 옮긴다.
    const W = map.width;
    const far = Array.from({ length: open.length }, (_, i) => i).filter((i) => open[i] && !closed[i] && !gateCells.has(i));
    expect(far.length).toBeGreaterThan(0);
    const beyond = far.find((i) => !touchable(map, closed, { x: i % W, y: Math.floor(i / W) }))!;
    const moved = { ...map, events: map.events.map((e) => (e.id === gate.lever.id ? { ...e, x: beyond % W, y: Math.floor(beyond / W) } : e)) };
    expect(auditLeverGates(project, moved, start).map((i) => i.code)).toEqual(["lever-unreachable"]);
    // 길막이를 입구 곁 열린 칸(막아도 돌아가는 칸)으로 옮기면 아무것도 가르지 않는다.
    const openCells = Array.from({ length: closed.length }, (_, i) => i).filter((i) => closed[i] && i !== start.y * W + start.x
      && [1, -1, W, -W].filter((d) => closed[i + d]).length === 4 && !map.events.some((e) => Math.abs(e.x - (i % W)) + Math.abs(e.y - Math.floor(i / W)) <= 1));
    expect(openCells.length).toBeGreaterThan(0);
    const spot = openCells[0]!;
    const blockerIds = new Set(gate.blockers.map((e) => e.id));
    const first = gate.blockers[0]!;
    const loose = { ...map, events: map.events.filter((e) => !blockerIds.has(e.id) || e.id === first.id).map((e) => (e.id === first.id ? { ...e, x: spot % W, y: Math.floor(spot / W) } : e)) };
    expect(auditLeverGates(project, loose, start).map((i) => i.code)).toEqual(["gate-opens-nothing"]);
    // 판정도 이벤트 길막이를 본다(옛 검사는 타일 바꾸기만 봤다).
    const judged = gatesThatOpenNothing({ ...project, maps: { ...project.maps, [map.id]: loose } } as Project);
    expect(judged.some((line) => line.includes(gate.lever.id))).toBe(true);
    expect(gatesThatOpenNothing(project)).toEqual([]);
  }, 120_000);

  it("쓰러뜨리면 사라지는 적·말 걸면 비키는 인물은 길막이로 치지 않는다", () => {
    const { project, floors } = build({ type: "castle", seed: 1, gimmick: "none" });
    const map = project.maps[floors[0]!]!;
    expect(leverGates(project, map)).toEqual([]);
    const start = dungeonStartCell(map)!;
    const fixed = { type: "fixed", speed: 3, frequency: 3 } as const;
    // 자기 스위치를 자기가 켜는 적(전투 뒤 사라짐)
    const foe = { id: "ev_t_foe", name: "적", x: start.x, y: start.y - 1, trigger: { kind: "action" }, commands: [], pages: [
      { id: "p1", name: "적", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: fixed, commands: [{ kind: "setSwitch", switchId: "sw_t_foe", value: true }] },
      { id: "p2", name: "쓰러진 적", conditions: [{ kind: "switch", switchId: "sw_t_foe", value: true }], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", overlapForbidden: false, movement: fixed, commands: [] },
    ] } as unknown as GameEvent;
    const withFoe = { ...map, events: [...map.events, foe] };
    expect(leverGates(project, withFoe)).toEqual([]);
    expect(auditLeverGates(project, withFoe, start)).toEqual([]);
  }, 60_000);
});
