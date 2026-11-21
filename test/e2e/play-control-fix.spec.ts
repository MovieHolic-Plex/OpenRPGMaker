import { mkdir, writeFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

// 제품은 시작 마을 NPC 를 더 이상 심지 않는다. 대화 상자 회귀는 빈 맵의 보이는 칸에
// 직접 심은 이벤트(event_play_control_talk)로 확인한다.
const TALK_EVENT_ID = "event_play_control_talk";
const TALK_SPEAKER = "미나";
const TALK_BODY = "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.";

const EVIDENCE_DIR = ".omo/ulw-loop/dialogue-90-match/evidence";
const SCREENSHOT_PATH = `${EVIDENCE_DIR}/play-screen-green.png`;
const DIALOGUE_SCREENSHOT_PATH = `${EVIDENCE_DIR}/dialogue-box-green.png`;
const METRICS_PATH = `${EVIDENCE_DIR}/dialogue-metrics-green.json`;

type RuntimeState = {
  readonly inputEnabled: boolean;
  readonly player: {
    readonly x: number;
    readonly y: number;
  };
};

type DialogueMetrics = {
  readonly backgroundImage: string;
  readonly borderTopWidth: number;
  readonly bodyFontSize: string;
  readonly bodyFontSizePx: number;
  readonly boxHeightRatio: number;
  readonly faceHeight: number;
  readonly faceHeightRatio: number;
  readonly faceWidth: number;
  readonly paddingLeft: number;
  readonly paddingLeftRatio: number;
  readonly speakerFontSize: string;
  readonly speakerFontSizePx: number;
  readonly speakerFontRatio: number;
  readonly height: number;
  readonly containerBottom: number;
  readonly viewportHeight: number;
  readonly minHeight: string;
  readonly display: string;
  readonly structuralSimilarityScore: number;
};

async function startFreshPlay(page: Page, project?: Project): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  if (project) await seedProjectForEditor(page, project);
  else await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("mode-play")).toBeVisible();
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect.poll(async () => {
    if (await page.getByTestId("title-new-game").isVisible()) return "title";
    if (await page.getByTestId("play-canvas").isVisible()) return "canvas";
    return "loading";
  }, { timeout: 15_000 }).not.toBe("loading");
  if (await page.getByTestId("title-new-game").isVisible()) {
    await startNewGameFromTitle(page);
  }
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  await page.getByTestId("play-canvas").locator("canvas").click();
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  // textContent 는 읽는 순간에만 스냅샷을 만드는 메인 월드 getter 다.
  // locator.textContent() 는 유틸리티 월드라 빈 폴백 "{}" 만 본다.
  const text = await page.getByTestId("runtime-state-json").evaluate((node) => node.textContent ?? "");
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("malformed runtime state");
  return parsed;
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!isRecord(value) || !isRecord(value.player)) return false;
  return typeof value.inputEnabled === "boolean" &&
    typeof value.player.x === "number" &&
    typeof value.player.y === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

test("held ArrowRight moves continuously before OS key repeat", async ({ page }) => {
  await startFreshPlay(page);
  const before = await runtimeState(page);

  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(520);
  await page.keyboard.up("ArrowRight");

  const after = await runtimeState(page);
  expect(after.player.x).toBeGreaterThan(before.player.x);
});

