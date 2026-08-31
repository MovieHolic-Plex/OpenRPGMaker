import { editorState } from "@/editor/editorState";
import {
  copiedEventPageFromBuffer,
  copyEventPageToBuffer,
  hasCopiedEventPageInBuffer,
} from "@/editor/eventPageClipboard";
import {
  isContainerInsideCommand,
  moveCommandBetweenLists,
  resolveCommandAtPath,
  resolveCommandListAtPath,
} from "@/editor/eventCommandPaths";
import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import type { Command, EventPage, GameEvent, MapId, Trigger } from "@/project/types";
import { genId } from "@/util/id";

export { clearCopiedEventPage, subscribeCopiedEventPage } from "@/editor/eventPageClipboard";

type PagePatch = Partial<Omit<EventPage, "id">>;

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
  // 렌더 경로가 부르는 정규화다(사람이 누른 행위가 아님) → origin 을 system 으로 갈라 둔다.
  }, { scope: "map", mapId, eventId, label: "페이지 기본값 생성", origin: "system" });
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

/** 같은 이름의 페이지를 눈으로 구분할 수 있도록 복사본 번호를 올린다. */
function nextAvailableCopyName(sourceName: string, pages: readonly EventPage[]): string {
  const usedNames = new Set(pages.map((page) => page.name));
  const root = sourceName.replace(/ 복사본(?: \d+)?$/u, "");
  const base = `${root} 복사본`;
  if (!usedNames.has(base)) return base;
  let number = 2;
  while (usedNames.has(`${base} ${number}`)) number += 1;
  return `${base} ${number}`;
}

export function addEventPage(mapId: MapId, eventId: string): string {
  // 라벨은 mutator 실행 **전에** 정해지므로 새 페이지가 몇 번째에 붙는지 미리 센다.
  // 페이지가 하나도 없으면 아래 mutator 가 기본 페이지를 먼저 만들므로 2번째가 된다.
  const position = Math.max(pageList(mapId, eventId).length, 1) + 1;
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
  }, pageChange(mapId, eventId, `페이지 추가 (${position}번째)`));
  if (pageId) editorState.set({ selectedEventPageId: pageId });
  return pageId;
}

/**
 * 페이지를 원본 바로 앞에 복제한다. 페이지 배열은 뒤에 있을수록 런타임 우선순위가 높다.
 * 따라서 원본 뒤에 복제하면 원본이 마지막인 경우 복제본이 즉시 승자가 된다. 바로 앞(낮은
 * 우선순위)에 두면 원본이 첫째·가운데·마지막 어디에 있든 기존 resolve 결과는 유지하면서
 * 두 페이지는 붙어 있고, 사용자는 선택된 복제본을 안전하게 고친 뒤 순서를 명시적으로 올릴 수 있다.
 */
export function copyEventPage(mapId: MapId, eventId: string, pageId: string): string {
  const sourceName = pageName(mapId, eventId, pageId);
  let copiedId = "";
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    const source = event?.pages?.find((page) => page.id === pageId);
    if (!event || !source) return;
    const copy = structuredClone(source);
    copy.id = genId("page");
    const pages = [...(event.pages ?? [])];
    const sourceIndex = pages.findIndex((page) => page.id === pageId);
    if (sourceIndex < 0) return;
    copy.name = nextAvailableCopyName(source.name, pages);
    pages.splice(sourceIndex, 0, copy);
    event.pages = pages;
    copiedId = copy.id;
  }, pageChange(mapId, eventId, `페이지 복제: ${sourceName}`));
  if (copiedId) editorState.set({ selectedEventPageId: copiedId });
  return copiedId;
}

export function copyEventPageToClipboard(mapId: MapId, eventId: string, pageId: string): boolean {
  const source = store.getCurrent().maps[mapId]?.events
    .find((item) => item.id === eventId)
    ?.pages?.find((page) => page.id === pageId);
  return copyEventPageToBuffer(source ?? null);
}

export function hasCopiedEventPage(): boolean {
  return hasCopiedEventPageInBuffer();
}

