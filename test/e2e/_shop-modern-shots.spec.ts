/**
 * 모던 상점 캡처 + 결함 수정 검증 (진단 전용 — `_` 접두사라 기본 스위트에서 제외된다).
 *
 * 이 스펙 하나가 보고서의 모든 화면과 수치를 만든다. 각 test 는 고친 결함 하나에 대응한다.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openCommandPicker, openMapEventEditor, showCommandList } from "./eventStoryboardPicker";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { makeCommerceProject, runtimeState, tapKey } from "./oprn-commerce-fixtures";
import type { Command, Project } from "@/project/types";

const DIR = "output/evidence/shop-modern";

test.setTimeout(300_000);

// 코치마크·초보 UI 오버레이가 mode-play 클릭을 먹어 버리면 플레이가 시작되지 않는다.
// 통과하는 상거래 스펙들과 같은 방식으로 미리 끈다.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // expert 모드는 AI 도크를 펼쳐 mode-play 를 덮는다 — 초보 레일 그대로 두고 코치마크만 끈다.
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

async function shot(page: Page, name: string, target?: Locator): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const path = `${DIR}/${name}.png`;
  if (target) await target.screenshot({ path });
  else await page.screenshot({ path, fullPage: false });
}

function shopProject(shop: Partial<Extract<Command, { kind: "shop" }>>, prelude: Command[] = []): Project {
  const project = makeCommerceProject();
  const eventPage = project.maps.map_shop.events[0]?.pages?.[0];
  if (!eventPage) throw new Error("missing commerce event page");
  eventPage.commands = [
    ...prelude,
    { kind: "shop", itemIds: [], ...shop } as Command,
  ];
  return project;
}

/** AI 도크가 열려 있으면 mode-play 클릭을 먹는다 — 열려 있을 때만 접는다. */
async function collapseAiDock(page: Page): Promise<void> {
  const toggle = page.getByTestId("ai-dock-toggle");
  if (!(await toggle.isVisible().catch(() => false))) return;
  const panel = page.getByTestId("ai-assistant-panel");
  if (await panel.isVisible().catch(() => false)) {
    await toggle.click();
    await expect(panel).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
  }
}

