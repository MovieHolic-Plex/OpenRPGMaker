import { expect, test, type Locator, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

// SIZE_OK: This proof keeps editor-authoring helpers and screenshot assertions
// together so the generated gameplay evidence remains reproducible.

/*
 * 저작 손잡이의 실측 계약(2026-08-29, 진단 프로브로 확인):
 *  - 명령을 고르면 종류별 전용 다이얼로그가 아니라 **공용 편집 모달**
 *    (`event-command-edit-dialog`)이 열리고 확인은 `event-command-edit-ok` 다.
 *    `event-command-text-dialog` / `-faceset-dialog` / `-display-options-dialog` 는
 *    DOM 에 아예 없다(count=0) — 프로덕션에서 호출되지 않는 유산이었다.
 *  - 표시 형식·위치의 `select` 는 `hidden` 이라 `selectOption` 이 액셔너빌리티에서
 *    막힌다. 실물 손잡이는 `...-segment-<key>` 버튼이고 선택 상태는 `aria-pressed` 다.
 *  - 기본 보기는 스토리라 평면 명령 줄이 `hidden` 이다. `.cmd-head` 를 두 번 눌러
 *    편집하려면 목록 보기로 먼저 바꿔야 한다(스토리 카드는 한 번 클릭이 편집).
 *
 * 명령마다 모달을 한 번 여닫으므로 30초 기본값으로는 모자라다. 옵션 설정을 추가와 같은
 * 모달에서 끝내 왕복을 줄였지만, 부하가 높은 공유 머신에서는 액션당 1초를 넘길 때가 있어
 * 여유를 둔다(같은 계열의 oprn-dialogue-choice-ux-cert 도 120초를 쓴다).
 */
test.setTimeout(180_000);

/*
 * 첫 테스트가 dev 서버의 콜드 변환을 자기 예산으로 물지 않게 파일 시작에 한 번 띄운다.
 * 실측 2026-08-29(공유 머신, load 70): 첫 로드에서 `layer-event` 가 3분 안에 안 나와
 * 첫 테스트만 죽었다 — 두 번째·세 번째는 같은 흐름으로 통과했다. 훅 기본 예산은 테스트
 * 예산과 같으므로 개별 대기는 그 안에 들어가게 잡고, 늘려주는 환경에서는 여유를 더 쓴다.
 */
test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await browser.newPage();
  try {
    await page.goto("/?freshProject=1&warmup=1", { timeout: 150_000 });
    await page.getByTestId("layer-event").waitFor({ state: "visible", timeout: 25_000 });
  } finally {
    await page.close();
  }
});

type EventCommand = {
  readonly kind: string;
  readonly body?: string;
  readonly resourceId?: string;
  readonly flipHorizontally?: boolean;
  readonly format?: string;
  readonly position?: string;
  readonly preventObscuringPlayer?: boolean;
  readonly allowEventMovementDuringWait?: boolean;
  readonly prompt?: string;
  readonly options?: readonly { readonly text?: string }[];
};

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<
      string,
      {
        readonly events: readonly {
          readonly id: string;
          readonly pages?: readonly {
            readonly commands: readonly EventCommand[];
          }[];
        }[];
      }
    >;
  };
};

const EVIDENCE_SCREENSHOT = ".omo/ulw-loop/event-command-modal-flow/evidence/C004-play-face-text-dialogue.png";
const ANIMATION_EVIDENCE_SCREENSHOT =
  ".omo/ulw-loop/event-command-modal-flow/evidence/C005-character-chipset-animation.png";
