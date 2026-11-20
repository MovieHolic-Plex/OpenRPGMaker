/** @vitest-environment happy-dom */
import { beforeEach, expect, it, vi } from "vitest";
import { beginExistingEventDraft, discardEventDraft } from "@/editor/eventDraftActions";
import {
  applyProjectWithHistory, getMapEditHistoryDepth, getMapEditHistoryEntries, getMapEditHistoryMarker,
  getMapEditHistoryRevision, getMapEditRedoEntries, peekPreviousProject, recordProjectSnapshot, redoMapEdit, redoToHistoryIndex,
  resetMapEditHistory, revertToHistoryIndex, revertToHistoryMarker, undoMapEdit,
} from "@/editor/mapEditHistory";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { mapTarget } from "@/editor/smallTask/target";
import { HISTORY_TOOLS } from "@/editor/tools/historyTools";
import { createBlankProject } from "@/project/defaults/blankProject";
import { committedEventView } from "@/project/eventDrafts";
import { store } from "@/project/store";
import { jsonEqual } from "@/util/structuralJson";

beforeEach(() => {
  const p = createBlankProject();
  const map = p.maps[p.startMapId];
  // The asset catalog is independent of undo ownership. Keep this fixture cheap to deep-compare.
  p.tilesets = { [map.tilesetId]: { ...p.tilesets[map.tilesetId], referenceDocuments: [] } };
  p.assets = { sprites: {}, uploaded: {} };
  p.resourceProfiles = [];
  map.events = [{ id: "ev_1", name: "상인", x: 2, y: 3, commands: [], trigger: { kind: "action" } }];
  store.replaceProject(p);
  resetMapEditHistory();
});

function task(eventId = "ev_1", name = "약초상") {
  const live = store.getCurrent();
  const target = mapTarget(live, live.startMapId, eventId)!;
  const before = smallTaskBase(live, target);
  const after = structuredClone(before);
  const event = after.maps[after.startMapId].events.find(e => e.id === eventId)!;
  event.name = name;
  event.commands.push({ kind: "text", body: "어서 오세요." });
  return { live, after, receipt: commitSmallTask(live, before, after, target)! };
}

