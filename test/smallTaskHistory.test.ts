/** @vitest-environment happy-dom */
import { beforeEach, expect, it, vi } from "vitest";
import { discardEventDraft } from "@/editor/eventDraftActions";
import { applyProjectWithHistory, getMapEditHistoryDepth, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { commitSmallTask, smallTaskBase } from "@/editor/smallTask/history";
import { mapTarget } from "@/editor/smallTask/target";
import { HISTORY_TOOLS } from "@/editor/tools/historyTools";
import { createBlankProject } from "@/project/defaults/blankProject";
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

function task() {
  const live = store.getCurrent();
  const target = mapTarget(live, live.startMapId, "ev_1")!;
  const before = smallTaskBase(live, target);
  const after = structuredClone(before);
  const event = after.maps[after.startMapId].events[0];
  event.name = "약초상";
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