/**
 * 복사해 둔 페이지를 기지 페이지 바로 앞(낮은 런타임 우선순위)에 넣는다. 기지는 `anchorPageId` 로
 * 명시하고, 생략하면 현재 활성 페이지다 — 탭 우클릭 메뉴는 선택을 옮기지 않고 **니른 페이지**를
 * 대상으로 삼아서(복제·순서·삭제와 같은 기지), 활성 페이지로 계산하면 엉둠한 자리에 꽂힌다.
 * 기지가 이 이벤트에 없으면 **맨 앞(index 0)** 에 넣는다. 끝에 넣으면 그게 가장 높은 우선순위가
 * 되어 이 함수가 막으려는 역전이 생긴다 — `selectedEventPageId` 는 맵 단위 되돌리기나 원격
 * 리로드로 그 페이지가 사라지면 낡은 값이 된다(그 경로들은 editorState 를 재조정하지 않고
 * 렌더만 `pages[0]` 으로 폴백한다). 낮은 우선순위로 떨어지는 쪽이 안전한 실패다.
 */
export function pasteEventPage(mapId: MapId, eventId: string, anchorPageId?: string): string {
  const source = copiedEventPageFromBuffer();
  if (!source) return "";
  const anchorId = anchorPageId ?? editorState.get().selectedEventPageId;
  let pastedId = "";
  store.update((project) => {
    const event = project.maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event) return;
    const pages = [...(event.pages ?? [])];
    const pasted = structuredClone(source);
    pasted.id = genId("page");
    pasted.name = nextAvailableCopyName(source.name, pages);
    const anchorIndex = pages.findIndex((page) => page.id === anchorId);
    pages.splice(anchorIndex >= 0 ? anchorIndex : 0, 0, pasted);
    event.pages = pages;
    pastedId = pasted.id;
  }, pageChange(mapId, eventId, `페이지 붙여넣기: ${source.name}`));
  if (pastedId) editorState.set({ selectedEventPageId: pastedId });
  return pastedId;
}

export function deleteEventPage(mapId: MapId, eventId: string, pageId: string): boolean {
  const removedName = pageName(mapId, eventId, pageId);
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
  }, pageChange(mapId, eventId, `페이지 삭제: ${removedName}`));
  // 삭제가 실제로 일어났을 때만 선택을 업데이트한다.
  if (deleted) editorState.set({ selectedEventPageId: nextSelectedPageId });
  return deleted;
}

export function moveEventPage(mapId: MapId, eventId: string, pageId: string, delta: -1 | 1): boolean {
  const pages = pageList(mapId, eventId);
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0) return false;
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= pages.length) return false;
  return moveEventPageTo(
    mapId,
    eventId,
    pageId,
    nextIndex,
    `페이지 순서 이동: ${pageName(mapId, eventId, pageId)} (${delta < 0 ? "앞으로" : "뒤로"})`,
  );
}

/**
 * 페이지를 임의 인덱스로 옮긴다. 탭 드래그 재정렬의 한 번의 `store.update` 경계다.
 * `toIndex` 는 배열 범위로 클램프하고, 제자리면 false 다.
 */
export function moveEventPageTo(
  mapId: MapId,
  eventId: string,
  pageId: string,
  toIndex: number,
  label?: string,
): boolean {
  const movedName = pageName(mapId, eventId, pageId);
  let moved = false;
  store.update((project) => {
    const pages = project.maps[mapId]?.events.find((item) => item.id === eventId)?.pages;
    if (!pages || pages.length === 0) return;
    const index = pages.findIndex((page) => page.id === pageId);
    if (index < 0) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, Math.trunc(toIndex)));
    if (index === clamped) return;
    const [page] = pages.splice(index, 1);
    if (!page) return;
    pages.splice(clamped, 0, page);
    moved = true;
  }, pageChange(mapId, eventId, label ?? `페이지 순서 이동: ${movedName}`));
  return moved;
}

/**
 * 페이지 속성 patch. 범용 함수라 호출부가 30곳이 넘으므로 `label` 은 optional 이고,
 * 생략하면 patch 의 키에서 라벨을 만든다(예: `페이지 속성 변경: 촌장 — 그림`).
 * 조건·이동·그림처럼 의미가 뚜렷한 호출부는 자기 이름을 넘겨 더 읽기 좋게 만든다.
 */
