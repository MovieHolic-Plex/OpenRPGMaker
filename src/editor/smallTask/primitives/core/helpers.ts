import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { eventNameFromPages } from "@/project/eventDisplayName";
import { insertEventCommand } from "@/project/eventCommands/singleCommandOps";
import type { Command, EventPage, GameEvent, GameMap } from "@/project/types";
import { displayText } from "../../target";
import { PrimitiveError, SELECT_EVENT_PAGE } from "../errors";
import type { PrimitiveContext } from "../types";

export function scopedPage(ctx: PrimitiveContext) {
  const { project, target } = ctx;
  if (target.kind !== "event") throw new PrimitiveError("범위 밖: 먼저 이벤트를 골라 주세요.");
  const map = project.maps[target.mapId];
  const event = map?.events.find(entry => entry.id === target.eventId);
  if (target.pageId === undefined && (event?.pages?.length ?? 0) > 1) {
    throw new PrimitiveError(SELECT_EVENT_PAGE);
  }
  const page = target.pageId === undefined ? event?.pages?.[0] : event?.pages?.find(entry => entry.id === target.pageId);
  if (!map || !event || !page) throw new PrimitiveError("선택한 이벤트의 페이지를 찾을 수 없어요.");
  return { map, event, page };
}

export function updateScopedPage(ctx: PrimitiveContext, edit: (page: EventPage) => EventPage) {
  const { map, event, page } = scopedPage(ctx);
  const edited = edit(page);
  if (edited === page) return ctx.project;
  const events = map.events.map(entry => entry === event
    ? { ...event, pages: event.pages!.map(row => row === page ? edited : row) }
    : entry);
  return { ...ctx.project, maps: { ...ctx.project.maps, [map.id]: { ...map, events } } };
}

export function commandListAt(page: EventPage, branchPath: readonly number[] = []) {
  if (branchPath.length % 2 !== 0 || branchPath.some((index, offset) =>
    !Number.isSafeInteger(index) || (offset % 2 === 0 && index < 0))) {
    throw new PrimitiveError("명령 분기 위치가 올바르지 않아요.");
  }
  const list = resolveCommandListAtPath(page.commands, [...branchPath, 0]);
  if (!list) throw new PrimitiveError("선택한 명령 분기를 찾을 수 없어요.");
  return list;
}

/** Defaults to appending to the selected list, including when it is empty. */
export function insertAtIndex(ctx: PrimitiveContext, command: Command, index?: number, branchPath: readonly number[] = []) {
  return updateScopedPage(ctx, page => {
    const list = commandListAt(page, branchPath);
    return insertEventCommand(page, [...branchPath, index ?? list.length], command);
  });
}

function readableName(id: string, name: string | undefined, fallback: string) {
  const words = name === id ? "" : name ?? "";
  return displayText(words, fallback);
}

export function eventName(event: Pick<GameEvent, "id" | "name" | "pages" | "commands">): string {
  return readableName(event.id, event.name || eventNameFromPages(event), "이벤트");
}

export function mapName(map: Pick<GameMap, "id" | "name">): string {
  return readableName(map.id, map.name, "맵");
}

export function recordName(collection: string, record: { id: string; name?: string; title?: string; label?: string }): string {
  return readableName(record.id, record.name || record.title || record.label, DATABASE_AREA_LABELS[collection] ?? "자료집 항목");
}

export function koreanSentence(value: string): string {
  const text = displayText(value, "선택한 대상을 고쳤어요.");
  return text.length > 80 ? `${text.slice(0, 78)}….` : text;
}
