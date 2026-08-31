// 진단 스펙 — 컴포저 액션 행의 "되돌리기" 버튼을 실제 브라우저에서 찍는다.
// 걷어낸 `ai-completion-strip`(맵 위 fixed 밴드) 자리에 들어온 표면이라, 팔레트가 행의 다른
// 버튼과 맞는지 · 바 높이를 늘리지 않는지 · 되돌린 뒤 사라지는지를 눈으로 확인한다.
// 실행: DEV_SERVER_PORT=9411 npx playwright test test/e2e/_composer-undo-shot.spec.ts --project=chromium
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/composer-undo";
mkdirSync(OUT, { recursive: true });

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
}

test("composer undo: 적용 직후 등장 → 되돌린 뒤 소멸", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);

  const bar = page.getByTestId("ai-command-bar");
  await expect(bar).toBeVisible({ timeout: 30_000 });
  const undo = page.getByTestId("ai-composer-undo");
  const barBox = async (): Promise<number> => (await bar.boundingBox())?.height ?? -1;

  const idleHeight = await barBox();
  await page.screenshot({ path: `${OUT}/10-idle-full.png` });
  await bar.screenshot({ path: `${OUT}/11-idle-bar.png` });
  const idleVisible = await undo.isVisible().catch(() => false);

  // AI 적용을 실제 스토어 경로로 발행한다(모델 호출 없이 표면만).
  await page.evaluate(async () => {
    const history = await import("/src/editor/mapEditHistory.ts");
    const completion = await import("/src/editor/aiApplyCompletion.ts");
    const storeMod = await import("/src/project/store.ts");
    const project = storeMod.store.getCurrent();
    history.recordProjectSnapshot("AI 적용", project.startMapId);
    completion.publishAiApplyCompletion({
      mapId: project.startMapId,
      instruction: "마을 3개, 상점 1개, npc 30명 활발하게 돌아다니고 퀘스트 2개",
      summary: "집 3 · 길 42칸 · NPC 30",
    });
  });
  await page.waitForTimeout(400);

  await expect(undo).toBeVisible({ timeout: 10_000 });
  const appliedHeight = await barBox();
  await page.screenshot({ path: `${OUT}/20-applied-full.png` });
  await bar.screenshot({ path: `${OUT}/21-applied-bar.png` });
  const appliedTitle = await undo.getAttribute("title");

  await undo.click();
  await page.waitForTimeout(500);
  const afterUndoVisible = await undo.isVisible().catch(() => false);
  await bar.screenshot({ path: `${OUT}/31-after-undo-bar.png` });

  const report = { idleVisible, idleHeight, appliedHeight, appliedTitle, afterUndoVisible };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  expect(idleVisible).toBe(false);
  expect(afterUndoVisible).toBe(false);
  // 고정 높이 액션 행 계약: 버튼이 켜져도 바 높이가 변하지 않는다(clearance 재측정 없음).
  expect(appliedHeight).toBe(idleHeight);
});
