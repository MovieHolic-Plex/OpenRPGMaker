// 끝맺음 「목표 길 안내」 가 단계 목표에 «다음 단계를 넘기는 이벤트»를 묶는다(fields.targetMapId · targetEventId).
// 2026-11-12 r1 눈가림 플레이 · 따라 걷는 자: 이름이 같은 다른 이벤트(r1-farm 「보리」 둘), 이름 있는 말 이벤트 뒤의 이름 없는 보스(r1-fantasy 「광산 수호자」),
// 이름을 글에 안 쓴 단계(fun-x1) 에서 표시가 엉뚱한 곳에 서거나 없었다 — 16게임 1칸 누르기 148/162 → 159/162 (openwiki/assistant-v2.md).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { objectiveCommand, objectiveTargetOf, setObjectiveTarget } from "@/ai/v2/judge/objectiveCommand";
import { planObjective } from "@/ai/v2/judge/objectivePlan";
import { refreshObjectiveRoutes } from "@/ai/v2/judge/objectiveRoutes";
import type { RawCommand } from "@/qa/gameCheck/walk";
import type { GameEvent, Project } from "@/project/types";

const page = (commands: unknown[], extra: object = {}) => ({ id: `p${Math.random()}`, trigger: { kind: "action" }, priority: "same", graphic: {}, conditions: [], commands, ...extra });
const chips = (event: unknown): RawCommand[] => {
  const out: RawCommand[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.kind === "m2Command" && (record.fields as { surface?: string } | undefined)?.surface === "objectiveChip") out.push(record as unknown as RawCommand);
    for (const [key, child] of Object.entries(record)) if (key !== "fields") walk(child);
  };
  walk(event);
  return out;
};
const targetsOf = (event: unknown) => chips(event).map((command) => objectiveTargetOf(command));

function twoMaps(): { project: Project; first: Project["maps"][string]; room: Project["maps"][string] } {
  const project = createBlankProject() as Project;
  const first = project.maps[project.startMapId]!;
  const room = { ...structuredClone(first), id: "map_b", name: "보리밭", events: [] as GameEvent[] };
  project.maps[room.id] = room as never;
  first.events.push({ id: "ev_door", name: "문", x: 5, y: 5, pages: [page([{ kind: "transfer", mapId: "map_b", x: 3, y: 3 }], { trigger: { kind: "playerTouch" } })] } as never);
  return { project, first, room: project.maps.map_b! };
}
const blueprint = (steps: object[]) => normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "보리밭을 되살린다", ending: { name: "끝", how: "끝", feeling: "f" }, steps });

describe("objective command carries its target as two flat fields", () => {
  it("writes · reads · changes · removes", () => {
    const command = objectiveCommand("보리와 이야기한다", { mapId: "m", eventId: "e" });
    expect(command.fields).toEqual({ surface: "objectiveChip", message: "보리와 이야기한다", durationMs: 0, targetMapId: "m", targetEventId: "e" });
    expect(() => validateCommandArray("commands", [command])).not.toThrow();
    expect(objectiveTargetOf(command)).toEqual({ mapId: "m", eventId: "e" });
    expect(setObjectiveTarget(command, { mapId: "m", eventId: "e" })).toBe(false);
    expect(setObjectiveTarget(command, { mapId: "m", eventId: "e2" })).toBe(true);
    expect(objectiveTargetOf(command)).toEqual({ mapId: "m", eventId: "e2" });
    expect(setObjectiveTarget(command, undefined)).toBe(true);
    expect(command.fields).toEqual({ surface: "objectiveChip", message: "보리와 이야기한다", durationMs: 0 });
    expect(objectiveTargetOf(objectiveCommand("대상 없음"))).toBeUndefined();
  });
});

