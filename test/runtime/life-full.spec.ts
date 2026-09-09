import { expect, test, type Page } from "@playwright/test";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import type { Project } from "../../src/project/types";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

/* Task 18: the life ledger and save/resume on the REAL player surface.
 *
 * Why this harness and not scripts/qa/runtime: that runner drives input through
 * input.ts injectActionEdge(), which pushes an edge into the PHASER key manager. The
 * status menu is DOM and listens for window keydown, so injected edges move the world
 * (tilling, harvesting) but never reach the menu — measured across seven attempts at
 * the collapsed rail. Playwright presses real keys, which the DOM receives, exactly as
 * test/runtime/status-menu-adversarial.spec.ts already proves. */

const OUT = "verify-shots/runtime-qa/life-full-menu";
const NAMESPACE = "runtime-life-full-menu";
let server: Awaited<ReturnType<typeof startPlayerQaServer>>;
let project: Project;

type QaWindow = Window & {
  __OPENRPG_BOOT__?: { projectUrl: string; saveNamespace: string; qaInstrumentation: boolean };
  __oprnDebug?: { readState: () => Record<string, unknown> };
};

test.beforeAll(async () => {
  server = await startPlayerQaServer();
  project = JSON.parse(readFileSync("test/fixtures/life-full.project.json", "utf8")) as Project;
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/SUMMARY.md`, "# Life ledger + save/resume on the real player surface\n");
});

test.afterAll(async () => { await server?.close(); });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function boot(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.addInitScript((namespace) => {
    (window as QaWindow).__OPENRPG_BOOT__ = { projectUrl: "/__life-qa/project.json", saveNamespace: namespace, qaInstrumentation: true };
  }, NAMESPACE);
  await page.route("**/__life-qa/project.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 150_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as QaWindow).__oprnDebug?.readState().currentMapId), null, { timeout: 120_000 });
  await expect(page.getByTestId("play-loading-overlay")).toHaveCount(0, { timeout: 120_000 });
  return errors;
}

// Real keys, mirroring status-menu-adversarial.spec.ts: x closes a detail, ArrowDown
// walks the rail, z confirms.
async function rail(page: Page, id: string) {
  for (let i = 0; i < 8 && await page.locator("[data-testid='main-menu'].status-menu-detail-focus").count(); i++) {
    await page.keyboard.press("x");
  }
  for (let i = 0; i < 8; i++) {
    if (await page.locator(`[data-testid='status-menu-command-${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(`status-menu-command-${id}`)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

/* keyBindings.ts 계약: "메뉴(menu) : X · Esc — 필드에서 메뉴 열기/닫기는 취소와 같은 키다".
 * 즉 취소 키를 무작정 반복하면 닫은 뒤 다시 열린다. 한 번 누르고 사라졌는지 확인하고,
 * 남아 있으면(하위 화면이라 back 만 된 경우) 다시 한 번만 누른다. */
async function closeMenu(page: Page) {
  for (let i = 0; i < 10; i++) {
    if (!(await page.getByTestId("main-menu").count())) return;
    await page.keyboard.press("Escape");
    // 닫힘이 반영될 틈을 준 뒤 상태로 판단한다 — 눌린 횟수를 세지 않는다.
    await page.getByTestId("main-menu").waitFor({ state: "detached", timeout: 1_500 }).catch(() => {});
  }
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
}

async function choose(page: Page, id: string) {
  for (let i = 0; i < 24; i++) {
    if (await page.locator(`[data-testid='${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(id)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

test("생활 원장을 실제 메뉴로 열고 저장 슬롯까지 도달한다", async ({ page }) => {
  const errors = await boot(page);

  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await shot(page, "01-main-menu");

  // 기록 그룹 -> 생활 원장. 주입 엣지로는 7회 열리지 않았던 지점이다.
  await rail(page, "record-menu");
  await shot(page, "02-record-group-open");
  await expect(page.getByTestId("status-menu-group-command-life-ledger")).toBeVisible({ timeout: 20_000 });

  await choose(page, "status-menu-group-command-life-ledger");
  await expect(page.getByTestId("life-ledger-tab-shipping")).toBeVisible({ timeout: 20_000 });
  await shot(page, "03-life-ledger-shipping");

  // 시스템 그룹 -> 저장. 로드도 같은 그룹에 있다.
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await shot(page, "04-system-group-open");
  await expect(page.getByTestId("status-menu-group-command-save")).toBeVisible({ timeout: 20_000 });

  await choose(page, "status-menu-group-command-save");
  await expect(page.getByTestId("save-slot-1")).toBeVisible({ timeout: 20_000 });
  await shot(page, "05-save-slots");

  expect(errors, "player console/page errors").toEqual([]);
  await appendFile(`${OUT}/SUMMARY.md`, "\n- 생활 원장 + 저장 슬롯 도달: 실제 키 입력\n");
});

test("출하 투입 -> 수면 정산 -> 저장 -> 로드 재개를 실제 메뉴로 증명한다", async ({ page }) => {
  const errors = await boot(page);

  // 1) 출하함에 실제로 넣는다. 야생 부추는 픽스처 시작 재고에 있다.
  await page.keyboard.press("x");
  await rail(page, "record-menu");
  await choose(page, "status-menu-group-command-life-ledger");
  await expect(page.getByTestId("life-ledger-tab-shipping")).toBeVisible({ timeout: 20_000 });

  // 상세 항목은 onActivate 기반이라 키보드로 결정한다(.click 은 대상이 아니다 — 실측: 타임아웃).
  await expect(page.getByTestId("life-ledger-shipping-deposit-item_wild_leek")).toBeVisible({ timeout: 20_000 });
  await choose(page, "life-ledger-shipping-deposit-item_wild_leek");
  // 투입 성공의 제품측 증거: 꺼내기 항목이 생긴다.
  await expect(page.getByTestId("life-ledger-shipping-withdraw-item_wild_leek")).toBeVisible({ timeout: 20_000 });
  await shot(page, "10-deposited");

  const goldBefore = (await page.getByTestId("status-menu-gold").textContent()) ?? "";

  // 2) 메뉴를 닫고 잠자리에서 하루를 넘긴다 — 정산은 날짜 전환에 일어난다.
  await closeMenu(page);
  // 실측: 침대 ev_bed 는 map_farming_demo (3,3) 이다. 앞서 map_farm/(5,3) 으로 추측해
  // 텔레포트가 조용히 실패했고, gameTime 전체 비교가 minute 0->1 을 하루 전환으로 오인했다.
  await page.evaluate(() => {
    const w = window as unknown as { __oprnDebug?: { teleport?: (m: string, x: number, y: number) => void } };
    w.__oprnDebug?.teleport?.("map_farming_demo", 3, 4);
  });
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("z");
  // 잠자리 확인 대사를 넘긴다.
  for (let i = 0; i < 6; i++) await page.keyboard.press("z");
  // 하루가 실제로 넘어가야 한다.
  const before = await page.evaluate(() => {
    const s = (window as QaWindow).__oprnDebug?.readState() as { gameTime?: Record<string, number>; gold?: number } | undefined;
    return { gameTime: s?.gameTime, gold: s?.gold };
  });
  console.log("BEFORE_SLEEP=" + JSON.stringify(before));
  // 하루가 넘어가면 gameTime 이 바뀐다 — 필드명을 추측하지 않고 스냅샷 전체를 비교한다.
  // minute 이 흐르는 것은 하루 전환이 아니다 — day 자체가 늘어야 한다.
  await page.waitForFunction((prevDay) => {
    const s = (window as QaWindow).__oprnDebug?.readState() as { gameTime?: { day?: number } } | undefined;
    return typeof s?.gameTime?.day === "number" && s.gameTime.day > prevDay;
  }, before.gameTime?.day ?? 1, { timeout: 60_000 });
  const after = await page.evaluate(() => {
    const s = (window as QaWindow).__oprnDebug?.readState() as { gameTime?: Record<string, number>; gold?: number } | undefined;
    return { gameTime: s?.gameTime, gold: s?.gold };
  });
  console.log("AFTER_SLEEP=" + JSON.stringify(after));
  await shot(page, "11-after-sleep");

  // 3) 정산 결과: 골드가 늘어야 한다.
  await page.keyboard.press("x");
  const goldAfter = (await page.getByTestId("status-menu-gold").textContent()) ?? "";
  expect(goldAfter, `정산 전 ${goldBefore} -> 후 ${goldAfter}`).not.toBe(goldBefore);
  await shot(page, "12-settled-gold");

  // 4) 저장한다.
  await rail(page, "system-menu");
  // 저장 전에 로드 칸이 비활성(빈 칸)이어야 한다 — 남은 상태로 통과하는 것을 막는다.
  await choose(page, "status-menu-group-command-load");
  // disabled 는 DOM 속성이 아니다(playerStatusMenu.ts:380 은 onActivate 연결만 건너뛴다).
  // 제품이 실제로 보여주는 문자열로 확인한다: 저장 전에는 "비어 있음".
  await expect(page.getByTestId("load-slot-1")).toContainText("비어 있음", { timeout: 20_000 });
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-save");
  await expect(page.getByTestId("save-slot-1")).toBeVisible({ timeout: 20_000 });
  await choose(page, "save-slot-1");
  await shot(page, "13-saved");

  // 5) 같은 세션에서 로드로 재개한다. 슬롯이 present 여야 활성화된다.
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-load");
  // 저장 후에는 같은 칸이 "저장됨"으로 바뀌어야 한다 — 내 저장이 원인임을 못박는다.
  await expect(page.getByTestId("load-slot-1")).toContainText("저장됨", { timeout: 20_000 });
  await choose(page, "load-slot-1");
  // 재개 후 플레이가 다시 살아야 한다.
  await expect(page.getByTestId("main-menu")).toHaveCount(0, { timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as QaWindow).__oprnDebug?.readState().currentMapId), null, { timeout: 60_000 });
  await shot(page, "14-resumed");

  expect(errors, "player console/page errors").toEqual([]);
  await appendFile(`${OUT}/SUMMARY.md`, `\n- 출하 투입 -> 정산(${goldBefore} -> ${goldAfter}) -> 저장 -> 로드 재개\n`);
});
