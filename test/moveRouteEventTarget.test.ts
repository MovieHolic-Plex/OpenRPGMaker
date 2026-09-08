// test/moveRouteEventTarget.test.ts
//
// OPRN-OUT-012 — moveEvent 「누구를」 대상의 공용 카탈로그·해석기.
//
// 재현된 결함: 조수가 `{"kind":"moveEvent","eventId":"this"}` 를 내면 검증을 전부 통과하고
// 저장돼, 스튜디오에는 «이동 경로 설정 this (없음)» 으로 보이고 테스트 플레이에서는
// 대상 NPC 가 움직이지 않았다(runtime 은 "this" 라는 이름의 이벤트를 찾다 실패한다).
//
// 이 파일이 못 박는 것:
//  1. 카탈로그가 현재 맵 이벤트를 이름+정본 id 로 열거하고 특수값 둘을 정확히 말한다.
//  2. 해석기가 `this`·이름 같은 비정본 값을 정본값으로 옮기고, 못 옮기면 실행 가능한 오류를 낸다.
//  3. 조수 출력 검증이 적용 **전에** 그 오류를 내서 자가수정 루프가 고칠 수 있다.
//  4. 테스트 플레이(런타임)에서 정본 id 는 대상 이벤트를 실제로 움직이고 `this` 는 못 움직인다.
import { describe, expect, it } from "vitest";
import {
  PLAYER_MOVE_TARGET,
} from "@/project/moveRouteTarget";
import {
  THIS_EVENT_MOVE_TARGET,
  buildEventTargetCatalog,
  canonicalMoveTargetValue,
  matchEventTargets,
  moveTargetIssueMessage,
  moveTargetPromptSection,
  resolveMoveTarget,
} from "@/project/eventTargetCatalog";
import { buildEventAssistPrompt, parseAndValidate } from "@/ai/eventCommandAssist";
import { createBlankProject } from "@/project/defaults";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

function pageNamed(name: string): EventPage {
  return {
    id: `pg_${name}`,
    name,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function eventNamed(id: string, name: string, x: number, y: number): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [pageNamed(name)] };
}

/** 문지기 / 상인 / 이름이 겹치는 경비 둘이 있는 맵. */
function projectWithEvents(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = [
    eventNamed("ev_npc_gate", "문지기", 3, 4),
    eventNamed("ev_npc_merchant", "상인", 8, 2),
    eventNamed("ev_npc_guard_a", "경비", 1, 1),
    eventNamed("ev_npc_guard_b", "경비", 9, 9),
  ];
  store.replace(project);
  return project;
}

