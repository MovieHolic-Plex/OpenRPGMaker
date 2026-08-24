import {
  HORROR_MYSTERY_ENDING_IDS,
  HORROR_MYSTERY_ITEM_ID,
  HORROR_MYSTERY_MAP_IDS,
  HORROR_MYSTERY_SWITCH_IDS,
  type HorrorMysteryPrototypeManifest,
} from "@/project/examples/horrorMysteryPrototype";
import type { Command, Project } from "@/project/types";
import type { HorrorQaScenario } from "@/testing/horrorExperienceQa";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hasTransferTo(commands: readonly Command[], mapId: string): boolean {
  return commands.some((command) => {
    if (command.kind === "transfer") return command.mapId === mapId;
    if (command.kind === "choices") {
      return command.options.some((option) => hasTransferTo(option.branch, mapId))
        || Boolean(command.cancelBranch && hasTransferTo(command.cancelBranch, mapId));
    }
    if (command.kind === "fork") {
      return hasTransferTo(command.then, mapId)
        || Boolean(command.else && hasTransferTo(command.else, mapId));
    }
    if (command.kind === "loop") return hasTransferTo(command.body, mapId);
    return false;
  });
}

export function createHorrorMysteryQaScenarios(
  project: Project,
  manifest: HorrorMysteryPrototypeManifest,
): HorrorQaScenario[] {
  const galleryExit = project.maps[HORROR_MYSTERY_MAP_IDS.gallery]?.events.find(
    (event) => event.id === manifest.gallery.exitEventId,
  ) ?? project.maps[HORROR_MYSTERY_MAP_IDS.gallery]?.events.find((event) =>
    hasTransferTo(event.commands, HORROR_MYSTERY_MAP_IDS.chase)
      || (event.pages ?? []).some((page) => hasTransferTo(page.commands, HORROR_MYSTERY_MAP_IDS.chase)),
  );
  invariant(galleryExit, "gallery exit event is required for QA");
  const chaseExit = project.maps[HORROR_MYSTERY_MAP_IDS.chase]?.events.find(
    (event) => event.id === manifest.chase.exitEventId,
  ) ?? project.maps[HORROR_MYSTERY_MAP_IDS.chase]?.events.find((event) =>
    hasTransferTo(event.commands, HORROR_MYSTERY_MAP_IDS.finale)
      || (event.pages ?? []).some((page) => hasTransferTo(page.commands, HORROR_MYSTERY_MAP_IDS.finale)),
  );
  invariant(chaseExit, "chase exit event is required for QA");
  const [left, center, right] = manifest.gallery.sequenceAt;
  invariant(left && center && right, "three sequence nodes are required for QA");
  const trap = manifest.chase.trapAt[1] ?? manifest.chase.trapAt[0];
  invariant(trap, "at least one chase trap is required for QA");
  const trapStart = { x: trap.x - 1, y: trap.y };
  const chaseStart = { x: manifest.chase.chaserAt.x - 2, y: manifest.chase.chaserAt.y };

  return [
    {
      id: "locked-gate-feedback",
      label: "열쇠 없이 잠긴 복원 도구함을 조사하면 진행되지 않는다",
      role: "locked-gate-feedback",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.gallery,
        start: manifest.gallery.itemGateAt,
        steps: [
          { kind: "interact" },
          {
            kind: "expect",
            switchOff: HORROR_MYSTERY_SWITCH_IDS.keyUsed,
            inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 0 },
          },
        ],
      },
    },
    {
      id: "wrong-answer-recovery",
      label: "액자 순서를 틀려도 초기화 후 정답으로 복구할 수 있다",
      role: "wrong-answer-recovery",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.gallery,
        start: left,
        steps: [
          { kind: "interact" },
          { kind: "set", x: center.x, y: center.y },
          { kind: "interact" },
          { kind: "set", x: left.x, y: left.y },
          { kind: "interact" },
          { kind: "set", x: right.x, y: right.y },
          { kind: "interact" },
          { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.sequenceSolved },
        ],
      },
    },
    {
      id: "critical-path",
      label: "열쇠와 액자 순서를 해결하고 추격 구간을 지나 복원실로 이동한다",
      role: "critical-path",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.gallery,
        start: manifest.gallery.keyAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 1 } },
          { kind: "set", x: manifest.gallery.itemGateAt.x, y: manifest.gallery.itemGateAt.y },
          { kind: "interact" },
          {
            kind: "expect",
            switchOn: HORROR_MYSTERY_SWITCH_IDS.keyUsed,
            inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 0 },
          },
          { kind: "set", x: center.x, y: center.y },
          { kind: "interact" },
          { kind: "set", x: left.x, y: left.y },
          { kind: "interact" },
          { kind: "set", x: right.x, y: right.y },
          { kind: "interact" },
          { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.sequenceSolved },
          { kind: "set", x: galleryExit.x, y: galleryExit.y - 1 },
          { kind: "move", dir: "down" },
          { kind: "expect", mapId: HORROR_MYSTERY_MAP_IDS.chase },
          { kind: "set", x: chaseExit.x - 1, y: chaseExit.y },
          { kind: "move", dir: "right" },
          { kind: "expect", mapId: HORROR_MYSTERY_MAP_IDS.finale },
        ],
      },
    },
    {
      id: "trap-death-retry",
      label: "함정 사망 후 진입 체크포인트에서 재시도한다",
      role: "trap-death-retry",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.chase,
        start: trapStart,
        steps: [
          { kind: "move", dir: "right" },
          { kind: "expect", gameOver: true },
          { kind: "retryCheckpoint" },
          {
            kind: "expect",
            gameOver: false,
            playerAt: { ...trapStart, mapId: HORROR_MYSTERY_MAP_IDS.chase },
          },
        ],
      },
    },
    {
      id: "chaser-death-retry",
      label: "추격자에게 붙잡힌 뒤 같은 체크포인트에서 재시도한다",
      role: "chaser-death-retry",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.chase,
        start: chaseStart,
        steps: [
          { kind: "wait", ticks: 140 },
          { kind: "expect", gameOver: true },
          { kind: "retryCheckpoint" },
          {
            kind: "expect",
            gameOver: false,
            playerAt: { ...chaseStart, mapId: HORROR_MYSTERY_MAP_IDS.chase },
          },
        ],
      },
    },
    {
      id: "truth-ending",
      label: "진실 단서를 읽고 복원 엔딩에 도달한다",
      role: "truth-ending",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.finale,
        start: manifest.finale.truthAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.truthHeard },
          { kind: "set", x: manifest.finale.truthEndingAt.x, y: manifest.finale.truthEndingAt.y },
          { kind: "interact" },
          { kind: "expect", endingReached: HORROR_MYSTERY_ENDING_IDS.truth },
        ],
      },
    },
    {
      id: "alternate-ending",
      label: "진실을 외면하고 탈출 엔딩에 도달한다",
      role: "alternate-ending",
      input: {
        mapId: HORROR_MYSTERY_MAP_IDS.finale,
        start: manifest.finale.escapeEndingAt,
        steps: [
          { kind: "interact" },
          { kind: "expect", endingReached: HORROR_MYSTERY_ENDING_IDS.escape },
        ],
      },
    },
  ];
}
