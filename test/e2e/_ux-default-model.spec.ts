// 진단 스펙 — 새로 부팅한 에디터의 AI 설정에서 강제 기본 모델이 실제로 선택돼 있는지 확인한다.
// 실행: DEV_SERVER_PORT=9816 npx playwright test test/e2e/_ux-default-model.spec.ts --project=chromium
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "verify-shots/ai-assistant-ux/probe-model";
mkdirSync(OUT, { recursive: true });
const FORCED = "gemini-3.7-flash-high";

test("default model: 새 부팅에서 두 모델 슬롯이 강제 기본값이다", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
  await page.waitForTimeout(700);

  // 저장된 설정이 없는 새 부팅 상태의 실제 config.
  const bootConfig = await page.evaluate(() => {
    const raw = localStorage.getItem("oprn:ai-config");
    return { stored: raw, parsed: raw ? JSON.parse(raw) : null };
  });

  // AI 설정 모달은 **앱 헤더가 단독 소유**한다(aiChatPanel.ts: "AI 설정은 앱 헤더가 단독 소유한다").
  // 조수 패널의 옛 ai-settings-toggle 훅은 없다.
  await page.getByTestId("topbar-ai-settings").click();
  await expect(page.getByTestId("ai-settings-modal")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(600)

  const fields = await page.evaluate(() => {
    const val = (sel: string): string | null =>
      (document.querySelector(sel) as HTMLInputElement | null)?.value ?? null;
    const opts = (sel: string): string[] =>
      Array.from(document.querySelectorAll(`${sel} option`)).map((o) => (o as HTMLOptionElement).value);
    return {
      model: val("[data-testid='ai-config-model']"),
      liteModel: val("[data-testid='ai-config-lite-model']"),
      modelPresetOptions: opts("[data-testid='ai-config-model-preset']").slice(0, 6),
    };
  });

  // 제공자 축도 Antigravity 하나로 잠겼는지 실제 화면에서 본다.
  const provider = await page.evaluate(() => {
    const select = document.querySelector("[data-testid='ai-oh-my-pi-provider']") as HTMLSelectElement | null;
    return {
      options: Array.from(select?.options ?? []).map((o) => o.value),
      value: select?.value ?? null,
      disabled: select?.disabled ?? null,
      chatgptQuickCard: document.querySelectorAll("[data-testid='ai-auth-quick-openai-codex']").length,
      geminiQuickCard: document.querySelectorAll("[data-testid='ai-auth-quick-google-antigravity']").length,
      storedProvider: JSON.parse(localStorage.getItem("oprn:ai-config") ?? "{}").providerId ?? null,
    };
  });
  console.log(`PROVIDER ${JSON.stringify(provider)}`);

  writeFileSync(`${OUT}/default-model-report.json`, JSON.stringify({ bootConfig, fields, provider, FORCED }, null, 2), "utf8");
  await page.screenshot({ path: `${OUT}/40-settings-default-model.png` });
  console.log(`REPORT ${JSON.stringify({ fields, FORCED })}`);

  expect(fields.model).toBe(FORCED);
  expect(fields.liteModel).toBe(FORCED);
  expect(fields.modelPresetOptions).toContain(FORCED);
});
