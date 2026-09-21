/**
 * RM2003 System SE + 수량 상한 캡처·검증 (진단 전용 — `_` 접두사라 기본 스위트에서 제외된다).
 *
 * 소리는 스크린샷에 안 찍힌다. 그래서 `window.__oprnJuiceLog()` 를 읽어 어떤 SE 가
 * 언제 울렸는지를 수치로 남기고, 화면에는 모션(흔들림·붉은 테두리)을 캡처한다.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { seedProjectForEditor } from "./projectSeed";
import { makeCommerceProject, tapKey } from "./oprn-commerce-fixtures";
import type { Command, Project } from "@/project/types";

const DIR = "output/evidence/shop-feedback";

test.setTimeout(300_000);

type JuiceEntry = { readonly event: string; readonly soundResourceId: string; readonly motionClass: string };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
  eventPage.commands = [...prelude, { kind: "shop", itemIds: [], ...shop } as Command];
  return project;
}

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
  await seedProjectForEditor(page, project);
  await collapseAiDock(page);
  await page.getByTestId("mode-play").click({ force: true });
  const title = page.getByTestId("title-screen");
  await expect
    .poll(async () => (await page.getByTestId("play-stage").count()) + (await title.count()), { timeout: 60_000 })
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

async function juiceLog(page: Page): Promise<readonly JuiceEntry[]> {
  return page.evaluate(() => {
    const host = window as unknown as { __oprnJuiceLog?: () => readonly JuiceEntry[] };
    return host.__oprnJuiceLog?.() ?? [];
  });
}

async function clearJuice(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host = window as unknown as { __oprnRuntimeJuice?: { log: unknown[] } };
    host.__oprnRuntimeJuice = { log: [] };
  });
}

/** 소지금 200G. 회복약 12G(16개까지), 검술 교본 320G(한 개도 못 산다). */
const STORE = shopProject(
  {
    itemIds: ["item_potion", "item_antidote", "item_sword_manual"],
    shopType: "normal",
    messageType: "welcome",
    quantityMode: "select",
    merchantGold: 300,
  },
  [
    { kind: "changeGold", op: "+=", amount: 200 },
    { kind: "changeItem", itemId: "item_antidote", op: "+=", amount: 3 },
  ]
);

test("SE-1: 못 사는 물건을 결정하면 버저 + 흔들림, 성공하면 결정음", async ({ page }) => {
  const overlay = await openShop(page, STORE);
  await page.getByTestId("shop-mode-buy").click();
  await expect(overlay).toContainText("회복약");

  // ── 거절: 검술 교본 320G > 소지금 200G
  const manual = page.getByTestId("shop-buy-item_sword_manual");
  await expect(manual).toHaveAttribute("data-unaffordable", "1");
  await clearJuice(page);
  // 흔들림 클래스는 140ms 만 살아 있어서 클릭 뒤에 읽으면 이미 사라져 있다(실측: false).
  // MutationObserver 로 "한 번이라도 붙었는가"를 기록해야 결정적으로 증명된다.
  await page.evaluate(() => {
    const row = document.querySelector("[data-testid='shop-buy-item_sword_manual']");
    const host = window as unknown as { __shakeSeen?: boolean };
    host.__shakeSeen = false;
    if (!row) return;
    new MutationObserver(() => {
      if (row.classList.contains("juice-menu-invalid")) host.__shakeSeen = true;
    }).observe(row, { attributes: true, attributeFilter: ["class"] });
  });
  await manual.click();

  const refused = await juiceLog(page);
  // eslint-disable-next-line no-console
  console.log("[SE-1] refused juice", JSON.stringify(refused));
  expect(refused.map((entry) => entry.event)).toContain("menu-invalid");
  expect(refused.find((entry) => entry.event === "menu-invalid")?.soundResourceId).toBe("easyrpg-sound-buzzer1");
  // 거절인데 결정음이 섞이면 소리로 결과를 구분할 수 없다.
  expect(refused.map((entry) => entry.event)).not.toContain("menu-confirm");
  await expect(overlay.getByTestId("shop-status-text")).toContainText("소지금이 부족합니다");
  await shot(page, "01-buzzer-refused", overlay);

  // 모션 CSS 가 죽어 있으면 소리만 나고 화면은 그대로다 — 볼륨 0·무음 환경에서 아무 일도
  // 안 일어난 것과 같아진다. 그래서 클래스 부착과 실제 애니메이션 등록을 둘 다 확인한다.
  const shookOnce = await page.evaluate(() => (window as unknown as { __shakeSeen?: boolean }).__shakeSeen === true);
  // eslint-disable-next-line no-console
  console.log("[SE-1] shake class observed:", shookOnce);
  expect(shookOnce).toBe(true);

  // 클래스만 붙고 keyframes 가 없으면(예전 상태) 애니메이션이 0개다. 규칙이 살아 있는지 본다.
  const animation = await page.evaluate(() => {
    const row = document.querySelector("[data-testid='shop-buy-item_sword_manual']");
    if (!row) return null;
    row.classList.add("juice-menu-invalid");
    const style = getComputedStyle(row);
    return { name: style.animationName, duration: style.animationDuration, outline: style.outlineColor };
  });
  // eslint-disable-next-line no-console
  console.log("[SE-1] invalid motion computed", JSON.stringify(animation));
  expect(animation?.name).toBe("juice-menu-invalid-shake");
  // 붉은 테두리는 prefers-reduced-motion 에서도 남는 신호다.
  await shot(page, "01b-buzzer-motion", overlay);

  // ── 성공: 회복약 12G
  await clearJuice(page);
  await page.getByTestId("shop-buy-item_potion").click();
  const bought = await juiceLog(page);
  // eslint-disable-next-line no-console
  console.log("[SE-1] bought juice", JSON.stringify(bought));
  expect(bought.map((entry) => entry.event)).toContain("menu-confirm");
  expect(bought.find((entry) => entry.event === "menu-confirm")?.soundResourceId).toBe("easyrpg-sound-decision1");
  expect(bought.map((entry) => entry.event)).not.toContain("menu-invalid");
  await shot(page, "02-decision-success", overlay);
});

