import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { seedReferenceBattleProject, startReferenceBattle } from "./battleReferenceProject";

const OUT = "output/evidence/battle-browser-repro";

test("battle UI dogfood repro with diagnostics", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize({ width: 1360, height: 900 });
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);

  let diag = await battleDiagnostics(page);
  await writeFile(`${OUT}/06-battle-open.json`, `${JSON.stringify(diag, null, 2)}\n`, "utf8");
  await page.screenshot({ path: `${OUT}/06-battle-open.png`, fullPage: true });
  expect(diag.present).toBeTruthy();
  expect(diag.sceneRect?.w ?? 0).toBeGreaterThan(200);
  // Command panel should not be microscopic after mockup-CSS removal.
  expect(diag.commandPanelRect?.w ?? 0).toBeGreaterThan(80);

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  diag = await battleDiagnostics(page);
  await writeFile(`${OUT}/07-after-attack.json`, `${JSON.stringify(diag, null, 2)}\n`, "utf8");
  await page.screenshot({ path: `${OUT}/07-after-attack.png`, fullPage: true });

  await page.getByTestId("battle-target-enemy-1").click();
  await page.waitForTimeout(700);
  diag = await battleDiagnostics(page);
  await writeFile(`${OUT}/08-after-target.json`, `${JSON.stringify(diag, null, 2)}\n`, "utf8");
  await page.screenshot({ path: `${OUT}/08-after-target.png`, fullPage: true });

  for (let i = 0; i < 20; i++) {
    diag = await battleDiagnostics(page);
    if (diag.phase === "command" || diag.phase === "actorCommand" || diag.phase === "result") break;
    if (await page.getByTestId("actor-command-attack").isVisible().catch(() => false)) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
  }
  await writeFile(`${OUT}/09-mid.json`, `${JSON.stringify(diag, null, 2)}\n`, "utf8");
  await page.screenshot({ path: `${OUT}/09-mid.png`, fullPage: true });
  await writeFile(`${OUT}/final-diag.json`, `${JSON.stringify(diag, null, 2)}\n`, "utf8");
  // Reference enemy has 1 HP, so battle may already have closed by this point.
});

async function battleDiagnostics(page: Page) {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    if (!scene) return { present: false as const };
    const cs = getComputedStyle(scene);
    const rect = scene.getBoundingClientRect();
    const enemies = [...document.querySelectorAll<HTMLElement>(".battle-enemy, [data-testid^='battle-target-enemy']")].map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        testid: el.dataset.testid,
        className: el.className,
        text: (el.textContent ?? "").trim().slice(0, 120),
        targetable: el.dataset.battleTargetable,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        bg: (s.backgroundImage || s.backgroundColor || "").slice(0, 120),
      };
    });
    const actors = [...document.querySelectorAll<HTMLElement>(".battle-actor, [data-testid^='battle-actor']")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        testid: el.dataset.testid,
        className: el.className,
        text: (el.textContent ?? "").trim().slice(0, 100),
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      };
    });
    const commands = [...document.querySelectorAll<HTMLElement>("[data-testid^='actor-command-']")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        testid: el.dataset.testid,
        text: (el.textContent ?? "").trim(),
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      };
    });
    const message = document.querySelector<HTMLElement>("[data-testid='battle-message-window']");
    const party = document.querySelector<HTMLElement>("[data-testid='battle-party-status'], .battle-party-status");
    const field = document.querySelector<HTMLElement>("[data-testid='battle-field'], .battle-field");
    const commandPanel = document.querySelector<HTMLElement>(".battle-command-panel, [data-testid='battle-command-panel']");
    return {
      present: true as const,
      phase: scene.dataset.battlePhase ?? null,
      directorStep: scene.dataset.battleDirectorStep ?? null,
      sceneClass: scene.className,
      sceneRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      sceneStyle: {
        display: cs.display,
        width: cs.width,
        height: cs.height,
        position: cs.position,
        overflow: cs.overflow,
        background: (cs.backgroundImage || cs.backgroundColor || "").slice(0, 160),
      },
      messageText: message?.textContent?.trim().slice(0, 400) ?? null,
      messageRect: message ? rectOf(message) : null,
      partyText: party?.textContent?.trim().slice(0, 400) ?? null,
      partyRect: party ? rectOf(party) : null,
      fieldRect: field ? rectOf(field) : null,
      fieldChildCount: field?.children.length ?? 0,
      commandPanelRect: commandPanel ? rectOf(commandPanel) : null,
      enemies,
      actors,
      commands,
      battleTestIds: [...document.querySelectorAll("[data-testid]")]
        .map((el) => (el as HTMLElement).dataset.testid)
        .filter((id): id is string => !!id && /battle|actor-command|enemy|target/.test(id)),
      sceneHtml: scene.outerHTML.slice(0, 5000),
    };

    function rectOf(el: Element) {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }
  });
}
