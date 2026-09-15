/**
 * DB AI 검토 오버레이 QA — 실제 편집기의 데이터베이스 창 안에서 오버레이를 띄우고
 * 레코드 카드 · 이동 · 적용 · 버리기를 눌러 본다.
 *
 * 모델은 부르지 않는다: `createDatabaseAiBar` 를 페이지 안에서 다시 마운트하되 `send` 만
 * 모킹해 브리지가 돌려줄 초안(before/after 프로젝트)을 손으로 만든다. 카드 렌더·CSS·이동·
 * 적용 경로(store.replace)는 전부 실제 코드다.
 *
 * 사용: QA_BASE_URL=http://127.0.0.1:<워크트리 포트> node scripts/qa/db-ai-review.mjs
 * 출력: .omo/evidence/db-ai-review/*.png (추적되는 증거 경로)
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:9835";
const OUT = process.env.OUT_DIR ?? join(process.cwd(), ".omo", "evidence", "db-ai-review");
mkdirSync(OUT, { recursive: true });

const shots = [];
async function snap(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  shots.push(path);
  console.log("shot", name);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (error) => console.log("[pageerror]", String(error).slice(0, 300)));
page.on("console", (message) => {
  if (message.type() === "error") console.log("[console.error]", message.text().slice(0, 200));
});

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
});
await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: 60_000 });
for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
  const button = page.getByTestId(testid);
  if (await button.isVisible().catch(() => false)) await button.click().catch(() => {});
}

await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 20_000 });
// 레일의 몬스터 그룹은 접혀 있을 수 있다 — 탭 전환은 클릭이 아니라 세션 API 로 건다.
await page.evaluate(async () => {
  const { switchDatabaseActiveTab } = await import(/* @vite-ignore */ "/src/editor/panels/database.ts");
  switchDatabaseActiveTab("enemies", document.querySelector(".database-modal-body"));
});
await page.waitForTimeout(900);
await snap(page, "01-database-enemies");

