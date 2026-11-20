import { listAudioResources } from "@/assets/audioResourceCatalog";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import type { JsonSchema } from "@/editor/tools/types";
import { MAX_HOP_DURATION_MS, MAX_HOP_LIFT_PX, MIN_HOP_DURATION_MS } from "@/player/characterHop";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { inBounds } from "@/project/collision";
import { validateMoveRoute } from "@/project/io/shapeCommandFields";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { EventPage, EventPageMovement, GameEvent, GameMap, MoveCommand, MoveRoute, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

export const DIRECTION_LABELS = { up: "위", down: "아래", left: "왼쪽", right: "오른쪽" } as const;
export const DIRECTION_SCHEMA: JsonSchema = {
  type: "string", enum: Object.keys(DIRECTION_LABELS), description: "위, 아래, 왼쪽, 오른쪽 중 한 방향",
};

export function objectArgs(properties: Record<string, JsonSchema>, required: readonly string[]): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

const x: JsonSchema = { type: "integer", minimum: 0, description: "대상 칸의 가로 좌표" };
const y: JsonSchema = { type: "integer", minimum: 0, description: "대상 칸의 세로 좌표" };
const nonBlankId = { type: "string", pattern: "\\S" } as const;
const optionalId = { type: "string", pattern: "^(?:$|.*\\S.*)$" } as const;
const target: JsonSchema = { ...optionalId, description: "이 맵에서 찾은 이벤트 또는 주인공. 좌표를 쓰면 생략하거나 비워 둠" };
const door: JsonSchema = { ...nonBlankId, description: "이 맵에서 찾은 문 이벤트" };
const se: JsonSchema = { ...nonBlankId, description: "프로젝트에서 찾은 효과음" };
const doorSound: JsonSchema = { ...optionalId, description: "프로젝트에서 찾은 효과음. 빈 문자열이면 소리 없이 실행" };
const heightPx: JsonSchema = { type: "integer", minimum: 1, maximum: MAX_HOP_LIFT_PX, description: "점프 또는 낙하 높이(픽셀)" };
const durationMs: JsonSchema = { type: "integer", minimum: MIN_HOP_DURATION_MS, maximum: MAX_HOP_DURATION_MS, description: "체공 시간(밀리초)" };
const enabled: JsonSchema = { type: "boolean", description: "이 단계에서 설정을 켤지 여부" };
const delta: JsonSchema = { type: "integer", minimum: -7, maximum: 7, description: "올리거나 내릴 단계 수. 낮출 때는 음수" };

function step(
  kind: MoveCommand["kind"], description: string,
  properties: Record<string, JsonSchema> = {}, required: readonly string[] = [],
): JsonSchema {
  return objectArgs({ kind: { type: "string", enum: [kind], description }, ...properties }, ["kind", ...required]);
}

const moves: JsonSchema = {
  type: "array", description: "위에서부터 실행할 이동 경로 단계", minItems: 1, maxItems: 100,
  items: {
    oneOf: [
      step("move", "지정 방향으로 한 칸 이동", { dir: DIRECTION_SCHEMA }, ["dir"]),
      step("moveDiagonal", "대각선으로 한 칸 이동", {
        horizontal: { type: "string", enum: ["left", "right"], description: "가로 방향" },
        vertical: { type: "string", enum: ["up", "down"], description: "세로 방향" },
      }, ["horizontal", "vertical"]),
      step("moveRandom", "무작위 방향으로 한 칸 이동"),
      step("moveTowardPlayer", "주인공에게 한 칸 접근"),
      step("moveAwayFromPlayer", "주인공에게서 한 칸 멀어지기"),
      step("stepForward", "바라보는 방향으로 한 칸 전진"),
      step("jump", "지정한 칸 수만큼 뛰기", {
        dx: { type: "integer", description: "가로 이동량. 왼쪽은 음수" },
        dy: { type: "integer", description: "세로 이동량. 위쪽은 음수" }, heightPx, durationMs, se,
      }, ["dx", "dy"]),
      step("dropIn", "현재 칸 위에서 내려오기", {
        heightPx, durationMs, se, impact: { type: "boolean", description: "착지 효과를 낼지 여부" },
      }),
      step("land", "착지"),
      step("turn", "지정한 방향 바라보기", { dir: DIRECTION_SCHEMA }, ["dir"]),
      step("turnRelative", "현재 방향을 기준으로 돌기", {
        turn: {
          type: "string", enum: ["right90", "left90", "turn180", "leftOrRight90"],
          description: "오른쪽, 왼쪽, 뒤쪽 또는 좌우 무작위 회전",
        },
      }, ["turn"]),
      step("turnRandom", "무작위 방향 바라보기"),
      step("turnTowardPlayer", "주인공 쪽 바라보기"),
      step("turnAwayFromPlayer", "주인공의 반대 방향 바라보기"),
      step("approach", "대상 또는 지정한 칸에 다가가기", {
        target, x, y, distance: { type: "integer", minimum: 0, maximum: 6, description: "대상과 남겨 둘 거리(칸)" },
      }),
      step("turnToward", "대상 또는 지정한 칸 바라보기", { target, x, y }),
      step("exitVia", "문으로 나가기. 페이지의 자율 이동 경로에서는 사용할 수 없음", { target: door, x, y, se: doorSound, closeSe: doorSound }),
      step("enterVia", "문으로 들어오기. 페이지의 자율 이동 경로에서는 사용할 수 없음", { target: door, x, y, dir: DIRECTION_SCHEMA, se: doorSound, closeSe: doorSound }),
      step("doorCue", "문 소리 재생. 다른 이벤트의 그림은 바꿀 수 없음", {
        target: door, se,
        frame: { type: "integer", minimum: 0, maximum: 3, description: "문이 열린 정도" },
      }),
      step("placeAt", "이 맵의 지정한 칸으로 바로 이동", { x, y }, ["x", "y"]),
      step("setDirectionFix", "방향 고정 설정", { enabled }, ["enabled"]),
      step("setThrough", "충돌 무시 설정", { enabled }, ["enabled"]),
      step("setAnimation", "걷기 그림 재생 설정", { enabled }, ["enabled"]),
      step("changeOpacity", "불투명도 조절", { delta: { type: "integer", minimum: -255, maximum: 255, description: "더하거나 뺄 불투명도" } }, ["delta"]),
      step("setSwitch", "스위치 켜기 또는 끄기. 페이지의 자율 이동 경로에서는 사용할 수 없음", {
        switchId: { ...nonBlankId, description: "프로젝트에서 찾은 스위치" },
        value: { type: "boolean", description: "스위치를 켤지 여부" },
      }, ["switchId", "value"]),
      step("changeSpeed", "걸음 속도 변경", { delta }, ["delta"]),
      step("changeFrequency", "움직임 빈도 변경", { delta }, ["delta"]),
      step("changeGraphic", "걷기 그림 변경", {
        spriteId: { ...nonBlankId, description: "프로젝트에서 찾은 걷기 그림" },
      }, ["spriteId"]),
      step("npcTransfer", "맵 이동. 페이지의 자율 이동 경로에서는 사용할 수 없음", {
        mapId: { ...nonBlankId, description: "프로젝트에서 찾은 목적지 맵" }, x, y, direction: DIRECTION_SCHEMA,
      }, ["mapId", "x", "y"]),
      step("playSe", "효과음 재생", { resourceId: se }, ["resourceId"]),
      step("wait", "한 차례 쉬기"),
    ],
  },
};

export const ROUTE_SET_ARGS = objectArgs({
  moves: { ...moves, minItems: 0, description: "위에서부터 실행할 이동 경로 단계. 추격은 유지하며 빈 목록이면 이동 방식을 유지하고 경로만 비움" },
  repeat: { type: "boolean", description: "경로를 계속 반복할지 여부. 생략하면 반복하며, 추격 순찰은 항상 반복" },
  skippable: { type: "boolean", description: "지정 경로가 막힌 걸음을 건너뛸지 여부. 생략하면 막힌 걸음을 다시 시도. 추격 순찰에서는 생략" },
}, ["moves"]);

export const ROUTE_APPEND_ARGS = objectArgs({ moves }, ["moves"]);

type RouteArgs = { moves: MoveCommand[]; repeat?: boolean; skippable?: boolean };

function validateRouteReferences(project: Project, map: GameMap, event: GameEvent, page: EventPage, route: MoveRoute): void {
  // 편집기와 같은 참조 검사를 새로 쓰는 단계에만 적용한다.
  const candidate = { ...event, pages: [{ ...page, movement: { ...page.movement, type: "custom" as const, route } }] };
  const invalid = validateEventDraftBody(project, map.id, candidate).issues.find(issue =>
    issue.severity === "error" && issue.field?.openTestId === "event-page-custom-route",
  );
  if (invalid?.code === "map.position.out-of-bounds") {
    throw new PrimitiveError("이동할 칸이 목적지 맵 범위를 벗어났어요.");
  }
  if (invalid) {
    const messages: Record<string, string> = {
      "reference.switch.missing": "이동 경로에 쓸 스위치를 찾을 수 없어요.",
      "reference.event.missing": "이동 경로에 쓸 대상 이벤트를 찾을 수 없어요.",
      "reference.map.missing": "이동 경로에 쓸 목적지 맵을 찾을 수 없어요.",
      "reference.resource.missing": "이동 경로에 쓸 그림이나 효과음을 찾을 수 없어요.",
    };
    throw new PrimitiveError(messages[invalid.code] ?? "이동 경로에 쓸 대상을 찾을 수 없어요.");
  }

  // 대화상자의 공용 검사에 없는 런타임 제약도 확인한다.
  let sounds: ReadonlySet<string> | undefined;
  for (const move of route.moves) {
    if (move.kind === "setSwitch") {
      throw new PrimitiveError("자율 이동 경로에서 전역 스위치를 바꿀 수 없어요. 이벤트 명령에서 설정해 주세요.");
    }
    // Even a coordinate can expand into door cues for another event at runtime.
    if (move.kind === "exitVia" || move.kind === "enterVia") {
      throw new PrimitiveError("문으로 드나드는 동작은 이벤트 명령에서 설정해 주세요.");
    }
    if (move.kind === "doorCue") {
      if (move.target || move.frame !== undefined) {
        throw new PrimitiveError("다른 이벤트의 문 그림은 이벤트 명령에서 바꿔 주세요.");
      }
      if (!move.se) throw new PrimitiveError("재생할 문 소리를 지정해 주세요.");
    }
    const positioned = "x" in move || "y" in move;
    if (positioned && move.kind !== "npcTransfer" &&
      (move.x === undefined || move.y === undefined || !inBounds(map, move.x, move.y))) {
      throw new PrimitiveError("이동 경로에 이 맵 안의 가로·세로 좌표를 함께 지정해 주세요.");
    }
    if ("target" in move && move.target) {
      if (positioned) throw new PrimitiveError("이동 경로 단계마다 대상과 좌표 중 하나를 지정해 주세요.");
      const canTargetPlayer = move.kind === "approach" || move.kind === "turnToward";
      const isPlayer = move.target === PLAYER_MOVE_TARGET || move.target === "player";
      if (!(canTargetPlayer && isPlayer) && !map.events.some(entry => entry.id === move.target)) {
        throw new PrimitiveError("이동 경로에서 지정한 대상 이벤트를 이 맵에서 찾을 수 없어요.");
      }
    }
    if ((move.kind === "approach" || move.kind === "turnToward") && !move.target && !positioned) {
      throw new PrimitiveError("이동 경로에 대상이나 칸을 지정해 주세요.");
    }
    if (move.kind === "jump" && (Math.abs(move.dx) >= map.width || Math.abs(move.dy) >= map.height)) {
      throw new PrimitiveError("점프로 이동할 칸 수가 이 맵의 크기를 벗어났어요.");
    }
    // 도착 맵에서도 플레이어가 같은 페이지를 등록하므로 반복을 꺼도 맵 이동이 다시 실행된다.
    if (move.kind === "npcTransfer") {
      throw new PrimitiveError("자율 이동 경로는 도착한 맵에서도 다시 시작돼요. 맵을 옮기려면 이벤트 명령에서 이동 경로를 설정해 주세요.");
    }
    if (move.kind === "changeGraphic" && !resolveEventSpriteTexture(project, move.spriteId, page.graphic.pattern)) {
      throw new PrimitiveError("이동 경로에 쓸 이벤트 그림을 찾을 수 없어요.");
    }
    const sound = move.kind === "playSe" ? move.resourceId : "se" in move ? move.se : undefined;
    if (sound && !(sounds ??= new Set(listAudioResources("sound", project).map(entry => entry.id))).has(sound)) {
      throw new PrimitiveError("이동 경로에 쓸 효과음을 찾을 수 없어요.");
    }
  }
}

export function editRoute(
  project: Project, map: GameMap, event: GameEvent, page: EventPage,
  rawArgs: Record<string, unknown>, append: boolean,
): EventPageMovement {
  const movement = page.movement;
  const previous = movement.route;
  if (append && !previous) {
    throw new PrimitiveError("덧붙일 이동 경로가 없어요. 먼저 이 페이지의 이동 경로를 정해 주세요.");
  }
  const args = rawArgs as RouteArgs;
  if (!args.moves.length) {
    if (!previous) return movement;
    const cleared = { ...movement };
    delete cleared.route;
    return cleared;
  }
  if (!append && (movement.type === "living" || movement.type === "fly")) {
    throw new PrimitiveError("생활 이동이나 비행에 경로를 적용하려면 먼저 페이지의 이동 방식을 바꿔 주세요.");
  }
  if (!append && movement.type === "chase" && (args.repeat === false || args.skippable !== undefined)) {
    throw new PrimitiveError("추격 순찰은 항상 반복돼요. 반복 끄기와 건너뛰기 옵션은 지정 경로에만 쓸 수 있어요.");
  }
  const steps: MoveRoute = {
    moves: structuredClone(args.moves),
    repeat: args.repeat ?? true,
    skippable: args.skippable ?? false,
  };
  try {
    validateMoveRoute("이동 경로", steps);
  } catch {
    throw new PrimitiveError("이동 경로 단계의 형식이 올바르지 않아요.");
  }
  validateRouteReferences(project, map, event, page, steps);
  if (append && previous) {
    if (previous.moves.some(move => move.kind === "npcTransfer")) {
      throw new PrimitiveError("기존 경로에 맵 이동이 있어 뒤에 동작을 더할 수 없어요. 이동 경로를 새로 정해 주세요.");
    }
    return { ...movement, route: { ...previous, moves: [...previous.moves, ...steps.moves] } };
  }
  return { ...movement, type: movement.type === "chase" ? "chase" : "custom", route: steps };
}
