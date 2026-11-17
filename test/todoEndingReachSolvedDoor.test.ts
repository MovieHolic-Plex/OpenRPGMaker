import { describe, expect, it } from "vitest";
import { runTodoCheck } from "@/ai/v2/judge/todoChecks";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// r7 R1 · pf4-live c3(2026-11-16): 할 일 «ending reached» 가 «시작 맵에서 옛 지하 묘지로 가는 길이 없다» 고 거절했는데, 자동 플레이·정직한 플레이어·브라우저는 엔딩에 닿았다.
// 대성당 계단실 모양을 줄였다: 번호 쪽지(지나감) → 지하 문(처음엔 막음, 번호를 풀면 마지막 페이지가 «below» 로 지나감) → 계단(묘지로 이동) → 묘지의 엔딩.
const page = (commands: unknown[], conditions: unknown[] = [], priority = "same", trigger = "action") => ({ id: `p${Math.random().toString(36).slice(2, 7)}`, trigger: { kind: trigger }, priority, graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions, commands });
const sw = (id: string) => ({ kind: "switch", switchId: id, value: true });

function corridorGame(doorOpensAfterSolve: boolean): Project {
  const project = createBlankProject();
  const hall = project.maps[project.startMapId]!;
  const floor = hall.lowerTiles[0]!;
  const corridor = (id: string, name: string, width: number) => ({ ...structuredClone(hall), id, name, width, height: 1, lowerTiles: Array(width).fill(floor), upperTiles: Array(width).fill(0), events: [] as never[] });
  const cathedral = Object.assign(hall, corridor(hall.id, "대성당", 8));
  const crypt = corridor("map_crypt", "옛 지하 묘지", 4);
  project.maps[crypt.id] = crypt as never;
  project.startPos = { x: 0, y: 0 } as never;
  const db = project.database as unknown as { switches?: { id: string; name: string }[] };
  db.switches = [...(db.switches ?? []), { id: "sw_note", name: "쪽지" }, { id: "sw_solved", name: "풀림" }];
  cathedral.events.push(
    { id: "ev_note", name: "번호 쪽지", x: 1, y: 0, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "setSwitch", switchId: "sw_note", value: true }], [], "below")] } as never,
    { id: "ev_door", name: "지하 문", x: 3, y: 0, trigger: { kind: "action" }, commands: [], pages: [
      page([{ kind: "text", body: "굳게 잠긴 철문." }]),
      page([{ kind: "setSwitch", switchId: "sw_solved", value: true }], [sw("sw_note")]),
      ...(doorOpensAfterSolve ? [page([], [sw("sw_solved")], "below")] : []),
    ] } as never,
    { id: "ev_stairs", name: "계단", x: 6, y: 0, trigger: { kind: "playerTouch" }, commands: [], pages: [page([{ kind: "transfer", mapId: crypt.id, x: 0, y: 0 }], [], "below", "playerTouch")] } as never,
  );
  crypt.events.push({ id: "ev_end", name: "망자 군주", x: 2, y: 0, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "triggerEnding", endingId: "ending_sea" }])] } as never);
  project.endings = [{ id: "ending_sea", name: "다시 열린 바다", conditions: [], priority: 0 }] as never;
  return project;
}

describe("할 일 «엔딩에 닿는다» 는 풀린 문을 지나 걷는다", () => {
  it("번호를 풀면 지나가게 되는 문 너머의 계단으로 묘지에 닿는다", () => {
    const result = runTodoCheck(corridorGame(true), { kind: "ending" }, {});
    expect(result.detail).not.toContain("가는 길이 없다");
    expect(result.pass).toBe(true);
  });

  it("풀어도 계속 막는 문이면 여전히 못 닿는다고 말한다", () => {
    const result = runTodoCheck(corridorGame(false), { kind: "ending" }, {});
    expect(result.pass).toBe(false);
  });
});
