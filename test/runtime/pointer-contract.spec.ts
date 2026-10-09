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
  const handles = await page.$$(`${selector}, ${selector} *`);

  const nativeTooltips = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!(root instanceof HTMLElement)) return [];
    return [root, ...root.querySelectorAll("*")]
      .filter((node) => node.hasAttribute("title"))
      .map((node) => `${node.getAttribute("data-testid") ?? node.className}=${node.getAttribute("title")}`);
  }, selector);

  const probe = async (handle: (typeof handles)[number]) =>
    await handle.evaluate((node, watched) => {
      const element = node as HTMLElement;
      const style = getComputedStyle(element);
      return {
        testid: element.getAttribute("data-testid") ?? element.className,
        styles: Object.fromEntries(watched.map((property) => [property, style.getPropertyValue(property)])),
      };
    }, WATCHED);

  await page.mouse.move(2, 2);
  const pointerCursor: string[] = [];
  const hoverChanges: string[] = [];

  for (const handle of handles) {
    const box = await handle.boundingBox();
    if (!box || box.width < 2 || box.height < 2) continue;

    // Reversibility test rather than a plain before/after diff. Battle and dialogue surfaces
    // mutate their own classes mid-census (turn changes, ATB, acting flags), so a one-way diff
    // reports animation as a hover leak. A genuine :hover effect appears when the pointer is
    // over the element and reverts when it leaves; a phase change does not revert. Real
    // Chromium mouse movement is required because a dispatched MouseEvent never sets :hover.
    const off = await probe(handle);
    if (off.styles.cursor === "pointer") pointerCursor.push(String(off.testid));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const on = await probe(handle);
    await page.mouse.move(2, 2);
    const back = await probe(handle);

    for (const property of WATCHED) {
      const changedOnHover = off.styles[property] !== on.styles[property];
      const revertedOnLeave = on.styles[property] !== back.styles[property]
        && off.styles[property] === back.styles[property];
      if (changedOnHover && revertedOnLeave) hoverChanges.push(`${on.testid}:${property}`);
    }
  }

  expect({ pointerCursor, nativeTooltips, hoverChanges }).toEqual({
    pointerCursor: [],
    nativeTooltips: [],
    hoverChanges: [],
  });
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

test("shop buy list exposes no pointer affordance", async ({ page }) => {
  await boot(page, projectWithCommand({ kind: "shop", itemIds: ["item_potion"], allowSell: true }));
  await activateAdjacentEvent(page);
  await page.getByTestId("shop-scene").waitFor();
  await expectPointerInert(page, "[data-testid='shop-scene']");
  // Enter the actual buy list: party faces and the merchant-gold panel only mount here,
  // which is exactly where two native tooltips previously survived.
  await page.getByTestId("shop-mode-buy").waitFor();
  await page.keyboard.press("Enter");
  await page.getByTestId("shop-buy-item_potion").waitFor();
  await page.getByTestId("shop-party-sprite-actor_hero").waitFor();
  await page.getByTestId("shop-merchant-gold").waitFor();
  await expectPointerInert(page, "[data-testid='shop-scene']");
});

test("name entry exposes no pointer affordance", async ({ page }) => {
  await boot(page, projectWithCommand({
    kind: "enterHeroName",
    actorId: "actor_hero",
    maxLength: 6,
    showInitialName: true,
  }));
  await activateAdjacentEvent(page);
  await page.getByTestId("runtime-name-entry").waitFor();
  await expectPointerInert(page, "[data-testid='runtime-name-entry']");
});

test("terminal ending screen exposes no pointer affordance", async ({ page }) => {
  await boot(page, projectWithCommand({ kind: "ending", title: "End", message: "Done" }));
  await activateAdjacentEvent(page);
  await page.getByTestId("ending-screen").waitFor();
  await expectPointerInert(page, "[data-testid='ending-screen']");
});

test("battle surface exposes no pointer affordance", async ({ page }) => {
  await boot(page, battle);
  await activateAdjacentEvent(page);
  await page.getByTestId("battle-scene").waitFor();
  await expectPointerInert(page, "[data-testid='battle-scene']");
});
