/**
 * 개념 꾸러미 시설 다양화 — 실제 에디터 증거(진단 스펙, 모델 호출 없음).
 *
 * 1) 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에 시설 띠(아홉 초안)가 그려지고, 시설 칩을 누르면 그 시설의 장소·벽·바닥 재질이 보인다.
 * 2) 에디터 툴 훅(`__oprnEditorTool`)으로 place_concept 을 시설마다 실행해 새 맵이 생기고 캔버스(WebGL)에 그려진다.
 *
 * 실행(이 워크트리의 dev 서버 포트로):
 *   DEV_SERVER_PORT=9877 E2E_RETRIES=0 npx playwright test test/e2e/_concept-facility-gallery.spec.ts --project=chromium --workers=1
 * 사진은 SHOT_DIR(기본 /tmp/concept-facility-shots)에 쓴다 — 감시 중인 dev 서버가 reports/ 쓰기에 리로드하는 함정을 피한다.
 * 끝나면 reports/concept-facilities/e2e/ 로 옮긴다.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "./oprn-database-helpers";

const OUT_DIR = path.resolve(process.env.SHOT_DIR ?? "/tmp/concept-facility-shots");
mkdirSync(OUT_DIR, { recursive: true });

const INTERIOR_TILESET_ID = "easyrpg_chipset_interior";
const TEMPLATE_IDS = ["inn", "house", "shop", "tavern", "library", "smithy", "church", "warehouse", "guild"] as const;
const BUILD: readonly { id: string; query: string }[] = [
  { id: "smithy", query: "대장간" },
  { id: "tavern", query: "술집" },
  { id: "guild", query: "길드" },
  { id: "church", query: "교회" },
];

type ToolResult = { ok: boolean; summary: string; data?: { rooms?: unknown[]; wallMaterial?: string }; diff?: { warnings?: string[] } };
type ProjectView = { maps: Record<string, { name: string; tilesetId: string; width: number; height: number; events: { id: string }[] }> };

async function bootEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.setViewportSize({ width: 1440, height: 980 });
  page.on("dialog", (dialog) => { void dialog.accept(); });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  const start = page.getByTestId("standard-welcome-start");
  if (await start.isVisible().catch(() => false)) await start.click();
}

function readProject(page: Page): Promise<ProjectView> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: unknown } } }).__oprnProjectE2E;
    if (!hook) throw new Error("window.__oprnProjectE2E 미등록");
    const project = hook.currentProject().project as ProjectView;
    const maps: ProjectView["maps"] = {};
    for (const [id, map] of Object.entries(project.maps)) {
      maps[id] = { name: map.name, tilesetId: map.tilesetId, width: map.width, height: map.height, events: (map.events ?? []).map((event) => ({ id: event.id })) };
    }
    return { maps };
  });
}

function runEditorTool(page: Page, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return page.evaluate(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
    const run = (window as unknown as { __oprnEditorTool?: (n: string, a: Record<string, unknown>) => unknown }).__oprnEditorTool;
    if (!run) throw new Error("window.__oprnEditorTool 미등록");
    const result = run(toolName, toolArgs) as ToolResult;
    return { ok: result.ok, summary: result.summary, data: result.data ? { rooms: result.data.rooms, wallMaterial: result.data.wallMaterial } : undefined, diff: result.diff ? { warnings: result.diff.warnings } : undefined };
  }, { toolName: name, toolArgs: args });
}

async function openDatabaseAnyMode(page: Page): Promise<void> {
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await openDatabase(page);
    return;
  }
  await page.getByTestId("menu-tools").click();
  await page.getByTestId("menu-tools-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible({ timeout: 15_000 });
}

async function openConceptTab(page: Page): Promise<void> {
  await openDatabaseAnyMode(page);
  const tab = page.getByTestId("db-tab-scratch-concepts");
  if (!(await tab.isVisible().catch(() => false))) {
    const group = page.getByTestId("db-tab-group-world");
    if (await group.count()) await group.click();
  }
  await tab.click({ force: true });
  await page.getByTestId("scratch-concept-tileset-select").selectOption(INTERIOR_TILESET_ID);
  await expect(page.getByTestId("scratch-concept-board")).toBeVisible();
}

async function closeDatabase(page: Page): Promise<void> {
  await page.getByTestId("database-modal-close").click();
  const save = page.getByTestId("database-dirty-save");
  if (await save.isVisible({ timeout: 1_500 }).catch(() => false)) await save.click();
  await expect(page.getByTestId("database-modal")).toBeHidden({ timeout: 15_000 });
}

async function selectMapInTree(page: Page, mapId: string): Promise<void> {
  const node = page.getByTestId(`map-tree-node-${mapId}`);
  await expect(node).toBeVisible({ timeout: 15_000 });
  await node.click({ force: true });
  await page.waitForTimeout(1800);
}

async function canvasShot(page: Page, file: string): Promise<void> {
  await page.evaluate(() => {
    for (const node of document.querySelectorAll<HTMLElement>(".ai-chat-panel, [data-testid='chat-float-host']")) node.style.visibility = "hidden";
  });
  await page.waitForTimeout(300);
  await page.getByTestId("edit-canvas").screenshot({ path: file, animations: "disabled" });
  await page.evaluate(() => {
    for (const node of document.querySelectorAll<HTMLElement>(".ai-chat-panel, [data-testid='chat-float-host']")) node.style.visibility = "";
  });
}

test.describe("개념 꾸러미 시설 다양화 — 에디터 증거", () => {
  test.describe.configure({ timeout: 300_000 });

  test("시설 띠 아홉 종이 보이고, 시설마다 place_concept 이 다른 실내를 캔버스에 그린다", async ({ page }) => {
    const receipt: Record<string, unknown> = { startedAt: new Date().toISOString() };
    await bootEditor(page);

    // 1) 데이터베이스 — 시설 띠.
    await openConceptTab(page);
    for (const id of TEMPLATE_IDS) await expect(page.getByTestId(`scratch-concept-facility-${id}`)).toBeVisible();
    await expect(page.getByTestId("scratch-concept-template-select")).toHaveCount(0);
    await page.getByTestId("database-modal").screenshot({ path: path.join(OUT_DIR, "01-db-facility-strip.png"), animations: "disabled" });

    await page.getByTestId("scratch-concept-facility-smithy").click();
    await expect(page.getByTestId("scratch-concept-place-workshop")).toBeVisible();
    await expect(page.getByTestId("scratch-concept-facility-wall")).toHaveValue("stone-brick");
    await expect(page.getByTestId("scratch-concept-place-floor-workshop")).toHaveValue("stone");
    await page.getByTestId("database-modal").screenshot({ path: path.join(OUT_DIR, "02-db-smithy.png"), animations: "disabled" });

    await page.getByTestId("scratch-concept-facility-warehouse").click();
    await expect(page.getByTestId("scratch-concept-place-hall")).toBeVisible();
    await page.getByTestId("database-modal").screenshot({ path: path.join(OUT_DIR, "03-db-warehouse.png"), animations: "disabled" });

    // 시설 삭제 → 초안 넣기 셀렉트가 나타난다 → 되돌린다.
    await page.getByTestId("scratch-concept-facility-remove").click();
    await expect(page.getByTestId("scratch-concept-facility-warehouse")).toHaveCount(0);
    await expect(page.getByTestId("scratch-concept-template-select")).toBeVisible();
    await page.getByTestId("database-modal").screenshot({ path: path.join(OUT_DIR, "04-db-after-remove.png"), animations: "disabled" });
    await page.getByTestId("scratch-concept-template-select").selectOption("warehouse");
    await expect(page.getByTestId("scratch-concept-facility-warehouse")).toBeVisible();
    await closeDatabase(page);

    // 2) 시설마다 place_concept — 에디터 툴 훅(store 반영 + undo 스냅샷).
    const before = await readProject(page);
    const built: Record<string, unknown>[] = [];
    for (const entry of BUILD) {
      const mapId = `map_e2e_${entry.id}`;
      // 초안(템플릿) 갤러리 검사 — 설계 경로가 아니라 템플릿 자체를 본다(2026-09-11: place_concept 은 설계를 요구한다).
      const result = await runEditorTool(page, "place_concept", { query: entry.query, mapId, seed: 7, template: true });
      expect(result.ok, `${entry.query}: ${result.summary}`).toBe(true);
      const unplaced = (result.diff?.warnings ?? []).filter((line) => line.includes("자리 없음"));
      expect(unplaced, `${entry.query} 자리 없음: ${unplaced.join(" / ")}`).toEqual([]);
      const project = await readProject(page);
      const map = project.maps[mapId];
      expect(map, `${entry.query}: 맵 ${mapId} 없음`).toBeDefined();
      expect(map!.tilesetId).toBe(INTERIOR_TILESET_ID);
      await selectMapInTree(page, mapId);
      await canvasShot(page, path.join(OUT_DIR, `1${built.length + 1}-canvas-${entry.id}.png`));
      built.push({ id: entry.id, query: entry.query, mapId, name: map!.name, size: `${map!.width}x${map!.height}`, events: map!.events.length, rooms: result.data?.rooms?.length, wallMaterial: result.data?.wallMaterial, summary: result.summary });
    }
    const after = await readProject(page);
    expect(Object.keys(after.maps).length - Object.keys(before.maps).length).toBe(BUILD.length);
    // 시설마다 크기가 다르다 — 한 도면으로 수렴하지 않는다.
    expect(new Set(built.map((entry) => entry.size)).size).toBeGreaterThanOrEqual(3);

    receipt.built = built;
    receipt.finishedAt = new Date().toISOString();
    writeFileSync(path.join(OUT_DIR, "receipt.json"), JSON.stringify(receipt, null, 2));
    console.log(`[concept-gallery-e2e] ${JSON.stringify(built)}`);
  });
});
