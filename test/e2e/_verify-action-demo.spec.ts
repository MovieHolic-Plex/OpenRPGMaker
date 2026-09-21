// 임시 검증 스펙 — LegacyDb 에 저장한 rpg-zzu-action-demo 가 실제로 로드되고
// 테스트 플레이에서 필드 스폰이 나오는지 확인한다. 확인 후 삭제한다.
import { expect, test } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

test("action demo loads from legacyDb and spawns field enemies", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?project=rpg-zzu-action-demo");

  // 에디터 부팅 대기
  await page.waitForTimeout(6000);
  await page.screenshot({ path: testInfo.outputPath("01-editor.png"), fullPage: false });

  // 어떤 프로젝트가 로드됐는지 런타임에서 직접 확인
  const loaded = await page.evaluate(() => {
    const w = window as unknown as { __oprnStore?: { getCurrent: () => unknown } };
    const project = w.__oprnStore?.getCurrent() as
      | { meta?: { title?: string }; startMapId?: string; maps?: Record<string, { name?: string; actionCombat?: boolean; fieldSpawns?: unknown[]; lowerTiles?: number[] }>; system?: { actionCombat?: { enabled?: boolean } } }
      | undefined;
    if (!project) return { ok: false as const, reason: "store 미노출" };
    const map = project.maps?.[project.startMapId ?? ""];
    return {
      ok: true as const,
      title: project.meta?.title,
      mapName: map?.name,
      mapActionCombat: map?.actionCombat,
      systemActionCombat: project.system?.actionCombat?.enabled,
      fieldSpawns: map?.fieldSpawns?.length ?? 0,
      distinctTiles: [...new Set(map?.lowerTiles ?? [])].length,
    };
  });
  console.log("LOADED_PROJECT", JSON.stringify(loaded));

  // 테스트 플레이 진입
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 25_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: testInfo.outputPath("02-play-title.png") });

  await startNewGameFromTitle(page);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: testInfo.outputPath("03-play-field.png") });

  const actionState = await page.evaluate(() => {
    const node = document.querySelector("[data-testid='runtime-state-json']");
    return node ? String(node.textContent).slice(0, 600) : null;
  });
  console.log("ACTION_STATE", JSON.stringify(actionState).slice(0, 400));
  console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors.slice(0, 5)));
});