describe("finish: step objectives are bound to the event that advances the next step", () => {
  it("binds the objective whose text is the next step's action; with two namesakes the built event wins", () => {
    const { project, first, room } = twoMaps();
    first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("보리에게 수확 이야기를 듣는다 (보리밭 입구: 동쪽 → 보리)")])] } as never);
    room.events.push({ id: "ev_bori_story", name: "보리", x: 4, y: 4, pages: [page([{ kind: "text", body: "수확 이야기" }])] } as never);
    room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }, { kind: "setSwitch", switchId: "sw_b", value: true }])] } as never);
    project.gameBlueprint = blueprint([
      { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
      { id: "s2", place: "보리밭", event: "보리", action: "보리에게 수확 이야기를 듣는다.", needs: "부탁", gives: "엔딩", feeling: "f" },
    ]);
    // 지어 둔 이벤트 기록이 없으면(옛 저장본) 이름이 같은 첫 이벤트.
    refreshObjectiveRoutes(project);
    expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_bori_story" }]);
    // build_blueprint_path 가 적어 둔 것이 있으면 그 이벤트.
    project.gameBlueprint!.steps[1]!.built = { mapId: "map_b", eventId: "ev_bori" };
    expect(refreshObjectiveRoutes(project)).toBeGreaterThan(0);
    expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }]);
    // 다시 돌려도 같다(바꾼 것 없음).
    expect(refreshObjectiveRoutes(project)).toBe(0);
  });

  it("a built event that was removed afterwards falls back to the name", () => {
    const { project, first, room } = twoMaps();
    first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("보리에게 수확 이야기를 듣는다")])] } as never);
    room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
    project.gameBlueprint = blueprint([
      { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
      { id: "s2", place: "보리밭", event: "보리", action: "보리에게 수확 이야기를 듣는다", needs: "부탁", gives: "엔딩", feeling: "f" },
    ]);
    project.gameBlueprint!.steps[1]!.built = { mapId: "map_b", eventId: "ev_gone" };
    refreshObjectiveRoutes(project);
    expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }]);
  });

  it("a step locked behind a fight: the target is the event that carries the battle, even when it has no name", () => {
    const { project, first, room } = twoMaps();
    project.database.troops.length = 0; // 이름 붙일 부대가 없다 — 보스 이벤트는 이름 없이 남는다.
    first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("광산 수호자를 쓰러뜨린다 (보리밭 입구: 동쪽 → 광산 수호자)")])] } as never);
    // 말 이벤트는 이긴 뒤에만 다음 장면으로 넘어간다(조건 없는 페이지 + 승리 스위치 페이지).
    room.events.push({ id: "ev_guardian_talk", name: "광산 수호자", x: 4, y: 4, pages: [page([{ kind: "text", body: "아직 서 있다." }]), page([{ kind: "text", body: "쓰러졌다." }, { kind: "setSwitch", switchId: "sw_b", value: true }], { conditions: [{ kind: "switch", switchId: "sw_won", value: true }] })] } as never);
    room.events.push({ id: "ev_boss", name: "", x: 14, y: 9, pages: [page([{ kind: "battleProcessing", troopId: "troop_x", canEscape: false, canLose: false }, { kind: "setSwitch", switchId: "sw_won", value: true }])] } as never);
    project.gameBlueprint = blueprint([
      { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
      { id: "s2", kind: "battle", place: "보리밭", event: "광산 수호자", action: "광산 수호자를 쓰러뜨린다", needs: "부탁", gives: "엔딩", feeling: "f" },
    ]);
    refreshObjectiveRoutes(project);
    expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_boss" }]);
  });

  it("an objective that says something else than the next step (a suspect line, a side errand) is not bound", () => {
    const { project, first, room } = twoMaps();
    first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("용의자 셋 중 범인을 지목한다 (하린 · 도윤 · 세아)")])] } as never);
    room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
    project.gameBlueprint = blueprint([
      { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
      { id: "s2", place: "보리밭", event: "보리", action: "보리에게 수확 이야기를 듣는다", needs: "부탁", gives: "엔딩", feeling: "f" },
    ]);
    refreshObjectiveRoutes(project);
    expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([undefined]);
  });

  it("keeps a target the setter wrote, and drops one whose event no longer exists", () => {
    const { project, first, room } = twoMaps();
    room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
    first.events.push({ id: "ev_lever", name: "레버", x: 8, y: 8, pages: [page([
      objectiveCommand("「보리」를 찾아가자", { mapId: "map_b", eventId: "ev_bori" }),
      objectiveCommand("「허수아비」를 찾아가자", { mapId: "map_b", eventId: "ev_scarecrow_removed" }),
    ])] } as never);
    refreshObjectiveRoutes(project);
    expect(targetsOf(first.events.find((e) => e.id === "ev_lever"))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }, undefined]);
  });
});

describe("set_objective plan passes the target along", () => {
  it("puts the target on the objective it hangs after the event's milestone", () => {
    const { project, first, room } = twoMaps();
    first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "text", body: "부탁하네." }, { kind: "setSwitch", switchId: "sw_a", value: true }])] } as never);
    room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
    const plan = planObjective(project, { text: "보리를 찾아가자", eventId: "ev_elder", mapId: first.id, target: { mapId: "map_b", eventId: "ev_bori" } });
    expect(plan.ok).toBe(true);
    expect(plan.events.flatMap(({ event }) => targetsOf(event))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }]);
    const bare = planObjective(project, { text: "보리를 찾아가자", eventId: "ev_elder", mapId: first.id });
    expect(bare.events.flatMap(({ event }) => targetsOf(event))).toEqual([undefined]);
  });
});
