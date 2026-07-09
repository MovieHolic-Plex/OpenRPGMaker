import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createTownArchitectureCityProject } from "@/project/defaults";
import { TOWN_ARCHITECTURE_CITY_NPC_COUNT } from "@/project/defaults/townArchitectureCityNpcs";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

declare const process: {
  readonly env: {
    readonly RPG_ZZU_EVIDENCE_URL?: string;
  };
};

const EVIDENCE_DIR = "output/evidence/city-30-moving-npcs";
const APP_URL = process.env.RPG_ZZU_EVIDENCE_URL ?? "/";
const DIALOGUE_NPC_ID = "event_city_walker_11";

type RuntimeEventSnapshot = {
  readonly x: number;
  readonly y: number;
};

type RuntimeState = {
  readonly events: Record<string, RuntimeEventSnapshot>;
};

type EditSceneLike = {
  readonly cameras: {
    readonly main: {
      setScroll(left: number, top: number): void;
    };
  };
};

type AppModeModule = {
  readonly getGame: () => {
    readonly scene: {
      getScene(key: string): EditSceneLike | undefined;
    };
  } | undefined;
};

test.use({ serviceWorkers: "block" });

test("captures proof for thirty moving city NPCs with dialogue", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const project = createTownArchitectureCityProject();
  project.meta = { ...project.meta, title: "30 moving NPC city proof" };
  project.startPos = { x: 18, y: 18 };
  const cityMap = project.maps[project.startMapId];
  if (!cityMap) throw new Error("missing generated city map");

  const npcEvents = cityMap.events.filter((event) => event.id.startsWith("event_city_walker_"));
  expect(npcEvents).toHaveLength(TOWN_ARCHITECTURE_CITY_NPC_COUNT);
  await writeFile(`${EVIDENCE_DIR}/npc-events.json`, `${JSON.stringify(npcEvents, null, 2)}\n`, "utf8");

  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, project, APP_URL);
  await page.getByTestId(`map-tree-node-${project.startMapId}`).click();
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();

  await page.getByTestId("editor-zoom-1").click();
  await captureEditorAt(page, "01-editor-overview-30-npcs.png", { left: 0, top: 0 });

  await page.getByTestId("editor-zoom-2").click();
  await captureEditorAt(page, "02-editor-north-road-npcs.png", { left: 0, top: 0 });
  await captureEditorAt(page, "03-editor-center-road-npcs.png", { left: 100, top: 170 });
  await captureEditorAt(page, "04-editor-south-road-npcs.png", { left: 110, top: 380 });

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId(`event-${DIALOGUE_NPC_ID}`)).toBeVisible();
  await screenshot(page, "05-play-start-with-moving-npcs.png");

  await page.getByTestId(`event-${DIALOGUE_NPC_ID}`).click();
  await expect(page.getByTestId("dialogue-box")).toContainText("도시 주민 11");
  await expect(page.getByTestId("dialogue-box")).toContainText("북쪽 지붕 색이 마음에 들어.");
  await screenshot(page, "06-play-dialogue-proof.png");
  await page.getByTestId("dialogue-box").click();

  const before = await runtimeState(page);
  await page.waitForTimeout(3500);
  const after = await runtimeState(page);
  const movedEventIds = movedCityEventIds(before, after);
  expect(movedEventIds.length).toBeGreaterThan(0);
  await writeFile(`${EVIDENCE_DIR}/movement-proof.json`, `${JSON.stringify({ movedEventIds }, null, 2)}\n`, "utf8");
  await screenshot(page, "07-play-after-random-movement.png");
});

async function captureEditorAt(page: Page, name: string, scroll: { readonly left: number; readonly top: number }): Promise<void> {
  await page.evaluate((position) => {
    const appModeModulePath = "/src/app/mode.ts";
    return import(appModeModulePath).then((module: AppModeModule) => {
      const { getGame } = module;
      const scene = getGame()?.scene.getScene("EditScene");
      if (!scene) throw new Error("missing EditScene");
      scene.cameras.main.setScroll(position.left, position.top);
    });
  }, scroll);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await screenshot(page, name);
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

function movedCityEventIds(before: RuntimeState, after: RuntimeState): string[] {
  return Object.entries(before.events)
    .filter(([id, eventBefore]) => {
      if (!id.startsWith("event_city_walker_")) return false;
      const eventAfter = after.events[id];
      return eventAfter !== undefined && (eventAfter.x !== eventBefore.x || eventAfter.y !== eventBefore.y);
    })
    .map(([id]) => id);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}`, fullPage: true });
}