it("한 작업의 모든 변경을 기록 하나로 복구하고 다시 실행한다", async () => {
  const { live, after, receipt } = task();
  expect(getMapEditHistoryDepth()).toBe(1);
  const draft = structuredClone(after);
  HISTORY_TOOLS.find(t => t.name === "revert_last_edit")!.run(draft, {});
  expect(jsonEqual(draft, live)).toBe(true);
  const confirm = vi.fn();
  expect(await receipt.undo(confirm)).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  expect(jsonEqual(store.getCurrent(), live)).toBe(true);
  expect(redoMapEdit()).toBe(true);
  expect(jsonEqual(store.getCurrent(), after)).toBe(true);
});
it("손편집이 뒤에 있으면 묻고, Ctrl+Z 순서와 오래된 카드의 소유권을 지킨다", async () => {
  const { live, after, receipt } = task();
  const hand = { ...after, meta: { ...after.meta, title: "직접 편집" } };
  applyProjectWithHistory(hand, "손편집");
  expect(await receipt.undo(async () => false)).toBe(false);
  expect(getMapEditHistoryDepth()).toBe(2);
  expect(undoMapEdit()).toBe(true);
  expect(jsonEqual(store.getCurrent(), after)).toBe(true);
  expect(await receipt.undo(async () => false)).toBe(true);
  expect(jsonEqual(store.getCurrent(), live)).toBe(true);
  applyProjectWithHistory(hand, "새 손편집");
  expect(await receipt.undo(async () => true)).toBe(false);
});
it("뒤의 손편집을 함께 되돌리기로 확인하면 그 전후를 한 번에 복원한다", async () => {
  const { live, after, receipt } = task();
  const hand = { ...after, meta: { ...after.meta, title: "직접 편집" } };
  expect(applyProjectWithHistory(hand, "손편집")).toBe(true);
  const confirm = vi.fn(async () => true);
  expect(await receipt.undo(confirm)).toBe(true);
  expect(confirm).toHaveBeenCalledOnce();
  expect(jsonEqual(store.getCurrent(), live)).toBe(true);
  expect(getMapEditHistoryDepth()).toBe(0);
  expect(redoMapEdit()).toBe(true);
  expect(jsonEqual(store.getCurrent(), hand)).toBe(true);
});
it("작업 중 다른 편집이 들어오면 사본을 덮어쓰지 않는다", () => {
  const live = store.getCurrent(), target = mapTarget(live, live.startMapId)!;
  store.update(p => { p.meta.title = "나중 편집"; });
  expect(() => commitSmallTask(live, live, live, target)).toThrow("프로젝트가 바뀌었어요");
  expect(getMapEditHistoryDepth()).toBe(0);
});
it.each([true, false])("열린 이벤트의 기존 초안과 적용 기준을 복원한다 (손편집 %s)", async dirty => {
  const mapId = store.getCurrent().startMapId;
  store.updateEvent(mapId, "ev_1", event => {
    event.draft = { kind: "edit", original: structuredClone(event) };
    if (dirty) event.name = "작성 중";
  });
  const { live, receipt } = task();
  const current = () => store.getCurrent().maps[mapId].events[0];
  expect(current().name).toBe("약초상");
  expect(current().draft?.original?.name).toBe(dirty ? "상인" : "약초상");
  expect(await receipt.undo(async () => false)).toBe(true);
  expect(jsonEqual(live, store.getCurrent())).toBe(true);
  expect(redoMapEdit()).toBe(true);
  expect(current().name).toBe("약초상");
});
it("이벤트 창을 닫은 뒤 되돌려도 닫힌 초안을 다시 열지 않는다", () => {
  const mapId = store.getCurrent().startMapId;
  store.updateEvent(mapId, "ev_1", event => {
    event.draft = { kind: "edit", original: structuredClone(event) };
  });
  task();
  expect(discardEventDraft(mapId, "ev_1")).toBe(true);
  const current = () => store.getCurrent().maps[mapId].events[0];
  expect(undoMapEdit()).toBe(true);
  expect(current().name).toBe("상인");
  expect(current().draft).toBeUndefined();
  expect(redoMapEdit()).toBe(true);
  expect(current().name).toBe("약초상");
  expect(current().draft).toBeUndefined();
});

it.each([
  ["undoMapEdit", false, () => undoMapEdit()],
  ["revertToHistoryMarker", false, (marker: number) => revertToHistoryMarker(marker)],
  ["revertToHistoryIndex", false, () => revertToHistoryIndex(0)],
  ["redoMapEdit", true, () => redoMapEdit()],
  ["redoToHistoryIndex", true, () => redoToHistoryIndex(0)],
] as const)("%s: 다시 연 창의 작업 뒤 손편집을 보호한다", (_name, redo, restore) => {
  const mapId = store.getCurrent().startMapId;
  beginExistingEventDraft(mapId, "ev_1");
  const marker = getMapEditHistoryMarker();
  task();
  if (redo) expect(undoMapEdit()).toBe(true);
  expect(discardEventDraft(mapId, "ev_1")).toBe(true);
  expect(beginExistingEventDraft(mapId, "ev_1")).toBe(true);
  store.updateEvent(mapId, "ev_1", event => { event.commands.push({ kind: "text", body: "다시 열어서 직접 작성" }); });
  const live = store.getCurrent();
  const undoEntries = getMapEditHistoryEntries(), redoEntries = getMapEditRedoEntries();
  const revision = getMapEditHistoryRevision();
  expect(restore(marker)).toBe(false);
  expect(store.getCurrent()).toBe(live);
  expect(getMapEditHistoryEntries()).toEqual(undoEntries);
  expect(getMapEditRedoEntries()).toEqual(redoEntries);
  expect(getMapEditHistoryRevision()).toBe(revision);
});

