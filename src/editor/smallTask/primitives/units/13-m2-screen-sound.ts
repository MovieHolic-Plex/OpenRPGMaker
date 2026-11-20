import { listAudioResources } from "@/assets/audioResourceCatalog";
import { isBgmCatalogResourceId } from "@/assets/bgmCatalogRuntime";
import { newM2Command } from "@/editor/eventCommandFactory";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import type { JsonSchema } from "@/editor/tools/types";
import { resolveAudioSource } from "@/player/audio/audioResources";
import { isScreenColorName } from "@/player/interpreter/commandCatalog";
import { FREEZE_STYLES } from "@/player/interpreter/screenEffectPlan";
import { isRecognizedTintValue } from "@/player/screen/tintModel";
import { LETTERBOX_LIMITS } from "@/project/eventCommands/cinematicStaging";
import { parseDoorValue } from "@/project/eventCommands/doorAnimation";
import { M2_COMMAND_CATALOG, type M2CommandCatalogEntry } from "@/project/eventCommands/m2Catalog";
import { SCREEN_DISTORTION_LIMITS } from "@/project/eventCommands/screenDistortion";
import { eventCommandHash, EventCommandEditError, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import type { Command, GameMap, M2CommandFields, Project } from "@/project/types";
import { commandListAt, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { COMMAND_TITLES, modelFields } from "./13-m2-screen-sound/catalog";

export const UNIT = "13-m2-screen-sound";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type Args = Record<string, unknown>;
type Operation = "insert" | "update";

const fixedPairs: Readonly<Record<string, string>> = {
  "044": "045", "045": "044", "063": "064", "064": "063",
};

const unavailable: Readonly<Record<string, string>> = {
  "030": "다음 화면 전환을 미리 예약하는 기능은 아직 게임에서 지원하지 않습니다.",
  "056": "이벤트에만 섬광을 표시하는 기능은 아직 게임에서 지원하지 않습니다.",
};
const pictureCommands = new Set(["m2-051-show-picture", "m2-052-move-picture"]);
const memorizeBgmId = "m2-063-memorize-current-bgm";
const replayBgmId = "m2-064-play-memorized-bgm";

const spriteLookFields = ["pose", "tint", "tintHex", "tintFill", "flip", "afterimage", "angle", "opacity"] as const;

function uniqueScopedPage(ctx: PrimitiveContext) {
  const resolved = scopedPage(ctx);
  const { map, event, page } = resolved;
  if (ctx.target.kind !== "event" || ctx.target.mapId !== map.id ||
      map.events.filter(candidate => candidate.id === event.id).length !== 1 ||
      event.pages?.filter(candidate => candidate.id === page.id).length !== 1) {
    throw new PrimitiveError("범위 밖: 같은 식별자를 쓰는 이벤트나 페이지가 있어 작업 대상을 확인할 수 없습니다.");
  }
  return resolved;
}

function eventScope(ctx: PrimitiveContext) {
  const { map, event, page } = uniqueScopedPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id } as const;
}

function catalogRow(row: string): M2CommandCatalogEntry {
  const entry = M2_COMMAND_CATALOG.find(entry => entry.index === Number(row));
  if (!entry || entry.deprecated) throw new PrimitiveError("사용할 수 없는 연출 명령입니다.");
  return entry;
}

function textField(fields: M2CommandFields, key: string): string {
  return String(fields[key] ?? "").trim();
}

function requireMapEvent(map: GameMap, eventId: string): void {
  if (!eventId || map.events.filter(event => event.id === eventId).length !== 1) {
    throw new PrimitiveError("이 맵에서 대상 이벤트를 하나로 특정할 수 없습니다.");
  }
}

function requireMapTile(map: GameMap, x: number, y: number): void {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
    throw new PrimitiveError("범위 밖: 선택한 맵 안의 칸을 지정해 주세요.");
  }
}

function requireAudio(ctx: PrimitiveContext, resourceId: string, soundOnly: boolean): void {
  if (!soundOnly && isBgmCatalogResourceId(resourceId)) return;
  const kinds = soundOnly ? ["sound"] as const : ["music", "sound"] as const;
  if (resolveAudioSource(resourceId, ctx.project) &&
      kinds.some(kind => listAudioResources(kind, ctx.project).some(resource => resource.id === resourceId))) return;
  throw new PrimitiveError(soundOnly ? "기계음에 쓸 효과음을 찾을 수 없습니다." : "재생할 소리 자료를 찾을 수 없습니다.");
}

