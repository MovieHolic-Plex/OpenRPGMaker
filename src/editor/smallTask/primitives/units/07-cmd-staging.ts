import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { findBgmTrack } from "@/assets/bgmCatalog";
import { isBrowserPlayableAudioPath } from "@/assets/cc0AudioAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { SE_CATALOG } from "@/assets/seCatalog";
import { newCommand } from "@/editor/eventCommandFactory";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { SAMPLE_MOVIE_RESOURCE } from "@/editor/panels/eventEditor/playMoviePreview";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { BLEND_MODE_LABELS, BLEND_MODE_NAMES, normalizeBlendMode } from "@/project/blendMode";
import { containerFxId, DOOR_OPEN_FX_ID, goldPopupFxId, parseFieldFxId } from "@/project/containerFx";
import { EASING_LABELS, EASING_NAMES } from "@/project/easing";
import { EMOTE_LABELS, EMOTE_KINDS, EMOTE_MIN_DURATION_MS, EMOTE_MAX_DURATION_MS } from "@/project/emotes";
import {
  EventCommandEditError, eventCommandHash, insertEventCommand, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { normalizeLightSource } from "@/project/lightingRules";
import { openingStillBaseId } from "@/project/openingStill";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { dataUrlMime, uploadedAssetMime, uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import { actorPictureActorId } from "@/project/pictureSources";
import { SCRIPT_UNKNOWN_EFFECTS_API, scriptCommandEffects } from "@/project/script/effects";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { AudioCommandChannel, Command, EventPage, GameMap, LightSourceAnchor, Project } from "@/project/types";
import { commandListAt, eventName, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
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
const time = (description: string): JsonSchema => integer(description, 0, Number.MAX_SAFE_INTEGER);
const fraction = (description: string): JsonSchema => number(description, 0, 1);
const color: JsonSchema = { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "빨강, 초록, 파랑을 담은 여섯 자리 색상 코드." };
const pictureId = text("그림 자리 이름. 같은 이름의 그림을 표시하거나 지울 때 사용.");
const resourceId = text("프로젝트나 기본 목록에서 확인한 리소스 식별자.");
const audioChannels = ["bgm", "bgs", "me", "se"] as const;
const audioNames: Record<AudioCommandChannel, string> = { bgm: "배경 음악", bgs: "환경음", me: "효과 음악", se: "효과음" };
const audioChoices = "배경 음악, 환경음, 효과 음악, 효과음 순서.";
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
const lightFacingNames = { up: "위", down: "아래", left: "왼쪽", right: "오른쪽" } as const;

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
      durationMs: integer("표시 시간(밀리초).", EMOTE_MIN_DURATION_MS, EMOTE_MAX_DURATION_MS),
    },
  },
  showPicture: {
    title: "그림 표시",
    fields: {
      pictureId, resourceId,
      x: integer("화면 기준 가로 위치(픽셀).", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
      y: integer("화면 기준 세로 위치(픽셀).", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
      scale: integer("그림 배율(%). 원래 크기는 100.", 1, 2000), opacity: integer("불투명도. 0은 완전히 투명하고 255는 불투명합니다.", 0, 255),
      rotation: number("회전 각도."), durationMs: integer("그림이 바뀌는 시간(밀리초).", 0, 60_000),
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
      fadeInMs: time("소리가 서서히 커지는 시간(밀리초)."),
      volume: number("재생 음량. 0은 무음, 1은 1%, 100은 최대입니다. 0보다 크고 1보다 작은 값은 비율로 해석합니다.", 0, 100),
    },
    insertRequired: ["resourceId"],
  },
  stopAudio: {
    title: "소리 정지",
    fields: { channel: choice(`멈출 채널. ${audioChoices} 마지막 값은 전체 소리.`, [...audioChannels, "all"]) },
  },
  playMovie: {
    title: "동영상 재생",
    fields: {
      resourceId: text(`업로드에서 확인한 동영상 식별자 또는 번들 샘플 ${SAMPLE_MOVIE_RESOURCE.id}.`),
      wait: flag("영상이 끝날 때까지 기다릴지 여부."), skippable: flag("영상을 건너뛸 수 있는지 여부."),
    },
    insertRequired: ["resourceId"],
  },
  setLighting: {
    title: "조명 설정",
    fields: { ambient: fraction("화면에 덮는 어둠의 정도. 0은 밝음, 1은 암전."), color, transitionMs: time("조명이 바뀌는 시간(밀리초).") },
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
      transitionMs: time("날씨가 바뀌는 시간(밀리초)."),
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
  if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY)
    || tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
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
      const { blendMode: requested, pictureId, ...picture } = fields;
      const next = {
        ...picture,
        ...(typeof pictureId === "string" ? { pictureId: pictureId.trim() } : {}),
      };
      if (requested === undefined) return { ...base, ...next };
      const blend = normalizeBlendMode(requested);
      if (blend) return { ...base, ...next, blendMode: blend };
      const { blendMode, ...rest } = base;
      return { ...rest, ...next };
    }
    case "erasePicture":
      return typeof args.pictureId === "string" ? { ...base, pictureId: args.pictureId.trim() } : base;
    case "addLight": {
      const { x, y, id, coneDegrees, coneFacing, ...light } = fields;
      const facing = (coneFacing as NonNullable<typeof base.source.cone>["facing"]) ?? base.source.cone?.facing;
      const cone = coneDegrees === undefined && coneFacing === undefined ? base.source.cone : {
        degrees: (coneDegrees as number | undefined) ?? base.source.cone?.degrees ?? 90,
        ...(facing === undefined ? {} : { facing }),
      };
      const requested = anchor(map, args, base.source.at, true);
      const at = args.target === "self" ? { eventId } : requested;
      return {
        ...base,
        source: { ...base.source, ...light, id: typeof id === "string" ? id.trim() : base.source.id, at, ...(cone ? { cone } : {}) },
      };
    }
    case "removeLight": {
      if (typeof args.id === "string" && args.all === true) throw new PrimitiveError("빛 하나 또는 전체 중 하나를 골라 주세요.");
      const { all, id, ...rest } = base;
      if (typeof args.id === "string") return { ...rest, id: args.id.trim() };
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

function validateReferences(project: Project, command: StagingCommand, previous: StagingCommand | undefined): void {
  if (command.kind === "showAnimation") {
    const id = command.animationId;
    if (previous?.kind === "showAnimation" && previous.animationId === id) return;
    const fx = parseFieldFxId(id);
    if (!fx && !project.database.battleAnimations.some(animation => animation.id === id)) {
      throw new PrimitiveError("프로젝트에서 애니메이션을 찾을 수 없습니다.");
    }
    if ((fx?.kind === "doorOpen" && id !== DOOR_OPEN_FX_ID)
      || (fx?.kind === "container" && id !== containerFxId(fx.style))) {
      throw new PrimitiveError("내장 연출 이름을 다시 확인해 주세요.");
    }
    if (fx?.kind === "popupGold" && (!Number.isSafeInteger(fx.amount) || fx.amount <= 0 || id !== goldPopupFxId(fx.amount))) {
      throw new PrimitiveError("동전 표시용 내장 연출에는 1 이상의 정수로 동전 개수를 입력해 주세요.");
    }
    if (fx?.kind === "popupItem" && !project.database.items.some(item => item.id === fx.itemId)) {
      throw new PrimitiveError("연출에 쓸 아이템을 찾을 수 없습니다.");
    }
    return;
  }
  if (command.kind !== "showPicture" && command.kind !== "playAudio" && command.kind !== "playMovie") return;
  const id = command.resourceId;
  // 기존 저장본의 자료는 유지하면서 새로 선택한 자료의 종류와 존재를 확인한다.
  if (previous?.kind === command.kind && "resourceId" in previous && previous.resourceId === id) return;
  const actorId = command.kind === "showPicture" ? actorPictureActorId(id) : null;
  if (actorId && project.database.actors.some(actor => actor.id === actorId)) return;
  const message = command.kind === "showPicture" ? "프로젝트에서 표시할 수 있는 그림을 찾을 수 없습니다."
    : command.kind === "playMovie" ? "프로젝트에서 재생할 수 있는 동영상을 찾을 수 없습니다."
    : "프로젝트에서 재생할 수 있는 소리를 찾을 수 없습니다.";
  const ids = collectResourceIds(project);
  const stillId = command.kind === "showPicture" ? openingStillBaseId(id) : undefined;
  const known = ids.has(id) || (stillId !== undefined && ids.has(stillId));
  const bundledMovie = command.kind === "playMovie" && id === SAMPLE_MOVIE_RESOURCE.id;
  if (actorId || (!known && !bundledMovie) || Object.hasOwn(Object.prototype, id)) throw new PrimitiveError(message);
  const uploaded = Object.hasOwn(project.assets.uploaded, id) ? project.assets.uploaded[id] : undefined;
  const url = resolveAssetResourceUrl(id, { project });
  // A missing upload must not silently fall back to the sample with the same filename.
  if (bundledMovie && !uploaded && !url) return;
  // Content-addressed uploads are also edited in hosts that have no URL resolver installed.
  const mime = uploaded?.ref && (!url || url === uploadedAssetUrl(uploaded))
    ? uploadedAssetMime(uploaded).toLowerCase()
    : url && dataUrlMime(url)?.toLowerCase();
  const path = url?.split(/[?#]/u, 1)[0] ?? "";
  const audioKind = uploaded?.kind === "music" || uploaded?.kind === "sound";
  if (command.kind === "playAudio") {
    const playable = mime ? mime.startsWith("audio/") : isBrowserPlayableAudioPath(path);
    if (!playable || (uploaded && !audioKind)) throw new PrimitiveError(message);
    return;
  }
  if (command.kind === "playMovie") {
    const playable = mime ? /^video\/(mp4|webm|ogg)$/u.test(mime) : /\.(mp4|webm|ogv|m4v)$/iu.test(path);
    if (!playable) throw new PrimitiveError(message);
    return;
  }
  const drawable = mime ? mime.startsWith("image/") : /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/iu.test(path);
  if (!drawable || audioKind || uploaded?.kind === "movie") throw new PrimitiveError(message);
}

function hasCommandReference(project: Project, matches: (command: Command) => boolean): boolean {
  const uses = (list: readonly Command[]): boolean => list.some(command => matches(command) || nestedCommandLists(command).some(uses));
  const eventUses = (event: Pick<GameMap["events"][number], "commands" | "pages">): boolean =>
    uses(event.commands) || (event.pages ?? []).some(page => uses(page.commands));
  return Object.values(project.maps).some(map => map.events.some(event =>
    eventUses(event) || (event.draft?.kind === "edit" && event.draft.original !== undefined && eventUses(event.draft.original))))
    || project.commonEvents.some(event => uses(event.commands))
    || project.database.troops.some(troop => troop.battleEventPages.some(page => uses(page.commands))
      || troopAfterBattleLists(troop).some(list => uses(list.commands)));
}

function referencesPicture(command: Command, id: string, includeShow = false): boolean {
  if (includeShow && command.kind === "showPicture") return command.pictureId === id;
  if (command.kind === "erasePicture") return command.pictureId === id;
  if (command.kind !== "m2Command") return false;
  const title = m2CommandById(command.commandId)?.title;
  if (title !== "Move Picture" && title !== "Erase Picture" && !(includeShow && title === "Show Picture")) return false;
  const slot = command.fields.pictureId;
  return (typeof slot === "string" || typeof slot === "number" || typeof slot === "boolean" ? String(slot) : "pic1") === id;
}

function hasUnresolvedSlotScript(project: Project, slot: "picture" | "light"): boolean {
  const mentionsSlotCommand = slot === "light" ? /["'`](?:addLight|removeLight)["'`]/u
    : /["'`](?:showPicture|erasePicture|m2-051-show-picture|m2-052-move-picture|m2-053-erase-picture)["'`]/u;
  const mayCallSlotCommand = (entry: Pick<Extract<Command, { kind: "script" }>, "source" | "compiled" | "effects">) => {
    // Script effects do not track runtime slot IDs. A matching command or computed game.cmd needs review.
    const code = `${entry.source}\n${entry.compiled}`;
    return mentionsSlotCommand.test(code) || scriptCommandEffects(entry).dynamic.some(({ api }) => api === "cmd"
      || (api === SCRIPT_UNKNOWN_EFFECTS_API && /\bcmd\b/u.test(code)));
  };
  return hasCommandReference(project, row => row.kind === "script" && mayCallSlotCommand(row))
    || (project.scriptLibrary ?? []).some(mayCallSlotCommand);
}

function validateSlotRename(project: Project, after: Project, map: GameMap, command: StagingCommand, previous: StagingCommand | undefined): void {
  if (command.kind === "showPicture" && previous?.kind === "showPicture" && command.pictureId !== previous.pictureId) {
    if (hasCommandReference(project, row => referencesPicture(row, previous.pictureId))) {
      throw new PrimitiveError("다른 명령에서 이 그림을 움직이거나 지우고 있어 그림 자리를 바꿀 수 없습니다.");
    }
    if (hasCommandReference(project, row => referencesPicture(row, command.pictureId, true))) {
      throw new PrimitiveError("다른 명령에서 이미 쓰는 그림 자리입니다. 빈 자리를 골라 주세요.");
    }
    if (hasUnresolvedSlotScript(project, "picture")) {
      throw new PrimitiveError("스크립트에서 이 그림 자리를 사용하는지 확인할 수 없어 자리를 바꿀 수 없습니다.");
    }
  }
  if (command.kind === "addLight" && previous?.kind === "addLight") {
    const oldId = normalizeLightSource(previous.source).id;
    const newId = normalizeLightSource(command.source).id;
    if (newId !== oldId) {
      // Entering a map without default lighting retains the lights from the previous map.
      const sourceMaps = map.defaultLighting ? [map] : Object.values(project.maps);
      const isDefaultLight = (id: string) => sourceMaps.some(sourceMap =>
        sourceMap.defaultLighting?.sources.some(source => normalizeLightSource(source).id === id));
      if (isDefaultLight(oldId)) {
        throw new PrimitiveError("이 명령은 맵의 기본 광원을 바꾸고 있어 광원 이름을 바꿀 수 없습니다.");
      }
      if (hasCommandReference(project, row => row.kind === "removeLight" && row.all !== true && row.id === oldId)) {
        throw new PrimitiveError("다른 명령에서 이 광원을 끄고 있어 광원 이름을 바꿀 수 없습니다.");
      }
      if (hasCommandReference(after, row => row.kind === "addLight" && normalizeLightSource(row.source).id === oldId)) {
        throw new PrimitiveError("다른 명령에서 이 광원을 켜고 있어 광원 이름을 바꿀 수 없습니다.");
      }
      if (isDefaultLight(newId)
        || hasCommandReference(project, row => (row.kind === "addLight" && normalizeLightSource(row.source).id === newId)
          || (row.kind === "removeLight" && row.all !== true && row.id === newId))) {
        throw new PrimitiveError("이미 쓰는 광원 이름입니다. 새 이름을 골라 주세요.");
      }
      if (hasUnresolvedSlotScript(project, "light")) {
        throw new PrimitiveError("스크립트에서 이 광원을 사용하는지 확인할 수 없어 이름을 바꿀 수 없습니다.");
      }
    }
  }
}

/** Copies plain command data as a tree, including optional fields stored as undefined. */
function copyCommandData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyCommandData) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyCommandData(child)])) as T;
  }
  return value;
}

function isolateSharedBranch(page: EventPage, branchPath: readonly number[]): EventPage {
  if (branchPath.length === 0) return page;
  const selected = commandListAt(page, branchPath);
  let seen = false;
  const repeatsSelectedList = (list: readonly Command[]): boolean => {
    if (list !== selected) return list.some(command => nestedCommandLists(command).some(repeatsSelectedList));
    if (seen) return true;
    seen = true;
    return false;
  };
  // structuredClone keeps shared arrays. Editing one occurrence must leave the other branches intact.
  return repeatsSelectedList(page.commands) ? { ...page, commands: copyCommandData(page.commands) } : page;
}

function prepareEdit(ctx: PrimitiveContext, args: Args, kind: Kind, mode: Mode) {
  const { page, map, event } = scopedPage(ctx);
  const branchPath = (args.branchPath as readonly number[] | undefined) ?? [];
  const list = commandListAt(page, branchPath);
  const index = (args.index as number | undefined) ?? list.length;
  if (!Number.isSafeInteger(index) || index < 0 || index > list.length || (mode === "update" && index === list.length)) {
    throw new PrimitiveError("선택한 명령 목록에 해당 줄이 없습니다. 줄 위치를 다시 확인해 주세요.");
  }
  const row = mode === "update" ? list[index] : undefined;
  if (mode === "update" && row?.kind !== kind) {
    throw new PrimitiveError("범위 밖: 고를 수 있는 같은 종류의 명령 줄을 찾을 수 없습니다.");
  }
  const current = row?.kind === kind ? row : undefined;
  const hash = current && eventCommandHash(current);
  if (mode === "update" && args.expectedHash !== hash) {
    throw new PrimitiveError(STALE_COMMAND_LIST);
  }
  if (current && list.some((candidate, position) => position !== index && candidate.kind === kind && eventCommandHash(candidate) === hash)) {
    throw new PrimitiveError("선택한 목록에 같은 명령이 여러 개 있어 수정할 줄을 확인할 수 없습니다.");
  }
  const command = buildCommand(current ?? (newCommand(kind) as StagingCommand), args, map, event.id);
  if ((command.kind === "showPicture" || command.kind === "erasePicture")
    && args.pictureId !== undefined && Object.hasOwn(Object.prototype, command.pictureId)) {
    throw new PrimitiveError("그림 자리 이름을 다른 이름으로 입력해 주세요.");
  }
  return { map, command, branchPath, index, current, hash };
}

function safeName(name: string | undefined, fallback: string): string {
  const shown = displayText((name ?? "").replace(/[a-z0-9_.-]*[a-z][a-z0-9_.-]*|[^가-힣ㄱ-ㅎㅏ-ㅣ\p{N}\s]/giu, " "), fallback);
  return /[가-힣]/u.test(shown) ? shown : fallback;
}

function referenceName(project: Project, id: string, fallback: string, catalogName?: string): string {
  const actorId = actorPictureActorId(id);
  const name = actorId ? project.database.actors.find(actor => actor.id === actorId)?.name
    : project.assets.uploaded[id]?.name ?? project.resourceProfiles.find(profile => profile.assetId === id)?.name ?? catalogName;
  return displayText(name === (actorId ?? id) ? "" : (name ?? "").replace(/[\[\]{}]/gu, " "), fallback);
}

function pictureSlotName(id: string): string {
  return /^pic\d+$/u.test(id) ? `${id.slice(3)}번 자리` : safeName(id, "지정한 그림 자리");
}

function summaryDetails(ctx: PrimitiveContext, map: GameMap, cmd: StagingCommand, args: Args): string {
  function targetSummary(at: LightSourceAnchor): string {
    if (typeof at === "object" && "eventId" in at) {
      const event = map.events.find(entry => entry.id === at.eventId);
      if (!at.eventId || (ctx.target.kind === "event" && at.eventId === ctx.target.eventId)) return "이 이벤트";
      return event ? safeName(eventName(event), "다른 인물") : "찾을 수 없는 이벤트";
    }
    return at === "player" ? "주인공" : `${at.x}, ${at.y} 칸`;
  }
  const { project } = ctx;
  const detail = (command: StagingCommand) => commandSummary(command).split(": ").slice(1).join(": ").replace(/(\d)ms\b/gu, "$1밀리초");
  switch (cmd.kind) {
    case "showAnimation": {
      const fx = parseFieldFxId(cmd.animationId);
      const fallback = fx?.kind === "doorOpen" ? "문 열기"
        : fx?.kind === "container" ? "수납함 열기"
        : fx?.kind === "popupGold" ? `돈 ${fx.amount} 표시`
        : fx?.kind === "popupItem" ? safeName(project.database.items.find(item => item.id === fx.itemId)?.name, "아이템 표시")
        : "지정한 연출";
      const name = safeName(project.database.battleAnimations.find(animation => animation.id === cmd.animationId)?.name, fallback);
      return detail({ ...cmd, target: "player", animationId: "" })
        .replace("주인공", () => targetSummary(cmd.target)).replace("(연출 선택)", () => name);
    }
    case "showEmote":
      return `${EMOTE_LABELS[cmd.emote]} · ${targetSummary(cmd.target)}${cmd.durationMs === undefined ? "" : ` · ${cmd.durationMs / 1000}초`}`;
    case "showPicture":
      return [
        referenceName(project, cmd.resourceId, "지정한 그림"),
        args.pictureId !== undefined ? pictureSlotName(cmd.pictureId) : "",
        args.x !== undefined || args.y !== undefined ? `위치 (${cmd.x}, ${cmd.y})` : "",
        args.scale !== undefined ? `크기 ${cmd.scale}%` : "",
        args.opacity !== undefined ? `불투명도 ${Math.round((cmd.opacity ?? 255) / 255 * 100)}%` : "",
        args.rotation !== undefined ? `회전 ${cmd.rotation}도` : "",
        args.durationMs !== undefined ? `전환 시간 ${cmd.durationMs}밀리초` : "",
        args.easing !== undefined ? EASING_LABELS[cmd.easing ?? "linear"] : "",
        args.blendMode !== undefined ? `겹치기 ${BLEND_MODE_LABELS[cmd.blendMode ?? "normal"]}` : "",
        args.waitForPicture !== undefined ? (cmd.waitForPicture ? "전환이 끝날 때까지 대기" : "바로 다음 줄로") : "",
        args.recordInGallery !== undefined ? (cmd.recordInGallery ? "갤러리에 기록" : "갤러리 기록 끄기") : "",
      ].filter(Boolean).join(" · ");
    case "erasePicture":
      return pictureSlotName(cmd.pictureId);
    case "playAudio": {
      const channel = audioNames[cmd.channel ?? (cmd.loop ? "bgm" : "se")] ?? "지정한 소리";
      const catalogName = findBgmTrack(cmd.resourceId)?.title ?? SE_CATALOG.find(entry => entry.id === cmd.resourceId)?.title;
      return detail({ ...cmd, resourceId: "" }).replace("(선택 없음)", () => referenceName(project, cmd.resourceId, channel, catalogName));
    }
    case "stopAudio":
      return cmd.channel ? audioNames[cmd.channel] ?? "지정한 소리" : "모든 소리";
    case "playMovie":
      return [
        referenceName(project, cmd.resourceId, "지정한 동영상", cmd.resourceId === SAMPLE_MOVIE_RESOURCE.id ? SAMPLE_MOVIE_RESOURCE.name : undefined),
        cmd.wait === false ? "바로 다음 줄로" : "영상이 끝날 때까지 대기",
        cmd.skippable === false ? "건너뛰기 금지" : "건너뛰기 허용",
      ].join(" · ");
    case "addLight": {
      const { source } = cmd;
      const cone = source.cone;
      return [
        args.color !== undefined ? `색 ${source.color}` : "",
        args.edge !== undefined ? (source.edge === "hard" ? "또렷한 가장자리" : "부드러운 가장자리") : "",
        cone && (args.coneDegrees !== undefined || args.coneFacing !== undefined)
          ? `부채꼴 ${cone.degrees}도${cone.facing ? ` ${lightFacingNames[cone.facing]}` : ""}` : "",
        targetSummary(source.at),
        `반지름 ${source.radius}칸`,
        args.intensity !== undefined && source.intensity !== undefined ? `세기 ${Math.round(source.intensity * 100)}%` : "",
        args.flicker !== undefined ? (source.flicker ? "깜빡임 켬" : "깜빡임 끔") : "",
      ].filter(Boolean).join(" · ");
    }
    case "removeLight":
      return cmd.all ? "모든 광원" : safeName(cmd.id, "지정한 광원");
    case "setLighting":
      return `어둠 ${detail(cmd)}${args.color === undefined ? "" : " · 어둠 색 지정"}`;
    case "setWeather":
      return cmd.weather === "none" ? "날씨 효과 끄기" : detail(cmd);
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
        index: integer(mode === "insert" ? "끼워 넣을 줄 위치. 0은 첫 줄, 생략하면 맨 끝." : "바꿀 줄 위치. 첫 줄은 0.", 0, Number.MAX_SAFE_INTEGER),
        branchPath: { type: "array", items: { type: "integer" }, description: "분기 안의 명령이면 읽기 결과의 분기 경로. 바깥 목록이면 생략." },
        ...(mode === "update" ? { expectedHash: text("이벤트를 읽을 때 받은 줄 확인값. 명령이 바뀌었으면 수정을 중단합니다.") } : {}),
      },
      required: mode === "update" ? ["index", "expectedHash"] : spec.insertRequired ?? [],
      additionalProperties: false,
    },
    scope(ctx): PageScope {
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { map, command } = prepareEdit(ctx, args, kind, mode);
      const ending = ` 명령을 ${action}합니다.`;
      const subject = `${spec.title}(${summaryDetails(ctx, map, command, args)})`;
      const limit = 80 - ending.length;
      return `${subject.length > limit ? subject.slice(0, limit - 2) + "…)" : subject}${ending}`;
    },
    apply(ctx, args) {
      const { map, command, branchPath, index, current, hash } = prepareEdit(ctx, args, kind, mode);
      validateReferences(ctx.project, command, current);
      const after = updateScopedPage(ctx, page => {
        try {
          const path = [...branchPath, index];
          const isolatedPage = isolateSharedBranch(page, branchPath);
          if (mode === "insert") return insertEventCommand(isolatedPage, path, command);
          const patch: Args = { ...command };
          const removed = Object.keys(current!).filter(key => !Object.hasOwn(command, key));
          for (const key of removed) patch[key] = undefined;
          const edited = updateEventCommand(isolatedPage, path, patch, hash!);
          const row = commandListAt(edited, branchPath)[index]!;
          for (const key of removed) Reflect.deleteProperty(row, key);
          return edited;
        } catch (error) {
          if (!(error instanceof EventCommandEditError)) throw error;
          throw new PrimitiveError("명령 줄의 위치나 설정을 다시 확인해 주세요.");
        }
      });
      validateSlotRename(ctx.project, after, map, command, current);
      return after;
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(specs) as Kind[]).flatMap(
  kind => [makePrimitive(kind, "insert"), makePrimitive(kind, "update")],
);
