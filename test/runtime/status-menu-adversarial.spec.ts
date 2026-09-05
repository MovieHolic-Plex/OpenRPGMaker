import { expect, test, type Page } from "@playwright/test";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import type { Project } from "../../src/project/types";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const OUT = "verify-shots/runtime-qa/status-menu-adversarial";
const NAMESPACE = "runtime-menu-adversarial";
// The shared Linux host churns network interfaces; Firefox avoids Chromium's
// process-wide ERR_NETWORK_CHANGED cancellation during unbundled module loads.
test.use({ browserName: "firefox", launchOptions: { args: [] } });
let server: Awaited<ReturnType<typeof startPlayerQaServer>>;
let project: Project;
type QaWindow = Window & {
  __OPENRPG_BOOT__?: { projectUrl: string; saveNamespace: string; qaInstrumentation: boolean };
  __oprnDebug?: { readState: () => { currentMapId?: string } };
};

test.beforeAll(async () => {
  server = await startPlayerQaServer();
  project = JSON.parse(await readFile("test/fixtures/projects/item-runtime-qa-v3.json", "utf8"));
  // Minimal engine contracts in a detached test copy; no authored demo or remote project changes.
  const potion = project.database.items.find((item) => item.id === "item_potion")!;
  Object.assign(potion, { type: "medicine", consumptionLimit: 1, consumable: true });
  const buff = { ...structuredClone(potion), id: "qa_buff", name: "상태 부여 검사",
    description: "파티원 한 명에게 공격 상승 상태를 부여합니다.",
    hpRecovery: { flat: 0, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
    stateEffects: [{ stateId: "state_attack_up", operation: "add" as const, chance: 100 }] };
  const seed = { ...structuredClone(buff), id: "qa_seed", name: "능력 씨앗 검사",
    description: "파티원 한 명의 공격력을 3 올립니다.",
    type: "seed" as const, scope: "none" as const,
    seedParameterBonuses: { attack: 3, defense: 0, mind: 0, agility: 0 } };
  const device = { ...structuredClone(potion), id: "qa_device", name: "장치 작동 검사",
    description: "검사용 장치를 작동합니다.", type: "switch" as const,
    scope: "ally" as const, switchId: "sw_1000" };
  project.database.items = [potion, buff, seed, device];
  project.session.inventory = { item_potion: 5, qa_buff: 2, qa_seed: 2, qa_device: 2 };
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/SUMMARY.md`, "# Runtime menu adversarial QA\n\nKeyboard input, item effects, save/load and viewport geometry.\n");
});

test.afterAll(async () => { await server?.close(); });

test.afterEach(async ({ page }, info) => {
  await appendFile(`${OUT}/SUMMARY.md`, `\n- ${info.status}: ${info.title}\n`);
  if (info.status !== info.expectedStatus) await shot(page, `failure-${info.title.slice(0,24).replace(/[^a-z]+/gi, "-")}`);
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await appendFile(`${OUT}/SUMMARY.md`, `\n- 즉시 확인: ${name}.png\n`);
}

async function boot(page: Page) {
  const errors: string[] = [];
  let networkChanged = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_NETWORK_CHANGED") networkChanged = true;
  });
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript((namespace) => {
    (window as QaWindow).__OPENRPG_BOOT__ = { projectUrl: "/__menu-qa/project.json", saveNamespace: namespace, qaInstrumentation: true };
  }, NAMESPACE);
  await page.route("**/__menu-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  // Retry only a witnessed transport interruption, never a gameplay assertion.
  for (let attempt = 0; ; attempt++) {
    networkChanged = false;
    try {
      await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 45_000 });
      break;
    } catch (error) {
      if (!networkChanged || attempt >= 1) throw error;
    }
  }
  await page.keyboard.press("Enter");
  await ready(page);
  return errors;
}

async function ready(page: Page) {
  await page.waitForFunction(() => Boolean((window as QaWindow).__oprnDebug?.readState().currentMapId), undefined, { timeout: 120_000 });
  await expect(page.getByTestId("title-screen")).toHaveCount(0);
  await expect(page.getByTestId("play-loading-overlay")).toHaveCount(0, { timeout: 120_000 });
}

async function rail(page: Page, id: string) {
  for (let i = 0; i < 8 && await page.locator("[data-testid='main-menu'].status-menu-detail-focus").count(); i++) await page.keyboard.press("x");
  for (let i = 0; i < 6; i++) {
    if (await page.locator(`[data-testid='status-menu-command-${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(`status-menu-command-${id}`)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

async function choose(page: Page, id: string) {
  for (let i = 0; i < 20; i++) {
    if (await page.locator(`[data-testid='${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(id)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

async function stored(page: Page) {
  return page.evaluate((namespace) => JSON.parse(localStorage.getItem(`${namespace}:save-slot:1`)!), NAMESPACE);
}

test("held confirm/cancel cannot consume items, reopen a menu or bypass title confirmation", async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__oprnSetActorVitals?.("actor_hero", 100, 5));
  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.keyboard.down("z");
  await page.keyboard.down("z");
  await page.keyboard.down("z");
  await page.keyboard.up("z");
  await expect(page.getByTestId("status-menu-item-item_potion")).toContainText("5개");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-party-row-0")).toContainText("100/514");

  await page.keyboard.press("z");
  await page.keyboard.press("z");
  await expect(page.getByTestId("status-menu-item-item_potion")).toContainText("4개");
  await expect(page.getByTestId("status-menu-party-row-0")).toContainText("150/514");
  await shot(page, "01-one-deliberate-use");
  await page.keyboard.press("x");
  await page.keyboard.down("x");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await page.keyboard.down("x");
  await page.keyboard.up("x");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-to-title");
  // choose released z: enter confirmation with a new down, then try its OS repeats separately.
  await page.keyboard.press("x");
  await page.keyboard.down("z");
  await page.keyboard.down("z");
  await page.keyboard.up("z");
  await expect(page.getByTestId("status-menu-confirm-to-title")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toHaveCount(0);
  await page.keyboard.press("x");
  expect(errors).toEqual([]);
});

test("state items, seeds and switches work through the menu and survive save/load", async ({ page }) => {
  const errors = await boot(page);
  await page.keyboard.press("x");
  await rail(page, "items");
  await choose(page, "status-menu-item-qa_buff");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toHaveJSProperty("tagName", "BUTTON");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toBeEnabled();
  await page.keyboard.press("z");
  await expect(page.getByTestId("status-menu-item-qa_buff")).toContainText("1개");
  await choose(page, "status-menu-item-qa_seed");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toHaveJSProperty("tagName", "BUTTON");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toBeEnabled();
  await page.keyboard.press("z");
  await expect(page.getByTestId("status-menu-item-qa_seed")).toContainText("1개");
  await choose(page, "status-menu-item-qa_device");
  await expect(page.getByTestId("status-menu-item-target-actor_hero")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-item-qa_device")).toContainText("1개");
  await shot(page, "02-effects-applied");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-save");
  await choose(page, "save-slot-1");
  const saved = await stored(page);
  expect(saved.session.actorStateIds.actor_hero).toContain("state_attack_up");
  expect(saved.session.actorParamBonuses.actor_hero.attack).toBe(3);
  expect(saved.session.inventory.qa_buff).toBe(1);
  expect(saved.session.inventory.qa_seed).toBe(1);
  expect(saved.session.switches.sw_1000).toBe(true);
  await page.keyboard.press("x");
  await choose(page, "status-menu-group-command-load");
  await choose(page, "load-slot-1");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-save");
  await choose(page, "save-slot-1");
  await choose(page, "save-slot-1");
  const reloaded = await stored(page);
  expect(reloaded.session.actorStateIds).toEqual(saved.session.actorStateIds);
  expect(reloaded.session.actorParamBonuses).toEqual(saved.session.actorParamBonuses);
  expect(reloaded.session.inventory).toEqual(saved.session.inventory);
  expect(reloaded.session.switches.sw_1000).toBe(true);
  expect(errors).toEqual([]);
});

test("title load keeps the game scale and every error/slot reachable by keyboard", async ({ page }) => {
  const errors = await boot(page);
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await choose(page, "status-menu-group-command-save");
  await choose(page, "save-slot-1");
  await page.evaluate((namespace) => {
    const saved = JSON.parse(localStorage.getItem(`${namespace}:save-slot:1`)!);
    saved.mapName = "아주 긴 지도 이름 ".repeat(10);
    for (const slot of [1, 2, 3]) localStorage.setItem(`${namespace}:save-slot:${slot}`, JSON.stringify(saved));
  }, NAMESPACE);
  await page.keyboard.press("x");
  await choose(page, "status-menu-group-command-to-title");
  await page.keyboard.press("z");
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("z");
  const load = page.getByTestId("player-load-window");
  await expect(load).toBeVisible();
  for (const viewport of [{ width: 640, height: 480 }, { width: 960, height: 720 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => load.evaluate((node) => {
      const stage = node.closest(".play-stage");
      if (!stage) return false;
      const s = stage.getBoundingClientRect(), r = node.getBoundingClientRect();
      return r.width / s.width > 0.7 && r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom;
    })).toBe(true);
    await shot(page, `03-load-${viewport.width}`);
  }
  // Corrupt/incompatible saves must scroll inside the stage, retaining the title and Back action.
  await page.evaluate((namespace) => {
    const incompatible = JSON.parse(localStorage.getItem(`${namespace}:save-slot:1`)!);
    incompatible.session.currentMapId = `map_removed_${"very_long_name_".repeat(20)}`;
    for (const slot of [2, 3]) localStorage.setItem(`${namespace}:save-slot:${slot}`, JSON.stringify(incompatible));
    localStorage.setItem(`${namespace}:save-slot:1`, "{broken");
  }, NAMESPACE);
  await page.keyboard.press("z");
  await expect(page.getByTestId("title-screen")).toContainText("불러올 수 없습니다");
  await expect(page.getByTestId("save-slot-corrupt-1")).toBeVisible();
  await expect(load.locator("xpath=ancestor::*[contains(@class, 'play-stage')]")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("save-slot-3")).toHaveClass(/selected/);
  const scroll = await page.getByTestId("player-load-slots").evaluate((node) => {
    const r = node.getBoundingClientRect();
    const selected = node.querySelector(".selected")!.getBoundingClientRect();
    return { scrolls: node.scrollHeight > node.clientHeight, visible: selected.top >= r.top - 1 && selected.bottom <= r.bottom + 1 };
  });
  expect(scroll).toEqual({ scrolls: true, visible: true });
  await shot(page, "04-load-errors-scroll");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("player-load-window")).toHaveCount(0);
  await expect(page.getByTestId("title-screen")).toBeVisible();
  expect(errors).toEqual([]);
});