async function openShop(page: Page, project: Project): Promise<Locator> {
  await seedProjectFromSupabaseCanonical(page, project);
  await collapseAiDock(page);
  // force: 편집기 오버레이가 히트테스트를 가로채도 모드 전환은 이뤄져야 한다.
  await page.getByTestId("mode-play").click({ force: true });
  // 공용 startNewGameFromTitle 은 타이틀 화면이 있는 프로젝트를 전제한다. 이 픽스처는
  // 타이틀 없이 맵으로 바로 들어가므로 실제로 나타나는 것(play-stage)을 직접 기다린다.
  const title = page.getByTestId("title-screen");
  await expect
    .poll(async () => (await page.getByTestId("play-stage").count()) + (await title.count()), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0);
  if ((await title.count()) > 0) {
    await expect(title).toBeVisible();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(async () => page.evaluate(() => typeof (window as unknown as { __oprnInput?: unknown }).__oprnInput), {
      timeout: 60_000,
    })
    .toBe("object");
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");
  const overlay = page.getByTestId("shop-scene");
  await expect(overlay).toBeVisible({ timeout: 30_000 });
  return overlay;
}

/* ══════════════════════ 잡화점 — 모던 UI 전반 ══════════════════════ */

const GENERAL_STORE = shopProject(
  {
    itemIds: [
      "item_potion",
      "item_ether",
      "item_antidote",
      "item_hi_potion",
      "item_capture_orb",
      "item_warp_scroll",
      "item_sword_manual",
      "equip_sword",
      "equip_oak_shield",
    ],
    shopType: "normal",
    messageType: "welcome",
    quantityMode: "select",
    merchantGold: 300,
    investmentLevel: 2,
    mileageRate: 0.1,
    loyaltyTierId: "tier_bronze",
  },
  [
    { kind: "changeGold", op: "+=", amount: 200 },
    { kind: "changeItem", itemId: "item_antidote", op: "+=", amount: 3 },
    { kind: "changeItem", itemId: "item_warp_scroll", op: "+=", amount: 1 },
  ]
);

test("modern: 잡화점 전체 흐름", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const overlay = await openShop(page, GENERAL_STORE);
  const viewport = page.locator(".play-viewport").first();

  // 01 — 입구: 상인 얼굴 + 인사말 + 큰 선택 카드 + 키 힌트
  await shot(page, "01-entry-menu", overlay);
  await shot(page, "01b-entry-viewport", viewport);

  // 02 — 구입 화면: 상단바(정체성·탭·소지금) / 목록 / 상세 카드 / 하단 프롬프트
  await page.getByTestId("shop-mode-buy").click();
  await expect(overlay).toContainText("회복약");
  await expect(overlay.getByTestId("shop-category-bar")).toBeVisible();
  // 커서를 첫 줄에 고정한다. 입구 카드를 누른 마우스가 그대로 목록 위에 남으면 그 아래 줄에
  // hover 가 걸려 캡처마다 선택 줄이 달라진다(실측: 포획 구슬 ↔ 귀환 주문서).
  await page.getByTestId("shop-buy-item_potion").hover();
  await expect(page.getByTestId("shop-buy-item_potion")).toHaveClass(/selected/);
  await shot(page, "02-buy-list", overlay);
  await shot(page, "02b-buy-viewport", viewport);

  // 03 — 장비에 커서를 얹으면 상세 카드에 비교 요약이 뜨고, 순수 보너스 격자는
  // 「상세 / 장비 비교」 오버레이에 있다 (요약이 같은 슬롯을 덮어쓰던 시절의 정리).
  await page.getByTestId("shop-buy-equip_sword").hover();
  await page.getByTestId("shop-buy-equip_sword").focus();
  await expect(overlay.getByTestId("shop-summary-replacement")).toBeVisible();
  await shot(page, "03-equipment-detail", overlay);
  await shot(page, "03b-detail-card", overlay.getByTestId("shop-detail-card"));
  await page.getByTestId("shop-detail-open").click();
  await expect(overlay.getByTestId("shop-comparison")).toBeVisible();
  await expect(overlay.getByTestId("shop-detail-stats")).toContainText("공격");
  await shot(page, "03c-equipment-compare", overlay);
  await page.getByTestId("shop-detail-close").click();
  await expect(overlay.getByTestId("shop-buy-equip_sword")).toBeVisible();

  // 04 — 카테고리 칩으로 장비만 보기
  await page.getByTestId("shop-category-equipment").click();
  await expect(page.getByTestId("shop-buy-item_potion")).toHaveCount(0);
  await expect(page.getByTestId("shop-buy-equip_sword")).toBeVisible();
  await shot(page, "04-category-filter", overlay);
  await page.getByTestId("shop-category-all").click();

  // 05 — 못 사는 줄: 흐림 + 취소선 + 자물쇠, 커서는 얹히고 결정만 거절
  await page.getByTestId("shop-buy-item_sword_manual").click();
  await expect(overlay).toContainText("소지금이 부족합니다.");
  await expect(page.getByTestId("shop-buy-item_sword_manual")).toHaveAttribute("data-unaffordable", "1");
  await shot(page, "05-unaffordable", overlay);

  // 06 — ←→ 로 수량을 올려 2개 구매. 창은 닫히지 않고 소지금 델타가 떠오른다.
  // (스테퍼 버튼은 키보드·포인터 양쪽에 죽은 장식이어서 걷어냈다 — 조절은 방향키가 담당.)
  // 합계는 '선택된 행'의 단가로 계산된다 — 05 에서 검서를 눌러 선택이 거기 남아 있으므로
  // 회복약으로 커서를 되돌린 뒤에 합계를 본다(12G × 2 = 24G).
  await page.getByTestId("shop-buy-item_potion").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("shop-quantity-total")).toContainText("24");
  await page.getByTestId("shop-buy-item_potion").click();
  await expect(overlay).toContainText("구매");
  await shot(page, "06-after-buy", overlay);
  const afterBuy = await runtimeState(page);

  // 07 — 탭으로 그 자리에서 판매 전환 (입구 메뉴를 거치지 않는다)
  await page.getByTestId("shop-tab-sell").click();
  await expect(page.getByTestId("shop-sell-item_antidote")).toBeVisible();
  await shot(page, "07-sell-tab", overlay);

  // 판매 목록에 같은 물건이 두 줄로 나오지 않는다 (F-3)
  await expect(page.getByTestId("shop-sell-item_warp_scroll")).toHaveCount(1);

  // 08 — 되팔기
  await page.getByTestId("shop-sell-item_antidote").click();
  await expect(overlay).toContainText("판매");
  await shot(page, "08-after-sell", overlay);
  const afterSell = await runtimeState(page);

  // eslint-disable-next-line no-console
  console.log("[modern] state", JSON.stringify({ afterBuy, afterSell }));
});

