import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const outDir = new URL("./", import.meta.url);
const route = "http://127.0.0.1:5173/";
const fixture = JSON.parse(await readFile(new URL("../../../test/fixtures/projects/battle-v3.json", import.meta.url), "utf8"));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await desktop.newPage();
  await seed(page);
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await page.screenshot({ path: file("desktop-after-new-game.png"), fullPage: true });
  await clickBattleEvent(page, "desktop-after-event-click.png", "runtime-after-event-click.json");
  await page.getByTestId("battle-scene").waitFor({ state: "visible", timeout: 10000 });
  await page.getByTestId("battle-party").waitFor({ state: "visible" });
  await page.getByTestId("battle-actor-actor_hero").waitFor({ state: "visible" });
  await writeJson("actor-render-state.json", await actorRenderState(page));
  await page.getByTestId("enemy-1").waitFor({ state: "visible" });
  await page.getByTestId("actor-command-skill").waitFor({ state: "visible" });
  const desktopGeometry = await battleGeometry(page);
  await writeJson("desktop-battle-geometry.json", desktopGeometry);
  assertRm2k3Geometry(desktopGeometry, "desktop");
  await page.screenshot({ path: file("desktop-battle-entry.png"), fullPage: true });
  const beforeState = await runtimeState(page);
  await writeJson("runtime-before.json", beforeState);
  await page.getByTestId("actor-command-skill").click();
  const animation = page.getByTestId("battle-animation");
  await animation.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("[data-testid='battle-animation']")?.getAttribute("data-current-frame") === "1");
  await page.screenshot({ path: file("desktop-skill-animation.png"), fullPage: true });
  await writeJson("animation-state.json", await animation.evaluate((node) => ({
    animationId: node.getAttribute("data-animation-id"),
    animationResourceId: node.getAttribute("data-animation-resource-id"),
    currentFrame: node.getAttribute("data-current-frame"),
    frameCount: node.getAttribute("data-animation-frame-count"),
    renderedFrameCount: node.getAttribute("data-rendered-frame-count"),
    screenShake: node.getAttribute("data-animation-screen-shake"),
    soundResourceIds: node.getAttribute("data-animation-sound-resource-ids")
  })));
  await page.waitForFunction(() => {
    const text = document.querySelector("[data-testid='runtime-state-json']")?.textContent;
    if (!text) return false;
    return JSON.parse(text).battleResult === "victory";
  });
  await page.getByTestId("play-canvas").waitFor({ state: "visible" });
  await page.screenshot({ path: file("desktop-victory-exp.png"), fullPage: true });
  const afterState = await runtimeState(page);
  await writeJson("runtime-after.json", afterState);
  const beforeExp = beforeState.actorExperience?.actor_hero ?? 0;
  const afterExp = afterState.actorExperience?.actor_hero ?? 0;
  if (afterExp <= beforeExp) {
    throw new Error(`actor_hero EXP did not increase: before=${beforeExp}, after=${afterExp}`);
  }
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobile.newPage();
  await seed(mobilePage);
  await mobilePage.getByTestId("mode-play").click();
  await mobilePage.getByTestId("title-new-game").click();
  await mobilePage.screenshot({ path: file("mobile-after-new-game.png"), fullPage: true });
  await clickBattleEvent(mobilePage, "mobile-after-event-click.png", "runtime-mobile-after-event-click.json");
  await mobilePage.getByTestId("battle-scene").waitFor({ state: "visible", timeout: 10000 });
  await mobilePage.getByTestId("battle-actor-actor_hero").waitFor({ state: "visible" });
  await writeJson("actor-render-state-mobile.json", await actorRenderState(mobilePage));
  const mobileGeometry = await battleGeometry(mobilePage);
  await writeJson("mobile-battle-geometry.json", mobileGeometry);
  assertRm2k3Geometry(mobileGeometry, "mobile");
  await mobilePage.screenshot({ path: file("mobile-battle-entry.png"), fullPage: true });
  const layout = await mobilePage.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const commands = Array.from(document.querySelectorAll(".battle-command")).map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        text: button.textContent,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth
      };
    });
    return {
      commandCount: commands.length,
      clippedCommands: commands.filter((command) => command.left < 0 || command.right > viewportWidth).length,
      commands
    };
  });
  await writeJson("mobile-command-layout.json", layout);
  if (layout.commandCount !== 5 || layout.clippedCommands !== 0) {
    throw new Error(`mobile command layout failed: ${JSON.stringify(layout)}`);
  }
  await mobile.close();
} finally {
  await browser.close();
}