test("seeded NPC dialogue uses a compact bottom panel and does not reopen while confirm is held", async ({ page }) => {
  test.setTimeout(120_000);
  await startFreshPlay(page, dialogueProbeProject());

  // 플레이 화면은 실제 마우스 click(detail >= 1)을 막는다. 마커의 리스너는
  // 테스트용 합성 click(detail 0, HTMLElement.click)만 받는다.
  await page.getByTestId(`event-${TALK_EVENT_ID}`).evaluate((node: HTMLElement) => node.click());
  const dialogue = page.getByTestId("dialogue-box");
  await expect(dialogue).toContainText("미나");
  await expect(dialogue).toContainText("어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.");

  const metrics = await dialogueMetrics(page);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(METRICS_PATH, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

  expect(metrics.structuralSimilarityScore).toBeGreaterThanOrEqual(90);
  expect(metrics.boxHeightRatio).toBeGreaterThanOrEqual(0.23);
  expect(metrics.boxHeightRatio).toBeLessThanOrEqual(0.3);
  expect(metrics.containerBottom).toBeLessThanOrEqual(28);
  expect(metrics.faceWidth).toBeGreaterThanOrEqual(150);
  expect(metrics.faceHeight).toBeGreaterThanOrEqual(150);
  expect(metrics.faceHeightRatio).toBeGreaterThanOrEqual(0.68);
  expect(metrics.bodyFontSize).toBe("7px");
  expect(metrics.bodyFontSizePx).toBeGreaterThanOrEqual(7);
  expect(metrics.speakerFontSize).toBe("7px");
  expect(metrics.speakerFontSizePx).toBeGreaterThanOrEqual(7);
  expect(metrics.backgroundImage).toContain("rgba");
  expect(metrics.backgroundImage).toContain("repeating-linear-gradient");
  expect(metrics.minHeight).toBe("100%");
  expect(metrics.display).toBe("flex");

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  await dialogue.screenshot({ path: DIALOGUE_SCREENSHOT_PATH });

  await page.keyboard.press("Enter");
  await expect(dialogue).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(dialogue).toHaveCount(0);
});

async function dialogueMetrics(page: Page): Promise<DialogueMetrics> {
  const metrics = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="dialogue-box"]');
    const body = box?.querySelector(".body");
    const speaker = box?.querySelector(".speaker");
    const face = document.querySelector('[data-testid="dialogue-face"]');
    if (!(box instanceof HTMLElement)) return null;
    if (!(body instanceof HTMLElement)) return null;
    if (!(speaker instanceof HTMLElement)) return null;
    if (!(face instanceof HTMLElement)) return null;
    const rect = box.getBoundingClientRect();
    const parentRect = box.parentElement?.getBoundingClientRect();
    const style = window.getComputedStyle(box);
    const bodyStyle = window.getComputedStyle(body);
    const speakerStyle = window.getComputedStyle(speaker);
    const faceRect = face.getBoundingClientRect();
    const height = rect.height;
    const bodyFontSizePx = Number.parseFloat(bodyStyle.fontSize);
    const speakerFontSizePx = Number.parseFloat(speakerStyle.fontSize);
    const borderTopWidth = Number.parseFloat(style.borderTopWidth);
    const paddingLeft = Number.parseFloat(style.paddingLeft);
    const boxHeightRatio = height / window.innerHeight;
    const faceHeightRatio = faceRect.height / height;
    const speakerFontRatio = speakerFontSizePx / height;
    const paddingLeftRatio = paddingLeft / height;
    const closeness = (actual: number, target: number, tolerance: number): number =>
      Math.max(0, 1 - Math.abs(actual - target) / tolerance);
    const weightedScore =
      closeness(boxHeightRatio, 0.294, 0.04) * 20 +
      closeness(faceHeightRatio, 0.816, 0.12) * 25 +
      closeness(bodyFontSizePx, 7, 1) * 18 +
      closeness(speakerFontSizePx, 7, 1) * 12 +
      closeness(borderTopWidth, 1, 0.75) * 10 +
      closeness(paddingLeft, 8, 3) * 5 +
      (style.backgroundImage.includes("rgba") && style.backgroundImage.includes("repeating-linear-gradient") ? 10 : 0);
    return {
      backgroundImage: style.backgroundImage,
      borderTopWidth,
      bodyFontSize: bodyStyle.fontSize,
      bodyFontSizePx,
      boxHeightRatio,
      faceHeight: faceRect.height,
      faceHeightRatio,
      faceWidth: faceRect.width,
      paddingLeft,
      paddingLeftRatio,
      speakerFontSize: speakerStyle.fontSize,
      speakerFontSizePx,
      speakerFontRatio,
      height,
      containerBottom: parentRect ? parentRect.bottom - rect.bottom : window.innerHeight - rect.bottom,
      viewportHeight: window.innerHeight,
      minHeight: style.minHeight,
      display: style.display,
      structuralSimilarityScore: Math.round(weightedScore),
    };
  });
  if (!metrics) throw new Error("missing dialogue metrics");
  return metrics;
}

/** 빈 프로젝트의 시작 맵에 얼굴 대사가 있는 NPC 하나를 심는다. 제품 기본 맵에는 없다. */
function dialogueProbeProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing blank project start map");
  const spriteId = "tex_easyrpg_charset_people1";
  const face = reviewedFaceIdForCharset(spriteId, 0);
  if (!face) throw new Error(`missing reviewed face for ${spriteId}#0`);
  const commands: Command[] = [
    { kind: "changeFace", resourceId: face, position: "left", flipHorizontally: false },
    { kind: "text", speaker: TALK_SPEAKER, body: TALK_BODY },
  ];
  const eventPage: EventPage = {
    id: `${TALK_EVENT_ID}_page`,
    name: TALK_SPEAKER,
    conditions: [],
    graphic: {
      sprite: { type: "bundled", id: spriteId },
      direction: "down",
      pattern: charsetFrameIndex({ characterIndex: 0, pattern: 1, direction: "down" }),
    },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  const event: GameEvent = {
    id: TALK_EVENT_ID,
    name: TALK_SPEAKER,
    x: 12,
    y: 7,
    trigger: { kind: "action" },
    commands,
    pages: [eventPage],
  };
  map.events = [event];
  return project;
}