/* ══════════════════════ F-4 — 무기점 ══════════════════════ */

test("F-4: 장비 탭 레코드로 무기점을 만들고 사서 장착한다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = shopProject(
    {
      itemIds: [
        "equip_short_sword",
        "equip_sword",
        "equip_iron_sword",
        "equip_steel_sword",
        "equip_oak_shield",
        "equip_leather_armor",
        "equip_traveler_hat",
        "equip_focus_charm",
      ],
      shopType: "buyOnly",
      messageType: "business",
      merchantGold: 200,
    },
    [{ kind: "changeGold", op: "+=", amount: 400 }]
  );
  const overlay = await openShop(page, project);
  await page.getByTestId("shop-mode-buy").click();

  // 예전에는 이 목록이 통째로 비었다 — 상점이 database.items 만 읽어 장비 id 가 조용히 사라졌다.
  await expect(page.getByTestId("shop-buy-equip_iron_sword")).toBeVisible();
  await expect(overlay).toContainText("철 검");
  await shot(page, "10-weapon-shop", overlay);

  await page.getByTestId("shop-buy-equip_iron_sword").click();
  await expect(overlay).toContainText("구매");
  const state = await runtimeState(page);
  expect(state.inventory.equip_iron_sword).toBe(1);
  // eslint-disable-next-line no-console
  console.log("[F-4] weapon shop state", JSON.stringify(state));

  // 상점을 닫고 장비 메뉴에서 실제로 장착 후보로 잡히는지 본다.
  await page.getByTestId("shop-item-cancel").click();
  await page.getByTestId("shop-menu-cancel").click();
});

/* ══════════════════════ F-1 — 거래 없음 분기 ══════════════════════ */

test("F-1: 빈 상점과 '거래 없이 나가기'가 실패 분기를 실행한다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  // (1) 빈 상점
  const empty = shopProject({
    itemIds: [],
    branchOnFailedTransaction: true,
    failedTransactionBranch: [{ kind: "text", body: "빈 상점 분기가 실행됐습니다." }],
  });
  const overlay = await openShop(page, empty);
  await expect(overlay).toContainText("지금은 팔 물건이 없습니다.");
  await shot(page, "11-empty-notice", overlay);
  await page.getByTestId("shop-notice-close").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("빈 상점 분기가 실행됐습니다.", { timeout: 20_000 });
  await shot(page, "12-empty-branch-ran", page.locator(".play-viewport").first());

  // (2) 진열은 있지만 아무것도 사지 않고 나가기
  const noTrade = shopProject({
    itemIds: ["item_potion"],
    branchOnFailedTransaction: true,
    failedTransactionBranch: [{ kind: "text", body: "거래 없이 나갔습니다." }],
  });
  const second = await openShop(page, noTrade);
  await expect(second).toBeVisible();
  await page.getByTestId("shop-menu-cancel").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("거래 없이 나갔습니다.", { timeout: 20_000 });
});

/* ══════════════════════ F-2 — 추가 서비스 ══════════════════════ */

