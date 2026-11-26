import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { addDatabaseRecord, deleteDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { newCommand } from "@/editor/eventActions";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import { getMapEditHistoryEntries, getMapEditHistoryDebugEntries, getMapEditHistoryMarker, getMapEditHistoryState, peekPreviousProject, recordProjectSnapshot, revertToHistoryIndex, revertToHistoryMarker, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createDatabaseCommandListActions } from "@/editor/panels/databaseCommandListAdapter";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { renderTopbar, RETIRED_TOPBAR_CONTROLS } from "@/editor/panels/menu";
import { listEditorCommands } from "@/editor/commandRegistry";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { findWorldCanonAbsenceHits, worldCanonPromptSection } from "@/ai/worldCanonContext";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { applyWelcomeGenrePresetToOpenProject } from "@/editor/welcomeGenrePresetApply";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { readCodexEntryFromUrl } from "@/editor/panels/worldEntries";
import { resolveRelationTarget } from "@/editor/panels/worldRelationTarget";
import type { WorldEntity } from "@/project/world/types";
import { isolateTimers } from "./mergedTeardown";

describe("undoHistory", () => {
  isolateTimers();
  beforeEach(() => {
    vi.unstubAllGlobals();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  function itemName(id: string): string | undefined {
    return store.getCurrent().database.items.find((entry) => entry.id === id)?.name;
  }
  function itemCount(): number {
    return store.getCurrent().database.items.length;
  }
  describe("database record undo/redo", () => {
    it("restores and reapplies a record field edit through undo/redo", () => {
      const id = addDatabaseRecord("items");
      updateDatabaseRecord("items", id, { name: "검" });
      expect(itemName(id)).toBe("검");

      expect(undoMapEdit()).toBe(true);
      expect(itemName(id)).toBe("새 아이템");

      expect(redoMapEdit()).toBe(true);
      expect(itemName(id)).toBe("검");
    });

    it("undoes a record addition and deletion", () => {
      const baseline = itemCount();
      const id = addDatabaseRecord("items");
      expect(itemCount()).toBe(baseline + 1);

      // 삭제 → undo 로 복원.
      expect(deleteDatabaseRecord("items", id)).toEqual({ ok: true });
      expect(itemCount()).toBe(baseline);
      expect(undoMapEdit()).toBe(true);
      expect(itemCount()).toBe(baseline + 1);

      // 추가 자체도 undo 로 제거.
      expect(undoMapEdit()).toBe(true);
      expect(itemCount()).toBe(baseline);
    });

    it("coalesces consecutive edits to the same field into a single snapshot", () => {
      const id = addDatabaseRecord("items");
      // 같은 필드를 keystroke 처럼 여러 번 편집 → 스냅샷 1개만.
      updateDatabaseRecord("items", id, { name: "검" });
      updateDatabaseRecord("items", id, { name: "검 " });
      updateDatabaseRecord("items", id, { name: "검신" });
      expect(itemName(id)).toBe("검신");

      // 한 번의 undo 로 편집 시작 이전(기본 이름)으로 되돌아간다.
      expect(undoMapEdit()).toBe(true);
      expect(itemName(id)).toBe("새 아이템");

      // 그 다음 undo 는 레코드 추가 이전 상태.
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().database.items.find((entry) => entry.id === id)).toBeUndefined();
    });

    it("keeps separate snapshots for edits to different fields", () => {
      const id = addDatabaseRecord("items");
      updateDatabaseRecord("items", id, { name: "검" });
      updateDatabaseRecord("items", id, { price: 100 });
      expect(itemName(id)).toBe("검");
      expect(store.getCurrent().database.items.find((entry) => entry.id === id)?.price).toBe(100);

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().database.items.find((entry) => entry.id === id)?.price).toBe(0);
      expect(itemName(id)).toBe("검");

      expect(undoMapEdit()).toBe(true);
      expect(itemName(id)).toBe("새 아이템");
    });
  });
  describe("snapshot dedup", () => {
    it("does not push duplicate consecutive snapshots for identical state", () => {
      recordProjectSnapshot();
      recordProjectSnapshot();
      recordProjectSnapshot();
      expect(getMapEditHistoryState().canUndo).toBe(true);
      expect(undoMapEdit()).toBe(true);
      // 동일 상태 3회 기록이 1개로 dedup 되어 두 번째 undo 는 없다.
      expect(undoMapEdit()).toBe(false);
    });

    it("stores optional labels and keeps no-argument calls backward compatible", () => {
      const mapId = store.getCurrent().startMapId;
      recordProjectSnapshot("AI: 집 건설", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 101;
      });
      recordProjectSnapshot();

      const entries = getMapEditHistoryEntries();
      expect(entries[0]).toMatchObject({ label: "편집", mapId: null, current: true });
      expect(entries[1]).toMatchObject({ label: "AI: 집 건설", mapId, current: false });
      expect(entries[0]?.at).toBeGreaterThan(entries[1]?.at ?? -1);
    });

    it("peeks previous snapshots as clones and reverts to a history index", () => {
      const mapId = store.getCurrent().startMapId;
      recordProjectSnapshot("첫 변경", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 111;
      });
      const afterFirst = structuredClone(store.getCurrent());
      recordProjectSnapshot("둘째 변경", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 222;
      });

      const entries = getMapEditHistoryEntries();
      expect(entries.map((entry) => entry.label)).toEqual(["둘째 변경", "첫 변경"]);
      expect(entries[0]?.current).toBe(true);

      const peeked = peekPreviousProject();
      expect(peeked).toEqual(afterFirst);
      if (!peeked) throw new Error("expected peeked project");
      peeked.maps[mapId].lowerTiles[0] = 999;
      expect(peekPreviousProject()).toEqual(afterFirst);

      expect(revertToHistoryIndex(entries[0]?.index ?? -1)).toBe(true);
      expect(store.getCurrent()).toEqual(afterFirst);

      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(222);
    });

    // 조수 패널의 턴 되감기("여기서 다시")가 쓰는 진입점. 턴 시작 시점의 마커만 들고 있다가
    // 그 시점 이후 스냅샷을 한 번에 되돌린다 — 인덱스는 MAX_HISTORY shift 로 흔들려서 못 쓴다.
    it("reverts every snapshot taken at or after a marker", () => {
      const mapId = store.getCurrent().startMapId;
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 5;
      });
      const beforeTurn = structuredClone(store.getCurrent());
      const marker = getMapEditHistoryMarker();

      // 한 턴 안에서 두 번 편집했다고 가정한다.
      recordProjectSnapshot("AI 1차", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 111;
      });
      recordProjectSnapshot("AI 2차", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 222;
      });

      expect(revertToHistoryMarker(marker)).toBe(true);
      expect(store.getCurrent()).toEqual(beforeTurn);
    });

    it("reports false when nothing was recorded after the marker", () => {
      const mapId = store.getCurrent().startMapId;
      recordProjectSnapshot("턴 전 편집", mapId);
      store.update((project) => {
        project.maps[mapId].lowerTiles[0] = 7;
      });
      const marker = getMapEditHistoryMarker();
      const untouched = structuredClone(store.getCurrent());

      // 이 턴은 프로젝트를 건드리지 않았다 — 되돌릴 것이 없다는 사실을 호출자가 알아야 한다
      // (조수 패널은 이 값으로 "편집도 되돌렸다" 와 "대화만 되감았다" 를 갈라 말한다).
      expect(revertToHistoryMarker(marker)).toBe(false);
      expect(store.getCurrent()).toEqual(untouched);
      expect(revertToHistoryMarker(Number.NaN)).toBe(false);
    });

    it("stores map-kind snapshots as per-map history and keeps redo symmetric", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const otherMap = createBlankMap("다른 맵", 12, 12);
      store.update((draft) => {
        draft.maps[otherMap.id] = otherMap;
        draft.mapTree.children.push({ mapId: otherMap.id, children: [] });
      });

      recordProjectSnapshot("현재 맵 칠하기", mapId, { kind: "map" });
      store.update((draft) => {
        draft.maps[mapId].lowerTiles[0] = 111;
        draft.maps[otherMap.id].lowerTiles[0] = 777;
      });

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles[0]).not.toBe(111);
      expect(store.getCurrent().maps[otherMap.id].lowerTiles[0]).toBe(777);

      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(111);
      expect(store.getCurrent().maps[otherMap.id].lowerTiles[0]).toBe(777);
    });

    it("keeps single-map paint history well below full-project snapshot volume", () => {
      const base = createBlankProject();
      for (let index = 1; index < 10; index += 1) {
        const map = createBlankMap(`메모리 맵 ${index}`, 24, 24);
        base.maps[map.id] = map;
        base.mapTree.children.push({ mapId: map.id, children: [] });
      }
      store.replace(base);
      resetMapEditHistory();

      const mapId = store.getCurrent().startMapId;
      for (let index = 0; index < 50; index += 1) {
        recordProjectSnapshot(`페인트 ${index}`, mapId, { kind: "map" });
        store.update((project) => {
          project.maps[mapId].lowerTiles[index] = index + 100;
        });
      }

      const entries = getMapEditHistoryDebugEntries();
      const mapSnapshotBytes = entries.reduce((sum, entry) => sum + entry.serializedLength, 0);
      const projectBytes = JSON.stringify(store.getCurrent()).length;

      expect(entries).toHaveLength(50);
      expect(entries.every((entry) => entry.kind === "map" && entry.mapId === mapId)).toBe(true);
      // 전체 프로젝트 50벌은 projectBytes * 50에 가깝다. 10맵 프로젝트에서 단일 맵 50벌은
      // 대략 1/10 수준이므로, 직렬화 오버헤드를 감안해도 projectBytes * 5 미만이어야 한다.
      expect(mapSnapshotBytes).toBeLessThan(projectBytes * 5);
    });
  });
  describe("database-hosted command list undo (common events)", () => {
    function seedCommonEvent(): string {
      const id = "ce_test";
      store.update((project) => {
        project.commonEvents.push({ id, name: "테스트 공용", trigger: "none", commands: [] });
      });
      return id;
    }

    function commonEventCommands(id: string): Command[] {
      return store.getCurrent().commonEvents.find((entry) => entry.id === id)?.commands ?? [];
    }

    it("undoes a command added to a common event", () => {
      const id = seedCommonEvent();
      const actions = createDatabaseCommandListActions({
        get commands() {
          return commonEventCommands(id);
        },
        replaceCommands: (next) => {
          store.update((project) => {
            const target = project.commonEvents.find((entry) => entry.id === id);
            if (target) target.commands = structuredClone(next);
          });
        },
      });

      actions.addCommand([], newCommand("wait"));
      expect(commonEventCommands(id)).toHaveLength(1);

      expect(undoMapEdit()).toBe(true);
      expect(commonEventCommands(id)).toHaveLength(0);

      expect(redoMapEdit()).toBe(true);
      expect(commonEventCommands(id)).toHaveLength(1);
    });
  });
  describe("handleHistoryHotkey", () => {
    function keyEvent(
      key: string,
      opts: { ctrl?: boolean; shift?: boolean; target?: unknown } = {}
    ): KeyboardEvent {
      return {
        key,
        ctrlKey: opts.ctrl ?? true,
        metaKey: false,
        altKey: false,
        shiftKey: Boolean(opts.shift),
        target: opts.target,
        preventDefault: () => {},
      } as unknown as KeyboardEvent;
    }

    it("undoes on Ctrl+Z and redoes on Ctrl+Y / Ctrl+Shift+Z", () => {
      const id = addDatabaseRecord("items");
      updateDatabaseRecord("items", id, { name: "검" });

      expect(handleHistoryHotkey(keyEvent("z"))).toBe(true);
      expect(itemName(id)).toBe("새 아이템");

      expect(handleHistoryHotkey(keyEvent("y"))).toBe(true);
      expect(itemName(id)).toBe("검");

      expect(handleHistoryHotkey(keyEvent("z", { shift: true }))).toBe(false);
      // 편집 시작 전 상태(추가만 남음)로 undo 후 redo(shift+z) 로 되돌린다.
      expect(handleHistoryHotkey(keyEvent("z"))).toBe(true);
      expect(itemName(id)).toBe("새 아이템");
      expect(handleHistoryHotkey(keyEvent("z", { shift: true }))).toBe(true);
      expect(itemName(id)).toBe("검");
    });

    it("ignores the shortcut while a text input is focused", () => {
      class FakeInput {
        tagName = "INPUT";
        isContentEditable = false;
      }
      vi.stubGlobal("HTMLElement", FakeInput);
      const id = addDatabaseRecord("items");
      updateDatabaseRecord("items", id, { name: "검" });

      expect(handleHistoryHotkey(keyEvent("z", { target: new FakeInput() }))).toBe(false);
      expect(itemName(id)).toBe("검");
    });

    it("does not handle plain keys without a modifier", () => {
      expect(handleHistoryHotkey(keyEvent("z", { ctrl: false }))).toBe(false);
    });
  });
});

