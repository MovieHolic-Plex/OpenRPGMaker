import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { JsonSchema } from "@/editor/tools/types";
import { isCharsetLikeTextureKey } from "@/player/charsetMotion";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { getCharacterAppearance } from "@/project/characterAppearances";
import { inBounds } from "@/project/collision";
import type { Dir, EventAnimationType, EventPage, EventPageGraphic, EventPageMovement, GameEvent, GameMap, Project } from "@/project/types";
import { PrimitiveError, SELECT_EVENT_PAGE } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { editPatrol } from "./29-event-movement/patrol";
import { DIRECTION_LABELS, DIRECTION_SCHEMA, editRoute, objectArgs, ROUTE_APPEND_ARGS, ROUTE_SET_ARGS } from "./29-event-movement/route";

export const UNIT = "29-event-movement";

const MOVEMENT_SENTENCES = {
  fixed: "제자리에 서 있게 합니다.",
  random: "주변을 무작위로 돌아다니게 합니다.",
  approach: "주인공 쪽으로 다가가게 합니다.",
} as const;

function targetEvent(ctx: PrimitiveContext): Extract<PrimitiveContext["target"], { kind: "event" }> {
  if (ctx.target.kind !== "event") throw new PrimitiveError("범위 밖: 이동을 편집할 이벤트를 선택해 주세요.");
  return ctx.target;
}

function scope(ctx: PrimitiveContext): SmallTaskScope {
  const { mapId, eventId, x, y } = targetEvent(ctx);
  // 공용 페이지 범위는 명령과 조건만 지원한다. 아래에서 선택한 페이지의 이동 또는 방향만 쓴다.
  return { kind: "tileEvent", mapId, eventId, x, y };
}

function legacyPage(event: GameEvent): EventPage {
  // 최상위 조건은 명령 실행만 막는다. 페이지 조건으로 옮기면 이벤트 자체가 사라진다.
  if (event.condition) {
    throw new PrimitiveError("이 옛 이벤트에는 실행 조건이 있어요. 이벤트 편집기에서 페이지를 확인한 뒤 다시 요청해 주세요.");
  }
  return {
    id: `${event.id}_page_1`,
    name: "페이지 1",
    conditions: [],
    graphic: event.sprite ? { sprite: event.sprite } : {},
    trigger: event.trigger,
    priority: "same",
    movement: event.moveRoute
      ? { type: "custom", speed: 3, frequency: 3, route: event.moveRoute }
      : { type: "fixed", speed: 3, frequency: 3 },
    commands: event.commands,
  };
}

type PageMotionPatch = { movement: EventPageMovement } | { graphic: EventPageGraphic; animationType?: EventAnimationType };

function selectedPage(ctx: PrimitiveContext) {
  const { project } = ctx;
  const target = targetEvent(ctx);
  const map = Object.hasOwn(project.maps, target.mapId) ? project.maps[target.mapId] : undefined;
  const index = map?.events.findIndex(event => event.id === target.eventId) ?? -1;
  const event = map?.events[index];
  if (!map || !event) throw new PrimitiveError("범위 밖: 선택한 이벤트를 찾을 수 없어요.");
  if (!Number.isInteger(target.x) || !Number.isInteger(target.y) || !inBounds(map, target.x, target.y) ||
    event.x !== target.x || event.y !== target.y || map.events.some((entry, i) => i > index && entry.id === event.id)) {
    throw new PrimitiveError("범위 밖: 작업할 칸의 이벤트를 다시 선택해 주세요.");
  }
  const originalPages = event.pages ?? [];
  if (target.pageId === undefined && originalPages.length > 1) {
    throw new PrimitiveError(SELECT_EVENT_PAGE);
  }
  const pageIndex = target.pageId === undefined ? 0 : originalPages.findIndex(page => page.id === target.pageId);
  const page = originalPages[pageIndex] ?? (pageIndex === 0 && !originalPages.length ? legacyPage(event) : undefined);
  if (!page) throw new PrimitiveError("범위 밖: 선택한 이벤트 페이지를 찾을 수 없어요.");
  if (originalPages.some((entry, i) => i !== pageIndex && entry.id === page.id)) {
    throw new PrimitiveError("범위 밖: 페이지를 하나로 구분할 수 없어요. 이벤트 편집기에서 확인해 주세요.");
  }
  return { mapId: target.mapId, map, event, index, originalPages, page, pageIndex };
}

