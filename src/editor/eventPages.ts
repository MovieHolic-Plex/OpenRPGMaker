import { editorState } from "@/editor/editorState";
import { isContainerInsideCommand, moveCommandBetweenLists, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, MapId, Trigger } from "@/project/types";
import { genId } from "@/util/id";

type PagePatch = Partial<Omit<EventPage, "id">>;
let copiedEventPage: EventPage | null = null;

export function createDefaultEventPage(
  event: Pick<GameEvent, "id" | "sprite" | "trigger" | "condition" | "moveRoute" | "commands">,
  pageNumber: number
): EventPage {
  return {
    id: genId("page"),
    name: `페이지 ${pageNumber}`,
    conditions: event.condition ? [event.condition] : [],
    graphic: event.sprite ? { sprite: event.sprite } : {},
    trigger: event.trigger,
    priority: "same",
    movement: {
      type: event.moveRoute ? "custom" : "fixed",
      speed: 3,
      frequency: 3,
      route: event.moveRoute,
    },
    commands: structuredClone(event.commands),
  };
}

export function ensureEventPages(mapId: MapId, eventId: string): void {
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event || event.pages?.length) return;
    event.pages = [createDefaultEventPage(event, 1)];
  });
}

/**
 * 다음 페이지 번호를 찾는다. 단순히 `pages.length + 1` 을 쓰면 삭제 후 재추가 시
 * 기존 페이지 이름과 충돌하므로, 사용 중이지 않은 번호를 찾아 겹침을 피한다.
 */
function nextAvailablePageNumber(pages: readonly EventPage[]): number {
  const usedNames = new Set(pages.map((page) => page.name));
  let number = pages.length + 1;
  while (usedNames.has(`페이지 ${number}`)) number += 1;
  return number;
}

export function addEventPage(mapId: MapId, eventId: string): string {
  let pageId = "";
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event) return;
    if (!event.pages?.length) {
      event.pages = [createDefaultEventPage(event, 1)];
    }
    const page = createDefaultEventPage(
      {
        id: event.id,
        trigger: { kind: "action" },
        commands: [],
      },
      nextAvailablePageNumber(event.pages)
    );
    page.conditions = [];
    event.pages.push(page);
    pageId = page.id;
  });
  if (pageId) editorState.set({ selectedEventPageId: pageId });
  return pageId;
}

export function copyEventPage(mapId: MapId, eventId: string, pageId: string): string {
  let copiedId = "";
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    const source = event?.pages?.find((page) => page.id === pageId);
    if (!event || !source) return;
    const copy = structuredClone(source);
    copy.id = genId("page");
    copy.name = `${source.name} 복사본`;
    event.pages = [...(event.pages ?? []), copy];
    copiedId = copy.id;
  });
  if (copiedId) editorState.set({ selectedEventPageId: copiedId });
  return copiedId;
}

export function copyEventPageToClipboard(mapId: MapId, eventId: string, pageId: string): boolean {
  const source = store.getCurrent().maps[mapId]?.events
    .find((item) => item.id === eventId)
    ?.pages?.find((page) => page.id === pageId);
  copiedEventPage = source ? structuredClone(source) : null;
  if (copiedEventPage) editorState.set({ selectedEventPageId: pageId });
  return copiedEventPage !== null;
}

export function hasCopiedEventPage(): boolean {
  return copiedEventPage !== null;
}

export function pasteEventPage(mapId: MapId, eventId: string): string {
  const source = copiedEventPage;
  if (!source) return "";
  let pastedId = "";
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event) return;
    const pasted = structuredClone(source);
    pasted.id = genId("page");
    pasted.name = `${source.name} 복사본`;
    event.pages = [...(event.pages ?? []), pasted];
    pastedId = pasted.id;
  });
  if (pastedId) editorState.set({ selectedEventPageId: pastedId });
  return pastedId;
}

export function deleteEventPage(mapId: MapId, eventId: string, pageId: string): void {
  let deleted = false;
  let nextSelectedPageId: string | null = null;
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event?.pages || event.pages.length <= 1) return;
    const index = event.pages.findIndex((page) => page.id === pageId);
    if (index < 0) return;
    event.pages = event.pages.filter((page) => page.id !== pageId);
    deleted = true;
    // 삭제된 위치의 다음 페이지(또는 마지막이었다면 이전 페이지)를 선택한다.
    const nextIndex = Math.min(index, event.pages.length - 1);
    nextSelectedPageId = event.pages[nextIndex]?.id ?? null;
  });
  // 삭제가 실제로 일어났을 때만 선택을 업데이트한다.
  if (deleted) editorState.set({ selectedEventPageId: nextSelectedPageId });
}

export function moveEventPage(mapId: MapId, eventId: string, pageId: string, delta: -1 | 1): void {
  store.update((project) => {
    const pages = project.maps[mapId]?.events.find((item) => item.id === eventId)?.pages;
    if (!pages) return;
    const index = pages.findIndex((page) => page.id === pageId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= pages.length) return;
    const [page] = pages.splice(index, 1);
    pages.splice(nextIndex, 0, page);
  });
}

