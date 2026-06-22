import { expect, test, type Page } from "@playwright/test";

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
  await canvas.click({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

test("Korean editor supports NPC dialogue and monster authoring basics", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&koreanAuthoring=1");

  await expect(page.getByRole("button", { name: "프로젝트" })).toBeVisible();
  await expect(page.getByTestId("layer-selector")).toBeVisible();
  await expect(page.getByTestId("layer-event")).toHaveAttribute("aria-label", "이벤트");
  await expect(page.getByTestId("tool-pan")).toHaveAttribute("aria-label", "이동");
  await expect(page.getByTestId("map-move-hint")).toContainText("Space");

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);
  await expect(page.getByTestId("event-npc-quick-create")).toBeVisible();
  await page.getByTestId("event-npc-name-input").fill("마을 주민");
  await page.getByTestId("event-npc-dialogue-input").fill("어서 와. 몬스터는 북쪽 숲에 있어.");
  await page.getByTestId("event-npc-quick-create").click();
  await page.getByTestId("event-monster-encounter-create").click();

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

  await page.getByTestId("right-tab-database").click();
  await expect(page.getByTestId("db-tab-enemies")).toHaveText("몬스터");
  await page.getByTestId("db-tab-enemies").click();
  await expect(page.getByTestId("db-detail-form")).toContainText("몬스터 그래픽");
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.database.enemies.length;
  }).toBeGreaterThan(0);

  const eventId = await authoredEventId(page);
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("title-new-game")).toHaveText("새 게임");
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId(`event-${eventId}`)).toBeVisible();
  await page.getByTestId(`event-${eventId}`).click();
  await expect(page.getByTestId("dialogue-box")).toContainText("북쪽 숲");
  await page.getByTestId("dialogue-box").click();
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toHaveText("공격");
  await expect(page.getByTestId("actor-command-skill")).toHaveText("스킬");
  await page.getByTestId("actor-command-skill").click();
  await expect(page.getByTestId("battle-animation")).toBeVisible();
  await expect(page.getByTestId("enemy-1")).toContainText("10/20");

  await page.screenshot({ path: testInfo.outputPath("korean-authoring.png"), fullPage: true });
});