function editPage(ctx: PrimitiveContext, edit: (page: EventPage, map: GameMap, event: GameEvent) => PageMotionPatch): Project {
  const { project } = ctx;
  const { mapId, map, event, index, originalPages, page, pageIndex } = selectedPage(ctx);
  const patch = edit(page, map, event);
  if ("movement" in patch && patch.movement === page.movement) return project;
  const pages = originalPages.slice();
  pages[pageIndex] = "movement" in patch
    ? { ...page, movement: patch.movement }
    : { ...page, graphic: patch.graphic, ...(patch.animationType === undefined ? {} : { animationType: patch.animationType }) };
  const events = map.events.slice();
  // Once the new page owns the commands, reference checks should see a single writer.
  events[index] = { ...event, pages, ...(originalPages.length === 0 ? { commands: [] } : {}) };
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, events } } };
}

function directionAnimation(type: EventAnimationType | undefined, fixed: boolean | undefined): EventAnimationType | undefined {
  if (fixed === undefined) return type;
  if (fixed) {
    if (type === "fixedDirection" || type === "fixedDirectionStep") return type;
    return type === "step" || type === "fourFrame" ? "fixedDirectionStep" : "fixedDirection";
  }
  if (type === "fixedDirection" || type === "fixedGraphic") return "normal";
  if (type === "fixedDirectionStep") return "step";
  return type;
}

function faceGraphic(project: Project, graphic: EventPageGraphic, fallbackSpriteId: string | undefined, direction: Dir): EventPageGraphic {
  // 외형을 연결한 페이지는 렌더할 때 그 외형으로 프레임을 정한다.
  if (getCharacterAppearance(project, graphic.appearanceId)?.charset) return { ...graphic, direction };
  const spriteId = graphic.sprite?.id ?? fallbackSpriteId;
  const texture = spriteId ? resolveEventSpriteTexture(project, spriteId, graphic.pattern) : null;
  // 첫 렌더는 저장된 프레임을 사용하므로 방향 줄도 바꾼다. 칩 번호와 발 모양을 유지한다.
  if (!texture || typeof texture.frame !== "number" || (!texture.charset && !isCharsetLikeTextureKey(texture.texture))) {
    return { ...graphic, direction };
  }
  const pattern = charsetFrameIndex({ ...decodeCharsetFrameIndex(texture.frame), direction });
  return { ...graphic, direction, pattern };
}

function rankArgs(field: "speed" | "frequency", description: string): JsonSchema {
  return objectArgs({ [field]: { type: "integer", minimum: 1, maximum: 8, description } }, [field]);
}

