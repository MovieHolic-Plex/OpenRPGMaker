import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { BUILD_PALETTE_GROUP_CLAIMS } from "@/editor/panels/buildPaletteCore";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";
import { editorState } from "@/editor/editorState";
import { getBuildPaletteHouseOptions, getSelectedHouseKitId, getSelectedHouseShapeId, isBuildPaletteEnabled, renderBuildPalettePopup, setBuildPaletteHouseOption, setBuildPaletteEnabled, setSelectedHouseKitId, setSelectedHouseShapeId } from "@/editor/panels/buildPalette";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("buildPaletteClaimLayerHome", () => {
  isolateTimers();
  /**
   * 팔레트 클레임의 layerHome 은 역할 능력의 layerHome 과 의도적으로 갈린다.
   * vocabLayerHomeFor(rmTypeExpander.ts:59-64) 가 group.layerHome → defaultLayer →
   * profile.layerHomeByRole[role] 순으로 해석하므로, 클레임 값은 역할 기본값을 덮는
   * **그룹 단위 오버라이드**다. 같은 role("prop")이 슬롯에 따라 lower/upper/perCell
   * 세 값을 갖는 것이 그 증거이며, 역할 키 조회로는 재현할 수 없다.
   *
   * 이 테스트는 "불일치가 없어야 한다"가 아니라 "알려진 발산이 이 4건 그대로여야 한다"를
   * 고정한다. 클레임이나 역할 표가 바뀌면 이 목록이 변해 눈에 띈다.
   */
  describe("건축 팔레트 클레임의 layerHome", () => {
    const compare = (): { readonly agreed: string[]; readonly diverged: string[] } => {
      const tileset = defaultTileset();
      const agreed: string[] = [];
      const diverged: string[] = [];
      for (const [key, claim] of Object.entries(BUILD_PALETTE_GROUP_CLAIMS)) {
        const fromRole = roleCapabilities(tileset, claim.role).layerHome;
        const line = `${key}  claim=${claim.layerHome}  role(${claim.role})=${fromRole}`;
        if (fromRole !== claim.layerHome) diverged.push(line);
        else agreed.push(line);
      }
      return { agreed, diverged };
    };

    it("역할 기본값을 덮는 오버라이드는 알려진 4건 그대로다", () => {
      expect(compare().diverged).toEqual([
        "door  claim=lower  role(prop)=perCell",
        "window  claim=upper  role(prop)=perCell",
        "roof  claim=lower  role(roof)=perCell",
        "prop  claim=upper  role(prop)=perCell",
      ]);
    });

    it("역할 기본값과 같은 값을 쓰는 4건도 그대로다", () => {
      expect(compare().agreed).toEqual([
        "wall  claim=lower  role(wall)=lower",
        "path  claim=lower  role(terrain)=lower",
        "water  claim=lower  role(water)=lower",
        "tree  claim=perCell  role(prop)=perCell",
      ]);
    });

    /**
     * 컬럼을 지울 수 없는 핵심 이유. role 이 같아도 팔레트 슬롯에 따라 답이 갈리므로
     * roleCapabilities(tileset, role).layerHome 같은 역할 키 조회로는 이 표를 대체할 수 없다.
     * 문은 벽을 대체하니 lower, 창문·꽃은 벽/바닥 위에 겹치니 upper, 나무는 수관(상위)과
     * 밑동(하위)이 갈리니 perCell — 전부 슬롯 단위 사실이고 역할 단위 사실이 아니다.
     */
    it("같은 role 이 슬롯에 따라 서로 다른 layerHome 을 갖는다 — 역할 키 조회로 대체 불가", () => {
      const byRole = new Map<string, Set<string>>();
      for (const claim of Object.values(BUILD_PALETTE_GROUP_CLAIMS)) {
        const homes = byRole.get(claim.role) ?? new Set<string>();
        homes.add(claim.layerHome);
        byRole.set(claim.role, homes);
      }

      expect([...(byRole.get("prop") ?? [])].sort()).toEqual(["lower", "perCell", "upper"]);

      const multivalued = [...byRole.entries()]
        .filter(([, homes]) => homes.size > 1)
        .map(([role, homes]) => `${role}=${[...homes].sort().join("|")}`);
      expect(multivalued).toEqual(["prop=lower|perCell|upper"]);
    });
  });
});

