import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { selectEyedropperTool, selectTileTool, setTileBrushSize } from "@/editor/panels/tileToolbar";
import { editorState } from "@/editor/editorState";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { store } from "@/project/store";
import { visibleItemCount } from "@/editor/panels/toolbarOverflow";
import { addDatabaseRecord, deleteDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { newCommand } from "@/editor/eventActions";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import { getMapEditHistoryEntries, getMapEditHistoryDebugEntries, getMapEditHistoryMarker, getMapEditHistoryState, peekPreviousProject, recordProjectSnapshot, revertToHistoryIndex, revertToHistoryMarker, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createDatabaseCommandListActions } from "@/editor/panels/databaseCommandListAdapter";
import type { Command } from "@/project/types";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { findWorldCanonAbsenceHits, worldCanonPromptSection } from "@/ai/worldCanonContext";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { applyWelcomeGenrePresetToOpenProject } from "@/editor/welcomeGenrePresetApply";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("tileToolbar", () => {
  isolateTimers();
  describe("RPG Maker tile toolbar actions", () => {
    beforeEach(() => {
      const project = createBlankProject();
      store.replace(project);
      editorState.set({
        activePaletteStamp: null,
        currentMapId: project.startMapId,
        layer: "lower",
        paintShape: "pen",
        selection: null,
        tool: "paint",
      });
    });

    it("switches between pen, rectangle, round, fill, and erase painting modes", () => {
      selectTileTool("rect");
      expect(editorState.get().tool).toBe("paint");
      expect(editorState.get().paintShape).toBe("rect");

      selectTileTool("round");
      expect(editorState.get().tool).toBe("paint");
      expect(editorState.get().paintShape).toBe("round");

      selectTileTool("pen");
      expect(editorState.get().tool).toBe("paint");
      expect(editorState.get().paintShape).toBe("pen");

      selectTileTool("fill");
      expect(editorState.get().tool).toBe("fill");
      expect(editorState.get().paintShape).toBe("pen");

      selectTileTool("erase");
      expect(editorState.get().tool).toBe("erase");
      expect(editorState.get().paintShape).toBe("pen");
    });

    it("moves tile tools off the event layer", () => {
      editorState.set({
        layer: "event",
        tool: "event",
      });

      selectTileTool("rect");

      const state = editorState.get();
      expect(state.layer).toBe("lower");
      expect(state.tool).toBe("paint");
      expect(state.paintShape).toBe("rect");
    });

    it("keeps an existing region only while the select tool is active", () => {
      const project = store.getCurrent();
      const selection = { mapId: project.startMapId, x: 2, y: 3, width: 4, height: 5 };
      editorState.set({ selection });

      selectTileTool("select");
      expect(editorState.get().tool).toBe("select");
      expect(editorState.get().selection).toEqual(selection);

      selectTileTool("pen");
      expect(editorState.get().selection).toBeNull();
    });

    it("moves brush size into toolbar state", () => {
      setTileBrushSize(3);

      expect(editorState.get().brushSize).toBe(3);
    });

    it("selects eyedropper from the folded inspector options", () => {
      editorState.set({
        layer: "event",
        tool: "event",
      });

      selectEyedropperTool();

      const state = editorState.get();
      expect(state.layer).toBe("lower");
      expect(state.paintShape).toBe("pen");
      expect(state.selection).toBeNull();
      expect(state.tool).toBe("eyedropper");
    });
  });
});

describe("toolbarOverflow", () => {
  isolateTimers();
  describe("visibleItemCount", () => {
    it("전부 들어가면 전체 개수를 돌려준다", () => {
      expect(visibleItemCount(400, [50, 50, 50], 30, 4)).toBe(3);
    });

    it("넘치면 ⋯ 버튼 폭을 남기고 최대 개수", () => {
      // 50*4 + gap*3 = 212 > 150 → ⋯(30)+gap 확보 후 들어가는 만큼
      expect(visibleItemCount(150, [50, 50, 50, 50], 30, 4)).toBe(2);
    });

    it("아무것도 안 들어가면 0", () => {
      expect(visibleItemCount(20, [50, 50], 30, 4)).toBe(0);
    });
  });
});

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
