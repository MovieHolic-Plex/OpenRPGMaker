import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { isBrowserPlayableAudioPath } from "@/assets/cc0AudioAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { newCommand } from "@/editor/eventCommandFactory";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { audioName, commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { listMovieResources } from "@/editor/panels/eventEditor/playMoviePreview";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { BLEND_MODE_NAMES } from "@/project/blendMode";
import { parseFieldFxId } from "@/project/containerFx";
import { EASING_NAMES } from "@/project/easing";
import { EMOTE_LABELS, EMOTE_KINDS, EMOTE_MIN_DURATION_MS, EMOTE_MAX_DURATION_MS } from "@/project/emotes";
import {
  EventCommandEditError, eventCommandHash, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { actorPictureActorId } from "@/project/pictureSources";
import type { AudioCommandChannel, Command, GameMap, LightSourceAnchor, Project } from "@/project/types";
import { commandListAt, eventName, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "07-cmd-staging";

type Args = Record<string, unknown>;
type PageScope = Extract<SmallTaskScope, { kind: "eventPage" }>;
type Mode = "insert" | "update";

const text = (description: string): JsonSchema => ({ type: "string", minLength: 1, pattern: "\\S", description });
const flag = (description: string): JsonSchema => ({ type: "boolean", description });
const number = (description: string, minimum?: number, maximum?: number): JsonSchema =>
  ({ type: "number", minimum, maximum, description });
const integer = (description: string, minimum?: number, maximum?: number): JsonSchema =>
  ({ type: "integer", minimum, maximum, description });
const choice = (description: string, values: readonly string[]): JsonSchema => ({ type: "string", enum: values, description });
const time = (description: string): JsonSchema => integer(description, 0);
const fraction = (description: string): JsonSchema => number(description, 0, 1);
const color: JsonSchema = { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "빨강, 초록, 파랑을 담은 여섯 자리 색상 코드." };
const pictureId = text("그림 자리 이름. 같은 이름의 그림을 표시하거나 지울 때 사용.");
const resourceId = text("프로젝트나 기본 목록에서 확인한 리소스 식별자.");
const audioChannels = ["bgm", "bgs", "me", "se"] as const;
const audioNames: Record<AudioCommandChannel, string> = { bgm: "배경 음악", bgs: "환경음", me: "짧은 음악", se: "효과음" };
const audioChoices = "배경 음악, 환경음, 짧은 음악, 효과음 순서.";
const actorAnchors = {
  target: choice("주인공, 이 이벤트, 현재 맵의 다른 이벤트 중 하나.", ["player", "self", "event"]),
  targetEventId: text("다른 이벤트를 고를 때 현재 맵에서 확인한 이벤트 식별자."),
};
const tileAnchors = {
  ...actorAnchors,
  target: choice("주인공, 이 이벤트, 다른 이벤트, 현재 맵의 칸 중 하나.", ["player", "self", "event", "tile"]),
  x: integer("맵 칸의 가로 위치. 왼쪽 첫 칸은 0.", 0),
  y: integer("맵 칸의 세로 위치. 위쪽 첫 칸은 0.", 0),
};
const lightFields = {
  id: text("이 광원에 붙일 이름. 같은 이름의 빛을 나중에 바꾸거나 끌 수 있습니다."),
  radius: number("빛의 반지름을 맵 칸 수로 입력.", 0),
  intensity: fraction("빛의 세기. 0은 꺼짐, 1은 최대."),
  color,
  flicker: flag("촛불처럼 깜빡이는지 여부."),
  edge: choice("빛 가장자리가 부드럽게 사라지거나 또렷하게 끊기는 방식.", ["soft", "hard"]),
  coneDegrees: number("부채꼴로 비출 각도. 생략하면 기존 방식 유지.", 20, 180),
  coneFacing: choice("부채꼴이 비추는 방향. 이벤트에 붙으면 이벤트 방향을 따릅니다.", ["up", "down", "left", "right"]),
};

const specs = {
  showAnimation: {
    title: "애니메이션 표시",
    fields: { ...tileAnchors, animationId: text("프로젝트에서 확인한 애니메이션 또는 내장 연출 식별자."), wait: flag("연출이 끝날 때까지 기다릴지 여부.") },
  },
  showEmote: {
    title: "감정 표시",
    fields: {
      ...actorAnchors,
      emote: choice(`머리 위 표현. 선택값 순서로 ${EMOTE_KINDS.map(kind => EMOTE_LABELS[kind]).join("·")}.`, EMOTE_KINDS),
      durationMs: integer("표시 시간. 천분의 일 초 단위.", EMOTE_MIN_DURATION_MS, EMOTE_MAX_DURATION_MS),
    },
  },
  showPicture: {
    title: "그림 표시",
    fields: {
      pictureId, resourceId, x: integer("화면 기준 가로 위치."), y: integer("화면 기준 세로 위치."),
      scale: integer("그림 배율. 원래 크기는 100.", 1, 2000), opacity: integer("불투명도. 0은 투명, 255는 불투명.", 0, 255),
      rotation: number("회전 각도."), durationMs: time("그림이 바뀌는 시간. 천분의 일 초 단위."),
      easing: choice("일정하게, 느리게 시작, 느리게 끝, 느리게 시작하고 끝 중 하나.", EASING_NAMES),
      blendMode: choice("보통, 밝기 더하기, 화면 합성, 색 곱하기 중 하나.", BLEND_MODE_NAMES),
      waitForPicture: flag("그림이 바뀔 때까지 기다릴지 여부."), recordInGallery: flag("본 그림을 갤러리에 기록할지 여부."),
    },
    insertRequired: ["resourceId"],
  },
  erasePicture: { title: "그림 지우기", fields: { pictureId } },
  playAudio: {
    title: "소리 재생",
    fields: {
      resourceId, channel: choice(`소리를 틀 채널. ${audioChoices}`, audioChannels),
      loop: flag("소리를 반복 재생할지 여부."),
      fadeInMs: time("소리가 서서히 커지는 시간. 천분의 일 초 단위."),
      volume: number("재생 음량. 정수는 백분율, 0과 1 사이 소수는 비율.", 0, 100),
    },
    insertRequired: ["resourceId"],
  },
  stopAudio: {
    title: "소리 정지",
    fields: { channel: choice(`멈출 채널. ${audioChoices} 마지막 값은 전체 소리.`, [...audioChannels, "all"]) },
  },
  playMovie: {
    title: "동영상 재생",
    fields: { resourceId, wait: flag("영상이 끝날 때까지 기다릴지 여부."), skippable: flag("영상을 건너뛸 수 있는지 여부.") },
    insertRequired: ["resourceId"],
  },
  setLighting: {
    title: "조명 설정",
    fields: { ambient: fraction("화면에 덮는 어둠의 정도. 0은 밝음, 1은 암전."), color, transitionMs: time("조명이 바뀌는 시간. 천분의 일 초 단위.") },
  },
  addLight: { title: "빛 켜기", fields: { ...tileAnchors, ...lightFields } },
  removeLight: {
    title: "빛 끄기",
    fields: { id: text("실행 중 끌 광원의 이름. 지정하면 그 빛만 끕니다."), all: flag("모든 광원을 끌지 여부.") },
  },
  setWeather: {
    title: "날씨 설정",
    fields: {
      weather: choice("날씨 효과 없음, 비, 폭풍, 눈, 안개 중 하나.", ["none", "rain", "storm", "snow", "fog"]),
      intensity: fraction("날씨 효과의 세기. 0은 없음, 1은 최대."),
      transitionMs: time("날씨가 바뀌는 시간. 천분의 일 초 단위."),
    },
  },
} satisfies Record<string, { title: string; fields: Record<string, JsonSchema>; insertRequired?: readonly string[] }>;

type Kind = keyof typeof specs;
type StagingCommand = Extract<Command, { kind: Kind }>;
type Spec = { title: string; fields: Record<string, JsonSchema>; insertRequired?: readonly string[] };

function anchor(map: GameMap, args: Args, previous: LightSourceAnchor, allowTile: boolean): LightSourceAnchor {
  const { target, targetEventId, x, y } = args;
  if (target === undefined && targetEventId === undefined && x === undefined && y === undefined) return previous;
  const mode = target ?? (targetEventId !== undefined ? "event" : "tile");
  if (mode === "player" || mode === "self") {
    if (targetEventId !== undefined || x !== undefined || y !== undefined) throw new PrimitiveError("연출 위치를 하나만 골라 주세요.");
    return mode === "player" ? "player" : { eventId: "" };
  }
  if (mode === "event") {
    if (x !== undefined || y !== undefined) throw new PrimitiveError("연출 위치를 하나만 골라 주세요.");
    const eventId = targetEventId ?? (typeof previous === "object" && "eventId" in previous ? previous.eventId : undefined);
    if (typeof eventId !== "string" || !eventId || !map.events.some(event => event.id === eventId)) {
      throw new PrimitiveError("범위 밖: 현재 맵에서 연출할 이벤트를 찾을 수 없습니다.");
    }
    return { eventId };
  }
  if (!allowTile || targetEventId !== undefined) throw new PrimitiveError("연출 위치를 하나만 골라 주세요.");
  const previousTile = typeof previous === "object" && "x" in previous ? previous : undefined;
  const tileX = x ?? previousTile?.x;
  const tileY = y ?? previousTile?.y;
  if (typeof tileX !== "number" || typeof tileY !== "number") throw new PrimitiveError("연출할 칸의 가로와 세로 위치를 입력해 주세요.");
  if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
    throw new PrimitiveError("범위 밖: 현재 맵 안에서 연출할 칸을 골라 주세요.");
  }
  return { x: tileX, y: tileY };
}

function changedFields(fields: Record<string, JsonSchema>, args: Args): Args {
  return Object.fromEntries(Object.keys(fields).filter(key => args[key] !== undefined).map(key => [key, args[key]]));
}

function buildCommand(base: StagingCommand, args: Args, map: GameMap, eventId: string): StagingCommand {
  const { target, targetEventId, ...fields } = changedFields(specs[base.kind].fields, args);
  switch (base.kind) {
    case "showAnimation": {
      const { x, y, ...effect } = fields;
      return { ...base, ...effect, target: anchor(map, args, base.target, true) };
    }
    case "showEmote": {
      const at = anchor(map, args, base.target, false);
      if (typeof at === "object" && "x" in at) throw new PrimitiveError("감정 표현을 띄울 인물을 골라 주세요.");
      return { ...base, ...fields, target: at };
    }
    case "showPicture": {
      const { blendMode: requested, ...picture } = fields;
      if (requested !== "normal") return { ...base, ...fields };
      const { blendMode, ...rest } = base;
      return { ...rest, ...picture };
    }
    case "addLight": {
      const { x, y, coneDegrees, coneFacing, ...light } = fields;
      const facing = (coneFacing as NonNullable<typeof base.source.cone>["facing"]) ?? base.source.cone?.facing;
      const cone = coneDegrees === undefined && coneFacing === undefined ? base.source.cone : {
        degrees: (coneDegrees as number | undefined) ?? base.source.cone?.degrees ?? 90,
        ...(facing === undefined ? {} : { facing }),
      };
      const requested = anchor(map, args, base.source.at, true);
      const at = args.target === "self" ? { eventId } : requested;
      return { ...base, source: { ...base.source, ...light, at, ...(cone ? { cone } : {}) } };
    }
    case "removeLight": {
      if (typeof args.id === "string" && args.all === true) throw new PrimitiveError("빛 하나 또는 전체 중 하나를 골라 주세요.");
      const { all, id, ...rest } = base;
      if (typeof args.id === "string") return { ...rest, id: args.id };
      if (args.all === true) return { ...rest, all: true };
      const next = { ...base, ...fields };
      if (!next.all && !next.id?.trim()) throw new PrimitiveError("끌 광원의 이름을 입력해 주세요.");
      return next;
    }
    case "stopAudio": {
      const { channel, ...rest } = base;
      return args.channel === "all" ? rest : { ...base, ...fields };
    }
    default:
      return { ...base, ...fields };
  }
}

const emptyIds: ReadonlySet<string> = new Set();
const referenceDefaults: ReferenceContext = {
  actorIds: emptyIds, classIds: emptyIds, enemyIds: emptyIds, itemIds: emptyIds,
  equipmentIds: emptyIds, skillIds: emptyIds, animationIds: emptyIds, switchIds: emptyIds,
  variableIds: emptyIds, commonEventIds: emptyIds, endingIds: emptyIds, mapIds: emptyIds,
  troopIds: emptyIds, speciesIds: emptyIds, resourceIds: emptyIds,
};

function validateReferences(project: Project, map: GameMap, command: StagingCommand): void {
  const at = command.kind === "addLight" ? command.source.at
    : command.kind === "showAnimation" || command.kind === "showEmote" ? command.target : undefined;
  if (at && typeof at === "object" && "eventId" in at && at.eventId && !map.events.some(event => event.id === at.eventId)) {
    throw new PrimitiveError("범위 밖: 현재 맵에서 연출할 이벤트를 찾을 수 없습니다.");
  }
  if (command.kind === "playMovie") {
    if (!listMovieResources(project).some(movie => movie.id === command.resourceId)) {
      throw new PrimitiveError("프로젝트에서 동영상을 찾을 수 없습니다.");
    }
    return;
  }
  if (command.kind !== "showAnimation" && command.kind !== "showPicture" && command.kind !== "playAudio") return;
  const message = command.kind === "showAnimation" ? "프로젝트에서 애니메이션을 찾을 수 없습니다."
    : command.kind === "showPicture" ? "프로젝트에서 그림을 찾을 수 없습니다."
    : "프로젝트에서 소리를 찾을 수 없습니다.";
  if (command.kind === "showPicture" || command.kind === "playAudio") {
    const uploaded = project.assets.uploaded[command.resourceId];
    const packaged = uploaded ? undefined : resolveAssetResourceUrl(command.resourceId, { project });
    const profile = project.resourceProfiles.find(entry => entry.assetId === command.resourceId);
    const isAudio = uploaded ? uploaded.kind === "music" || uploaded.kind === "sound"
      : profile?.kind === "music" || profile?.kind === "sound" || Boolean(packaged && isBrowserPlayableAudioPath(packaged.split(/[?#]/u, 1)[0]!));
    if (command.kind === "playAudio" ? !isAudio : isAudio || uploaded?.kind === "movie") throw new PrimitiveError(message);
  }
  if (command.kind === "showAnimation") {
    const fx = parseFieldFxId(command.animationId);
    if (fx?.kind === "popupItem" && !project.database.items.some(item => item.id === fx.itemId)) {
      throw new PrimitiveError("연출에 쓸 아이템을 찾을 수 없습니다.");
    }
  }
  const references = command.kind === "showAnimation" ? {
    animationIds: new Set(project.database.battleAnimations.map(animation => animation.id)),
  } : {
    actorIds: new Set(project.database.actors.map(actor => actor.id)),
    resourceIds: collectResourceIds(project),
  };
  try {
    validateCommands([command], { ...referenceDefaults, ...references });
  } catch {
    throw new PrimitiveError(message);
  }
}

function prepareEdit(ctx: PrimitiveContext, args: Args, kind: Kind, mode: Mode) {
  const { page, map, event } = scopedPage(ctx);
  const path = (args.branchPath as readonly number[] | undefined) ?? [];
  const list = commandListAt(page, path);
  const index = (args.index as number | undefined) ?? list.length;
  const current = mode === "update" ? list[index] : undefined;
  if (mode === "update" && current?.kind !== kind) {
    throw new PrimitiveError("범위 밖: 고를 수 있는 같은 종류의 명령 줄을 찾을 수 없습니다.");
  }
  const hash = current && eventCommandHash(current);
  if (mode === "update" && args.expectedHash !== undefined && args.expectedHash !== hash) {
    throw new PrimitiveError("그 줄의 내용이 바뀌었습니다. 다시 읽은 뒤 수정하세요.");
  }
  const command = buildCommand((mode === "update" ? current : newCommand(kind)) as StagingCommand, args, map, event.id);
  return { map, command, path: [...path, index], current, hash };
}

function safeName(name: string | undefined, fallback: string): string {
  const shown = displayText((name ?? "").replace(/[a-z0-9_.-]*[a-z][a-z0-9_.-]*|[^가-힣ㄱ-ㅎㅏ-ㅣ\p{N}\s]/giu, " "), fallback);
  return /[가-힣]/u.test(shown) ? shown : fallback;
}

function referenceName(project: Project, id: string, fallback: string, catalogName?: string): string {
  const actorId = actorPictureActorId(id);
  const name = actorId ? project.database.actors.find(actor => actor.id === actorId)?.name
    : project.assets.uploaded[id]?.name ?? project.resourceProfiles.find(profile => profile.assetId === id)?.name ?? catalogName;
  return safeName(name === id ? undefined : name, fallback);
}

function summaryDetails(ctx: PrimitiveContext, map: GameMap, cmd: StagingCommand): string {
  function targetSummary(at: LightSourceAnchor): string {
    if (typeof at === "object" && "eventId" in at) {
      const event = map.events.find(entry => entry.id === at.eventId);
      if (at.eventId && ctx.target.kind === "event" && at.eventId !== ctx.target.eventId && event) {
        return safeName(eventName(event), "다른 인물");
      }
      return "이 이벤트";
    }
    return at === "player" ? "주인공" : `${at.x}, ${at.y} 칸`;
  }
  const { project } = ctx;
  const detail = (command: StagingCommand) => commandSummary(command).split(": ").slice(1).join(": ").replace(/(\d)ms\b/gu, "$1밀리초");
  switch (cmd.kind) {
    case "showAnimation": {
      const fx = parseFieldFxId(cmd.animationId);
      const fallback = fx?.kind === "doorOpen" ? "문 열기" : "지정한 연출";
      const name = safeName(project.database.battleAnimations.find(animation => animation.id === cmd.animationId)?.name, fallback);
      return detail({ ...cmd, target: "player", animationId: "" })
        .replace("주인공", () => targetSummary(cmd.target)).replace("(연출 선택)", () => name);
    }
    case "showEmote":
      return detail({ ...cmd, target: "player" }).replace("주인공", () => targetSummary(cmd.target));
    case "showPicture":
      return `${referenceName(project, cmd.resourceId, "지정한 그림")} · ${detail(cmd)}`;
    case "erasePicture":
      return /^pic\d+$/u.test(cmd.pictureId) ? `${cmd.pictureId.slice(3)}번 자리` : "지정한 그림 자리";
    case "playAudio": {
      const channel = audioNames[cmd.channel ?? (cmd.loop ? "bgm" : "se")] ?? "지정한 소리";
      return detail({ ...cmd, resourceId: "" }).replace("(선택 없음)", () => referenceName(project, cmd.resourceId, channel, audioName(cmd.resourceId)));
    }
    case "stopAudio":
      return cmd.channel ? audioNames[cmd.channel] ?? "지정한 소리" : "모든 소리";
    case "playMovie":
      return detail({ ...cmd, resourceId: "" }).replace("(동영상 선택)", () => referenceName(project, cmd.resourceId, "지정한 동영상"));
    case "addLight":
      return detail({ ...cmd, source: { ...cmd.source, at: "player" } }).replace("주인공", () => targetSummary(cmd.source.at));
    case "removeLight":
      return cmd.all ? "모든 광원" : "지정한 광원";
    case "setLighting":
      return `어둠 ${detail(cmd)}`;
    default:
      return detail(cmd);
  }
}

function makePrimitive(kind: Kind, mode: Mode): SmallTaskPrimitive {
  const spec: Spec = specs[kind];
  const action = mode === "insert" ? "추가" : "수정";
  return {
    id: `cmd.${kind}.${mode}`,
    unit: UNIT,
    title: `${spec.title} ${action}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      properties: {
        ...spec.fields,
        index: integer(mode === "insert" ? "끼워 넣을 줄 위치. 0은 첫 줄, 생략하면 맨 끝." : "바꿀 줄 위치. 첫 줄은 0.", 0),
        branchPath: { type: "array", items: { type: "integer" }, description: "분기 안의 명령이면 읽기 결과의 분기 경로. 바깥 목록이면 생략." },
        ...(mode === "update" ? { expectedHash: text("읽은 뒤 명령이 바뀌었는지 확인할 줄 확인값.") } : {}),
      },
      required: mode === "update" ? ["index"] : spec.insertRequired ?? [],
      additionalProperties: false,
    },
    scope(ctx): PageScope {
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { map, command } = prepareEdit(ctx, args, kind, mode);
      const ending = ` 명령을 ${action}합니다.`;
      const subject = `${spec.title}(${summaryDetails(ctx, map, command)})`;
      const limit = 80 - ending.length;
      return `${subject.length > limit ? subject.slice(0, limit - 2) + "…)" : subject}${ending}`;
    },
    apply(ctx, args) {
      const { map, command, path, current, hash } = prepareEdit(ctx, args, kind, mode);
      validateReferences(ctx.project, map, command);
      return updateScopedPage(ctx, page => {
        try {
          if (mode === "insert") return insertEventCommand(page, path, command);
          const patch: Args = { ...command };
          const removed = Object.keys(current!).filter(key => !Object.hasOwn(command, key));
          for (const key of removed) patch[key] = undefined;
          const edited = updateEventCommand(page, path, patch, hash!);
          const row = resolveCommandListAtPath(edited.commands, path)![path.at(-1)!];
          for (const key of removed) Reflect.deleteProperty(row, key);
          return edited;
        } catch (error) {
          if (!(error instanceof EventCommandEditError)) throw error;
          throw new PrimitiveError("명령 줄의 위치나 설정을 다시 확인해 주세요.");
        }
      });
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(specs) as Kind[]).flatMap(
  kind => [makePrimitive(kind, "insert"), makePrimitive(kind, "update")],
);
