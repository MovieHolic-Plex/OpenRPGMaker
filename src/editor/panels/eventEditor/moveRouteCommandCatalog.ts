import type { Dir, MapId, MoveCommand } from "@/project/types";

export type MoveRouteButton = {
  readonly label: string;
  readonly testId: string;
  // 커맨드 스캔용 유니코드 글리프. 라벨 텍스트와 분리해 CSS(attr)로만 그린다.
  readonly icon?: string;
  readonly createCommand: (context: MoveRouteCommandContext) => MoveCommand | null;
};

export type MoveRouteCommandContext = {
  readonly switchId: string;
  readonly spriteId: string;
  readonly soundId: string;
  readonly npcTargetMapId: MapId;
  readonly npcTargetX: number;
  readonly npcTargetY: number;
  readonly npcTargetDirection: Dir;
};

export const MOVE_ROUTE_COMMAND_ROWS: readonly (readonly MoveRouteButton[])[] = [
  [
    commandButton("위로 이동", "move-up", "↑", { kind: "move", dir: "up" }),
    commandButton("위로 향함", "turn-up", "△", { kind: "turn", dir: "up" }),
    commandButton("점프", "jump", "⤴", { kind: "jump", dx: 0, dy: 0 }),
  ],
  [
    commandButton("오른쪽으로 이동", "move-right", "→", { kind: "move", dir: "right" }),
    commandButton("오른쪽으로 향함", "turn-right", "▷", { kind: "turn", dir: "right" }),
    commandButton("착지", "land", "⤵", { kind: "land" }),
  ],
  [
    commandButton("아래로 이동", "move-down", "↓", { kind: "move", dir: "down" }),
    commandButton("아래로 향함", "turn-down", "▽", { kind: "turn", dir: "down" }),
    commandButton("방향 고정 ON", "direction-fix-on", "◉", { kind: "setDirectionFix", enabled: true }),
  ],
  [
    commandButton("왼쪽으로 이동", "move-left", "←", { kind: "move", dir: "left" }),
    commandButton("왼쪽으로 향함", "turn-left", "◁", { kind: "turn", dir: "left" }),
    commandButton("방향 고정 OFF", "direction-fix-off", "○", { kind: "setDirectionFix", enabled: false }),
  ],
  [
    commandButton("오른쪽 위로 이동", "move-upper-right", "↗", {
      kind: "moveDiagonal",
      horizontal: "right",
      vertical: "up",
    }),
    commandButton("오른쪽 90도 회전", "turn-90-right", "↻", { kind: "turnRelative", turn: "right90" }),
    commandButton("통과 ON", "through-on", "◉", { kind: "setThrough", enabled: true }),
  ],
  [
    commandButton("오른쪽 아래로 이동", "move-lower-right", "↘", {
      kind: "moveDiagonal",
      horizontal: "right",
      vertical: "down",
    }),
    commandButton("왼쪽 90도 회전", "turn-90-left", "↺", { kind: "turnRelative", turn: "left90" }),
    commandButton("통과 OFF", "through-off", "○", { kind: "setThrough", enabled: false }),
  ],
  [
    commandButton("왼쪽 아래로 이동", "move-lower-left", "↙", {
      kind: "moveDiagonal",
      horizontal: "left",
      vertical: "down",
    }),
    commandButton("180도 회전", "turn-180", "⇅", { kind: "turnRelative", turn: "turn180" }),
    commandButton("애니메이션 OFF", "animation-off", "○", { kind: "setAnimation", enabled: false }),
  ],
  [
    commandButton("왼쪽 위로 이동", "move-upper-left", "↖", {
      kind: "moveDiagonal",
      horizontal: "left",
      vertical: "up",
    }),
    commandButton("좌우 90도 회전", "turn-90-left-or-right", "⇄", {
      kind: "turnRelative",
      turn: "leftOrRight90",
    }),
    commandButton("애니메이션 ON", "animation-on", "◉", { kind: "setAnimation", enabled: true }),
  ],
  [
    commandButton("무작위로 이동", "move-random", "⤨", { kind: "moveRandom" }),
    commandButton("무작위로 향함", "turn-random", "⟳", { kind: "turnRandom" }),
    commandButton("불투명도 감소", "decrease-opacity", "−", { kind: "changeOpacity", delta: -64 }),
  ],
  [
    commandButton("플레이어 쪽으로 이동", "move-toward-player", "◎", { kind: "moveTowardPlayer" }),
    commandButton("플레이어 쪽으로 향함", "turn-toward-player", "⊙", { kind: "turnTowardPlayer" }),
    commandButton("불투명도 증가", "increase-opacity", "＋", { kind: "changeOpacity", delta: 64 }),
  ],
  [
    commandButton("플레이어에게서 멀어짐", "move-away-from-player", "⇠", { kind: "moveAwayFromPlayer" }),
    commandButton("플레이어 반대로 향함", "turn-away-from-player", "⊘", { kind: "turnAwayFromPlayer" }),
    contextCommandButton("스위치 ON...", "switch-on", "⚑", (context) => ({
      kind: "setSwitch",
      switchId: context.switchId,
      value: true,
    })),
  ],
  [
    commandButton("한 걸음 전진", "step-forward", "⇢", { kind: "stepForward" }),
    commandButton("대기", "wait", "⏸", { kind: "wait" }),
    contextCommandButton("스위치 OFF...", "switch-off", "⚐", (context) => ({
      kind: "setSwitch",
      switchId: context.switchId,
      value: false,
    })),
  ],
  [
    commandButton("속도 증가", "increase-speed", "＋", { kind: "changeSpeed", delta: 1 }),
    commandButton("빈도 증가", "increase-frequency", "＋", { kind: "changeFrequency", delta: 1 }),
    contextCommandButton("그래픽 변경...", "change-graphic", "▣", (context) => ({
      kind: "changeGraphic",
      spriteId: context.spriteId,
    })),
  ],
  [
    commandButton("속도 감소", "decrease-speed", "−", { kind: "changeSpeed", delta: -1 }),
    commandButton("빈도 감소", "decrease-frequency", "−", { kind: "changeFrequency", delta: -1 }),
    contextCommandButton("효과음 재생...", "play-se", "♪", (context) => ({
      kind: "playSe",
      resourceId: context.soundId,
    })),
    contextCommandButton("NPC 맵 이동...", "npc-transfer", "✦", (context) => ({
      kind: "npcTransfer",
      mapId: context.npcTargetMapId,
      x: context.npcTargetX,
      y: context.npcTargetY,
      direction: context.npcTargetDirection,
    })),
  ],
];

