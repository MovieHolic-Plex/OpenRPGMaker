import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/quest-low-level-verification";
const QUEST_SWITCH = "sw_quest_accepted";
const COMPLETE_SWITCH = "sw_quest_complete";
const HERB_VARIABLE = "var_herbs";

type RuntimeState = {
  readonly mapId: string;
  readonly inputEnabled: boolean;
  readonly running: boolean;
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly gold: number;
  readonly events: Record<string, { readonly pageId?: string }>;
};

type DebugState = {
  readonly project: Project;
};

test.setTimeout(90_000);

test("low-level editor parts can author and run a quest-like switch/variable flow", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeJson("00-scenario.json", {
    goal: "Verify a quest-like flow using low-level RPG Maker event parts.",
    editorProof: [
      "quest-giver page 2 switch+variable conditions are authored in the event editor",
      "quest-giver page 3 completion switch condition is authored in the event editor",
      "herb event setVariable command is edited through the inline command editor",
    ],
    runtimeProof: [
      "choice branch sets quest switch and herb count",
      "herb event increments herb count",
      "page conditions move quest giver to completion page",
      "reward command adds gold and completion switch moves the event to done page",
    ],
  });

  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectForEditor(page, makeQuestProject());
  await screenshot(page, "01-seeded-editor-map.png");

  await openEventEditor(page, "quest-giver");
  await page.getByTestId("event-page-tab-1").click();
  await expect(page.getByTestId("event-command-choices")).toBeVisible();
  await screenshot(page, "02-editor-quest-giver-page1-choices.png");

  await page.getByTestId("event-page-tab-2").click();
  await fillAndCommit(page.getByTestId("event-page-switch-condition-input"), QUEST_SWITCH);
  await fillAndCommit(page.getByTestId("event-page-variable-condition-input"), HERB_VARIABLE);
  await page.getByTestId("event-page-variable-condition-op").selectOption(">=");
  await fillAndCommit(page.getByTestId("event-page-variable-condition-value"), "1");
  await expect(page.getByTestId("event-command-changeGold")).toBeVisible();
  await screenshot(page, "03-editor-quest-giver-page2-ready-conditions.png");

  await page.getByTestId("event-page-tab-3").click();
  await fillAndCommit(page.getByTestId("event-page-switch-condition-input"), COMPLETE_SWITCH);
  await screenshot(page, "04-editor-quest-giver-page3-complete-condition.png");
  await page.getByTestId("event-editor-apply").click();
  await page.getByTestId("event-editor-modal-close").click();

  await openEventEditor(page, "quest-herb");
  await editSetVariableCommand(page, HERB_VARIABLE, "+=", "1");
  await screenshot(page, "05-editor-herb-progress-command.png");
  await page.getByTestId("event-editor-apply").click();
  await page.getByTestId("event-editor-modal-close").click();

  const editorExport = await debugState(page);
  assertQuestEditorState(editorExport);
  await writeJson("06-project-export-after-editor.json", editorExport);

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await screenshot(page, "07-play-start.png");

  await page.getByTestId("event-quest-giver").click();
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await expect(page.getByTestId("runtime-choice-0")).toContainText("돕는다");
  await screenshot(page, "08-play-choice-offer.png");
  await page.getByTestId("runtime-choice-0").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("퀘스트 수락");
  await expect.poll(async () => (await runtimeState(page)).switches[QUEST_SWITCH]).toBe(true);
  await writeJson("09-runtime-after-accept.json", await runtimeState(page));
  await screenshot(page, "10-play-quest-accepted.png");
  await dismissDialogue(page);

  await page.getByTestId("event-quest-herb").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("약초를 주웠다");
  await screenshot(page, "11-play-herb-picked-dialogue.png");
  await dismissDialogue(page);
  await expect.poll(async () => (await runtimeState(page)).variables[HERB_VARIABLE]).toBe(1);
  await writeJson("12-runtime-after-herb.json", await runtimeState(page));

  await page.getByTestId("event-quest-giver").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("약초를 가져왔구나");
  await screenshot(page, "13-play-ready-page-dialogue.png");
  await dismissDialogue(page);
  await expect(page.getByTestId("dialogue-box")).toContainText("보상 10G");
  await expect.poll(async () => (await runtimeState(page)).gold).toBe(10);
  await expect.poll(async () => (await runtimeState(page)).switches[COMPLETE_SWITCH]).toBe(true);
  await writeJson("14-runtime-after-reward.json", await runtimeState(page));
  await screenshot(page, "15-play-reward-and-complete-switch.png");
  await dismissDialogue(page);

  await page.getByTestId("event-quest-giver").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("이미 도와줘서 고마워");
  const finalState = await runtimeState(page);
  expect(finalState.events["quest-giver"]?.pageId).toBe("quest-giver-done");
  await writeJson("16-runtime-final-done-page.json", finalState);
  await screenshot(page, "17-play-done-page.png");
});

async function openEventEditor(page: Page, eventId: string): Promise<void> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId(`event-list-row-${eventId}`).click();
  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

