/**
 * 쉬운 말 보고서에 실을 **에디터 쪽** 그림. 진단 전용(`_` 접두사).
 *
 * 제작자가 「말투·연출」을 고르는 자리와, 고른 연출이 프리뷰 창에서 재생되는 것을 찍는다.
 * 프리뷰는 런타임과 **같은 keyframe** 을 부르므로 여기서 튀는 그림이 게임에서도 튄다
 * (그 짝은 `test/dialoguePreviewPresentationCss.test.ts` 가 잠근다).
 *
 * 프리뷰 창은 `.dialogue-box` 가 아니라 `.ecp-message-window` 라서 런타임 얼음 도구를
 * 그대로 못 쓴다 — 여기서만 쓰는 작은 감시자를 따로 심는다.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

const DIR = "reports/dialogue-easy/shots";
const EVENT_ID = "ev_easy_editor";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

declare global {
  interface Window {
    __previewFreeze?: { readonly fraction: number } | null;
    __previewFrozen?: number;
  }
}

/** 프리뷰 창의 진입 연출을 시작되는 프레임에 붙잡는다. */
async function installPreviewFreeze(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__previewFreeze = null;
    window.__previewFrozen = 0;
    const tick = (): void => {
      const spec = window.__previewFreeze;
      if (spec) {
        for (const animation of document.getAnimations()) {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          if (!(target instanceof HTMLElement) || !target.classList.contains("ecp-message-window")) continue;
          if (animation.playState === "paused") continue;
          const duration = animation.effect?.getComputedTiming().duration;
          animation.pause();
          animation.currentTime = (typeof duration === "number" ? duration : 0) * spec.fraction;
          window.__previewFrozen = (window.__previewFrozen ?? 0) + 1;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function armPreviewFreeze(page: Page, fraction: number): Promise<void> {
  await page.evaluate((at) => {
    window.__previewFrozen = 0;
    window.__previewFreeze = { fraction: Number(at) };
  }, fraction);
}

async function shotOf(scope: Locator, name: string): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await scope.screenshot({ path: `${DIR}/${name}.png` });
}

test("에디터에서 말투를 고르는 자리와 프리뷰 재생을 찍는다", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await installPreviewFreeze(page);
  await seedProjectForEditor(page, editorProject());

  // 캔버스 더블클릭에 의존하지 않는다 — 이벤트 목록에서 여는 경로가 결정적이다
  // (test/e2e/eventEditorCertEvidence.ts 의 openEventEditor 와 같은 순서).
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId(`event-list-row-${EVENT_ID}`).click();
  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible({ timeout: 30_000 });

  // **보기 방식을 「목록」으로 먼저 돌린다.** 기본이 「스토리」라 `event-command-text` 가
  // 존재하기는 하지만 화면에 없어서, 클릭이 "not visible" 로 240초를 다 쓰고 죽는다
  // (실측 2026-08-30). 같은 testid 를 세 뷰가 나눠 갖는 구조라 존재만 보면 속는다.
  await page.getByTestId("event-view-toggle-list").click();
  // 줄은 force 로 누른다 — 뷰가 바뀌는 동안 "stable" 판정을 통과하지 못한다.
  // **더블클릭이라야 편집 창이 열린다**(`commandList.ts:169` 가 dblclick 에서 openEditor).
  // 한 번 클릭은 오른쪽 검사기 칸만 채우는데, 그 칸은 436px 로 좁아 그림이 초라하다.
  await page.getByTestId("event-command-text").first().dblclick({ force: true });

  // 같은 폼을 **두 표면이 나눠 갖는다** — 뒤에 남은 검사기 칸과 지금 열린 편집 창이 각각
  // `event-command-text-*` 를 그린다(실측 2026-08-30: strict mode 위반 2개). 열린 창으로
  // 범위를 좁히면 `:visible` 같은 요령이 필요 없다.
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  const presentation = dialog.getByTestId("event-command-text-presentation");
  await expect(presentation).toBeVisible({ timeout: 30_000 });
  const preview = dialog.getByTestId("event-command-text-live-preview");
  await expect(preview).toBeVisible({ timeout: 30_000 });

  await mkdir(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/editor-full.png` });
  await shotOf(dialog, "editor-dialog-crop");
  // 「말투·연출」 칸. 접힌 고급 옵션 밖에 상시 노출된 것이 이 그림의 요점이다.
  await shotOf(presentation, "editor-presentation-crop");
  await shotOf(preview, "editor-preview-settled-crop");

  // 말투를 바꾸면 프리뷰가 그 연출을 다시 재생한다. 진입 정점을 얼려 찍는다.
  // **`selectOption` 은 못 쓴다** — 세그먼트 버튼 뒤의 `<select>` 는 `hidden` 이다
  // (`recordPicker.ts:584`). 사람이 누르는 것과 같은 버튼을 누른다.
  await armPreviewFreeze(page, 0.58);
  await dialog.getByTestId("event-command-text-emotion-segment-surprised").click();
  await expect
    .poll(() => page.evaluate(() => window.__previewFrozen ?? 0), {
      timeout: 20_000,
      message: "프리뷰 창의 진입 연출을 못 잡았다",
    })
    .toBeGreaterThan(0);
  await shotOf(preview, "editor-preview-enter-crop");
  await shotOf(presentation, "editor-presentation-surprised-crop");
});

function editorProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project start map is missing");
  map.events.push(
    talkEvent(EVENT_ID, 5, 5, [
      { kind: "text", speaker: "마을 사람", body: "마을에 온 걸 환영해. 여기가 우리 광장이야." } as Command,
    ]),
  );
  return project;
}

function talkEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: "광장 안내",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
}
