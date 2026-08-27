import { expect, test, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

// SIZE_OK: This proof keeps editor-authoring helpers and screenshot assertions
// together so the generated gameplay evidence remains reproducible.

test.setTimeout(60_000);

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
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) }, timeout: 1500 });
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
  const emptyLine = page.getByTestId("event-command-empty-line");
  await expect(emptyLine).toBeVisible();
  await emptyLine.dblclick();
  await expect(picker).toBeVisible();
}

async function addFaceCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-changeFace").click();
  await expect(picker).toBeHidden();
  await expect(page.getByTestId("event-command-changeFace")).toContainText("얼굴 바꾸기");
}

async function addTextCommand(page: Page, body = FACE_TEXT_BODY): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-text").click();
  const dialog = page.getByTestId("event-command-text-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("event-command-text-speaker").fill("증거 NPC");
  await dialog.getByTestId("event-command-text-body").fill(body);
  await dialog.getByTestId("event-command-text-ok").click();
  await expect(dialog).toBeHidden();
  await expect(picker).toBeHidden();
}

async function addDisplayTextSettingsCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-displayTextSettings").click();
  await expect(picker).toBeHidden();
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
