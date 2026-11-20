import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";

const ROOM_TONE = "cc0-sound-mk-op-room";
const THEME = "cc0-bgm-rtp-emo-002";

test("editor test play keeps ambience silent on screen and displays music in the stage corner", async ({ page }) => {
  test.setTimeout(120_000);
  const project: Project = JSON.parse(readFileSync("test/fixtures/projects/oprn-sample-v3.json", "utf8"));
  const map = project.maps[project.startMapId]!;
  map.bgs = { mode: "custom", resourceId: ROOM_TONE };
  map.events = [{
    id: "ev_test_audio",
    x: 3,
    y: 2,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "ev_test_audio_page",
      name: "원룸 오디오",
      conditions: [],
      trigger: { kind: "action" },
      graphic: {},
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [
        { kind: "playAudio", resourceId: ROOM_TONE, channel: "bgs", loop: true },
        { kind: "text", body: "환경음이 흐른다." },
        { kind: "playAudio", resourceId: THEME, loop: true },
        { kind: "text", body: "첫 번째 대사." },
        { kind: "text", body: "두 번째 대사." },
        {
          kind: "choices",
          prompt: "무엇을 할까?",
          options: [{ text: "계속", branch: [] }, { text: "쉬기", branch: [] }],
        },
      ],
    }],
  }];
  project.startPos = { x: 3, y: 1 };
  project.resourceProfiles.push(
    { kind: "sound", assetId: ROOM_TONE, name: "원룸 생활 소음" },
    { kind: "music", assetId: THEME, name: "원룸 주제곡" },
  );
  await seedProjectForEditor(page, project);
  await page.getByTestId("topbar-test-play").click();
  const modal = page.getByTestId("test-play-window");
  await expect(modal).toBeVisible();
  await startNewGameFromTitle(page);
  const indicator = modal.getByTestId("audio-indicator");
  const readyDialogue = modal.locator('[data-testid="dialogue-box"].page-ready');
  await expect(modal.getByTestId("audio-state-json")).toContainText(ROOM_TONE);
  await expect(indicator).toHaveCount(0);

  await tapKey(page, "ArrowDown");
  await tapKey(page, "ArrowDown");
  const playerY = await page.evaluate(() => (window as typeof window & {
    __oprnDebug: { readState(): { y: number } };
  }).__oprnDebug.readState().y);
  expect(playerY).toBe(project.startPos.y);
  await expect(modal.getByTestId("dialogue-box")).toHaveCount(0);
  await tapKey(page, "z");
  await expect(readyDialogue).toContainText("환경음이 흐른다.");
  await expect(indicator).toHaveCount(0);

  // 일반 오버레이 규칙이 레이어 밖에서 적용되는 묶음도 같은 크기를 유지한다.
  await page.addStyleTag({ content: ".runtime-overlay { inset: 12px; }" });
  await page.keyboard.press("Enter");
  await expect(indicator).toHaveText("원룸 주제곡");
  const geometry = await indicator.evaluate((node) => {
    const stage = node.closest('[data-testid="play-stage"]')!;
    const box = node.getBoundingClientRect();
    const frame = stage.getBoundingClientRect();
    return {
      directChild: node.parentElement === stage,
      width: box.width / frame.width,
      height: box.height / frame.height,
      rightGap: (frame.right - box.right) / frame.width,
      bottomGap: (frame.bottom - box.bottom) / frame.height,
    };
  });
  expect(geometry.directChild).toBe(true);
  expect(geometry.width).toBeLessThan(0.6);
  expect(geometry.height).toBeLessThan(0.25);
  expect(geometry.rightGap).toBeGreaterThan(0);
  expect(geometry.rightGap).toBeLessThan(0.15);
  expect(geometry.bottomGap).toBeGreaterThan(0);
  expect(geometry.bottomGap).toBeLessThan(0.15);

  await expect(readyDialogue).toContainText("첫 번째 대사.");
  await page.keyboard.down("Enter");
  try {
    // Playwright는 운영체제의 키 반복을 자동으로 보내지 않는다. 같은 키를 다시 down 하면 repeat가 된다.
    const choice = modal.getByTestId("runtime-choice-0");
    await expect(modal.getByTestId("dialogue-box")).toContainText("두 번째 대사.");
    for (let i = 0; i < 5; i += 1) {
      await page.waitForTimeout(180);
      await page.keyboard.down("Enter");
    }
    await expect(choice).toBeVisible();
  } finally {
    await page.keyboard.up("Enter");
  }
});
