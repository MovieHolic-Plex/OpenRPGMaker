import { expect, test, type Page } from "@playwright/test";

const TILESET_ID = "easyrpg_chipset_combined_town";
const TEMPLATE_TEST_IDS = [
  "tileset-knowledge-template-water-autotile-3x3",
  "tileset-knowledge-template-water-atlas-9x9",
  "tileset-knowledge-template-desk",
  "tileset-knowledge-template-tree",
  "tileset-knowledge-template-one-way-path",
  "tileset-knowledge-template-repeatable-cliff-2x3",
] as const;

async function openKnowledgeWorkspace(page: Page): Promise<void> {
  await page.goto("/?freshProject=1");
  const coachSkip = page.getByTestId("coach-mark-skip");
  if (await coachSkip.isVisible()) await coachSkip.click();
  await page.getByTestId("menu-tools").click();
  await page.getByTestId("menu-tools-database").click();
  await page.getByTestId("db-tab-tilesets").click();
  await page.getByTestId("tileset-section-tab-knowledge").click();
  await page.getByTestId("tileset-edit-mode-group").click();
  if (await coachSkip.isVisible()) await coachSkip.click();
  await expect(page.getByTestId("tileset-knowledge-inspector")).toBeVisible();
}

async function tilesPerRow(page: Page): Promise<number> {
  return page.getByTestId("project-export-json").evaluate((element, tilesetId) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    return parsed.project?.tilesets?.[tilesetId]?.tilesPerRow ?? 0;
  }, TILESET_ID);
}

async function dragTileRectangle(page: Page, start: number, end: number): Promise<void> {
  const from = await page.getByTestId(`tileset-db-cell-${start}`).boundingBox();
  const to = await page.getByTestId(`tileset-db-cell-${end}`).boundingBox();
  if (!from || !to) throw new Error("tileset cells are not visible");
  await page.mouse.move(from.x + (from.width / 2), from.y + (from.height / 2));
  await page.mouse.down();
  await page.mouse.move(to.x + (to.width / 2), to.y + (to.height / 2), { steps: 8 });
  await page.mouse.up();
}

test("authors, updates, and reselects executable tileset knowledge", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openKnowledgeWorkspace(page);
  await expect(page.getByTestId("tileset-ai-review-inbox")).toHaveCount(0);
  const columns = await tilesPerRow(page);

  await dragTileRectangle(page, 0, (columns * 2) + 1);
  await expect(page.getByTestId("tileset-knowledge-selection-summary")).toContainText("6칸 · 2×3");
  await page.getByTestId("tileset-knowledge-template-repeatable-cliff-2x3").click();
  await page.getByTestId("tileset-knowledge-name").fill("북쪽 반복 절벽");
  await page.getByTestId("tileset-group-save").click();

  await expect.poll(async () => page.getByTestId("project-export-json").evaluate((element, input) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    const groups = parsed.project?.tilesets?.[input.tilesetId]?.tileGroups ?? [];
    const group = groups.find((entry: { name?: string }) => entry.name === input.name);
    return group ? {
      id: group.id,
      kind: group.patternGrammar?.kind,
      blockWidth: group.patternGrammar?.blockWidth,
      blockHeight: group.patternGrammar?.blockHeight,
      tileCount: group.tileIds?.length,
    } : null;
  }, { tilesetId: TILESET_ID, name: "북쪽 반복 절벽" })).not.toBeNull();

  const exportedCliff = await page.getByTestId("project-export-json").evaluate((element) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    return parsed.project?.tilesets?.["easyrpg_chipset_combined_town"]?.tileGroups
      ?.find((entry: { name?: string }) => entry.name === "북쪽 반복 절벽");
  });
  expect(exportedCliff).toBeDefined();
  expect(exportedCliff.patternGrammar).toEqual(expect.objectContaining({
    kind: "repeatable_block",
    blockWidth: 2,
    blockHeight: 3,
  }));
  expect(exportedCliff.tileIds).toHaveLength(6);

  await page.getByTestId(`tileset-knowledge-group-${exportedCliff.id}`).click();
  await expect(page.getByTestId("tileset-knowledge-name")).toHaveValue("북쪽 반복 절벽");
  await page.getByTestId("tileset-knowledge-name").fill("북쪽 반복 절벽 수정");
  await page.getByTestId("tileset-group-save").click();
  await expect.poll(async () => page.getByTestId("project-export-json").evaluate((element, id) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    const groups = parsed.project?.tilesets?.["easyrpg_chipset_combined_town"]?.tileGroups ?? [];
    return groups.filter((entry: { id?: string }) => entry.id === id).map((entry: { name?: string }) => entry.name);
  }, exportedCliff.id)).toEqual(["북쪽 반복 절벽 수정"]);

  await page.getByRole("button", { name: "선택 비우기" }).click();
  await dragTileRectangle(page, 0, (columns * 2) + 2);
  await page.getByTestId("tileset-knowledge-template-one-way-path").click();
  await page.getByTestId("tileset-knowledge-name").fill("아래로만 가는 길");
  await page.getByTestId("tileset-knowledge-passage-up").click();
  await page.getByTestId("tileset-knowledge-passage-left").click();
  await page.getByTestId("tileset-knowledge-passage-right").click();
  await page.getByTestId("tileset-group-save").click();

  await expect.poll(async () => page.getByTestId("project-export-json").evaluate((element) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    const tileset = parsed.project?.tilesets?.["easyrpg_chipset_combined_town"];
    const group = tileset?.tileGroups?.find((entry: { name?: string }) => entry.name === "아래로만 가는 길");
    const autotile = tileset?.autotileGroups?.find((entry: { id?: string }) => entry.id === group?.id);
    return group ? {
      passage: tileset.passability?.[group.tileIds?.[0]],
      masks: Object.keys(autotile?.variantMap ?? {}).length,
      neighborhood: autotile?.neighborhood,
    } : null;
  })).toEqual({
    passage: { down: true, left: false, right: false, up: false },
    masks: 256,
    neighborhood: 8,
  });

  const inspector = page.getByTestId("tileset-knowledge-inspector");
  await inspector.evaluate((element) => { element.scrollTop = 0; });
  for (const testId of TEMPLATE_TEST_IDS) await expect(page.getByTestId(testId)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tileset-knowledge-authoring-1280x800.png"), fullPage: true });
  await page.getByTestId("tileset-knowledge-passage-down").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("tileset-knowledge-layer-grid")).toBeVisible();
  await expect(page.getByTestId("tileset-group-save")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tileset-knowledge-controls-1280x800.png"), fullPage: true });
  await expect(page.getByTestId("tileset-knowledge-layer-0")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("tileset-knowledge-layer-0").click();
  await expect(page.getByTestId("tileset-knowledge-layer-0")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("tileset-knowledge-layer-0").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("tileset-knowledge-layers-1280x800.png"), fullPage: true });
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(page.getByTestId("tileset-knowledge-inspector")).toBeVisible();
  await expect(page.getByTestId("tileset-knowledge-selection-summary")).toBeVisible();
  await page.getByTestId("tileset-knowledge-inspector").evaluate((element) => {
    element.scrollTop = 0;
    const editArea = element.closest(".knowledge-mode");
    if (editArea instanceof HTMLElement) editArea.scrollTop = 0;
    element.scrollIntoView({ block: "start", inline: "nearest" });
  });
  for (const testId of TEMPLATE_TEST_IDS) await expect(page.getByTestId(testId)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("tileset-knowledge-authoring-900x800.png"), fullPage: true });
});