describe("buildPaletteToggle", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  let storage: Map<string, string>;
  function installFakeLocalStorage(): void {
    storage = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, String(value)),
        removeItem: (key: string) => void storage.delete(key),
        clear: () => storage.clear(),
      },
    });
  }
  // 회귀: 건축 모드를 켜면 영역 선택 툴로 전환해야 사용자가 바로 드래그로 영역을 지정할 수 있다.
  // (이 전환이 없으면 건축을 눌러도 그리기 툴이라 "반응 없음"으로 보인다.)
  describe("build palette toggle → tool switch", () => {
    beforeEach(() => {
      restoreDom = installFakeDom();
      installFakeLocalStorage();
      store.replace(createBlankProject());
      editorState.set({ tool: "paint" });
      setBuildPaletteEnabled(false);
      editorState.set({ tool: "paint" });
    });
    afterEach(() => {
      setBuildPaletteEnabled(false);
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
    });

    it("켜면 select 툴로, 끄면 paint 툴로 전환한다", () => {
      expect(isBuildPaletteEnabled()).toBe(false);

      setBuildPaletteEnabled(true);
      expect(isBuildPaletteEnabled()).toBe(true);
      expect(editorState.get().tool).toBe("select");

      setBuildPaletteEnabled(false);
      expect(isBuildPaletteEnabled()).toBe(false);
      expect(editorState.get().tool).toBe("paint");
    });

    it("집 형태와 키트 선택을 localStorage에 저장하고 팝오버 재렌더에서 복원한다", () => {
      setSelectedHouseShapeId("l");
      setSelectedHouseKitId("bright-plaster");
      expect(getSelectedHouseShapeId()).toBe("l");
      expect(getSelectedHouseKitId()).toBe("bright-plaster");

      setBuildPaletteEnabled(true);
      editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });
      const popup = renderBuildPalettePopup();
      expect(popup).toBeTruthy();
      const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
      expect(fakePopup ? findByTestId(fakePopup, "build-shape-l")?.classList.contains("active") : false).toBe(true);
      expect(fakePopup ? findByTestId(fakePopup, "build-kit-bright-plaster")?.classList.contains("active") : false).toBe(true);

      if (fakePopup) {
        findByTestId(fakePopup, "build-shape-u")?.click();
        findByTestId(fakePopup, "build-kit-blue-stone")?.click();
      }
      expect(getSelectedHouseShapeId()).toBe("u");
      expect(getSelectedHouseKitId()).toBe("blue-stone");
    });

    it("집 문 이벤트·내부·창문 옵션 토글을 저장한다", () => {
      expect(getBuildPaletteHouseOptions()).toEqual({ doorEvent: true, interior: true, windows: true });
      setBuildPaletteHouseOption("windows", false);
      expect(getBuildPaletteHouseOptions().windows).toBe(false);

      setBuildPaletteEnabled(true);
      editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });
      const popup = renderBuildPalettePopup();
      const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
      const windows = fakePopup ? findByTestId(fakePopup, "build-option-windows") : null;
      expect(windows?.classList.contains("active")).toBe(false);

      windows?.click();
      expect(getBuildPaletteHouseOptions().windows).toBe(true);
    });

    it("기존 건축 팝오버의 AI 채우기 버튼을 유지한다", () => {
      // Break: bottom-bar cleanup removes an unrelated build-palette action.
      setBuildPaletteEnabled(true);
      editorState.set({ currentMapId: "map_blank_start", selection: { mapId: "map_blank_start", x: 2, y: 2, width: 10, height: 8 } });

      const popup = renderBuildPalettePopup();
      const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;

      expect(fakePopup ? findByTestId(fakePopup, "build-palette-ai") : null).not.toBeNull();
    });

    it.each([
      ["house", "야외 집 한 채"],
      ["village", "마을"],
    ] as const)("%s 버튼은 결정론적 시공 대신 AI 영역 작업을 즉시 실행한다", (primitive, instruction) => {
      const openRegionTask = vi.fn();
      setBuildPaletteEnabled(true);
      editorState.set({
        currentMapId: "map_blank_start",
        selection: { mapId: "map_blank_start", x: 2, y: 3, width: 40, height: 38 },
      });

      const popup = renderBuildPalettePopup(openRegionTask);
      const fakePopup = popup as unknown as Parameters<typeof findByTestId>[0] | null;
      findByTestId(fakePopup!, `build-palette-${primitive}`)?.click();

      expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
        autoRun: true,
        mapId: "map_blank_start",
        region: { x: 2, y: 3, width: 40, height: 38 },
        initialInstruction: expect.stringContaining(instruction),
      }));
    });
  });
});
