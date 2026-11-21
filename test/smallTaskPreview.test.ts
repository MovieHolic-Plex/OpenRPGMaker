/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getMapEditHistoryDepth, resetMapEditHistory } from "@/editor/mapEditHistory";
import { recordSmallTask } from "@/editor/smallTask/capsule";
import { readSmallTaskPreviewPreference, writeSmallTaskPreviewPreference } from "@/editor/smallTask/previewPreference";
import { createBlankProject } from "@/project/defaults/blankProject";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

vi.mock("@/editor/smallTask/run", () => ({
  runSmallTask: async (before: Project) => {
    const after = structuredClone(before);
    after.database.items[0].price = 80;
    return after;
  },
}));

beforeEach(() => localStorage.clear());

afterEach(() => {
  button(document.body, "닫기")?.click();
  document.body.replaceChildren();
});

function button(root: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll("button")).find(node => node.textContent === label);
}

async function openPreview(shortcut = false) {
  // happy-dom에는 팝오버 표시가 없어 위치를 그리는 호출만 대신한다.
  Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: vi.fn() });
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  project.tilesets = { [map.tilesetId]: { ...project.tilesets[map.tilesetId], referenceDocuments: [] } };
  project.assets = { sprites: {}, uploaded: {} };
  project.resourceProfiles = [];
  const item = project.database.items[0];
  item.name = "포션";
  item.price = 50;
  store.replaceProject(project);
  resetMapEditHistory();
  writeSmallTaskPreviewPreference(true);

  const trigger = recordSmallTask("items", item.id);
  document.body.append(trigger);
  trigger.click();
  const box = document.querySelector<HTMLElement>(".small-task")!;
  const form = box.querySelector("form")!;
  const input = form.querySelector("input")!;
  input.value = "포션 가격을 80으로";
  input.dispatchEvent(new Event("input"));
  const live = store.getCurrent();
  const depth = getMapEditHistoryDepth();
  if (shortcut) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
  } else {
    form.dispatchEvent(new Event("submit", { cancelable: true }));
  }
  await vi.waitFor(() => expect(button(box, "적용")).toBeDefined());
  return { box, input, live, depth };
}

it("새 브라우저에서는 꺼져 있고 켜기와 끄기를 저장한다", () => {
  expect(readSmallTaskPreviewPreference()).toBe(false);
  writeSmallTaskPreviewPreference(true);
  expect(readSmallTaskPreviewPreference()).toBe(true);
  expect(localStorage.length).toBe(1);
  writeSmallTaskPreviewPreference(false);
  expect(readSmallTaskPreviewPreference()).toBe(false);
});

it("Ctrl+Enter로 미리 보는 동안에는 저장하지 않고 적용할 때 한 단계로 기록한다", async () => {
  const { box, live, depth } = await openPreview(true);
  expect(box.querySelector("strong")?.textContent).toBe("포션 가격 50 → 80");
  expect(store.getCurrent()).toBe(live);
  expect(getMapEditHistoryDepth()).toBe(depth);
  button(box, "적용")!.click();
  await vi.waitFor(() => expect(button(box, "되돌리기")).toBeDefined());
  expect(store.getCurrent().database.items[0].price).toBe(80);
  expect(getMapEditHistoryDepth()).toBe(depth + 1);
});

it("취소하면 저장 기록을 건드리지 않고 요청과 초점을 돌려준다", async () => {
  const { box, input, live, depth } = await openPreview();
  button(box, "취소")!.click();
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  expect(store.getCurrent()).toBe(live);
  expect(getMapEditHistoryDepth()).toBe(depth);
  expect(input.value).toBe("포션 가격을 80으로");
  expect(document.activeElement).toBe(input);
});

it("미리 보기 뒤 다른 편집이 생기면 적용을 거절하고 입력을 복구한다", async () => {
  const { box, input, depth } = await openPreview();
  store.update(project => { project.meta.title = "다른 편집"; });
  const edited = store.getCurrent();
  button(box, "적용")!.click();
  await vi.waitFor(() => expect(box.querySelector('[role="status"]')?.textContent)
    .toBe("작업 중 프로젝트가 바뀌었어요. 다시 요청해 주세요."));
  expect(store.getCurrent()).toBe(edited);
  expect(edited.database.items[0].price).toBe(50);
  expect(getMapEditHistoryDepth()).toBe(depth);
  expect(input.value).toBe("포션 가격을 80으로");
  expect(document.activeElement).toBe(input);
});