describe("이벤트 대상 카탈로그", () => {
  it("현재 맵 이벤트를 이름과 정본 id 로 함께 열거한다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    expect(catalog.entries.map((entry) => entry.id)).toEqual([
      "ev_npc_gate",
      "ev_npc_merchant",
      "ev_npc_guard_a",
      "ev_npc_guard_b",
    ]);
    expect(catalog.entries[0].name).toBe("문지기");
  });

  it("이름이 겹치는 이벤트는 좌표로 구분되는 라벨을 갖는다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    const guards = catalog.entries.filter((entry) => entry.name === "경비");
    expect(guards).toHaveLength(2);
    expect(guards[0].label).not.toBe(guards[1].label);
    expect(guards[0].label).toContain("경비");
    expect(guards[0].label).toContain("1");
    // 겹치지 않는 이름은 꾸미지 않는다.
    expect(catalog.entries[0].label).toBe("문지기");
  });

  it("특수값 둘의 저장 형태를 그대로 유지한다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    expect(THIS_EVENT_MOVE_TARGET).toBe("");
    expect(resolveMoveTarget("", catalog)).toMatchObject({ kind: "this", storedValue: "" });
    expect(resolveMoveTarget(PLAYER_MOVE_TARGET, catalog)).toMatchObject({
      kind: "player",
      storedValue: PLAYER_MOVE_TARGET,
    });
  });

  it("정본 id 는 항목과 함께 해석된다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    const resolved = resolveMoveTarget("ev_npc_merchant", catalog);
    expect(resolved.kind).toBe("event");
    if (resolved.kind !== "event") throw new Error("expected event target");
    expect(resolved.entry.name).toBe("상인");
    expect(resolved.storedValue).toBe("ev_npc_merchant");
  });

  it("«this» 같은 비정본 낱말을 이 이벤트 특수값으로 옮긴다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    for (const alias of ["this", "This", " self ", "@this"]) {
      expect(resolveMoveTarget(alias, catalog), alias).toMatchObject({ kind: "this", storedValue: "" });
      expect(canonicalMoveTargetValue(alias, catalog), alias).toBe("");
    }
    for (const alias of ["player", "주인공", "@Player"]) {
      expect(canonicalMoveTargetValue(alias, catalog), alias).toBe(PLAYER_MOVE_TARGET);
    }
  });

  it("유일한 표시 이름은 정본 id 로 옮기고, 겹치는 이름은 모호로 반려한다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    expect(canonicalMoveTargetValue("문지기", catalog)).toBe("ev_npc_gate");
    const ambiguous = resolveMoveTarget("경비", catalog);
    expect(ambiguous.kind).toBe("unresolved");
    if (ambiguous.kind !== "unresolved") throw new Error("expected unresolved");
    expect(ambiguous.reason).toBe("ambiguous");
    expect(ambiguous.candidates.map((entry) => entry.id)).toEqual(["ev_npc_guard_a", "ev_npc_guard_b"]);
    expect(canonicalMoveTargetValue("경비", catalog)).toBeNull();
  });

  it("다른 맵의 이벤트 id 는 남의 맵임을 지목한다(이동 경로는 현재 맵만 움직인다)", () => {
    const project = projectWithEvents();
    project.maps.map_far = {
      ...project.maps[project.startMapId],
      id: "map_far",
      name: "먼 마을",
      events: [eventNamed("ev_npc_far", "뱃사공", 2, 2)],
    };
    store.replace(project);
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    const resolved = resolveMoveTarget("ev_npc_far", catalog);
    expect(resolved.kind).toBe("unresolved");
    if (resolved.kind !== "unresolved") throw new Error("expected unresolved");
    expect(resolved.reason).toBe("foreignMap");
    expect(moveTargetIssueMessage("ev_npc_far", catalog)).toContain("먼 마을");
  });

  it("모르는 값은 실행 가능한 진단 문구를 낸다 — 특수값 둘과 후보 id 를 함께 말한다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    const message = moveTargetIssueMessage("ev_ghost", catalog);
    expect(message).toContain("ev_ghost");
    expect(message).toContain(PLAYER_MOVE_TARGET);
    expect(message).toContain("ev_npc_gate");
  });

  it("검색은 표시 이름과 id 를 모두 맞춘다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    expect(matchEventTargets(catalog, "상인").map((entry) => entry.id)).toEqual(["ev_npc_merchant"]);
    expect(matchEventTargets(catalog, "guard_b").map((entry) => entry.id)).toEqual(["ev_npc_guard_b"]);
    expect(matchEventTargets(catalog, "").map((entry) => entry.id)).toHaveLength(4);
    expect(matchEventTargets(catalog, "없는것")).toEqual([]);
  });

  it("프롬프트 절이 특수값 둘과 현재 맵 이벤트 목록을 함께 싣는다", () => {
    const project = projectWithEvents();
    const catalog = buildEventTargetCatalog(project, project.startMapId);
    const section = moveTargetPromptSection(catalog);
    expect(section).toContain(PLAYER_MOVE_TARGET);
    expect(section).toContain("ev_npc_gate");
    expect(section).toContain("문지기");
    // 실제로 났던 오작동을 이름으로 금지한다.
    expect(section).toContain("this");
  });
});