async function seed(page) {
  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, fixture);
  await page.goto(route);
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 15000 });
  await dismissOpenEditorModal(page);
}

async function clickBattleEvent(page, screenshotName, stateName) {
  await page.locator('[data-testid="event-battle-start"]').waitFor({ state: "visible", timeout: 15000 });
  await page.click('[data-testid="event-battle-start"]');
  await page.screenshot({ path: file(screenshotName), fullPage: true });
  await writeJson(stateName, await runtimeState(page));
}

async function dismissOpenEditorModal(page) {
  const modal = page.getByTestId("event-editor-modal");
  if (await modal.count() === 0) return;
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden", timeout: 5000 });
}

async function runtimeState(page) {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime-state-json");
  return JSON.parse(text);
}

async function actorRenderState(page) {
  return page.getByTestId("battle-actor-actor_hero").evaluate((node) => {
    const sprite = node.querySelector(".battle-actor-sprite");
    const image = node.querySelector(".battle-actor-image");
    const target = sprite ?? image;
    if (!(target instanceof HTMLElement)) {
      return { hasSprite: false, hasImage: false };
    }
    const rect = target.getBoundingClientRect();
    const style = window.getComputedStyle(target);
    return {
      hasSprite: sprite !== null,
      hasImage: image !== null,
      text: node.textContent,
      rect: { width: rect.width, height: rect.height, left: rect.left, top: rect.top },
      backgroundImage: style.backgroundImage,
      backgroundPosition: style.backgroundPosition,
      backgroundSize: style.backgroundSize,
      imageSrc: image instanceof HTMLImageElement ? image.currentSrc : null
    };
  });
}

async function battleGeometry(page) {
  return page.evaluate(() => {
    const rectOf = (selector) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    return {
      viewport,
      scene: rectOf("[data-testid='battle-scene']"),
      enemy: rectOf("[data-testid='enemy-1']"),
      actor: rectOf("[data-testid='battle-actor-actor_hero']"),
      command: rectOf(".battle-command-panel"),
      status: rectOf("[data-testid='battle-party']")
    };
  });
}

function assertRm2k3Geometry(geometry, label) {
  const { viewport, scene, enemy, actor, command, status } = geometry;
  for (const [name, rect] of Object.entries({ scene, enemy, actor, command, status })) {
    if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error(`${label}: missing ${name} geometry`);
    if (rect.left < -1 || rect.right > viewport.width + 1 || rect.top < -1 || rect.bottom > viewport.height + 1) {
      throw new Error(`${label}: ${name} is clipped: ${JSON.stringify(rect)}`);
    }
  }
  if (!(enemy.centerX < actor.centerX)) throw new Error(`${label}: enemy is not left of actor`);
  if (!(command.centerX < status.centerX)) throw new Error(`${label}: command window is not left of status window`);
  if (Math.abs(command.top - status.top) > 8) throw new Error(`${label}: command/status windows do not share bottom band`);
  if (!(command.bottom <= scene.bottom + 1 && status.bottom <= scene.bottom + 1)) {
    throw new Error(`${label}: HUD windows escape battle scene`);
  }
}

async function writeJson(name, value) {
  await writeFile(new URL(name, outDir), `${JSON.stringify(value, null, 2)}\n`);
}

function file(name) {
  return new URL(name, outDir).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}
