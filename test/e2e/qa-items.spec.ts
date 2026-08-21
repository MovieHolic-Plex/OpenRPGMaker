import { expect, test, type Page } from "@playwright/test";
import {
  exportedProject,
  openDatabase,
  switchDatabaseTab,
} from "./oprn-database-helpers";

const ITEMS_TAB = { label: "Items", slug: "items", testId: "db-tab-items" } as const;
const CROPS_TAB = { label: "Crops", slug: "crops", testId: "db-tab-crops" } as const;

// 가상화된 리스트는 렌더 창 안의 행만 DOM 에 두므로, 행 카운트 대신 푸터의 전체
// 레코드 수("N개")로 증감을 검증한다(T6 가상화 이후).
async function totalRecordCount(page: Page): Promise<number> {
  const text = (await page.locator(".oprn-record-count").textContent()) ?? "0개";
  return parseInt(text.replace(/[^0-9]/g, ""), 10);
}

async function gotoExpert(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
}

test.describe("QA sweep: items tab", () => {
  test("CRUD round trip: add, fill every field kind, tab away/back, export, duplicate, delete", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, ITEMS_TAB);
    // 갤러리가 기본 뷰(T5) — 행 카운트/CRUD 는 리스트 뷰에서 수행한다.
    await page.getByTestId("db-view-toggle-list").click();
    await expect(page.getByTestId("db-view-toggle-list")).toHaveClass(/active/);

    const countBefore = await totalRecordCount(page);

    await page.getByTestId("db-add-record").click();

    await page.getByTestId("db-field-name").fill("QA아이템경계값");
    await page.getByTestId("db-field-price").fill("999999");
    await page.getByTestId("db-field-item-capture-multiplier").fill("3.5");
    await page.getByTestId("db-field-scope").selectOption("allAllies");
    await page.getByTestId("db-field-item-description").fill("QA 설명 텍스트 경계값 테스트 30자 이상 아주 길게 길게 길게 작성합니다 반복 반복");
    await page.getByTestId("db-field-item-type").selectOption("medicine");
    // 대상은 T9 이후 세그먼트 컨트롤(네이티브 radio) — 레이블 클릭으로 선택.
    await page.getByTestId("db-field-item-scope").getByText("아군 전체").click();
    await page.getByTestId("db-field-item-consumption-limit").selectOption("3");
    // 회복 % 는 T9 이후 슬라이더+스테퍼 쌍 — 스테퍼(number input)에 값을 입력한다.
    await page.getByTestId("db-field-item-hp-percent-stepper").fill("20");
    await page.getByTestId("db-field-item-hp-flat").fill("30");
    await page.getByTestId("db-field-item-mp-percent-stepper").fill("10");
    await page.getByTestId("db-field-item-only-menu").check();

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/items-medicine-filled.png" });

    // tab away and back — value must persist
    await switchDatabaseTab(page, CROPS_TAB);
    await switchDatabaseTab(page, ITEMS_TAB);
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA아이템경계값");
    await expect(page.getByTestId("db-field-price")).toHaveValue("999999");

    const project1 = await exportedProject(page);
    const created = project1.database.items.find((item) => item.name === "QA아이템경계값");
    expect(created, "created item should exist in exported project").toBeTruthy();
    expect(created).toMatchObject({
      price: 999999,
      description: "QA 설명 텍스트 경계값 테스트 30자 이상 아주 길게 길게 길게 작성합니다 반복 반복",
      type: "medicine",
      consumptionLimit: 3,
      scope: "allAllies",
      onlyUsableInMenu: true,
    });

    const countAfterAdd = await totalRecordCount(page);
    expect(countAfterAdd).toBe(countBefore + 1);

    // duplicate
    await page.getByRole("button", { name: "복제", exact: true }).click();
    const countAfterDuplicate = await totalRecordCount(page);
    expect(countAfterDuplicate).toBe(countBefore + 2);
    await expect(page.getByTestId("db-field-name")).toHaveValue("QA아이템경계값 사본");

    // delete requires a second confirming click (2-step confirm)
    await page.getByTestId("db-delete-selected").click();
    expect(await totalRecordCount(page), "single click must not delete yet").toBe(countBefore + 2);
    await page.getByTestId("db-delete-selected").click();
    expect(await totalRecordCount(page), "second click confirms delete").toBe(countBefore + 1);
  });

  test("Item type switch panels swap and boundary values on price/capture-multiplier do not crash", async ({ page }) => {
    test.setTimeout(120_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, ITEMS_TAB);
    await page.getByTestId("db-add-record").click();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // 127.0.0.1:17831 is a known dev-tool ping endpoint (confirmed via requestfailed URL); Chrome's
      // console.error text for it doesn't include the host, so filter by the generic message pattern.
      if (msg.text() === "Failed to load resource: net::ERR_CONNECTION_REFUSED") return;
      consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    // boundary: negative price
    await page.getByTestId("db-field-price").fill("-500");
    await page.getByTestId("db-field-price").blur();
    // boundary: empty price
    await page.getByTestId("db-field-price").fill("");
    await page.getByTestId("db-field-price").blur();
    // boundary: huge price
    await page.getByTestId("db-field-price").fill("999999999");
    await page.getByTestId("db-field-price").blur();

    // boundary: negative capture multiplier
    await page.getByTestId("db-field-item-capture-multiplier").fill("-2");
    await page.getByTestId("db-field-item-capture-multiplier").blur();

    await page.getByTestId("db-field-item-type").selectOption("weapon");
    await expect(page.getByTestId("db-item-open-equipment-tab")).toBeVisible();
    await expect(page.getByTestId("db-field-item-wield-type")).toHaveCount(0);

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/items-weapon-boundary.png" });

    // Key/switch type
    await page.getByTestId("db-field-item-type").selectOption("switch");
    await expect(page.getByTestId("db-items-switch-panel")).toBeVisible();

    // Farm tool (농사 도구)
    await page.getByTestId("db-field-item-farm-tool").selectOption("hoe");
    await expect(page.getByTestId("db-field-item-farm-tool")).toHaveValue("hoe");

    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/items-switch-farmtool.png" });

    const project = await exportedProject(page);
    const item = project.database.items.at(-1);
    // price is clamped to the RM2K3 6-digit ceiling [0, 999999] server-side regardless of what was typed.
    expect(item?.price, "huge price input clamps to 999999, does not overflow/crash").toBe(999999);

    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("Item image/icon resource picker dialog opens, selects, clears", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, ITEMS_TAB);
    await page.getByTestId("db-add-record").click();

    await expect(page.getByTestId("db-field-item-image-resource-set")).toBeVisible();
    await page.getByTestId("db-field-item-image-resource-set").click();
    await expect(page.getByTestId("db-field-item-image-resource-dialog-cancel")).toBeVisible();
    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/items-image-picker-dialog.png" });
    await page.getByTestId("db-field-item-image-resource-dialog-cancel").click();
    await expect(page.getByTestId("db-field-item-image-resource-dialog-cancel")).toBeHidden();

    await page.getByTestId("db-field-item-icon-resource-set").click();
    await expect(page.getByTestId("db-field-item-icon-resource-dialog-cancel")).toBeVisible();
    await page.getByTestId("database-modal").screenshot({ path: ".superpowers/sdd/qa-shots/items-icon-picker-dialog.png" });
    await page.getByTestId("db-field-item-icon-resource-dialog-cancel").click();
  });

  test("Undo (Ctrl+Z) reverts an item field edit", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoExpert(page);
    await openDatabase(page);
    await switchDatabaseTab(page, ITEMS_TAB);
    const nameField = page.getByTestId("db-field-name");
    const original = await nameField.inputValue();
    await nameField.fill("QA UNDO TARGET");
    await nameField.blur();
    await expect(nameField).toHaveValue("QA UNDO TARGET");
    await page.keyboard.press("Control+z");
    await expect(nameField).toHaveValue(original, { timeout: 3000 });
  });
});