test("F-2: 추가 서비스·투자·마일리지가 런타임에 도달한다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  // (1) 감정소 + 빈 풀 → 전용 안내
  const appraisal = shopProject({
    itemIds: ["item_potion"],
    shopServiceKind: "appraisal",
    appraisalUnidentifiedPool: [],
  });
  const overlay = await openShop(page, appraisal);
  await expect(overlay).toContainText("지금은 해 드릴 일이 없습니다.");
  await shot(page, "13-appraisal-empty-pool", overlay);
  await page.getByTestId("shop-notice-close").click();

  // (2) 수리점 이름이 헤더에 걸린다 + 투자 Lv 가 상인 예산을 늘린다 (100 × (1+0.25×4) = 200)
  const repair = shopProject(
    { itemIds: ["item_potion"], shopServiceKind: "repair", investmentLevel: 4 },
    [{ kind: "changeGold", op: "+=", amount: 100 }]
  );
  const shop = await openShop(page, repair);
  await page.getByTestId("shop-mode-buy").click();
  await expect(shop.getByTestId("shop-brand-subtitle")).toBeVisible();
  await expect(shop).toContainText("수리점");
  await expect(shop.getByTestId("shop-merchant-gold")).toContainText("200");
  await shot(page, "14-repair-investment", shop);

  // (3) 마일리지 적립
  const mileage = shopProject(
    { itemIds: ["item_potion"], mileageRate: 0.1, loyaltyTierId: "tier_gold" },
    [{ kind: "changeGold", op: "+=", amount: 200 }]
  );
  await openShop(page, mileage);
  await page.getByTestId("shop-mode-buy").click();
  await page.getByTestId("shop-buy-item_potion").click();
  const state = await runtimeState(page);
  // eslint-disable-next-line no-console
  console.log("[F-2] mileage state", JSON.stringify(state));
  expect(state.shopMileagePoints).toBeGreaterThan(0);
  expect(state.shopLoyaltySpend?.tier_gold).toBeGreaterThan(0);
});

/* ══════════════════════ F-5/F-6 — 에디터 문구 ══════════════════════ */

test("F-5/F-6: 메시지 유형 6종 + 오타 없는 미리보기", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible({ timeout: 60_000 });
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const editor = await openMapEventEditor(page);

  const picker = await openCommandPicker(page);
  await picker.getByTestId("event-command-picker-search").fill("상점");
  await picker.locator(".event-command-picker-search-results .event-command-picker-command").first().click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog.getByTestId("shop-command-body")).toBeVisible();

  const select = dialog.getByTestId("shop-message-type");
  const values = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value)
  );
  expect(values).toEqual(["welcome", "business", "direct", "festival", "closingSale", "vip"]);

  const preview = dialog.getByTestId("shop-message-preview");
  await expect(preview).toHaveText("어서 오세요.");
  await expect(preview).not.toContainText("어심");

  await select.selectOption("festival");
  await expect(preview).toContainText("축제 특가");
  await shot(page, "20-editor-message-types", dialog.getByTestId("shop-options-rail"));

  // 저장된 값이 드롭다운에 반영되는지 — 예전에는 option 을 붙이기 전에 value 를 넣어 항상 첫 항목이었다.
  await dialog.getByTestId("event-command-edit-ok").click();
  // 인라인 두 번 클릭 편집은 「목록」 보조 뷰에만 있다 — 기본 「스토리」 뷰에서는 .cmd-list 가
  // DOM 에 있어도 숨어 있어서 dblclick 이 영원히 기다린다.
  await showCommandList(editor);
  await editor.locator('.cmd-list [data-testid="event-command-shop"] .cmd-head').first().dblclick();
  const reopened = page.getByTestId("event-command-edit-dialog");
  await expect(reopened.getByTestId("shop-message-type")).toHaveValue("festival");
  await shot(page, "21-editor-message-persisted", reopened.getByTestId("shop-options-rail"));

  // 자료집에 장비가 함께 잡히는지 (F-4 에디터 절반)
  await reopened.getByTestId("shop-item-search").fill("철 검");
  await expect(reopened.getByTestId("shop-catalog-row-equip_iron_sword")).toBeVisible();
  await shot(page, "22-editor-equipment-catalog", reopened.locator(".shop-processing-catalog-fold"));
  // eslint-disable-next-line no-console
  console.log("[F-5/F-6] editor ok", testInfo.title);
});