export function updateEventPage(
  mapId: MapId,
  eventId: string,
  pageId: string,
  patch: PagePatch
): void {
  store.update((project) => {
    const page = project.maps[mapId]?.events
      .find((event) => event.id === eventId)
      ?.pages?.find((item) => item.id === pageId);
    if (!page) return;
    Object.assign(page, structuredClone(patch));
  });
}

export function setEventPageTextCommand(
  mapId: MapId,
  eventId: string,
  pageId: string,
  speaker: string | undefined,
  body: string
): void {
  store.update((project) => {
    const page = project.maps[mapId]?.events
      .find((event) => event.id === eventId)
      ?.pages?.find((item) => item.id === pageId);
    if (!page) return;
    const textIndex = page.commands.findIndex((command) => command.kind === "text");
    const next: Command = { kind: "text", speaker, body };
    if (textIndex >= 0) {
      page.commands[textIndex] = next;
    } else {
      page.commands.unshift(next);
    }
  });
}

export function addEventPageCommand(
  mapId: MapId,
  eventId: string,
  pageId: string,
  command: Command
): void {
  store.update((project) => {
    const page = project.maps[mapId]?.events
      .find((event) => event.id === eventId)
      ?.pages?.find((item) => item.id === pageId);
    if (!page) return;
    page.commands.push(structuredClone(command));
  });
}

export function addEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  containerPath: readonly number[],
  command: Command
): void {
  store.update((project) => {
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, containerPath);
    list?.push(structuredClone(command));
  });
}

export function insertEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[],
  command: Command
): void {
  store.update((project) => {
    const index = path[path.length - 1];
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, path.slice(0, -1));
    if (!list || index === undefined) return;
    const clamped = Math.max(0, Math.min(list.length, index));
    list.splice(clamped, 0, structuredClone(command));
  });
}

export function replaceEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[],
  command: Command
): void {
  store.update((project) => {
    const lastIdx = path[path.length - 1];
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, path.slice(0, -1));
    if (!list || lastIdx === undefined) return;
    list[lastIdx] = structuredClone(command);
  });
}

export function deleteEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[]
): void {
  store.update((project) => {
    const lastIdx = path[path.length - 1];
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, path.slice(0, -1));
    if (!list || lastIdx === undefined) return;
    list.splice(lastIdx, 1);
  });
}

export function moveEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[],
  dir: -1 | 1
): void {
  store.update((project) => {
    const lastIdx = path[path.length - 1];
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, path.slice(0, -1));
    if (!list || lastIdx === undefined) return;
    const newIdx = lastIdx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const moved = list[lastIdx];
    if (!moved) return;
    list.splice(lastIdx, 1);
    list.splice(newIdx, 0, moved);
  });
}

export function moveEventPageCommandToIndex(
  mapId: MapId,
  eventId: string,
  pageId: string,
  sourcePath: readonly number[],
  toIndex: number
): void {
  store.update((project) => {
    const container = sourcePath.slice(0, -1);
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, container);
    if (!list) return;
    const from = sourcePath[sourcePath.length - 1];
    if (from === undefined || from < 0 || from >= list.length) return;
    const clamped = Math.max(0, Math.min(list.length - 1, toIndex));
    if (clamped === from) return;
    const moved = list[from];
    if (!moved) return;
    list.splice(from, 1);
    list.splice(clamped, 0, moved);
  });
}

export function replaceEventPageCommands(
  mapId: MapId,
  eventId: string,
  pageId: string,
  commands: readonly Command[]
): void {
  store.update((project) => {
    const page = project.maps[mapId]?.events
      .find((event) => event.id === eventId)
      ?.pages?.find((item) => item.id === pageId);
    if (!page) return;
    page.commands = commands.map((command) => structuredClone(command));
  });
}

// [P2] 크로스 컨테이너 이동: sourcePath 명령을 targetContainerPath 리스트의 toIndex 로.
// 자기 분기(자손) 안으로의 이동은 명령 유실을 막기 위해 무시한다.
export function moveEventPageCommandAcross(
  mapId: MapId,
  eventId: string,
  pageId: string,
  sourcePath: readonly number[],
  targetContainerPath: readonly number[],
  toIndex: number
): void {
  if (isContainerInsideCommand(sourcePath, targetContainerPath)) return;
  store.update((project) => {
    const events = project.maps[mapId]?.events;
    const targetList = resolvePageCommandList(events, eventId, pageId, targetContainerPath);
    const sourceList = resolvePageCommandList(events, eventId, pageId, sourcePath.slice(0, -1));
    const fromIndex = sourcePath[sourcePath.length - 1];
    if (!targetList || !sourceList || fromIndex === undefined) return;
    moveCommandBetweenLists(sourceList, fromIndex, targetList, toIndex);
  });
}

export function triggerFromKind(kind: Trigger["kind"]): Trigger {
  return { kind };
}

function resolvePageCommandList(events: GameEvent[] | undefined, eventId: string, pageId: string, containerPath: readonly number[]): Command[] | null {
  const page = events?.find((event) => event.id === eventId)?.pages?.find((item) => item.id === pageId);
  if (!page) return null;
  return resolveCommandListAtPath(page.commands, containerPath, { missingBranches: "create" });
}
