import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const OUT = join(process.cwd(), "output", "evidence", "map-tree-thumbnails");

type RowFacts = {
  readonly ariaLevel: string;
  readonly left: number;
  readonly mapId: string;
  readonly name: string;
  readonly parentRowMapId: string;
  readonly thumbHeight: number;
  readonly thumbState: string;
  readonly thumbWidth: number;
};

test.beforeEach(async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
});

test("every map row shows a real rendered thumbnail of that map", async ({ page }) => {
  // Break named: map rows are text-only, so a beginner cannot tell which map is which.
  test.setTimeout(180_000);
  await openEditorMapPanel(page);

  const houseId = await addChildMap(page, await firstRowMapId(page), "민재의 집");
  await addChildMap(page, houseId, "민재의 집 1층");

  const rows = await readRowFacts(page);
  expect(rows.length, "map tree rows").toBeGreaterThanOrEqual(3);

  const missing = rows.filter((row) => row.thumbState !== "map");
  expect(missing.map((row) => `${row.name}: state=${row.thumbState}`), "rows without a rendered map thumbnail").toEqual([]);

  for (const row of rows) {
    expect(row.thumbWidth, `${row.name} thumbnail width`).toBeGreaterThan(0);
    expect(row.thumbHeight, `${row.name} thumbnail height`).toBeGreaterThan(0);
  }

  const distinct = await page.evaluate((ids) => {
    const encode = (mapId: string): string => {
      const node = document.querySelector(`[data-testid="map-thumb-${mapId}"]`);
      if (!(node instanceof HTMLCanvasElement)) throw new Error(`missing thumbnail canvas for ${mapId}`);
      return node.toDataURL("image/png");
    };
    return ids.map(encode);
  }, rows.map((row) => row.mapId));
  expect(new Set(distinct).size, "maps with different tile content must render different thumbnails").toBeGreaterThan(1);

  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "01-panel-thumbnails.png") });
});

test("child maps read as a directory tree with increasing depth", async ({ page }) => {
  // Break named: every nested row uses one flat 16px indent, so 민재의 집 1층 looks like a sibling of 민재의 집.
  test.setTimeout(180_000);
  await openEditorMapPanel(page);

  const rootId = await firstRowMapId(page);
  const houseId = await addChildMap(page, rootId, "민재의 집");
  for (const floor of ["민재의 집 1층", "민재의 집 2층", "민재의 집 3층"]) {
    await addChildMapViaDialog(page, houseId, floor);
  }

  const rows = await readRowFacts(page);
  const byName = new Map(rows.map((row) => [row.name, row]));
  const root = rows[0]!;
  const house = required(byName, "민재의 집");
  const floors = ["민재의 집 1층", "민재의 집 2층", "민재의 집 3층"].map((name) => required(byName, name));

  expect(house.ariaLevel, "민재의 집 depth").toBe("2");
  for (const floor of floors) {
    expect(floor.ariaLevel, `${floor.name} depth`).toBe("3");
    // 깊이만 보면 다른 부모의 자식이어도 통과한다 — 실제 부모 행 id 를 확인한다.
    expect(floor.parentRowMapId, `${floor.name} parent row`).toBe(house.mapId);
    expect(floor.left, `${floor.name} indent past 민재의 집`).toBeGreaterThan(house.left);
    expect(floor.thumbState, `${floor.name} thumbnail`).toBe("map");
  }
  expect(house.parentRowMapId, "민재의 집 parent row").toBe(root.mapId);
  expect(house.left, "민재의 집 indent past the root map").toBeGreaterThan(root.left);

  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "02-nested-tree.png") });
});

test("the beginner map flyout shows the same thumbnails and nesting", async ({ page }) => {
  // Break named: the beginner rail flyout renders its own row grid, so thumbnails can be panel-only.
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "beginner");
    localStorage.setItem("oprn:editor-ui-mode", "beginner");
  });
  await page.setViewportSize({ height: 1000, width: 1600 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("basic-rail-toggle-maps")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("basic-rail-toggle-maps").click();
  await expect(page.getByTestId("map-tree")).toBeVisible();

  const rootId = await firstRowMapId(page);
  await page.getByTestId(`map-tree-node-${rootId}`).hover();
  await page.getByTestId(`map-quick-add-child-${rootId}`).click();
  await page.getByTestId("map-create-name").fill("민재의 집");
  await page.getByTestId("map-create-confirm").click();
  await expect(page.getByTestId("map-create-dialog")).toBeHidden();

  // 맵 만들기 다이얼로그가 열리면 플라이아웃은 닫힌다 — 사용자도 다시 여는 경로다.
  await page.getByTestId("basic-rail-toggle-maps").click();
  await expect(page.getByTestId("map-tree")).toBeVisible();
  const rows = await readRowFacts(page);
  const missing = rows.filter((row) => row.thumbState !== "map");
  expect(missing.map((row) => `${row.name}: state=${row.thumbState}`), "flyout rows without a thumbnail").toEqual([]);
  const house = rows.find((row) => row.name === "민재의 집");
  expect(house, "민재의 집 row in the flyout").toBeTruthy();
  expect(house!.ariaLevel, "민재의 집 depth in the flyout").toBe("2");

  await page.getByTestId("map-tree").screenshot({ path: join(OUT, "03-beginner-flyout.png") });
});

