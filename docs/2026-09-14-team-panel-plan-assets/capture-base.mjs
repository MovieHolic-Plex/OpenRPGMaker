/**
 * 「제안」 합성용 바탕 캡처 — 실제 편집기에서 팀 막대만 숨긴 조수 데크(대화 열림 · 보드 카드 있음).
 * 사용: BASE=http://127.0.0.1:9831 node docs/2026-09-14-team-panel-plan-assets/capture-base.mjs
 * 출력: docs/2026-09-14-team-panel-plan-assets/base/<w>x<h>-*.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://127.0.0.1:9831";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "base");
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
  }
  for (const testid of ["standard-welcome-start", "editor-welcome-close", "editor-welcome-dismiss", "coachmark-done"]) {
    const btn = page.getByTestId(testid);
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
  await page.getByTestId("ai-panel").waitFor({ state: "attached", timeout: 20_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.waitForTimeout(1000);
}

async function seedConversation(page) {
  await page.evaluate(async () => {
    const load = async (url) => await import(/* @vite-ignore */ url);
    const { store } = await load("/src/project/store.ts");
    const { conversationScopeKey } = await load("/src/ai/conversationStore.ts");
    const contextKey = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    const record = {
      id: "team-plan-fixture", title: "대장간 거리", model: "fixture", savedAt: Date.now(), projectContextKey: contextKey,
      entries: [
        { kind: "user", text: "마을 북쪽에 대장간 거리를 만들고 남쪽 숲길을 정비해줘" },
        { kind: "assistant", text: "팀으로 나눠 맡깁니다 — 건축가가 대장간 거리, 정원사가 숲길. 진행은 팀 패널에서 봅니다." },
      ],
    };
    localStorage.setItem("oprn:ai-conversations", JSON.stringify([record]));
  });
  // Vite dep 최적화가 첫 dynamic import 뒤 전체 리로드를 걸 수 있다 — 한 번 재시도한다.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByTestId("ai-open-conversations").click().catch(() => {});
    const ok = await page.getByTestId("ai-history-row").first().waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false);
    if (ok) break;
    console.log("history retry", attempt + 1);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1500);
  }
  await page.getByTestId("ai-history-open").first().click();
  await page.getByTestId("ai-command-row-user").first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
for (const vp of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await boot(page);
  await page.addStyleTag({ content: ".ai-team-panel{display:none !important}" });
  // A. 유휴 캡슐 (막대 없음)
  await page.screenshot({ path: join(OUT, `${vp.width}x${vp.height}-idle.png`) });
  // B. 포커스 — 데크가 열린 폭으로 커진다 (대화 시드 없이도 바탕으로 충분).
  await page.getByTestId("ai-input").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${vp.width}x${vp.height}-conversation.png`) });
  const deck = await page.getByTestId("ai-deck").boundingBox();
  writeFileSync(join(OUT, `deck-${vp.width}.json`), JSON.stringify(deck));
  console.log(vp.width, "deck", JSON.stringify(deck));
  await context.close();
}
await browser.close();
console.log("done");
