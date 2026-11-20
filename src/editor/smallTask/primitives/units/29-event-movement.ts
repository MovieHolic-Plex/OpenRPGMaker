import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { JsonSchema } from "@/editor/tools/types";
import { isCharsetLikeTextureKey } from "@/player/charsetMotion";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import type { Dir, EventAnimationType, EventPage, EventPageGraphic, EventPageMovement, GameEvent, GameMap, Project } from "@/project/types";
import { PrimitiveError } from "../errors";
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
  return { kind: "tileEvent", mapId, eventId, x, y };
}

function legacyPage(event: GameEvent): EventPage {
  return {
    id: `${event.id}_page_1`,
    name: "페이지 1",
    conditions: event.condition ? [event.condition] : [],
    graphic: event.sprite ? { sprite: event.sprite } : {},
    trigger: event.trigger,
    priority: "same",
    movement: event.moveRoute
      ? { type: "custom", speed: 3, frequency: 3, route: event.moveRoute }
      : { type: "fixed", speed: 3, frequency: 3 },
    commands: event.commands,
  };
}

function editPage(ctx: PrimitiveContext, edit: (page: EventPage, map: GameMap, event: GameEvent) => EventPage): Project {
  const { project } = ctx;
  const target = targetEvent(ctx);
  const map = Object.hasOwn(project.maps, target.mapId) ? project.maps[target.mapId] : undefined;
  const index = map?.events.findIndex(event => event.id === target.eventId) ?? -1;
  const event = map?.events[index];
  if (!map || !event) throw new PrimitiveError("범위 밖: 선택한 이벤트를 찾을 수 없어요.");
  const originalPages = event.pages ?? [];
  const pageIndex = target.pageId === undefined ? 0 : originalPages.findIndex(page => page.id === target.pageId);
  const page = originalPages[pageIndex] ?? (pageIndex === 0 && !originalPages.length ? legacyPage(event) : undefined);
  if (!page) throw new PrimitiveError("범위 밖: 선택한 이벤트 페이지를 찾을 수 없어요.");

  const pages = originalPages.slice();
  pages[pageIndex] = edit(page, map, event);
  const events = map.events.slice();
  events[index] = { ...event, pages };
  return { ...project, maps: { ...project.maps, [target.mapId]: { ...map, events } } };
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

function faceGraphic(project: Project, graphic: EventPageGraphic, spriteId: string | undefined, direction: Dir): EventPageGraphic {
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
    describe: (_ctx, args) => {
      const count = (args.moves as unknown[]).length;
      return count ? `이동 경로를 ${count}단계로 바꿉니다.` : "이동 경로를 비웁니다.";
    },
    apply: (ctx, args) => editPage(ctx, (page, map, event) => editRoute(ctx.project, map, event, page, args, false)),
  }),
  primitive({
    id: "move.route.append",
    title: "이동 경로에 덧붙이기",
    args: ROUTE_APPEND_ARGS,
    describe: (_ctx, args) => `이동 경로 끝에 ${(args.moves as unknown[]).length}단계를 더합니다.`,
    apply: (ctx, args) => editPage(ctx, (page, map, event) => editRoute(ctx.project, map, event, page, args, true)),
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
    apply: (ctx, { type }) => editPage(ctx, page => ({
      ...page, movement: { ...page.movement, type: type as EventPageMovement["type"] },
    })),
  }, "move.type.set(random/approach/fixed)"),
  primitive({
    id: "move.speed.set",
    title: "이동 속도 바꾸기",
    args: rankArgs("speed", "걸음 속도 단계. 1이 가장 느리고 8이 가장 빠름"),
    describe: (_ctx, args) => `이동 속도를 ${args.speed}단계로 바꿉니다.`,
    apply: (ctx, { speed }) => editPage(ctx, page => ({ ...page, movement: { ...page.movement, speed: speed as number } })),
  }),
  primitive({
    id: "move.frequency.set",
    title: "이동 빈도 바꾸기",
    args: rankArgs("frequency", "움직임 빈도 단계. 1이 가장 드물고 8이 가장 잦음"),
    describe: (_ctx, args) => `이동 빈도를 ${args.frequency}단계로 바꿉니다.`,
    apply: (ctx, { frequency }) => editPage(ctx, page => {
      const movement = { ...page.movement, frequency: frequency as number };
      delete movement.moveIntervalMs; // 명시한 밀리초 간격이 새 빈도 단계를 가리지 않도록 한다.
      return { ...page, movement };
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
        description: "움직임 사이의 간격(밀리초). 일반 순찰은 생략하면 1600",
      },
    }, ["directions"]),
    describe: (_ctx, args) => `${(args.directions as Dir[]).length}걸음을 돌아 출발점으로 오는 순찰을 설정합니다.`,
    apply: (ctx, { directions, intervalMs }) => editPage(ctx, (page, map, event) =>
      editPatrol(ctx.project, map, event, page, directions as Dir[], intervalMs as number | undefined)),
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
    apply: (ctx, { direction, fixed }) => editPage(ctx, (page, _map, event) => {
      const animationType = directionAnimation(page.animationType, fixed as boolean | undefined);
      return {
        ...page,
        graphic: faceGraphic(ctx.project, page.graphic, page.graphic.sprite?.id ?? event.sprite?.id, direction as Dir),
        ...(animationType === undefined ? {} : { animationType }),
      };
    }),
  }),
];
