import { expect, test, type Locator, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

const TRIGGER_VALUES = ["action", "playerTouch", "eventTouch", "auto", "parallel"] as const;
const TRIGGER_LABELS = ["Action Button", "Player Touch", "Event Touch", "Autorun", "Parallel Process"] as const;
const STARTER_NPCS = [
  {
    id: "event_starter_mina",
    x: 15,
    y: 14,
    spriteId: "tex_easyrpg_charset_people1",
    faceResourceId: "easyrpg-faceset-people1-00",
    speaker: "미나",
    body: "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.",
  },
  {
    id: "event_starter_rowen",
    x: 13,
    y: 16,
    spriteId: "tex_easyrpg_charset_people2",
    faceResourceId: "easyrpg-faceset-people2-01",
    speaker: "로웬",
    body: "트리거를 Action Button으로 두면 말을 걸 때만 대화가 시작됩니다.",
  },
  {
    id: "event_starter_sera",
    x: 15,
    y: 18,
    spriteId: "tex_easyrpg_charset_actor2",
    faceResourceId: "easyrpg-faceset-actor2-02",
    speaker: "세라",
    body: "페이스칩도 함께 표시되니 실제 RPG Maker식 NPC 대화처럼 확인할 수 있어요.",
  },
] as const;

type EventCommandExport = {
  readonly kind: string;
  readonly resourceId?: string;
  readonly speaker?: string;
  readonly body?: string;
};

type EventPageExport = {
  readonly name: string;
  readonly graphic: { readonly sprite?: { readonly id: string }; readonly pattern?: number };
  readonly trigger: { readonly kind: string };
  readonly priority: string;
  readonly overlapForbidden?: boolean;
  readonly commands: readonly EventCommandExport[];
};

type EventExport = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly pages?: readonly EventPageExport[];
};

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly events: readonly EventExport[] }>;
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return parseDebugState(text);
}

function parseDebugState(text: string): DebugState {
  const parsed: unknown = JSON.parse(text);
  if (!isDebugState(parsed)) throw new Error("malformed project export");
  return parsed;
}

function isDebugState(value: unknown): value is DebugState {
  if (!isRecord(value)) return false;
  const project = value.project;
  return isRecord(project) &&
    typeof project.startMapId === "string" &&
    isRecord(project.maps);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);

  const editor = page.getByTestId("event-editor-modal");
  try {
    await editor.waitFor({ state: "visible", timeout: 1000 });
  } catch {
    await page.getByTestId("event-editor-open").click();
  }
  await expect(editor).toBeVisible();
  return editor;
}

async function triggerOptions(trigger: Locator): Promise<readonly { readonly value: string; readonly label: string }[]> {
  return trigger.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: node instanceof HTMLOptionElement ? node.value : "",
      label: node.textContent ?? "",
    }))
  );
}

function starterMapEvents(state: DebugState): readonly EventExport[] {
  return state.project.maps[state.project.startMapId]?.events ?? [];
}

test("event editor exposes the five RPG Maker trigger choices", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);
  const trigger = editor.getByTestId("event-page-trigger-select");
  const options = await triggerOptions(trigger);
  expect(options.map((option) => option.value)).toEqual([...TRIGGER_VALUES]);
  expect(options.map((option) => option.label)).toEqual([...TRIGGER_LABELS]);

  for (const value of TRIGGER_VALUES) {
    await trigger.selectOption(value);
    await expect(trigger).toHaveValue(value);
  }
});

test("fresh starter project has three character-set NPCs that talk with face chips in play mode", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const state = await debugState(page);
  for (const expected of STARTER_NPCS) {
    const event = starterMapEvents(state).find((entry) => entry.id === expected.id);
    expect(event, `starter NPC ${expected.id}`).toBeDefined();
    if (!event) throw new Error(`missing starter NPC ${expected.id}`);
    expect(event.x).toBe(expected.x);
    expect(event.y).toBe(expected.y);

    const pageEntry = event.pages?.[0];
    expect(pageEntry).toBeDefined();
    if (!pageEntry) throw new Error(`missing starter NPC page ${expected.id}`);
    expect(pageEntry.name).toBe(expected.speaker);
    expect(pageEntry.graphic.sprite?.id).toBe(expected.spriteId);
    expect(pageEntry.trigger.kind).toBe("action");
    expect(pageEntry.priority).toBe("same");
    expect(pageEntry.overlapForbidden).toBe(true);
    expect(pageEntry.commands.some((command) => command.kind === "changeFace" && command.resourceId === expected.faceResourceId)).toBe(true);
    expect(pageEntry.commands.some((command) => command.kind === "text" && command.speaker === expected.speaker && command.body === expected.body)).toBe(true);
  }

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();

  for (const expected of STARTER_NPCS) {
    await expect(page.getByTestId(`event-${expected.id}`)).toBeVisible();
    await expect(page.getByTestId(`event-sprite-${expected.id}`)).toBeVisible();
    await page.getByTestId(`event-${expected.id}`).click();
    const dialogue = page.getByTestId("dialogue-box");
    await expect(dialogue).toContainText(expected.speaker);
    await expect(dialogue).toContainText(expected.body);
    await expect(page.getByTestId("dialogue-face")).toBeVisible();
    if (expected.id === "event_starter_mina") {
      await page.screenshot({ path: testInfo.outputPath("starter-npc-play.png"), fullPage: true });
    }
    await dialogue.click();
    await expect(dialogue).toHaveCount(0);
  }
});