// 방향 이동 9버튼(상하좌우/대각/전진): 아이콘 색 강조 대상.
export const DIRECTIONAL_MOVE_TEST_IDS: ReadonlySet<string> = new Set([
  "move-up",
  "move-right",
  "move-down",
  "move-left",
  "move-upper-right",
  "move-lower-right",
  "move-lower-left",
  "move-upper-left",
  "step-forward",
]);

export function moveCommandLabel(command: MoveCommand): string {
  switch (command.kind) {
    case "move":
      return `${dirLabel(command.dir)} 이동`;
    case "moveDiagonal":
      return `${dirLabel(command.horizontal)} ${dirLabel(command.vertical)} 이동`;
    case "moveRandom":
      return "무작위 이동";
    case "moveTowardPlayer":
      return "플레이어 쪽 이동";
    case "moveAwayFromPlayer":
      return "플레이어에게서 멀어짐";
    case "stepForward":
      return "한 걸음 전진";
    case "jump":
      return command.dx === 0 && command.dy === 0 ? "점프" : `점프 (${command.dx}, ${command.dy})`;
    case "land":
      return "착지";
    case "turn":
      return `${dirLabel(command.dir)} 향함`;
    case "turnRelative":
      return relativeTurnLabel(command.turn);
    case "turnRandom":
      return "무작위로 향함";
    case "turnTowardPlayer":
      return "플레이어 쪽으로 향함";
    case "turnAwayFromPlayer":
      return "플레이어 반대로 향함";
    case "setDirectionFix":
      return `방향 고정 ${onOff(command.enabled)}`;
    case "setThrough":
      return `통과 ${onOff(command.enabled)}`;
    case "setAnimation":
      return `애니메이션 ${onOff(command.enabled)}`;
    case "changeOpacity":
      return command.delta < 0 ? "불투명도 감소" : "불투명도 증가";
    case "setSwitch":
      return `스위치 ${command.switchId} ${onOff(command.value)}`;
    case "changeSpeed":
      return command.delta < 0 ? "속도 감소" : "속도 증가";
    case "changeFrequency":
      return command.delta < 0 ? "빈도 감소" : "빈도 증가";
    case "changeGraphic":
      return `그래픽 ${command.spriteId}`;
    case "npcTransfer":
      return `NPC 맵 이동 ${command.mapId} (${command.x}, ${command.y})`;
    case "playSe":
      return `효과음 ${command.resourceId}`;
    case "wait":
      return "대기";
  }
}

function commandButton(label: string, testId: string, icon: string, command: MoveCommand): MoveRouteButton {
  return { label, testId, icon, createCommand: () => command };
}

function contextCommandButton(
  label: string,
  testId: string,
  icon: string,
  createCommand: (context: MoveRouteCommandContext) => MoveCommand
): MoveRouteButton {
  return {
    label,
    testId,
    icon,
    createCommand: (context) => {
      const command = createCommand(context);
      if (command.kind === "setSwitch" && command.switchId.trim().length === 0) return null;
      if (command.kind === "changeGraphic" && command.spriteId.trim().length === 0) return null;
      if (command.kind === "npcTransfer" && command.mapId.trim().length === 0) return null;
      if (command.kind === "playSe" && command.resourceId.trim().length === 0) return null;
      return command;
    },
  };
}

function dirLabel(dir: "left" | "right" | "up" | "down"): string {
  switch (dir) {
    case "up":
      return "위";
    case "down":
      return "아래";
    case "left":
      return "왼쪽";
    case "right":
      return "오른쪽";
  }
}

function relativeTurnLabel(turn: Extract<MoveCommand, { kind: "turnRelative" }>["turn"]): string {
  switch (turn) {
    case "right90":
      return "오른쪽 90도 회전";
    case "left90":
      return "왼쪽 90도 회전";
    case "turn180":
      return "180도 회전";
    case "leftOrRight90":
      return "좌우 90도 회전";
  }
}

function onOff(value: boolean): string {
  return value ? "ON" : "OFF";
}
