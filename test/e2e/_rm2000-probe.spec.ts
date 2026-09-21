/* Temporary diagnostic probe: rm2000 command rail + actor battler node geometry. */
import { test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { reseedSessionRng } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { waitForActorCommand } from "./battleReferenceProject";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { expect } from "@playwright/test";

test("probe rm2000 command rail + actor node", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 768 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  const fixtureText = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const fixture = deserialize(fixtureText);
  const project = createBlankProject();
  project.meta = { ...project.meta, title: "rm2000 probe" };
  const startMap = project.maps[project.startMapId]!;
  const battleEvents = fixture.maps.map_battle!.events;
  startMap.events = [
    ...startMap.events.filter((event) => event.id !== "battle-start"),
    ...battleEvents.map((event) => ({ ...event, x: project.startPos.x + 1, y: project.startPos.y })),
  ];
  const system = project.system as unknown as Record<string, unknown>;
  delete system.battleUiStyle;
  delete system.battleFlow;
  project.session.partyActorIds = ["actor_mage"];
  project.system.startActorIds = ["actor_mage"];
  const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
  troop.enemyIds = ["enemy_slime"];
  troop.members = [];
  reseedSessionRng(project.session as unknown as PlaySessionLike, 42_001);
  await seedProjectForEditor(page, project);

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 10_000 });
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 20_000 });
  await waitForActorCommand(page);

  const report = await page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']")!;
    const sceneRect = scene.getBoundingClientRect();
    const scale = sceneRect.width / 640;
    const box = (el: Element): string => {
      const r = el.getBoundingClientRect();
      const n = (v: number): number => Math.round((v / scale) * 100) / 100;
      return `${n(r.width)}×${n(r.height)} @ (${n(r.left - sceneRect.left)}, ${n(r.top - sceneRect.top)})`;
    };
    const dump = (root: Element, prefix = ""): string[] => {
      const out: string[] = [];
      for (const child of Array.from(root.children)) {
        const cs = getComputedStyle(child);
        out.push(`${prefix}${child.tagName.toLowerCase()}.${(child.className as string) || "?"} ${box(child)} `
          + `[display=${cs.display} overflow=${cs.overflow} transform=${cs.transform} bg=${cs.backgroundImage.slice(0, 40)} `
          + `bgSize=${cs.backgroundSize} bgPos=${cs.backgroundPosition}]`);
        out.push(...dump(child, `${prefix}  `));
      }
      return out;
    };
    const actor = scene.querySelector<HTMLElement>(".battle-actor")!;
    const panel = scene.querySelector<HTMLElement>(".battle-command-panel")!;
    const party = scene.querySelector<HTMLElement>(".battle-party")!;
    const prompts = scene.querySelector<HTMLElement>(".battle-key-prompts");
    return {
      scale,
      hostBody: (() => {
        const body = document.querySelector<HTMLElement>("[data-testid='test-play-window-body']");
        return body ? `${body.clientWidth}×${body.clientHeight}` : "?";
      })(),
      actorGroup: box(scene.querySelector(".battle-actor-group")!),
      actorTree: [`div.${actor.className} ${box(actor)}`, ...dump(actor, "  ")],
      panelTree: [`div.${panel.className} ${box(panel)} rows=${getComputedStyle(panel).gridTemplateRows}`, ...dump(panel, "  ")],
      partyTree: [`div.${party.className} ${box(party)} rows=${getComputedStyle(party).gridTemplateRows}`, ...dump(party, "  ")],
      promptScroll: prompts ? `${prompts.scrollWidth}/${prompts.clientWidth} text="${prompts.textContent}"` : "none",
      debugPanel: (() => {
        const p = document.querySelector<HTMLElement>(".runtime-debug-panel");
        if (!p) return "none";
        const r = p.getBoundingClientRect();
        return `visual ${Math.round(r.width)}×${Math.round(r.height)} @ (${Math.round(r.left)}, ${Math.round(r.top)}) sceneBottom=${Math.round(sceneRect.bottom)}`;
      })(),
    };
  });
  console.log(JSON.stringify(report, null, 2));
});
