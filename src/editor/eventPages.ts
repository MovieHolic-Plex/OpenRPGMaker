import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, MapId, Trigger } from "@/project/types";
import { genId } from "@/util/id";

type PagePatch = Partial<Omit<EventPage, "id">>;

export function createDefaultEventPage(
  event: Pick<GameEvent, "id" | "sprite" | "trigger" | "condition" | "moveRoute" | "commands">,
  pageNumber: number
): EventPage {
  return {
    id: genId("page"),
    name: `Page ${pageNumber}`,
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
        commands: [{ kind: "text", body: "..." }],
      },
      event.pages.length + 1
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
    copy.name = `${source.name} Copy`;
    event.pages = [...(event.pages ?? []), copy];
    copiedId = copy.id;
  });
  if (copiedId) editorState.set({ selectedEventPageId: copiedId });
  return copiedId;
}

export function deleteEventPage(mapId: MapId, eventId: string, pageId: string): void {
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event?.pages || event.pages.length <= 1) return;
    event.pages = event.pages.filter((page) => page.id !== pageId);
  });
  editorState.set({ selectedEventPageId: null });
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

/**
 * 드래그-앤-드롭 재정렬용: 한 컨테이너 안에서 sourcePath 의 명령을 toIndex 위치로 옮긴다.
 * store 변경 1회로 처리해 DOM 이 중간에 재렌더되는 문제를 피한다.
 * toIndex 는 소스를 제거하기 전 기준이 아닌, 제거 후 기준의 목표 위치다.
 */
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

export function triggerFromKind(kind: Trigger["kind"]): Trigger {
  return { kind };
}

function resolvePageCommandList(
  events: GameEvent[] | undefined,
  eventId: string,
  pageId: string,
  containerPath: readonly number[]
): Command[] | null {
  const page = events?.find((event) => event.id === eventId)?.pages?.find((item) => item.id === pageId);
  if (!page) return null;
  return resolveCommandList(page.commands, containerPath);
}

function resolveCommandList(commands: Command[], containerPath: readonly number[]): Command[] | null {
  let list: Command[] = commands;
  for (let i = 0; i < containerPath.length - 1; i += 2) {
    const cmdIdx = containerPath[i];
    const optIdx = containerPath[i + 1];
    const cmd = list[cmdIdx];
    if (!cmd || cmd.kind !== "choices" || optIdx === undefined) return null;
    const opt = cmd.options[optIdx];
    if (!opt) return null;
    list = opt.branch;
  }
  return list;
}
