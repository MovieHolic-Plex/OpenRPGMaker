/* 전투 씬의 논리 해상도 스케일링 회귀 가드.
 *
 * 전투 씬은 640×480 논리 박스 + `transform: scale()` 로 그려진다. 배율은
 * battleStageScale.ts 가 host 의 **레이아웃** 크기에서 계산한다.
 * getBoundingClientRect(시각 크기)로 읽으면 실제 플레이 경로가 깨진다 — 거기서 host 는
 * `.play-stage`(레이아웃 320×240, 이미 scale(2))라 rect 가 640×480 으로 나와
 * 배율을 또 곱해 화면 좌상단 일부만 보였다(실측 — 논리 320 시절엔 총 4×).
 *
 * 두 마운트 경로가 같은 누적 배율을 갖고, 씬이 host 밖으로 잘려나가지 않아야 한다.
 */
import { expect, test } from "@playwright/test";
import { seedReferenceBattleProject } from "./battleReferenceProject";
import { startNewGameFromTitle } from "./runtimeInput";

const LOGICAL_WIDTH = 640;
const LOGICAL_HEIGHT = 480;

type StageProbe = {
  readonly hostClientWidth: number;
  readonly hostClientHeight: number;
  readonly sceneLayoutWidth: number;
  readonly sceneLayoutHeight: number;
  readonly cumulativeScale: number;
  readonly overflowRight: number;
  readonly overflowBottom: number;
};

const probeStage = (): StageProbe => {
  const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
  if (!scene) throw new Error("battle-scene not mounted");
  const host = scene.parentElement;
  if (!host) throw new Error("battle-scene has no host");
  const hostRect = host.getBoundingClientRect();
  const sceneRect = scene.getBoundingClientRect();
  return {
    hostClientWidth: host.clientWidth,
    hostClientHeight: host.clientHeight,
    sceneLayoutWidth: scene.offsetWidth,
    sceneLayoutHeight: scene.offsetHeight,
    // 누적 배율 = 시각 폭 / 논리 폭. 조상 transform 까지 포함한 실제 확대율이다.
    cumulativeScale: Math.round((sceneRect.width / 640) * 1000) / 1000,
    overflowRight: Math.round(sceneRect.right - hostRect.right),
    overflowBottom: Math.round(sceneRect.bottom - hostRect.bottom),
  };
};

function assertStage(probe: StageProbe): void {
  // 레이아웃 박스는 항상 논리 해상도여야 한다.
  expect(probe.sceneLayoutWidth).toBe(LOGICAL_WIDTH);
  expect(probe.sceneLayoutHeight).toBe(LOGICAL_HEIGHT);
  // host 를 정확히 채우고 넘치지 않아야 한다(4× 회귀 시 여기서 크게 양수가 된다).
  expect(probe.overflowRight).toBeLessThanOrEqual(1);
  expect(probe.overflowBottom).toBeLessThanOrEqual(1);
  // 누적 배율은 host 레이아웃 크기가 논리 해상도의 몇 배인지와 일치해야 한다.
  const expected = Math.min(probe.hostClientWidth / LOGICAL_WIDTH, probe.hostClientHeight / LOGICAL_HEIGHT);
  expect(probe.cumulativeScale).toBeGreaterThanOrEqual(1);
  // 전투 테스트 모달(host 640×480)은 조상 transform 이 없으므로 배율이 그대로 host 비율이다.
  if (probe.hostClientWidth === 640) expect(probe.cumulativeScale).toBeCloseTo(expected, 2);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("battle scene fills its host without clipping on the real play route", async ({ page }) => {
  test.setTimeout(120_000);
  await seedReferenceBattleProject(page);
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();

  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 25_000 });

  const probe = await page.evaluate(probeStage);
  // 플레이 경로의 host 는 `.play-stage` — 레이아웃 320×240 에 조상 transform(scale 2)이 걸려 있다.
  // 논리 해상도가 640×480 이므로 씬의 **자체** 배율은 0.5 이고, 조상과 곱해 시각 640×480 이 된다.
  expect(probe.hostClientWidth).toBe(320);
  expect(probe.hostClientHeight).toBe(240);
  assertStage(probe);
});

test("battle scene fills its host without clipping on the battle-test route", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?project=rpg-zzu-quest-demo");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  const toolbar = page.getByTestId("toolbar-battle-test");
  if ((await toolbar.count()) > 0 && (await toolbar.isVisible())) await toolbar.click({ force: true });
  else {
    await page.getByTestId("menu-game").click({ force: true });
    await page.getByTestId("menu-game-battle-test").click({ force: true });
  }
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 25_000 });
  await page.waitForTimeout(800);

  assertStage(await page.evaluate(probeStage));
});

test("vxace hides the command window while a round resolves", async ({ page }) => {
  test.setTimeout(120_000);
  await seedReferenceBattleProject(page, { battleUiStyle: "vxace" });
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 25_000 });

  const scene = page.getByTestId("battle-scene");
  await expect(scene).toHaveAttribute("data-battle-skin", "vxace");
  // 입력 단계에서는 명령창이 보인다.
  await expect(page.locator(".battle-command-host")).toBeVisible();

  await page.getByTestId("actor-command-attack").click();
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  await page.keyboard.press("z");

  // 해결 단계로 넘어가면 항목이 없는 빈 창이 화면 30% 를 덮지 않아야 한다.
  await expect(scene).not.toHaveAttribute("data-battle-phase", "targetSelect", { timeout: 20_000 });
  await expect(page.locator(".battle-command-host")).toBeHidden({ timeout: 20_000 });
});
