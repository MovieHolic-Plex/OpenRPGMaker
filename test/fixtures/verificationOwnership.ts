import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent } from "@/project/types";
import type { SceneStep, SceneTestInput } from "@/testing/sceneTestRunner";

// Synthetic unit-test content, never an AI-authored game or player-proof fixture.
export function verificationEvent(id: string, x: number, y: number, commands: Command[], touch = false): GameEvent {
  const page: EventPage = { id: `${id}-page`, name: id, conditions: [], graphic: { transparent: true },
    trigger: { kind: touch ? "playerTouch" : "action" }, priority: touch ? "below" : "same", overlapForbidden: !touch,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
  return { id, name: id, x, y, trigger: page.trigger, commands: [], pages: [page] };
}

/**
 * 스펙 미지정(`args: null`) 요구를 만드는 선언.
 *
 * 예전에는 `successTools` 에 검증 툴만 적고 `verificationChecks` 를 비우면 하네스가 pending
 * 요구를 심었다. 그건 **하네스가 스스로 만든 해소 불가능한 요구**였다 — 실행도
 * `correct_verification` 도 반영되지 않아 `set_work_plan` 재선언 말고는 뚫을 수 없었고,
 * 2026-09-11 실 LLM 턴에서 gemini-3.8-flash 를 포함한 세 모델 모두 재선언하지 못했다.
 * 이제 그 경로는 요구를 만들지 않는다(assistantSession.adoptVerificationRequirements).
 *
 * 남은 pending 경로는 **모델이 직접 쓴 선언이 안 풀리는 경우**다. 그중 가장 단순한 것이
 * 채택되지 않은 승인 약속을 가리키는 criterion 참조다 — 스펙 미지정의 원자적 해소·위조 방지
 * 성질은 이 경로에서 그대로 유효하므로, 그 성질을 검증하는 픽스처는 이걸 쓴다.
 */
export function unboundCriterionCheck(tool: string, promiseId = "not-adopted-promise") {
  return { tool, criterion: { promiseId, criterionIndex: 0 } };
}

export function verificationJourney() {
  const project = createBlankProject();
  const village = project.maps[project.startMapId]!;
  village.events = [];
  village.encounterRate = 0;
  const cellar = { ...structuredClone(village), id: "cel_basement", name: "Cellar" };
  project.maps[cellar.id] = cellar;
  const keyId = project.database.items[0]!.id;
  project.session.inventory = {};
  project.session.gold = 37;
  const chest = verificationEvent("ev_brass_key_chest", 6, 2, [{ kind: "changeItem", itemId: keyId, op: "+=", amount: 1 }]);
  const chief = verificationEvent("ev_village_chief", 5, 7, []);
  const page = chief.pages![0]!;
  chief.pages = [page,
    { ...page, id: "reward", conditions: [{ kind: "item", itemId: keyId, present: true }], commands: [
      { kind: "changeItem", itemId: keyId, op: "-=", amount: 1 },
      { kind: "changeGold", op: "+=", amount: 20 },
    ] },
  ];
  village.events.push(chief, verificationEvent("to_cellar", 19, 7, [{ kind: "transfer", mapId: cellar.id, x: 6, y: 9 }], true));
  cellar.events.push(chest, verificationEvent("to_village", 6, 8, [{ kind: "transfer", mapId: village.id, x: 18, y: 7 }], true));
  const first: SceneStep[] = [
    { kind: "move", to: { x: 19, y: 7 } }, { kind: "move", to: { x: 6, y: 3 } },
    { kind: "interact", eventId: chest.id }, { kind: "move", to: { x: 6, y: 8 } },
    { kind: "move", to: { x: 5, y: 8 } }, { kind: "snapshotRewards" },
    { kind: "interact", eventId: chief.id }, { kind: "expect", interactionComplete: true, goldDelta: 20 },
  ];
  const repeated: SceneStep[] = [...first, { kind: "snapshotRewards" }, { kind: "interact", eventId: chief.id },
    { kind: "expect", interactionComplete: true, goldDelta: 0 }];
  const input = (steps: readonly SceneStep[]): SceneTestInput => ({ mapId: village.id, start: { x: 4, y: 6 }, steps });
  const face = (steps: readonly SceneStep[]): SceneStep[] => steps.flatMap(step => step.kind === "interact" ? [{ kind: "face", dir: "up" }, step] : [step]);
  return { project, village, cellar, chest, chief, input, wire171: input(first), wire180: input(repeated),
    corrected171: input(face(first)), wire181: input(face(repeated)) };
}

export function crossMapVerification() {
  const project = createBlankProject();
  const root = project.maps[project.startMapId]!;
  root.events = [];
  root.encounterRate = 0;
  for (const [id, gold] of [["mapA", 19], ["mapB", 20]] as const) {
    const map = { ...structuredClone(root), id, name: id, events: [
      verificationEvent("shared_npc", 2, 3, [{ kind: "changeGold", op: "+=", amount: gold }]),
      verificationEvent("exit", 4, 2, [{ kind: "transfer", mapId: root.id, x: 8, y: 8 }], true),
    ] };
    project.maps[id] = map;
  }
  root.events.push(verificationEvent("doorA", 3, 2, [{ kind: "transfer", mapId: "mapA", x: 2, y: 2 }], true),
    verificationEvent("doorB", 2, 3, [{ kind: "transfer", mapId: "mapB", x: 2, y: 2 }], true));
  const input = (to: { x: number; y: number }): SceneTestInput => ({ mapId: root.id, start: { x: 2, y: 2 }, steps: [
    { kind: "move", to }, { kind: "snapshotRewards" }, { kind: "interact", eventId: "shared_npc" },
    { kind: "move", to: { x: 4, y: 2 } }, { kind: "expect", goldDelta: 20, interactionComplete: true, mapId: root.id },
  ] });
  return { project, root, a: input({ x: 3, y: 2 }), b: input({ x: 2, y: 3 }) };
}
