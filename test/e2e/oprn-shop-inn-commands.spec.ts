import { expect, test, type Locator, type Page } from "@playwright/test";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import {
  exportedProject,
  makeCommerceProject,
  makeInsufficientCommerceProject,
  makeInnRecoveryProject,
  runtimeState,
  tapKey,
} from "./oprn-commerce-fixtures";
import { startNewGameFromTitle } from "./runtimeInput";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});


type PickerCommand = {
  readonly kind: "shop" | "inn";
  readonly testId: "command-picker-add-shop" | "command-picker-add-inn";
};

const EDITOR_TILE_SIZE = 16;

/**
 * 타일 → 클라이언트 좌표는 엔진에게 묻는다(`__oprnEditWorldToClient`, EditScene.ts).
 * 스펙이 직접 계산하던 `(canvasWidth - mapWidth*tile*zoom)/2` 는 틀렸다 — Phaser 3.60+ 의
 * scrollX 규약 때문에 카메라 worldView 가 캔버스 왼쪽 위와 대응하지 않는다. 실측: 2×2 맵의
 * 타일 (1,1) 은 (850,510) 인데 그 식은 (606,511) 을 찍어 맵 밖("outside")을 눌렀고,
 * 이벤트가 만들어지지 않아 편집창이 열리지 않았다.
 */
async function clickMapTile(page: Page, x: number, y: number): Promise<void> {
  const point = await page.evaluate(({ tx, ty, tile }) => {
    const hook = (window as unknown as {
      __oprnEditWorldToClient?: (worldX: number, worldY: number) => { x: number; y: number };
    }).__oprnEditWorldToClient;
    return hook ? hook((tx + 0.5) * tile, (ty + 0.5) * tile) : null;
  }, { tx: x, ty: y, tile: EDITOR_TILE_SIZE });
  if (!point) throw new Error("missing editor camera hook");
  await page.mouse.dblclick(point.x, point.y);
}

async function addCommerceCommand(page: Page, command: PickerCommand): Promise<Locator> {
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  // 상점·여관은 `commerce` 가족이고 그 가족의 탭은 1이다(commandPresentation.ts PAGE_BY_FAMILY).
  // 예전에는 탭 2를 못 박아 뒀는데 가족→탭 배치가 바뀌면 그대로 깨진다 — 네 탭을 훑는다.
  const entry = picker.getByTestId(command.testId);
  for (const tab of [1, 2, 3, 4]) {
    await picker.getByTestId(`event-command-picker-tab-${tab}`).click();
    if (await entry.isVisible()) break;
  }
  await entry.click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * 기본 도크(유리)는 맵 캔버스 위에 486×620 카드로 뜬다. 1280×800 에서 카드가 캔버스
 * 가운데(중앙 타일 포함)를 덮어 `canvas.dblclick` 이 카드에 먹힌다 — 실측 로그:
 * `div.ai-chat-main … intercepts pointer events`. 저작 조작 전에 조수를 옆 열로 옮긴다.
 */
async function moveAssistantOutOfCanvas(page: Page): Promise<void> {
  const layout = page.getByTestId("editor-layout");
  for (let attempt = 0; attempt < 4; attempt++) {
    if (((await layout.getAttribute("class")) ?? "").includes("chat-dock-side")) break;
    await page.getByTestId("chat-dock-toggle").evaluate((node) => (node as HTMLButtonElement).click());
  }
  await expect(layout).toHaveClass(/chat-dock-side/);
}

async function openEventEditorAtMapTile(page: Page): Promise<void> {
  await moveAssistantOutOfCanvas(page);
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapTile(page, 1, 1);

  const editor = page.getByTestId("event-editor-modal");
  try {
    await expect(editor).toBeVisible({ timeout: 1000 });
  } catch {
    await page.getByTestId("event-editor-open").click();
    await expect(editor).toBeVisible();
  }
  // 편집창 기본 보기는 '스토리'(storyboardView.ts loadStoryboardMode) 이고 그 모드에서는
  // 명령 목록이 hidden 이다. 이 스펙은 명령 줄을 직접 다루므로 '목록' 보기로 바꾼다.
  const listView = page.getByTestId("event-view-toggle-list");
  if ((await listView.getAttribute("aria-pressed")) !== "true") await listView.click();
  await expect(page.getByTestId("event-command-empty-line")).toBeVisible();
}

async function waitForRuntimeInput(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => typeof (window as unknown as { __oprnInput?: unknown }).__oprnInput)
    )
    .toBe("object");
}

