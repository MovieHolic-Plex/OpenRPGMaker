import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

const EVIDENCE_DIR = "evidence/browser-screenshots";
const FIXTURE_PATH = "test/fixtures/projects/editor-authored-demo-v3.json";
const DEMO_TITLE = "안개 항구와 등대의 밤";
const QUEST_MARKER = "항구 등대가 다시 켜질 시간입니다.";
const FORBIDDEN_TOKENS = [
  ["npc", "villager"].join("_"),
  ["tex", "npc", "villager"].join("_"),
  ["DEFAULT", "SPRITE", "NPC"].join("_"),
  ["TEX", "NPC"].join("_"),
] as const;

type DebugState = {
  readonly project: Project;
};

type AuthoredNpc = {
  readonly name: string;
  readonly speaker: string;
  readonly line: string;
};

const NPCS: readonly AuthoredNpc[] = [
  { name: "등대지기 하루", speaker: "하루", line: QUEST_MARKER },
  { name: "소금 장수", speaker: "소금 장수", line: "바람이 바뀌면 안개 괴물이 항구 안쪽까지 밀려옵니다." },
  { name: "돛 수선공", speaker: "돛 수선공", line: "낡은 돛천을 등대 렌즈에 감으면 빛이 흩어지지 않아요." },
  { name: "부두 아이", speaker: "부두 아이", line: "종이 세 번 울리면 모두 등대 쪽을 봐요." },
  { name: "등대 수습", speaker: "수습", line: "준비됐나요? 등대로 갈지, 항구를 더 살필지 정해 주세요." },
] as const;

const EDITOR_EVENT_IDS = [
  "ev_lantern_elder",
  "ev_lantern_guard",
  "ev_lantern_healer",
  "ev_lantern_scout",
  "ev_lantern_training",
] as const;

