import { expect, test, type Locator, type Page } from "@playwright/test";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { readProjectExportJson } from "./eventEditorCertEvidence";
import { openMapEventEditor } from "./eventStoryboardPicker";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

// 이벤트 편집기 트리거 선택지의 현재 계약. 영문 RM 라벨 다섯 개는 한국어 여섯 개로 바뀌었다
// (`src/editor/panels/eventEditor/options.ts` 의 TRIGGER_OPTIONS).
const TRIGGER_VALUES = ["action", "playerTouch", "eventTouch", "auto", "parallel", "locationTransition"] as const;
const TRIGGER_LABELS = ["말을 걸면", "플레이어가 닿으면", "이벤트가 닿으면", "나타나면 바로 실행", "뒤에서 계속 실행", "구역에 드나들면"] as const;

// 옛 시작 마을 주민 id. 제품은 더 이상 이 이벤트를 심지 않는다. 얼굴 대화 회귀는
// 빈 맵(20×15)의 보이는 칸에, 걷기 그림과 검토된 짝 얼굴을 직접 심어 확인한다.
// People2 0번은 대응표가 «얼굴 없음»이라 로드 교정이 changeFace 를 지운다. 로웬은
// 짝이 있는 Actor1 0번을 쓴다. Actor2 0번의 짝은 Actor1 얼굴 9다.
const RETIRED_STARTER_NPC_IDS = ["event_starter_mina", "event_starter_rowen", "event_starter_sera"] as const;
const STARTER_NPCS = [
  {
    id: "event_starter_mina",
    x: 12,
    y: 7,
    spriteId: "tex_easyrpg_charset_people1",
    characterIndex: 0,
    speaker: "미나",
    body: "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.",
  },
  {
    id: "event_starter_rowen",
    x: 8,
    y: 10,
    spriteId: "tex_easyrpg_charset_actor1",
    characterIndex: 0,
    speaker: "로웬",
    body: "트리거를 Action Button으로 두면 말을 걸 때만 대화가 시작됩니다.",
  },
  {
    id: "event_starter_sera",
    x: 12,
    y: 10,
    spriteId: "tex_easyrpg_charset_actor2",
    characterIndex: 0,
    speaker: "세라",
    body: "페이스칩도 함께 표시되니 실제 RPG Maker식 NPC 대화처럼 확인할 수 있어요.",
  },
] as const;

function reviewedFace(npc: (typeof STARTER_NPCS)[number]): string {
  const face = reviewedFaceIdForCharset(npc.spriteId, npc.characterIndex);
  if (!face) throw new Error(`missing reviewed face for ${npc.spriteId}#${npc.characterIndex}`);
  return face;
}

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
  const text = await readProjectExportJson(page);
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

test("event editor exposes the current trigger choices", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);
  const trigger = editor.getByTestId("event-page-trigger-select");
  const options = await triggerOptions(trigger);
  expect(options.map((option) => option.value)).toEqual([...TRIGGER_VALUES]);
  expect(options.map((option) => option.label)).toEqual([...TRIGGER_LABELS]);

  for (const value of TRIGGER_VALUES) {
    await trigger.selectOption(value);
    await expect(trigger).toHaveValue(value);
  }
});

test("fresh project does not ship the retired starter village NPCs", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });

  const ids = starterMapEvents(await debugState(page)).map((event) => event.id);
  expect(ids).toEqual([]);
  for (const retired of RETIRED_STARTER_NPC_IDS) expect(ids).not.toContain(retired);
});

test("seeded character-set NPCs talk with face chips in play mode", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectForEditor(page, seededNpcProject());

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
    expect(pageEntry.commands.some((command) => command.kind === "changeFace" && command.resourceId === reviewedFace(expected))).toBe(true);
    expect(pageEntry.commands.some((command) => command.kind === "text" && command.speaker === expected.speaker && command.body === expected.body)).toBe(true);
  }

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();

  for (const expected of STARTER_NPCS) {
    await expect(page.getByTestId(`event-${expected.id}`)).toBeVisible();
    await expect(page.getByTestId(`event-sprite-${expected.id}`)).toBeVisible();
    // 플레이 화면은 실제 마우스 click(detail >= 1)을 막는다. 마커의 리스너는
    // 테스트용 합성 click(detail 0, HTMLElement.click)만 받는다.
    await page.getByTestId(`event-${expected.id}`).evaluate((node: HTMLElement) => node.click());
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

/** 빈 프로젝트에 얼굴 대사가 있는 캐릭터칩 NPC 셋을 심는다. 제품 기본 맵에는 없다. */
function seededNpcProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing blank project start map");
  map.events = STARTER_NPCS.map((npc) => {
    const commands: Command[] = [
      { kind: "changeFace", resourceId: reviewedFace(npc), position: "left", flipHorizontally: false },
      { kind: "text", speaker: npc.speaker, body: npc.body },
    ];
    const eventPage: EventPage = {
      id: `${npc.id}_page`,
      name: npc.speaker,
      conditions: [],
      graphic: {
        sprite: { type: "bundled", id: npc.spriteId },
        direction: "down",
        pattern: charsetFrameIndex({ characterIndex: npc.characterIndex, pattern: 1, direction: "down" }),
      },
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands,
    };
    const event: GameEvent = {
      id: npc.id,
      name: npc.speaker,
      x: npc.x,
      y: npc.y,
      trigger: { kind: "action" },
      commands,
      pages: [eventPage],
    };
    return event;
  });
  return project;
}