/** 맵 패널을 기다리기 전에 에디터 부팅을 먼저 기다린다 — 캔버스가 뜨기 전에는
 * 좌패널이 아직 마운트되지 않아 map-tree 를 곧바로 기다리면 부팅 지연에 걸린다. */
async function openEditorMapPanel(page: Page): Promise<void> {
  await page.setViewportSize({ height: 1000, width: 1600 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("map-tree")).toBeVisible({ timeout: 30_000 });
}

function required(rows: Map<string, RowFacts>, name: string): RowFacts {
  const row = rows.get(name);
  if (!row) throw new Error(`row not found: ${name} (have ${[...rows.keys()].join(", ")})`);
  return row;
}

async function firstRowMapId(page: Page): Promise<string> {
  const first = page.locator("[data-testid^='map-tree-node-']").first();
  await expect(first).toBeVisible();
  const testId = await first.getAttribute("data-testid");
  if (!testId) throw new Error("map row is missing its testid");
  return testId.replace("map-tree-node-", "");
}

async function addChildMap(page: Page, parentId: string, name: string): Promise<string> {
  await page.getByTestId(`map-tree-node-${parentId}`).click({ button: "right" });
  await page.getByTestId(`map-menu-add-child-${parentId}`).click();
  await page.getByTestId("map-create-name").fill(name);
  await page.getByTestId("map-create-confirm").click();
  await expect(page.getByTestId("map-create-dialog")).toBeHidden();
  return rowIdByExactName(page, name);
}

/** 헤더 맵 만들기 + 상위 select 경로. 같은 행을 연달아 우클릭하면 다이얼로그 한 번 뒤에
 * 다음 메뉴가 열리지 않는 경우가 있어, 자식을 여러 개 만들 때는 이 경로를 쓴다. */
async function addChildMapViaDialog(page: Page, parentId: string, name: string): Promise<string> {
  await page.getByTestId("map-add").click();
  await expect(page.getByTestId("map-create-dialog")).toBeVisible();
  await page.getByTestId("map-create-parent").selectOption(parentId);
  await page.getByTestId("map-create-name").fill(name);
  await page.getByTestId("map-create-confirm").click();
  await expect(page.getByTestId("map-create-dialog")).toBeHidden();
  return rowIdByExactName(page, name);
}

/** 이름 부분일치로 행을 고르면 시연 프로젝트의 기존 맵(예: "민재의 집 내부")을 부모로 잡는다. */
async function rowIdByExactName(page: Page, name: string): Promise<string> {
  const row = page
    .locator("[data-testid^='map-tree-node-']")
    .filter({ has: page.locator(".map-tree-name", { hasText: new RegExp(`^${escapeRegExp(name)}$`) }) })
    .first();
  await expect(row).toBeVisible();
  const testId = await row.getAttribute("data-testid");
  if (!testId) throw new Error(`row for ${name} is missing its testid`);
  return testId.replace("map-tree-node-", "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readRowFacts(page: Page): Promise<RowFacts[]> {
  await expect(page.locator("[data-testid^='map-thumb-']").first()).toHaveAttribute("data-thumb-state", "map", {
    timeout: 15_000,
  });
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='map-tree-node-']"));
    return rows.map((row) => {
      const mapId = (row.dataset.testid ?? "").replace("map-tree-node-", "");
      const thumb = row.querySelector(`[data-testid="map-thumb-${mapId}"]`);
      const thumbRect = thumb instanceof HTMLElement ? thumb.getBoundingClientRect() : null;
      // 자식 행은 부모 행 바로 뒤에 오는 role=group 안에 들어간다.
      const group = row.parentElement?.getAttribute("role") === "group" ? row.parentElement : null;
      const parentRow = group?.previousElementSibling;
      const parentRowMapId = parentRow instanceof HTMLElement
        ? (parentRow.dataset.testid ?? "").replace("map-tree-node-", "")
        : "";
      return {
        ariaLevel: row.getAttribute("aria-level") ?? "",
        left: Math.round(row.getBoundingClientRect().left * 100) / 100,
        mapId,
        name: row.querySelector(".map-tree-name")?.textContent?.trim() ?? "",
        parentRowMapId,
        thumbHeight: thumbRect ? Math.round(thumbRect.height) : 0,
        thumbState: thumb instanceof HTMLElement ? thumb.dataset.thumbState ?? "none" : "none",
        thumbWidth: thumbRect ? Math.round(thumbRect.width) : 0,
      };
    });
  });
}