describe("windowControls", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length(): number {
      return this.values.size;
    }

    clear(): void {
      this.values.clear();
    }

    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
      return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.values.delete(key);
    }

    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }
  let restoreDom: (() => void) | null = null;
  let storage: MemoryStorage;
  function fakeElement(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("Expected fake element");
  }
  function fakeBody(): FakeElement {
    if (document.body instanceof FakeElement) return document.body;
    throw new Error("Expected fake body");
  }
  function installStorage(): void {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
  function installFullscreenDocument(): void {
    const html = document.createElement("html");
    Object.defineProperty(document, "documentElement", {
      configurable: true,
      value: html,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(document, "addEventListener", {
      configurable: true,
      value: vi.fn(),
    });
  }
  /**
   * 데스크톱 앱 렌더러 흉내 — 기본 vitest 환경(node)에는 window 가 없다. 프리로드가 붙이는
   * window.oprn 브릿지를 window 위에 세우고, 끝나면 지우는 함수를 돌려준다. 코드가
   * `typeof window !== "undefined"` 로 가드를 걸므로 window 자체를 정의해야 하고,
   * 없는 속성(addEventListener 등)은 no-op 함수로 돌려준다.
   */
  function installDesktopBridge(bridge: object | null): () => void {
    const base: Record<string, unknown> = bridge ? { oprn: bridge } : {};
    const win = new Proxy(base, {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        if (prop === "document") return document;
        if (prop in globalThis) return (globalThis as Record<string | symbol, unknown>)[prop];
        return () => {};
      },
      has() { return true; },
    });
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: win });
    return () => {
      Reflect.deleteProperty(globalThis, "window");
    };
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    restoreDom = installFakeDom();
    installStorage();
    installFullscreenDocument();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
    vi.restoreAllMocks();
  });
  /**
   * 2026-11 개편: 전체화면 단추는 톱바를 떠나 ⌘K 「화면: 전체화면 전환」 명령이 집이다.
   * 명령은 menu.ts 를 실행 때 불러오므로 click() 은 한 틱 뒤에 끝난다 — 아래 단언은 그 뒤를 기다린다.
   */
  function fullscreenCommand(): { click(): void } {
    const command = listEditorCommands().find((entry) => entry.id === "window-fullscreen");
    if (!command) throw new Error("window-fullscreen command missing");
    return { click: () => command.run() };
  }
  async function settleCommand(): Promise<void> {
    await import("@/editor/panels/menu");
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  }
  describe("상단 창 컨트롤", () => {
    it("툴바 접기 버튼은 없다 — 접을 두 번째 툴바 행이 사라졌다(2026-09-03)", () => {
      // Break: 편집 모드 클래식 툴바 행이 되살아나 「─」 접기 버튼과 함께 돌아온다.
      const topbar = document.createElement("div");
      renderTopbar(topbar);

      expect(findByTestId(fakeElement(topbar), "window-toolbar-collapse")).toBeNull();
      expect(findByTestId(fakeElement(topbar), "oprn-toolbar")).toBeNull();
      expect(document.body.classList.contains("toolbar-collapsed")).toBe(false);
      // 2026-11 개편: 전체화면 단추도 톱바에 없다 — ⌘K 명령이 집이다.
      expect(findByTestId(fakeElement(topbar), "window-fullscreen")).toBeNull();
    });

    it("⌘K 전체화면 명령이 requestFullscreen을 호출한다", async () => {
      const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        configurable: true,
        value: requestFullscreen,
      });
      const fullscreen = fullscreenCommand();

      fullscreen.click();
      await settleCommand();

      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it("전체화면 API가 없으면 토스트를 표시하고 예외 없이 반환한다", async () => {
      const fullscreen = fullscreenCommand();

      expect(() => fullscreen.click()).not.toThrow();
      await settleCommand();
      expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("전체화면");
    });

    it("데스크톱 창 브릿지가 있으면 전체화면을 창 컨트롤로 토글한다", async () => {
      // Break: 브릿지가 있는데도 브라우저 Fullscreen API 를 부르면, 네이티브 전체화면으로 뜬
      // 앱 창은 「축소」가 되지 않는다(2026-10-05 사용자 보고).
      const requestFullscreen = vi.fn<() => Promise<void>>(() => Promise.resolve());
      Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
      const windowControl = vi.fn(async () => true);
      const disposeBridge = installDesktopBridge({ windowControl });
      try {
        const fullscreen = fullscreenCommand();

        fullscreen.click();
        await settleCommand();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(windowControl).toHaveBeenCalledWith("toggle-fullscreen");
        expect(requestFullscreen).not.toHaveBeenCalled();
      } finally {
        disposeBridge();
      }
    });

    it("보관된 전체화면 단추는 데스크톱 네이티브 전체화면 상태를 구독해 aria-pressed 를 맞춘다", async () => {
      // Break: 창 컨트롤로 들어간 전체화면은 document.fullscreenElement 를 바꾸지 않아
      // 아이콘이 항상 「아님」으로 남는다.
      const listeners: Array<(fullscreen: boolean) => void> = [];
      const disposeBridge = installDesktopBridge({
        windowControl: vi.fn(async () => true),
        windowFullscreen: async () => true,
        onWindowFullscreen: (callback: (fullscreen: boolean) => void) => {
          listeners.push(callback);
          return () => { listeners.length = 0; };
        },
      });
      try {
        // 2026-11 개편으로 톱바에서 뺐지만 되살릴 수 있게 보관한 단추(RETIRED_TOPBAR_CONTROLS)가 이 계약을 지킨다.
        const fullscreen = fakeElement(RETIRED_TOPBAR_CONTROLS.fullscreen());

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fullscreen.getAttribute("aria-pressed")).toBe("true");

        for (const listener of listeners) listener(false);
        expect(fullscreen.getAttribute("aria-pressed")).toBe("false");
      } finally {
        disposeBridge();
      }
    });
  });
});

