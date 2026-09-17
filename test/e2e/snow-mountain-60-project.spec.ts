/**
 * 설산 60×60 을 **새 프로젝트로 깔았을 때** 편집기와 런타임에서 실제로 열리는지 본다.
 *
 * 유닛 검사는 프로젝트 객체만 본다 — 편집기가 그 맵을 그려 주는지, 메뉴 항목이 실제로
 * 붙었는지, 런타임이 시작 위치에서 플레이어를 밀어내지 않는지는 화면에서만 확인된다.
 */
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createSnowMountain60Project } from "@/project/defaults/defaultProject";
import { SNOW_MOUNTAIN_START } from "@/project/defaults/snowMountain60";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

const OUT = "C:/Users/USER/AppData/Local/Temp/claude/C--Users-USER-Downloads-rpg-zzu/ce2327ea-b28d-400e-949d-caef7b21edab/scratchpad/";
const MAP_ID = "map_snow_mountain_60";

test("프로젝트 메뉴 항목이 설산 60×60 을 불러온다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("menu-project").click();
  const entry = page.getByTestId("menu-project-snow-mountain-60");
  await expect(entry, "프로젝트 메뉴에 설산 60×60 항목이 없다").toBeVisible();
  await entry.click();
  // 확인 모달이 **설산 것인지** 확인하고 누른다 — 다른 모달(환영 창 등)의 확인 버튼을
  // 눌러도 클릭 자체는 성공하므로, 제목을 보지 않으면 조용히 엉뚱한 걸 통과시킨다.
  const modal = page.getByTestId("app-confirm-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(modal, "설산 확인 모달이 아니다").toContainText("설산 60×60");
  await modal.getByTestId("app-modal-confirm").click();

  /**
   * **화면**을 본다. 스토어 싱글턴을 `page.evaluate` 안의 `import("/src/project/store.ts")`
   * 로 읽으면 안 된다 — 앱이 쓰는 인스턴스와 **다른 모듈 인스턴스**가 돌아온다.
   * 실측: 메뉴는 정상 동작했는데(상태바·맵 트리·토스트 모두 설산) 그 경로로 읽은
   * `startMapId` 만 계속 `map_blank_start` 였다. 사용자가 보는 것으로 판정한다.
   */
  await expect(page.locator("body"), "편집기가 설산 맵을 열지 않았다")
    .toContainText("맵: 설산 · 절벽 다섯 겹 (60×60)", { timeout: 20_000 });
  await expect(page.locator("body"), "맵 트리에 설산이 없다")
    .toContainText("설산 · 절벽 다섯 겹 (60×60)");
  await expect(page.locator("body"), "불러왔다는 안내가 없다")
    .toContainText("발치(30,57)에서 시작해 계단으로 오릅니다");

  await page.waitForTimeout(600);
  writeFileSync(`${OUT}proj-menu-loaded.png`, await page.screenshot({ fullPage: false }));
});

test("편집기 캔버스가 절벽 다섯 겹을 그린다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createSnowMountain60Project());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  // 60×60 을 한 화면에 최대한 담는다. 줌 버튼은 x1 이 최소다(0.5 는 없다).
  // `timeout` 을 반드시 준다 — playwright 기본 action timeout 은 0(무한)이라
  // 없는 testid 를 클릭하면 `.catch()` 가 걸리지 못하고 테스트가 그대로 굳는다(실측).
  await page.getByTestId("toolbar-zoom-1").click({ force: true, timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  writeFileSync(`${OUT}proj-editor.png`, await page.screenshot({ fullPage: false }));
  writeFileSync(`${OUT}proj-editor-canvas.png`, await page.getByTestId("edit-canvas").screenshot());
});

test("런타임이 산 발치에서 시작하고 플레이어를 밀어내지 않는다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, createSnowMountain60Project());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);

  const runtime = await page.evaluate(() => {
    const node = document.querySelector("[data-testid='runtime-state-json']");
    if (!node?.textContent) return null;
    try {
      return JSON.parse(node.textContent) as { mapId?: string; player?: { x?: number; y?: number } };
    } catch {
      return null;
    }
  });
  expect(runtime?.mapId, "런타임이 설산 맵에 없다").toBe(MAP_ID);
  // 시작 지점이 통행 불가면 런타임이 다른 칸으로 밀어낸다 — 그건 배선 결함이다.
  expect(
    { x: runtime?.player?.x, y: runtime?.player?.y },
    "산 발치에 설 수 없어 런타임이 옮겼다",
  ).toEqual({ x: SNOW_MOUNTAIN_START.x, y: SNOW_MOUNTAIN_START.y });

  writeFileSync(`${OUT}proj-runtime-foot.png`, await page.getByTestId("play-stage").screenshot());

  /**
   * **실제로 계단을 밟고 올라가는지** 본다. 유닛 검사의 도달 가능성은 `canMove` 를 직접
   * 부른 결과이고, 런타임은 그 위에 카메라·애니메이션·입력이 얹혀 있다. 첫 겹의 계단은
   * 볏 53 행부터 네 행이므로, 발치 57 행에서 위로 밀면 52 행 이하로 올라가야 한다.
   */
  const readY = async (): Promise<number> => {
    const state = await page.evaluate(() => {
      const node = document.querySelector("[data-testid='runtime-state-json']");
      if (!node?.textContent) return null;
      try {
        return JSON.parse(node.textContent) as { player?: { y?: number } };
      } catch {
        return null;
      }
    });
    return state?.player?.y ?? Number.NaN;
  };
  for (let step = 0; step < 14 && (await readY()) > 51; step += 1) await tapKey(page, "ArrowUp", 220);
  const climbed = await readY();
  expect(climbed, `계단을 못 올랐다 — y=${climbed} (첫 겹 볏은 53 행)`).toBeLessThanOrEqual(51);
  writeFileSync(`${OUT}proj-runtime-climbed.png`, await page.getByTestId("play-stage").screenshot());
});