describe("조수 moveEvent 대상 검증", () => {
  it("프롬프트에 이동 대상 프로토콜 절이 들어간다", () => {
    const project = projectWithEvents();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId });
    expect(prompt).toContain("ev_npc_gate");
    expect(prompt).toContain(PLAYER_MOVE_TARGET);
  });

  it("«this» 대상을 적용 전에 이 이벤트 특수값으로 정본화한다", () => {
    const project = projectWithEvents();
    const result = parseAndValidate(
      project,
      JSON.stringify([{ kind: "moveEvent", eventId: "this", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } }]),
      { mapId: project.startMapId },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join(" / "));
    expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("");
  });

  it("이름으로 지목한 대상을 정본 id 로 옮긴다", () => {
    const project = projectWithEvents();
    const result = parseAndValidate(
      project,
      JSON.stringify([{ kind: "moveEvent", eventId: "상인", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } }]),
      { mapId: project.startMapId },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join(" / "));
    expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("ev_npc_merchant");
  });

  it("해석 불가 대상은 자가수정 루프가 읽을 오류로 반려한다", () => {
    const project = projectWithEvents();
    const result = parseAndValidate(
      project,
      JSON.stringify([{ kind: "moveEvent", eventId: "ev_does_not_exist", route: { moves: [], repeat: false } }]),
      { mapId: project.startMapId },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unresolved target must be rejected");
    expect(result.errors.join(" ")).toContain("moveEvent");
    expect(result.errors.join(" ")).toContain("ev_does_not_exist");
    expect(result.errors.join(" ")).toContain("ev_npc_gate");
  });

  it("중첩 분기 안의 대상도 검사한다", () => {
    const project = projectWithEvents();
    const nested = parseAndValidate(
      project,
      JSON.stringify([
        {
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [{ kind: "moveEvent", eventId: "this", route: { moves: [], repeat: false } }],
        },
      ]),
      { mapId: project.startMapId },
    );
    expect(nested.ok).toBe(true);
    if (!nested.ok) throw new Error(nested.errors.join(" / "));
    const fork = nested.commands[0] as Extract<Command, { kind: "fork" }>;
    expect((fork.then[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe("");
  });

  it("주인공 특수값은 그대로 통과한다", () => {
    const project = projectWithEvents();
    const result = parseAndValidate(
      project,
      JSON.stringify([
        { kind: "moveEvent", eventId: PLAYER_MOVE_TARGET, route: { moves: [{ kind: "move", dir: "up" }], repeat: false } },
      ]),
      { mapId: project.startMapId },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join(" / "));
    expect((result.commands[0] as Extract<Command, { kind: "moveEvent" }>).eventId).toBe(PLAYER_MOVE_TARGET);
  });
});

describe("테스트 플레이에서의 이동 대상", () => {
  function moverScene(project: Project) {
    const map = project.maps[project.startMapId];
    return {
      map,
      session: startSession(project),
      eventPositions: initialRuntimeEventPositions(map.events),
      autonomousNPCs: new Map(),
    };
  }

  it("정본 id 는 그 이벤트를 실제로 움직인다", () => {
    const project = projectWithEvents();
    const scene = moverScene(project);
    registerAutonomousMover(scene, "ev_npc_merchant", [{ kind: "move", dir: "up" }], false);
    expect(scene.autonomousNPCs.has("ev_npc_merchant")).toBe(true);
  });

  it("«this» 는 어떤 이벤트도 움직이지 않는다 — 이 결함이 보고된 증상이다", () => {
    const project = projectWithEvents();
    const scene = moverScene(project);
    registerAutonomousMover(scene, "this", [{ kind: "move", dir: "up" }], false);
    expect(scene.autonomousNPCs.size).toBe(0);
  });

  it("정본화를 거친 조수 출력은 테스트 플레이에서 대상을 움직인다", () => {
    const project = projectWithEvents();
    const parsed = parseAndValidate(
      project,
      JSON.stringify([
        { kind: "moveEvent", eventId: "상인", route: { moves: [{ kind: "move", dir: "up" }], repeat: false } },
      ]),
      { mapId: project.startMapId },
    );
    if (!parsed.ok) throw new Error(parsed.errors.join(" / "));
    const command = parsed.commands[0] as Extract<Command, { kind: "moveEvent" }>;
    const scene = moverScene(project);
    registerAutonomousMover(scene, command.eventId, command.route.moves, command.route.repeat);
    expect(scene.autonomousNPCs.has("ev_npc_merchant")).toBe(true);
  });
});