describe("worldCanonConsumers", () => {
  isolateTimers();
  describe("worldCanon → assistant context", () => {
    it("injects the canon as a fixed block with absences as hard constraints", () => {
      const project = createBlankProject();
      project.worldCanon = {
        name: "서녘 공화국",
        premise: "마법은 피의 대가다.",
        tones: ["grim", "political"],
        absences: ["총", "엘프"],
        laws: { death: { present: false, note: "부활 없음" } },
        body: "왕위는 비어 있다.",
      };
      const prompt = buildSystemPrompt(project, { budgetChars: 20000 });
      expect(prompt).toContain("## 이 세계(세계관 고정)");
      expect(prompt).toContain("서녘 공화국");
      expect(prompt).toContain("총, 엘프");
      // 예산 밖 고정분 — 초소형 예산에서도 살아남는다.
      const tiny = buildSystemPrompt(project, { budgetChars: 600 });
      expect(tiny).toContain("## 이 세계(세계관 고정)");
    });

    it("emits nothing when the canon is empty and never revives the entity digest", () => {
      const project = createBlankProject();
      expect(worldCanonPromptSection(project.worldCanon)).toBeNull();
      const prompt = buildSystemPrompt(project, { budgetChars: 20000 });
      expect(prompt).not.toContain("## 이 세계(세계관 고정)");
      expect(prompt).not.toContain("## 세계관 다이제스트");
    });

    // 2026-09-20 사용자 요청: 세계관이 틀리면 안 되므로 본문 상한을 600 → 20,000자로 올렸다.
    // 이 절은 예산 슬라이싱 밖의 고정분이라, 상한이 없으면 본문 하나가 실제 대화 기록을 밀어낸다.
    // 그래서 "무제한"이 아니라 "실사용에서 잘릴 일이 거의 없는 선"으로 잡는다.
    it("긴 본문은 20,000자까지 싣고, 그 위는 잘라 고지한다", () => {
      // 상한 안쪽은 전문이 그대로 실린다(잘림 표시가 없어야 한다).
      const inside = worldCanonPromptSection({ body: "가".repeat(19_000) });
      expect(inside).not.toBeNull();
      expect(inside).toContain("가".repeat(19_000));
      expect(inside).not.toContain("이 세계 본문");

      // 상한을 넘으면 잘리고, 얼마나 남았는지 고지한다.
      const beyond = worldCanonPromptSection({ body: "가".repeat(25_000) });
      expect(beyond).not.toBeNull();
      expect(beyond).toContain("…(이 세계 본문 5000자 더 있음");
      // 잘림 고지까지 포함해도 상한 + 고지문 수준이어야 한다(폭주 방지).
      expect((beyond ?? "").length).toBeLessThan(20_400);
    });
    it("treats a status-only shell as empty so it never emits a phantom block", () => {
      expect(worldCanonPromptSection({ status: "canon" })).toBeNull();
      const project = createBlankProject();
      project.worldCanon = { status: "canon" };
      expect(buildSystemPrompt(project, { budgetChars: 20000 })).not.toContain("## 이 세계(세계관 고정)");
    });

    it("marks the status line so draft/canon/secret read differently", () => {
      expect(worldCanonPromptSection({ name: "서녘", status: "canon" })).toContain("확정");
      expect(worldCanonPromptSection({ name: "서녘", status: "secret" })).toContain("비밀");
      expect(worldCanonPromptSection({ name: "서녘" })).not.toContain("상태:");
    });
  });
  describe("findWorldCanonAbsenceHits", () => {
    it("returns nothing when the canon is undefined", () => {
      expect(findWorldCanonAbsenceHits("총을 들어라", undefined)).toEqual([]);
    });

    it("returns nothing when the text is empty", () => {
      expect(findWorldCanonAbsenceHits("", { absences: ["총"] })).toEqual([]);
    });

    it("returns nothing when absence entries are empty", () => {
      expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국" })).toEqual([]);
      expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국", absences: [] })).toEqual([]);
      expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국", absences: [""] })).toEqual([]);
    });
  });
  describe("worldCanon → database overview", () => {
    let cleanup: (() => void) | undefined;
    beforeEach(() => {
      cleanup = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => cleanup?.());

    function render(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      renderOverviewTab(host as unknown as HTMLElement, () => undefined);
      return host;
    }

    it("shows the authored world name and premise", () => {
      store.update((draft) => {
        draft.worldCanon = { name: "안개 해안", premise: "바다가 기억을 삼킨다." };
      });
      const card = findByTestId(render(), "db-overview-canon");
      expect(card?.textContent).toContain("안개 해안");
      expect(card?.textContent).toContain("바다가 기억을 삼킨다.");
    });

    it("invites authoring when the canon is empty", () => {
      const card = findByTestId(render(), "db-overview-canon");
      expect(card?.textContent).toContain("이 세계를 적어 보세요");
    });
  });
  describe("worldCanon → welcome genre seed", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("seeds tones and a premise when the canon is blank", () => {
      applyWelcomeGenrePresetToOpenProject("monster-collect");
      const canon = store.getCurrent().worldCanon;
      expect(canon?.tones?.length ?? 0).toBeGreaterThan(0);
      expect(canon?.premise).toBeTruthy();
    });

    it("never overwrites an authored canon", () => {
      store.update((draft) => {
        draft.worldCanon = { name: "내 세계", tones: ["gothic"] };
      });
      applyWelcomeGenrePresetToOpenProject("monster-collect");
      expect(store.getCurrent().worldCanon).toEqual({ name: "내 세계", tones: ["gothic"] });
    });
  });
});