export function updateEventPage(
  mapId: MapId,
  eventId: string,
  pageId: string,
  patch: PagePatch,
  label?: string
): void {
  const resolved = label ?? `페이지 속성 변경: ${pageName(mapId, eventId, pageId)} — ${patchFieldCaption(patch)}`;
  store.update((project) => {
    const page = project.maps[mapId]?.events
      .find((event) => event.id === eventId)
      ?.pages?.find((item) => item.id === pageId);
    if (!page) return;
    Object.assign(page, structuredClone(patch));
  }, pageChange(mapId, eventId, resolved));
}

export function setEventPageTextCommand(
  mapId: MapId,
  eventId: string,
  pageId: string,
  speaker: string | undefined,
  body: string
): void {
  const named = speaker?.trim();
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
  }, pageChange(mapId, eventId, named ? `대사 설정: ${named}` : "대사 설정"));
}

export function addEventPageCommand(
  mapId: MapId,
  eventId: string,
  pageId: string,
  command: Command
): void {
  // 새 커맨드가 앉을 자리 = 현재 루트 리스트 길이. 라벨은 mutator 전에 굳으므로 먼저 센다.
  const slot = findPage(mapId, eventId, pageId)?.commands.length ?? 0;
  store.update((project) => {
    const page = project.maps[mapId]?.events
      .find((event) => event.id === eventId)
      ?.pages?.find((item) => item.id === pageId);
    if (!page) return;
    page.commands.push(structuredClone(command));
  }, pageChange(mapId, eventId, `커맨드 추가: ${commandKindLabel(command.kind)} (#${slot})`));
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
  }, pageChange(
    mapId,
    eventId,
    `커맨드 추가: ${commandKindLabel(command.kind)} (${commandContainerCaption(containerPath)})`
  ));
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
  }, pageChange(
    mapId,
    eventId,
    `커맨드 삽입: ${commandKindLabel(command.kind)} (${commandSlotCaption(path)})`
  ));
}

export function replaceEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[],
  command: Command
): void {
  const before = commandKindCaptionAt(mapId, eventId, pageId, path);
  store.update((project) => {
    const lastIdx = path[path.length - 1];
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, path.slice(0, -1));
    if (!list || lastIdx === undefined) return;
    list[lastIdx] = structuredClone(command);
  }, pageChange(
    mapId,
    eventId,
    `커맨드 교체: ${before === null ? "" : `${before} → `}${commandKindLabel(command.kind)} (${commandSlotCaption(path)})`
  ));
}

export function deleteEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[]
): void {
  // 삭제 대상 종류는 지운 뒤엔 알 수 없다 — 라벨용으로 먼저 읽는다(read 모드라 분기를 만들지 않는다).
  const removed = commandKindCaptionAt(mapId, eventId, pageId, path);
  store.update((project) => {
    const lastIdx = path[path.length - 1];
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, path.slice(0, -1));
    if (!list || lastIdx === undefined) return;
    list.splice(lastIdx, 1);
  }, pageChange(
    mapId,
    eventId,
    `커맨드 삭제: ${removed ?? "알 수 없음"} (${commandSlotCaption(path)})`
  ));
}

export function moveEventPageCommandAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[],
  dir: -1 | 1
): void {
  const moved = commandKindCaptionAt(mapId, eventId, pageId, path);
  store.update((project) => {
    const lastIdx = path[path.length - 1];
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, path.slice(0, -1));
    if (!list || lastIdx === undefined) return;
    const newIdx = lastIdx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const moving = list[lastIdx];
    if (!moving) return;
    list.splice(lastIdx, 1);
    list.splice(newIdx, 0, moving);
  }, pageChange(
    mapId,
    eventId,
    `커맨드 순서 이동: ${moved ?? "알 수 없음"} (${commandMoveCaption(mapId, eventId, pageId, path, (path[path.length - 1] ?? 0) + dir)})`
  ));
}

