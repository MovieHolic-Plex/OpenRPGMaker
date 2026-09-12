// Adversarial shop probe — keyboard-only surface after the residual-issue fixes.
// Run: node scripts/qa/runtime/shop-adversarial-probe.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";
import { build } from "vite";
import { startPlayerQaServer, runRuntimeQa } from "../../lib/runtimeQaRun.mjs";

const OUT = resolve("reports/shop-adversarial");
const project = JSON.parse(await readFile("test/fixtures/projects/item-runtime-qa-v3.json", "utf8"));
project.session.gold = 300;
project.session.inventory = { item_potion: 1, item_antidote: 2 };
const map = project.maps[project.startMapId];
const graphic = structuredClone(map.events[0].pages[0].graphic);
map.events = [{
  id: "qa_shop", x: 15, y: 18, trigger: { kind: "action" }, commands: [],
  pages: [{
    id: "qa_shop_page", name: "QA 거래", conditions: [], graphic,
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "shop", itemIds: ["item_potion", "item_ether", "equip_sword", "item_elixir"],
      stock: [{ itemId: "item_potion", priceOverride: 50 }, { itemId: "item_ether", priceOverride: 120 },
        { itemId: "equip_sword", priceOverride: 100 }, { itemId: "item_elixir", priceOverride: 600 }],
      allowSell: true, shopType: "normal", quantityMode: "select", merchantGold: 200,
      messageType: "welcome",
      economy: { haggleEnabled: true, haggle: { patience: 3, insultRatio: 0.4, maxDiscount: 0.3 } },
      branchOnFailedTransaction: false, failedTransactionBranch: [] }],
  }],
}];
await mkdir(OUT, { recursive: true });
const fixturePath = join(OUT, "qa-fixture.json");
await writeFile(fixturePath, JSON.stringify(project));

const playerDir = resolve(".vite-cache/shop-adversarial-player");
await build({ configFile: resolve("vite.player.config.ts"), build: { outDir: playerDir }, logLevel: "warn" });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.route(`${server.url}/**`, async (route) => {
  const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
  for (const root of [playerDir, resolve("public")]) {
    const path = join(root, pathname);
    try { await readFile(path); } catch { continue; }
    await route.fulfill({ path });
    return;
  }
  await route.fulfill({ status: 404, body: `Missing player asset: ${pathname}` });
});
page.on("pageerror", (e) => console.log("PAGEERROR", String(e)));

const run = await runRuntimeQa(page, {
  id: "shop-adversarial", viewport: { width: 640, height: 480 }, projectFixture: fixturePath,
  beats: [
    { id: "boot", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }] },
    { id: "entrance", ops: [{ kind: "face", dir: "right" }, { kind: "action" }, { kind: "waitForVisible", testid: "shop-mode-buy" }] },
  ],
}, { serverUrl: server.url, outDir: join(OUT, "boot") });
console.log("bootFailures", JSON.stringify(run.beats.flatMap(b => b.failures)));

const gold = () => page.evaluate(() => window.__oprnDebug.readState().gold);
const focused = () => page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.className);

// 1) 입구 → 구입 목록
await page.keyboard.press("Enter");
await page.waitForSelector('[data-testid="shop-buy-item_potion"]');
await page.screenshot({ path: join(OUT, "n-stock.png") });

// 2) 수량 입력칸에서 Enter → 선택 행 거래 (예전: 죽은 키)
await page.evaluate(() => document.querySelector('[data-testid="shop-quantity-input"]').focus());
const before = await gold();
await page.keyboard.press("Enter");
await page.waitForSelector('[data-testid="shop-haggle-panel"]'); // 흥정 켜짐 → 구매 대신 흥정이 열린다
console.log("enter-on-qty:", JSON.stringify({ goldBefore: before, haggleOpened: true }));
await page.screenshot({ path: join(OUT, "n-haggle-open.png") });

// 3) ←→ 로 제시가 조절 — 재렌더 없이 제자리 갱신 + 커서 유지
const cursorBefore = await page.evaluate(() => document.querySelector(".rm-nav-item.selected")?.dataset.testid);
for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
const offer5 = await page.evaluate(() => ({
  offer: document.querySelector('[data-testid="shop-haggle-offer"]')?.textContent,
  total: document.querySelector('[data-testid="shop-haggle-total"]')?.textContent,
  propose: document.querySelector('[data-testid="shop-haggle-propose"]')?.textContent,
  patience: document.querySelector('[data-testid="shop-haggle-patience-left"]')?.textContent,
  cursor: document.querySelector(".rm-nav-item.selected")?.dataset.testid,
  hints: document.querySelector('[data-testid="shop-key-hints"]')?.textContent,
}));
console.log("after-5-left:", JSON.stringify(offer5), "cursorBefore:", cursorBefore);
await page.screenshot({ path: join(OUT, "n-haggle-minus5.png") });

// 4) ±10 버튼으로 큰 폭 조절 — ↑↓ 로 버튼 이동 후 Enter
await page.keyboard.press("ArrowUp"); // 커서 이동(1D): 제시 → +10
const cursorUp = await focused();
await page.keyboard.press("Enter");   // +10 발동
const afterUp10 = await page.evaluate(() => document.querySelector('[data-testid="shop-haggle-offer"]')?.textContent);
console.log("up10:", JSON.stringify({ cursorUp, offer: afterUp10 }));
await page.screenshot({ path: join(OUT, "n-haggle-up10.png") });

// 5) 제시 → 상인 판정 후에도 커서가 제시 버튼에 남는지
await page.keyboard.press("ArrowUp"); // 다시 제시로 (wrap: -10→제시? 커서가 +10 이면 up → 제시)
// 현재 커서 확인 후 제시 버튼까지 이동
for (let i = 0; i < 4; i++) {
  const c = await page.evaluate(() => document.querySelector(".rm-nav-item.selected")?.dataset.testid);
  if (c === "shop-haggle-propose") break;
  await page.keyboard.press("ArrowDown");
}
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
const afterPropose = await page.evaluate(() => ({
  stillHaggle: Boolean(document.querySelector('[data-testid="shop-haggle-panel"]')),
  cursor: document.querySelector(".rm-nav-item.selected")?.dataset.testid,
  line: document.querySelector(".runtime-shop-haggle .runtime-shop-message")?.textContent,
}));
console.log("after-propose:", JSON.stringify(afterPropose));
await page.screenshot({ path: join(OUT, "n-haggle-counter.png") });

// 6) 흥정 취소 → 목록 복귀
for (let i = 0; i < 4; i++) {
  const c = await page.evaluate(() => document.querySelector(".rm-nav-item.selected")?.dataset.testid);
  if (c === "shop-haggle-cancel") break;
  await page.keyboard.press("ArrowDown");
}
await page.keyboard.press("Enter");
await page.waitForSelector('[data-testid="shop-buy-item_potion"]');
console.log("back-to-items ok");

// 7) 320x240 구매 목록 재확인
await page.setViewportSize({ width: 320, height: 240 });
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, "n-stock-320.png") });
const clip = await page.evaluate(() => {
  const list = document.querySelector(".runtime-shop-item-list")?.getBoundingClientRect();
  const row = document.querySelector(".runtime-shop-item-row.selected")?.getBoundingClientRect();
  const footer = document.querySelector(".runtime-shop-prompt-panel")?.getBoundingClientRect();
  return { listBottom: list?.bottom, rowBottom: row?.bottom, footerY: footer?.y };
});
console.log("320x240 geometry:", JSON.stringify(clip));

await browser.close();
await server.close();
console.log("DONE");