describe("worldCodexJump", () => {
  isolateTimers();
  function renderOverview(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    renderOverviewTab(host as unknown as HTMLElement, () => undefined);
    return host;
  }
  describe("overview codex card (click-to-jump RED-first)", () => {
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
      cleanup = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => cleanup?.());

    it("shows a codex card that explains loose cards live outside the canon", () => {
      const card = findByTestId(renderOverview(), "db-overview-codex");
      expect(card?.textContent ?? "").toContain("설정집");
    });

    it("routes the codex card at the codex tab, not the canon tab", () => {
      const card = findByTestId(renderOverview(), "db-overview-codex");
      expect(card?.attrs.title ?? "").toContain("설정집");
    });
  });
  describe("codex url entry (RED-first)", () => {
    it("parses a tab+entity deep link from the query string", () => {
      expect(readCodexEntryFromUrl("?codexTab=character&codexEntity=w_char_1")).toEqual({ tab: "character", entityId: "w_char_1" });
    });

    it("returns null for a query without codex params", () => {
      expect(readCodexEntryFromUrl("?map=map_village")).toBeNull();
    });

    it("returns null when the tab or the entity is missing", () => {
      expect(readCodexEntryFromUrl("?codexTab=character")).toBeNull();
      expect(readCodexEntryFromUrl("?codexEntity=w_char_1")).toBeNull();
    });

    it("returns null for an unknown tab", () => {
      expect(readCodexEntryFromUrl("?codexTab=nope&codexEntity=w_char_1")).toBeNull();
    });
  });
  describe("codex deep link adopt", () => {
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
      cleanup = installFakeDom();
      const project = createBlankProject();
      project.world = {
        entities: [
          { id: "w_char_1", type: "character", name: "아린", summary: "주인공", origin: "user" },
        ],
        relations: [],
      };
      store.replace(project as Project);
    });

    afterEach(() => cleanup?.());

    it("selects the linked card on first render", () => {
      const guard = setSearch("?codexTab=character&codexEntity=w_char_1");
      try {
        const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
        expect(findByTestId(panel, "world-tab-character")?.classList.contains("active")).toBe(true);
        expect(findByTestId(panel, "world-card-w_char_1")?.classList.contains("active")).toBe(true);
      } finally {
        guard.restore();
      }
    });

    it("ignores a deep link for an unknown entity", () => {
      const guard = setSearch("?codexTab=character&codexEntity=w_nope");
      try {
        const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
        expect(findByTestId(panel, "world-card-w_nope")).toBeNull();
      } finally {
        guard.restore();
      }
    });
  });
  function setSearch(search: string): { restore: () => void } {
    const prev = (globalThis as Record<string, unknown>).window;
    const win = (typeof prev === "object" && prev !== null ? prev : {}) as Record<string, unknown>;
    win.location = { ...((win.location ?? {}) as Record<string, unknown>), search };
    (globalThis as Record<string, unknown>).window = win;
    return { restore: () => { (globalThis as Record<string, unknown>).window = prev; } };
  }
});