it.each([false, true])("두 초안을 각 작업의 전후 본문으로 복원한다 (개별 되돌리기 %s)", individually => {
  const mapId = store.getCurrent().startMapId;
  store.updateMap(mapId, map => { map.events.push({ ...structuredClone(map.events[0]), id: "ev_2", name: "경비" }); });
  for (const [id, body] of [["ev_1", "상인의 손편집"], ["ev_2", "경비의 손편집"]]) {
    beginExistingEventDraft(mapId, id);
    store.updateEvent(mapId, id, event => { event.commands.push({ kind: "text", body }); });
  }
  const before = store.getCurrent().maps[mapId].events;
  task("ev_1", "약초상");
  task("ev_2", "성문 경비");
  const after = store.getCurrent().maps[mapId].events;
  if (individually) {
    expect(undoMapEdit()).toBe(true);
    expect(undoMapEdit()).toBe(true);
  } else {
    expect(revertToHistoryIndex(0)).toBe(true);
  }
  expect(store.getCurrent().maps[mapId].events).toEqual(before);
  expect(redoToHistoryIndex(0)).toBe(true);
  expect(store.getCurrent().maps[mapId].events).toEqual(after);
});

it.each([false, true])("맵 기록까지 되돌릴 때만 그 이전 초안을 복원한다 (맵 기록 포함 %s)", includeMap => {
  const mapId = store.getCurrent().startMapId;
  const read = () => store.getCurrent().maps[mapId].events[0];
  beginExistingEventDraft(mapId, "ev_1");
  const d0 = read();
  recordProjectSnapshot("초안이 든 맵 기록", mapId, { kind: "map", includeEventDrafts: true });
  store.updateEvent(mapId, "ev_1", event => { event.name = "D1 직접 편집"; });
  const d1 = read();
  task();
  const d2 = read();
  expect(revertToHistoryIndex(includeMap ? 0 : 1)).toBe(true);
  expect(read()).toEqual(includeMap ? d0 : d1);
  expect(redoMapEdit()).toBe(true);
  expect(read()).toEqual(d2);
});

it.each([false, true])("작업을 적용한 뒤 연 초안을 되돌릴 때 직접 편집을 구별한다 (손편집 %s)", async dirty => {
  const mapId = store.getCurrent().startMapId;
  const read = () => store.getCurrent().maps[mapId].events[0];
  const original = read();
  const { receipt } = task();
  const edited = read();
  beginExistingEventDraft(mapId, "ev_1");
  if (dirty) store.updateEvent(mapId, "ev_1", event => { event.name = "직접 편집"; });
  const confirm = vi.fn(async () => false);
  expect(await receipt.undo(confirm)).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  expect(committedEventView(read())).toEqual(original);
  expect(read().name).toBe(dirty ? "직접 편집" : original.name);
  expect(read().draft?.conflict?.kind).toBe(dirty ? "remote-change" : undefined);
  if (!dirty) {
    expect(redoMapEdit()).toBe(true);
    expect(committedEventView(read())).toEqual(edited);
    expect(read().name).toBe(edited.name);
    expect(read().draft?.conflict).toBeUndefined();
  }
});

it.each([
  [["ev_removed", "ev_1", "ev_new", "ev_last"], ["ev_1", "ev_new", "ev_last"]],
  [["ev_removed", "ev_new", "ev_1", "ev_last"], ["ev_new", "ev_1", "ev_last"]],
])("앞선 초안이 빠진 스냅샷에서도 새 초안의 위치를 보존한다 (%j)", (order, expected) => {
  const mapId = store.getCurrent().startMapId;
  store.updateMap(mapId, map => {
    map.events = order.map(id => ({ ...structuredClone(map.events[0]), id,
      ...(id === "ev_removed" || id === "ev_new" ? { draft: { kind: "new" } as const } : {}),
    }));
  });
  task("ev_new");
  expect(peekPreviousProject()?.maps[mapId].events.map(event => event.id)).toEqual(expected);
});
