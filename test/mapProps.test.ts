import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapProps, resetMapPropsTabForTests } from "@/editor/panels/mapProps";
import { deserialize, serialize } from "@/project/io/serialize";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { TroopRecord } from "@/project/types";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { isolateTimers } from "./mergedTeardown";

describe("cloudShadowMapProps", () => {
  isolateTimers();
  describe("map cloud shadows (맵 설정)", () => {
    let restoreDom: () => void;
    let mapId: string;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      store.replace(project);
      mapId = project.startMapId;
      editorState.set({ currentMapId: mapId });
      resetMapPropsTabForTests();
    });

    afterEach(() => {
      restoreDom();
    });

    function render(): FakeElement {
      const container = new FakeElement("div");
      renderMapProps(container as unknown as HTMLElement);
      return container;
    }

    function control(container: FakeElement, testid: string): FakeElement {
      const node = findByTestId(container, testid);
      if (!node) throw new Error(`맵 설정에 ${testid} 컨트롤이 없습니다`);
      return node;
    }

    function toggle(container: FakeElement, testid: string, checked: boolean): void {
      const node = control(container, testid) as unknown as HTMLInputElement;
      node.checked = checked;
      node.dispatchEvent(new Event("change"));
    }

    function type(container: FakeElement, testid: string, value: string): void {
      const node = control(container, testid) as unknown as HTMLInputElement;
      node.value = value;
      node.dispatchEvent(new Event("change"));
    }

    it("「구름 그림자」 섹션과 켬 스위치를 내놓는다", () => {
      const container = render();
      expect(findByTestId(container, "map-props-section-clouds")).not.toBeNull();
      const enable = control(container, "map-cloud-shadows-enable") as unknown as HTMLInputElement;
      expect(enable.checked).toBe(false);
      expect(store.getCurrent().maps[mapId]?.cloudShadows).toBeUndefined();
    });

    it("켜면 맵에 설정을 쓰고, 끄면 필드를 지운다", () => {
      toggle(render(), "map-cloud-shadows-enable", true);
      expect(store.getCurrent().maps[mapId]?.cloudShadows?.enabled).toBe(true);

      toggle(render(), "map-cloud-shadows-enable", false);
      expect(store.getCurrent().maps[mapId]?.cloudShadows).toBeUndefined();
    });

    it("켜면 세부 슬라이더가 나타나고 범위 밖 값은 범위로 접힌다", () => {
      toggle(render(), "map-cloud-shadows-enable", true);
      const enabled = render();

      type(enabled, "map-cloud-shadows-opacity-number", "90");
      expect(store.getCurrent().maps[mapId]?.cloudShadows?.opacity).toBe(0.6);

      type(enabled, "map-cloud-shadows-speed-number", "-40");
      expect(store.getCurrent().maps[mapId]?.cloudShadows?.speed).toBe(0);

      type(enabled, "map-cloud-shadows-angle-number", "400");
      expect(store.getCurrent().maps[mapId]?.cloudShadows?.angleDeg).toBe(40);

      type(enabled, "map-cloud-shadows-scale-number", "20");
      expect(store.getCurrent().maps[mapId]?.cloudShadows?.scale).toBe(0.5);
    });

    it("꺼져 있으면 세부 슬라이더를 숨긴다", () => {
      toggle(render(), "map-cloud-shadows-enable", true);
      toggle(render(), "map-cloud-shadows-enable", false);
      expect(findByTestId(render(), "map-cloud-shadows-opacity")).toBeNull();
    });

    it("저장/로드 왕복에서 구름 그림자 설정이 살아남는다", () => {
      toggle(render(), "map-cloud-shadows-enable", true);
      const enabled = render();
      type(enabled, "map-cloud-shadows-opacity-number", "40");
      type(enabled, "map-cloud-shadows-speed-number", "52");
      type(enabled, "map-cloud-shadows-angle-number", "200");
      type(enabled, "map-cloud-shadows-scale-number", "150");

      const reloaded = deserialize(serialize(store.getCurrent()));
      expect(reloaded.maps[mapId]?.cloudShadows).toEqual({
        enabled: true,
        opacity: 0.4,
        speed: 52,
        angleDeg: 200,
        scale: 1.5,
      });
    });
  });
});