// 실제 오버레이를 모킹한 send 로 다시 마운트한다. 헤더의 원래 토글은 숨기고 새 토글을 그 자리에 둔다.
const mounted = await page.evaluate(async () => {
  const load = async (url) => await import(/* @vite-ignore */ url);
  const { createDatabaseAiBar } = await load("/src/editor/panels/databaseAiBar.ts");
  const { store } = await load("/src/project/store.ts");
  const { setDatabaseActiveTab, switchDatabaseActiveTab, getDatabaseActiveTab, refreshDatabasePanel } = await load("/src/editor/panels/database.ts");
  const { setSelectedRecordId } = await load("/src/editor/panels/databaseRecordViewSession.ts");
  // 진짜 경로(applyProposedProject)는 커밋 게이트·세션이 필요하다. 저장소가 가진 「검증된 초안 커밋」
  // 헬퍼로 바꿔 넣는다 — store.replace 와 undo 스냅샷을 둘 다 남기므로 되돌리기 라벨이 생긴다.
  const { applyProjectWithHistory } = await load("/src/editor/mapEditHistory.ts");

  const window_ = document.querySelector(".database-modal-window");
  const header = window_.querySelector(".database-modal-header");
  const body = window_.querySelector(".database-modal-body");
  const oldBar = window_.querySelector("[data-testid='database-ai-bar']");
  const oldToggle = header.querySelector("[data-testid='database-ai-toggle']");
  oldBar?.remove();
  oldToggle?.remove();

  const before = structuredClone(store.getCurrent());
  const after = structuredClone(before);
  const enemies = after.database.enemies;
  const target = enemies[0];
  const second = enemies[1];
  target.stats = { ...target.stats, maxHp: 300, attack: 28 };
  target.rewards = { ...target.rewards, exp: 40, dropItemId: after.database.items[0]?.id, dropRatePercent: 5 };
  if (second) second.monsterResourceId = "generated-enemy-bat-01";
  after.database.items = [
    ...after.database.items,
    { ...after.database.items[0], id: "item_qa_sword", name: "동검", price: 120, description: "AI 가 만든 시험용 무기" },
  ];

  const handle = createDatabaseAiBar({
    context: () => ({ tab: getDatabaseActiveTab(), record: { name: target.name, id: target.id } }),
    deps: {
      send: async () => ({
        ok: true,
        status: { ready: true, turnBusy: false, configReady: true, lastStatus: "대기", bridgeConnected: false, panelMounted: true },
        audit: [
          { kind: "tool", name: "get_database_records", mode: "read", ok: true, summary: "몬스터 조회" },
          { kind: "tool", name: "tune_enemy", mode: "write", ok: true, summary: `${target.name} · HP/공격/경험치` },
          { kind: "tool", name: "upsert_item", mode: "write", ok: true, summary: "동검 추가" },
        ],
        harness: null,
        lastAssistantText: `${target.name}를 중반 파티 기준으로 올리고, 드롭용 **동검**을 새로 만들었습니다.`,
        pendingProposal: { callCount: 3, summary: "tune_enemy · upsert_item", before, after },
      }),
      status: () => ({ ready: true, turnBusy: false, configReady: true, lastStatus: "대기", bridgeConnected: false, panelMounted: true }),
      audit: () => [],
      apply: async () => {
        applyProjectWithHistory(after, "AI 검토 적용(QA)");
        refreshDatabasePanel(body);
        return null;
      },
      discard: () => undefined,
      navigate: (collection, recordId) => {
        setSelectedRecordId(collection, recordId, { reveal: true });
        switchDatabaseActiveTab(collection, body);
        refreshDatabasePanel(body);
      },
    },
  });
  header.append(handle.toggle);
  header.after(handle.element);
  setDatabaseActiveTab(getDatabaseActiveTab());
  window.__qaDbAi = { handle, targetName: target.name, beforeHp: before.database.enemies[0].stats.maxHp };
  return { target: target.name, beforeHp: before.database.enemies[0].stats.maxHp };
});
console.log("mounted for", JSON.stringify(mounted));

await page.getByTestId("database-ai-toggle").click();
await page.getByTestId("database-ai-bar").waitFor({ state: "visible" });
await page.waitForTimeout(400);
await snap(page, "02-overlay-input");

await page.getByTestId("database-ai-input").fill("몬스터들을 중반 난이도에 맞춰 조정하고 보상도 손봐줘");
await page.getByTestId("database-ai-run").click();
await page.locator("[data-testid='database-ai-card']").first().waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(500);
await snap(page, "03-review-cards");

const geometry = await page.evaluate(() => {
  const box = (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), h: Math.round(rect.height), overflow: style.overflow, pos: style.position, z: style.zIndex };
  };
  const apply = document.querySelector("[data-testid='database-ai-turn-apply']");
  const rect = apply?.getBoundingClientRect();
  const atPoint = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
  return {
    viewport: window.innerHeight,
    window_: box(".database-modal-window"),
    footer: box(".database-modal-footer"),
    overlay: box("[data-testid='database-ai-bar']"),
    panel: box("[data-testid='database-ai-panel']"),
    turn: box("[data-testid='database-ai-turn']"),
    host: box("[data-testid='database-ai-cards-host']"),
    actions: box(".database-ai-turn-actions"),
    applyBox: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : null,
    // 적용 단추 한가운데를 실제로 무엇이 덮고 있나 — 가려짐의 유일한 증거.
    applyHitTarget: atPoint ? `${atPoint.tagName.toLowerCase()}.${String(atPoint.className).slice(0, 50)}` : null,
  };
});
console.log("GEOMETRY", JSON.stringify(geometry, null, 1));