test("shop and inn commands are readable in the editor and playable at runtime", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const authoringProject = makeCommerceProject();
  authoringProject.maps.map_shop.events = [];
  await seedProjectFromSupabaseCanonical(page, authoringProject);
  await openEventEditorAtMapTile(page);

  await expect(page.getByTestId("event-command-kind-select")).toHaveCount(0);
  await expect(page.getByTestId("event-command-add")).toHaveCount(0);

  const shopCommand = await addCommerceCommand(page, { kind: "shop", testId: "command-picker-add-shop" });
  await shopCommand.getByTestId("shop-item-check-item_potion").check();
  await expect(
    shopCommand.locator('[data-testid="shop-sale-list"] [data-testid="shop-item-row-item_potion"]')
  ).toBeVisible();
  await expect(shopCommand).toContainText("상점 종류");
  // 단일 목록의 두 그룹 머리글이 진열 상태를 말해 준다.
  await expect(shopCommand.getByTestId("shop-sale-list")).toContainText("판매 중");
  await expect(shopCommand.getByTestId("shop-stock-pool")).toContainText("안 담음");
  await page.screenshot({ path: testInfo.outputPath("shop-editor-readable.png"), fullPage: true });
  await shopCommand.getByTestId("event-command-edit-ok").click();
  await expect(shopCommand).toHaveCount(0);
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  await expect(page.getByTestId("event-command-shop").first()).toBeVisible();

  const innCommand = await addCommerceCommand(page, { kind: "inn", testId: "command-picker-add-inn" });
  await innCommand.getByTestId("inn-price-input").fill("25");
  await innCommand.getByTestId("inn-price-input").blur();
  await expect(innCommand).toContainText("여관 요금");
  await innCommand.getByTestId("event-command-edit-ok").click();
  await expect(innCommand).toHaveCount(0);
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  await page.getByTestId("event-editor-apply").click();
  await page.screenshot({ path: testInfo.outputPath("shop-inn-editor-readable.png"), fullPage: true });
  const authoredCommands = Object.values((await exportedProject(page)).maps).flatMap((map) =>
    map.events.flatMap((event) => [
      ...(event.commands ?? []),
      ...(event.pages ?? []).flatMap((eventPage) => eventPage.commands),
    ])
  );
  // 새 상점 명령은 빈 진열로 시작하지 않는다 — 잡화점 프리셋(회복약·마력약·해독초)이
  // 기본으로 깔린다(quickAuthoringDefaults.ts defaultShopItemIds). 정확히 한 종만 담겼다고
  // 단정하면 그 설계와 싸운다. 담은 물건이 진열에 들어갔는지만 본다.
  expect(authoredCommands).toContainEqual(
    expect.objectContaining({ kind: "shop", itemIds: expect.arrayContaining(["item_potion"]) })
  );
  expect(authoredCommands).toContainEqual(expect.objectContaining({ kind: "inn", price: 25 }));
  const shopRow = page.getByTestId("event-command-shop").first();
  // 먼저 한 번 눌러 인스펙터를 띄우고 배치를 확정한 뒤에 더블클릭한다. 첫 클릭이 오른쪽
  // 인스펙터 칼럼을 열면 명령 칼럼이 좁아지고 위쪽 도구줄이 한 줄 더 접혀 명령 줄이 아래로
  // 밀린다 — 그러면 두 번째 클릭이 도구줄(`event-editor-command-toolbar`)에 떨어져 `dblclick`
  // 이 `.cmd-head` 에 닿지 못하고 편집창이 열리지 않는다(실측: 두 번째 mousedown 의 대상이
  // `.cmd-head` 가 아니라 도구줄). 제품 쪽 결함이지만 이 스펙 범위가 아니라 여기서는 배치가
  // 굳은 뒤에 더블클릭한다.
  await shopRow.locator(".cmd-head").click();
  await expect(page.getByTestId("event-inspector-body")).toBeVisible();
  await shopRow.locator(".cmd-head").dblclick();
  const shopEditDialog = page.getByTestId("event-command-edit-dialog");
  await expect(shopEditDialog).toBeVisible();
  await shopEditDialog.getByTestId("shop-type-select").selectOption("sellOnly");
  await shopEditDialog.getByTestId("shop-branch-on-transaction").check();
  await expect(shopEditDialog.getByTestId("shop-transaction-branch-controls")).toBeVisible();
  await shopEditDialog.getByTestId("shop-add-transaction-branch-command").click();
  await shopEditDialog.getByTestId("event-command-edit-ok").click();
  await expect(shopEditDialog).toHaveCount(0);
  await page.getByTestId("event-editor-apply").click();
  const authoredCommerceCommands = Object.values((await exportedProject(page)).maps).flatMap((map) =>
    map.events.flatMap((event) => [
      ...(event.commands ?? []),
      ...(event.pages ?? []).flatMap((eventPage) => eventPage.commands),
    ])
  );
  expect(authoredCommerceCommands).toContainEqual(
    expect.objectContaining({
      kind: "shop",
      itemIds: expect.arrayContaining(["item_potion"]),
      // 판매 허용은 `shopType` 하나로만 적는다. 상점 유형을 고르면 편집창이 낡은 `allowSell`
      // 필드를 일부러 떼어 낸다(commandBodyCommerce.ts withShopType) — 둘을 같이 두면
      // projectLint 의 `shop.allowSell-mismatch` 경고 대상이 된다. 런타임도 `shopType` 을
      // 먼저 읽고 없을 때만 `allowSell` 로 되돌아간다(playSceneShopDom.ts shopType).
      shopType: "sellOnly",
      messageType: "welcome",
      branchOnTransaction: true,
      transactionBranch: [expect.objectContaining({ kind: "text" })],
    })
  );

  await page.getByTestId("event-editor-modal-close").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await seedProjectFromSupabaseCanonical(page, makeCommerceProject());
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await expect.poll(async () => page.evaluate(() => "__oprnSetActorVitals" in window)).toBe(false);
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");

  await expect(page.getByTestId("shop-scene")).toContainText("어서 오세요.");
  await page.screenshot({ path: testInfo.outputPath("shop-runtime-menu-readable.png"), fullPage: true });
  await page.getByTestId("shop-mode-buy").click();
  await expect(page.getByTestId("shop-scene")).toContainText("회복약");
  await page.screenshot({ path: testInfo.outputPath("shop-runtime-items-readable.png"), fullPage: true });
  await page.getByTestId("shop-buy-item_potion").click();
  // 구매해도 가게는 닫히지 않는다 — 확인 문구를 읽고 계속 살 수 있어야 한다(RPG 만들기 규약).
  // 다음 명령(여관)으로 넘어가려면 상품 목록과 메뉴를 차례로 닫는다.
  await expect(page.getByTestId("shop-scene")).toContainText("구매");
  await page.getByTestId("shop-item-cancel").click();
  await page.getByTestId("shop-menu-cancel").click();

  await expect(page.getByTestId("inn-scene")).toContainText("여관");
  await expect(page.getByTestId("inn-scene")).toContainText("25 G");
  await page.screenshot({ path: testInfo.outputPath("inn-runtime-readable.png"), fullPage: true });
  await page.getByTestId("inn-stay").click();

  await expect.poll(async () => (await runtimeState(page)).gold).toBe(63);
  const runtime = await runtimeState(page);
  expect(runtime.inventory.item_potion).toBe(1);
});