describe("mapEncounterPanel", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  function troop(id: string, name: string): TroopRecord {
    return { id, name, enemyIds: [], autoAlign: true, battleEventPages: [] };
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.database.troops = [troop("troop_a", "풀벌레들"), troop("troop_b", "늑대 무리")];
    store.replace(project);
    editorState.set({ currentMapId: store.getCurrent().startMapId });
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function openEncounterTab(): FakeElement {
    const container = document.createElement("div") as unknown as FakeElement;
    renderMapProps(container as unknown as HTMLElement);
    // 단일 화면 전환 뒤 탭 클릭은 섹션 이동일 뿐 전환이 아니다 — 8섹션이 동시에 붙는지 단언한다.
    for (const tab of ["general", "background", "bgm", "battle", "restrictions", "encounter", "spawns", "minimap"]) {
      expect(findByTestId(container, `map-props-section-${tab}`)).not.toBeNull();
    }
    const tab = findByTestId(container, "map-props-tab-encounter");
    expect(tab).not.toBeNull();
    tab?.click();
    return container;
  }
  function currentMap() {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    return map;
  }
  function change(node: FakeElement | null, value: string): void {
    if (!node) throw new Error("missing control");
    node.value = value;
    node.dispatchEvent(new Event("change"));
  }
  describe("map properties — 인카운터 탭 UI", () => {
    it("인카운트율을 숫자 입력으로 설정한다", () => {
      const container = openEncounterTab();
      change(findByTestId(container, "map-encounter-rate-input"), "8");
      expect(currentMap().encounterRate).toBe(8);
    });

    it("인카운트율 0은 필드를 제거한다", () => {
      const container = openEncounterTab();
      change(findByTestId(container, "map-encounter-rate-input"), "8");
      change(findByTestId(container, "map-encounter-rate-input"), "0");
      expect(currentMap().encounterRate).toBeUndefined();
    });

    it("기본 출현 그룹을 체크박스로 고른다", () => {
      const container = openEncounterTab();
      const check = findByTestId(container, "map-encounter-troop-troop_b");
      expect(check).not.toBeNull();
      if (!check) return;
      check.checked = true;
      check.dispatchEvent(new Event("change"));
      expect(currentMap().troopIds).toEqual(["troop_b"]);
    });

    it("행 추가 → 트룹/가중치 편집 → 삭제가 테이블에 반영된다", () => {
      const container = openEncounterTab();
      findByTestId(container, "map-encounter-row-add")?.click();
      expect(currentMap().encounterTable).toEqual([{ troopId: "troop_a", weight: 1 }]);

      change(findByTestId(container, "map-encounter-troop-select-0"), "troop_b");
      change(findByTestId(container, "map-encounter-weight-0"), "3");
      expect(currentMap().encounterTable).toEqual([{ troopId: "troop_b", weight: 3 }]);

      findByTestId(container, "map-encounter-remove-0")?.click();
      expect(currentMap().encounterTable).toBeUndefined();
    });

    it("조건(시간대/파티 레벨)을 붙였다 떼면 conditions가 생기고 사라진다", () => {
      const container = openEncounterTab();
      findByTestId(container, "map-encounter-row-add")?.click();

      change(findByTestId(container, "map-encounter-timephase-0"), "night");
      change(findByTestId(container, "map-encounter-minlevel-0"), "5");
      expect(currentMap().encounterTable?.[0]?.conditions).toEqual({ timePhase: "night", minPartyLevel: 5 });

      change(findByTestId(container, "map-encounter-timephase-0"), "");
      change(findByTestId(container, "map-encounter-minlevel-0"), "");
      expect(currentMap().encounterTable?.[0]?.conditions).toBeUndefined();
    });

    it("구역 제한 체크 시 맵 전체 사각형이 기본값으로 들어간다", () => {
      const container = openEncounterTab();
      findByTestId(container, "map-encounter-row-add")?.click();

      const toggle = findByTestId(container, "map-encounter-region-toggle-0");
      expect(toggle).not.toBeNull();
      if (!toggle) return;
      toggle.checked = true;
      toggle.dispatchEvent(new Event("change"));

      const map = currentMap();
      expect(map.encounterTable?.[0]?.conditions?.region).toEqual({ x: 0, y: 0, w: map.width, h: map.height });

      change(findByTestId(container, "map-encounter-region-w-0"), "6");
      expect(currentMap().encounterTable?.[0]?.conditions?.region?.w).toBe(6);
    });

    it("구역이 없는 맵에서도 이름 붙은 구역 필드와 그리기 버튼을 낸다", () => {
      // 어포던스 감사(2026-09-11): 0개 맵에서 이 필드를 통째로 숨기던 것이 «기능의 존재를 배울
      // 기회가 없다» 의 가장 강한 근거였다. 자리는 남기고, 빈 이유와 행동을 함께 낸다.
      const container = openEncounterTab();
      findByTestId(container, "map-encounter-row-add")?.click();

      expect(findByTestId(container, "map-encounter-location-0")).not.toBeNull();
      expect(findByTestId(container, "map-encounter-location-empty-0")).not.toBeNull();
      expect(findByTestId(container, "map-encounter-location-draw-0")).not.toBeNull();
    });
  });
});

describe("mapProps", () => {
  isolateTimers();
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
});