const reviewFacts = await page.evaluate(() => {
  const status = document.querySelector("[data-testid='database-ai-turn-status']");
  const cards = [...document.querySelectorAll("[data-testid='database-ai-card']")].map((card) => ({
    id: card.dataset.recordId,
    change: card.dataset.change,
    name: card.querySelector(".database-ai-card-name")?.textContent,
    hasThumb: Boolean(card.querySelector(".database-ai-card-thumb img")),
    gfxPair: card.querySelectorAll(".database-ai-card-gfx-cell").length,
    fields: [...card.querySelectorAll(".database-ai-card-field")].map((row) => row.textContent.replace(/\s+/gu, " ").trim()),
  }));
  return { phase: status?.dataset.phase, statusText: status?.textContent, cards };
});
console.log("REVIEW", JSON.stringify(reviewFacts, null, 1));

// 「이동 →」 — 오버레이가 접히고 뒤 레코드 뷰가 그 레코드로 간다.
await page.locator("[data-testid='database-ai-card-goto']").first().click();
await page.waitForTimeout(700);
await snap(page, "04-navigated");

await page.getByTestId("database-ai-toggle").click();
await page.waitForTimeout(400);
const stillPending = await page.locator("[data-testid='database-ai-card']").count();
console.log("cards after reopen:", stillPending);

const beforeApply = await page.evaluate(async () => {
  const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
  return store.getCurrent().database.enemies[0].stats.maxHp;
});
await page.getByTestId("database-ai-turn-apply").click();
await page.waitForTimeout(900);
await snap(page, "05-applied");
const afterApply = await page.evaluate(async () => {
  const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
  const status = document.querySelector("[data-testid='database-ai-turn-status']");
  return { hp: store.getCurrent().database.enemies[0].stats.maxHp, phase: status?.dataset.phase, statusText: status?.textContent };
});
console.log("APPLY", JSON.stringify({ beforeApply, ...afterApply }));

const undoState = await page.evaluate(() => {
  const undo = document.querySelector("[data-testid='database-ai-turn-undo']");
  return { hidden: undo?.hidden ?? null, label: undo?.textContent?.trim() ?? null };
});
console.log("UNDO", JSON.stringify(undoState));

// 버리기 경로 — 두 번째 턴을 돌려 검토까지 간 뒤 버린다.
await page.getByTestId("database-ai-turn-clear").click();
await page.getByTestId("database-ai-input").fill("한 번 더 손봐줘");
await page.getByTestId("database-ai-run").click();
await page.locator("[data-testid='database-ai-card']").first().waitFor({ state: "visible", timeout: 10_000 });
await page.getByTestId("database-ai-turn-discard").click();
await page.waitForTimeout(500);
await snap(page, "06-discarded");
const discarded = await page.evaluate(() => {
  const status = document.querySelector("[data-testid='database-ai-turn-status']");
  return { cards: document.querySelectorAll("[data-testid='database-ai-card']").length, statusText: status?.textContent };
});
console.log("DISCARD", JSON.stringify(discarded));

// 좁은 창(1024×768)에서도 결정 단추가 보이는지.
await page.setViewportSize({ width: 1024, height: 768 });
await page.getByTestId("database-ai-input").fill("좁은 창 확인");
await page.getByTestId("database-ai-run").click();
await page.locator("[data-testid='database-ai-card']").first().waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(400);
await snap(page, "07-narrow-1024");
const narrow = await page.evaluate(() => {
  const apply = document.querySelector("[data-testid='database-ai-turn-apply']");
  const panel = document.querySelector("[data-testid='database-ai-panel']");
  const box = apply?.getBoundingClientRect();
  const panelBox = panel?.getBoundingClientRect();
  return {
    applyVisible: Boolean(box && box.height > 0 && box.bottom <= window.innerHeight),
    applyBottom: Math.round(box?.bottom ?? -1),
    panelBottom: Math.round(panelBox?.bottom ?? -1),
    viewport: window.innerHeight,
  };
});
console.log("NARROW", JSON.stringify(narrow));

await browser.close();
console.log(JSON.stringify(shots, null, 1));
