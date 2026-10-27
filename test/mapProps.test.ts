import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapProps, resetMapPropsTabForTests } from "@/editor/panels/mapProps";
import { createBlankProject } from "@/project/defaults";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

describe("map properties panel", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    // Picking a background preset mounts the live game-screen preview, which schedules animation frames (#3210).
    restoreDom = installFakeDom({ animationFrames: "manual" });
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

  it("resizes a map up to the official limit and refuses one tile past it", () => {
    const container = new FakeElement("div");
    const mapId = store.getCurrent().startMapId;
    const original = store.getCurrent().maps[mapId];
    if (!original) throw new Error("Expected a start map");

    renderMapProps(container as unknown as HTMLElement);
    const widthInput = findByTestId(container, "map-width-input");
    const heightInput = findByTestId(container, "map-height-input");
    const applyButton = findByTestId(container, "map-resize-apply");
    if (!widthInput || !heightInput || !applyButton) throw new Error("Expected map size controls");

    expect(widthInput.getAttribute("max")).toBe(String(MAX_TOOL_MAP_DIMENSION));
    expect(heightInput.getAttribute("max")).toBe(String(MAX_TOOL_MAP_DIMENSION));
    const hint = [...container.querySelectorAll(".map-props-hint")].find((node) => node.textContent?.includes("가로·세로 각각"));
    expect(hint?.textContent).toContain(String(MAX_TOOL_MAP_DIMENSION));

    widthInput.value = "200";
    heightInput.value = "150";
    applyButton.dispatchEvent(new Event("click"));
    expect(store.getCurrent().maps[mapId]?.width).toBe(200);
    expect(store.getCurrent().maps[mapId]?.height).toBe(150);

    widthInput.value = String(MAX_TOOL_MAP_DIMENSION + 1);
    heightInput.value = "150";
    applyButton.dispatchEvent(new Event("click"));
    expect(store.getCurrent().maps[mapId]?.width).toBe(200);
    expect(store.getCurrent().maps[mapId]?.height).toBe(150);
  });

  it("renders all nine sections at once and preserves scroll across rerender", () => {
    const container = new FakeElement("div");
    renderMapProps(container as unknown as HTMLElement);
    for (const tab of ["general", "background", "clouds", "bgm", "battle", "restrictions", "encounter", "spawns", "minimap"]) {
      expect(findByTestId(container, `map-props-section-${tab}`)).not.toBeNull();
    }
    // 복구 대상은 .map-props-body — CSS 에서 유일한 overflow:auto 스크롤러다.
    // FakeDom 은 레이아웃이 없어 scrollTop 숫자만 들고 있으므로, 실제 스크롤 가능성은
    // 브라우저 증거(배경 토글 뒤에도 스크롤 유지)로 확인한다.
    const body = container.querySelector(".map-props-body") as unknown as FakeElement | null;
    if (!body) throw new Error("Expected map props body");
    body.scrollTop = 240;
    // The background tab has no enable toggle since #3210 — picking a preset card is the rerendering action.
    const preset = findByTestId(container, "map-bg-preset-oprn-sky-day");
    if (!preset) throw new Error("Expected background preset card");
    preset.dispatchEvent(new Event("click"));
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

  it("맵 배경 견본을 고르면 게임 화면 미리보기를 세운다", () => {
    // #3210: the enable toggle and the static first-image preview became preset cards and a live game-screen preview.
    const container = new FakeElement("div");
    renderMapProps(container as unknown as HTMLElement);
    // 배경이 없으면 미리보기도 없다 — 빈 칸에 깨진 그림을 세우지 않는다.
    expect(findByTestId(container, "map-bg-live-preview")).toBeNull();

    const mapId = store.getCurrent().startMapId;
    const preset = findByTestId(container, "map-bg-preset-oprn-sky-day");
    if (!preset) throw new Error("Expected background preset card");
    preset.dispatchEvent(new Event("click"));

    expect(store.getCurrent().maps[mapId]!.background?.imageId).toBe("oprn-pano-sky-day");
    expect(findByTestId(container, "map-bg-live-preview")).not.toBeNull();
    expect(findByTestId(container, "map-bg-preset-oprn-sky-day")?.getAttribute("aria-pressed")).toBe("true");
  });

});
