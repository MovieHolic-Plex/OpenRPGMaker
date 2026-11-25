import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_BATTLE_SKIN_IDS, isRetiredBattleSkinId, listActiveBattleSkinIds, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { isActionCombatMap } from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
import { Window } from "happy-dom";
import { betweenTurnActionLabel, betweenTurnClock, betweenTurnDetailText, betweenTurnLogText, betweenTurnSurfaceLabel, buildBetweenTurnRows } from "@/editor/panels/aiBetweenTurnLogRows";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { listAiUiEvents, recordAiUiEvent, resetAiUiEventLogForTest } from "@/ai/uiEventLog";
import { createBetweenTurnLogSection } from "@/editor/panels/aiBetweenTurnLog";
import { BUILD_PALETTE_GROUP_CLAIMS } from "@/editor/panels/buildPaletteCore";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";
import { editorState } from "@/editor/editorState";
import { getBuildPaletteHouseOptions, getSelectedHouseKitId, getSelectedHouseShapeId, isBuildPaletteEnabled, renderBuildPalettePopup, setBuildPaletteHouseOption, setBuildPaletteEnabled, setSelectedHouseKitId, setSelectedHouseShapeId } from "@/editor/panels/buildPalette";
import { executeCanvasAiAction, renderCanvasAiWorkbench, type CanvasAiWorkbenchDeps } from "@/editor/panels/canvasAiWorkbench";
import type { MapId, GameEvent, Project } from "@/project/types";
import { openCanvasInspectionPanel, type CanvasInspectionDeps } from "@/editor/panels/canvasInspectionPanel";
import { resolveCharacterListThumbSource } from "@/editor/panels/characterListThumbnail";
import { listCharacterIdIndex } from "@/project/characterIdIndex";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { Buffer } from "node:buffer";
import { prepareCinematicUpload } from "@/editor/cinematicMediaImport";
import { IMAGE_IMPORT_MAX_BYTES } from "@/editor/panels/resourceManagerImageImport";
import { mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import { isolateTimers } from "./mergedTeardown";

describe("battleSystemDeprecation", () => {
  isolateTimers();
  const SIDEVIEW_WINDOW_IDS = [
    "octopath", "chrono", "bravely", "ff", "goldensun", "rm2003",
  ] as const;
  function renderBattleScreen(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderBattleScreenTab(host as unknown as HTMLElement);
    };
    rerender();
    return host;
  }
  describe("battle skin registry — 전투 방식 둘 (2026-10-02)", () => {
    it("새로 고를 수 있는 건 retro2003·pokemon 둘이다", () => {
      expect(listActiveBattleSkinIds()).toEqual([...ACTIVE_BATTLE_SKIN_IDS]);
      expect(listActiveBattleSkinIds()).toEqual(["retro2003", "pokemon"]);
    });

    it("창 색만 다르던 측면 스킨 여섯은 지웠고 저장된 값은 retro2003 으로 풀린다", () => {
      for (const id of SIDEVIEW_WINDOW_IDS) {
        expect(listBattleSkinIds() as string[], id).not.toContain(id);
        expect(resolveSkinId(id), id).toBe("retro2003");
      }
    });

    it("2종 등록, 지운 정면 스킨 저장값은 retro2003 으로 풀린다(저장된 프로젝트 보존)", () => {
      expect(listBattleSkinIds()).toHaveLength(2);
      expect(resolveSkinId("vxace")).toBe("retro2003");
      expect(resolveSkinId("rm2000")).toBe("retro2003");
      expect(isRetiredBattleSkinId("retro2003")).toBe(false);
      expect(isRetiredBattleSkinId("ff")).toBe(true);
    });
  });
  describe("자료집 전투 화면 탭 — 전투 방식", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
    });

    it("두 방식만 보이고 빈 프로젝트는 도트 측면이 골라져 있다", () => {
      const host = renderBattleScreen();
      expect(findByTestId(host, "db-battle-method-side")?.attrs["aria-checked"]).toBe("true");
      expect(findByTestId(host, "db-battle-method-monster")?.attrs["aria-checked"]).toBe("false");
    });

    it("몬스터 대치를 누르면 화면과 규칙이 같이 바뀌고, 도트 측면을 누르면 둘 다 기본으로 돌아간다", () => {
      const host = renderBattleScreen();
      findByTestId(host, "db-battle-method-monster")!.click();
      expect(store.getCurrent().system.battleUiStyle).toBe("pokemon");
      expect(store.getCurrent().system.battleModel).toBe("gen1");
      findByTestId(host, "db-battle-method-side")!.click();
      expect(store.getCurrent().system.battleUiStyle).toBeUndefined();
      expect(store.getCurrent().system.battleModel).toBeUndefined();
    });
  });
  describe("action combat support", () => {
    it("supports a correctly opted-in action map without a deprecation warning", () => {
      const project = createBlankProject();
      project.system.actionCombat = { enabled: true };
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      map.actionCombat = true;

      expect(isActionCombatMap(project, map)).toBe(true);
      expect(projectLint(project).some(issue => issue.code === "deprecated:action-combat")).toBe(false);
    });

    it("액션 전투가 비활성화되었거나 없으면 지원 종료 issue 를 내지 않는다", () => {
      const disabled = createBlankProject();
      disabled.system.actionCombat = { enabled: false };
      const absent = createBlankProject();
      delete absent.system.actionCombat;

      for (const project of [disabled, absent]) {
        expect(projectLint(project).some((issue) => issue.code === "deprecated:action-combat")).toBe(false);
      }
    });

    it("저장된 액션 전투 맵의 런타임 활성 조건은 그대로 유지한다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      project.system.actionCombat = { enabled: true };
      map.actionCombat = true;

      expect(isActionCombatMap(project, map)).toBe(true);
      map.actionCombat = false;
      expect(isActionCombatMap(project, map)).toBe(false);
      map.actionCombat = true;
      project.system.actionCombat.enabled = false;
      expect(isActionCombatMap(project, map)).toBe(false);
    });
  });
  describe("shipped project battle skin authoring", () => {
    it("출하 프로젝트 팩터리는 지원 중인 배틀 스킨만 저작한다", async () => {
      // 데모·쇼케이스 팩터리는 배럴이 아니라 defaultProject 에 있다(배럴은 가벼운 것만 내보낸다).
      const defaults = await import("@/project/defaults/defaultProject");
      // Covered: createBlankProject, createScarloxyDemoProject.
      // Factories requiring arguments or network/LegacyDb access are intentionally skipped.
      const factories = [
        ["createBlankProject", defaults.createBlankProject],
        ["createScarloxyDemoProject", defaults.createScarloxyDemoProject],
      ] as const;

      for (const [name, factory] of factories) {
        const project = factory();
        const skinId = project.system.battleUiStyle;
        expect(
          !isRetiredBattleSkinId(skinId),
          `${name} authors retired battle skin ${skinId}`,
        ).toBe(true);
      }
    }, 30_000);
  });
});

