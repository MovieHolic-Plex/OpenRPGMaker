/**
 * 보고서용 캡처 스펙 (진단 전용 — `_` 접두사라 기본 스위트에서 제외된다).
 * 상점을 "에디터에서 만드는 화면"과 "런타임에서 보이는 화면"을 같은 프로젝트로 찍는다.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openCommandPicker, openMapEventEditor } from "./eventStoryboardPicker";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { makeCommerceProject, runtimeState, tapKey } from "./oprn-commerce-fixtures";
import { startNewGameFromTitle } from "./runtimeInput";
import type { Command, Project } from "@/project/types";

const DIR = "output/evidence/shop-report";

test.setTimeout(300_000);

async function shot(page: Page, name: string, target?: Locator): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const path = `${DIR}/${name}.png`;
  if (target) await target.screenshot({ path });
  else await page.screenshot({ path, fullPage: false });
}

async function dismissOverlays(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible({ timeout: 60_000 });
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function pickBySearch(page: Page, query: string): Promise<Locator> {
  const picker = await openCommandPicker(page);
  await picker.getByTestId("event-command-picker-search").fill(query);
  await picker.locator(".event-command-picker-search-results .event-command-picker-command").first().click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("editor: 상점 처리 명령 편집창", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await openMapEventEditor(page);

  const dialog = await pickBySearch(page, "상점");
  const window = dialog.locator(".event-subdialog-window");
  await expect(dialog.getByTestId("shop-command-body")).toBeVisible();

  // 01 — 명령을 막 추가한 직후. 잡화점 프리셋이 이미 깔려 있다.
  await shot(page, "editor-01-shop-dialog-default", window);

  // 02 — 자료집 검색/종류 필터
  await dialog.getByTestId("shop-item-search").fill("검");
  await expect(dialog.getByTestId("shop-item-catalog")).toBeVisible();
  await shot(page, "editor-02-catalog-search", dialog.locator(".shop-processing-catalog-fold"));
  await dialog.getByTestId("shop-item-search").fill("");

  // 03 — 자료집 행을 골라 담기
  await dialog.getByTestId("shop-catalog-row-item_hi_potion").click();
  await dialog.getByTestId("shop-add-item").click();
  await expect(
    dialog.locator('[data-testid="shop-sale-list"] [data-testid="shop-item-row-item_hi_potion"]')
  ).toBeVisible();
  await shot(page, "editor-03-sale-list", dialog.locator(".shop-processing-items"));

  // 04 — 선택한 아이템 상세 · 계절 재고
  await dialog.getByTestId("shop-item-detail-summary").click();
  await expect(dialog.getByTestId("shop-item-detail")).toBeVisible();
  await shot(page, "editor-04-item-detail", dialog.locator(".shop-processing-detail-fold"));

  // 05 — 오른쪽 설정 레일
  await dialog.getByTestId("shop-type-select").selectOption("normal");
  await dialog.getByTestId("shop-quantity-mode").selectOption("select");
  await dialog.getByTestId("shop-merchant-gold").fill("300");
  await dialog.getByTestId("shop-merchant-gold").blur();
  await shot(page, "editor-05-options-rail", dialog.getByTestId("shop-options-rail"));

  // 06 — 거래 후 분기 켠 상태
  await dialog.getByTestId("shop-branch-on-transaction").check();
  await dialog.getByTestId("shop-branch-on-failed-transaction").check();
  await expect(dialog.getByTestId("shop-transaction-branch-controls")).toBeVisible();
  await shot(page, "editor-06-branch-controls", dialog.getByTestId("shop-transaction-branch-controls"));

  // 07 — 전체화면 편집창 (설정까지 끝낸 최종 상태)
  await shot(page, "editor-07-shop-dialog-full", window);

  // 08 — 빈 상점 경고
  const body = dialog.getByTestId("shop-command-body");
  const rows = dialog.locator('[data-testid="shop-sale-list"] .shop-processing-item-row');
  for (let guard = 0; guard < 12 && (await rows.count()) > 0; guard += 1) {
    await rows.first().click();
    await dialog.getByTestId("shop-remove-item").click();
  }
  await expect(dialog.getByTestId("shop-empty-banner")).toBeVisible();
  await shot(page, "editor-08-empty-warning", body);

  await dialog.getByTestId("event-command-edit-cancel").click();
});

function richShopProject(): Project {
  const project = makeCommerceProject();
  const page = project.maps.map_shop.events[0]?.pages?.[0];
  if (!page) throw new Error("missing commerce event page");
  const commands: Command[] = [
    // 200G — 회복약 12G·해독초 8G 는 살 수 있고 검술 교본 320G 는 못 산다(품절 아닌 '소지금 부족' 표시용).
    { kind: "changeGold", op: "+=", amount: 200 },
    { kind: "changeItem", itemId: "item_antidote", op: "+=", amount: 3 },
    { kind: "changeItem", itemId: "item_warp_scroll", op: "+=", amount: 1 },
    {
      kind: "shop",
      itemIds: [
        "item_potion",
        "item_ether",
        "item_antidote",
        "item_hi_potion",
        "item_capture_orb",
        "item_warp_scroll",
        "item_sword_manual",
      ],
      shopType: "normal",
      messageType: "welcome",
      quantityMode: "select",
      merchantGold: 300,
    },
  ];
  page.commands = commands;
  return project;
}

async function openShopAtRuntime(page: Page, project: Project): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project);
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect
    .poll(async () => page.evaluate(() => typeof (window as unknown as { __oprnInput?: unknown }).__oprnInput))
    .toBe("object");
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");
  await expect(page.getByTestId("shop-scene")).toBeVisible();
}

test("runtime: 상점 화면", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openShopAtRuntime(page, richShopProject());
  const overlay = page.getByTestId("shop-scene");
  const viewport = page.locator(".play-viewport").first();

  // 01 — 입구 메뉴 (인사말 + 구입/판매/취소)
  await shot(page, "runtime-01-menu", overlay);
  await shot(page, "runtime-01b-menu-viewport", viewport);

  // 02 — 구입 목록
  await page.getByTestId("shop-mode-buy").click();
  await expect(overlay).toContainText("회복약");
  await shot(page, "runtime-02-buy-list", overlay);
  await shot(page, "runtime-02b-buy-list-viewport", viewport);

  // 03 — 커서를 옮기면 도움말/보유 패널이 따라온다
  await page.getByTestId("shop-buy-item_sword_manual").hover();
  await page.getByTestId("shop-buy-item_sword_manual").click();
  await expect(overlay).toContainText("소지금이 부족합니다.");
  await shot(page, "runtime-03-unaffordable", overlay);

  // 04 — 수량 선택 후 구매. 구매해도 창은 닫히지 않는다.
  await page.getByTestId("shop-quantity-input").fill("2");
  await page.getByTestId("shop-buy-item_potion").click();
  await expect(overlay).toContainText("구매");
  await shot(page, "runtime-04-after-buy", overlay);
  const afterBuy = await runtimeState(page);

  // 05 — 판매 목록 = 소지품 목록
  await page.getByTestId("shop-item-cancel").click();
  await page.getByTestId("shop-mode-sell").click();
  await expect(overlay).toBeVisible();
  await shot(page, "runtime-05-sell-list", overlay);

  // 06 — 되팔기 후
  await page.getByTestId("shop-quantity-input").fill("1");
  await page.getByTestId("shop-sell-item_antidote").click();
  await expect(overlay).toContainText("판매");
  await shot(page, "runtime-06-after-sell", overlay);
  const afterSell = await runtimeState(page);

  // eslint-disable-next-line no-console
  console.log("[shop-report] state", JSON.stringify({ afterBuy, afterSell }));
});

test("runtime: 빈 상점 실패 분기가 실행되는가", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = makeCommerceProject();
  const eventPage = project.maps.map_shop.events[0]?.pages?.[0];
  if (!eventPage) throw new Error("missing commerce event page");
  eventPage.commands = [
    {
      kind: "shop",
      itemIds: [],
      branchOnFailedTransaction: true,
      failedTransactionBranch: [{ kind: "text", body: "FAILED-BRANCH-RAN" }],
    },
  ];
  await openShopAtRuntime(page, project);
  await expect(page.getByTestId("shop-scene")).toContainText("지금은 팔 물건이 없습니다.");
  await page.getByTestId("shop-notice-close").click();
  await expect(page.getByTestId("shop-scene")).toHaveCount(0);
  // 실패 분기가 살아 있으면 여기서 "FAILED-BRANCH-RAN" 문장이 떠야 한다.
  const body = await page.locator("body").innerText();
  // eslint-disable-next-line no-console
  console.log("[failed-branch] contains marker:", body.includes("FAILED-BRANCH-RAN"));
  await shot(page, "runtime-08-failed-branch", page.locator(".play-viewport").first());
  expect(body).toContain("FAILED-BRANCH-RAN");
});

test("runtime: 추가 서비스(감정·마일리지)가 전달되는가", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = makeCommerceProject();
  const eventPage = project.maps.map_shop.events[0]?.pages?.[0];
  if (!eventPage) throw new Error("missing commerce event page");
  eventPage.commands = [
    { kind: "changeGold", op: "+=", amount: 200 },
    {
      kind: "shop",
      itemIds: ["item_potion"],
      shopServiceKind: "appraisal",
      appraisalUnidentifiedPool: [],
      mileageRate: 0.1,
    } as Command,
  ];
  await openShopAtRuntime(page, project);
  const overlay = page.getByTestId("shop-scene");
  const text = await overlay.innerText();
  // eslint-disable-next-line no-console
  console.log("[extra-services] overlay text:", JSON.stringify(text));

  // 감정 풀이 비었으므로 playShop 은 "지금은 해 드릴 일이 없습니다." 안내만 띄워야 한다.
  const serviceHonored = text.includes("해 드릴 일이 없습니다");
  // eslint-disable-next-line no-console
  console.log("[extra-services] shopServiceKind honored:", serviceHonored);

  if (!serviceHonored) {
    await page.getByTestId("shop-mode-buy").click();
    await page.getByTestId("shop-buy-item_potion").click();
    await expect(overlay).toContainText("구매");
    const mileage = await page.evaluate(() => {
      const node = document.querySelector("[data-testid='runtime-state-json']");
      return JSON.parse(node?.textContent ?? "{}").shopMileagePoints ?? null;
    });
    // eslint-disable-next-line no-console
    console.log("[extra-services] shopMileagePoints after 12G buy (0.1 rate → 1 expected):", mileage);
  }
  await shot(page, "runtime-09-extra-services", page.locator(".play-viewport").first());
});

test("runtime: 빈 상점 안내", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = makeCommerceProject();
  const eventPage = project.maps.map_shop.events[0]?.pages?.[0];
  if (!eventPage) throw new Error("missing commerce event page");
  eventPage.commands = [{ kind: "shop", itemIds: [] }];
  await openShopAtRuntime(page, project);
  await expect(page.getByTestId("shop-scene")).toContainText("지금은 팔 물건이 없습니다.");
  await shot(page, "runtime-07-empty-notice", page.getByTestId("shop-scene"));
});