export function moveEventPageCommandToIndex(
  mapId: MapId,
  eventId: string,
  pageId: string,
  sourcePath: readonly number[],
  toIndex: number
): void {
  const moved = commandKindCaptionAt(mapId, eventId, pageId, sourcePath);
  store.update((project) => {
    const container = sourcePath.slice(0, -1);
    const list = resolvePageCommandList(project.maps[mapId]?.events, eventId, pageId, container);
    if (!list) return;
    const from = sourcePath[sourcePath.length - 1];
    if (from === undefined || from < 0 || from >= list.length) return;
    const clamped = Math.max(0, Math.min(list.length - 1, toIndex));
    if (clamped === from) return;
    const moving = list[from];
    if (!moving) return;
    list.splice(from, 1);
    list.splice(clamped, 0, moving);
  }, pageChange(
    mapId,
    eventId,
    `커맨드 순서 이동: ${moved ?? "알 수 없음"} (${commandMoveCaption(mapId, eventId, pageId, sourcePath, toIndex)})`
  ));
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
  // 커맨드 툴바의 되돌리기/다시하기와 여러 줄 붙여넣기가 같이 쓰는 경로다 — 개수로 규모를 남긴다.
  }, pageChange(mapId, eventId, `커맨드 목록 교체: ${commands.length}개`));
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
  const moved = commandKindCaptionAt(mapId, eventId, pageId, sourcePath);
  store.update((project) => {
    const events = project.maps[mapId]?.events;
    const targetList = resolvePageCommandList(events, eventId, pageId, targetContainerPath);
    const sourceList = resolvePageCommandList(events, eventId, pageId, sourcePath.slice(0, -1));
    const fromIndex = sourcePath[sourcePath.length - 1];
    if (!targetList || !sourceList || fromIndex === undefined) return;
    moveCommandBetweenLists(sourceList, fromIndex, targetList, toIndex);
  }, pageChange(
    mapId,
    eventId,
    `커맨드 분기 이동: ${moved ?? "알 수 없음"} (${commandSlotCaption(sourcePath)} → ${commandContainerCaption(targetContainerPath)} #${toIndex})`
  ));
}

export function triggerFromKind(kind: Trigger["kind"]): Trigger {
  return { kind };
}

function resolvePageCommandList(events: GameEvent[] | undefined, eventId: string, pageId: string, containerPath: readonly number[]): Command[] | null {
  const page = events?.find((event) => event.id === eventId)?.pages?.find((item) => item.id === pageId);
  if (!page) return null;
  return resolveCommandListAtPath(page.commands, containerPath, { missingBranches: "create" });
}

// ── 편집 행위 라벨 ────────────────────────────────────────────────
//
// 2026-08-29 관측성 감사 실측: 이 파일의 `store.update` 17곳이 전부 descriptor 없이
// 호출돼 감사 로그에 `(라벨 없음: project)` 로만 남았다 — 커맨드 추가·삭제·이동,
// 페이지 추가·삭제·복사가 로그에서 서로 구분되지 않았다. 사용자 불만("방금 뭘 했더니
// 이렇게 됐는지 모른다")의 주 경로가 여기다.
//
// ⚠ **관측만 붙인다.** `recordProjectSnapshot` 은 넣지 않는다 — 이 함수들이 고치는 건
// 모달 안의 드래프트라서, 전역 스냅샷을 끼우면 모달의 취소/폐기 의미
// (`truncateMapEditHistoryFromMarker`, `commandToolbarHistory`)와 어긋난다.
//
// 라벨은 mutator 실행 **전에** 굳는다(descriptor 는 인자다). 그래서 "무엇이 사라졌나",
// "몇 번째에 붙나" 같은 값은 `store.getCurrent()` 를 먼저 읽어 만든다. 이 읽기는 clone 이
// 없어서 mutation 경로에 부담을 주지 않는다(`store.update` 는 어차피 전체 clone 을 한다).

/** 페이지·커맨드 편집의 공통 descriptor. 스코프는 항상 맵 + 이벤트다. */
function pageChange(mapId: MapId, eventId: string, label: string): ProjectChangeDescriptor {
  return { scope: "map", mapId, eventId, label };
}

function findEvent(mapId: MapId, eventId: string): GameEvent | undefined {
  return store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId);
}

function pageList(mapId: MapId, eventId: string): readonly EventPage[] {
  return findEvent(mapId, eventId)?.pages ?? [];
}

function findPage(mapId: MapId, eventId: string, pageId: string): EventPage | undefined {
  return pageList(mapId, eventId).find((page) => page.id === pageId);
}