describe("betweenTurnLog", () => {
  isolateTimers();
  const AT = "2026-10-05T05:00:00.000Z";
  beforeEach(() => {
    const window = new Window();
    vi.stubGlobal("document", window.document);
    vi.stubGlobal("localStorage", window.localStorage);
    vi.stubGlobal("Event", window.Event);
    vi.stubGlobal("Node", window.Node);
    resetAiUiEventLogForTest();
  });
  afterEach(() => {
    resetAiUiEventLogForTest();
    vi.unstubAllGlobals();
  });
  describe("턴 사이 기록 문장", () => {
    it("표면·동작을 사람이 읽는 이름으로 옮기고 모르는 값은 원문을 남긴다", () => {
      expect(betweenTurnSurfaceLabel("panel")).toBe("조수 패널");
      expect(betweenTurnSurfaceLabel("composer")).toBe("입력창");
      expect(betweenTurnSurfaceLabel("새-표면")).toBe("새-표면");
      expect(betweenTurnActionLabel("click:ai-more-menu-toggle")).toBe("클릭");
      expect(betweenTurnActionLabel("change:ai-box")).toBe("값 변경");
      expect(betweenTurnActionLabel(AI_UI_ACTIONS.turnRewind)).toBe("턴 되감기");
      expect(betweenTurnActionLabel("낯선 동작")).toBe("낯선 동작");
    });

    it("시각을 못 읽는 값은 지어내지 않고 원문을 그대로 보여 준다", () => {
      expect(betweenTurnClock(AT)).toHaveLength(8);
      expect(betweenTurnClock("어제")).toBe("어제");
    });

    it("상세는 자르되 자른 사실을 밝히고, 빈 상세는 만들지 않는다", () => {
      expect(betweenTurnDetailText(undefined)).toBeUndefined();
      expect(betweenTurnDetailText({})).toBeUndefined();
      expect(betweenTurnDetailText({ restored: 3 })).toBe('{"restored":3}');
      const clipped = betweenTurnDetailText({ text: "가".repeat(400) }) as string;
      expect(clipped.endsWith("자 생략]")).toBe(true);
    });
  });
  describe("턴 사이 기록 행", () => {
    function seed(): void {
      recordAiUiEvent({ surface: "panel", action: "click:ai-more-menu-toggle", testid: "ai-more-menu-toggle", label: "더보기", at: AT });
      recordAiUiEvent({
        surface: "panel", action: AI_UI_ACTIONS.turnRewind, testid: "ai-rewind",
        detail: { restored: 3 }, reason: "직전 지시로 되돌리기", at: AT, disabled: true,
      });
    }

    it("최신이 앞이고 같은 seq 는 한 번만 담는다", () => {
      seed();
      const events = listAiUiEvents();
      const rows = buildBetweenTurnRows([...events, events[0]!]);
      expect(rows).toHaveLength(2);
      expect(rows[0]!.actionLabel).toBe("턴 되감기");
      expect(rows[1]!.actionLabel).toBe("클릭");
    });

    it("이름·testid·이유·상세로 검색하고 limit 을 지킨다", () => {
      seed();
      const events = listAiUiEvents();
      expect(buildBetweenTurnRows(events, { query: "되감기" })).toHaveLength(1);
      expect(buildBetweenTurnRows(events, { query: "ai-more-menu-toggle" })).toHaveLength(1);
      expect(buildBetweenTurnRows(events, { query: "직전 지시" })).toHaveLength(1);
      expect(buildBetweenTurnRows(events, { query: "없는말" })).toHaveLength(0);
      expect(buildBetweenTurnRows(events, { limit: 1 })).toHaveLength(1);
    });

    it("행에는 대상·이유·상세·비활성 표시가 실린다", () => {
      seed();
      const rows = buildBetweenTurnRows(listAiUiEvents());
      expect(rows[0]).toMatchObject({ target: "ai-rewind", reason: "직전 지시로 되돌리기", detail: '{"restored":3}', disabled: true });
      expect(rows[1]!.target).toBe("더보기");
    });

    it("내보내기 글은 헤더와 행 문장을 담고 빈 목록도 밝힌다", () => {
      seed();
      const text = betweenTurnLogText(buildBetweenTurnRows(listAiUiEvents()), AT);
      expect(text.split("\n")[0]).toContain("조수 턴 사이 기록 · 2건");
      expect(text).toContain("턴 되감기");
      expect(text).toContain("이유: 직전 지시로 되돌리기");
      expect(text).toContain("비활성 상태");
      expect(betweenTurnLogText([], AT)).toContain("(기록 없음)");
    });
  });
  describe("턴 사이 기록 표면", () => {
    function open(): HTMLDetailsElement {
      const section = createBetweenTurnLogSection() as HTMLDetailsElement;
      document.body.append(section);
      recordAiUiEvent({ surface: "panel", action: "click:ai-more-menu-toggle", testid: "ai-more-menu-toggle", label: "더보기", at: AT });
      recordAiUiEvent({ surface: "composer", action: AI_UI_ACTIONS.instructionsSave, testid: "ai-instructions-save", reason: "지시문 저장", at: AT });
      section.open = true;
      section.dispatchEvent(new Event("toggle"));
      return section;
    }

    it("열면 이 브라우저에 남은 기록을 최신 순으로 보여 준다", () => {
      const section = open();
      const rows = section.querySelectorAll('[data-testid="ai-between-turns-row"]');
      expect(rows).toHaveLength(2);
      expect(rows[0]!.textContent).toContain("지시문 저장");
      expect(rows[1]!.textContent).toContain("더보기");
      expect(section.querySelector('[data-testid="ai-between-turns-meta"]')?.textContent).toContain("2건");
      expect(section.querySelector<HTMLElement>('[data-testid="ai-between-turns-more"]')?.hidden).toBe(true);
    });

    it("검색은 행을 좁히고 결과 없음도 말한다", () => {
      const section = open();
      const search = section.querySelector('[data-testid="ai-between-turns-search"]') as HTMLInputElement;
      search.value = "더보기";
      search.dispatchEvent(new Event("input"));
      expect(section.querySelectorAll('[data-testid="ai-between-turns-row"]')).toHaveLength(1);
      search.value = "없는말";
      search.dispatchEvent(new Event("input"));
      expect(section.querySelector('[data-testid="ai-between-turns-list"]')?.textContent).toContain("검색 결과가 없어요.");
    });

    it("복사는 클립보드로 보이고 실패도 알린다", async () => {
      const section = open();
      const writeText = vi.fn(async (_text: string) => undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      (section.querySelector('[data-testid="ai-between-turns-copy"]') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(String(writeText.mock.calls[0]?.[0])).toContain("조수 턴 사이 기록 · 2건");
      await vi.waitFor(() => expect(section.querySelector('[data-testid="ai-between-turns-status"]')?.textContent).toContain("복사했어요"));
      vi.stubGlobal("navigator", {});
      (section.querySelector('[data-testid="ai-between-turns-copy"]') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(section.querySelector('[data-testid="ai-between-turns-status"]')?.textContent).toContain("복사하지 못했어요"));
    });

    it("지우기는 이 브라우저의 기록만 비운다", () => {
      const section = open();
      (section.querySelector('[data-testid="ai-between-turns-clear"]') as HTMLButtonElement).click();
      expect(listAiUiEvents()).toHaveLength(0);
      expect(section.querySelectorAll('[data-testid="ai-between-turns-row"]')).toHaveLength(0);
      expect(section.querySelector('[data-testid="ai-between-turns-list"]')?.textContent).toContain("아직 턴 사이 기록이 없어요.");
    });
  });
});

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

describe("canvasAiWorkbench", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function asFake(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("expected FakeElement");
  }
  function makeDeps(overrides: Partial<CanvasAiWorkbenchDeps> = {}): CanvasAiWorkbenchDeps {
    const project = createBlankProject();
    return {
      getProject: () => project,
      getState: () => editorState.get(),
      openInspection: vi.fn(),
      openRegionTask: vi.fn(),
      selectBuildMode: vi.fn(),
      selectRegionTool: vi.fn(),
      toast: vi.fn(),
      ...overrides,
    };
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
    editorState.set({
      currentMapId: null,
      selection: null,
      tool: "paint",
    });
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  describe("canvas AI workbench actions", () => {
    it("opens the existing deterministic build palette for 만들기", () => {
      const deps = makeDeps();

      executeCanvasAiAction("create", deps);

      expect(deps.selectBuildMode).toHaveBeenCalledOnce();
    });

    it("asks for a region before running 다듬기", () => {
      const deps = makeDeps();

      executeCanvasAiAction("polish", deps);

      expect(deps.selectRegionTool).toHaveBeenCalledOnce();
      expect(deps.openRegionTask).not.toHaveBeenCalled();
      expect(deps.toast).toHaveBeenCalledWith("다듬을 영역을 드래그해 선택하세요.", "info");
    });

    it("runs 다듬기 through the bounded region AI preview flow", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const openRegionTask = vi.fn();
      const deps = makeDeps({
        getProject: () => project,
        getState: () => ({
          ...editorState.get(),
          currentMapId: mapId,
          selection: { mapId, x: 3, y: 4, width: 6, height: 5 },
        }),
        openRegionTask,
      });

      executeCanvasAiAction("polish", deps);

      expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
        autoRun: true,
        mapId,
        region: { x: 3, y: 4, width: 6, height: 5 },
      }));
      expect(openRegionTask.mock.calls[0]?.[0].initialInstruction).toContain("반복되는 타일을 줄이고");
    });

    it("opens AI 요청 on the whole current map when nothing is selected", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      const openRegionTask = vi.fn();
      const deps = makeDeps({
        getProject: () => project,
        getState: () => ({ ...editorState.get(), currentMapId: mapId }),
        openRegionTask,
      });

      executeCanvasAiAction("ask", deps);

      expect(openRegionTask).toHaveBeenCalledWith({
        autoRun: false,
        mapId,
        region: { x: 0, y: 0, width: map.width, height: map.height },
      });
    });

    it("opens the deterministic inspection results for 검사", () => {
      const project = createBlankProject();
      const openInspection = vi.fn();
      const deps = makeDeps({ getProject: () => project, openInspection });

      executeCanvasAiAction("inspect", deps);

      expect(openInspection).toHaveBeenCalledWith({
        mapId: project.startMapId,
        project,
      });
    });

    it("renders all four functional actions", () => {
      const root = asFake(renderCanvasAiWorkbench(makeDeps()));

      expect(findByTestId(root, "canvas-ai-create")?.textContent).toContain("만들기");
      expect(findByTestId(root, "canvas-ai-polish")?.textContent).toContain("다듬기");
      expect(findByTestId(root, "canvas-ai-inspect")?.textContent).toContain("검사");
      expect(findByTestId(root, "canvas-ai-ask")?.textContent).toContain("AI 요청");
    });
  });
});

