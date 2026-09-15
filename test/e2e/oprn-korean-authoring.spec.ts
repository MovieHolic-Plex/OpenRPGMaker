import { expect, test, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

type EventCommand = {
  readonly kind: string;
  readonly body?: string;
  readonly speaker?: string;
};

type AuthoringDebugState = {
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
    readonly database: {
      readonly enemies: readonly { readonly id: string; readonly name: string; readonly monsterResourceId?: string }[];
    };
  };
};

async function debugState(page: Page): Promise<AuthoringDebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as AuthoringDebugState;
}

function hasCommand(
  event: AuthoringDebugState["project"]["maps"][string]["events"][number],
  predicate: (command: EventCommand) => boolean,
): boolean {
  return event.pages?.some((pageEntry) => pageEntry.commands.some(predicate)) ?? false;
}

async function authoredEventId(page: Page): Promise<string> {
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const event = map.events.find((entry) =>
    hasCommand(entry, (command) => command.kind === "text" && command.body?.includes("북쪽 숲") === true),
  );
  if (!event) throw new Error("missing authored event");
  return event.id;
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function openRootCommandPicker(page: Page, tab: 1 | 2 | 3 | 4): Promise<void> {
  const emptyLine = page.getByTestId("event-command-empty-line");
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
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("event-command-text-speaker").fill(speaker);
  await dialog.getByTestId("event-command-text-body").fill(body);
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect(dialog).toBeHidden();
  await expect(picker).toBeHidden();
}

async function addBattleProcessingCommand(page: Page): Promise<void> {
  await openRootCommandPicker(page, 2);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-battleProcessing").click();
  await expect(picker).toBeHidden();
  const battleCommand = page.getByTestId("event-command-battleProcessing").first();
  await expect(battleCommand).toBeVisible();
  await battleCommand.locator(".cmd-head").dblclick();
  await battleCommand.getByTestId("battle-processing-troop-select").selectOption({ index: 1 });
}

test("Korean editor supports NPC dialogue and monster authoring basics", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&koreanAuthoring=1");

  await expect(page.getByTestId("menu-project")).toBeVisible();
  await expect(page.getByTestId("layer-selector")).toBeVisible();
  await expect(page.getByTestId("layer-event")).toHaveAttribute("aria-label", "이벤트");
  await expect(page.getByTestId("tool-pan")).toHaveAttribute("aria-label", "이동");
  await expect(page.getByTestId("map-move-hint")).toContainText("Space");

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);
  await expect(page.getByTestId("event-npc-quick-create")).toHaveCount(0);
  await expect(page.getByTestId("event-npc-name-input")).toHaveCount(0);
  await expect(page.getByTestId("event-npc-dialogue-input")).toHaveCount(0);
  await expect(page.getByTestId("event-command-text")).toHaveCount(0);
  await page.getByTestId("event-page-name-input").fill("마을 주민");
  await page.getByTestId("event-page-name-input").blur();
  await addTextCommand(page, "마을 주민", "어서 와. 몬스터는 북쪽 숲에 있어.");
  await addBattleProcessingCommand(page);
  await page.getByTestId("event-editor-apply").click();

  await expect.poll(async () => {
    const state = await debugState(page);
    const map = state.project.maps[state.project.startMapId];
    const event = map.events.find((entry) =>
      hasCommand(entry, (command) => command.kind === "text" && command.body?.includes("북쪽 숲") === true),
    );
    return event ? "dialogue-ready" : "missing";
  }).toBe("dialogue-ready");
  await expect.poll(async () => {
    const state = await debugState(page);
    const map = state.project.maps[state.project.startMapId];
    const event = map.events.find((entry) => hasCommand(entry, (command) => command.kind === "battleProcessing"));
    return event ? "encounter-ready" : "missing";
  }).toBe("encounter-ready");

  await page.getByTestId("event-editor-modal-close").click().catch(() => {
    /* 모달이 열려있지 않을 수 있음 */
  });
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("db-tab-enemies")).toHaveText("몬스터");
  await page.getByTestId("db-tab-enemies").click();
  await expect(page.getByTestId("db-detail-form")).toContainText("몬스터 그래픽");
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.database.enemies.length;
  }).toBeGreaterThan(0);
  await page.getByTestId("database-modal-close").click();

  const eventId = await authoredEventId(page);
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("title-new-game")).toHaveText("새 게임");
  await startNewGameFromTitle(page);
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await page.getByTestId(`event-${eventId}`).click();
  await expect(page.getByTestId("dialogue-box")).toContainText("북쪽 숲");
  await page.getByTestId("dialogue-box").click();
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toHaveText("공격");
  await expect(page.getByTestId("actor-command-skill")).toHaveText("스킬");
  await page.getByTestId("actor-command-skill").click();
  await expect(page.getByTestId("battle-animation")).toBeVisible();
  await expect(page.getByTestId("enemy-1")).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("korean-authoring.png"), fullPage: true });
});