test("common event inline commands use readable Korean command labels", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, makeCommerceProject());
  await page.getByTestId("toolbar-database").click();
  // 29개 탭은 그룹 아코디언 안에 있고 한 그룹만 펼쳐진다(database.ts defaultCollapsedGroups).
  // '공용 이벤트' 는 '세계' 그룹 소속이라 먼저 그 그룹을 열어야 탭이 보인다(예전 slug 는 `map`).
  await page.getByTestId("db-tab-group-world").click();
  await page.getByTestId("db-tab-common-events").click();

  const detail = page.getByTestId("db-detail-form");
  await expect(detail).toContainText("상점 공용 이벤트");
  // 인라인 명령 줄은 kind 가 아니라 사람이 읽는 이름 + 요약으로 나온다.
  // ("상점 처리" · "+ 문장 표시" 는 제품에 없던 문구다 — commandSummary.ts 의 이름은 "상점"
  //  이고 요약은 "상점: 1개·100G" 꼴이다. 이 단정은 이 변경 이전부터 실패하고 있었다.)
  await expect(detail).toContainText("상점: 1개");
  await expect(detail).toContainText("이벤트 명령");
  // 요약 형식은 "<이름>: <내용>" 이므로 kind 가 새면 "shop: …" 으로 읽힌다(레코드 id "ce_shop"
  // 과 겹치지 않도록 콜론까지 본다).
  await expect(detail).not.toContainText("shop:");
  await expect(detail).not.toContainText("+ text");
  await page.screenshot({ path: testInfo.outputPath("common-event-inline-readable.png"), fullPage: true });
});