describe("canvasInspectionPanel", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    document.querySelector('[data-testid="canvas-inspection-panel"]')?.remove();
    restoreDom?.();
    restoreDom = null;
  });
  describe("canvas inspection panel", () => {
    it("shows deterministic lint counts and can focus a located issue", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const focusIssue = vi.fn();
      const deps: CanvasInspectionDeps = {
        focusIssue,
        lint: () => [
          { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
          { code: "map-size", mapId, message: "맵이 너무 큽니다.", severity: "warning" },
        ],
        openRegionTask: vi.fn(),
      };

      const panel = openCanvasInspectionPanel({ deps, mapId, project });

      expect(findByTestId(panel, "canvas-inspection-summary")?.textContent).toContain("문제 2개");
      expect(panel.querySelectorAll('[data-testid="canvas-inspection-item"]')).toHaveLength(2);
      findByTestId(panel, "canvas-inspection-focus-0")?.click();
      expect(focusIssue).toHaveBeenCalledWith({ mapId, x: 4, y: 5 });
    });

    it("sends a located issue to the bounded AI repair preview", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const openRegionTask = vi.fn();
      const deps: CanvasInspectionDeps = {
        focusIssue: vi.fn(),
        lint: () => [
          { code: "blocked-entry", mapId, message: "입구가 막혀 있습니다.", severity: "error", x: 4, y: 5 },
        ],
        openRegionTask,
      };

      const panel = openCanvasInspectionPanel({ deps, mapId, project });
      findByTestId(panel, "canvas-inspection-fix-0")?.click();

      expect(openRegionTask).toHaveBeenCalledWith(expect.objectContaining({
        autoRun: false,
        mapId,
        region: { x: 2, y: 3, width: 5, height: 5 },
      }));
      expect(openRegionTask.mock.calls[0]?.[0].initialInstruction).toContain("입구가 막혀 있습니다.");
    });

    it("shows a clean result when lint finds no issues", () => {
      const project = createBlankProject();
      const deps: CanvasInspectionDeps = {
        focusIssue: vi.fn(),
        lint: () => [],
        openRegionTask: vi.fn(),
      };

      const panel = openCanvasInspectionPanel({ deps, mapId: project.startMapId, project });

      expect(findByTestId(panel, "canvas-inspection-empty")?.textContent).toContain("문제를 찾지 못했습니다");
    });
  });
});