describe("worldRelationTarget", () => {
  isolateTimers();
  const card = (id: string, name: string): WorldEntity => ({ id, type: "place", name, summary: "", origin: "user" });
  const targets = [card("w_a", "은빛 항구"), card("w_b", "은빛 상단"), card("w_c", "폐탑"), card("w_d", "폐탑 지하")];
  const labels = new Map(targets.map((entity) => [entity.id, entity.name] as const));
  describe("연결 속성 입력 → 문서 id", () => {
    it("id 와 정확한 이름은 바로 찾는다", () => {
      expect(resolveRelationTarget("w_a", targets, labels)).toEqual({ kind: "found", id: "w_a" });
      expect(resolveRelationTarget(" 은빛 항구 ", targets, labels)).toEqual({ kind: "found", id: "w_a" });
    });
    it("정확한 이름이 부분 일치보다 먼저다", () => {
      expect(resolveRelationTarget("폐탑", targets, labels)).toEqual({ kind: "found", id: "w_c" });
    });
    it("유일한 부분 일치만 찾고, 여럿이면 모호하다고 돌려준다", () => {
      expect(resolveRelationTarget("지하", targets, labels)).toEqual({ kind: "found", id: "w_d" });
      expect(resolveRelationTarget("은빛", targets, labels)).toEqual({ kind: "ambiguous" });
    });
    it("없는 이름과 빈 입력은 저장하지 않는다", () => {
      expect(resolveRelationTarget("없는 문서", targets, labels)).toEqual({ kind: "none" });
      expect(resolveRelationTarget("  ", targets, labels)).toEqual({ kind: "none" });
    });
    it("같은 이름이 둘이면 「이름 · id」 표시 이름으로 고른다", () => {
      const dup = [card("w_x", "마을"), card("w_y", "마을")];
      const dupLabels = new Map([["w_x", "마을 · w_x"], ["w_y", "마을 · w_y"]]);
      expect(resolveRelationTarget("마을", dup, dupLabels)).toEqual({ kind: "ambiguous" });
      expect(resolveRelationTarget("마을 · w_y", dup, dupLabels)).toEqual({ kind: "found", id: "w_y" });
    });
  });
});
