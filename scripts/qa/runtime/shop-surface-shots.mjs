// QA-only shipping-player capture for the shop surface. No canonical project or DB writes.
// Run: node scripts/qa/runtime/shop-surface-shots.mjs [--out verify-shots/shop-modern/after]
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { build } from "vite";
import { startPlayerQaServer, runRuntimeQa } from "../../lib/runtimeQaRun.mjs";

const { values } = parseArgs({ options: { out: { type: "string" }, preset: { type: "string" } } });
const ROOT = resolve(values.out ?? "verify-shots/shop-modern/after");
const project = JSON.parse(await readFile("test/fixtures/projects/item-runtime-qa-v3.json", "utf8"));
project.meta.title = "상점 화면 QA";
project.session.gold = 1200;
project.session.inventory = { item_potion: 2, item_antidote: 1 };
const map = project.maps[project.startMapId];
const graphic = structuredClone(map.events[0].pages[0].graphic);
const itemIds = ["equip_iron_sword", "equip_gen_staff_oak", "equip_steel_armor", "equip_gen_helm_iron",
  "equip_gen_boots_swift", "equip_gen_ring_power", "item_potion", "item_ether", "item_antidote"];
map.events = [{
  id: "qa_shop", x: 15, y: 18, trigger: { kind: "action" }, commands: [],
  pages: [{
    id: "qa_shop_page", name: "QA 상점", conditions: [], graphic,
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "shop", itemIds, allowSell: true, shopType: "normal", quantityMode: "select", merchantGold: 500,
      ...(values.preset ? { shopUiPreset: values.preset } : {}),
      messageType: "welcome", branchOnTransaction: false, transactionBranch: [],
      branchOnFailedTransaction: false, failedTransactionBranch: [] }],
  }],
}];
await mkdir(ROOT, { recursive: true });
const fixturePath = join(ROOT, "qa-fixture.json");
await writeFile(fixturePath, JSON.stringify(project));

const playerDir = resolve(".vite-cache/shop-surface-player");
await build({ configFile: resolve("vite.player.config.ts"), build: { outDir: playerDir }, logLevel: "warn" });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const errors = [];
const settle = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 350));
});
const shot = async (page, name) => { await settle(page); await page.screenshot({ path: join(ROOT, name + ".png") }); console.log("shot", name); };
const press = async (page, key, times = 1) => { for (let i = 0; i < times; i++) { await page.keyboard.press(key); await page.waitForTimeout(90); } };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.route(server.url + "/**", async (route) => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    for (const root of [playerDir, resolve("public")]) {
      const path = join(root, pathname);
      try { await access(path); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
      await route.fulfill({ path });
      return;
    }
    await route.fulfill({ status: 404, body: "missing " + pathname });
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const boot = await runRuntimeQa(page, {
    id: "shop-surface", viewport: { width: 1024, height: 768 }, projectFixture: fixturePath,
    beats: [
      { id: "field-start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }] },
      { id: "entrance", ops: [{ kind: "face", dir: "right" }, { kind: "action" },
        { kind: "waitFor", testid: "shop-mode-buy", state: "present" }, { kind: "waitForVisible", testid: "shop-mode-buy" }] },
    ],
  }, { serverUrl: server.url, outDir: join(ROOT, "boot") });
  if (boot.errors.length) errors.push(...boot.errors);
  await shot(page, "01-entrance");
  await press(page, "Enter");
  await page.getByTestId("shop-buy-equip_iron_sword").waitFor();
  await shot(page, "02-weapon");
  await press(page, "ArrowDown", 2);
  await shot(page, "03-armor");
  // 파티 카드를 직접 고르면 비교 창이 그 동료 기준으로 바뀐다(도트 비교 상점).
  const card = page.locator("[data-testid='shop-party-card-actor_scout']");
  if (await card.count()) {
    const before = await card.getAttribute("aria-pressed");
    // 런타임은 포인터 입력을 막는다(pointer contract) — 키보드 경로로 고른다: 카드에 포커스 후 결정키.
    await card.focus();
    await page.keyboard.press("Enter");
    const hit = await page.evaluate(() => {
      const node = document.querySelector("[data-testid='shop-party-card-actor_scout']");
      const r = node?.getBoundingClientRect();
      const top = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
      return { pressed: node?.getAttribute("aria-pressed"), top: top?.className ?? null,
        heading: document.querySelector(".runtime-shop-statement .runtime-shop-comparison-heading")?.textContent ?? null };
    });
    console.log("party-card", before, JSON.stringify(hit));
    await shot(page, "03b-armor-scout");
    await page.getByTestId("shop-buy-equip_steel_armor").focus();
  }
  await press(page, "ArrowDown", 4);
  await shot(page, "04-potion");
  for (const [w, h] of [[640, 480], [320, 240]]) {
    await page.setViewportSize({ width: w, height: h });
    await press(page, "ArrowUp", 6);
    await shot(page, "05-weapon-" + w + "x" + h);
    await press(page, "ArrowDown", 6);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.close();
} finally {
  await browser.close();
  await server.close();
  await writeFile(join(ROOT, "errors.json"), JSON.stringify(errors, null, 2));
  console.log("errors", errors.length);
}

