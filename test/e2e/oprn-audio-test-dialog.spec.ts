import { expect, test, type Page } from "@playwright/test";

type AudioStateSnapshot = {
  volume: { bgm: number; se: number };
  playbackRate: number;
  pan: number;
  fadeInMs: number;
};

// 슬라이더를 실제로 움직인다. fill() 은 range 입력에 input 이벤트를 발생시킨다.
async function setSlider(page: Page, testId: string, value: string): Promise<void> {
  await page.getByTestId(testId).locator("input[type='range']").fill(value);
}

// 엔진에 적용된 실측값 + 실제 <audio> 요소의 값을 함께 읽는다.
// 엔진이 값만 들고 있고 미디어 엘리먼트에 닿지 않는 경우를 잡기 위한 교차 검증.
async function readAudio(page: Page): Promise<AudioStateSnapshot & { mediaVolume: number | null; mediaRate: number | null }> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __oprnAudioState?: () => AudioStateSnapshot }).__oprnAudioState;
    const state = hook ? hook() : { volume: { bgm: -1, se: -1 }, playbackRate: -1, pan: -1, fadeInMs: -1 };
    const media = document.querySelector<HTMLAudioElement>("audio[data-oprn-audio]");
    return {
      ...state,
      mediaVolume: media ? media.volume : null,
      mediaRate: media ? media.playbackRate : null,
    };
  });
}