async function editSetVariableCommand(page: Page, variableId: string, op: string, value: string): Promise<void> {
  let command = await openSetVariableInlineEditor(page);
  await command.locator(`select:visible:has(option[value="${variableId}"])`).selectOption(variableId);
  command = await openSetVariableInlineEditor(page);
  await command.locator(`select:visible:has(option[value="${op}"])`).selectOption(op);
  command = await openSetVariableInlineEditor(page);
  await fillAndCommit(command.locator('input[type="number"]:visible'), value);
}

async function openSetVariableInlineEditor(page: Page): Promise<Locator> {
  const command = page.getByTestId("event-command-setVariable").first();
  await expect(command).toBeVisible();
  const editing = await command.evaluate((node) => node.classList.contains("editing")).catch(() => false);
  if (!editing) await command.locator(".cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
  return command;
}

async function fillAndCommit(locator: Locator, value: string): Promise<void> {
  await locator.fill(value);
  await locator.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
}

async function dismissDialogue(page: Page): Promise<void> {
  await page.getByTestId("dialogue-box").click();
}

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}` });
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeFile(`${EVIDENCE_DIR}/${name}`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertQuestEditorState(state: DebugState): void {
  const events = state.project.maps.map_quest?.events ?? [];
  const giver = events.find((event) => event.id === "quest-giver");
  const herb = events.find((event) => event.id === "quest-herb");
  if (!giver?.pages || !herb?.pages) throw new Error("missing quest events");
  expect(giver.pages[1]?.conditions).toEqual([
    { kind: "switch", switchId: QUEST_SWITCH, value: true },
    { kind: "variable", variableId: HERB_VARIABLE, op: ">=", value: 1 },
  ]);
  expect(giver.pages[2]?.conditions).toEqual([{ kind: "switch", switchId: COMPLETE_SWITCH, value: true }]);
  const progressCommand = herb.pages[0]?.commands.find((command) => command.kind === "setVariable");
  expect(progressCommand).toEqual({ kind: "setVariable", variableId: HERB_VARIABLE, op: "+=", value: 1 });
}

function makeQuestProject(): Project {
  return {
    version: 3,
    meta: { title: "Quest Low-Level Proof", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        tex_easyrpg_charset_people1: {
          id: "tex_easyrpg_charset_people1",
          image: { type: "bundled", id: "tex_easyrpg_charset_people1" },
          frames: 8,
          frameWidth: 32,
          frameHeight: 32,
        },
      },
      uploaded: {},
    },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "Default tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: [
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
        ],
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    switches: [
      { id: QUEST_SWITCH, name: "Quest Accepted" },
      { id: COMPLETE_SWITCH, name: "Quest Complete" },
    ],
    variables: [{ id: HERB_VARIABLE, name: "Herbs" }],
    commonEvents: [],
    database: {
      actors: [],
      classes: [],
      skills: [],
      items: [],
      equipment: [],
      enemies: [],
      troops: [],
      states: [],
      battleAnimations: [],
    },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_quest: {
        id: "map_quest",
        name: "Quest Proof",
        width: 6,
        height: 5,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 30 }, () => 0),
        upperTiles: Array.from({ length: 30 }, () => -1),
        events: [
          {
            id: "quest-giver",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              eventPage("quest-giver-offer", "Offer", [], [
                {
                  kind: "choices",
                  prompt: "약초를 찾아줄래?",
                  options: [
                    {
                      text: "돕는다",
                      branch: [
                        { kind: "setSwitch", switchId: QUEST_SWITCH, value: true },
                        { kind: "setVariable", variableId: HERB_VARIABLE, op: "=", value: 0 },
                        { kind: "text", body: "퀘스트 수락: 약초를 찾아와." },
                      ],
                    },
                    { text: "나중에", branch: [{ kind: "text", body: "나중에 다시 와." }] },
                  ],
                  cancelBehavior: "choice2",
                },
              ]),
              eventPage("quest-giver-ready", "Ready", [], [
                { kind: "text", body: "약초를 가져왔구나." },
                { kind: "changeGold", op: "+=", amount: 10 },
                { kind: "setSwitch", switchId: COMPLETE_SWITCH, value: true },
                { kind: "text", body: "보상 10G를 받았다." },
              ]),
              eventPage("quest-giver-done", "Done", [], [{ kind: "text", body: "이미 도와줘서 고마워." }]),
            ],
          },
          {
            id: "quest-herb",
            x: 3,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              eventPage("quest-herb-page", "Herb", [{ kind: "switch", switchId: QUEST_SWITCH, value: true }], [
                { kind: "text", body: "약초를 주웠다." },
                { kind: "setVariable", variableId: "", op: "=", value: 0 },
              ]),
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_quest", children: [] },
    startMapId: "map_quest",
    startPos: { x: 2, y: 3 },
    flags: {},
  };
}

function eventPage(id: string, name: string, conditions: EventPage["conditions"], commands: Command[]): EventPage {
  return {
    id,
    name,
    conditions,
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
