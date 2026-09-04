import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapProps, resetMapPropsTabForTests } from "@/editor/panels/mapProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

describe("map properties panel", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId });
    resetMapPropsTabForTests();
  });

  afterEach(() => {
    restoreDom();
  });

  it("applies the typed map name when the user presses apply", () => {
    const container = new FakeElement("div");
    const mapId = store.getCurrent().startMapId;

    renderMapProps(container as unknown as HTMLElement);
    const nameInput = findByTestId(container, "map-name-input");
    const applyButton = findByTestId(container, "map-resize-apply");
    if (!nameInput || !applyButton) throw new Error("Expected map properties controls");

    nameInput.value = "01 집 외관 정면";
    nameInput.dispatchEvent(new Event("change"));
    applyButton.dispatchEvent(new Event("click"));

    expect(store.getCurrent().maps[mapId]?.name).toBe("01 집 외관 정면");
  });

  it("renders all eight sections at once and preserves scroll across rerender", () => {
    const container = new FakeElement("div");
    renderMapProps(container as unknown as HTMLElement);
    for (const tab of ["general", "background", "bgm", "battle", "restrictions", "encounter", "spawns", "minimap"]) {
      expect(findByTestId(container, `map-props-section-${tab}`)).not.toBeNull();
    }
    // 복구 대상은 .map-props-body — CSS 에서 유일한 overflow:auto 스크롤러다.
    // FakeDom 은 레이아웃이 없어 scrollTop 숫자만 들고 있으므로, 실제 스크롤 가능성은
    // 브라우저 증거(배경 토글 뒤에도 스크롤 유지)로 확인한다.
    const body = container.querySelector(".map-props-body") as unknown as FakeElement | null;
    if (!body) throw new Error("Expected map props body");
    body.scrollTop = 240;
    const bgToggle = findByTestId(container, "map-bg-enable");
    if (!bgToggle) throw new Error("Expected background toggle");
    bgToggle.dispatchEvent(new Event("change"));
    const nextBody = container.querySelector(".map-props-body") as unknown as FakeElement | null;
    expect(nextBody?.scrollTop).toBe(240);
  });

  it("groups RPG2000/2003 and custom chipsets separately", () => {
    const project = store.getCurrent();
    const base = Object.values(project.tilesets)[0]!;
    project.tilesets.custom_atlas = {
      ...structuredClone(base),
      id: "custom_atlas",
      name: "CUSTOM Modern Exteriors",
      kind: "custom",
      image: { type: "bundled", id: "tex_custom_atlas" },
      tilesPerRow: 30,
    };
    const container = new FakeElement("div");

    renderMapProps(container as unknown as HTMLElement);

    const select = findByTestId(container, "map-props-tileset-select");
    const groups = select?.querySelectorAll("optgroup") ?? [];
    expect(groups.map((group) => group.getAttribute("label"))).toEqual(["RPG 2000/2003", "Custom Tile Chip"]);
    expect(groups[1]?.textContent).toContain("CUSTOM Modern Exteriors");
  });
});
