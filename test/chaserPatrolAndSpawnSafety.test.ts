// J54·J61: 추격자는 순찰하고(보면 쫓고 놓치면 돌아와 다시 순찰), 시작·체크포인트가 추격자 시야에 있으면 도구·끝맺음 검사가 짚는다.
import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import { chaserThreatsAt, unsafeSpawnLines } from "@/project/chaserSpawnSafety";
import { createBlankProject } from "@/project/defaults";
import { startChaseSpawnGrace, tickChaseSpawnGrace } from "@/player/chaseSpawnGrace";
import { movementKeyProblems } from "@/editor/tools/eventPageKeys";
import type { GameEvent, Project } from "@/project/types";

function fixture(): { project: Project; mapId: string } {
  const project = createBlankProject();
  return { project, mapId: project.startMapId };
}

function chaser(project: Project, mapId: string, id: string): GameEvent {
  const event = project.maps[mapId]!.events.find((entry) => entry.id === id);
  if (!event) throw new Error(`no event ${id}`);
  return event;
}

describe("make_chase_scene 순찰", () => {
  it("patrol:{mode:'auto'} 는 닫힌 순찰 길을 movement.route 에 달고, 놓치면 돌아오게 한다", () => {
    const { project, mapId } = fixture();
    project.startPos = { x: 1, y: 1 };
    const result = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } }, patrol: { mode: "auto" } });
    const data = result.data as { eventId: string; patrolCells?: { x: number; y: number }[] };
    const movement = chaser(project, mapId, data.eventId).pages?.[0]?.movement as unknown as { type: string; route?: { moves: { kind: string }[]; repeat: boolean }; pursuit?: { onLost?: string } };
    expect(movement.type).toBe("chase");
    expect(movement.route?.repeat).toBe(true);
    expect(movement.route?.moves.some((move) => move.kind === "move")).toBe(true);
    expect(movement.pursuit?.onLost).toBe("return");
    const cells = data.patrolCells!;
    expect(cells[0]).toEqual(cells[cells.length - 1]);
  });

  it("patrol 이 없으면 순찰 없음을 요약에 적는다", () => {
    const { project, mapId } = fixture();
    project.startPos = { x: 1, y: 1 };
    const result = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } } });
    expect(result.summary).toContain("순찰 없음");
  });

  it("configure_npc_patrol 은 추격자에게 순찰 길을 달고 type 'chase' 를 지킨다", () => {
    const { project, mapId } = fixture();
    project.startPos = { x: 1, y: 1 };
    const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } } });
    const id = (made.data as { eventId: string }).eventId;
    getTool("configure_npc_patrol")!.run(project, { mapId, eventId: id, directions: ["right", "right", "left", "left"] });
    const movement = chaser(project, mapId, id).pages?.[0]?.movement as unknown as { type: string; route?: { moves: unknown[] }; pursuit?: { onLost?: string } };
    expect(movement.type).toBe("chase");
    expect(movement.route?.moves.length).toBeGreaterThan(0);
    expect(movement.pursuit?.onLost).toBe("return");
  });
});

describe("모르는 움직임 필드 거부", () => {
  it("patrol·waypoints 같은 엉뚱한 키를 이름과 함께 짚는다", () => {
    const problems = movementKeyProblems({ type: "chase", patrol: ["left"], waypoints: [], sight: { range: 5 } }, "movement");
    expect(problems.join(" ")).toContain("patrol");
    expect(problems.join(" ")).toContain("waypoints");
    // 문제 문장에는 허용 키 목록(…sight…)이 함께 붙는다 — sight 자체가 문제로 짚히지 않는지만 본다.
    expect(problems.some((problem) => problem.startsWith("movement.sight"))).toBe(false);
    expect(problems).toHaveLength(2);
  });

  it("patch_event_page 는 movement 의 모르는 키를 거부한다", () => {
    const { project, mapId } = fixture();
    project.startPos = { x: 1, y: 1 };
    const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 } } });
    const id = (made.data as { eventId: string }).eventId;
    expect(() => getTool("patch_event_page")!.run(project, { mapId, eventId: id, set: { movement: { type: "chase", patrolPath: ["left", "right"] } } })).toThrow(/patrolPath/u);
  });
});

describe("시작·체크포인트 안전(J61)", () => {
  it("추격자 시야 안의 시작 칸을 짚고, 멀리 옮기면 조용하다", () => {
    const { project, mapId } = fixture();
    project.startPos = { x: 1, y: 1 };
    const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 }, sightRange: 5 } });
    const id = (made.data as { eventId: string }).eventId;
    const at = chaser(project, mapId, id);
    expect(chaserThreatsAt(project, mapId, at.x - 3, at.y).map((threat) => threat.eventId)).toContain(id);
    const moved = getTool("set_start_position")!.run(project, { mapId, x: at.x - 3, y: at.y });
    expect((moved.warnings ?? []).join(" ")).toContain("추격자");
    expect(unsafeSpawnLines(project).length).toBeGreaterThan(0);
  });

  it("끝맺음 검사가 시야 안 시작 칸과 말로만 한 추격을 짚는다", () => {
    const { project: before, mapId } = fixture();
    before.startPos = { x: 1, y: 1 };
    const after = structuredClone(before);
    const made = getTool("make_chase_scene")!.run(after, { mapId, chaser: { at: { x: 12, y: 10 }, sightRange: 5 } });
    const at = chaser(after, mapId, (made.data as { eventId: string }).eventId);
    after.startPos = { x: at.x - 2, y: at.y };
    expect(gameContentProblems(before, after, "추격자를 둬").join(" ")).toContain("시작 위치");

    const talky = structuredClone(before);
    talky.maps[mapId]!.events.push({ id: "ev_guard", name: "경비", x: 5, y: 5, pages: [{ conditions: [], trigger: "action", commands: [{ kind: "text", body: "!" }] }] } as unknown as GameEvent);
    expect(gameContentProblems(before, talky, "경비가 시야에 들면 「!」 하고 쫓아오게").join(" ")).toContain("쫓는 움직임");
  });
});

describe("태어난 뒤 잠깐의 유예", () => {
  it("유예 시간 동안만 참이다", () => {
    const scene = {};
    startChaseSpawnGrace(scene, 2000);
    expect(tickChaseSpawnGrace(scene, 1500)).toBe(true);
    expect(tickChaseSpawnGrace(scene, 600)).toBe(false);
  });
});
