import { listAudioResources } from "@/assets/audioResourceCatalog";
import { isBgmCatalogResourceId } from "@/assets/bgmCatalogRuntime";
import { newM2Command } from "@/editor/eventCommandFactory";
import type { JsonSchema } from "@/editor/tools/types";
import { isRecognizedTintValue } from "@/player/screen/tintModel";
import { parseDoorValue } from "@/project/eventCommands/doorAnimation";
import { M2_COMMAND_CATALOG, type M2CommandCatalogEntry } from "@/project/eventCommands/m2Catalog";
import { eventCommandHash, EventCommandEditError, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import type { Command, GameMap, M2CommandFields } from "@/project/types";
import { commandListAt, eventName, scopedPage, updateScopedPage } from "../core/helpers";
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

const spriteLookFields = ["pose", "tint", "tintHex", "tintFill", "flip", "afterimage", "angle", "opacity"] as const;

function eventScope(ctx: PrimitiveContext) {
  const { map, event, page } = scopedPage(ctx);
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

function sameMapEvent(map: GameMap, eventId: string) {
  const event = map.events.find(event => event.id === eventId);
  if (!event) throw new PrimitiveError("이 맵에서 대상 이벤트를 찾을 수 없습니다.");
  return event;
}

function requireMapTile(map: GameMap, x: number, y: number): void {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
    throw new PrimitiveError("범위 밖: 선택한 맵 안의 칸을 지정해 주세요.");
  }
}

function requireAudio(ctx: PrimitiveContext, resourceId: string, soundOnly: boolean): void {
  if (!soundOnly && isBgmCatalogResourceId(resourceId)) return;
  const kinds = soundOnly ? ["sound"] as const : ["music", "sound"] as const;
  for (const kind of kinds) {
    if (listAudioResources(kind, ctx.project).some(resource => resource.id === resourceId)) return;
  }
  throw new PrimitiveError(soundOnly ? "기계음에 쓸 효과음을 찾을 수 없습니다." : "재생할 소리 자료를 찾을 수 없습니다.");
}

function applyFields(ctx: PrimitiveContext, row: string, fields: M2CommandFields, patch: M2CommandFields) {
  const { map, event } = scopedPage(ctx);
  if (row === "046" && "color" in patch && !("value" in patch)) {
    // A legacy custom color takes precedence over the color preset.
    fields.value = "";
  }
  if (row === "046" && "value" in patch && !isRecognizedTintValue(textField(fields, "value"))) {
    throw new PrimitiveError("화면 색 값을 확인해 주세요.");
  }
  if (row === "030" && !textField(fields, "value")) throw new PrimitiveError("화면 전환 값을 입력해 주세요.");
  if (row === "048" && "intensity" in patch) fields.value = Number(fields.intensity);
  if (row === "052" && (!textField(fields, "pictureId") || Object.hasOwn(Object.prototype, textField(fields, "pictureId")))) {
    throw new PrimitiveError("이동할 그림 칸을 확인해 주세요.");
  }
  if (row === "052" && "pictureId" in patch) fields.pictureId = textField(fields, "pictureId");
  if (row === "056") {
    if ("target" in patch && !textField(fields, "target")) throw new PrimitiveError("섬광을 줄 이벤트를 골라 주세요.");
    fields.target = textField(fields, "target") || textField(fields, "eventId") || event.id;
    if (fields.target === "this-event") fields.target = event.id;
    sameMapEvent(map, fields.target);
    if ("color" in patch || fields.value === "flash" || !fields.value) fields.value = fields.color ?? "white";
  }
  if (row === "201") {
    if ("target" in patch || "targetEventId" in patch) {
      // Move legacy explicit event pointers together when retargeting a camera.
      delete fields.eventId;
      if (!("targetEventId" in patch)) delete fields.targetEventId;
    }
    const target = textField(fields, "target");
    const explicit = textField(fields, "targetEventId") || textField(fields, "eventId");
    if ("targetEventId" in patch) {
      if (!explicit) throw new PrimitiveError("카메라가 볼 이벤트를 골라 주세요.");
      fields.targetEventId = explicit;
    }
    const named = explicit || (!["", "player", "this-event", "screen", "position", "fixed"].includes(target)
      ? target.replace(/^event:/u, "") : "");
    if (named) sameMapEvent(map, named);
    const positionTarget = ["screen", "position", "fixed"].includes(target);
    if ("target" in patch && !positionTarget && !("x" in patch || "y" in patch)) {
      fields.x = 0;
      fields.y = 0;
    }
    const x = Number(fields.x ?? 0);
    const y = Number(fields.y ?? 0);
    const implicitPosition = ["", "panTo", "pan", "zoom"].includes(textField(fields, "mode")) && (x !== 0 || y !== 0) && !explicit;
    if (fields.mode !== "return" && (positionTarget || implicitPosition)) {
      if (named) throw new PrimitiveError("카메라의 칸과 이벤트 중 하나를 골라 주세요.");
      requireMapTile(map, x, y);
    }
  }
  if (row === "202" && (fields.effect === "doorOpen" || fields.effect === "doorClose")) {
    const door = parseDoorValue(textField(fields, "value"));
    if (!door) throw new PrimitiveError("문 그림의 위치와 크기, 여는 방식을 확인해 주세요.");
    requireMapTile(map, door.x, door.y);
    requireMapTile(map, door.x + door.w - 1, door.y + door.h - 1);
  }
  if (row === "210") {
    const resourceId = textField(fields, "resourceId");
    requireAudio(ctx, resourceId, false);
    if ("resourceId" in patch) fields.resourceId = resourceId;
  }
  if (row === "224" || row === "225") {
    if (fields.target === "event" || textField(patch, "eventId")) {
      const eventId = textField(fields, "eventId");
      sameMapEvent(map, eventId);
      if ("eventId" in patch) fields.eventId = eventId;
    }
    if (fields.target === "tile") requireMapTile(map, Number(fields.x ?? 0), Number(fields.y ?? 0));
  }
  if (row === "225" && textField(fields, "opacity") && Number(fields.opacity) > 100) {
    throw new PrimitiveError("불투명도는 0에서 100 사이로 입력해 주세요.");
  }
  if (row === "226") {
    const se = textField(fields, "se");
    if (se) requireAudio(ctx, se, true);
    if ("se" in patch) fields.se = se;
    const x = Number(fields.x ?? -1);
    const y = Number(fields.y ?? -1);
    if (x !== -1) requireMapTile(map, x, 0);
    if (y !== -1) requireMapTile(map, 0, y);
  }
}

function authoredFields(entry: M2CommandCatalogEntry, row: string, patch: M2CommandFields): M2CommandFields {
  const { fields } = newM2Command(entry.id);
  if (row === "030") fields.value = "fade";
  if (row === "052") {
    // A move that only changes position carries the current picture styling through.
    delete fields.scale;
    delete fields.opacity;
  }
  return { ...fields, ...patch };
}

function edit(ctx: PrimitiveContext, args: Args, entry: M2CommandCatalogEntry, row: string, operation: Operation, properties: Record<string, JsonSchema>) {
  const { page } = scopedPage(ctx);
  const branchPath = (args.branchPath ?? []) as number[];
  const list = commandListAt(page, branchPath);
  const index = (args.index as number | undefined) ?? list.length;
  const path = [...branchPath, index];
  const patch = Object.fromEntries(Object.entries(args).filter(([key]) => Object.hasOwn(properties, key))) as M2CommandFields;
  let current: M2Command | undefined;
  if (operation === "update") {
    const command = list[index];
    const oldRow = (args.replaceFrom as string | undefined) ?? fixedPairs[row] ?? row;
    const expectedId = catalogRow(oldRow).id;
    if (command?.kind !== "m2Command" || command.commandId !== expectedId) {
      throw new PrimitiveError("범위 밖: 바꿀 종류에 맞는 연출 명령 줄을 골라 주세요.");
    }
    if (oldRow === row && Object.keys(patch).length === 0) throw new PrimitiveError("바꿀 연출 값을 한 가지 이상 입력해 주세요.");
    current = command;
  }
  const fields = current?.commandId === entry.id ? { ...current.fields, ...patch } : authoredFields(entry, row, patch);
  if (row === "225" && current?.commandId === entry.id && patch.reset === true) {
    // An explicit reset clears old look overrides unless the request supplies them again.
    for (const key of spriteLookFields) if (!Object.hasOwn(patch, key)) delete fields[key];
  }
  applyFields(ctx, row, fields, patch);
  return { path, current, fields };
}

function fieldLabel(entry: M2CommandCatalogEntry, key: string, fields: M2CommandFields): string {
  const options = entry.fields.find(field => field.key === key)?.options;
  return options?.find(option => option.value === String(fields[key]))?.label.split(" (")[0] ?? "";
}

function description(ctx: PrimitiveContext, row: string, entry: M2CommandCatalogEntry, fields: M2CommandFields): string {
  const label = (key: string) => fieldLabel(entry, key, fields);
  const duration = typeof fields.durationMs === "number" && fields.durationMs > 0 ? `${fields.durationMs / 1000}초` : "";
  switch (row) {
    case "030": return "화면 전환 설정을 기록합니다.";
    case "044": return "화면을 천천히 감춥니다.";
    case "045": return "숨긴 화면을 천천히 다시 보여 줍니다.";
    case "046": {
      const hasFilter = Number(fields.saturation ?? 100) !== 100 || Number(fields.grayscale ?? 0) > 0 || Number(fields.sepia ?? 0) > 0;
      if (hasFilter || textField(fields, "value")) return "화면의 색조와 색감을 조정합니다.";
      return !label("color") || fields.color === "neutral"
        ? "화면 색조를 기본으로 되돌립니다."
        : `화면을 ${label("color")} 색조로 바꿉니다.`;
    }
    case "047": return `화면을 ${label("color") || "지정한 색"}으로${duration ? ` ${duration} 동안` : ""} 번쩍이게 합니다.`;
    case "048": return `화면을${duration ? ` ${duration} 동안` : ""} ${label("direction") || "사방"} 방향으로 ${label("intensity") || "보통으로"} 흔듭니다.`;
    case "052": return `그림을${duration ? ` ${duration}에 걸쳐` : ""} 지정한 위치로 옮깁니다.`;
    case "056": {
      const { map } = scopedPage(ctx);
      const event = sameMapEvent(map, textField(fields, "target"));
      const name = eventName(event);
      return /[{}\[\]]|\bm2[-.]\d+/iu.test(name) ? "지정한 이벤트의 섬광 설정을 기록합니다." :
        `『${name.slice(0, 42)}』에 쓸 섬광 설정을 기록합니다.`;
    }
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
    case "202": return `화면에 ${label("effect") || "지정한"} 효과를 적용합니다.`;
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
        expectedHash: { type: "string", minLength: 1, description: "읽어 온 기존 명령 줄의 확인값" } as const,
        replaceFrom: { type: "string", enum: Object.keys(COMMAND_TITLES).filter(candidate => candidate !== row),
          description: "연출 종류 자체를 바꿀 때만 현재 명령의 세 자리 목록 번호를 입력합니다." } as const,
      } : {}),
      ...properties,
    },
    required: operation === "update" ? ["index"] : row === "210" ? ["resourceId"] : [],
    additionalProperties: false,
  };
  return {
    id: `m2.${row}.${operation}`,
    unit: UNIT,
    title: `${title} ${operation === "insert" ? "추가" : "수정"}`,
    covers: { m2Ids: [`m2-${row}`] },
    targets: ["event"],
    args,
    scope: eventScope,
    describe(ctx, values) {
      const { fields } = edit(ctx, values, entry, row, operation, properties);
      return description(ctx, row, entry, fields);
    },
    apply(ctx, values) {
      const { path, current, fields } = edit(ctx, values, entry, row, operation, properties);
      try {
        return updateScopedPage(ctx, page => current
          ? updateEventCommand(page, path, { commandId: entry.id, fields }, (values.expectedHash as string | undefined) ?? eventCommandHash(current))
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