function hasProjectCommand(project: Project, matches: (command: Command) => boolean): boolean {
  let found = false;
  visitProjectCommands(project, ({ command }) => {
    if (!found && matches(command)) found = true;
  });
  return found;
}

function hasPictureSource(project: Project, pictureId: string): boolean {
  return hasProjectCommand(project, command => command.kind === "showPicture"
    ? command.pictureId === pictureId && Boolean(command.resourceId.trim())
    : command.kind === "m2Command" && pictureCommands.has(command.commandId) &&
      String(command.fields.pictureId ?? "pic1") === pictureId && Boolean(textField(command.fields, "resourceId")));
}

function requireEffectValue(effect: string, value: string, map: GameMap): void {
  if (effect === "doorOpen" || effect === "doorClose") {
    const door = parseDoorValue(value);
    const [x, y, ...parts] = value.split(/[\s,]+/u);
    const size = parts.slice(0, 2).filter(part => /^[+-]?\d/u.test(part));
    if (!door || !/^\d+$/u.test(x ?? "") || !/^\d+$/u.test(y ?? "") ||
        size.some(part => !/^[1-8]$/u.test(part))) {
      throw new PrimitiveError("문 그림의 왼쪽 위 칸과 가로·세로 크기(1~8칸)를 확인해 주세요.");
    }
    if (parts.slice(size.length).some(part => !/^(?:slide|swing|shutter|left|right|both|lit|dark|none|fit|[lrtb]\d{1,3})$/u.test(part))) {
      throw new PrimitiveError("문을 여는 방식과 문틀 설정을 확인해 주세요.");
    }
    requireMapTile(map, door.x, door.y);
    requireMapTile(map, door.x + door.w - 1, door.y + door.h - 1);
    return;
  }
  if (!value) return;
  switch (effect) {
    case "flash":
      if (isScreenColorName(value) || /^#?[0-9a-f]{6}$/iu.test(value)) return;
      throw new PrimitiveError("섬광 색을 이름이나 여섯 자리 색상 코드로 입력해 주세요.");
    case "tint":
      requireTint(value);
      return;
    case "freeze":
      if ((FREEZE_STYLES as readonly string[]).includes(value.toLowerCase())) return;
      throw new PrimitiveError("정지 화면에 쓸 색감을 목록에서 골라 주세요.");
    case "weather":
      if (/^(?:none|off|clear|rain|비|storm|thunder(?:storm)?|폭풍|snow|눈|fog|mist|안개)(?:[\s,:;]+(?:\d+(?:\.\d+)?|\.\d+))?$/iu.test(value) &&
          Number(value.split(/[\s,:;]+/u)[1] ?? 0) <= 10) return;
      throw new PrimitiveError("날씨 종류와 강도(0~10)를 확인해 주세요.");
    case "letterbox":
    case "wave":
    case "mosaic":
    case "rotate": {
      const { min, max } = effect === "letterbox" ? LETTERBOX_LIMITS : SCREEN_DISTORTION_LIMITS[effect];
      const amount = Number(value);
      if (Number.isFinite(amount) && amount >= min && amount <= max) return;
      throw new PrimitiveError(`이 화면 효과의 세기는 ${min}에서 ${max} 사이로 입력해 주세요.`);
    }
    default:
      throw new PrimitiveError("이 화면 효과는 별도 설정값 없이 사용해 주세요.");
  }
}

function requireTint(value: string): void {
  const levels = value.includes(",") ? value.split(",").map(Number) : [];
  if (!isRecognizedTintValue(value) || levels.length > 4 ||
      levels.some((level, index) => level < 0 || level > (index === 3 ? 1 : 255))) {
    throw new PrimitiveError("화면 색을 확인해 주세요. 빨강·초록·파랑은 0~255, 불투명도는 0~1입니다.");
  }
}

function validateCamera(map: GameMap, fields: M2CommandFields, patch: M2CommandFields): void {
  const hasCoordinates = "x" in patch || "y" in patch;
  const hasEvent = "targetEventId" in patch;
  const mode = textField(fields, "mode");
  if (patch.mode === "zoom" && fields.zoom === undefined) {
    throw new PrimitiveError("카메라 확대 배율을 입력해 주세요.");
  }
  if ("mode" in patch) {
    delete fields.return;
    if (mode === "return" && !("zoom" in patch)) delete fields.zoom;
  }
  if ("target" in patch || hasEvent) {
    delete fields.eventId;
    if (!hasEvent) delete fields.targetEventId;
  }
  const positionTargets = ["screen", "position", "fixed"];
  let target = textField(fields, "target") || "player";
  if (hasEvent) {
    fields.targetEventId = textField(fields, "targetEventId");
    if (!fields.targetEventId) throw new PrimitiveError("카메라가 볼 이벤트를 골라 주세요.");
    if (!("target" in patch) && positionTargets.includes(target)) fields.target = target = "player";
  }
  const tracksCoordinates = positionTargets.includes(target);
  const explicit = fields.targetEventId === undefined ? textField(fields, "eventId") : textField(fields, "targetEventId");
  const named = explicit || (!["player", "this-event", ...positionTargets].includes(target) ? target.replace(/^event:/u, "") : "");
  if (["return", "restore", "followPlayer"].includes(mode)) {
    if (hasCoordinates || hasEvent || ("target" in patch && target !== "player")) {
      throw new PrimitiveError("카메라를 주인공에게 돌려놓을 때는 다른 대상이나 칸을 고를 수 없습니다.");
    }
    if ("mode" in patch) {
      fields.target = "player";
      delete fields.targetEventId;
      delete fields.eventId;
      delete fields.x;
      delete fields.y;
    }
    return;
  }
  if ((hasCoordinates && (named || ("target" in patch && !tracksCoordinates))) ||
      (hasEvent && "target" in patch && target !== "player")) {
    throw new PrimitiveError("카메라가 볼 칸이나 대상을 하나만 골라 주세요.");
  }
  if (named && (hasEvent || !tracksCoordinates)) requireMapEvent(map, named);
  if (hasCoordinates && !tracksCoordinates) {
    if (target === "this-event" || fields.targetEventId !== undefined || fields.eventId !== undefined) {
      throw new PrimitiveError("카메라가 볼 칸으로 바꾸려면 화면 위치를 대상으로 골라 주세요.");
    }
    fields.target = "screen";
  }
  if ("target" in patch && !tracksCoordinates) {
    fields.x = 0;
    fields.y = 0;
  }
  const x = Number(fields.x ?? 0);
  const y = Number(fields.y ?? 0);
  const legacyPosition = !["follow", "fixed", "lock"].includes(mode) && (x !== 0 || y !== 0) &&
    fields.targetEventId === undefined && fields.eventId === undefined;
  if (tracksCoordinates || hasCoordinates || legacyPosition) requireMapTile(map, x, y);
}

function applyFields(ctx: PrimitiveContext, map: GameMap, row: string, fields: M2CommandFields, patch: M2CommandFields) {
  if (row === "046" && "color" in patch && !("value" in patch)) {
    // A legacy custom color takes precedence over the color preset.
    fields.value = "";
  }
  if (row === "046" && "value" in patch) {
    fields.value = textField(fields, "value");
    requireTint(fields.value);
  }
  if (row === "048" && "intensity" in patch) fields.value = Number(fields.intensity);
  if (row === "052") {
    const pictureId = String(fields.pictureId ?? "pic1");
    if (!pictureId.trim() || Object.hasOwn(Object.prototype, pictureId)) {
      throw new PrimitiveError("이동할 그림 칸 이름을 확인해 주세요.");
    }
  }
  if (row === "201") validateCamera(map, fields, patch);
  if (row === "202" && ("effect" in patch || "value" in patch)) {
    requireEffectValue(textField(fields, "effect"), textField(fields, "value"), map);
  }
  if (row === "210") {
    const resourceId = textField(fields, "resourceId");
    requireAudio(ctx, resourceId, false);
    if ("resourceId" in patch) fields.resourceId = resourceId;
  }
  if (row === "224" || row === "225") {
    if ("eventId" in patch) fields.eventId = textField(fields, "eventId");
    if (fields.target === "event") {
      requireMapEvent(map, String(fields.eventId ?? ""));
    } else if ("eventId" in patch || "target" in patch) {
      if (textField(patch, "eventId")) throw new PrimitiveError("이벤트를 지정하려면 대상을 ‘특정 이벤트’로 골라 주세요.");
      delete fields.eventId;
    }
    if (fields.target === "tile") {
      requireMapTile(map, Number(fields.x ?? 0), Number(fields.y ?? 0));
    } else if ("x" in patch || "y" in patch) {
      throw new PrimitiveError("칸을 지정하려면 대상을 ‘맵 좌표’로 골라 주세요.");
    }
  }
  if (row === "225") {
    if ("tint" in patch && !("tintHex" in patch)) delete fields.tintHex;
    if ("opacity" in patch && Number(fields.opacity) > 100) throw new PrimitiveError("불투명도는 0~100%로 입력해 주세요.");
    if ("angle" in patch && Math.abs(Number(fields.angle)) > 360) throw new PrimitiveError("기울기는 -360~360도로 입력해 주세요.");
  }
  if (row === "226") {
    const se = textField(fields, "se");
    if (se) requireAudio(ctx, se, true);
    if ("se" in patch) {
      if (!se) throw new PrimitiveError("승강 발판의 기계음을 끄는 기능은 아직 지원하지 않습니다.");
      fields.se = se;
    }
    const x = Number(fields.x ?? -1);
    const y = Number(fields.y ?? -1);
    if (x !== -1) {
      requireMapTile(map, x, 0);
      requireMapTile(map, x + Number(fields.width ?? 2) - 1, 0);
    }
    if (y !== -1) {
      requireMapTile(map, 0, y);
      requireMapTile(map, 0, y + Number(fields.depth ?? 2) - 1);
    }
  }
}

function authoredFields(entry: M2CommandCatalogEntry, row: string, patch: M2CommandFields): M2CommandFields {
  const { fields } = newM2Command(entry.id);
  if (row === "052") {
    // Coordinates and styling carry through when omitted.
    for (const key of ["x", "y", "scale", "opacity"]) delete fields[key];
  }
  if (row === "201") delete fields.zoom;
  if (row === "224" || row === "225") delete fields.eventId;
  return { ...fields, ...patch };
}

function edit(ctx: PrimitiveContext, args: Args, entry: M2CommandCatalogEntry, row: string, operation: Operation, properties: Record<string, JsonSchema>) {
  const limitation = unavailable[row];
  if (limitation) throw new PrimitiveError(limitation);
  const { map, page } = uniqueScopedPage(ctx);
  const branchPath = (args.branchPath ?? []) as number[];
  const list = commandListAt(page, branchPath);
  const index = (args.index as number | undefined) ?? list.length;
  if (!Number.isSafeInteger(index) || index < 0 || index >= list.length + Number(operation === "insert")) {
    throw new PrimitiveError("범위 밖: 선택한 목록에서 명령 줄 위치를 다시 확인해 주세요.");
  }
  const path = [...branchPath, index];
  const patch = Object.fromEntries(Object.entries(args).filter(([key]) => Object.hasOwn(properties, key))) as M2CommandFields;
  let current: M2Command | undefined;
  if (operation === "update") {
    const command = list[index];
    const oldRow = (args.replaceFrom as string | undefined) ?? fixedPairs[row] ?? row;
    const expectedId = catalogRow(oldRow).id;
    if (command?.kind !== "m2Command" || command.commandId !== expectedId) {
      throw new PrimitiveError("범위 밖. 선택한 줄의 기존 연출 종류를 다시 확인해 주세요.");
    }
    if (args.expectedHash !== eventCommandHash(command)) {
      throw new PrimitiveError("그 줄의 내용이 바뀌었거나 확인값이 없습니다. 줄을 다시 읽어 주세요.");
    }
    if (oldRow === row && Object.keys(patch).length === 0) throw new PrimitiveError("바꿀 연출 값을 한 가지 이상 입력해 주세요.");
    current = command;
  }
  const matching = current?.commandId === entry.id ? current : undefined;
  const fields = matching ? { ...matching.fields, ...patch } : authoredFields(entry, row, patch);
  if (row === "202" && matching && "effect" in patch && matching.fields.effect !== patch.effect && !("value" in patch)) {
    fields.value = "";
  }
  if (row === "225" && matching && patch.reset === true) {
    // An explicit reset clears old look overrides unless the request supplies them again.
    for (const key of spriteLookFields) if (!Object.hasOwn(patch, key)) delete fields[key];
  }
  applyFields(ctx, map, row, fields, patch);
  if (current?.commandId === memorizeBgmId && entry.id !== memorizeBgmId &&
      hasProjectCommand(ctx.project, command => command.kind === "m2Command" && command.commandId === replayBgmId)) {
    throw new PrimitiveError("기억한 배경 음악을 다시 재생하는 명령이 있습니다. 이 배경 음악 기억 줄은 바꿀 수 없습니다.");
  }
  const previousPictureId = String(current?.fields.pictureId ?? "pic1");
  const pictureId = String(fields.pictureId ?? "pic1");
  if (current?.commandId === "m2-052-move-picture" && textField(current.fields, "resourceId") &&
      (row !== "052" || pictureId !== previousPictureId)) {
    throw new PrimitiveError("이 줄에서 그림을 불러옵니다. 뒤에서 쓰는 그림을 지키려면 종류와 그림 칸을 그대로 두세요.");
  }
  if (row === "052" && (!matching || pictureId !== previousPictureId) && !hasPictureSource(ctx.project, pictureId)) {
    throw new PrimitiveError("이 그림 칸을 표시하는 명령을 프로젝트에서 찾을 수 없습니다.");
  }
  return { path, current, fields };
}

function fieldLabel(entry: M2CommandCatalogEntry, key: string, fields: M2CommandFields): string {
  const options = entry.fields.find(field => field.key === key)?.options;
  return options?.find(option => option.value === String(fields[key]))?.label.split(" (")[0] ?? "";
}

function description(row: string, entry: M2CommandCatalogEntry, fields: M2CommandFields): string {
  const label = (key: string) => fieldLabel(entry, key, fields);
  const duration = typeof fields.durationMs === "number" && fields.durationMs > 0 ? `${fields.durationMs / 1000}초` : "";
  switch (row) {
    case "044": return "화면을 천천히 감춥니다.";
    case "045": return "숨긴 화면을 천천히 다시 보여 줍니다.";
    case "046": {
      const hasFilter = Number(fields.saturation ?? 100) !== 100 || Number(fields.grayscale ?? 0) > 0 || Number(fields.sepia ?? 0) > 0;
      if (hasFilter || textField(fields, "value")) return "화면의 색조와 색감을 조정합니다.";
      return !label("color") || fields.color === "neutral"
        ? "화면 색조를 기본으로 되돌립니다."
        : `화면을 ${label("color")} 색조로 바꿉니다.`;
    }
    case "047": return `화면에${duration ? ` ${duration} 동안` : ""} ${label("color") || "지정한 색"} 섬광을 표시합니다.`;
    case "048": {
      const direction = fields.direction === "horizontal" ? "가로로" : fields.direction === "vertical" ? "세로로" : "사방으로";
      return `화면을${duration ? ` ${duration} 동안` : ""} ${direction} 흔듭니다. 강도는 ${fields.intensity ?? 3}입니다.`;
    }
    case "052": return fields.x !== undefined || fields.y !== undefined
      ? `그림을${duration ? ` ${duration}에 걸쳐` : ""} 지정한 위치로 옮깁니다.`
      : "그림의 이동 설정을 바꿉니다.";
    case "063": return "지금 재생 중인 배경 음악을 기억합니다.";
    case "064": return "기억해 둔 배경 음악을 다시 재생합니다.";
    case "201": {
      switch (fields.mode) {
        case "return": return "카메라를 주인공에게 돌려놓습니다.";
        case "follow": return "카메라가 지정한 대상을 따라갑니다.";
        case "zoom": return "카메라의 확대 배율을 바꿉니다.";
        case "lock": return "카메라 시점을 고정합니다.";
        default: return "카메라를 지정한 위치로 옮깁니다.";
      }
    }
    case "202": return `‘${label("effect") || "지정한 효과"}’를 화면에 적용합니다.`;
    case "210": return `지정한 소리를 음량 ${fields.volume ?? 100}%로 재생합니다.`;
    case "224": return `${label("preset") || "지정한 입자"} 효과를 표시합니다.`;
    case "225": return fields.reset === true || fields.reset === "true" ? "캐릭터의 모습 효과를 초기화합니다." : "캐릭터의 모습을 지정한 상태로 바꿉니다.";
    case "226": return `승강 발판을 ${label("direction") || "지정한 방향으로"} ${fields.distance ?? 4}칸 움직입니다.`;
    default: return "선택한 연출 명령을 설정합니다.";
  }
}

function primitive(row: string, operation: Operation): SmallTaskPrimitive {
  const entry = catalogRow(row);
  const title = COMMAND_TITLES[row]!;
  const properties = modelFields(row, entry.fields);
  const args: JsonSchema = {
    type: "object",
    ...(operation === "update" && fixedPairs[row] ? { description: "이 줄의 반대 효과를 이 명령으로 바꿉니다." } : {}),
    properties: {
      index: { type: "integer", minimum: 0, description: "첫 줄이 0인 명령 줄 번호. 추가할 때 생략하면 맨 끝" },
      branchPath: { type: "array", items: { type: "integer" }, description: "분기 안의 줄을 고를 때 읽어 온 분기 위치" },
      ...(operation === "update" ? {
        expectedHash: { type: "string", minLength: 1, description: "이벤트 조회(get_event, includeCommandHashes)에서 확인한 기존 줄의 해시" } as const,
        replaceFrom: { type: "string", enum: Object.keys(COMMAND_TITLES).filter(candidate => candidate !== row),
          description: "연출 종류 자체를 바꿀 때만 현재 명령의 세 자리 목록 번호를 입력합니다." } as const,
      } : {}),
      ...properties,
    },
    required: operation === "update" ? ["index", "expectedHash"] : row === "210" ? ["resourceId"] : [],
    additionalProperties: false,
  };
  return {
    id: `m2.${row}.${operation}`,
    unit: UNIT,
    title: `${title} ${operation === "insert" ? "추가" : "수정"}`,
    covers: { m2Ids: [`m2-${row}`] },
    ...(unavailable[row] ? { hidden: true } : {}),
    targets: ["event"],
    args,
    scope: eventScope,
    describe(ctx, values) {
      const { fields } = edit(ctx, values, entry, row, operation, properties);
      return description(row, entry, fields);
    },
    apply(ctx, values) {
      const { path, current, fields } = edit(ctx, values, entry, row, operation, properties);
      try {
        return updateScopedPage(ctx, page => current
          ? updateEventCommand(page, path, { commandId: entry.id, fields }, values.expectedHash as string)
          : insertEventCommand(page, path, { kind: "m2Command", commandId: entry.id, fields }));
      } catch (error) {
        if (!(error instanceof EventCommandEditError)) throw error;
        throw new PrimitiveError(error.code === "stale-event-command"
          ? "그 줄의 내용이 바뀌었습니다. 다시 읽은 뒤 수정하세요."
          : "명령 줄의 위치나 연출 값이 올바르지 않습니다.");
      }
    },
  };
}

function alias(row: string, kind: string, title: string): SmallTaskPrimitive {
  const unresolved = (): never => { throw new PrimitiveError("연결된 연출 명령을 찾을 수 없습니다."); };
  // The retired catalog row is accounted for by its replacement. It has no callable ID.
  const covers = row === "054" ? ["m2-054", "m2-055"] : [`m2-${row}`];
  return {
    id: `m2.${row}.insert`, unit: UNIT, title, covers: { m2Ids: covers },
    targets: ["event"], args: { type: "object", additionalProperties: false },
    aliasOf: `cmd.${kind}.insert`, hidden: true,
    scope: eventScope, describe: unresolved, apply: unresolved,
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  ...Object.keys(COMMAND_TITLES).flatMap(row => [primitive(row, "insert"), primitive(row, "update")]),
  alias("050", "setWeather", "날씨 설정"),
  alias("054", "showAnimation", "애니메이션 표시"),
  alias("066", "playMovie", "동영상 재생"),
  alias("212", "cutsceneControl", "컷신 제어"),
];
