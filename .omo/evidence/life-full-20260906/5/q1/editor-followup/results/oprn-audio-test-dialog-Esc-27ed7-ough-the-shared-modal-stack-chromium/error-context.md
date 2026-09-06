# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oprn-audio-test-dialog.spec.ts >> Escape closes the audio dialog through the shared modal stack
- Location: test/e2e/oprn-audio-test-dialog.spec.ts:161:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('edit-canvas')
Expected: visible
Timeout: 60000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 60000ms
  - waiting for getByTestId('edit-canvas')

```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   |
  3   | type AudioStateSnapshot = {
  4   |   volume: { bgm: number; se: number };
  5   |   playbackRate: number;
  6   |   pan: number;
  7   |   fadeInMs: number;
  8   | };
  9   |
  10  | // 슬라이더를 실제로 움직인다. fill() 은 range 입력에 input 이벤트를 발생시킨다.
  11  | async function setSlider(page: Page, testId: string, value: string): Promise<void> {
  12  |   await page.getByTestId(testId).locator("input[type='range']").fill(value);
  13  | }
  14  |
  15  | // 엔진에 적용된 실측값 + 실제 <audio> 요소의 값을 함께 읽는다.
  16  | // 엔진이 값만 들고 있고 미디어 엘리먼트에 닿지 않는 경우를 잡기 위한 교차 검증.
  17  | async function readAudio(page: Page): Promise<AudioStateSnapshot & { mediaVolume: number | null; mediaRate: number | null }> {
  18  |   return page.evaluate(() => {
  19  |     const hook = (window as unknown as { __oprnAudioState?: () => AudioStateSnapshot }).__oprnAudioState;
  20  |     const state = hook ? hook() : { volume: { bgm: -1, se: -1 }, playbackRate: -1, pan: -1, fadeInMs: -1 };
  21  |     const media = document.querySelector<HTMLAudioElement>("audio[data-oprn-audio]");
  22  |     return {
  23  |       ...state,
  24  |       mediaVolume: media ? media.volume : null,
  25  |       mediaRate: media ? media.playbackRate : null,
  26  |     };
  27  |   });
  28  | }
  29  |
  30  | test.beforeEach(async ({ page }) => {
  31  |   // 클래식 툴바(음악 버튼 포함)는 전문가 모드에서만 노출된다.
  32  |   await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  33  | });
  34  |
  35  | // 편집기 셸 부팅(Phaser + 프로젝트 로드)이 기본 30초 예산을 다 먹어서 단정이 시간에 쫓겼다.
  36  | // 실측: goto 만 20~25초. 대기는 시간이 아니라 **부팅 완료 신호**(edit-canvas)로 한다.
  37  | test.setTimeout(300_000);
  38  |
  39  | async function openAudioDialog(page: Page): Promise<void> {
  40  |   await page.goto("/?freshProject=1&audioTestDialog=1", { timeout: 90_000 });
> 41  |   await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  42  |   await expect(page.getByTestId("toolbar-sound-test")).toBeVisible({ timeout: 30_000 });
  43  |   // This editor-only probe deliberately opts into the same audio QA capability.
  44  |   await page.evaluate(async () => {
  45  |     const audioModulePath = "/src/player/audio/index.ts";
  46  |     const { getAudioEngine } = await import(audioModulePath);
  47  |     getAudioEngine({ qaInstrumentation: true });
  48  |   });
  49  |   await page.getByTestId("toolbar-sound-test").click();
  50  |   await expect(page.getByTestId("audio-test-dialog")).toBeVisible({ timeout: 15_000 });
  51  | }
  52  |
  53  | test("audio dialog uses the canonical 음악·효과음 title and modern control layout", async ({ page }, testInfo) => {
  54  |   await openAudioDialog(page);
  55  |
  56  |   const dialog = page.getByTestId("audio-test-dialog");
  57  |   // 헤더 용어 정본: uiCopy `audio`. "테스트" 를 붙이지 않고 슬래시 구분자도 쓰지 않는다.
  58  |   const heading = dialog.getByRole("heading", { name: "음악·효과음" });
  59  |   await expect(heading).toBeVisible();
  60  |   await expect(heading).not.toContainText("테스트");
  61  |   await expect(heading).not.toContainText("/");
  62  |
  63  |   await expect(page.getByTestId("audio-test-list")).toBeVisible();
  64  |   await expect(page.getByTestId("audio-test-option-off")).toHaveAttribute("aria-selected", "true");
  65  |   await expect(page.getByTestId("audio-test-filter")).toBeVisible();
  66  |   await expect(page.getByTestId("audio-test-fade")).toContainText("페이드인 시간");
  67  |   await expect(page.getByTestId("audio-test-fade")).toContainText("다음 재생부터 적용");
  68  |   await expect(page.getByTestId("audio-test-volume")).toContainText("음량");
  69  |   await expect(page.getByTestId("audio-test-tempo")).toContainText("템포");
  70  |   await expect(page.getByTestId("audio-test-balance")).toContainText("밸런스");
  71  |   // 슬라이더 값이 숫자로 보인다.
  72  |   await expect(page.getByTestId("audio-test-volume-value")).toHaveText("음량 100%");
  73  |   await expect(page.getByTestId("audio-test-tempo-value")).toHaveText("템포 100%");
  74  |   await expect(page.getByTestId("audio-test-balance-value")).toHaveText("밸런스 중앙");
  75  |   await expect(page.getByTestId("audio-test-fade-value")).toHaveText("페이드인 없음");
  76  |
  77  |   // 재생/정지 버튼이 상태를 반영한다: 아무것도 선택하지 않았으면 둘 다 비활성.
  78  |   await expect(page.getByTestId("audio-test-play")).toBeDisabled();
  79  |   await expect(page.getByTestId("audio-test-stop")).toBeDisabled();
  80  |   await expect(page.getByTestId("audio-test-close")).toBeVisible();
  81  |
  82  |   await page.getByTestId("audio-test-option-1").click();
  83  |   await expect(page.getByTestId("audio-test-option-1")).toHaveAttribute("aria-selected", "true");
  84  |   await expect(page.getByTestId("audio-test-play")).toBeEnabled();
  85  |   await page.getByTestId("audio-test-play").click();
  86  |   await expect(page.getByTestId("audio-test-status")).toContainText("재생 중");
  87  |   await expect(page.getByTestId("audio-test-play")).toHaveAttribute("aria-pressed", "true");
  88  |   await expect(page.getByTestId("audio-test-stop")).toBeEnabled();
  89  |
  90  |   await page.screenshot({ path: testInfo.outputPath("audio-test-dialog.png"), fullPage: true });
  91  |
  92  |   await page.getByTestId("audio-test-stop").click();
  93  |   await expect(page.getByTestId("audio-test-status")).toContainText("정지됨");
  94  |   await expect(page.getByTestId("audio-test-play")).toHaveAttribute("aria-pressed", "false");
  95  |   await expect(page.getByTestId("audio-test-stop")).toBeDisabled();
  96  |
  97  |   await page.getByTestId("audio-test-close").click();
  98  |   await expect(dialog).toBeHidden();
  99  | });
  100 |
  101 | test("moving the sliders changes the values actually applied to playback", async ({ page }) => {
  102 |   await openAudioDialog(page);
  103 |
  104 |   // 페이드인은 다음 재생에 적용되므로 재생 전에 0 으로 두고 시작한다(즉시 목표 볼륨 도달).
  105 |   await page.getByTestId("audio-test-option-1").click();
  106 |   await page.getByTestId("audio-test-play").click();
  107 |   await expect(page.getByTestId("audio-test-status")).toContainText("재생 중");
  108 |
  109 |   const before = await readAudio(page);
  110 |   expect(before.volume.bgm).toBeCloseTo(1, 2);
  111 |   expect(before.playbackRate).toBeCloseTo(1, 2);
  112 |   expect(before.pan).toBeCloseTo(0, 2);
  113 |
  114 |   // 재생 중 즉시 적용: 음량 40% · 템포 135% · 밸런스 왼쪽 40.
  115 |   await setSlider(page, "audio-test-volume", "40");
  116 |   await setSlider(page, "audio-test-tempo", "135");
  117 |   await setSlider(page, "audio-test-balance", "-40");
  118 |   // 페이드인 4초 — 다음 재생에 적용된다.
  119 |   await setSlider(page, "audio-test-fade", "4");
  120 |
  121 |   await expect(page.getByTestId("audio-test-volume-value")).toHaveText("음량 40%");
  122 |   await expect(page.getByTestId("audio-test-tempo-value")).toHaveText("템포 135%");
  123 |   await expect(page.getByTestId("audio-test-balance-value")).toHaveText("밸런스 왼쪽 40");
  124 |   await expect(page.getByTestId("audio-test-fade-value")).toHaveText("페이드인 4초");
  125 |
  126 |   const after = await readAudio(page);
  127 |   expect(after.volume.bgm).toBeCloseTo(0.4, 2);
  128 |   expect(after.playbackRate).toBeCloseTo(1.35, 2);
  129 |   expect(after.pan).toBeCloseTo(-0.4, 2); // -40/100 — 슬라이더 범위가 -100..100 이므로 전체 행정이 pan -1..1 을 덮는다
  130 |   expect(after.fadeInMs).toBe(4000);
  131 |   // 실제 미디어 엘리먼트에 닿았는지 교차 검증 — 정지 없이 즉시 반영이다.
  132 |   expect(after.mediaVolume).not.toBeNull();
  133 |   expect(after.mediaVolume!).toBeCloseTo(0.4, 2);
  134 |   expect(after.mediaRate!).toBeCloseTo(1.35, 2);
  135 |   // 값이 실제로 변했다.
  136 |   expect(after.playbackRate).not.toBeCloseTo(before.playbackRate, 2);
  137 |   expect(after.pan).not.toBeCloseTo(before.pan, 2);
  138 | });
  139 |
  140 | test("list filter keeps (꺼짐) first and MIDI rows are marked unplayable", async ({ page }) => {
  141 |   await openAudioDialog(page);
```
