// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { resetAdoptionWorkbench } from "@/editor/mapLocationAdoptionState";
import { ADOPTION_TESTIDS, adoptionMapCheckboxTestId, adoptionRoleCheckboxTestId, closeLocationAdoptionPanel, openLocationAdoptionPanel } from "@/editor/panels/mapLocationAdoptionPanel";
import { mapLocations } from "@/project/mapNamedLocations";
import { store } from "@/project/store";
import type { GameMap, MapLayoutPlan, UploadedAsset } from "@/project/types";
import { renderMarkdown } from "@/util/markdown";
import { createConversationLogHost, renderStreamedMarkdown } from "@/editor/panels/aiConversationLog";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { inspectProjectSuggestions, selectProjectSuggestions } from "@/ai/projectSuggestions";
import { createProjectSuggestions, type SuggestionSnapshot } from "@/editor/panels/aiProjectSuggestions";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { renderResourceWorkbench } from "@/editor/panels/resourceManagerViews";
import { isolateTimers } from "./mergedTeardown";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { closeMapContextMenu } from "@/editor/panels/mapContextMenu";
import { renderMapList, resetMapListUiStateForTests } from "@/editor/panels/mapList";
import { resetMapPanelSectionForTests, setMapPanelCollapsed } from "@/editor/workspace/mapPanelSection";
import { listEditorCommands } from "@/editor/commandRegistry";
import { mountDock, renderDockPanels } from "@/editor/workspace/dockHost";
import { getWorkspaceLayout, resetWorkspaceForTests, subscribeWorkspace } from "@/editor/workspace/workspaceStore";
import { layoutFromPreset } from "@/editor/workspace/workspaceLayout";
import { resetInspectionPinsForTests, SIDEBAR_PINS_KEY } from "@/editor/panels/sidebarInspectionPins";
import { openTilesetTileBrowser } from "@/editor/panels/tilesetTileBrowser";
import { filterSpatialBrowserCards, renderSpatialAssetBrowser } from "@/editor/panels/spatialAssetBrowser";
import { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { bindSpatialAuthoringControllerFactory, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { resetSpacesAuthoringSession } from "@/editor/panels/spatialSpaceCommands";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { spaceCompilerFixture, spaceDesign, interiorAtlas } from "./support/spatialSpaceCompilerFixture";

describe("editorPanelsSuite8", () => {
  isolateTimers();
  // LOC-ADOPT — 이관 창의 DOM 계약. 실제 DOM 에서 실제 store 를 지난다.
  //
  // 창이 지켜야 하는 것은 「눌리는가」가 아니라 「무엇을 보여 준 뒤에 눌리는가」다:
  // 열기는 조사만, 실행 버튼은 선택 없이 무해, 두 번째 실행은 영수증에 멱등이라 적힌다.
  describe("mapLocationAdoptionPanel", () => {
    isolateTimers();
    const VILLAGE = "village_map";
    const PLAIN = "plain_map";
    function makeMap(id: string, name: string, layoutPlan?: MapLayoutPlan): GameMap {
      const size = 40;
      return {
        id,
        name,
        width: size,
        height: size,
        tilesetId: "easyrpg_chipset_combined_town",
        tileSize: 16,
        lowerTiles: new Array(size * size).fill(TILE.GRASS),
        upperTiles: new Array(size * size).fill(TILE.EMPTY),
        events: [],
        ...(layoutPlan ? { layoutPlan } : {}),
      };
    }
    function seed(withPlan = true): void {
      const project = createBlankProject();
      project.maps[VILLAGE] = makeMap(
        VILLAGE,
        "큰 강 마을",
        withPlan
          ? {
            version: 1,
            kind: "large-river-market-village",
            regions: [
              { id: "plaza_1", role: "plaza", label: "중앙 광장", x: 10, y: 10, w: 6, h: 6 },
              { id: "market_1", role: "market", label: "북쪽 상점가", x: 20, y: 4, w: 8, h: 5 },
              { id: "house_1", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 5, h: 5 },
            ],
          }
          : undefined,
      );
      project.maps[PLAIN] = makeMap(PLAIN, "빈 들판");
      project.startMapId = VILLAGE;
      store.replace(project);
      editorState.set({ currentMapId: VILLAGE });
      resetMapEditHistory();
      resetAdoptionWorkbench();
    }
    function testId(id: string): HTMLElement | null {
      return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    }
    function click(id: string): void {
      const node = testId(id);
      if (!node) throw new Error(`missing testid: ${id}`);
      node.click();
    }
    function check(id: string, value: boolean): void {
      const node = testId(id) as HTMLInputElement | null;
      if (!node) throw new Error(`missing testid: ${id}`);
      node.checked = value;
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }
    describe("layout adoption workbench panel", () => {
      beforeEach(() => {
        seed();
      });

      afterEach(() => {
        closeLocationAdoptionPanel();
        document.body.innerHTML = "";
        resetAdoptionWorkbench();
        resetMapEditHistory();
      });

      it("opening shows a read-only survey and writes nothing", () => {
        const before = JSON.stringify(store.getCurrent());
        openLocationAdoptionPanel();
        expect(testId(ADOPTION_TESTIDS.host)).not.toBeNull();
        // 설계 기록이 있는 맵만 나온다.
        expect(testId(`location-adoption-map-${VILLAGE}`)).not.toBeNull();
        expect(testId(`location-adoption-map-${PLAIN}`)).toBeNull();
        expect(testId(ADOPTION_TESTIDS.summary)?.textContent).toContain("승격 후보 2개");
        expect(JSON.stringify(store.getCurrent())).toBe(before);
      });

      it("says nothing will change while no map is selected, and running is refused", () => {
        openLocationAdoptionPanel();
        expect(testId(ADOPTION_TESTIDS.summary)?.textContent).toContain("고른 맵이 없어");
        click(ADOPTION_TESTIDS.run);
        expect(store.getCurrent().maps[VILLAGE]!.locations).toBeUndefined();
        expect(testId(ADOPTION_TESTIDS.receipt)).toBeNull();
      });

      it("shows the role filter with defaults on and construction roles off with a stated reason", () => {
        openLocationAdoptionPanel();
        expect((testId(adoptionRoleCheckboxTestId("plaza")) as HTMLInputElement).checked).toBe(true);
        expect((testId(adoptionRoleCheckboxTestId("market")) as HTMLInputElement).checked).toBe(true);
        const house = testId(adoptionRoleCheckboxTestId("house")) as HTMLInputElement;
        expect(house.checked).toBe(false);
        expect(testId(ADOPTION_TESTIDS.roleFilter)?.textContent).toContain("houseProtection");
      });

      it("turning a role on immediately re-counts the survey", () => {
        openLocationAdoptionPanel();
        check(adoptionRoleCheckboxTestId("house"), true);
        expect(testId(ADOPTION_TESTIDS.summary)?.textContent).toContain("승격 후보 3개");
      });

      it("adopts only the checked map and prints a receipt", () => {
        openLocationAdoptionPanel();
        check(adoptionMapCheckboxTestId(VILLAGE), true);
        click(ADOPTION_TESTIDS.run);
        expect(mapLocations(store.getCurrent().maps[VILLAGE]!)).toHaveLength(2);
        expect(store.getCurrent().maps[PLAIN]!.locations).toBeUndefined();
        const receipt = testId(ADOPTION_TESTIDS.receipt);
        expect(receipt?.textContent).toContain("구역 2개 생성");
        expect(receipt?.textContent).toContain("되돌리기 한 번");
      });

      it("the second run reports idempotency instead of adding duplicates", () => {
        openLocationAdoptionPanel();
        check(adoptionMapCheckboxTestId(VILLAGE), true);
        click(ADOPTION_TESTIDS.run);
        click(ADOPTION_TESTIDS.run);
        expect(mapLocations(store.getCurrent().maps[VILLAGE]!)).toHaveLength(2);
        expect(testId(ADOPTION_TESTIDS.receipt)?.textContent).toContain("이미 전부 승격돼 있습니다");
      });

      it("one undo removes the whole adoption made through the panel", () => {
        openLocationAdoptionPanel();
        check(adoptionMapCheckboxTestId(VILLAGE), true);
        click(ADOPTION_TESTIDS.run);
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().maps[VILLAGE]!.locations).toBeUndefined();
      });

      it("surfaces a name collision in the survey before the run", () => {
        store.update((project) => {
          project.maps[VILLAGE]!.locations = [{ id: "loc1", name: "중앙 광장", x: 30, y: 30, w: 2, h: 2 }];
        });
        openLocationAdoptionPanel();
        expect(testId(`location-adoption-collision-${VILLAGE}`)?.textContent).toContain("중앙 광장");
      });

      it("tells the user plainly when the project has no builder plans at all", () => {
        seed(false);
        openLocationAdoptionPanel();
        expect(testId(ADOPTION_TESTIDS.empty)?.textContent).toContain("이관할 것이 없습니다");
        expect(testId(ADOPTION_TESTIDS.run)).toBeNull();
      });
    });
  });
  describe("markdownTables", () => {
    isolateTimers();
    function cells(root: ParentNode, selector: string): (string | null)[] {
      return Array.from(root.querySelectorAll(selector), (cell) => cell.textContent);
    }
    const wideHeaders = Array.from({ length: 24 }, (_, index) => `column-${index}`);
    const wideValues = wideHeaders.map((_, index) => `value-${index}-abcdefghijklmnopqrstuvwxyz`);
    const wideAnswer = [
      "```text", "literal | code", "```",
      `| ${wideHeaders.join(" | ")} |`,
      `| ${wideHeaders.map(() => "---").join(" | ")} |`,
      `| ${wideValues.join(" | ")} |`,
    ].join("\n");
    describe("Markdown pipe tables", () => {
      it("renders a real 24-column table when it follows fenced code", () => {
        const root = renderMarkdown(wideAnswer);

        expect(root.querySelectorAll("table")).toHaveLength(1);
        expect(cells(root, "thead > tr > th")).toEqual(wideHeaders);
        expect(cells(root, "tbody > tr > td")).toEqual(wideValues);
        expect(root.querySelector("pre > code")?.textContent).toBe("literal | code");
        expect(root.querySelector("th")?.getAttribute("scope")).toBe("col");
      });

      it.each(["none", "both", "leading", "trailing"])("accepts %s outer pipes", (outer) => {
        const row = (text: string): string => `${outer === "both" || outer === "leading" ? "| " : ""}${text}${outer === "both" || outer === "trailing" ? " |" : ""}`;
        const root = renderMarkdown(["A | B", "--- | ---", "one | two", "three | four"].map(row).join("\r\n"));

        expect(cells(root, "th")).toEqual(["A", "B"]);
        expect(cells(root, "td")).toEqual(["one", "two", "three", "four"]);
      });

      it("renders alignment and safe inline formatting when cells contain Markdown", () => {
        const root = renderMarkdown("Left | Center | Right | Default\n:--- | :---: | ---: | ---\n**bold** | *em* | `code` | [site](https://example.com)");

        for (const tag of ["th", "td"]) {
          expect(Array.from(root.querySelectorAll(tag), (cell) => cell.style.textAlign)).toEqual(["left", "center", "right", ""]);
        }
        expect(root.querySelector("td > strong")?.textContent).toBe("bold");
        expect(root.querySelector("td > em")?.textContent).toBe("em");
        expect(root.querySelector("td > code")?.textContent).toBe("code");
        expect(root.querySelector("td > a")?.getAttribute("href")).toBe("https://example.com");
        expect(root.querySelector("td > a")?.getAttribute("rel")).toBe("noopener noreferrer");
      });

      it("keeps escaped pipes and matching code spans within their cells", () => {
        const root = renderMarkdown([
          "| A\\|B | `C|D` | E |",
          "| --- | --- | --- |",
          "| x\\|y | `a|b` | ``a`|b`` |",
          "| \\| | tail\\| | ``x|y`` |",
        ].join("\n"));

        expect(cells(root, "th")).toEqual(["A|B", "C|D", "E"]);
        expect(cells(root, "td")).toEqual(["x|y", "a|b", "a`|b", "|", "tail|", "x|y"]);
        expect(cells(root, "td > code")).toEqual(["a|b", "a`|b", "x|y"]);
      });

      it("does not hide separators after escaped backslashes or unmatched backticks", () => {
        const root = renderMarkdown("A | B\n--- | ---\nslash\\\\| right\n`unclosed | end");

        expect(cells(root, "td")).toEqual(["slash\\\\", "right", "`unclosed", "end"]);
      });

      it.each([
        "A | B\n--- | --\none | two",
        "A | B\n--- | --- | ---\none | two",
        "A | B\n--- | :--x\none | two",
        "A | B\n--- | \none | two",
        "ordinary | prose\nmore | words",
        "`A|B`\n---\ntext",
        "A\\|B\n---\ntext",
      ])("leaves malformed or non-table input as paragraphs: %s", (text) => {
        const root = renderMarkdown(text);

        expect(root.querySelector("table")).toBeNull();
        expect(root.querySelector("p")).not.toBeNull();
      });

      it("ends a table before a row with a different number of cells", () => {
        const root = renderMarkdown("A | B\n--- | ---\none | two\nextra | cells | here\nplain tail");

        expect(cells(root, "td")).toEqual(["one", "two"]);
        expect(root.querySelector("p")?.textContent).toBe("extra | cells | hereplain tail");
      });

      it("retains empty cells and supports a header-only or single-column table", () => {
        const root = renderMarkdown("| A | B |\n| --- | --- |\n| | |\n\n| Only |\n| --- |\n");

        expect(root.querySelectorAll("table")).toHaveLength(2);
        expect(cells(root, "td")).toEqual(["", ""]);
        expect(cells(root, "th")).toEqual(["A", "B", "Only"]);
      });

      it("keeps HTML and script URLs inert when they occur in headers and cells", () => {
        const root = renderMarkdown([
          '| <img src=x onerror="alert(1)"> | <script>alert(1)</script> |',
          "| --- | --- |",
          '| <svg onload="alert(1)"> | [bad](javascript:alert(1)) |',
          '| [bad](data:text/html,<script>alert(1)</script>) | [bad](JaVaScRiPt:alert(1)) |',
          '| `<script>alert(1)</script>` | [safe](https://example.com/"onclick="alert(1)) |',
        ].join("\n"));

        expect(root.querySelectorAll("td")).toHaveLength(6);
        expect(root.querySelector("script, img, svg, [onload], [onerror], [onclick]")).toBeNull();
        expect(root.querySelectorAll("a")).toHaveLength(1);
        expect(root.querySelector("a")?.getAttribute("href")).toBe('https://example.com/"onclick="alert(1)');
        expect(root.querySelector("th")?.textContent).toBe('<img src=x onerror="alert(1)">');
        expect(root.querySelector("td > code")?.textContent).toBe("<script>alert(1)</script>");
        expect(cells(root, "td").slice(1, 4)).toEqual(["bad", "bad", "bad"]);
      });

      it("preserves adjacent paragraphs, headings, lists, quotes and fenced pipe syntax", () => {
        const root = renderMarkdown([
          "intro", "A | B", "--- | ---", "one | two", "# heading",
          "- list | prose", "1. ordered | prose", "> quote | prose", "tail",
          "```", "A | B", "--- | ---", "one | two", "```",
        ].join("\n"));

        expect(Array.from(root.children, (node) => node.tagName)).toEqual(["P", "TABLE", "H1", "UL", "OL", "BLOCKQUOTE", "P", "PRE"]);
        expect(cells(root, "td")).toEqual(["one", "two"]);
        expect(cells(root, "li")).toEqual(["list | prose", "ordered | prose"]);
        expect(root.querySelector("pre > code")?.textContent).toBe("A | B\n--- | ---\none | two");
      });
    });
    describe("assistant table rendering integration", () => {
      it.each(["stream-finalization", "history-restoration"])("renders a table through %s without replacing the answer renderer", (path) => {
        store.replace(createBlankProject());
        const log = document.createElement("div");
        log.className = "ai-chat-log";
        const host = createConversationLogHost({ log, removeStartScreen: () => undefined });

        if (path === "stream-finalization") {
          const body = host.appendBubble("assistant", "");
          for (const chunk of [wideAnswer.slice(0, 53), wideAnswer.slice(53)]) {
            body.textContent = (body.textContent ?? "") + chunk;
          }
          renderStreamedMarkdown(body);
        } else {
          host.renderConversationEntry({ kind: "assistant", text: wideAnswer });
        }

        expect(log.querySelectorAll(".ai-command-row-body .md table")).toHaveLength(1);
        expect(cells(log, "th")).toEqual(wideHeaders);
        expect(cells(log, "td")).toEqual(wideValues);
      });
    });
  });
  describe("projectSuggestions", () => {
    isolateTimers();
    function fixture() {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      map.events = [{ id: "door", name: "동쪽 문", x: 2, y: 3, trigger: "action", commands: [{ kind: "transfer", mapId: "missing", x: 0, y: 0 }] }];
      return { project, mapId, projectId: "project-a", active: true } satisfies SuggestionSnapshot;
    }
    const ids = (snapshot: SuggestionSnapshot): string[] =>
      inspectProjectSuggestions(snapshot.project, snapshot.mapId).map((candidate) => candidate.id);
    const cardIds = (root: HTMLElement): (string | undefined)[] =>
      [...root.querySelectorAll("article")].map((card) => (card as HTMLElement).dataset.suggestionId);
    afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
    describe("grounded project suggestions", () => {
      it("reads without mutating and removes repaired candidates", () => {
        const s = fixture(); const before = JSON.stringify(s.project);
        const transfer = inspectProjectSuggestions(s.project, s.mapId).find(c => c.id.startsWith("transfer:"));
        expect(transfer?.title).toContain("이동");
        expect(JSON.stringify(s.project)).toBe(before);
        s.project.maps[s.mapId]!.events[0]!.commands = [];
        expect(ids(s).some(id => id.startsWith("transfer:"))).toBe(false);
      });
      it("does not recommend encounters in peaceful maps", () => {
        const s = fixture(); s.project.maps[s.mapId]!.events = [];
        s.project.maps[s.mapId]!.encounterRate = 0;
        expect(ids(s).includes("encounters")).toBe(false);
      });
      it("suggests an empty shop only when stock and service alternatives are absent", () => {
        const s = fixture();
        const event = s.project.maps[s.mapId]!.events[0]!;
        // Existing authored DB records are enough; this fixture only changes the event.
        expect(s.project.database.items.length).toBeGreaterThan(0);
        event.commands = [{ kind: "shop", itemIds: [] }];
        expect(ids(s).some(id => id.startsWith("shop:"))).toBe(true);
        event.commands = [{ kind: "shop", itemIds: [s.project.database.items[0]!.id] }];
        expect(ids(s).some(id => id.startsWith("shop:"))).toBe(false);
      });
      it("uses active page definitions, not stale root commands", () => {
        const s = fixture(); const event = s.project.maps[s.mapId]!.events[0]!;
        event.pages = [{ id: "p", trigger: "action", commands: [] }];
        expect(ids(s).some(id => id.startsWith("transfer:"))).toBe(false);
      });
      it("rejects ungrounded model output and duplicate selections", () => {
        const s = fixture(); const candidates = inspectProjectSuggestions(s.project, s.mapId);
        const id = candidates[0]!.id;
        expect(selectProjectSuggestions(JSON.stringify(["invented", id, id]), candidates)).toEqual([candidates[0]]);
        expect(selectProjectSuggestions("make a town", candidates)).toEqual([]);
      });
      it("scopes fingerprints to relevant facts", () => {
        const s = fixture();
        const transferOf = () => inspectProjectSuggestions(s.project, s.mapId).find(c => c.id.startsWith("transfer:"))!;
        const before = transferOf().fingerprint;
        s.project.maps[s.mapId]!.lowerTiles[0] = 123;
        expect(transferOf().fingerprint).toBe(before);
        s.project.maps[s.mapId]!.events[0]!.name = "서쪽 문";
        expect(transferOf().fingerprint).not.toBe(before);
      });
    });
    describe("authoring-journey rules (2026-09-20)", () => {
      it("offers to connect a map that no travel reaches", () => {
        // 실측 근거: 프로젝트 30개 중 12개가 이 상태였고 이전 판은 아무 말도 하지 않았다.
        const s = fixture();
        const map = s.project.maps[s.mapId]!;
        // 이동이 없는 이벤트만 있는 맵 — 나가는 transfer 도 연결도 없다.
        map.events = [{ id: "npc", name: "마을 사람", x: 1, y: 1, trigger: "action", commands: [{ kind: "text", lines: ["안녕"] }] }];
        expect(ids(s)).toContain("no-exit");
        // 문이 생기면 침묵한다 — 이미 연결된 맵에 같은 제안을 반복하면 소음이다.
        // store 는 편집마다 새 Project 객체를 만든다(구조적 공유). 링크 인덱스가 프로젝트
        // identity 로 캐시되므로, 그 계약대로 새 객체를 넘겨야 캐시가 무효화된다.
        const linked = fixture();
        const linkedMap = linked.project.maps[linked.mapId]!;
        linkedMap.events = [{ id: "out", name: "출구", x: 1, y: 1, trigger: "action", commands: [{ kind: "transfer", mapId: "other", x: 0, y: 0 }] }];
        const other = createBlankProject().maps[createBlankProject().startMapId]!;
        other.id = "other";
        linked.project.maps["other"] = other;
        expect(ids(linked)).not.toContain("no-exit");
      });
      it("reports an empty map and an inert event without inventing defects", () => {
        const s = fixture();
        s.project.maps[s.mapId]!.events = [];
        expect(ids(s)).toContain("no-events");
        s.project.maps[s.mapId]!.events = [{ id: "idle", name: "사람", x: 1, y: 1, trigger: "action", commands: [] }];
        expect(ids(s)).toContain("empty-events");
      });
      it("flags a door that lands the player on an impassable tile", () => {
        // TILE.WALL/GRASS 는 옛 combined_town 칸 번호다 — 기본 칩셋이 beodeul_city 로 바뀐 뒤(PR #2335) 그 칩셋을 직접 깐다.
        const s = fixture();
        startOnRetiredCombinedTown(s.project);
        const map = s.project.maps[s.mapId]!;
        map.lowerTiles.fill(TILE.WALL);
        // 다른 맵에서 이 맵으로 들어오는 문을 만든다 — 착지가 벽이면 나올 수 없다.
        const source = createBlankProject().maps[createBlankProject().startMapId]!;
        source.id = "hall";
        source.events = [{ id: "into", name: "안쪽 문", x: 1, y: 1, trigger: "action", commands: [{ kind: "transfer", mapId: map.id, x: 3, y: 3 }] }];
        s.project.maps["hall"] = source;
        const landing = inspectProjectSuggestions(s.project, s.mapId).find(c => c.id === "landing-impassable");
        expect(landing).toBeTruthy();
        expect(landing!.x).toBe(3);
        expect(landing!.y).toBe(3);
        // 통행 가능한 칸으로 옮기면 사라진다.
        map.lowerTiles.fill(TILE.GRASS);
        expect(ids(s)).not.toContain("landing-impassable");
      });
      it("stays silent about DB records once anything references them", () => {
        const s = fixture();
        expect(ids(s)).toContain("items-unused");
        expect(ids(s)).toContain("troops-unused");
        // 물건 하나를 상점에, 적 그룹 하나를 맵 조우에 연결하면 그 축은 침묵한다.
        const map = s.project.maps[s.mapId]!;
        map.events[0]!.commands = [{ kind: "shop", itemIds: [s.project.database.items[0]!.id] }];
        map.troopIds = [s.project.database.troops[0]!.id];
        expect(ids(s)).not.toContain("items-unused");
        expect(ids(s)).not.toContain("troops-unused");
      });
    });
    describe("background suggestion lifecycle", () => {
      function setup(analyze = vi.fn(async (_s: SuggestionSnapshot, c: ReturnType<typeof inspectProjectSuggestions>) => JSON.stringify(c.map(v => v.id)))) {
        vi.useFakeTimers();
        let snapshot = fixture();
        const request = vi.fn(), locate = vi.fn();
        const ui = createProjectSuggestions({ snapshot: () => snapshot, request, locate, analyze, intervalMs: 10, cooldownMs: 100 });
        document.body.append(ui.root);
        return { ui, analyze, request, locate, get: () => snapshot, set: (s: SuggestionSnapshot) => { snapshot = s; } };
      }
      const rendered = (t: ReturnType<typeof setup>): number =>
        Math.min(3, inspectProjectSuggestions(t.get().project, t.get().mapId).length);

      it("renders at most once for unchanged state and only requests work after click", async () => {
        const t = setup(); await vi.advanceTimersByTimeAsync(20);
        expect(t.ui.root.querySelectorAll("article")).toHaveLength(rendered(t));
        expect(t.request).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500);
        expect(t.analyze).toHaveBeenCalledTimes(1);
        [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "AI와 이어가기")!.click();
        expect(t.request).toHaveBeenCalledTimes(1); t.ui.dispose();
      });
      it("dismisses until related facts change, isolated by project", async () => {
        const t = setup(); await vi.advanceTimersByTimeAsync(20);
        const dismissed = cardIds(t.ui.root)[0]!;
        expect(dismissed).toBeTruthy();
        [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "넘기기")!.click();
        expect(cardIds(t.ui.root)).not.toContain(dismissed);
        // 무관한 편집(타일)은 그 카드의 근거를 바꾸지 않는다 — 다시 뜨면 「넘기기」가 거짓말이 된다.
        t.get().project.maps[t.get().mapId]!.lowerTiles[0] = 333;
        await vi.advanceTimersByTimeAsync(120);
        expect(cardIds(t.ui.root)).not.toContain(dismissed);
        t.set({ ...t.get(), projectId: "other-project" });
        await vi.advanceTimersByTimeAsync(20);
        expect(cardIds(t.ui.root)).toContain(dismissed); t.ui.dispose();
      });
      it("keeps map-wide findings unlocatable and point findings locatable", async () => {
        // 「위치 보기」가 (0,0) 으로 카메라를 옮기면 「가리켰다」는 거짓말이 된다 —
        // 좌표가 없는 제안(맵 전체)에는 버튼 자체가 없어야 한다.
        const t = setup(); await vi.advanceTimersByTimeAsync(20);
        const byId = (id: string) => [...t.ui.root.querySelectorAll("article")].find(c => (c as HTMLElement).dataset.suggestionId === id);
        const wide = byId("no-exit") ?? byId("items-unused");
        expect(wide).toBeTruthy();
        expect([...(wide!.querySelectorAll("button"))].map(b => b.textContent)).not.toContain("위치 보기");
        const transfer = byId("transfer:door.0");
        expect(transfer).toBeTruthy();
        expect([...(transfer!.querySelectorAll("button"))].map(b => b.textContent)).toContain("위치 보기");
        t.ui.dispose();
      });
      it("ignores delayed results after project switches and aborts on disposal", async () => {
        let resolve!: (v: string) => void; let signal: AbortSignal | undefined;
        const analyze = vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>, abort?: AbortSignal) => { signal = abort; return new Promise<string>(r => { resolve = r; }); });
        const t = setup(analyze); await vi.advanceTimersByTimeAsync(20);
        const candidateIds = inspectProjectSuggestions(t.get().project, t.get().mapId).map(c => c.id);
        t.set({ ...t.get(), projectId: "new-project" });
        await vi.advanceTimersByTimeAsync(20);
        expect(signal?.aborted).toBe(true);
        // 늦게 도착한 이전 프로젝트의 답은 **적용되지 않는다.** 로컬 탐지 결과는 즉시 깔리므로
        // (2026-09-20 쿨다운 수정) 카드 수로는 판정할 수 없다 — 대신 그 답이 고른 후보가
        // 새 프로젝트의 정본이 되었는지 본다. 새 프로젝트에는 없는 id 를 답으로 준다.
        resolve(JSON.stringify(["transfer:stale-from-old-project"])); await vi.advanceTimersByTimeAsync(10);
        expect(cardIds(t.ui.root)).not.toContain("transfer:stale-from-old-project");
        // 새 프로젝트는 자기 차례가 되면 다시 물어본다 — 끊긴 요청이 그 프로젝트의 답을 먹지 않는다.
        await vi.advanceTimersByTimeAsync(200);
        expect(analyze).toHaveBeenCalledTimes(2);
        t.ui.dispose(); await vi.advanceTimersByTimeAsync(500);
        expect(analyze).toHaveBeenCalledTimes(2);
      });
      it("does not call AI during conversation or when paused", async () => {
        const t = setup(); t.set({ ...t.get(), active: false });
        await vi.advanceTimersByTimeAsync(100); expect(t.analyze).not.toHaveBeenCalled();
        t.set({ ...t.get(), active: true });
        [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "잠시 멈추기")!.click();
        await vi.advanceTimersByTimeAsync(100); expect(t.analyze).not.toHaveBeenCalled(); t.ui.dispose();
      });
      it("reconsiders dismissed suggestions only after relevant edits and cooldown", async () => {
        const t = setup(); await vi.advanceTimersByTimeAsync(20);
        const target = cardIds(t.ui.root)[0]!;
        [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "넘기기")!.click();
        // 이벤트 이름은 이 카드의 근거 사실이다 — 바뀌면 같은 카드가 다시 검토된다.
        t.get().project.maps[t.get().mapId]!.events[0]!.name = "바뀐 출구";
        await vi.advanceTimersByTimeAsync(30);
        expect(t.analyze).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(100);
        expect(t.analyze).toHaveBeenCalledTimes(2);
        expect(cardIds(t.ui.root)).toContain(target);
        expect(t.ui.root.textContent).toContain("바뀐 출구"); t.ui.dispose();
      });
      it("retries after a reply arrives during a brief input pause", async () => {
        let resolve!: (value: string) => void;
        const analyze = vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>) =>
          new Promise<string>(r => { resolve = r; }));
        const t = setup(analyze); await vi.advanceTimersByTimeAsync(10);
        t.set({ ...t.get(), active: false });
        resolve("[]"); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        t.set({ ...t.get(), active: true });
        await vi.advanceTimersByTimeAsync(120);
        expect(analyze).toHaveBeenCalledTimes(2); t.ui.dispose();
      });
      it("aborts the active request when the panel is disposed", async () => {
        let signal: AbortSignal | undefined;
        const t = setup(vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>, abort?: AbortSignal) => {
          signal = abort; return new Promise<string>(() => {});
        }));
        await vi.advanceTimersByTimeAsync(20); t.ui.dispose();
        expect(signal?.aborted).toBe(true);
      });
      it("counts locally while the popover is closed, and only calls the model when open", async () => {
        // Break (2026-09-21 실측): 닫힌 동안 탐지까지 멈추면 배지가 빈 채로 남아, 느낌표를
        // 눌러 보기 전에는 「살펴볼 것이 있는지」를 알 수 없다 — 그 알림이 이 버튼의 존재 이유다.
        // 반대로 닫힌 채 원격 턴까지 돌리면 보이지 않는 표면을 위해 모델을 태운다.
        const t = setup(); t.set({ ...t.get(), active: false });
        await vi.advanceTimersByTimeAsync(50);
        expect(t.analyze).not.toHaveBeenCalled();
        // 닫혀 있어도 로컬 탐지·렌더·배지는 돈다.
        expect(t.ui.root.querySelectorAll("article").length).toBeGreaterThan(0);
        // 열면 같은 상태에서 모델을 한 번 부른다.
        t.set({ ...t.get(), active: true });
        await vi.advanceTimersByTimeAsync(50);
        expect(t.analyze).toHaveBeenCalledTimes(1);
        t.ui.dispose();
      });
      it("shows a truthful local fallback when the AI connection fails", async () => {
        const t = setup(vi.fn(async () => { throw Error("offline"); }));
        await vi.advanceTimersByTimeAsync(20);
        expect(t.ui.root.textContent).toContain("기본 확인 결과");
        expect(t.ui.root.querySelectorAll("article")).toHaveLength(rendered(t)); t.ui.dispose();
      });
      it("reuses local findings for an unchanged content version and rescans on a new one", async () => {
        const t = setup();
        t.set({ ...t.get(), version: "1:1" });
        await vi.advanceTimersByTimeAsync(20);
        const before = cardIds(t.ui.root);
        expect(before).toContain("transfer:door.0");
        // 같은 버전에서는 다시 훑지 않는다 — 제자리 변형은 버전 토큰 없이는 보이지 않는다.
        t.get().project.maps[t.get().mapId]!.events[0]!.commands = [];
        await vi.advanceTimersByTimeAsync(40);
        expect(cardIds(t.ui.root)).toEqual(before);
        // store 는 내용이 바뀔 때마다 버전을 올린다 — 그때는 고친 문이 카드에서 빠진다.
        t.set({ ...t.get(), version: "1:2" });
        await vi.advanceTimersByTimeAsync(20);
        expect(cardIds(t.ui.root)).not.toContain("transfer:door.0");
        t.ui.dispose();
      });
    });
  });
  // All catalog registrations must remain reachable through bounded pages/search.
  describe("resourceManagerMonsterCatalog", () => {
    isolateTimers();
    function renderMonsterTab(deleteLog: string[] = []): HTMLElement {
      const container = document.createElement("div");
      document.body.append(container);
      const project = store.getCurrent();
      renderResourceWorkbench(container, {
        categories: [{ kind: "monster", label: "몬스터" }],
        selectedKind: "monster",
        profiles: project.resourceProfiles,
        uploaded: Object.values(project.assets.uploaded),
        kindSelect: document.createElement("select"),
        fileInput: document.createElement("input"),
        actions: {
          addTileset: () => {},
          applyTileset: () => {},
          deleteAsset: (asset) => deleteLog.push(asset.id),
        },
        onSelectKind: () => {},
        onImport: () => {},
      });
      return container;
    }
    beforeEach(() => {
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
      store.replace(createBlankProject());
    });
    afterEach(() => {
      document.body.replaceChildren();
    });
    describe("resource manager monster tab", () => {
      it("makes the full monster resource catalog reachable through bounded pages", () => {
        const project = store.getCurrent();
        const container = renderMonsterTab();
        // 소재 관리는 에메랄드 v4 종 그림까지 보인다(#5005: 기본 목록에서는 빠지고 emeraldV4 를 준 곳에만 나온다).
        const expected = listMonsterResources(project, { emeraldV4: true }).length;
        expect(expected).toBeGreaterThan(100);
        let encountered = 0;
        const next = container.querySelector<HTMLButtonElement>('[data-testid="resource-page-next"]')!;
        do {
          const count = container.querySelectorAll(".rm-asset-card").length;
          expect(count).toBeLessThanOrEqual(80);
          encountered += count;
          if (next.disabled) break;
          next.click();
        } while (true);
        expect(encountered).toBe(expected);
        const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = "scarloxy"; search.dispatchEvent(new Event("input"));
        expect(container.querySelectorAll(".rm-asset-card").length).toBeGreaterThan(0);

      });

      it("shows the catalog total in the category badge", () => {
        const container = renderMonsterTab();
        const badge = container.querySelector('[data-testid="resource-category-list"] .rm-category-badge');
        expect(badge?.textContent).toBe(String(listMonsterResources(store.getCurrent(), { emeraldV4: true }).length));
      });

      it("shows effective catalog metadata in the inspector for the selected resource", () => {
        const container = renderMonsterTab();
        // 첫 카탈로그 항목(generated-enemy-slime-01)이 자동 선택된다 — 원시 id 가 아니라
        // 카탈로그 이름·태그·검토 상태·설명이 인스펙터에 표시돼야 한다.
        const inspector = container.querySelector(".rm-preview-well");
        // 카탈로그 이름은 공개 기준선(0d4f13e7c8)부터 「푸른 슬라임」이다(monsterCatalogData.json).
        expect(inspector?.textContent).toContain("푸른 슬라임");
        expect(inspector?.textContent).toContain("generated-enemy-slime-01");
        expect(inspector?.textContent).toContain("검토됨");
        expect(inspector?.textContent).toContain("슬라임");
      });

      it("lists an uploaded monster once and keeps it deletable", () => {
        const deleteLog: string[] = [];
        const asset: UploadedAsset = {
          id: "monster_img_test",
          name: "직접 올린 몬스터",
          kind: "monster",
          dataUrl: "data:image/png;base64,AAAA",
          meta: { width: 64, height: 64 },
        } as UploadedAsset;
        store.update((project) => { project.assets.uploaded[asset.id] = asset; }, { scope: "assets", label: "test" });

        const container = renderMonsterTab(deleteLog);
        const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = asset.id; search.dispatchEvent(new Event("input"));
        const cards = [...container.querySelectorAll(".rm-asset-card")];
        expect(cards).toHaveLength(1);
        expect(cards.filter((card) => card.textContent?.includes("직접 올린 몬스터"))).toHaveLength(1);

        (cards.find((card) => card.textContent?.includes("직접 올린 몬스터")) as HTMLElement).click();
        const deleteButton = container.querySelector<HTMLButtonElement>(".rm-inspector-actions .btn.danger");
        expect(deleteButton).not.toBeNull();
        deleteButton!.click();
        expect(deleteLog).toEqual(["monster_img_test"]);
      });
    });
  });
});

