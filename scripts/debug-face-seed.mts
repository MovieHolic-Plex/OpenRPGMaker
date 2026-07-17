import { chromium } from "@playwright/test";
import { createBlankProject } from "../src/project/defaults.ts";
import { createDefaultGameEvent } from "../src/editor/eventActions.ts";

const project = createBlankProject();
const map = project.maps[project.startMapId];
if (!map) throw new Error("no map");
const event = createDefaultGameEvent(2, 2, { kind: "action" });
event.id = "ev_face_ui";
event.commands = [
  {
    kind: "changeFace",
    resourceId: "easyrpg-faceset-actor1",
    faceIndex: 0,
    position: "left",
    flipHorizontally: false,
  },
];
if (event.pages?.[0]) event.pages[0].commands = structuredClone(event.commands);
map.events = [event];

console.log("seed events", map.events.length, "version", project.version, "db", Boolean(project.database));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript((seed) => {
  (window as Window & { __RPG_ZZU_E2E_PROJECT__?: unknown }).__RPG_ZZU_E2E_PROJECT__ = seed;
  window.localStorage.clear();
}, project);
await page.goto("http://127.0.0.1:9173/?blankProject=1", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const dump = await page.evaluate(() => {
  const seed = (window as Window & { __RPG_ZZU_E2E_PROJECT__?: any }).__RPG_ZZU_E2E_PROJECT__;
  const seedInfo = seed && typeof seed === "object"
    ? {
        hasVersion: "version" in seed,
        hasMaps: "maps" in seed,
        hasStart: "startMapId" in seed,
        hasDb: "database" in seed,
        eventCount: seed.maps?.[seed.startMapId]?.events?.length,
        mapIds: Object.keys(seed.maps ?? {}),
      }
    : null;
  return {
    seedInfo,
    testids: Array.from(document.querySelectorAll("[data-testid]"))
      .map((node) => node.getAttribute("data-testid"))
      .filter(Boolean)
      .slice(0, 80),
    body: document.body?.innerText?.slice(0, 500),
  };
});
console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: "output/evidence/face-command-ui-fix/00-boot-debug.png", fullPage: true });
await browser.close();
