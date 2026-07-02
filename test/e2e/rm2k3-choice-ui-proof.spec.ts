import { expect, test, type Page } from "@playwright/test";

const EVIDENCE_DIR = "output/evidence/npc-dialogue-debug";
const EDITOR_SCREENSHOT = `${EVIDENCE_DIR}/15-event-editor-inline-choices.png`;
const RUNTIME_TWO_SCREENSHOT = `${EVIDENCE_DIR}/17-runtime-bottom-choice-window.png`;
const RUNTIME_FOUR_SCREENSHOT = `${EVIDENCE_DIR}/18-runtime-bottom-choice-window-four.png`;

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<
      string,
      {
        readonly events: readonly {
          readonly id: string;
          readonly pages?: readonly {
            readonly commands: readonly {
              readonly kind: string;
              readonly options?: readonly { readonly text?: string }[];
            }[];
          }[];
        }[];
      }
    >;
  };
};

type RuntimeGeometry = {
  readonly windowHeight: number;
  readonly windowWidth: number;
  readonly windowBottom: number;
  readonly lastBottom: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function openEventEditor(page: Page): Promise<void> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

async function addChoicesCommand(page: Page): Promise<void> {
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("command-picker-add-choices").click();
  await expect(picker).toBeHidden();
  await expect(page.getByTestId("event-command-choices-dialog")).toHaveCount(0);
}

async function openChoicesEditor(page: Page): Promise<void> {
  const command = page.getByTestId("event-command-choices");
  const editor = command.getByTestId("event-command-choices-inline-editor");
  if (!(await editor.isVisible().catch(() => false))) await command.locator(".cmd-head").dblclick();
  await expect(editor).toBeVisible();
}

async function setInlineInput(page: Page, testId: string, value: string): Promise<void> {
  await openChoicesEditor(page);
  const input = page.getByTestId(testId);
  await input.fill(value);
  await input.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
}

async function authoredChoicesEventId(page: Page, choices: readonly string[]): Promise<string> {
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const event = map.events.find((entry) =>
    entry.pages?.some((pageEntry) =>
      pageEntry.commands.some(
        (command) =>
          command.kind === "choices" &&
          command.options?.length === choices.length &&
          choices.every((choice, index) => command.options?.[index]?.text === choice)
      )
    )
  );
  if (!event) throw new Error("missing authored choice event");
  return event.id;
}

async function authorChoicesAndOpenRuntime(
  page: Page,
  choices: readonly string[],
  proofParam: string,
  screenshotPath: string,
  shouldCaptureEditor: boolean
): Promise<RuntimeGeometry> {
  await page.goto(`/?freshProject=1&${proofParam}=1`);
  await openEventEditor(page);
  await addChoicesCommand(page);
  for (const [index, choice] of choices.entries()) {
    await setInlineInput(page, `event-choice-option-${index + 1}`, choice);
  }
  await openChoicesEditor(page);
  await page.getByTestId("event-choice-cancel-choice2").check();
  await openChoicesEditor(page);
  await expect(page.getByTestId("event-command-choices-inline-editor")).toBeVisible();
  await expect(page.getByTestId("event-command-choices-dialog")).toHaveCount(0);
  if (shouldCaptureEditor) await page.screenshot({ path: EDITOR_SCREENSHOT, fullPage: true });

  await page.getByTestId("event-editor-apply").click();
  const eventId = await authoredChoicesEventId(page, choices);
  await page.getByTestId("event-editor-modal-close").click();
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await page.getByTestId(`event-${eventId}`).click();
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await expect(page.getByTestId("runtime-choice-0")).toContainText(choices[0] ?? "");
  await expect(page.getByTestId(`runtime-choice-${choices.length - 1}`)).toContainText(choices[choices.length - 1] ?? "");
  await expect(page.getByTestId("runtime-choice-0")).toHaveClass(/selected/);

  const geometry = await page.evaluate((lastIndex) => {
    const windowNode = document.querySelector('[data-testid="dialogue-box"]');
    const last = document.querySelector(`[data-testid="runtime-choice-${lastIndex}"]`);
    if (!(windowNode instanceof HTMLElement) || !(last instanceof HTMLElement)) {
      throw new Error("missing runtime choices");
    }
    const windowRect = windowNode.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    return {
      windowHeight: windowRect.height,
      windowWidth: windowRect.width,
      windowBottom: windowRect.bottom,
      lastBottom: lastRect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }, choices.length - 1);
  expect(geometry.windowWidth).toBeGreaterThan(geometry.viewportWidth * 0.9);
  expect(geometry.windowBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return geometry;
}

test("runtime choices reuse the dialogue window and keep fixed height for two and four options", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  const twoChoiceGeometry = await authorChoicesAndOpenRuntime(
    page,
    ["Yes", "No"],
    "choiceUiProofTwo",
    RUNTIME_TWO_SCREENSHOT,
    true
  );
  const fourChoiceGeometry = await authorChoicesAndOpenRuntime(
    page,
    ["Yes", "No", "Maybe", "Later"],
    "choiceUiProofFour",
    RUNTIME_FOUR_SCREENSHOT,
    false
  );
  expect(Math.abs(twoChoiceGeometry.windowHeight - fourChoiceGeometry.windowHeight)).toBeLessThanOrEqual(1);
});