function primitive(
  entry: Pick<SmallTaskPrimitive, "id" | "title" | "args" | "describe" | "apply">,
  tool = entry.id,
): SmallTaskPrimitive {
  return { ...entry, unit: UNIT, covers: { tools: [tool] }, targets: ["event"], scope };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  primitive({
    id: "move.route.set",
    title: "이동 경로 바꾸기",
    args: ROUTE_SET_ARGS,
    describe: (ctx, args) => {
      const count = (args.moves as unknown[]).length;
      if (!count) return "이동 방식은 유지하고 경로만 비웁니다.";
      const { type } = selectedPage(ctx).page.movement;
      if (type === "chase") return `추격을 유지하고 순찰 경로를 ${count}단계로 바꿉니다.`;
      if (type === "custom") return `이동 경로를 ${count}단계로 바꿉니다.`;
      return `이동 방식을 지정 경로로 바꾸고 ${count}단계를 설정합니다.`;
    },
    apply: (ctx, args) => editPage(ctx, (page, map, event) => ({ movement: editRoute(ctx.project, map, event, page, args, false) })),
  }),
  primitive({
    id: "move.route.append",
    title: "이동 경로에 덧붙이기",
    args: ROUTE_APPEND_ARGS,
    describe: (_ctx, args) => `이동 경로 끝에 ${(args.moves as unknown[]).length}단계를 더합니다.`,
    apply: (ctx, args) => editPage(ctx, (page, map, event) => ({ movement: editRoute(ctx.project, map, event, page, args, true) })),
  }),
  primitive({
    id: "move.type.set",
    title: "이동 방식 바꾸기",
    args: objectArgs({
      type: {
        type: "string", enum: Object.keys(MOVEMENT_SENTENCES),
        description: "제자리에 서기, 주변을 무작위로 돌아다니기, 주인공에게 접근 중 하나",
      },
    }, ["type"]),
    describe: (_ctx, args) => MOVEMENT_SENTENCES[args.type as keyof typeof MOVEMENT_SENTENCES],
    apply: (ctx, { type }) => editPage(ctx, page => ({ movement: { ...page.movement, type: type as EventPageMovement["type"] } })),
  }, "move.type.set(random/approach/fixed)"),
  primitive({
    id: "move.speed.set",
    title: "이동 속도 바꾸기",
    args: rankArgs("speed", "걸음 속도 단계. 1이 가장 느리고 7과 8이 가장 빠름"),
    describe: (_ctx, args) => `이동 속도를 ${args.speed}단계로 바꿉니다.`,
    apply: (ctx, { speed }) => editPage(ctx, page => ({ movement: { ...page.movement, speed: speed as number } })),
  }),
  primitive({
    id: "move.frequency.set",
    title: "이동 빈도 바꾸기",
    args: rankArgs("frequency", "움직임 빈도 단계. 1이 가장 드물고 6부터 8까지는 가장 자주 움직임"),
    describe: (_ctx, args) => `이동 빈도를 ${args.frequency}단계로 바꿉니다.`,
    apply: (ctx, { frequency }) => editPage(ctx, page => {
      const movement = { ...page.movement, frequency: frequency as number };
      delete movement.moveIntervalMs; // 명시한 밀리초 간격이 새 빈도 단계를 가리지 않도록 한다.
      return { movement };
    }),
  }),
  primitive({
    id: "npc.patrol.set",
    title: "순찰 경로 정하기",
    args: objectArgs({
      directions: {
        type: "array", items: DIRECTION_SCHEMA, minItems: 2, maxItems: 12,
        description: "한 칸씩 걷는 순서. 현재 자리에서 출발해 같은 자리로 돌아와야 함",
      },
      intervalMs: {
        type: "integer", minimum: 800, maximum: 5000,
        description: "움직임 사이의 간격(밀리초). 생략하면 저장된 순찰 간격을 쓰며, 새 일반 순찰은 1600",
      },
    }, ["directions"]),
    describe: (_ctx, args) => `${(args.directions as Dir[]).length}걸음으로 출발점에 돌아오는 순찰을 설정합니다.`,
    apply: (ctx, { directions, intervalMs }) => editPage(ctx, (page, map, event) => ({
      movement: editPatrol(ctx.project, map, event, page, directions as Dir[], intervalMs as number | undefined),
    })),
  }),
  primitive({
    id: "npc.face.set",
    title: "바라보는 방향 바꾸기",
    args: objectArgs({
      direction: DIRECTION_SCHEMA,
      fixed: { type: "boolean", description: "항상 같은 방향을 보면 참, 방향 고정을 풀면 거짓, 생략하면 기존 설정 유지" },
    }, ["direction"]),
    describe: (_ctx, { direction, fixed }) => {
      const label = DIRECTION_LABELS[direction as Dir];
      const facing = `${label}${label.endsWith("쪽") ? "을" : "를"}`;
      if (fixed === false) return `${facing} 보게 하고 방향 고정을 풉니다.`;
      return `${fixed ? "항상 " : ""}${facing} 바라보게 합니다.`;
    },
    apply: (ctx, { direction, fixed }) => editPage(ctx, (page, _map, event) => ({
      graphic: faceGraphic(ctx.project, page.graphic, event.sprite?.id, direction as Dir),
      animationType: directionAnimation(page.animationType, fixed as boolean | undefined),
    })),
  }),
];
