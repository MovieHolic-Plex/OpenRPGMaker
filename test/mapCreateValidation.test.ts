/** @vitest-environment happy-dom */
// 새 맵 대화창은 빈 이름과 범위 밖 크기를 다른 값으로 바꿔 넣지 않는다.
// 예전에는 이름 "" · 가로 -5 · 높이 2 가 말없이 4×4 「새 맵」이 됐다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openMapCreateDialog, mapCreateIssueLines } from "@/editor/panels/mapCreateDialog";
import { closeMapContextMenu } from "@/editor/panels/mapContextMenu";
import { inspectMapCreateInput, mapCreateInputOk } from "@/project/mapCreateSpec";
import { createBlankProject } from "@/project/defaults";
import { MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";

function node<T extends HTMLElement = HTMLElement>(testId: string): T {
  const found = document.querySelector<T>(`[data-testid="${testId}"]`);
  if (!found) throw new Error(`Missing test control: ${testId}`);
  return found;
}

function setField(testId: string, value: string): void {
  const input = node<HTMLInputElement>(testId);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  document.body.replaceChildren();
  store.replace(createBlankProject());
  const project = store.getCurrent();
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
});

afterEach(() => {
  closeMapContextMenu();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  document.body.replaceChildren();
});

describe("새 맵 크기·이름 검사", () => {
  it("빈 이름과 -5×2 는 거절 사유를 돌려주고 통과로 치지 않는다", () => {
    const issues = inspectMapCreateInput({ name: "   ", width: "-5", height: "2" });
    expect(issues.nameBlank).toBe(true);
    expect(issues.width).toEqual({ kind: "too-small", value: -5 });
    expect(issues.height).toEqual({ kind: "too-small", value: 2 });
    expect(mapCreateInputOk(issues)).toBe(false);
    const lines = mapCreateIssueLines(issues);
    expect(lines.join("\n")).toContain("이름을 비웠습니다");
    expect(lines.join("\n")).toContain("새 맵");
    expect(lines.join("\n")).toContain("가로 -5칸은 4칸보다 작습니다.");
    expect(lines.join("\n")).toContain("높이 2칸은 4칸보다 작습니다.");
    expect(lines.join("\n")).toContain("다른 크기로 바꿔 넣지 않습니다.");
  });

  it("빈 칸·정수가 아닌 값·상한 초과를 각각 구분한다", () => {
    expect(inspectMapDimension("")).toEqual({ kind: "empty" });
    expect(inspectMapDimension("4.5")).toEqual({ kind: "not-integer", raw: "4.5" });
    expect(inspectMapDimension(String(MAX_TOOL_MAP_DIMENSION + 1))).toEqual({
      kind: "too-big",
      value: MAX_TOOL_MAP_DIMENSION + 1,
    });
    expect(inspectMapDimension("8")).toBeNull();
    const huge = inspectMapCreateInput({ name: "항구", width: String(MAX_TOOL_MAP_DIMENSION + 1), height: "6" });
    expect(mapCreateIssueLines(huge).join("\n")).toContain(mapSizeLimitMessage());
  });

  it("대화창은 빈 이름과 -5×2 로 4×4 맵을 만들지 않고 거절 문장을 보여 준다", () => {
    const before = new Set(Object.keys(store.getCurrent().maps));
    openMapCreateDialog();
    setField("map-create-name", "");
    setField("map-create-width", "-5");
    setField("map-create-height", "2");

    const error = node("map-create-error");
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain("이름을 비웠습니다");
    expect(error.textContent).toContain("「새 맵」");
    expect(error.textContent).toContain("가로 -5칸은 4칸보다 작습니다.");
    expect(error.textContent).toContain("높이 2칸은 4칸보다 작습니다.");
    expect(error.textContent).toContain("다른 크기로 바꿔 넣지 않습니다.");
    expect(node("map-create-name").getAttribute("aria-invalid")).toBe("true");
    expect(node("map-create-width").getAttribute("aria-invalid")).toBe("true");
    expect(node("map-create-height").getAttribute("aria-invalid")).toBe("true");

    node("map-create-confirm").click();

    expect(node("map-create-dialog").isConnected).toBe(true);
    expect(new Set(Object.keys(store.getCurrent().maps))).toEqual(before);
    expect(Object.values(store.getCurrent().maps).some((map) => map.width === 4 && map.height === 4)).toBe(false);
    expect(Object.values(store.getCurrent().maps).some((map) => map.name === "새 맵" && map.width === 4)).toBe(false);
  });

  it("거절한 뒤에 올바른 이름과 크기를 넣으면 그 크기 그대로 만든다", () => {
    openMapCreateDialog();
    setField("map-create-name", "");
    setField("map-create-width", "-5");
    setField("map-create-height", "2");
    node("map-create-confirm").click();
    expect(node("map-create-dialog").isConnected).toBe(true);

    setField("map-create-name", "항구");
    setField("map-create-width", "8");
    setField("map-create-height", "6");
    expect(node("map-create-error").hidden).toBe(true);

    const before = new Set(Object.keys(store.getCurrent().maps));
    node("map-create-confirm").click();
    const createdId = Object.keys(store.getCurrent().maps).find((id) => !before.has(id));
    if (!createdId) throw new Error("맵이 만들어지지 않았습니다");
    expect(store.getCurrent().maps[createdId]).toMatchObject({ name: "항구", width: 8, height: 6 });
    expect(document.querySelector("[data-testid='map-create-dialog']")).toBeNull();
  });
});

function inspectMapDimension(raw: string) {
  return inspectMapCreateInput({ name: "이름", width: raw, height: "6" }).width;
}
