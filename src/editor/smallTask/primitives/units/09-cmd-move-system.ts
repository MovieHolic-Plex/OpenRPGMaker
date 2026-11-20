import { newCommand } from "@/editor/eventCommandFactory";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { transferDirectionLabel, transferFadeLabel } from "@/editor/panels/eventEditor/transferPlayerDialog";
import { runResultLabel } from "@/editor/panels/eventEditor/options";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { getTileset, inBounds, isPassableLanding } from "@/project/collision";
import { difficultiesOf, difficultyDisplayName } from "@/project/difficulty";
import {
  EventCommandEditError, deleteEventCommand, eventCommandHash, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { gameOverName } from "@/project/gameOverLibrary";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { roguelikeRoomId } from "@/project/roguelikeRooms";
import { ROGUELIKE_FLOOR_MAX } from "@/project/roguelikeRun";
import type { Command, EventPage, GameMap } from "@/project/types";
import { commandListAt, eventName, koreanSentence, mapName, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "09-cmd-move-system";

type Args = Record<string, unknown>;
type Edit = "insert" | "update";
type Spec = {
  title: string;
  fields?: Record<string, JsonSchema>;
  requiredOnInsert?: string[];
};

const text = (description: string): JsonSchema => ({ type: "string", description });
const reference = (description: string): JsonSchema => ({ type: "string", minLength: 1, description });
const integer = (description: string, minimum?: number, maximum?: number): JsonSchema => ({
  type: "integer", description,
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
});
const choice = (description: string, values: readonly string[]): JsonSchema => ({
  type: "string", enum: values, description,
});
const toggle = (description: string): JsonSchema => ({ type: "boolean", description });

const directions = ["up", "right", "down", "left"] as const;
const position = { x: integer("가로 칸 좌표, 첫 칸은 0", 0), y: integer("세로 칸 좌표, 첫 칸은 0", 0) };
const eventId = text("실행할 때 움직이거나 모습을 바꿀 같은 맵 이벤트의 식별자. 빈 값은 이 이벤트");
const gameOverId = text("등록된 게임 오버 연출의 식별자. 빈 값은 프로젝트 기본 연출");
const endingFields = {
  tone: choice("엔딩 분위기. 따뜻함 또는 어두움", ["warm", "dark"]),
  credits: text("엔딩에 표시할 제작진 문구"),
  musicResourceId: text("등록된 배경음악의 식별자. 빈 값은 음악 지정 해제"),
  backgroundResourceId: text("등록된 배경 그림의 식별자. 빈 값은 배경 지정 해제"),
};
const runModes = {
  start: ["seed", "runId", "startFloor"],
  advance: ["amount"],
  end: ["result"],
  setFlag: ["flag", "value"],
  resetRoom: ["roomId"],
} as const;

const specs = {
  transfer: {
    title: "장소 이동",
    fields: {
      mapId: reference("목적지 맵 식별자"), ...position,
      direction: choice("도착할 때 바라볼 방향. 유지, 위, 오른쪽, 아래, 왼쪽", ["retain", ...directions]),
      fade: choice("화면 전환 색. 검정, 흰색, 없음", ["black", "white", "none"]),
      transition: choice("화면 전환 방식. 서서히, 모자이크, 블라인드", ["fade", "mosaic", "blinds"]),
      door: toggle("문이 열리는 연출 사용 여부. 생략하면 자동"),
    },
    requiredOnInsert: ["mapId", "x", "y"],
  },
  moveEvent: {
    title: "이동 경로 설정",
    fields: {
      eventId: text("같은 맵 이벤트 식별자. 빈 값은 이 이벤트, @player는 주인공"),
      direction: choice("걸어갈 방향. 위, 오른쪽, 아래, 왼쪽", directions),
      steps: integer("같은 방향으로 걷는 칸 수", 1, 100),
      wait: toggle("걷기가 끝날 때까지 다음 명령 대기"),
      repeat: toggle("이동 경로 반복"),
      skippable: toggle("막힌 걸음 건너뛰기"),
    },
  },
  setEventGraphicPattern: {
    title: "모습 바꾸기",
    fields: { eventId, pattern: integer("모습 번호. 첫 모습은 0", 0, Number.MAX_SAFE_INTEGER - 1) },
  },
  changeTile: {
    title: "타일 변경",
    fields: {
      mapId: reference("게임에서 타일이 바뀔 맵 식별자. 생략하면 이 이벤트가 있는 맵"), ...position,
      layer: choice("타일 층. 바닥 1층, 바닥 2층, 위 3층, 위 4층", ["lower", "lower2", "upper", "upper2"]),
      tile: integer("대상 타일셋의 타일 번호. 비우려면 -1", -1, Number.MAX_SAFE_INTEGER),
    },
    requiredOnInsert: ["x", "y", "tile"],
  },
  checkpointSave: { title: "체크포인트 저장", fields: { label: text("체크포인트 이름") } },
  killPlayer: { title: "즉사", fields: { message: text("즉사할 때 표시하는 문구"), gameOverId } },
  triggerEnding: { title: "등록 엔딩 실행", fields: { endingId: text("등록된 엔딩 식별자. 빈 값은 조건에 맞는 엔딩 자동 선택") } },
  gameOver: { title: "게임 오버", fields: { gameOverId } },
  ending: {
    title: "엔딩 화면",
    fields: { title: text("엔딩 제목"), message: text("엔딩 본문"), ...endingFields },
  },
  returnToTitle: { title: "타이틀로 돌아가기" },
  openSaveMenu: { title: "저장 메뉴 열기" },
  runControl: {
    title: "탐험 진행",
    fields: {
      mode: choice("탐험 조작. 시작, 층 이동, 종료, 기억 설정, 방 초기화", Object.keys(runModes)),
      seed: integer("탐험을 시작할 때 쓰는 난수 시드", 0, 0xffff_ffff),
      runId: reference("시작하는 탐험 기록의 이름"),
      startFloor: integer("탐험 시작 층", 1, ROGUELIKE_FLOOR_MAX),
      amount: integer("올라갈 층 수", 1, ROGUELIKE_FLOOR_MAX),
      result: choice("탐험 결과. 완료, 실패, 포기", ["completed", "failed", "abandoned"]),
      flag: reference("설정할 탐험 기억의 이름"),
      value: toggle("탐험 기억을 켜거나 끄기"),
      roomId: reference("초기화할 방의 식별자. 생략하면 현재 방"),
    },
  },
  setDifficulty: {
    title: "난이도 변경",
    fields: { difficultyId: reference("등록된 난이도 식별자") },
    requiredOnInsert: ["difficultyId"],
  },
} satisfies Record<string, Spec>;

type Kind = keyof typeof specs;
type Move = Extract<Command, { kind: "moveEvent" }>;
type Run = Extract<Command, { kind: "runControl" }>;

function resolveEdit(page: EventPage, args: Args, kind: Kind, edit: Edit) {
  const branchPath = (args.branchPath ?? []) as number[];
  const list = commandListAt(page, branchPath);
  const index = args.index as number | undefined ?? list.length;
  if (!Number.isSafeInteger(index) || index < 0 || index > list.length || (edit === "update" && index === list.length)) {
    throw new PrimitiveError("고를 수 있는 명령 줄이 없습니다.");
  }
  const path = [...branchPath, index];
  const current = edit === "update" ? list[index] : undefined;
  if (edit === "update" && current?.kind !== kind) throw new PrimitiveError("선택한 줄에서 같은 종류의 명령을 고르세요.");
  return { path, current };
}

function moveRoute(base: Move, fields: Args): Move {
  const { direction, steps, wait, repeat, skippable, ...target } = fields;
  let moves = base.route.moves;
  if (direction !== undefined || steps !== undefined) {
    const first = moves[0];
    const straight = first?.kind === "move" && moves.every(move => move.kind === "move" && move.dir === first.dir);
    if (!straight && direction === undefined) throw new PrimitiveError("걸음 수를 바꾸려면 방향도 지정하세요.");
    const dir = (direction ?? (first?.kind === "move" ? first.dir : "right")) as (typeof directions)[number];
    moves = Array.from({ length: (steps ?? (straight ? moves.length : 1)) as number }, () => ({ kind: "move", dir }));
  }
  return {
    ...base, ...target,
    route: {
      ...base.route, moves,
      ...(wait === undefined ? {} : { wait: wait as boolean }),
      ...(repeat === undefined ? {} : { repeat: repeat as boolean }),
      ...(skippable === undefined ? {} : { skippable: skippable as boolean }),
    },
  };
}

function runControl(base: Run, { mode, ...fields }: Args): Run {
  const action = (mode ?? base.action) as Run["action"];
  const allowed: readonly string[] = runModes[action];
  if (Object.keys(fields).some(key => !allowed.includes(key))) throw new PrimitiveError("선택한 탐험 조작에 맞는 값만 입력하세요.");
  const current = base.action === action ? base : { kind: "runControl", action };
  const command = { ...current, ...fields } as Run;
  if (command.action === "end" && command.result === undefined) throw new PrimitiveError("탐험을 어떻게 끝낼지 골라 주세요.");
  if (command.action === "setFlag" && (!command.flag?.trim() || command.value === undefined)) {
    throw new PrimitiveError("탐험 기억의 이름과 켜짐 또는 꺼짐을 입력하세요.");
  }
  return command;
}

function buildCommand(kind: Kind, source: GameMap, args: Args, current?: Command): Command {
  const { index, branchPath, expectedHash, ...fields } = args;
  const base = current ?? newCommand(kind);
  switch (base.kind) {
    case "moveEvent":
      return moveRoute(base, fields);
    case "runControl":
      return runControl(base, fields);
    case "ending": {
      const { title, message, ...presentation } = fields;
      const defaults = current?.kind === "ending" ? current : { title: "끝", message: "플레이해 주셔서 감사합니다." };
      return {
        ...base, title: (title ?? defaults.title) as string, message: (message ?? defaults.message) as string,
        ...(Object.keys(presentation).length ? { presentation: { ...base.presentation, ...presentation } } : {}),
      };
    }
    case "setEventGraphicPattern": {
      const command = { ...base, ...fields };
      if (command.eventId === "this") command.eventId = "";
      return command;
    }
    case "changeTile":
      return { ...base, mapId: base.mapId || source.id, ...fields };
    case "gameOver":
    case "killPlayer": {
      const command = { ...base, ...fields };
      if (command.gameOverId === "") delete command.gameOverId;
      return command;
    }
    case "triggerEnding": {
      const command = { ...base, ...fields };
      if (command.endingId === "") delete command.endingId;
      return command;
    }
    default:
      return { ...base, ...fields };
  }
}

const empty = new Set<string>();

function validateReferences({ project }: PrimitiveContext, source: GameMap, command: Command): void {
  const { kind } = command;
  const endPresentation = kind === "ending" ? command.presentation : undefined;
  const context: ReferenceContext = {
    actorIds: empty, classIds: empty, enemyIds: empty, itemIds: empty, equipmentIds: empty,
    skillIds: empty, animationIds: empty, switchIds: empty, variableIds: empty,
    commonEventIds: empty, troopIds: empty, speciesIds: empty,
    mapIds: new Set(Object.keys(project.maps)),
    endingIds: new Set(project.endings?.map(row => row.id)),
    gameOverIds: new Set(project.system.gameOvers?.map(row => row.id)),
    resourceIds: endPresentation?.musicResourceId || endPresentation?.backgroundResourceId ? collectResourceIds(project) : empty,
  };
  try {
    validateCommands([command], context);
  } catch {
    if (kind === "transfer" || kind === "changeTile") throw new PrimitiveError("목적지 맵을 찾을 수 없습니다.");
    if (kind === "triggerEnding") throw new PrimitiveError("등록된 엔딩을 찾을 수 없습니다.");
    if (kind === "killPlayer" || kind === "gameOver") throw new PrimitiveError("등록된 게임 오버 연출을 찾을 수 없습니다.");
    throw new PrimitiveError("엔딩에 사용할 그림이나 음악을 찾을 수 없습니다.");
  }

  if (kind === "transfer" || kind === "changeTile") {
    const map = project.maps[command.mapId]!;
    if (!Number.isSafeInteger(command.x) || !Number.isSafeInteger(command.y) || !inBounds(map, command.x, command.y)) {
      throw new PrimitiveError("지정한 칸을 맵에서 찾을 수 없습니다.");
    }
    if (kind === "transfer" && !isPassableLanding(project, map, command.x, command.y)) {
      throw new PrimitiveError("도착 칸에서 걸어 나갈 수 없습니다.");
    }
    if (kind === "changeTile" && command.tile !== -1 && command.tile >= (getTileset(project, map)?.count ?? 0)) {
      throw new PrimitiveError("대상 맵의 타일셋에서 그 타일을 찾을 수 없습니다.");
    }
  } else if (kind === "moveEvent" || kind === "setEventGraphicPattern") {
    const id = command.eventId;
    const self = !id;
    if (!self && !(kind === "moveEvent" && id === PLAYER_MOVE_TARGET) && !source.events.some(event => event.id === id)) {
      throw new PrimitiveError("이 맵에서 대상 이벤트를 찾을 수 없습니다.");
    }
  } else if (kind === "runControl" && command.action === "resetRoom" && command.roomId !== undefined
      && !Object.values(project.maps).some(map => roguelikeRoomId(map) === command.roomId)) {
    throw new PrimitiveError("초기화할 방을 찾을 수 없습니다.");
  } else if (kind === "setDifficulty" && !difficultiesOf(project.system).some(row => row.id === command.difficultyId)) {
    throw new PrimitiveError("등록된 난이도를 찾을 수 없습니다.");
  }
}

function safeName(name: string, fallback: string, id?: string): string {
  const visible = displayText(name === id ? "" : name, fallback).replace(/[{}\[\].!?。！？]/gu, "").trim() || fallback;
  return visible.length > 30 ? visible.slice(0, 29) + "…" : visible;
}

function describeCommand({ project }: PrimitiveContext, map: GameMap, command: Command, title: string): string {
  const targetName = (id: string) => {
    if (!id) return "이 이벤트";
    if (id === PLAYER_MOVE_TARGET) return "주인공";
    const event = map.events.find(row => row.id === id);
    return safeName(event ? eventName(event) : "", "선택한 이벤트", id);
  };
  switch (command.kind) {
    case "transfer":
    case "changeTile": {
      const dest = project.maps[command.mapId];
      const name = safeName(dest ? mapName(dest) : "", "선택한 맵", command.mapId);
      const position = `『${name}』의 (${command.x}, ${command.y}) 칸`;
      if (command.kind === "changeTile") return `${position}의 타일을 바꿉니다.`;
      const direction = command.direction && command.direction !== "retain" ? `${transferDirectionLabel(command.direction)} 방향을 보며 ` : "";
      const fade = command.fade === "none" ? "화면 효과 없이 " : command.fade === "white" ? `${transferFadeLabel(command.fade)} 화면 효과로 ` : "";
      return `${position}으로 ${direction}${fade}이동합니다.`;
    }
    case "moveEvent": {
      const { moves } = command.route;
      const first = moves[0];
      const name = targetName(command.eventId);
      if (first?.kind === "move" && moves.every(move => move.kind === "move" && move.dir === first.dir)) {
        return `${name}에서 ${transferDirectionLabel(first.dir)} 방향으로 ${moves.length}칸 걷는 경로를 설정합니다.`;
      }
      return `${name}에 ${moves.length}단계 이동 경로를 적용합니다.`;
    }
    case "setEventGraphicPattern":
      return `${targetName(command.eventId)}에 ${command.pattern + 1}번째 모습을 표시합니다.`;
    case "checkpointSave":
      return `${command.label ? `『${safeName(command.label, "체크포인트")}』에 진행을 저장합니다.` : "체크포인트에 진행을 저장합니다."}`;
    case "killPlayer":
    case "gameOver": {
      const name = safeName(gameOverName(project, command.gameOverId), "게임 오버", command.gameOverId);
      return command.kind === "killPlayer" ? `파티가 즉사하고 『${name}』 연출을 실행합니다.` : `『${name}』 게임 오버 연출을 실행합니다.`;
    }
    case "triggerEnding": {
      const ending = project.endings?.find(row => row.id === command.endingId);
      return ending ? `『${safeName(ending.name, "등록 엔딩", ending.id)}』 엔딩을 실행합니다.` : "조건에 맞는 엔딩을 실행합니다.";
    }
    case "ending":
      return `『${safeName(command.title, "엔딩")}』 엔딩 화면을 표시합니다.`;
    case "runControl":
      switch (command.action) {
        case "start": return `${command.startFloor ?? 1}층에서 탐험을 시작합니다.`;
        case "advance": return `탐험을 ${command.amount ?? 1}층 진행합니다.`;
        case "end": return `탐험을 ${runResultLabel(command.result)}로 끝냅니다.`;
        case "setFlag": return command.value ? "탐험의 지정된 기억을 켭니다." : "탐험의 지정된 기억을 끕니다.";
        case "resetRoom": return command.roomId ? "탐험의 지정된 방을 초기화합니다." : "탐험의 현재 방을 초기화합니다.";
      }
    case "setDifficulty":
      return `난이도를 『${safeName(difficultyDisplayName(project.system, command.difficultyId), "선택한 난이도", command.difficultyId)}』로 바꿉니다.`;
    case "returnToTitle": return `${commandSummary(command)} 돌아갑니다.`;
    case "openSaveMenu": return "저장 메뉴를 엽니다.";
    default: return `${title} 명령을 실행합니다.`;
  }
}

function primitive(kind: Kind, spec: Spec, edit: Edit): SmallTaskPrimitive {
  const required = edit === "insert" ? spec.requiredOnInsert ?? [] : ["index"];
  const properties = {
    index: integer(edit === "insert" ? "끼워 넣을 줄. 첫 줄은 0, 생략하면 마지막에 추가" : "고칠 줄. 첫 줄은 0", 0),
    branchPath: { type: "array", items: integer("분기 경로 번호"), description: "중첩된 명령 목록의 분기 경로. 바깥 목록이면 생략" },
    ...(edit === "update" ? { expectedHash: reference("미리 읽은 명령 줄의 확인값. 생략하면 현재 줄을 기준으로 수정") } : {}),
    ...spec.fields,
  } satisfies Record<string, JsonSchema>;
  return {
    id: `cmd.${kind}.${edit}`,
    unit: UNIT,
    title: `${spec.title} ${edit === "insert" ? "추가" : "수정"}`,
    covers: { commandKinds: [kind] },
    ...(edit === "update" && !spec.fields ? { hidden: true } : {}),
    targets: ["event"],
    args: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
    scope(ctx) {
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { map, page } = scopedPage(ctx);
      const { current } = resolveEdit(page, args, kind, edit);
      return koreanSentence(describeCommand(ctx, map, buildCommand(kind, map, args, current), spec.title));
    },
    apply(ctx, args) {
      const { map, page } = scopedPage(ctx);
      const { path, current } = resolveEdit(page, args, kind, edit);
      const command = buildCommand(kind, map, args, current);
      validateReferences(ctx, map, command);
      let edited: EventPage;
      try {
        const hash = current ? args.expectedHash as string | undefined ?? eventCommandHash(current) : "";
        if (!current) {
          edited = insertEventCommand(page, path, command);
        } else if (Object.keys(current).some(key => !Object.hasOwn(command, key))) {
          // Removing an optional field or changing the run variant replaces this one row.
          edited = insertEventCommand(deleteEventCommand(page, path, hash), path, command);
        } else {
          edited = updateEventCommand(page, path, command, hash);
        }
      } catch (error) {
        if (!(error instanceof EventCommandEditError)) throw error;
        const message = error.code === "stale-event-command" ? error.message : "명령 값이나 줄 위치를 다시 확인하세요.";
        throw new PrimitiveError(message);
      }
      return updateScopedPage(ctx, () => edited);
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(specs) as Kind[])
  .flatMap(kind => [primitive(kind, specs[kind], "insert"), primitive(kind, specs[kind], "update")]);