/** 라벨에 박을 페이지 이름. 이름이 비면 id 로 떨어진다(적어도 어느 페이지인지는 남는다). */
function pageName(mapId: MapId, eventId: string, pageId: string): string {
  const name = findPage(mapId, eventId, pageId)?.name.trim();
  return name && name.length > 0 ? name : pageId;
}

/**
 * 커맨드 자리 표기. 경로는 `[커맨드 인덱스, 분기 인덱스, …]` 가 번갈아 나오고 분기
 * 인덱스는 음수 sentinel(`FORK_THEN_BRANCH_INDEX = -2` 등)이라 사람이 읽을 이름이 없다.
 * `eventDiffLabel` 의 `pages[0].commands[2]` 와 대조할 수 있게 경로를 그대로 적는다.
 *
 * `eventActions.ts` 의 레거시 루트 커맨드 편집도 이 표기를 쓴다 — 두 커맨드 트리의
 * 로그가 서로 다른 문법으로 갈리면 감사 로그를 한 줄로 읽을 수 없다.
 */
export function commandSlotCaption(path: readonly number[]): string {
  return path.length === 0 ? "#루트" : `#${path.join("/")}`;
}

export function commandContainerCaption(path: readonly number[]): string {
  return path.length === 0 ? "루트" : `#${path.join("/")} 안`;
}

/**
 * 이동 라벨의 `#출발 → #도착`. 두 이동 함수 모두 목표 자리를 `[0, length-1]` 로 클램프하고
 * 결과가 제자리면 아무것도 하지 않으므로, 그 규칙을 라벨에도 적용한다 — 그러지 않으면
 * 맨 위 커맨드에 "위로"를 눌렀을 때 로그가 존재하지 않는 `#-1` 로 갔다고 적는다.
 * (`store.update` 는 mutator 가 아무 일도 안 해도 엔트리를 남기므로 "이동 없음" 이 남는 게
 * 정확하고, 왜 화면이 안 바뀌었는지도 그 줄로 설명된다.)
 */
function commandMoveCaption(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[],
  target: number
): string {
  const slot = commandSlotCaption(path);
  const page = findPage(mapId, eventId, pageId);
  const from = path[path.length - 1];
  const list = page ? resolveCommandListAtPath(page.commands, path.slice(0, -1)) : null;
  if (!list || from === undefined) return `${slot} → #${target}`;
  const clamped = Math.max(0, Math.min(list.length - 1, target));
  return clamped === from ? `${slot}, 이동 없음` : `${slot} → #${clamped}`;
}

/**
 * 경로에 지금 있는 커맨드의 종류 이름. 삭제·이동·교체 라벨은 "무엇이" 움직였는지가
 * 핵심인데 그건 mutation 후엔 알 수 없다. `resolveCommandAtPath` 는 read 모드라
 * 없는 분기를 만들지 않으므로 `getCurrent()` 에 그대로 걸어도 안전하다.
 */
function commandKindCaptionAt(
  mapId: MapId,
  eventId: string,
  pageId: string,
  path: readonly number[]
): string | null {
  const page = findPage(mapId, eventId, pageId);
  if (!page) return null;
  const command = resolveCommandAtPath(page.commands, path);
  return command ? commandKindLabel(command.kind) : null;
}

/** patch 키 → 사람이 읽는 이름. 라벨이 영어 필드명으로 새는 걸 막는다. */
const PAGE_FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "이름",
  conditions: "출현 조건",
  graphic: "그림",
  trigger: "실행 방법",
  priority: "겹침 우선순위",
  overlapForbidden: "겹침 금지",
  animationType: "움직임 방식",
  footprint: "발자국",
  movement: "이동",
  commands: "커맨드",
};

/** 라벨이 화면을 넘기지 않게 3개까지만 적고 나머지는 개수로 접는다. */
function patchFieldCaption(patch: PagePatch): string {
  const keys = Object.keys(patch);
  if (keys.length === 0) return "변경 없음";
  const named = keys.map((key) => PAGE_FIELD_LABELS[key] ?? key);
  if (named.length <= 3) return named.join(", ");
  return `${named.slice(0, 3).join(", ")} 외 ${named.length - 3}개`;
}
