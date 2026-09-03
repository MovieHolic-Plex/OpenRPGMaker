/**
 * AI 조수 현재 UI 실측 캡처 — 개편 제안서(docs/2026-09-03-ai-assistant-modern-ui-proposal.html) 의 「지금」 증거.
 * 사용: BASE=http://127.0.0.1:<내 포트> node scripts/capture-ai-assistant-current.mjs
 * 출력: docs/2026-09-03-ai-assistant-modern-ui-assets/current/*.png + manifest.json
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9861";
const OUT = join(process.cwd(), "docs", "2026-09-03-ai-assistant-modern-ui-assets", "current");
mkdirSync(OUT, { recursive: true });
const manifest = [];

async function snap(page, name, caption, locator) {
  const path = join(OUT, `${name}.png`);
  if (locator) await locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: false });
  const box = locator ? await locator.boundingBox() : null;
  manifest.push({ file: `${name}.png`, caption, box });
  console.log("shot", name, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "");
}

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

async function seedConversation(page) {
  return await page.evaluate(async () => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const { store } = await load("/src/project/store.ts");
    const { conversationScopeKey } = await load("/src/ai/conversationStore.ts");
    const contextKey = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    const record = {
      id: "proposal-fixture",
      title: "시장 광장 손보기",
      model: "fixture",
      savedAt: Date.now(),
      projectContextKey: contextKey,
      entries: [
        { kind: "user", text: "시장 광장 북쪽에 우물을 하나 놓고, 상인 두 명을 광장 주변에 세워줘" },
        { kind: "tool", name: "get_map_info", args: {}, ok: true, summary: "시장 마을 60×45 · 이벤트 18 · 바닥 잔디/돌길" },
        { kind: "tool", name: "find_open_area", args: { near: "plaza" }, ok: true, summary: "광장 북쪽 3×3 빈 자리 (24,11)" },
        { kind: "tool", name: "place_structure", args: { kind: "well" }, ok: true, summary: "우물 1 · 타일 9칸" },
        { kind: "tool", name: "place_npc", args: { role: "merchant" }, ok: true, summary: "상인 「하나」 (22,14) · 상인 「두리」 (27,15)" },
        { kind: "assistant", text: "광장 북쪽 **(24,11)** 에 우물을 놓고, 상인 **하나**와 **두리**를 광장 양쪽에 세웠습니다.\n\n- 우물은 돌길과 맞닿게 두어 동선이 끊기지 않습니다.\n- 상인 둘은 서로 마주보는 방향으로 두었습니다.\n\n다음으로 상점 창(물건 목록)을 붙일까요?" },
        { kind: "user", text: "두리는 무기 상인으로 하고 검·방패만 팔게 해줘" },
        { kind: "tool", name: "configure_shop", args: { npc: "두리" }, ok: true, summary: "상점 「두리의 무기점」 · 품목 2 (동검, 나무 방패)" },
        { kind: "assistant", text: "「두리」에게 무기점 상점 창을 붙였습니다. 품목은 **동검**(120G)·**나무 방패**(80G) 둘입니다. 가격은 DB 기본값을 썼으니 바꾸려면 말씀해 주세요." },
      ],
    };
    localStorage.setItem("oprn:ai-conversations", JSON.stringify([record]));
    return contextKey;
  });
}

async function mountChangeCard(page) {
  return await page.evaluate(async () => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const [{ store }, preview] = await Promise.all([load("/src/project/store.ts"), load("/src/editor/panels/aiChangePreview.ts")]);
    const before = store.getCurrent();
    const mapId = before.startMapId ?? Object.keys(before.maps)[0];
    const map = before.maps[mapId];
    if (!map) return "no map";
    const counts = new Map();
    for (const t of map.lowerTiles) if (t > 0) counts.set(t, (counts.get(t) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const rectW = Math.min(8, map.width), rectH = Math.min(6, map.height);
    const x0 = Math.floor((map.width - rectW) / 2), y0 = Math.floor((map.height - rectH) / 2);
    const centerTile = map.lowerTiles[y0 * map.width + x0];
    const paint = ranked.find((t) => t !== centerTile) ?? ranked[0];
    const after = structuredClone(before);
    for (let y = y0; y < y0 + rectH; y++) for (let x = x0; x < x0 + rectW; x++) after.maps[mapId].lowerTiles[y * map.width + x] = paint;
    const card = preview.renderChangePreviewCard({
      before, after, mapId,
      title: "우물 1 · 상인 2 · 바닥 9칸",
      detail: "place_structure · place_npc",
      chips: preview.changePreviewChips({ tilesChanged: 9, eventsAdded: 2, eventsModified: 0, eventsRemoved: 0, mapsAdded: 0, mapsRemoved: 0, dbRecordsChanged: 1, tilesetsChanged: 0, switchesAdded: 0, variablesAdded: 0, worldEntitiesAdded: 0, worldEntitiesModified: 0, palettePresetsAdded: 0, palettePresetsModified: 0, endingsChanged: 0, sessionChanged: false, systemChanged: false, warnings: [] }),
      onUndo: () => {},
    });
    const log = [...document.querySelectorAll(".ai-chat-log")].find((n) => n.getClientRects().length > 0) ?? document.querySelector(".ai-chat-log");
    if (!log) return "no log";
    log.append(card);
    card.scrollIntoView();
    return "ok";
  });
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("dialog", (d) => d.accept());

// ── 1. 빈 유휴 캡슐
await boot(page);
const panel = page.getByTestId("ai-panel");
const bar = page.getByTestId("ai-command-bar");
await snap(page, "01-idle-shell", "빈 대화 · 유휴 캡슐 (1440×900 전체)");
await snap(page, "02-idle-capsule", "유휴 캡슐 크롭", bar);

// ── 2. 포커스 → 추천 팝오버
await page.getByTestId("ai-input").click();
await page.waitForTimeout(500);
await snap(page, "03-focused-suggest", "입력 포커스 · 추천 팝오버(감독 칩 + 다음 할 일)");
const suggest = page.getByTestId("ai-suggest-popover");
if (await suggest.isVisible().catch(() => false)) await snap(page, "04-suggest-popover", "추천 팝오버 크롭", panel);

// ── 3. ☰ 메뉴 · 성향 · 맥락 게이지
await page.getByTestId("ai-command-menu-toggle").click();
await page.waitForTimeout(300);
await snap(page, "05-menu", "☰ 더보기 메뉴", panel);
const pref = page.getByTestId("ai-preference-toggle");
if (await pref.isVisible().catch(() => false)) { await pref.click(); await page.waitForTimeout(300); await snap(page, "06-preference", "⌾ 성향 팝오버", panel); }
const meter = page.locator('[data-testid="ai-context-meter"], .ai-context-meter-btn').first();
if (await meter.isVisible().catch(() => false)) { await meter.click(); await page.waitForTimeout(300); await snap(page, "07-context-meter", "맥락 게이지 팝오버", panel); }
await page.keyboard.press("Escape");

// ── 4. 설정 · 툴 브라우저 · 전체 기록 (☰ 항목)
async function openMenuItem(label) {
  await page.getByTestId("ai-command-menu-toggle").click();
  await page.waitForTimeout(250);
  const item = page.getByTestId("ai-command-menu").getByText(label, { exact: false }).first();
  if (!(await item.isVisible().catch(() => false))) { console.log("menu item absent", label); await page.keyboard.press("Escape"); return false; }
  await item.click();
  await page.waitForTimeout(700);
  return true;
}
if (await openMenuItem("설정")) { await snap(page, "08-settings", "⚙ 설정 모달"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
if (await openMenuItem("툴 브라우저")) { await snap(page, "09-tools-browser", "툴 브라우저 모달"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
if (await openMenuItem("감독 지침")) { await snap(page, "10-instructions", "감독 지침 모달"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }

// ── 5. 이전 대화 모달
const conv = page.getByTestId("ai-open-conversations");
if (await conv.isVisible().catch(() => false)) { await conv.click(); await page.waitForTimeout(600); await snap(page, "11-history-modal", "🕒 이전 대화 모달"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }

// ── 6. 접힘
await page.getByTestId("ai-collapse").click();
await page.waitForTimeout(500);
await snap(page, "12-collapsed", "접힘 상태 · 복귀 알약");
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) await snap(page, "13-collapsed-pill", "복귀 알약 크롭", restore);

// ── 7. 대화가 있는 상태 — devProject 는 부팅마다 맵 id 가 새로 나와 스코프 키가 달라지므로
//       재부팅 복원 대신 같은 페이지에서 시드 → 🕒 이전 대화 → 「열기」 로 이어받는다.
{ const r = page.getByTestId("ai-collapsed-restore"); if (await r.isVisible().catch(() => false)) { await r.click(); await page.waitForTimeout(500); } }
await seedConversation(page);
await page.getByTestId("ai-open-conversations").click();
await page.getByTestId("ai-history-row").first().waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(300);
await snap(page, "11b-history-modal-with-record", "🕒 이전 대화 모달 — 저장된 대화 1건");
await page.getByTestId("ai-history-open").first().click();
await page.getByTestId("ai-command-row-user").first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => console.log("no user row"));
await page.waitForTimeout(800);
await snap(page, "14-conversation-shell", "이어받은 대화 · 로그 카드 열림 (전체)");
await snap(page, "15-conversation-panel", "대화 패널 크롭", panel);
const toolToggle = page.getByTestId("ai-tool-activity-toggle").first();
if (await toolToggle.isVisible().catch(() => false)) { await toolToggle.click(); await page.waitForTimeout(300); await snap(page, "16-tool-activity-open", "툴 호출 펼침", panel); }

// ── 8. 변경 카드(실제 렌더러)
const mounted = await mountChangeCard(page);
console.log("change card", mounted);
await page.waitForTimeout(800);
await snap(page, "17-change-card", "변경 카드(before/after) 마운트", panel);
const card = page.getByTestId("ai-change-card");
if (await card.isVisible().catch(() => false)) await snap(page, "18-change-card-crop", "변경 카드 크롭", card);

// ── 9. 턴 진행 시뮬레이션 (클래스 토글 — 실제 LLM 없음)
await page.evaluate(() => {
  const p = document.querySelector('[data-testid="ai-panel"]');
  p?.classList.add("is-turn-running");
  const s = document.querySelector('[data-testid="ai-status"]');
  if (s) s.textContent = "place_npc 실행 중…";
});
await page.waitForTimeout(300);
await snap(page, "19-turn-running-sim", "턴 진행 상태(클래스 토글 시뮬레이션)", panel);
await page.evaluate(() => document.querySelector('[data-testid="ai-panel"]')?.classList.remove("is-turn-running"));

// ── 10. 좁은 폭 1280×800
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(600);
await snap(page, "20-conversation-1280", "1280×800 · 대화 상태");

// ── 11. AI 스튜디오
await page.setViewportSize({ width: 1440, height: 900 });
const studio = page.getByTestId("topbar-ai-studio");
if (await studio.isVisible().catch(() => false)) {
  await studio.click();
  await page.getByTestId("ai-studio-shell").waitFor({ state: "visible", timeout: 10_000 }).catch(() => console.log("no studio shell"));
  await page.waitForTimeout(1200);
  await snap(page, "21-studio", "AI 스튜디오(장면 콘솔) 전체");
}

writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), shots: manifest }, null, 2));
await browser.close();
console.log("done", manifest.length);