test("SE-2: 수량이 살 수 있는 만큼만 올라가고 상한에서 버저", async ({ page }) => {
  const overlay = await openShop(page, STORE);
  await page.getByTestId("shop-mode-buy").click();
  await page.getByTestId("shop-buy-item_potion").hover();

  const input = page.getByTestId("shop-quantity-input");
  // 200G / 12G = 16
  await expect(input).toHaveAttribute("max", "16");
  // 안내는 aria-label 에만 담는다(출하 런타임은 native title 금지 — runtimeDomTitleGuard).
  await expect(input).toHaveAttribute("aria-label", "수량 — ←/→ 로 1~16 조절");
  await shot(page, "03-quantity-max", overlay);

  // 상한까지 올린다(→ 15번). 조용해야 한다.
  // tapKey 가 아니라 page.keyboard 를 쓴다: tapKey 는 화살표를 __oprnInput.dir() 로 보내
  // Phaser 입력에만 닿고 DOM keydown 을 만들지 않는다. 커서 메뉴는 DOM keydown 을 듣는다.
  await page.getByTestId("shop-buy-item_potion").focus();
  for (let i = 0; i < 15; i += 1) await page.keyboard.press("ArrowRight");
  await expect(input).toHaveValue("16");
  await shot(page, "04-quantity-at-max", overlay);

  // 상한을 넘기려 하면 값이 그대로고 버저.
  await clearJuice(page);
  await page.keyboard.press("ArrowRight");
  await expect(input).toHaveValue("16");
  const capped = await juiceLog(page);
  // eslint-disable-next-line no-console
  console.log("[SE-2] capped juice", JSON.stringify(capped));
  expect(capped.map((entry) => entry.event)).toContain("menu-invalid");
});

test("SE-3: 커서 이동에 커서음, 취소에 취소음", async ({ page }) => {
  const overlay = await openShop(page, STORE);
  await shot(page, "05-entry", overlay);

  // 입구 메뉴에서 커서 이동 (DOM keydown 이어야 커서 메뉴에 닿는다 — tapKey 는 Phaser 전용)
  await clearJuice(page);
  await page.keyboard.press("ArrowDown");
  const moved = await juiceLog(page);
  // eslint-disable-next-line no-console
  console.log("[SE-3] cursor juice", JSON.stringify(moved));
  expect(moved.map((entry) => entry.event)).toContain("menu-select");
  expect(moved.find((entry) => entry.event === "menu-select")?.soundResourceId).toBe("easyrpg-sound-cursor1");

  // 목록으로 들어가 취소키
  await page.getByTestId("shop-mode-buy").click();
  await expect(overlay).toContainText("회복약");
  await clearJuice(page);
  await page.keyboard.press("Escape");
  const cancelled = await juiceLog(page);
  // eslint-disable-next-line no-console
  console.log("[SE-3] cancel juice", JSON.stringify(cancelled));
  expect(cancelled.map((entry) => entry.event)).toContain("menu-back");
  expect(cancelled.find((entry) => entry.event === "menu-back")?.soundResourceId).toBe("easyrpg-sound-cancel1");
});

test("SE-4: 판매 상한은 가진 개수다", async ({ page }) => {
  const overlay = await openShop(page, STORE);
  await page.getByTestId("shop-mode-sell").click();
  await expect(overlay).toContainText("해독초");
  await page.getByTestId("shop-sell-item_antidote").hover();
  // 해독초 3개 보유 → 상한 3. 상인 지갑(300G)은 판매가 4G × 3 보다 넉넉하다.
  await expect(page.getByTestId("shop-quantity-input")).toHaveAttribute("max", "3");
  await shot(page, "06-sell-max-owned", overlay);
});