const DISPLAY_TEXT_SETTINGS_EDITOR_SCREENSHOT = ".omo/ulw-loop/evidence/display-text-settings-editor.png";
const DISPLAY_TEXT_SETTINGS_PLAY_SCREENSHOT = ".omo/ulw-loop/evidence/display-text-settings-play.png";
const DISPLAY_OPTIONS_FACESET_TEXT_SCREENSHOT = ".omo/ulw-loop/evidence/display-options-faceset-text-play.png";
const DISPLAY_OPTIONS_FACESET_CHOICES_SCREENSHOT = ".omo/ulw-loop/evidence/display-options-faceset-choices-play.png";
const FACE_TEXT_BODY = "얼굴 그래픽과 문장 표시 작동!";
const DISPLAY_TEXT_SETTINGS_BODY = "문장 표시 설정 증거: 상단 투명창";
const DISPLAY_OPTIONS_FACESET_BODY = "프레임이 있는 기본 대화창";
const DISPLAY_OPTIONS_CHOICES_PROMPT = "선택지를 고르세요";
const HERO_CHARSET_RESOURCE_ID = "easyrpg-charset-actor1";
const HERO_CHARSET_TEXTURE_KEY = "tex_easyrpg_charset_actor1";
const LEGACY_NPC_TEXTURE_KEY = "tex_easyrpg_charset_people1";

type PlayerSpriteDebug = {
  readonly textureKey: string;
  readonly frame: string | number;
  readonly resourceId: string;
  readonly kind: string;
  readonly moving: boolean;
  readonly x: number;
  readonly y: number;
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  // 가운데를 찍지 않는다 — AI 조수 패널이 캔버스 중앙을 덮고 있어 히트 테스트가 통과하지
  // 못한다(실측 2026-08-28: 실패 스크린샷에서 패널이 x 320~840 을 가림). 오른쪽 3/4 지점은
  // 항상 맵이다. 1500ms 는 WebGL 캔버스 안정화에 빠듯해 여유를 준다.
  const position = { x: Math.floor(box.width * 0.75), y: Math.floor(box.height / 2) };
  try {
    await canvas.dblclick({ position, timeout: 5000 });
  } catch (error) {
    // 빈 칸을 찍으면 첫 클릭만으로 새 이벤트가 만들어지고 편집기가 바로 열린다. 그러면
    // 두 번째 클릭이 모달에 가려 dblclick 자체는 완료되지 않는다(실측 2026-08-28: 실패
    // 스크린샷에 이미 "새 이벤트" 편집기가 떠 있었다). 이 함수의 목적은 편집기를 여는
    // 것이므로 열렸으면 성공으로 본다.
    if (!(await page.getByTestId("event-editor-modal").isVisible().catch(() => false))) throw error;
  }
}

async function tryOpenSelectedEvent(page: Page): Promise<boolean> {
  await page.getByTestId("event-editor-open").click();
  return page.getByTestId("event-editor-modal").isVisible().catch(() => false);
}

async function openEventEditor(page: Page): Promise<void> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await expect(page.getByTestId("layer-event")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("tool-event")).toHaveAttribute("aria-pressed", "true");

  const editor = page.getByTestId("event-editor-modal");
  if (await editor.isVisible().catch(() => false)) return;
  await clickMapCenter(page);
  try {
    await editor.waitFor({ state: "visible", timeout: 1000 });
  } catch {
    await tryOpenSelectedEvent(page);
  }
  await expect(editor).toBeVisible();
}

/** 평면 명령 줄은 스토리 보기에서 `hidden` 이다 — 줄을 눌러 편집하려면 목록 보기로 바꾼다. */
async function useCommandListView(page: Page): Promise<void> {
  const toggle = page.getByTestId("event-view-toggle-list");
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-pressed")) === "true") return;
  await toggle.click();
  // 목록 보기에서는 마지막 줄에 "빈 명령 줄"이 항상 있어 추가 진입점이 된다.
  await expect(page.getByTestId("event-command-empty-line")).toBeVisible();
}

async function openRootCommandPicker(page: Page): Promise<void> {
  const picker = page.getByTestId("event-command-picker");
  if (await picker.isVisible().catch(() => false)) return;
  // 추가 진입점은 보기 방식에 따라 다르다: 목록은 빈 명령 줄(두 번 클릭),
  // 스토리는 "+ 다음 명령"(한 번 클릭). 둘 다 같은 피커를 연다.
  const emptyLine = page.getByTestId("event-command-empty-line");
  const storyboardAdd = page.getByTestId("event-storyboard-add");
  if (await emptyLine.isVisible().catch(() => false)) await emptyLine.dblclick();
  else {
    await expect(storyboardAdd).toBeVisible();
    await storyboardAdd.click();
  }
  await expect(picker).toBeVisible();
}