test("shop and inn keep the player in the panel when gold is insufficient", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, makeInsufficientCommerceProject());
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");

  await page.getByTestId("shop-mode-buy").click();
  await page.getByTestId("shop-buy-item_potion").click();
  await expect(page.getByTestId("shop-scene")).toContainText("소지금이 부족합니다.");
  await expect(page.getByTestId("shop-scene")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("shop-insufficient-gold-readable.png"), fullPage: true });
  await page.getByTestId("shop-item-cancel").click();
  await page.getByTestId("shop-menu-cancel").click();

  await expect(page.getByTestId("inn-scene")).toContainText("25 G");
  await page.getByTestId("inn-stay").click();
  await expect(page.getByTestId("inn-scene")).toContainText("소지금이 부족합니다.");
  await expect(page.getByTestId("inn-scene")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("inn-insufficient-gold-readable.png"), fullPage: true });
});

test("shop supports quantity purchase and item selling when enabled", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = makeCommerceProject();
  const pageCommands = project.maps.map_shop.events[0]?.pages?.[0]?.commands;
  if (!pageCommands) throw new Error("missing commerce commands");
  pageCommands[1] = { kind: "shop", itemIds: ["item_potion"], allowSell: true, quantityMode: "select" };
  await seedProjectFromSupabaseCanonical(page, project);
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");

  await page.getByTestId("shop-mode-buy").click();
  await page.getByTestId("shop-quantity-input").fill("2");
  await page.screenshot({ path: testInfo.outputPath("shop-quantity-buy-readable.png"), fullPage: true });
  await page.getByTestId("shop-buy-item_potion").click();
  // 구매해도 가게에 머문다 — 확인 메시지를 읽고 계속 살 수 있어야 한다.
  await expect(page.getByTestId("shop-scene")).toContainText("구매");
  let runtime = await runtimeState(page);
  expect(runtime.gold).toBe(76);
  expect(runtime.inventory.item_potion).toBe(2);

  // 판매 목록은 소지품 목록이다 — 방금 산 물약이 보인다.
  await page.getByTestId("shop-item-cancel").click();
  await page.getByTestId("shop-mode-sell").click();
  await page.getByTestId("shop-quantity-input").fill("3");
  await page.getByTestId("shop-sell-item_potion").click();
  await expect(page.getByTestId("shop-scene")).toContainText("가진 개수가 부족합니다.");
  await page.getByTestId("shop-quantity-input").fill("1");
  await page.getByTestId("shop-sell-item_potion").click();
  await expect(page.getByTestId("shop-scene")).toContainText("판매");
  await page.screenshot({ path: testInfo.outputPath("shop-sell-readable.png"), fullPage: true });
  runtime = await runtimeState(page);
  // 예전 82 → 182 는 상점이 구매 직후 닫히고 여관을 취소한 뒤 Space 로 이벤트를 **다시**
  // 실행해 `changeGold += 100` 이 두 번 들어간 값이었다. 이제 구매해도 가게에 머무르므로
  // 소지금은 76 + 되팔기 6 = 82 다.
  expect(runtime.gold).toBe(82);
  expect(runtime.inventory.item_potion).toBe(1);

  await page.getByTestId("shop-item-cancel").click();
  await page.getByTestId("shop-menu-cancel").click();
  await expect(page.getByTestId("inn-scene")).toBeVisible();
  await page.getByTestId("inn-cancel").click();
});

test("inn restores party HP and MP after payment", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, makeInnRecoveryProject(), "/?e2eVitals=1");
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitForRuntimeInput(page);
  await page.getByTestId("play-canvas").locator("canvas").click();
  const before = await runtimeState(page);
  const actorId = before.partyActorIds[0];
  if (!actorId) throw new Error("missing party actor");
  await expect
    .poll(async () =>
      page.evaluate(() => typeof (window as unknown as { __oprnSetActorVitals?: unknown }).__oprnSetActorVitals)
    )
    .toBe("function");
  await page.evaluate((id) => {
    const testWindow = window as unknown as { __oprnSetActorVitals?: (actorId: string, hp: number, mp: number) => void };
    testWindow.__oprnSetActorVitals?.(id, 1, 0);
  }, actorId);
  await expect.poll(async () => (await runtimeState(page)).actorVitals[actorId]?.hp).toBe(1);
  await expect.poll(async () => (await runtimeState(page)).actorVitals[actorId]?.mp).toBe(0);
  await tapKey(page, "Space");

  await expect(page.getByTestId("inn-scene")).toContainText("여관");
  await page.screenshot({ path: testInfo.outputPath("inn-recovery-readable.png"), fullPage: true });
  await page.getByTestId("inn-stay").click();
  const after = await runtimeState(page);
  expect(after.actorVitals[actorId]?.hp).toBe(after.actorVitals[actorId]?.maxHp);
  expect(after.actorVitals[actorId]?.mp).toBe(after.actorVitals[actorId]?.maxMp);
  expect(after.gold).toBe(75);
});
