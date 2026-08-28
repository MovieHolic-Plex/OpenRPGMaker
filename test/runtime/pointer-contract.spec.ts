import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const PROJECT_URL = "/__pointer-contract/project.json";
const WATCHED = [
  "cursor", "background-color", "background-image", "border-top-color", "color",
  "box-shadow", "outline-color", "opacity", "transform", "filter", "text-decoration-line",
];

let server: Awaited<ReturnType<typeof startPlayerQaServer>>;
let sample: any;
let battle: any;

test.beforeAll(async () => {
  server = await startPlayerQaServer();
  sample = JSON.parse(await readFile("test/fixtures/projects/oprn-sample-v3.json", "utf8"));
  battle = JSON.parse(await readFile("test/fixtures/projects/battle-v3.json", "utf8"));
});

test.afterAll(async () => {
  await server.close();
});

async function boot(page: Page, project: unknown): Promise<void> {
  await page.addInitScript(([projectUrl]) => {
    localStorage.clear();
    window.__OPENRPG_BOOT__ = {
      projectUrl,
      saveNamespace: "pointer-contract",
      qaInstrumentation: true,
    };
  }, [PROJECT_URL]);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(project),
  }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("title-screen").waitFor();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => typeof window.__oprnDebug?.readState === "function");
}

function projectWithCommand(command: unknown): any {
  const project = structuredClone(sample);
  const event = project.maps[project.startMapId].events[0];
  event.pages[0].commands = [command];
  return project;
}

async function activateAdjacentEvent(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__oprnInput.face("right");
    window.__oprnInput.action();
  });
}

async function expectPointerInert(page: Page, selector: string): Promise<void> {
  const surface = page.locator(selector);
  await expect(surface).toBeVisible();
  const result = await page.evaluate(async ({ selector, watched }) => {
    const root = document.querySelector(selector);
    if (!(root instanceof HTMLElement)) throw new Error(`missing surface ${selector}`);
    const visible = (node: Element): node is HTMLElement => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
    };
    const nodes = [root, ...root.querySelectorAll("*")].filter(visible);
    const snapshot = () => nodes.map((node) => {
      const style = getComputedStyle(node);
      return Object.fromEntries(watched.map((property) => [property, style.getPropertyValue(property)]));
    });
    const before = snapshot();
    const pointerCursor = before.flatMap((styles, index) => styles.cursor === "pointer" ? [index] : []);
    const nativeTooltips = nodes.flatMap((node, index) => node.hasAttribute("title") ? [index] : []);
    const hoverChanges: Array<{ index: number; property: string }> = [];
    for (let index = 0; index < nodes.length; index += 1) {
      const rect = nodes[index].getBoundingClientRect();
      const target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      await new Promise<void>((resolve) => {
        const onMove = () => resolve();
        window.addEventListener("mousemove", onMove, { once: true });
        window.dispatchEvent(new MouseEvent("mousemove", { clientX: target.x, clientY: target.y }));
      });
      const during = snapshot();
      for (const property of watched) {
        if (before[index]?.[property] !== during[index]?.[property]) hoverChanges.push({ index, property });
      }
    }
    return { pointerCursor, nativeTooltips, hoverChanges };
  }, { selector, watched: WATCHED });
  expect(result).toEqual({ pointerCursor: [], nativeTooltips: [], hoverChanges: [] });
}

test("dialogue choices retain keyboard focus styling but expose no pointer affordance", async ({ page }) => {
  await boot(page, projectWithCommand({
    kind: "choices",
    prompt: "Choose",
    options: [{ text: "Yes", branch: [] }, { text: "No", branch: [] }],
  }));
  await activateAdjacentEvent(page);
  await page.getByTestId("runtime-choices").waitFor();
  await expectPointerInert(page, "[data-testid='runtime-choices']");
});

test("commerce, name entry, terminal, and battle surfaces expose no pointer affordance", async ({ page }) => {
  const cases = [
    {
      project: projectWithCommand({ kind: "shop", itemIds: ["item_potion"], allowSell: true }),
      surface: "[data-testid='shop-scene']",
    },
    {
      project: projectWithCommand({ kind: "enterHeroName", actorId: "actor_hero", maxLength: 6, showInitialName: true }),
      surface: "[data-testid='runtime-name-entry']",
    },
    {
      project: projectWithCommand({ kind: "ending", title: "End", message: "Done" }),
      surface: "[data-testid='ending-screen']",
    },
  ];
  for (const entry of cases) {
    await boot(page, entry.project);
    await activateAdjacentEvent(page);
    await page.locator(entry.surface).waitFor();
    await expectPointerInert(page, entry.surface);
    await page.unrouteAll({ behavior: "wait" });
  }

  await boot(page, battle);
  await activateAdjacentEvent(page);
  await page.getByTestId("battle-scene").waitFor();
  await expectPointerInert(page, "[data-testid='battle-scene']");
});