const commandEditDialog = (page: Page): Locator => page.getByTestId("event-command-edit-dialog");

/** 피커에서 종류를 고르면 곧바로 공용 편집 모달이 열린다. 그 모달을 돌려준다. */
async function pickCommand(page: Page, kind: string): Promise<Locator> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId(`command-picker-add-${kind}`).click();
  await expect(picker).toBeHidden();
  const dialog = commandEditDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * 이미 추가된 명령 줄에서 같은 공용 편집 모달을 연다(목록 보기 전제).
 * 두 번 클릭은 쓰지 않는다 — 첫 클릭이 오른쪽 "선택한 명령" 칼럼을 펼쳐 목록 폭이 줄고,
 * 좌표가 미리 정해진 두 번째 클릭이 딴 곳에 떨어진다(실측 2026-08-29: dblclick 은 성공으로
 * 보고되지만 모달이 안 열린다). 한 번 눌러 선택한 뒤 `.cmd-head` 가 스스로 광고하는
 * 손잡이(`aria-keyshortcuts="Enter Space"`)의 Space 를 쓴다.
 */
async function openCommandEdit(page: Page, kind: string): Promise<Locator> {
  const head = page.getByTestId(`event-command-${kind}`).last().locator(".cmd-head");
  await head.click();
  await head.press(" ");
  const dialog = commandEditDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function confirmCommandEdit(page: Page): Promise<void> {
  await page.getByTestId("event-command-edit-ok").click();
  await expect(commandEditDialog(page)).toBeHidden();
}

async function addFaceCommand(page: Page): Promise<void> {
  await pickCommand(page, "changeFace");
  // 기본값이 곧 증거가 요구하는 값이다(easyrpg-faceset-actor1-00 · 왼쪽).
  await confirmCommandEdit(page);
  await expect(page.getByTestId("event-command-changeFace").last()).toContainText("얼굴 바꾸기");
}

async function addTextCommand(page: Page, body = FACE_TEXT_BODY): Promise<void> {
  const dialog = await pickCommand(page, "text");
  await dialog.getByTestId("event-command-text-speaker").fill("증거 NPC");
  await dialog.getByTestId("event-command-text-body").fill(body);
  await confirmCommandEdit(page);
  await expect(page.getByTestId("event-command-text").last()).toContainText(body);
}

/** 문장 표시 설정을 기본값(일반·하단·가림 방지·이동 금지)인지 확인만 하고 추가한다. */
async function addDefaultDisplayTextSettings(page: Page): Promise<void> {
  const dialog = await pickCommand(page, "displayTextSettings");
  await expect(dialog.getByTestId("event-command-message-format-segment-normal")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(dialog.getByTestId("event-command-message-position-segment-bottom")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(dialog.getByTestId("event-command-message-prevent-obscuring")).toBeChecked();
  await expect(dialog.getByTestId("event-command-message-allow-movement")).not.toBeChecked();
  await confirmCommandEdit(page);
  await expect(page.getByTestId("event-command-displayTextSettings").last()).toContainText("일반");
}

/** 증거용 옵션(투명·상단·가림 방지 해제·이동 허용)까지 추가와 같은 모달에서 끝낸다. */
async function addTransparentTopDisplayTextSettings(page: Page): Promise<void> {
  const dialog = await pickCommand(page, "displayTextSettings");
  const transparent = dialog.getByTestId("event-command-message-format-segment-transparent");
  const top = dialog.getByTestId("event-command-message-position-segment-top");
  await transparent.click();
  await top.click();
  await dialog.getByTestId("event-command-message-prevent-obscuring").uncheck();
  await dialog.getByTestId("event-command-message-allow-movement").check();
  await expect(transparent).toHaveAttribute("aria-pressed", "true");
  await expect(top).toHaveAttribute("aria-pressed", "true");
  await confirmCommandEdit(page);
  const row = page.getByTestId("event-command-displayTextSettings").last();
  await expect(row).toContainText("투명");
  await expect(row).toContainText("상단");
  await expect(row).toContainText("이동 허용");
}

/** 얼굴 바꾸기: 왼쪽 기본값을 확인하고 좌우 반전만 켠다. */
async function addFlippedFaceCommand(page: Page): Promise<void> {
  const dialog = await pickCommand(page, "changeFace");
  await expect(dialog.getByTestId("event-command-face-position")).toHaveValue("left");
  await dialog.getByTestId("event-command-face-flip-horizontal").check();
  await confirmCommandEdit(page);
  const row = page.getByTestId("event-command-changeFace").last();
  await expect(row).toContainText("얼굴 바꾸기");
  await expect(row).toContainText("좌우 반전");
}

/** 선택지: 2지(예/아니오)와 취소=선택지2 는 기본값이라 확인만 하고 질문만 채운다. */
async function addChoicesCommand(page: Page): Promise<void> {
  const dialog = await pickCommand(page, "choices");
  await dialog.getByTestId("event-choice-prompt").fill(DISPLAY_OPTIONS_CHOICES_PROMPT);
  await expect(dialog.getByTestId("event-choice-option-1")).toHaveValue("예");
  await expect(dialog.getByTestId("event-choice-option-2")).toHaveValue("아니오");
  await expect(dialog.getByTestId("event-choice-cancel-choice2")).toBeChecked();
  await confirmCommandEdit(page);
  // 요약은 "선택지 표시: <질문>  1.예 2.아니오" 형태다.
  const row = page.getByTestId("event-command-choices").last();
  await expect(row).toContainText(DISPLAY_OPTIONS_CHOICES_PROMPT);
  await expect(row).toContainText("1.예");
  await expect(row).toContainText("2.아니오");
}

async function authoredEventId(page: Page): Promise<string> {
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const event = map.events.find((entry) =>
    entry.pages?.some((pageEntry) =>
      pageEntry.commands.some((command) => command.kind === "text" && command.body === FACE_TEXT_BODY) &&
      pageEntry.commands.some((command) => command.kind === "changeFace" && command.resourceId === "easyrpg-faceset-actor1-00")
    )
  );
  if (!event) throw new Error("missing authored face/text event");
  return event.id;
}

async function authoredDisplayTextSettingsEventId(page: Page): Promise<string> {
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const event = map.events.find((entry) =>
    entry.pages?.some(
      (pageEntry) =>
        pageEntry.commands.some(
          (command) =>
            command.kind === "displayTextSettings" &&
            command.format === "transparent" &&
            command.position === "top" &&
            command.preventObscuringPlayer === false &&
            command.allowEventMovementDuringWait === true
        ) && pageEntry.commands.some((command) => command.kind === "text" && command.body === DISPLAY_TEXT_SETTINGS_BODY)
    )
  );
  if (!event) throw new Error("missing authored display text settings event");
  return event.id;
}

async function authoredDisplayOptionsFacesetChoicesEventId(page: Page): Promise<string> {
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const event = map.events.find((entry) =>
    entry.pages?.some(
      (pageEntry) =>
        pageEntry.commands.some(
          (command) =>
            command.kind === "displayTextSettings" &&
            command.format === "normal" &&
            command.position === "bottom" &&
            command.preventObscuringPlayer === true &&
            command.allowEventMovementDuringWait === false
        ) &&
        pageEntry.commands.some(
          (command) =>
            command.kind === "changeFace" &&
            command.resourceId === "easyrpg-faceset-actor1-00" &&
            command.flipHorizontally === true
        ) &&
        pageEntry.commands.some((command) => command.kind === "text" && command.body === DISPLAY_OPTIONS_FACESET_BODY) &&
        pageEntry.commands.some(
          (command) =>
            command.kind === "choices" &&
            command.prompt === DISPLAY_OPTIONS_CHOICES_PROMPT &&
            command.options?.[0]?.text === "예" &&
            command.options?.[1]?.text === "아니오"
        )
    )
  );
  if (!event) throw new Error("missing authored display options/faceset/choices event");
  return event.id;
}

async function playerSpriteDebug(page: Page): Promise<PlayerSpriteDebug | null> {
  return page.evaluate(() => {
    type RuntimePlayerSpriteDebug = {
      readonly textureKey: string;
      readonly frame: string | number;
      readonly resourceId: string;
      readonly kind: string;
      readonly moving: boolean;
      readonly x: number;
      readonly y: number;
    };
    type HookedWindow = Window & {
      readonly __oprnPlayerSprite?: () => RuntimePlayerSpriteDebug | null;
    };
    return (window as HookedWindow).__oprnPlayerSprite?.() ?? null;
  });
}

async function setInjectedDirection(page: Page, direction: "down" | "left" | "right" | "up" | null): Promise<void> {
  await page.evaluate((nextDirection) => {
    type HookedWindow = Window & {
      readonly __oprnInput?: {
        readonly dir: (direction: "down" | "left" | "right" | "up" | null) => void;
      };
    };
    (window as HookedWindow).__oprnInput?.dir(nextDirection);
  }, direction);
}

async function expectHeroCharsetAnimation(page: Page): Promise<void> {
  const initialSprite = await playerSpriteDebug(page);
  expect(initialSprite, "player sprite debug hook should be installed").not.toBeNull();
  if (!initialSprite) throw new Error("missing player sprite debug hook");
  expect(initialSprite.resourceId).toBe(HERO_CHARSET_RESOURCE_ID);
  expect(initialSprite.textureKey).toBe(HERO_CHARSET_TEXTURE_KEY);
  expect(initialSprite.textureKey).not.toBe(LEGACY_NPC_TEXTURE_KEY);

  const initialFrame = String(initialSprite.frame);
  await setInjectedDirection(page, "right");
  await expect.poll(async () => {
    const sprite = await playerSpriteDebug(page);
    return (
      sprite?.resourceId === HERO_CHARSET_RESOURCE_ID &&
      sprite.textureKey === HERO_CHARSET_TEXTURE_KEY &&
      String(sprite.frame) !== initialFrame
    );
  }, { timeout: 2500 }).toBe(true);
  await page.screenshot({ path: ANIMATION_EVIDENCE_SCREENSHOT, fullPage: true });
  await setInjectedDirection(page, null);
  await expect.poll(async () => (await playerSpriteDebug(page))?.moving ?? true, { timeout: 2500 }).toBe(false);
}

async function expectBottomDialogueLayout(page: Page): Promise<void> {
  const canvas = page.getByTestId("play-canvas").locator("canvas");
  const dialogue = page.getByTestId("dialogue-box");
  const stageBox = await canvas.boundingBox();
  const dialogueBox = await dialogue.boundingBox();
  if (!stageBox || !dialogueBox) throw new Error("missing play canvas or dialogue box bounds");

  expect(dialogueBox.width).toBeGreaterThan(stageBox.width * 0.86);
  expect(dialogueBox.height).toBeLessThan(stageBox.height * 0.42);
  expect(dialogueBox.y + dialogueBox.height).toBeGreaterThan(stageBox.y + stageBox.height * 0.9);
  expect(dialogueBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height * 0.58 - 1);
  expect(Math.abs(dialogueBox.x - stageBox.x)).toBeLessThanOrEqual(stageBox.width * 0.08);
}

/**
 * 대사 본문은 타이핑 연출로 한 글자씩 채워진다. 창 전체 텍스트를 보면 화자 이름표와 커서가
 * 본문 중간값에 섞여 매칭이 깨지므로(실측 2026-08-29: "…상단 투증거 NPC▼") 본문만 보고,
 * 부하가 높으면 타이핑이 5초를 넘기므로 여유를 준다.
 */
async function expectDialogueBody(page: Page, body: string): Promise<void> {
  await expect(page.getByTestId("dialogue-box").locator(".body")).toContainText(body, { timeout: 20_000 });
}

async function expectRuntimeDialogueFont(page: Page): Promise<void> {
  const fontFamily = await page.getByTestId("dialogue-box").locator(".body").evaluate((node) =>
    getComputedStyle(node).fontFamily
  );
  expect(fontFamily).not.toContain("Cascadia Mono");
  expect(fontFamily).toMatch(/DotGothic16|DungGeunMo|Galmuri|MS Gothic|GulimChe|DotumChe/);
}

async function expectTopTransparentDialogueLayout(page: Page): Promise<void> {
  const canvas = page.getByTestId("play-canvas").locator("canvas");
  const dialogue = page.getByTestId("dialogue-box");
  await expect(dialogue).toHaveAttribute("data-message-format", "transparent");
  await expect(dialogue).toHaveAttribute("data-message-position", "top");
  await expect(dialogue).toHaveClass(/transparent/);
  const stageBox = await canvas.boundingBox();
  const dialogueBox = await dialogue.boundingBox();
  if (!stageBox || !dialogueBox) throw new Error("missing play canvas or dialogue box bounds");

  expect(dialogueBox.width).toBeGreaterThan(stageBox.width * 0.86);
  expect(dialogueBox.height).toBeLessThan(stageBox.height * 0.42);
  expect(dialogueBox.y).toBeLessThanOrEqual(stageBox.y + stageBox.height * 0.16);
}

async function expectFramedBottomDialogueWithFace(page: Page): Promise<void> {
  const dialogue = page.getByTestId("dialogue-box");
  await expect(dialogue).toHaveAttribute("data-message-format", "normal");
  await expect(dialogue).toHaveAttribute("data-message-position", "bottom");
  await expect(dialogue).not.toHaveClass(/transparent/);
  await expect(page.getByTestId("dialogue-face")).toBeVisible();
  await expectSpeakerInChatColumn(page);
  await expectFaceVisibleAndContained(page);
  await expectBottomDialogueLayout(page);
}

async function expectSpeakerInChatColumn(page: Page): Promise<void> {
  const dialogue = page.getByTestId("dialogue-box");
  const speaker = dialogue.getByTestId("dialogue-speaker");
  await expect(speaker).toContainText("증거 NPC");
  await expect(speaker).toHaveClass(/speaker-nameplate/);
  const speakerBox = await speaker.boundingBox();
  const bodyBox = await dialogue.locator(".dialogue-content .body").boundingBox();
  const faceBox = await page.getByTestId("dialogue-face").boundingBox();
  if (!speakerBox || !bodyBox || !faceBox) throw new Error("missing dialogue layout bounds");
  // Nameplate sits on the message-window rim above the body text.
  expect(speakerBox.y).toBeLessThanOrEqual(bodyBox.y + 2);
  expect(speakerBox.x).toBeGreaterThanOrEqual(faceBox.x - 8);
}

async function expectFaceVisibleAndContained(page: Page): Promise<void> {
  const dialogueBox = await page.getByTestId("dialogue-box").boundingBox();
  const faceBox = await page.getByTestId("dialogue-face").boundingBox();
  if (!dialogueBox || !faceBox) throw new Error("missing dialogue face bounds");
  expect(faceBox.x).toBeGreaterThanOrEqual(dialogueBox.x);
  expect(faceBox.y).toBeGreaterThanOrEqual(dialogueBox.y);
  expect(faceBox.x + faceBox.width).toBeLessThanOrEqual(dialogueBox.x + dialogueBox.width);
  expect(faceBox.y + faceBox.height).toBeLessThanOrEqual(dialogueBox.y + dialogueBox.height);
  expect(faceBox.width).toBeGreaterThanOrEqual(dialogueBox.height * 0.45);
  expect(faceBox.height).toBeGreaterThanOrEqual(dialogueBox.height * 0.45);
}

async function expectRuntimeChoices(page: Page): Promise<void> {
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await expect(page.getByTestId("runtime-choice-0")).toContainText("예");
  await expect(page.getByTestId("runtime-choice-1")).toContainText("아니오");
  await expect(page.getByTestId("dialogue-box")).toHaveAttribute("data-message-format", "normal");
  const geometry = await page.evaluate(() => {
    const rect = (selector: string): { readonly top: number; readonly bottom: number } => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return { top: 0, bottom: 0 };
      const bounds = node.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    };
    return {
      choice1: rect('[data-testid="runtime-choice-1"]'),
      choices: rect('[data-testid="runtime-choices"]'),
      window: rect('[data-testid="dialogue-box"]'),
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry.choices.top).toBeGreaterThanOrEqual(geometry.window.top);
  expect(geometry.choices.bottom).toBeLessThanOrEqual(geometry.window.bottom);
  expect(geometry.choice1.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
}

test("editor-authored face graphic and show text render together in actual play mode", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1&faceTextProof=1");

  await openEventEditor(page);
  await useCommandListView(page);
  await expect(page.getByTestId("event-command-text")).toHaveCount(0);
  await addFaceCommand(page);
  await addTextCommand(page);
  await page.getByTestId("event-editor-apply").click();

  const eventId = await authoredEventId(page);
  await page.getByTestId("event-editor-modal-close").click();
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await expectHeroCharsetAnimation(page);
  await page.getByTestId(`event-${eventId}`).click();

  const dialogue = page.getByTestId("dialogue-box");
  await expect(dialogue).toContainText("증거 NPC");
  await expectDialogueBody(page, FACE_TEXT_BODY);
  await expect(page.getByTestId("dialogue-face")).toBeVisible();
  await expectBottomDialogueLayout(page);
  await expectRuntimeDialogueFont(page);
  await page.screenshot({ path: EVIDENCE_SCREENSHOT, fullPage: true });
});

test("editor-authored display text settings render as a top transparent message window in actual play mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1&displayTextSettingsProof=1");

  await openEventEditor(page);
  await useCommandListView(page);
  await addTransparentTopDisplayTextSettings(page);
  await addTextCommand(page, DISPLAY_TEXT_SETTINGS_BODY);
  // 저작 증거: 설정 명령을 다시 열어 실제 편집면을 찍고 닫는다(모달이 열린 채로는
  // 적용 버튼을 누를 수 없다).
  await openCommandEdit(page, "displayTextSettings");
  await page.screenshot({ path: DISPLAY_TEXT_SETTINGS_EDITOR_SCREENSHOT, fullPage: true });
  await confirmCommandEdit(page);
  await page.getByTestId("event-editor-apply").click();

  const eventId = await authoredDisplayTextSettingsEventId(page);
  await page.getByTestId("event-editor-modal-close").click();
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await page.getByTestId(`event-${eventId}`).click();

  await expectDialogueBody(page, DISPLAY_TEXT_SETTINGS_BODY);
  await expectTopTransparentDialogueLayout(page);
  await page.screenshot({ path: DISPLAY_TEXT_SETTINGS_PLAY_SCREENSHOT, fullPage: true });
});

test("display text options faceset and choices apply to real gameplay from the event editor", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1&displayOptionsFacesetChoicesProof=1");

  await openEventEditor(page);
  await useCommandListView(page);
  await addDefaultDisplayTextSettings(page);
  await addFlippedFaceCommand(page);
  await addTextCommand(page, DISPLAY_OPTIONS_FACESET_BODY);
  await addChoicesCommand(page);
  await page.getByTestId("event-editor-apply").click();

  const eventId = await authoredDisplayOptionsFacesetChoicesEventId(page);
  await page.getByTestId("event-editor-modal-close").click();
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await page.getByTestId(`event-${eventId}`).click();

  await expectDialogueBody(page, DISPLAY_OPTIONS_FACESET_BODY);
  await expectFramedBottomDialogueWithFace(page);
  await page.screenshot({ path: DISPLAY_OPTIONS_FACESET_TEXT_SCREENSHOT, fullPage: true });

  await page.getByTestId("dialogue-box").click();
  await expectRuntimeChoices(page);
  await page.screenshot({ path: DISPLAY_OPTIONS_FACESET_CHOICES_SCREENSHOT, fullPage: true });
  await page.getByTestId("runtime-choice-0").click();
  await expect(page.getByTestId("runtime-choices")).toBeHidden();
  await expect(page.getByTestId("dialogue-box")).toBeHidden();
});