test.beforeEach(async ({ page }) => {
  // 클래식 툴바(음악 버튼 포함)는 전문가 모드에서만 노출된다.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

// 편집기 셸 부팅(Phaser + 프로젝트 로드)이 기본 30초 예산을 다 먹어서 단정이 시간에 쫓겼다.
// 실측: goto 만 20~25초. 대기는 시간이 아니라 **부팅 완료 신호**(edit-canvas)로 한다.
test.setTimeout(300_000);

async function openAudioDialog(page: Page): Promise<void> {
  await page.goto("/?freshProject=1&audioTestDialog=1", { timeout: 90_000 });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("toolbar-sound-test")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("toolbar-sound-test").click();
  await expect(page.getByTestId("audio-test-dialog")).toBeVisible({ timeout: 15_000 });
}

test("audio dialog uses the canonical 음악·효과음 title and modern control layout", async ({ page }, testInfo) => {
  await openAudioDialog(page);

  const dialog = page.getByTestId("audio-test-dialog");
  // 헤더 용어 정본: uiCopy `audio`. "테스트" 를 붙이지 않고 슬래시 구분자도 쓰지 않는다.
  const heading = dialog.getByRole("heading", { name: "음악·효과음" });
  await expect(heading).toBeVisible();
  await expect(heading).not.toContainText("테스트");
  await expect(heading).not.toContainText("/");

  await expect(page.getByTestId("audio-test-list")).toBeVisible();
  await expect(page.getByTestId("audio-test-option-off")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("audio-test-filter")).toBeVisible();
  await expect(page.getByTestId("audio-test-fade")).toContainText("페이드인 시간");
  await expect(page.getByTestId("audio-test-fade")).toContainText("다음 재생부터 적용");
  await expect(page.getByTestId("audio-test-volume")).toContainText("음량");
  await expect(page.getByTestId("audio-test-tempo")).toContainText("템포");
  await expect(page.getByTestId("audio-test-balance")).toContainText("밸런스");
  // 슬라이더 값이 숫자로 보인다.
  await expect(page.getByTestId("audio-test-volume-value")).toHaveText("음량 100%");
  await expect(page.getByTestId("audio-test-tempo-value")).toHaveText("템포 100%");
  await expect(page.getByTestId("audio-test-balance-value")).toHaveText("밸런스 중앙");
  await expect(page.getByTestId("audio-test-fade-value")).toHaveText("페이드인 없음");

  // 재생/정지 버튼이 상태를 반영한다: 아무것도 선택하지 않았으면 둘 다 비활성.
  await expect(page.getByTestId("audio-test-play")).toBeDisabled();
  await expect(page.getByTestId("audio-test-stop")).toBeDisabled();
  await expect(page.getByTestId("audio-test-close")).toBeVisible();

  await page.getByTestId("audio-test-option-1").click();
  await expect(page.getByTestId("audio-test-option-1")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("audio-test-play")).toBeEnabled();
  await page.getByTestId("audio-test-play").click();
  await expect(page.getByTestId("audio-test-status")).toContainText("재생 중");
  await expect(page.getByTestId("audio-test-play")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("audio-test-stop")).toBeEnabled();

  await page.screenshot({ path: testInfo.outputPath("audio-test-dialog.png"), fullPage: true });

  await page.getByTestId("audio-test-stop").click();
  await expect(page.getByTestId("audio-test-status")).toContainText("정지됨");
  await expect(page.getByTestId("audio-test-play")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("audio-test-stop")).toBeDisabled();

  await page.getByTestId("audio-test-close").click();
  await expect(dialog).toBeHidden();
});

test("moving the sliders changes the values actually applied to playback", async ({ page }) => {
  await openAudioDialog(page);

  // 페이드인은 다음 재생에 적용되므로 재생 전에 0 으로 두고 시작한다(즉시 목표 볼륨 도달).
  await page.getByTestId("audio-test-option-1").click();
  await page.getByTestId("audio-test-play").click();
  await expect(page.getByTestId("audio-test-status")).toContainText("재생 중");

  const before = await readAudio(page);
  expect(before.volume.bgm).toBeCloseTo(1, 2);
  expect(before.playbackRate).toBeCloseTo(1, 2);
  expect(before.pan).toBeCloseTo(0, 2);

  // 재생 중 즉시 적용: 음량 40% · 템포 135% · 밸런스 왼쪽 40.
  await setSlider(page, "audio-test-volume", "40");
  await setSlider(page, "audio-test-tempo", "135");
  await setSlider(page, "audio-test-balance", "-40");
  // 페이드인 4초 — 다음 재생에 적용된다.
  await setSlider(page, "audio-test-fade", "4");

  await expect(page.getByTestId("audio-test-volume-value")).toHaveText("음량 40%");
  await expect(page.getByTestId("audio-test-tempo-value")).toHaveText("템포 135%");
  await expect(page.getByTestId("audio-test-balance-value")).toHaveText("밸런스 왼쪽 40");
  await expect(page.getByTestId("audio-test-fade-value")).toHaveText("페이드인 4초");

  const after = await readAudio(page);
  expect(after.volume.bgm).toBeCloseTo(0.4, 2);
  expect(after.playbackRate).toBeCloseTo(1.35, 2);
  expect(after.pan).toBeCloseTo(-0.4, 2); // -40/100 — 슬라이더 범위가 -100..100 이므로 전체 행정이 pan -1..1 을 덮는다
  expect(after.fadeInMs).toBe(4000);
  // 실제 미디어 엘리먼트에 닿았는지 교차 검증 — 정지 없이 즉시 반영이다.
  expect(after.mediaVolume).not.toBeNull();
  expect(after.mediaVolume!).toBeCloseTo(0.4, 2);
  expect(after.mediaRate!).toBeCloseTo(1.35, 2);
  // 값이 실제로 변했다.
  expect(after.playbackRate).not.toBeCloseTo(before.playbackRate, 2);
  expect(after.pan).not.toBeCloseTo(before.pan, 2);
});

test("list filter keeps (꺼짐) first and MIDI rows are marked unplayable", async ({ page }) => {
  await openAudioDialog(page);
  const list = page.getByTestId("audio-test-list");
  await expect(list).toBeVisible();

  const optionCount = await list.getByRole("option").count();
  await page.getByTestId("audio-test-filter").fill("zzzz-no-such-track");
  // (꺼짐) 은 필터와 무관하게 항상 첫 줄에 남는다.
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(list.getByRole("option").first()).toHaveAttribute("data-testid", "audio-test-option-off");

  await page.getByTestId("audio-test-filter").fill("");
  await expect(list.getByRole("option")).toHaveCount(optionCount);

  // MIDI(RTP) 항목은 목록에서 바로 구별된다 — 눌러보고 나서야 알게 하지 않는다.
  await page.getByTestId("audio-test-filter").fill("RTP·MIDI");
  const midiRow = list.getByRole("option").nth(1);
  await expect(midiRow).toHaveAttribute("aria-disabled", "true");
  await expect(midiRow).toContainText("재생 불가");
});

test("Escape closes the audio dialog through the shared modal stack", async ({ page }) => {
  await openAudioDialog(page);
  const dialog = page.getByTestId("audio-test-dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
