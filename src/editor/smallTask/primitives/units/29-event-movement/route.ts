import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import type { JsonSchema } from "@/editor/tools/types";
import { inBounds } from "@/project/collision";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { validateMoveRoute } from "@/project/io/shapeCommandFields";
import type { EventPage, GameEvent, GameMap, MoveCommand, MoveRoute, Project } from "@/project/types";
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
const target: JsonSchema = { type: "string", description: "이 맵에서 찾은 이벤트 또는 주인공" };
const se: JsonSchema = { type: "string", description: "프로젝트에서 찾은 효과음" };
const heightPx: JsonSchema = { type: "integer", minimum: 1, description: "점프 또는 낙하 높이" };
const durationMs: JsonSchema = { type: "integer", minimum: 1, description: "체공 시간(밀리초)" };
const enabled: JsonSchema = { type: "boolean", description: "이 단계에서 설정을 켤지 여부" };
const delta: JsonSchema = { type: "integer", description: "한 단계에서 더하거나 뺄 값" };

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
      step("exitVia", "지정한 문이나 가까운 출구로 나가기", { target, x, y, se, closeSe: se }),
      step("enterVia", "지정한 문이나 가까운 입구로 들어오기", { target, x, y, dir: DIRECTION_SCHEMA, se, closeSe: se }),
      step("doorCue", "문 그림이나 소리 재생", {
        target, se, ms: { type: "integer", minimum: 0, description: "문 연출 시간(밀리초)" },
        frame: { type: "integer", minimum: 0, maximum: 3, description: "문이 열린 정도" },
      }),
      step("placeAt", "이 맵의 지정한 칸으로 바로 이동", { x, y }, ["x", "y"]),
      step("setDirectionFix", "방향 고정 설정", { enabled }, ["enabled"]),
      step("setThrough", "충돌 무시 설정", { enabled }, ["enabled"]),
      step("setAnimation", "걷기 그림 재생 설정", { enabled }, ["enabled"]),
      step("changeOpacity", "불투명도 조절", { delta: { type: "number", description: "더하거나 뺄 불투명도" } }, ["delta"]),
      step("setSwitch", "스위치 켜기 또는 끄기", {
        switchId: { type: "string", description: "프로젝트에서 찾은 스위치" },
        value: { type: "boolean", description: "스위치를 켤지 여부" },
      }, ["switchId", "value"]),
      step("changeSpeed", "걸음 속도 변경", { delta }, ["delta"]),
      step("changeFrequency", "움직임 빈도 변경", { delta }, ["delta"]),
      step("changeGraphic", "걷기 그림 변경", {
        spriteId: { type: "string", description: "프로젝트에서 찾은 걷기 그림" },
      }, ["spriteId"]),
      step("npcTransfer", "다른 맵의 지정한 칸으로 이동", {
        mapId: { type: "string", description: "프로젝트에서 찾은 목적지 맵" }, x, y, direction: DIRECTION_SCHEMA,
      }, ["mapId", "x", "y"]),
      step("playSe", "효과음 재생", { resourceId: se }, ["resourceId"]),
      step("wait", "한 차례 쉬기"),
    ],
  },
};

export const ROUTE_SET_ARGS = objectArgs({
  moves: { ...moves, minItems: 0, description: "위에서부터 실행할 이동 경로 단계. 빈 목록이면 경로를 비움" },
  repeat: { type: "boolean", description: "경로를 계속 반복할지 여부. 생략하면 반복" },
  skippable: { type: "boolean", description: "막힌 걸음을 건너뛸지 여부. 생략하면 막힌 걸음을 다시 시도" },
}, ["moves"]);

export const ROUTE_APPEND_ARGS = objectArgs({ moves }, ["moves"]);

type RouteArgs = { moves: MoveCommand[]; repeat?: boolean; skippable?: boolean };
const STAGING_TARGETS = new Set(["@player", "player", "@this", "this-event"]);

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
    const labels: Record<string, string> = {
      "reference.switch.missing": "스위치",
      "reference.event.missing": "대상 이벤트",
      "reference.map.missing": "목적지 맵",
      "reference.resource.missing": "그림이나 효과음",
    };
    throw new PrimitiveError(`이동 경로에 쓸 ${labels[invalid.code] ?? "대상"}을 찾을 수 없어요.`);
  }

  // 이동 경로 대화상자의 검사에서 다루지 않는 칸과 문 연출 참조도 확인한다.
  let resources: ReadonlySet<string> | undefined;
  for (const move of route.moves) {
    const positioned = "x" in move || "y" in move;
    if (positioned && move.kind !== "npcTransfer" &&
      (move.x === undefined || move.y === undefined || !inBounds(map, move.x, move.y))) {
      throw new PrimitiveError("이동 경로에 이 맵 안의 가로·세로 좌표를 함께 지정해 주세요.");
    }
    if ((move.kind === "approach" || move.kind === "turnToward") && !move.target && !positioned) {
      throw new PrimitiveError("이동 경로에 대상이나 칸을 지정해 주세요.");
    }
    if (move.kind === "doorCue" && move.target && !STAGING_TARGETS.has(move.target) &&
      !map.events.some(entry => entry.id === move.target)) {
      throw new PrimitiveError("문 연출에 쓸 이벤트를 찾을 수 없어요.");
    }
    for (const sound of ["se" in move ? move.se : undefined, "closeSe" in move ? move.closeSe : undefined]) {
      if (sound && !(resources ??= collectResourceIds(project)).has(sound)) {
        throw new PrimitiveError("이동 경로에 쓸 효과음을 찾을 수 없어요.");
      }
    }
  }
}

export function editRoute(
  project: Project, map: GameMap, event: GameEvent, page: EventPage,
  rawArgs: Record<string, unknown>, append: boolean,
): EventPage {
  const args = rawArgs as RouteArgs;
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
  const previous = page.movement.route;
  if (append && previous) {
    const route = { ...previous, moves: [...previous.moves, ...steps.moves] };
    return { ...page, movement: { ...page.movement, route } };
  }
  return { ...page, movement: { ...page.movement, type: "custom", route: steps } };
}