describe("characterListThumbnail", () => {
  isolateTimers();
  const CHARSET_ID = "tex_easyrpg_charset_people1";
  function entryFor(project: Project, characterId: string) {
    const entry = listCharacterIdIndex(project).find((item) => item.characterId === characterId);
    if (!entry) throw new Error(`missing entry ${characterId}`);
    return entry;
  }
  function withHostEvent(project: Project, event: GameEvent): Project {
    const mapId = project.startMapId;
    project.maps[mapId].events = [event];
    return project;
  }
  describe("resolveCharacterListThumbSource", () => {
    it("returns charset resource from first host's first non-transparent sprite page", () => {
      const project = createBlankProject();
      withHostEvent(project, {
        id: "ev_used",
        x: 1,
        y: 2,
        characterId: "char_used",
        pages: [
          {
            id: "p0",
            name: "투명",
            conditions: [],
            commands: [],
            graphic: { transparent: true, sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" } },
          },
          {
            id: "p1",
            name: "본체",
            conditions: [],
            commands: [],
            graphic: {
              sprite: { type: "bundled", id: CHARSET_ID },
              pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }),
            },
          },
        ],
      });

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_used"));
      expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 3 });
    });

    it("falls back to first sprite page when all sprites are transparent", () => {
      const project = createBlankProject();
      withHostEvent(project, {
        id: "ev_trans",
        x: 0,
        y: 0,
        characterId: "char_trans",
        pages: [
          {
            id: "p0",
            name: "투명만",
            conditions: [],
            commands: [],
            graphic: { transparent: true, sprite: { type: "bundled", id: CHARSET_ID } },
          },
        ],
      });

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_trans"));
      expect(source).toEqual({ resourceId: CHARSET_ID, characterIndex: 0 });
    });

    it("returns null for unused profiles (no hosts)", () => {
      const project = createBlankProject();
      project.characters = {
        char_idle: { displayName: "미사용" },
      };
      project.maps[project.startMapId].events = [];

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_idle"));
      expect(source).toBeNull();
    });

    it("returns null for orphan events without any charset graphic", () => {
      const project = createBlankProject();
      withHostEvent(project, {
        id: "ev_orphan",
        x: 2,
        y: 3,
        characterId: "char_orphan",
        pages: [{ id: "p1", name: "고아 NPC", conditions: [], commands: [] }],
      });

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_orphan"));
      expect(source).toBeNull();
    });

    it("uses hosts[0] only even when a later host has a graphic", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId].events = [
        {
          id: "ev_first",
          x: 0,
          y: 0,
          characterId: "char_multi",
          pages: [{ id: "p1", name: "빈", conditions: [], commands: [] }],
        },
        {
          id: "ev_second",
          x: 1,
          y: 1,
          characterId: "char_multi",
          pages: [
            {
              id: "p1",
              name: "스프라이트",
              conditions: [],
              commands: [],
              graphic: { sprite: { type: "bundled", id: CHARSET_ID } },
            },
          ],
        },
      ];

      const source = resolveCharacterListThumbSource(project, entryFor(project, "char_multi"));
      expect(source).toBeNull();
    });
  });
});

