/**
 * 조수 UI/UX 개편(방향 G) — 구현 후 캡처. 실제 에디터에 작업 띠 카드 3장을 심고 세 상태를 찍는다.
 * 사용: BASE=http://127.0.0.1:9177 node docs/2026-09-17-assistant-uiux-proposal-assets/capture-impl.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9177";
const OUT = join(process.cwd(), "docs", "2026-09-17-assistant-uiux-proposal-assets", process.env.OUT_DIR ?? "impl");
mkdirSync(OUT, { recursive: true });

async function boot(page) {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.removeItem("oprn:ai-panel-collapsed");
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 4_000 }).catch(() => false)) await guest.click();
    const ok = await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
    if (ok) break;
    console.log("boot retry", attempt + 1);
  }
  for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 20_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(1200);
}

/** 대화 창에는 말풍선만, 띠에는 카드 3장(완료 2 · 진행 1)을 심는다. */
async function seed(page) {
  return await page.evaluate(async () => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const { store } = await load("/src/project/store.ts");
    const strip = await load("/src/editor/panels/aiWorkStrip.ts");
    const renderers = await load("/src/editor/panels/aiChatRenderers.ts");
    const conv = await load("/src/editor/panels/aiConversationLog.ts");

    const log = document.querySelector(".ai-chat-log");
    if (log) {
      const host = conv.createConversationLogHost({ log, removeStartScreen: () => undefined });
      document.querySelector(".ai-start-screen")?.remove();
      host.appendBubble("user", "시장 광장 북쪽에 우물 하나 놓고, 상인 두 명 세워줘");
      host.appendBubble("assistant", "우물은 돌길과 맞닿게 두었고, 상인 **하나**·**두리**는 마주보게 세웠습니다.\n\n다음으로 두리에게 상점 창을 붙일까요?");
      host.appendBubble("user", "두리는 무기 상인으로, 검·방패만 팔게 해줘");
      host.appendBubble("assistant", "상점 창을 붙이고 있습니다.");
    }

    const before = store.getCurrent();
    const mapId = before.startMapId;
    const map = before.maps[mapId];
    const paint = (x0, y0, w, h, tile) => {
      const after = structuredClone(before);
      const target = after.maps[mapId];
      for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) target.lowerTiles[y * map.width + x] = tile;
      return after;
    };
    const counts = new Map();
    for (const tile of map.lowerTiles) if (tile > 0) counts.set(tile, (counts.get(tile) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tile]) => tile);
    const tileA = ranked[1] ?? ranked[0];
    const tileB = ranked[2] ?? ranked[0];

    const step = (name, summary) => renderers.renderToolActivityEntry(name, { ok: true, summary });

    const one = strip.beginAiWorkCard({ title: "남쪽 돌길 정리" });
    one.appendStep(step("paint_road", "돌길 41칸"));
    one.attachChange({ before, after: paint(8, 30, 14, 3, tileA), mapId, title: "남쪽 돌길 정리", chips: ["타일 41"], onUndo: () => {} });
    one.finish({ ok: true });

    const two = strip.beginAiWorkCard({ title: "광장 북쪽 우물 1 · 상인 2" });
    two.appendStep(step("stamp_structure", "우물 1 (24,11)"));
    two.appendStep(step("place_npc", "상인 「하나」 (22,14)"));
    two.appendStep(step("place_npc", "상인 「두리」 (27,14)"));
    two.attachChange({ before, after: paint(22, 10, 6, 5, tileB), mapId, title: "광장 북쪽 우물 1 · 상인 2", chips: ["타일 9", "이벤트 +2"], onUndo: () => {} });
    two.finish({ ok: true });

    const three = strip.beginAiWorkCard({ title: "두리 무기점 상점 창 붙이기", onStop: () => {} });
    three.noteReadOnly();
    three.appendStep(step("configure_shop", "상점 창 · 검 2 · 방패 1"));
    const live = document.createElement("div");
    live.className = "ai-activity-live";
    live.dataset.testid = "ai-activity-live";
    live.innerHTML = '<span class="ai-activity-live-spinner ai-deck-spin" aria-hidden="true"></span><span class="ai-activity-live-line">상점 창을 붙이는 중</span>';
    three.live.replaceChildren(live);
    return { cards: strip.aiWorkCardCount() };
  });
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await boot(page);
  console.log("seed", await seed(page));
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "1-strip-chat-open.png") });

  const cards = page.getByTestId("ai-work-card");
  await cards.nth(1).locator(".ai-work-card-body").click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "2-strip-card-open.png") });
  const strip = page.getByTestId("ai-work-strip");
  await strip.screenshot({ path: join(OUT, "2b-strip-card-open-crop.png") });

  await cards.nth(1).locator(".ai-work-card-body").click();
  const collapse = page.getByTestId("ai-collapse");
  if (await collapse.isVisible().catch(() => false)) await collapse.click();
  else await page.locator('[data-testid="ai-panel"] [aria-label="AI 패널 접기"]').first().click().catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "3-strip-chat-collapsed.png") });

  await page.getByTestId("ai-work-strip-toggle").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "4-strip-folded.png") });

  // 좌측 도구막대 끝의 ⋯ (검사·기록) — 사이드바 아래 줄에서 옮긴 자리.
  const toolbar = page.getByTestId("oprn-tile-toolbar").first();
  await toolbar.screenshot({ path: join(OUT, "5-toolbar-overflow.png") }).catch((e) => console.log("toolbar shot fail", e.message));
  await page.getByTestId("oprn-tool-overflow").first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "6-toolbar-overflow-open.png"), clip: { x: 0, y: 0, width: 620, height: 560 } });
  console.log("done", OUT);
} finally {
  await browser.close();
}
