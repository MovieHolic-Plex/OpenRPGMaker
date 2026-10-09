/**
 * 계약: **`화면 효과` 편집 모달의 프리뷰는 실제로 크기가 있고, 재생하면 실제로 변한다.**
 *
 * 회귀 배경(적대적 QA `.omo/evidence/screen-fx-2/qa-before.md`):
 *  - D1: `.ecp-screen-effect-*` CSS 가 저장소에 한 줄도 없어 오버레이 실측 박스가 0×0,
 *        position: static 이었다. 배경색 인라인은 정확했으니 유닛 테스트는 초록이었고,
 *        감독이 보는 화면만 흰 빈 사각형이었다 → **실측 박스**로만 잡힌다.
 *  - D2: 재생 컨트롤이 없어 durationMs 를 눈으로 확인할 방법이 없었다(animation-name: none).
 *        → 재생 후 computed opacity 가 실제로 움직이는지 잰다.
 *  - D3: `#xyz` 같은 값이 조용히 통과했다 → 타이핑 중 콘솔 에러 0 + 오류 문구 노출.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, GameEvent, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

const AFTER_DIR = ".omo/evidence/screen-fx-2/after";
const EVENT_ID = "ev_screen_fx_preview";
const PLAY_DURATION_MS = 1500;

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

function screenEffectCommand(fields: Record<string, unknown>): Command {
  const entry = M2_COMMAND_CATALOG.find((row) => row.title === "Screen Effect");
  if (!entry) throw new Error("카탈로그에 Screen Effect 가 없다");
  return { kind: "m2Command", commandId: entry.id, fields } as unknown as Command;
}

function fxProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error(`시작 맵을 찾을 수 없다: ${project.startMapId}`);
  const commands: Command[] = [
    screenEffectCommand({ effect: "fadeOut", value: "", durationMs: PLAY_DURATION_MS }),
    screenEffectCommand({ effect: "tint", value: "", durationMs: 600 }),
  ];
  const event = {
    id: EVENT_ID,
    x: 4,
    y: 5,
    trigger: { kind: "action" },
    commands,
    pages: [
      {
        id: `${EVENT_ID}_page`,
        name: `${EVENT_ID}_page`,
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      },
    ],
  } as unknown as GameEvent;
  map.events = [event];
  return project;
}

async function openFirstScreenEffectModal(page: Page): Promise<void> {
  await seedProjectForEditor(page, fxProject());
  // 코치마크가 열려 있으면 좌측 레일 클릭을 가로챈다.
  const skip = page.getByRole("button", { name: "건너뛰기" });
  if (await skip.count()) await skip.click();
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId(`event-list-row-${EVENT_ID}`).click();
  await page.getByTestId("event-editor-open").click();
  const listToggle = page.getByTestId("event-view-toggle-list");
  if (await listToggle.count()) await listToggle.click();
  const rows = page.getByTestId("event-command-m2Command");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  // 더별클릭은 우상 인스펙터를 여는 경로다 — 편집 모달은 행을 잡은 뒤 Space.
  await rows.first().locator(".cmd-head").click();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await mkdir(AFTER_DIR, { recursive: true });
  // 시드(seedProjectForEditor)는 localStorage 를 비우면서 editor-ui-mode 만 보존한다.
  // 맵 이벤트 목록(event-list-row-*)은 전문가 모드에서만 렌더된다.
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
});

test("계약: 화면 효과 프리뷰는 실측 크기를 갖고 재생하면 불투명도가 움직인다", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    // dev 환경은 LegacyDb 등 원격 리소스 실패를 상시 찍는다 — 이 스펙은 색 입력이
    // 앱을 깨뜨렸는가만 보면 되므로 네트워크 로드 소음은 걸러낸다.
    if (message.type() === "error" && !/Failed to load resource/u.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openFirstScreenEffectModal(page);

  const dialog = page.getByTestId("event-command-edit-dialog");
  const stage = dialog.getByTestId("ecp-screen-effect-stage");
  const overlay = dialog.getByTestId("ecp-screen-effect-overlay");
  await expect(stage).toBeVisible();

  // D1: 오버레이가 실제로 화면을 덮는 박스여야 한다(before 는 0×0 / static).
  const box = await overlay.boundingBox();
  expect(box, "오버레이가 렌더 박스를 갖지 않는다 — CSS 가 없다").not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThan(80);
  expect(box?.height ?? 0).toBeGreaterThan(60);
  expect(await overlay.evaluate((node) => getComputedStyle(node).position)).toBe("absolute");

  // D2: 재생 컨트롤이 있고, 누르면 시작 상태 → 도착 상태로 실제 전이가 일어난다.
  const play = dialog.getByTestId("ecp-screen-effect-play");
  await expect(play).toBeVisible();
  await play.click();
  const startOpacity = await overlay.evaluate((node) => Number(getComputedStyle(node).opacity));
  await page.screenshot({ path: `${AFTER_DIR}/fadeOut-playing.png` });
  await expect(stage).toHaveAttribute("data-play-state", "idle", { timeout: PLAY_DURATION_MS + 10_000 });
  const endOpacity = await overlay.evaluate((node) => Number(getComputedStyle(node).opacity));
  await page.screenshot({ path: `${AFTER_DIR}/fadeOut-settled.png` });

  expect(startOpacity, `재생 직후 ${startOpacity} → 종료 ${endOpacity}`).toBeLessThan(endOpacity);
  expect(endOpacity - startOpacity).toBeGreaterThan(0.3);

  // D3/SC2: 색 값에 쓰레기를 넣어도 크래시/콘솔 에러 없이 오류를 알려준다.
  consoleErrors.length = 0;
  pageErrors.length = 0;
  await dialog.getByTestId("m2-command-effect-option-select").selectOption("tint");
  const valueInput = dialog.getByTestId("m2-command-value-input");
  await valueInput.fill("#xyz");
  await expect(valueInput).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByTestId("m2-command-value-error")).toBeVisible();
  await expect(dialog.getByTestId("ecp-screen-effect-play")).toBeVisible();
  await page.screenshot({ path: `${AFTER_DIR}/tint-invalid-value.png` });

  await dialog.getByTestId("m2-command-value-swatch-green").click();
  await expect(valueInput).toHaveAttribute("aria-invalid", "false");
  await page.screenshot({ path: `${AFTER_DIR}/tint-green-swatch.png` });

  expect(consoleErrors, `콘솔 에러: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(pageErrors, `페이지 예외: ${pageErrors.join(" | ")}`).toEqual([]);
});
