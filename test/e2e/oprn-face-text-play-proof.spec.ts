import { expect, test, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

// SIZE_OK: This proof keeps editor-authoring helpers and screenshot assertions
// together so the generated gameplay evidence remains reproducible.

// 명령을 하나 추가할 때마다 편집 모달이 자동으로 열려 닫아 줘야 한다 — 저작 흐름이
// 길어져 60초로는 모자란다(실측 2026-08-28: 헬퍼 도중 페이지가 강제로 닫혔다).
// 같은 계열의 oprn-dialogue-choice-ux-cert 도 120초를 쓴다.
test.setTimeout(120_000);

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
  await expect(page.getByTestId("layer-event")).toHaveAttribute("aria-pressed", "true");
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

async function openRootCommandPicker(page: Page): Promise<void> {
  const picker = page.getByTestId("event-command-picker");
  if (await picker.isVisible().catch(() => false)) return;
  // 명령 목록에는 두 가지 추가 진입점이 있고, 어느 쪽이 보이는지는 목록/스토리 뷰에 따라
  // 다르다. 기본이 스토리 뷰라 event-command-empty-line 은 없고 "+ 첫 명령 추가"
  // (event-storyboard-add)만 있다(실측 2026-08-28).
  const emptyLine = page.getByTestId("event-command-empty-line");
  const storyboardAdd = page.getByTestId("event-storyboard-add");
  if (await emptyLine.isVisible().catch(() => false)) await emptyLine.dblclick();
  else {
    await expect(storyboardAdd).toBeVisible();
    await storyboardAdd.click();
  }
  await expect(picker).toBeVisible();
}

/**
 * 명령을 고르면 곧바로 명령 편집 모달이 열린다. 목록/스토리의 명령 줄은 그 모달이 닫혀야
 * 나타나므로, 추가 직후 확인으로 닫아 준다(실측 2026-08-28). 전용 서브다이얼로그
 * (문장 표시 / 표시 옵션 등)를 이미 닫은 경로에서는 아무 일도 하지 않는다.
 */
async function closeCommandEditDialog(page: Page): Promise<void> {
  const backdrop = page.getByTestId("event-command-edit-dialog");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await backdrop.first().isVisible().catch(() => false))) return;
    const ok = page.getByRole("button", { name: "확인", exact: true });
    if (await ok.first().isVisible().catch(() => false)) await ok.first().click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

async function addFaceCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-changeFace").click();
  await expect(picker).toBeHidden();
  await closeCommandEditDialog(page);
  await expect(page.getByTestId("event-command-changeFace")).toContainText("얼굴 바꾸기");
}

async function addTextCommand(page: Page, body = FACE_TEXT_BODY): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-text").click();
  // 전용 「문장 표시」 다이얼로그로 열릴 수도, 공용 명령 편집 모달 안에 같은 입력들이
  // 들어올 수도 있다(실측 2026-08-28: 지금은 후자다). 필드는 testid 가 같으므로 어느
  // 쪽이든 그대로 채우고, 열려 있는 창을 닫는다.
  const dialog = page.getByTestId("event-command-text-dialog");
  const speaker = page.getByTestId("event-command-text-speaker");
  await expect(speaker.first()).toBeVisible();
  await speaker.first().fill("증거 NPC");
  await page.getByTestId("event-command-text-body").first().fill(body);
  const ok = page.getByTestId("event-command-text-ok");
  if (await ok.first().isVisible().catch(() => false)) {
    await ok.first().click();
    await expect(dialog).toBeHidden();
  }
  await expect(picker).toBeHidden();
  await closeCommandEditDialog(page);
  await expect(page.getByTestId("event-command-text")).toContainText(body);
}

async function addDisplayTextSettingsCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-displayTextSettings").click();
  await expect(picker).toBeHidden();
  await closeCommandEditDialog(page);
  await expect(page.getByTestId("event-command-displayTextSettings")).toContainText("문장 표시 설정");
}

async function addDisplayOptionsViaDialog(page: Page): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-displayTextSettings").click();
  const dialog = page.getByTestId("event-command-display-options-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("display-options-format-normal")).toBeChecked();
  await expect(dialog.getByTestId("display-options-position-bottom")).toBeChecked();
  await expect(dialog.getByTestId("display-options-prevent-obscuring")).toBeChecked();
  await expect(dialog.getByTestId("display-options-allow-movement")).not.toBeChecked();
  await dialog.getByTestId("display-options-ok").click();
  await expect(dialog).toBeHidden();
  await expect(picker).toBeHidden();
  await closeCommandEditDialog(page);
  await expect(page.getByTestId("event-command-displayTextSettings")).toContainText("일반");
}

async function addFacesetViaDialog(page: Page): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-changeFace").click();
  const dialog = page.getByTestId("event-command-faceset-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("faceset-position-left").check();
  await dialog.getByTestId("faceset-flip-horizontal").check();
  await dialog.getByTestId("faceset-ok").click();
  await expect(dialog).toBeHidden();
  await expect(picker).toBeHidden();
  await expect(page.getByTestId("event-command-changeFace")).toContainText("얼굴 바꾸기");
}

