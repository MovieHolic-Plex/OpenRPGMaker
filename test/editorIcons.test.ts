/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { commandCategoryVisual, pickerPageIcon, renderCategoryIcon } from "@/editor/panels/eventEditor/commandCategoryIcons";
import { EDITOR_ICON_NAMES, renderEditorIcon } from "@/editor/panels/eventEditor/editorIcons";

describe("editorIcons", () => {
  it("아이콘은 22×22 스트로크 SVG 이고 기본은 장식(aria-hidden)이다", () => {
    const icon = renderEditorIcon("close");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("viewBox")).toBe("0 0 22 22");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.classList.contains("ee-icon")).toBe(true);
    expect(icon.classList.contains("ee-icon-close")).toBe(true);
    expect(icon.querySelector("path, rect, circle")).not.toBeNull();
  });

  it("라벨을 주면 아이콘 혼자 뜻을 전한다(role=img)", () => {
    const icon = renderEditorIcon("trash", { label: "삭제" });
    expect(icon.getAttribute("role")).toBe("img");
    expect(icon.getAttribute("aria-label")).toBe("삭제");
    expect(icon.hasAttribute("aria-hidden")).toBe(false);
  });

  it("모든 이름이 비어 있지 않은 스펙을 가진다", () => {
    expect(EDITOR_ICON_NAMES.length).toBeGreaterThan(30);
    for (const name of EDITOR_ICON_NAMES) {
      expect(renderEditorIcon(name).querySelector("path, rect, circle"), name).not.toBeNull();
    }
  });

  it("명령 분류마다 아이콘 이름이 붙고 글리프 문자 대신 SVG 로 그려진다", () => {
    expect(commandCategoryVisual({ kind: "text", body: "" }).icon).toBe("chat");
    expect(commandCategoryVisual({ kind: "choices", options: [] }).icon).toBe("choice");
    expect(commandCategoryVisual({ kind: "fork", condition: { kind: "switch", switchId: "s", value: true }, then: [] }).icon).toBe("branch");
    expect(commandCategoryVisual({ kind: "transfer", mapId: "m", x: 0, y: 0 }).icon).toBe("route");
    expect(commandCategoryVisual({ kind: "shop", itemIds: [] }).icon).toBe("coin");
    const node = renderCategoryIcon(commandCategoryVisual({ kind: "text", body: "" }));
    expect(node.tagName.toLowerCase()).toBe("svg");
    expect(node.classList.contains("ee-icon-chat")).toBe(true);
    expect([pickerPageIcon(1), pickerPageIcon(2), pickerPageIcon(3), pickerPageIcon(4)]).toEqual(["chat", "party", "spark", "gear"]);
  });
});
