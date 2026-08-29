import { expect, test, type Page } from "@playwright/test";

test.setTimeout(240_000);

async function gotoEditor(page: Page, query: string): Promise<void> {
  await page.goto(`/?freshProject=1&${query}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await expect(page.getByTestId("toolbar-search")).toBeVisible({ timeout: 30_000 });
}

async function openSearch(page: Page) {
  await page.getByTestId("toolbar-search").click();
  const dialog = page.getByTestId("map-event-search-modal");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("맵·이벤트 찾기는 단일 입력, 범위 세그먼트, 종류별 결과를 제공한다", async ({ page }, testInfo) => {
  await gotoEditor(page, "mapEventSearchDialog=1");
  const dialog = await openSearch(page);

  await expect(dialog.getByRole("dialog")).toHaveAttribute("aria-label", "맵·이벤트 찾기");
  await expect(dialog.getByRole("heading", { name: "맵·이벤트 찾기" })).toBeVisible();
  await expect(dialog.getByTestId("map-event-search-input")).toBeFocused();
  await expect(dialog.getByTestId("map-event-search-scope-selectedMap")).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByTestId("map-event-search-scope-all")).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.getByTestId("map-event-search-results")).toContainText("맵 이름, 이벤트 이름, 공통 이벤트, 스위치와 변수를 찾아보세요.");

  const currentMapName = await page.evaluate(() => {
    const project = (window as unknown as { __oprnEditorStore: { getCurrent(): any } }).__oprnEditorStore.getCurrent();
    return project.maps[project.startMapId].name;
  });
  await dialog.getByTestId("map-event-search-scope-all").click();
  await dialog.getByTestId("map-event-search-input").fill(currentMapName);
  const mapGroup = dialog.getByTestId("map-event-search-group-map");
  await expect(mapGroup).toBeVisible();
  await expect(mapGroup).toContainText("1");
  await expect(dialog.getByTestId("map-event-search-result-0")).toHaveRole("button");
  await expect(dialog.getByTestId("map-event-search-result-0")).toContainText("맵");

  await page.screenshot({ path: testInfo.outputPath("map-event-search-dialog.png"), fullPage: true });
});

test("빈 결과 안내와 키보드 포커스 이동이 안정적이다", async ({ page }, testInfo) => {
  await gotoEditor(page, "mapEventSearchEmpty=1");
  const dialog = await openSearch(page);
  const input = dialog.getByTestId("map-event-search-input");
  const results = dialog.getByTestId("map-event-search-results");

  await input.fill("존재하지 않는 항목");
  await expect(results).toContainText("일치하는 항목이 없습니다.");
  await expect(dialog.locator(".map-event-search-result-row")).toHaveCount(0);

  const currentMapName = await page.evaluate(() => {
    const project = (window as unknown as { __oprnEditorStore: { getCurrent(): any } }).__oprnEditorStore.getCurrent();
    return project.maps[project.startMapId].name;
  });
  await dialog.getByTestId("map-event-search-scope-all").click();
  await input.fill(currentMapName);
  await expect(dialog.getByTestId("map-event-search-result-0")).toBeVisible();
  await input.press("ArrowDown");
  await expect(dialog.getByTestId("map-event-search-result-0")).toHaveClass(/is-active/);
  await input.press("ArrowUp");
  await expect(dialog.getByTestId("map-event-search-result-0")).toHaveClass(/is-active/);

  await page.screenshot({ path: testInfo.outputPath("map-event-search-empty.png"), fullPage: true });
});

test("전체 범위에서 맵 이름 결과를 누르면 모달이 닫히고 해당 맵으로 이동한다", async ({ page }) => {
  await gotoEditor(page, "mapEventSearchNavigation=1");
  const target = await page.evaluate(async () => {
    const store = (window as unknown as {
      __oprnEditorStore: {
        getCurrent(): { startMapId: string };
        update(mutator: (project: any) => void): void;
      };
    }).__oprnEditorStore;
    const project = store.getCurrent();
    const { editorState } = await import("/src/editor/editorState.ts");
    editorState.set({ currentMapId: project.startMapId });
    const mapId = "map_search_destination";
    store.update((draft) => {
      const source = draft.maps[draft.startMapId];
      draft.maps[mapId] = {
        ...structuredClone(source),
        id: mapId,
        name: "달빛 도서관",
        events: [],
      };
      draft.mapTree.children.push({ mapId, children: [] });
    });
    return { beforeMapId: editorState.get().currentMapId, targetMapId: mapId };
  });

  expect(target.beforeMapId).not.toBe(target.targetMapId);
  const dialog = await openSearch(page);
  await dialog.getByTestId("map-event-search-scope-all").click();
  await dialog.getByTestId("map-event-search-input").fill("달빛 도서관");
  await dialog.getByTestId("map-event-search-result-0").click();

  await expect(dialog).toHaveCount(0);
  const currentMapId = await page.evaluate(async () => {
    const { editorState } = await import("/src/editor/editorState.ts");
    return editorState.get().currentMapId;
  });
  expect(currentMapId).toBe(target.targetMapId);
});

test("이벤트 결과를 Enter로 실행하면 해당 맵을 선택하고 이벤트 편집기를 연다", async ({ page }) => {
  await gotoEditor(page, "mapEventSearchEventNavigation=1");
  const target = await page.evaluate(() => {
    const store = (window as unknown as {
      __oprnEditorStore: { update(mutator: (project: any) => void): void };
    }).__oprnEditorStore;
    const mapId = "map_search_event";
    const eventId = "ev_search_keeper";
    store.update((draft) => {
      const source = draft.maps[draft.startMapId];
      draft.maps[mapId] = {
        ...structuredClone(source),
        id: mapId,
        name: "별빛 정원",
        events: [{
          id: eventId,
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          pages: [{
            id: "page_search_keeper",
            name: "별빛 문지기",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          }],
        }],
      };
      draft.mapTree.children.push({ mapId, children: [] });
    });
    return { mapId, eventId };
  });

  const dialog = await openSearch(page);
  await dialog.getByTestId("map-event-search-scope-all").click();
  const input = dialog.getByTestId("map-event-search-input");
  await input.fill("별빛 문지기");
  await expect(dialog.getByTestId("map-event-search-result-0")).toContainText("별빛 문지기");
  await input.press("Enter");

  await expect(dialog).toHaveCount(0);
  const eventEditor = page.getByTestId("event-editor-modal");
  await expect(eventEditor).toBeVisible();
  await expect(eventEditor).toHaveAttribute("data-map-id", target.mapId);
  await expect(eventEditor).toHaveAttribute("data-event-id", target.eventId);
});