describe("cinematicMediaImport", () => {
  isolateTimers();
  type UploadKind = Parameters<typeof prepareCinematicUpload>[1];
  const readers: ControlledReader[] = [];
  const images: ControlledImage[] = [];
  const media: ControlledMedia[] = [];
  class ControlledReader {
    readyState = 0;
    result: string | ArrayBuffer | null = null;
    error: DOMException | null = null;
    blob!: Blob;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    constructor() { readers.push(this); }
    readAsDataURL(blob: Blob): void {
      this.blob = blob;
      this.readyState = 1;
    }
    complete(result: string | ArrayBuffer | null): void {
      this.result = result;
      this.readyState = 2;
      this.onload?.();
    }
    abort = vi.fn(() => {
      this.readyState = 2;
      this.onabort?.();
    });
  }
  class ControlledImage {
    src = "";
    naturalWidth = 320;
    naturalHeight = 240;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { images.push(this); }
    removeAttribute(name: string): void {
      if (name === "src") this.src = "";
    }
  }
  class ControlledMedia {
    src = "";
    preload = "";
    muted = false;
    readyState = 0;
    duration = 3;
    videoWidth = 640;
    videoHeight = 360;
    onloadedmetadata: (() => void) | null = null;
    onloadeddata: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    load = vi.fn();
    pause = vi.fn();
    play = vi.fn();
    constructor(readonly tag: string) { media.push(this); }
    removeAttribute(name: string): void {
      if (name === "src") this.src = "";
    }
  }
  function fileFor(kind: UploadKind): File {
    if (kind === "image") return new File(["image bytes"], "scene.gif", { type: "image/gif" });
    if (kind === "video") return new File(["video bytes"], "scene.webm", { type: "video/webm" });
    return new File(["audio bytes"], "voice.ogg", { type: "audio/ogg" });
  }
  async function completeRead(): Promise<string> {
    const reader = readers.at(-1)!;
    const bytes = Buffer.from(await reader.blob.arrayBuffer());
    const dataUrl = `data:${reader.blob.type};base64,${bytes.toString("base64")}`;
    reader.complete(dataUrl);
    return dataUrl;
  }
  function completeDecode(kind: UploadKind): void {
    if (kind === "image") images.at(-1)!.onload?.();
    else {
      const target = media.at(-1)!;
      target.readyState = 2;
      target.onloadeddata?.();
    }
  }
  beforeEach(() => {
    vi.useFakeTimers();
    readers.length = 0;
    images.length = 0;
    media.length = 0;
    vi.stubGlobal("FileReader", ControlledReader);
    vi.stubGlobal("Image", ControlledImage);
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag !== "audio" && tag !== "video") throw new Error(`Unexpected native resource: ${tag}`);
        return new ControlledMedia(tag);
      },
    });
    // Preserve real store behavior; preparation must never access it.
    vi.spyOn(store, "getCurrent");
    vi.spyOn(store, "update");
  });
  afterEach(() => {
    try {
      expect(store.getCurrent).not.toHaveBeenCalled();
      expect(store.update).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
  describe("prepareCinematicUpload", () => {
    it.each(["png", "jpeg", "gif", "webp"])("preserves %s payload bytes without canvas conversion", async (format) => {
      const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
      const file = new File([bytes], `scene.${format}`, { type: `image/${format}` });
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      const promise = prepareCinematicUpload(file, "image", controller.signal);
      const dataUrl = await completeRead();
      expect(images[0].src).toBe(dataUrl);
      completeDecode("image");
      const asset = await promise;
      expect(asset).toMatchObject({
        name: "scene",
        kind: "picture",
        dataUrl,
        meta: { width: 320, height: 240 },
      });
      expect(asset.id.startsWith("picture_img")).toBe(true);
      expect(Buffer.from(asset.dataUrl.split(",")[1], "base64")).toEqual(Buffer.from(bytes));
      expect(images[0].src).toBe("");
      expect(images[0].onload).toBeNull();
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    });

    it.each([
      ["scene.gif", "", "image/gif"],
      ["scene.webp", "application/octet-stream", "image/webp"],
      ["scene.jpg", "image/jpg", "image/jpeg"],
    ])("canonicalizes the header for %s without changing bytes", async (name, type, mime) => {
      const promise = prepareCinematicUpload(new File(["original"], name, { type }), "image", new AbortController().signal);
      const dataUrl = await completeRead();
      completeDecode("image");
      expect((await promise).dataUrl).toBe(dataUrl);
      expect(dataUrl).toBe(`data:${mime};base64,${Buffer.from("original").toString("base64")}`);
    });

    it.each([
      ["video", "scene.webm", "video/webm"],
      ["video", "scene.mp4", "video/mp4"],
      ["video", "scene.m4v", "video/mp4"],
      ["video", "scene.ogv", "video/ogg"],
      ["audio", "voice.wav", "audio/wav"],
      ["audio", "voice.mp3", "audio/mpeg"],
      ["audio", "voice.ogg", "audio/ogg"],
    ] as const)("prepares %s %s after decodable data without playback", async (kind, name, mime) => {
      const promise = prepareCinematicUpload(new File(["payload"], name, { type: mime }), kind, new AbortController().signal);
      const dataUrl = await completeRead();
      const target = media[0];
      expect(target.tag).toBe(kind);
      target.readyState = 1;
      target.onloadedmetadata?.();
      expect(target.pause).not.toHaveBeenCalled();
      expect(target.src).toBe(dataUrl);
      completeDecode(kind);
      const asset = await promise;
      expect(asset.kind).toBe(kind === "video" ? "movie" : "sound");
      expect(asset.id.startsWith(kind === "video" ? "movie" : "se")).toBe(true);
      expect(asset.dataUrl).toBe(dataUrl);
      expect(asset.meta).toEqual(kind === "video" ? { width: 640, height: 360 } : {});
      expect(target.play).not.toHaveBeenCalled();
      expect(target.pause).toHaveBeenCalledOnce();
      expect(target.src).toBe("");
      expect(target.onloadeddata).toBeNull();
      expect(target.load).toHaveBeenCalledTimes(2);
    });

    it("accepts a decoded video whose duration is not yet known", async () => {
      const promise = prepareCinematicUpload(fileFor("video"), "video", new AbortController().signal);
      const accepted = expect(promise).resolves.toMatchObject({
        kind: "movie",
        meta: { width: 640, height: 360 },
      });
      await completeRead();
      media[0].duration = Number.POSITIVE_INFINITY;
      completeDecode("video");
      await accepted;
      expect(media[0].src).toBe("");
    });

    it.each(["image", "video", "audio"] as const)("rejects empty and oversized %s before reading", async (kind) => {
      const source = fileFor(kind);
      await expect(prepareCinematicUpload(new File([], source.name, { type: source.type }), kind, new AbortController().signal))
        .rejects.toBeInstanceOf(RangeError);
      const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
      Object.defineProperty(source, "size", { value: limit + 1 });
      await expect(prepareCinematicUpload(source, kind, new AbortController().signal)).rejects.toBeInstanceOf(RangeError);
      expect(readers).toHaveLength(0);
    });

    it.each(["image", "video", "audio"] as const)("accepts the exact %s size boundary", async (kind) => {
      const source = fileFor(kind);
      const limit = kind === "image" ? IMAGE_IMPORT_MAX_BYTES : mediaImportRuleFor(kind === "video" ? "movie" : "sound")!.maxBytes;
      Object.defineProperty(source, "size", { value: limit });
      const controller = new AbortController();
      const promise = prepareCinematicUpload(source, kind, controller.signal);
      expect(readers).toHaveLength(1);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      controller.abort();
      await rejection;
    });

    it.each([
      ["image", "scene.svg", "image/svg+xml"],
      ["video", "scene.avi", "video/x-msvideo"],
      ["audio", "voice.mid", "audio/midi"],
      ["video", "scene.webm", "image/png"],
      ["audio", "voice.ogg", "video/ogg"],
    ] as const)("rejects unsupported %s format %s before reading", async (kind, name, type) => {
      await expect(prepareCinematicUpload(new File(["x"], name, { type }), kind, new AbortController().signal))
        .rejects.toBeInstanceOf(TypeError);
      expect(readers).toHaveLength(0);
    });

    it("propagates native read errors", async () => {
      const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
      const error = new DOMException("read failed", "NotReadableError");
      const rejection = expect(promise).rejects.toBe(error);
      readers[0].error = error;
      readers[0].readyState = 2;
      readers[0].onerror?.();
      await rejection;
      expect(readers[0].abort).not.toHaveBeenCalled();
      expect(readers[0].onerror).toBeNull();
      expect(images).toHaveLength(0);
    });

    it("propagates synchronous read failures and removes the deadline", async () => {
      const error = new Error("read failed");
      vi.spyOn(ControlledReader.prototype, "readAsDataURL").mockImplementationOnce(() => { throw error; });
      await expect(prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal)).rejects.toBe(error);
    });

    it.each([null, "", "data:image/gif;base64,", "data:text/plain;base64,eA=="])("rejects an unusable reader result", async (result) => {
      const promise = prepareCinematicUpload(fileFor("image"), "image", new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "NotReadableError" });
      readers[0].complete(result);
      await rejection;
      expect(images).toHaveLength(0);
    });

    it.each(["image", "video", "audio"] as const)("rejects %s decoder failures and releases native resources", async (kind) => {
      const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
      await completeRead();
      const target = kind === "image" ? images[0] : media[0];
      target.onerror?.();
      await rejection;
      expect(target.src).toBe("");
      expect(target.onerror).toBeNull();
    });

    it.each(["image", "video", "audio"] as const)("rejects invalid %s dimensions or duration", async (kind) => {
      const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "EncodingError" });
      await completeRead();
      if (kind === "image") images[0].naturalWidth = 0;
      else if (kind === "video") media[0].videoHeight = 0;
      else media[0].duration = Number.NaN;
      completeDecode(kind);
      await rejection;
    });

    it("rejects pre-aborted work without allocating native resources", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(prepareCinematicUpload(fileFor("image"), "image", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
      expect(readers).toHaveLength(0);
    });

    it("aborts a pending reader and ignores its late completion", async () => {
      const controller = new AbortController();
      const promise = prepareCinematicUpload(fileFor("image"), "image", controller.signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      controller.abort();
      await rejection;
      expect(readers[0].abort).toHaveBeenCalledOnce();
      readers[0].complete("data:image/gif;base64,eA==");
      expect(images).toHaveLength(0);
    });

    it.each(["image", "video", "audio"] as const)("cancels pending %s decoding", async (kind) => {
      const controller = new AbortController();
      const promise = prepareCinematicUpload(fileFor(kind), kind, controller.signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      await completeRead();
      controller.abort();
      await rejection;
      expect((kind === "image" ? images[0] : media[0]).src).toBe("");
      completeDecode(kind);
    });

    it("rejects cancellation between the final native event and async return", async () => {
      const controller = new AbortController();
      const promise = prepareCinematicUpload(fileFor("video"), "video", controller.signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
      await completeRead();
      completeDecode("video");
      controller.abort();
      await rejection;
    });

    it.each(["read", "image", "video", "audio"] as const)("bounds stalled %s preparation without polling", async (stage) => {
      const kind = stage === "read" ? "image" : stage;
      const promise = prepareCinematicUpload(fileFor(kind), kind, new AbortController().signal);
      const rejection = expect(promise).rejects.toMatchObject({ name: "TimeoutError" });
      if (stage !== "read") await completeRead();
      vi.advanceTimersByTime(15_000);
      await rejection;
      if (stage === "read") expect(readers[0].abort).toHaveBeenCalledOnce();
      else expect((kind === "image" ? images[0] : media[0]).src).toBe("");
    });
  });
});