test("authors a second playable demo only through the editor UI", async ({ page }) => {
  test.setTimeout(420_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.addInitScript(() => window.localStorage.clear());
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&editorAuthoredDemo=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("mode-play")).toBeVisible();
  await page.getByTestId("layer-event").click();
  await expect(page.getByTestId("event-list")).toBeVisible();

  const authoredEventIds: string[] = [];
  for (let index = 0; index < NPCS.length; index += 1) {
    const npc = NPCS[index];
    if (!npc) throw new Error("missing NPC spec");
    const eventId = await authorExistingNpcEvent(page, EDITOR_EVENT_IDS[index], npc, index === 0);
    authoredEventIds.push(eventId);
  }

  await page.getByTestId("toolbar-save").click();
  await page.waitForTimeout(300);
  const state = await debugState(page);
  assertEditorAuthoredDemo(state.project, authoredEventIds);
  await writeFile(FIXTURE_PATH, `${JSON.stringify(state.project, null, 2)}\n`, "utf8");
  await writeFile(`${EVIDENCE_DIR}/editor-authored-demo-export.json`, `${JSON.stringify(state.project, null, 2)}\n`, "utf8");
  await screenshot(page, "editor-authored-demo-editor-desktop.png");
});

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  const parsed: DebugState = JSON.parse(text);
  return parsed;
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}`, fullPage: false });
}

async function authorExistingNpcEvent(page: Page, eventId: string, npc: AuthoredNpc, questGiver: boolean): Promise<string> {
  const row = page.getByTestId(`event-list-row-${eventId}`);
  await row.scrollIntoViewIfNeeded();
  await row.dblclick();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await page.getByTestId("event-page-tab-1").click({ force: true });
  await expect(page.getByTestId("event-page-tab-1")).toHaveClass(/active/);
  await authorNpcCommands(page, npc, questGiver);
  await expect.poll(async () => eventIdByLine(page, npc.line)).not.toBe("");
  return await eventIdByLine(page, npc.line);
}

async function authorNpcCommands(
  page: Page,
  npc: AuthoredNpc,
  questGiver: boolean
): Promise<void> {
  await page.getByTestId("event-page-name-input").fill(npc.name);
  await page.getByTestId("event-page-name-input").blur();
  await addTextCommand(page, npc.speaker, npc.line);
  if (questGiver) {
    await addChoicesCommand(page);
    await setChoiceText(page, "event-choice-prompt", "등대 일을 어떻게 할까요?");
    await setChoiceText(page, "event-choice-option-1", "등대로 간다");
    await setChoiceText(page, "event-choice-option-2", "항구를 더 본다");
    await addChoiceBranchText(page, 1, "하루", "좋아요. 등대 아래의 안개 파수꾼을 지나가야 합니다.");
    await addChoiceBranchText(page, 2, "하루", "항구를 둘러본 뒤에도 등대는 기다려 줍니다.");
    await commitChoicesDialogIfOpen(page);
    await addBattleProcessingCommand(page);
    await addGoldRewardCommand(page, 80);
    await addItemRewardCommand(page, 1);
    await addEndingCommand(page);
  }
  await page.getByTestId("event-editor-ok").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
}

async function openRootCommandPicker(page: Page, tab: 1 | 2 | 3 | 4): Promise<void> {
  const emptyLine = page.getByTestId("event-command-empty-line").last();
  await expect(emptyLine).toBeVisible();
  await emptyLine.dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  if (tab !== 1) await picker.getByTestId(`event-command-picker-tab-${tab}`).click();
}

async function addTextCommand(page: Page, speaker: string, body: string): Promise<void> {
  await openRootCommandPicker(page, 1);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-text").click();
  await fillOpenTextDialog(page, speaker, body, 0);
}

async function fillOpenTextDialog(page: Page, speaker: string, body: string, baselineEditDialogs: number): Promise<void> {
  await expect
    .poll(async () => {
      const textDialogs = await page.getByTestId("event-command-text-dialog").count();
      const editDialogs = await page.getByTestId("event-command-edit-dialog").count();
      return textDialogs + Math.max(0, editDialogs - baselineEditDialogs);
    })
    .toBeGreaterThan(0);
  const textDialog = page.getByTestId("event-command-text-dialog").last();
  if (await textDialog.isVisible().catch(() => false)) {
    await textDialog.getByTestId("event-command-text-speaker").fill(speaker);
    await textDialog.getByTestId("event-command-text-body").fill(body);
    await textDialog.getByTestId("event-command-text-ok").click();
    await expect(textDialog).toBeHidden();
    return;
  }
  const commandDialog = page.getByTestId("event-command-edit-dialog").last();
  const speakerInput = commandDialog.locator("input").first();
  const bodyInput = commandDialog.locator("textarea").first();
  await speakerInput.fill(speaker);
  await bodyInput.fill(body);
  await bodyInput.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect.poll(async () => await page.getByTestId("event-command-edit-dialog").count()).toBeLessThanOrEqual(baselineEditDialogs);
}

async function addChoicesCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page, 1);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-choices").click();
  await expect(page.getByTestId("event-choice-prompt").last()).toBeVisible();
}

async function ensureChoicesControls(page: Page): Promise<void> {
  if (await page.getByTestId("event-choice-prompt").last().isVisible().catch(() => false)) return;
  const command = page.getByTestId("event-command-choices").last();
  const editor = command.getByTestId("event-command-choices-inline-editor");
  if (!(await editor.isVisible().catch(() => false))) await command.locator(".cmd-head").dblclick();
  await expect(editor).toBeVisible();
}

async function setChoiceText(page: Page, testId: string, value: string): Promise<void> {
  await ensureChoicesControls(page);
  const input = page.getByTestId(testId).last();
  await input.fill(value);
  await input.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
}

async function addChoiceBranchText(page: Page, branch: 1 | 2, speaker: string, body: string): Promise<void> {
  await ensureChoicesControls(page);
  await page.getByTestId(`event-choice-branch-add-kind-${branch}`).last().selectOption("text");
  const baselineEditDialogs = await page.getByTestId("event-command-edit-dialog").count();
  await page.getByTestId(`event-choice-branch-add-${branch}`).last().click();
  const branchWrap = page.getByTestId(`event-choice-branch-${branch}`).last();
  await expect
    .poll(async () => {
      const textDialogs = await page.getByTestId("event-command-text-dialog").count();
      const editDialogs = await page.getByTestId("event-command-edit-dialog").count();
      const inlineBodies = await branchWrap.locator("textarea").count();
      return textDialogs + Math.max(0, editDialogs - baselineEditDialogs) + inlineBodies;
    })
    .toBeGreaterThan(0);
  if ((await branchWrap.locator("textarea").count()) > 0) {
    const speakerInput = branchWrap.locator("input").last();
    const bodyInput = branchWrap.locator("textarea").last();
    await speakerInput.fill(speaker);
    await bodyInput.fill(body);
    await speakerInput.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
    await bodyInput.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
    return;
  }
  await fillOpenTextDialog(page, speaker, body, baselineEditDialogs);
}

async function commitChoicesDialogIfOpen(page: Page): Promise<void> {
  if (!(await page.getByTestId("event-choice-prompt").last().isVisible().catch(() => false))) return;
  await page.getByTestId("event-command-edit-ok").last().click();
  await expect(page.getByTestId("event-choice-prompt").last()).toBeHidden();
}

async function addBattleProcessingCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page, 2);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-battleProcessing").click();
  const dialog = page.getByTestId("event-command-edit-dialog").last();
  await expect(dialog.getByTestId("battle-processing-troop-select")).toBeVisible();
  await dialog.getByTestId("battle-processing-troop-select").selectOption({ index: 1 });
  const escape = dialog.getByTestId("battle-processing-escape-checkbox");
  if (!(await escape.isChecked())) await escape.check();
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect.poll(async () => await page.getByTestId("event-command-edit-dialog").count()).toBe(0);
}

async function addGoldRewardCommand(page: Page, amount: number): Promise<void> {
  await openRootCommandPicker(page, 1);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-changeGold").click();
  const dialog = page.getByTestId("event-command-edit-dialog").last();
  await expect(dialog.getByTestId("change-gold-amount-input")).toBeVisible();
  await dialog.getByTestId("change-gold-op-select").selectOption("+=");
  await dialog.getByTestId("change-gold-amount-input").fill(String(amount));
  await dialog.getByTestId("change-gold-amount-input").blur();
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect.poll(async () => await page.getByTestId("event-command-edit-dialog").count()).toBe(0);
}

async function addItemRewardCommand(page: Page, amount: number): Promise<void> {
  await openRootCommandPicker(page, 1);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-changeItem").click();
  const dialog = page.getByTestId("event-command-edit-dialog").last();
  await expect(dialog.getByTestId("change-item-amount-input")).toBeVisible();
  await dialog.getByTestId("change-item-select").selectOption({ index: 1 });
  await dialog.getByTestId("change-item-op-select").selectOption("+=");
  await dialog.getByTestId("change-item-amount-input").fill(String(amount));
  await dialog.getByTestId("change-item-amount-input").blur();
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect.poll(async () => await page.getByTestId("event-command-edit-dialog").count()).toBe(0);
}

async function addEndingCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page, 4);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-ending").click();
  const dialog = page.getByTestId("event-command-edit-dialog").last();
  await expect(dialog.getByTestId("ending-title-input")).toBeVisible();
  await dialog.getByTestId("ending-title-input").fill(DEMO_TITLE);
  await dialog.getByTestId("ending-message-input").fill("안개가 걷히고 항구의 배들은 다시 별빛을 따라 움직였다.");
  await dialog.getByTestId("ending-message-input").blur();
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect.poll(async () => await page.getByTestId("event-command-edit-dialog").count()).toBe(0);
}

async function eventIdByLine(page: Page, line: string): Promise<string> {
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const event = map?.events.find((entry) => eventCommands(entry).some((command) => command.kind === "text" && command.body.includes(line)));
  return event?.id ?? "";
}

function eventCommands(event: GameEvent): readonly Extract<Command, { kind: "text" }>[] {
  const pages = event.pages ?? [];
  return pages.flatMap((page) => flattenTextCommands(page));
}

function flattenTextCommands(page: EventPage): readonly Extract<Command, { kind: "text" }>[] {
  return page.commands.flatMap((command) => {
    if (command.kind === "text") return [command];
    if (command.kind === "choices") {
      return command.options.flatMap((option) => option.branch.flatMap((branchCommand) => branchCommand.kind === "text" ? [branchCommand] : []));
    }
    return [];
  });
}

function assertEditorAuthoredDemo(project: Project, eventIds: readonly string[]): void {
  const serialized = JSON.stringify(project);
  for (const token of FORBIDDEN_TOKENS) expect(serialized.includes(token)).toBe(false);
  expect(project.resourceProfiles.every((profile) => profile.assetId === undefined || !FORBIDDEN_TOKENS.includes(profile.assetId))).toBe(true);
  const events = Object.values(project.maps).flatMap((map) => map.events).filter((event) => eventIds.includes(event.id));
  const commands = events.flatMap((event) => (event.pages ?? []).flatMap((page) => page.commands));
  expect(events).toHaveLength(5);
  expect(
    commands.some((command) => command.kind === "choices" && command.prompt === "등대 일을 어떻게 할까요?")
  ).toBe(true);
  expect(commands.some((command) => command.kind === "battleProcessing" && command.troopId === "troop_slime")).toBe(true);
  expect(commands.some((command) => command.kind === "changeGold")).toBe(true);
  expect(commands.some((command) => command.kind === "changeItem")).toBe(true);
  expect(commands.some((command) => command.kind === "ending")).toBe(true);
}