describe("editorPanelsSuite9", () => {
  isolateTimers();
  describe("sidebarFocusR1", () => {
    isolateTimers();
    describe('sidebar R1 real renderer ownership', () => {
      let host: HTMLElement;
      let dock: HTMLElement;
      let offState: () => void;
      const get = (id: string): HTMLElement => {
        const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        if (!node) throw new Error(`Missing control ${id}`);
        return node;
      };
      const escape = () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      beforeEach(() => {
        vi.useFakeTimers();
        resetTileToolbarMenusForTests();
        resetMapListUiStateForTests();
        resetMapPanelSectionForTests();
        store.replace(createBlankProject());
        editorState.set({ currentMapId: store.getCurrent().startMapId, layer: 'lower', tool: 'paint', paintShape: 'pen', selectedTile: 0, activePaletteStamp: null });
        host = document.createElement('div'); host.dataset.testid = 'left-palette-root';
        dock = document.createElement('div'); dock.dataset.testid = 'left-map-root';
        document.body.append(host);
        offState = editorState.subscribe(() => renderTilePalette(host));
        renderTilePalette(host);
      });
      afterEach(() => {
        offState(); closeMapContextMenu(); resetTileToolbarMenusForTests();
        host.remove(); dock.remove(); vi.clearAllTimers(); vi.useRealTimers();
      });
      it('closes the open map surface on Escape and restores its trigger', () => {
        get('sidebar-map-switcher').click();
        expect(host.querySelector('[data-sidebar-surface]')).not.toBeNull();
        escape();
        expect(host.querySelector('[data-sidebar-surface]')).toBeNull();
        expect(document.activeElement).toBe(get('sidebar-map-switcher'));
      });
      it('routes one Escape to the actual map context menu and then restores the map row', () => {
        get('sidebar-map-switcher').click();
        const id = store.getCurrent().startMapId;
        get(`map-tree-node-${id}`).focus();
        get(`map-tree-node-${id}`).dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
        expect(get(`map-context-menu-${id}`).contains(document.activeElement)).toBe(true);
        escape();
        expect(document.querySelector(`[data-testid="map-context-menu-${id}"]`)).toBeNull();
        expect(host.querySelector('[data-testid="sidebar-map-surface"]')).not.toBeNull();
        expect(document.activeElement).toBe(get(`map-tree-node-${id}`));
        escape();
        expect(host.querySelector('[data-testid="sidebar-map-surface"]')).toBeNull();
      });
      it('keeps the map explorer attached while its body-mounted Rename action handles a pointer', () => {
        get('sidebar-map-switcher').click();
        const id = store.getCurrent().startMapId;
        get(`map-tree-node-${id}`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        const rename = get(`map-menu-rename-${id}`);
        rename.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
        rename.click();
        expect(host.querySelector(`[data-testid="map-rename-${id}"]`)).not.toBeNull();
        expect(document.activeElement).toBe(get(`map-rename-${id}`));
      });
      it('reveals the real map dock through its renderer rather than only changing collapse state', () => {
        document.body.append(dock);
        // 맵 도크가 붙은 뒤 다시 그려야 스위처가 도크 모드(목록에서 보기)로 바뀐다.
        renderTilePalette(host);
        renderMapList(dock);
        // 맵이 하나뿐이면 접기 단추가 없다(버튼 줄이기 2회차) — 접힌 채 저장된 상태에서 시작한다.
        setMapPanelCollapsed(true);
        renderMapList(dock);
        expect(get('map-tree-section-toggle').getAttribute('aria-expanded')).toBe('false');
        get('sidebar-map-switcher').click();
        // 펼치면 맵 하나짜리 제목은 글자로만 선다 — 접기 단추가 사라지고 펼친 목록이 남는다.
        expect(document.querySelector('[data-testid="map-tree-section-toggle"]')).toBeNull();
        expect(dock.querySelector('.map-tree-section-toggle.is-static')).not.toBeNull();
        expect(dock.querySelector('.is-section-collapsed')).toBeNull();
        expect(document.activeElement).toBe(get(`map-tree-node-${store.getCurrent().startMapId}`));
      });
      it('does not commit a cancelled Rename when removing its focused input emits blur', () => {
        get('sidebar-map-switcher').click();
        const id = store.getCurrent().startMapId;
        const original = store.getCurrent().maps[id]?.name;
        get(`map-tree-node-${id}`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        get(`map-menu-rename-${id}`).click();
        const input = get(`map-rename-${id}`);
        if (!(input instanceof HTMLInputElement)) throw new Error('Missing actual Rename input');
        input.value = 'Cancelled draft';
        escape();
        input.dispatchEvent(new FocusEvent('blur'));
        expect(store.getCurrent().maps[id]?.name).toBe(original);
      });
      it.each([
        ['inspector', false], ['ruleAudit', false], ['history', false],
        ['inspector', true], ['ruleAudit', true], ['history', true],
      ] as const)('activates the real dock registry for %s with pinned=%s', (inspection, pinned) => {
        host.remove();
        const root = document.createElement('div'); document.body.append(root);
        const initial = layoutFromPreset('map');
        resetWorkspaceForTests({ ...initial, docks: { ...initial.docks, left: ['maps'] } });
        localStorage.setItem(SIDEBAR_PINS_KEY, JSON.stringify(pinned ? [inspection] : []));
        resetInspectionPinsForTests();
        const renderDock = () => renderDockPanels(mountDock({ container: root, zone: 'left', panels: getWorkspaceLayout().docks.left }));
        const unsubscribe = subscribeWorkspace(renderDock);
        renderDock();
        const mapId = editorState.get().currentMapId;
        try {
          listEditorCommands().find(command => command.id === `sidebar-inspection-${inspection}`)?.run();
          expect(root.querySelector('[data-testid="left-palette-root"]')).not.toBeNull();
          const panelId = pinned ? { inspector: 'tile-inspector-dropdown', ruleAudit: 'tile-rule-audit-dropdown', history: 'tile-history-dropdown' }[inspection] : 'toolbar-overflow-dropdown';
          expect(get(panelId).contains(document.activeElement)).toBe(true);
          expect(editorState.get().currentMapId).toBe(mapId);
          expect(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY) ?? '[]')).toEqual(pinned ? [inspection] : []);
          escape();
          expect(root.querySelector(`[data-testid="${panelId}"]`)).toBeNull();
        } finally { unsubscribe(); root.remove(); resetWorkspaceForTests(); }
      });
    });
  });
  describe("spatialAssetBrowsers", () => {
    isolateTimers();
    const previous = store.getCurrent();
    beforeEach(() => {
      const fixture = structuredClone(spaceCompilerFixture());
      fixture.spatialAuthoring!.library.spaces[spaceDesign] = { ...fixture.spatialAuthoring!.library.spaces[spaceDesign], objectSlots: [] };
      store.replace(fixture, { preserveEventDrafts: false });
      bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
      resetSpacesAuthoringSession();
    });
    afterEach(() => {
      document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-cancel']")?.click();
      document.querySelector<HTMLButtonElement>("[data-testid='structure-kit-editor-close']")?.click();
      document.body.replaceChildren();
      bindSpatialAuthoringControllerFactory(null);
      store.replace(previous, { preserveEventDrafts: false });
    });
    it("combines tileset and name filters without leaking another tileset", () => {
      const cards = [
        { id: "a", name: "작은 침대", source: "own" as const, kind: "objects" as const, usage: 0, tilesetId: "inside" },
        { id: "b", name: "작은 침대", source: "own" as const, kind: "objects" as const, usage: 0, tilesetId: "outside" },
      ];
      expect(filterSpatialBrowserCards(cards, "작은 침대", "inside").map(card => card.id)).toEqual(["a"]);
      expect(filterSpatialBrowserCards(cards, "없는 이름", null)).toEqual([]);
    });
    it("tile browsing and cancel do not change the project or select a brush", () => {
      const before = store.getCurrent();
      const pick = vi.fn();
      openTilesetTileBrowser(before.tilesets[interiorAtlas], 0, pick);
      document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-tile-54']")!.click();
      expect(pick).not.toHaveBeenCalled();
      document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-cancel']")!.click();
      expect(pick).not.toHaveBeenCalled();
      expect(store.getCurrent()).toBe(before);
    });
    it("confirms the selected tile once and preserves search focus while filtering", () => {
      const pick = vi.fn();
      openTilesetTileBrowser(store.getCurrent().tilesets[interiorAtlas], 0, pick);
      const input = document.querySelector<HTMLInputElement>("[data-testid='tile-browser-search']")!;
      input.focus(); input.value = "54"; input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(document.activeElement).toBe(input);
      document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-tile-54']")!.click();
      document.querySelector<HTMLButtonElement>("[data-testid='tile-browser-use']")!.click();
      expect(pick).toHaveBeenCalledExactlyOnceWith(54);
      expect(document.querySelector("[data-testid='tileset-tile-browser']")).toBeNull();
    });
    it("places an object in a source space by selection and click, then preview/applies it", () => {
      const card = { id: `library-space/library/${spaceDesign}`, localId: spaceDesign, name: "Room", source: "own" as const, kind: "spaces" as const, usage: 0 };
      const canvas = renderSpatialSpacesCanvas(spatialSession(), card, () => {}, { objectBrowser: true });
      document.body.append(canvas);
      canvas.querySelector<HTMLButtonElement>("[data-testid='spatial-object-bed-design']")!.click();
      expect(spaceChromeState.selectedObjectId).toBe("bed-design");
      const board = canvas.querySelector<HTMLElement>("[data-testid='spatial-space-board']")!;
      board.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 4 * 24 + 10, clientY: 3 * 24 + 10 }));
      expect(store.getCurrent().spatialAuthoring!.library.spaces[spaceDesign].objectSlots).toHaveLength(0);
      const slots = visibleAuthoringProject().spatialAuthoring!.library.spaces[spaceDesign].objectSlots;
      expect(slots).toHaveLength(1);
      expect(slots[0].objectDesignId).toBe("bed-design");
      const refreshed = renderSpatialSpacesCanvas(spatialSession(), card, () => {}, { objectBrowser: true });
      expect(refreshed.querySelector(".spatial-space-slot-art canvas")).not.toBeNull();
      expect(slots[0].placement).toMatchObject({ mode: "fixed", x: 4, y: 3 });
      expect(previewAuthoringDraft().kind).toBe("ok");
      expect(applyAuthoringPreview().kind).toBe("ok");
      expect(store.getCurrent().spatialAuthoring!.library.spaces[spaceDesign].objectSlots).toHaveLength(1);
    });
    it("creates a new object in the tileset selected in the browser", () => {
      const project = structuredClone(store.getCurrent());
      project.tilesets["custom-atlas"] = { ...project.tilesets[interiorAtlas], id: "custom-atlas", name: "커스텀", structureKits: [] };
      store.replace(project, { preserveEventDrafts: false });
      const browser = renderSpatialAssetBrowser({ ...spatialSession(), tab: "objects", source: "all", mode: "design" }, undefined, () => {});
      document.body.append(browser);
      browser.querySelector<HTMLButtonElement>("[data-tileset-id='custom-atlas']")!.click();
      browser.querySelector<HTMLButtonElement>("[data-testid='spatial-add']")!.click();
      expect(Object.values(visibleAuthoringProject().spatialAuthoring!.library.objects).some(object => object.graphic.tilesetId === "custom-atlas")).toBe(true);
      expect(store.getCurrent().tilesets["custom-atlas"].structureKits).toHaveLength(0);
    });
  });
});