async function openChoicesInlineEditor(page: Page): Promise<void> {
  const command = page.getByTestId("event-command-choices");
  const editor = command.getByTestId("event-command-choices-inline-editor");
  if (!(await editor.isVisible().catch(() => false))) {
    await command.locator(".cmd-head").dblclick();
  }
  await expect(editor).toBeVisible();
}

async function fillChoiceInlineField(page: Page, testId: string, value: string): Promise<void> {
  await openChoicesInlineEditor(page);
  const input = page.getByTestId(testId);
  await input.fill(value);
  await input.blur();
}

async function addChoicesInline(page: Page): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-choices").click();
  await expect(picker).toBeHidden();
  await fillChoiceInlineField(page, "event-choice-prompt", DISPLAY_OPTIONS_CHOICES_PROMPT);
  await fillChoiceInlineField(page, "event-choice-option-1", "예");
  await fillChoiceInlineField(page, "event-choice-option-2", "아니오");
  await openChoicesInlineEditor(page);
  await page.getByTestId("event-choice-cancel-choice2").check();
  await expect(page.getByTestId("event-command-choices")).toContainText("예 / 아니오");
}

async function openDisplayTextSettingsInlineEditor(page: Page): Promise<void> {
  const command = page.getByTestId("event-command-displayTextSettings");
  const format = command.getByTestId("event-command-message-format");
  if (!(await format.isVisible().catch(() => false))) {
    await command.locator(".cmd-head").dblclick();
  }
  await expect(format).toBeVisible();
}

async function setDisplayTextSettingsProofOptions(page: Page): Promise<void> {
  const command = page.getByTestId("event-command-displayTextSettings");

  await openDisplayTextSettingsInlineEditor(page);
  await command.getByTestId("event-command-message-format").selectOption("transparent");
  await expect(command).toContainText("투명");

  await openDisplayTextSettingsInlineEditor(page);
  await command.getByTestId("event-command-message-position").selectOption("top");
  await expect(command).toContainText("상단");

  await openDisplayTextSettingsInlineEditor(page);
  await command.getByTestId("event-command-message-prevent-obscuring").uncheck();

  await openDisplayTextSettingsInlineEditor(page);
  await command.getByTestId("event-command-message-allow-movement").check();
  await expect(command).toContainText("이동 허용");
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
  await expect(dialogue).toContainText(FACE_TEXT_BODY);
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
  await addDisplayTextSettingsCommand(page);
  await setDisplayTextSettingsProofOptions(page);
  await addTextCommand(page, DISPLAY_TEXT_SETTINGS_BODY);
  await page.getByTestId("event-command-text").last().locator(".cmd-head").dblclick();
  await page.screenshot({ path: DISPLAY_TEXT_SETTINGS_EDITOR_SCREENSHOT, fullPage: true });
  await page.getByTestId("event-editor-apply").click();

  const eventId = await authoredDisplayTextSettingsEventId(page);
  await page.getByTestId("event-editor-modal-close").click();
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await page.getByTestId(`event-${eventId}`).click();

  const dialogue = page.getByTestId("dialogue-box");
  await expect(dialogue).toContainText(DISPLAY_TEXT_SETTINGS_BODY);
  await expectTopTransparentDialogueLayout(page);
  await page.screenshot({ path: DISPLAY_TEXT_SETTINGS_PLAY_SCREENSHOT, fullPage: true });
});

test("display text options faceset and choices apply to real gameplay from the event editor", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1&displayOptionsFacesetChoicesProof=1");

  await openEventEditor(page);
  await addDisplayOptionsViaDialog(page);
  await addFacesetViaDialog(page);
  await addTextCommand(page, DISPLAY_OPTIONS_FACESET_BODY);
  await addChoicesInline(page);
  await page.getByTestId("event-editor-apply").click();

  const eventId = await authoredDisplayOptionsFacesetChoicesEventId(page);
  await page.getByTestId("event-editor-modal-close").click();
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await page.getByTestId(`event-${eventId}`).click();

  await expect(page.getByTestId("dialogue-box")).toContainText(DISPLAY_OPTIONS_FACESET_BODY);
  await expectFramedBottomDialogueWithFace(page);
  await page.screenshot({ path: DISPLAY_OPTIONS_FACESET_TEXT_SCREENSHOT, fullPage: true });

  await page.getByTestId("dialogue-box").click();
  await expectRuntimeChoices(page);
  await page.screenshot({ path: DISPLAY_OPTIONS_FACESET_CHOICES_SCREENSHOT, fullPage: true });
  await page.getByTestId("runtime-choice-0").click();
  await expect(page.getByTestId("runtime-choices")).toBeHidden();
  await expect(page.getByTestId("dialogue-box")).toBeHidden();
});
