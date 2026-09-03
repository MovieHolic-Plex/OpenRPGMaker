/* rm2000 (front-view) turn-based battle screen — pixel/typography/geometry acceptance gate.
 *
 * Why this spec exists: later CSS work on the rm2000 battle screen is verified
 * against these numbers, so every assertion here must be a **measurement of the
 * real battle screen**, never a selector or boot guard. The boot path is the same
 * one the shipping specs use (`seedProjectFromSupabaseCanonical` → editor
 * `mode-play` → title Enter → `event-battle-start`), and every wait is on exact
 * DOM state (attribute / visibility / concrete predicate). There is no sleep,
 * no polling delay, and no timing luck in this file.
 *
 * The seeded project deliberately sets **neither** `system.battleUiStyle` nor
 * `system.battleFlow`: the gate asserts the *default* battle screen is the
 * rm2000 strict turn-based one. Everything else measures whatever the runtime
 * actually renders, so a wrong default shows up as a concrete attribute value
 * next to the concrete pixel numbers instead of hiding the rest of the report.
 *
 * Measurement conventions
 * -----------------------
 *  · Logical px = visual px / cumulative stage scale, where the cumulative scale
 *    is `sceneRect.width / 640` (the scene layout box is exactly the 640×480
 *    logical stage — asserted). The root's `--battle-stage-scale` /
 *    `data-battle-stage-scale` is the scene's **own** scale only; on the real play
 *    route an ancestor `.play-stage` is already scaled, so that attribute is
 *    reported as a diagnostic but is not used as the divisor.
 *  · "Integer geometry" is checked on the layout skeleton (field, command host /
 *    panel / menu / rows, party, actor rows, message strip), not on text spans:
 *    a text span's width follows glyph metrics and is fractional by nature.
 *  · Text separation uses per-text-node glyph rects (`Range.getClientRects`), so
 *    an intersection means real glyphs sit on top of real glyphs.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { reseedSessionRng } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { waitForActorCommand } from "./battleReferenceProject";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/battle-rm2000-pixel";
const LOGICAL_WIDTH = 640;
const LOGICAL_HEIGHT = 480;
const COMMAND_COLUMN_LOGICAL = 184;
const HUD_ROW_LOGICAL = 120;
const MAX_FONT_SIZES = 4;
/** Logical-px tolerance for "integer": browser rects are 1/64-px snapped, and the
 *  division by a fractional stage scale can only introduce error of that order. */
const INTEGER_EPSILON = 0.02;

type Mutable = Record<string, unknown>;
/** Default party order used by the matrix; every id exists in the default database. */
const PARTY_ORDER = ["actor_hero", "actor_guardian", "actor_mage", "actor_scout"] as const;
type SeedOptions = {
  readonly partySize?: number;
  readonly partyActorIds?: readonly string[];
  readonly enemyCount?: number;
  /** Set for the phase walk: a one-shot enemy so the walk reaches `result`. */
  readonly fragileEnemy?: boolean;
};

/**
 * Builds the seed project for this gate: the **default** project database plus the
 * battle-v3 fixture's `battle-start` event, with **no** authored `battleUiStyle`
 * and **no** authored `battleFlow` — the gate asserts what the defaults render.
 *
 * Why the default database instead of the battle-v3 fixture project itself: the
 * editor's test-play entry used to be fail-closed behind a reference gate (removed)
 * (`src/editor/authoringTestGate.ts`), and boot normalization injects the whole
 * default item catalog (`ensureDefaultDatabaseIconResources`) into any project.
 * On the minimal battle-v3 fixture those injected items reference skills/states/
 * animations the fixture does not have, so the gate reports 95 reference issues
 * and refuses to open the play window — which is exactly why the existing
 * fixture-based battle specs (battle-keyboard-input, battle-skins-visual-qa)
 * are red at origin/main. The default project is reference-clean by
 * construction, so it boots, and the battle screen it opens is the real one.
 */
async function seedDefaultSkinBattleProject(page: Page, options: SeedOptions = {}): Promise<void> {
  const fixtureText = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const fixture = deserialize(fixtureText);
  const project = createBlankProject();
  project.meta = { ...project.meta, title: "정면 전투 픽셀 게이트" };

  // The fixture's action event runs `battleProcessing` on `troop_slime`, which the
  // default database also owns. Its runtime debug marker is `event-battle-start`.
  const startMap = project.maps[project.startMapId];
  if (!startMap) throw new Error(`missing start map ${project.startMapId}`);
  const battleEvents = fixture.maps.map_battle?.events;
  if (!battleEvents?.length) throw new Error("missing battle-start event in battle-v3 fixture");
  startMap.events = [
    ...startMap.events.filter((event) => event.id !== "battle-start"),
    // Placed next to the player so the runtime marker is on-screen and clickable.
    ...battleEvents.map((event) => ({ ...event, x: project.startPos.x + 1, y: project.startPos.y })),
  ];

  const system = project.system as unknown as Mutable;
  delete system.battleUiStyle;
  delete system.battleFlow;

  const party = options.partyActorIds ?? PARTY_ORDER.slice(0, options.partySize ?? 4);
  project.session.partyActorIds = [...party];
  project.system.startActorIds = [...party];

  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime record");
  const enemyCount = options.enemyCount ?? 1;
  // Empty `members` makes battleBattlers fall back to `classicEnemyFormation`,
  // so enemy placement is the engine's own left-side formation, not test art.
  troop.enemyIds = Array.from({ length: enemyCount }, () => "enemy_slime");
  troop.members = [];

  if (options.fragileEnemy) {
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
    if (!enemy) throw new Error("missing enemy_slime record");
    enemy.stats.maxHp = 1;
    enemy.stats.defense = 0;
    // Attack 0 / agility 1: the enemy can neither kill the party nor act first, so
    // the walk always reaches `impact` → victory `result` from the actor's action.
    enemy.stats.attack = 0;
    enemy.stats.agility = 1;
  }

  reseedSessionRng(project.session as unknown as PlaySessionLike, 42_001);
  await seedProjectFromSupabaseCanonical(page, project);
}

/** Real play route into the battle screen — identical beats to battle-skins-visual-qa. */
async function enterBattle(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 10_000 });
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 20_000 });
}

/**
 * Every rect/glyph number below depends on the runtime pixel font being the one
 * actually rendering. Measured proof that this matters: with the fallback face
 * still in use, the same command row measured 17.172 logical px tall and the key
 * prompt line 335x11; once NeoDunggeunmo was applied the same rows measured
 * 16.484 and 402x12. So the font is a *wait condition*, not a nicety.
 */
async function waitForRuntimeFont(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.fonts.status === "loaded" && document.fonts.check('16px "NeoDunggeunmo"'),
    undefined,
    { timeout: 20_000 },
  );
}

type Rect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
type NamedRect = { readonly label: string; readonly rect: Rect };
type TextRect = { readonly group: string; readonly text: string; readonly cls: string; readonly rect: Rect };
type Probe = {
  readonly skin: string | null;
  readonly flow: string | null;
  readonly phase: string | null;
  readonly step: string | null;
  readonly uiStyle: string | null;
  readonly stageScaleAttr: string | null;
  readonly sceneLayout: { readonly width: number; readonly height: number };
  readonly cumulativeScale: number;
  readonly gridColumns: string;
  readonly gridRows: string;
  readonly commandColumnLogicalWidth: number | null;
  readonly hudRowLogicalHeight: number | null;
  readonly commandHost: Rect | null;
  readonly party: Rect | null;
  readonly field: Rect | null;
  readonly structural: readonly NamedRect[];
  readonly fractional: readonly NamedRect[];
  readonly fontSizes: readonly { readonly px: number; readonly samples: readonly string[] }[];
  readonly overflow: readonly {
    readonly label: string;
    readonly scrollWidth: number;
    readonly clientWidth: number;
    readonly scrollHeight: number;
    readonly clientHeight: number;
  }[];
  readonly textRects: readonly TextRect[];
  readonly textIntersections: readonly {
    readonly a: TextRect;
    readonly b: TextRect;
    readonly overlapX: number;
    readonly overlapY: number;
  }[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const probeBattle = (): Probe => {
  const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
  if (!scene) throw new Error("battle-scene not mounted");
  const sceneRect = scene.getBoundingClientRect();
  // The scene layout box is the logical stage; the visual rect carries every
  // ancestor transform, so this ratio is the true logical→visual factor.
  const cumulativeScale = sceneRect.width / 640;
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  const toLogical = (rect: DOMRect): Rect => ({
    left: round((rect.left - sceneRect.left) / cumulativeScale),
    top: round((rect.top - sceneRect.top) / cumulativeScale),
    width: round(rect.width / cumulativeScale),
    height: round(rect.height / cumulativeScale),
  });

  const visible = (el: Element): boolean => {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number(style.opacity) <= 0.05) return false;
      node = node.parentElement;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    // Fully clipped out of the stage counts as invisible.
    return rect.right > sceneRect.left && rect.left < sceneRect.right
      && rect.bottom > sceneRect.top && rect.top < sceneRect.bottom;
  };

  const describe = (el: Element, index: number): string => {
    const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).join(".")}` : el.tagName.toLowerCase();
    const testid = (el as HTMLElement).dataset?.testid;
    return `${cls}${testid ? `[${testid}]` : ""}#${index}`;
  };

  /* ---- layout skeleton rects (integer-geometry set) ---- */
  const STRUCTURAL = [
    ".battle-field",
    ".battle-command-host",
    ".battle-command-panel",
    ".battle-command-menu",
    ".battle-command",
    ".battle-party",
    ".battle-actor-status",
    ".battle-message-window",
    ".battle-message-lines",
  ];
  const structural: NamedRect[] = [];
  for (const selector of STRUCTURAL) {
    const nodes = Array.from(scene.querySelectorAll(selector));
    nodes.forEach((node, index) => {
      if (!visible(node)) return;
      structural.push({ label: describe(node, index), rect: toLogical(node.getBoundingClientRect()) });
    });
  }
  const isFractional = (value: number): boolean => Math.abs(value - Math.round(value)) > 0.02;
  const fractional = structural.filter(({ rect }) =>
    isFractional(rect.left) || isFractional(rect.top) || isFractional(rect.width) || isFractional(rect.height));

  /* ---- font sizes actually used by rendered text ---- */
  const fontMap = new Map<number, string[]>();
  for (const el of Array.from(scene.querySelectorAll<HTMLElement>("*"))) {
    const ownText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.nodeValue ?? "")
      .join("")
      .trim();
    if (!ownText) continue;
    if (!visible(el)) continue;
    const px = round(parseFloat(getComputedStyle(el).fontSize));
    const samples = fontMap.get(px) ?? [];
    if (samples.length < 4) samples.push(`${el.className || el.tagName.toLowerCase()}: "${ownText.slice(0, 18)}"`);
    fontMap.set(px, samples);
  }
  const fontSizes = Array.from(fontMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([px, samples]) => ({ px, samples }));

  /* ---- scroll overflow ---- */
  const overflow: Probe["overflow"] = [".battle-command-panel", ".battle-party"]
    .flatMap((selector) => Array.from(scene.querySelectorAll<HTMLElement>(selector)).map((node, index) => ({
      label: describe(node, index),
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    })));

  /* ---- glyph rects for command rows / party rows / message strip ---- */
  const textRects: TextRect[] = [];
  const collect = (root: Element | null, group: string): void => {
    if (!root || !visible(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = (node.nodeValue ?? "").trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent || !visible(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width <= 0.5 || rect.height <= 0.5) continue;
        textRects.push({
          group,
          text: text.slice(0, 24),
          cls: parent.className || parent.tagName.toLowerCase(),
          rect: toLogical(rect as DOMRect),
        });
      }
    }
  };
  for (const node of Array.from(scene.querySelectorAll(".battle-command-panel"))) collect(node, "command");
  for (const node of Array.from(scene.querySelectorAll(".battle-party"))) collect(node, "party");
  for (const node of Array.from(scene.querySelectorAll(".battle-message-window"))) collect(node, "message");

  const textIntersections: { a: TextRect; b: TextRect; overlapX: number; overlapY: number }[] = [];
  for (let left = 0; left < textRects.length; left += 1) {
    for (let right = left + 1; right < textRects.length; right += 1) {
      const a = textRects[left]!;
      const b = textRects[right]!;
      const overlapX = Math.min(a.rect.left + a.rect.width, b.rect.left + b.rect.width) - Math.max(a.rect.left, b.rect.left);
      const overlapY = Math.min(a.rect.top + a.rect.height, b.rect.top + b.rect.height) - Math.max(a.rect.top, b.rect.top);
      if (overlapX > 1 && overlapY > 1) textIntersections.push({ a, b, overlapX: round(overlapX), overlapY: round(overlapY) });
    }
  }

  const host = scene.querySelector<HTMLElement>(".battle-command-host");
  const party = scene.querySelector<HTMLElement>(".battle-party");
  const field = scene.querySelector<HTMLElement>(".battle-field");
  const sceneStyle = getComputedStyle(scene);
  const trackValue = (tracks: string, index: number): number | null => {
    const parts = tracks.trim().split(/\s+/);
    const raw = parts[index];
    if (!raw) return null;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? round(parsed) : null;
  };

  return {
    skin: scene.getAttribute("data-battle-skin"),
    flow: scene.getAttribute("data-battle-flow"),
    phase: scene.getAttribute("data-battle-phase"),
    step: scene.getAttribute("data-battle-director-step"),
    uiStyle: scene.getAttribute("data-battle-ui-style"),
    stageScaleAttr: scene.getAttribute("data-battle-stage-scale"),
    sceneLayout: { width: scene.offsetWidth, height: scene.offsetHeight },
    cumulativeScale: round(cumulativeScale),
    gridColumns: sceneStyle.gridTemplateColumns,
    gridRows: sceneStyle.gridTemplateRows,
    commandColumnLogicalWidth: trackValue(sceneStyle.gridTemplateColumns, 0),
    hudRowLogicalHeight: trackValue(sceneStyle.gridTemplateRows, 1),
    commandHost: host && visible(host) ? toLogical(host.getBoundingClientRect()) : null,
    party: party && visible(party) ? toLogical(party.getBoundingClientRect()) : null,
    field: field && visible(field) ? toLogical(field.getBoundingClientRect()) : null,
    structural,
    fractional,
    fontSizes,
    overflow,
    textRects,
    textIntersections,
  };
};

/** Installs a mutation-driven recorder that stores the first logical field rect
 *  seen for every director phase. Deterministic: it captures whatever the DOM
 *  actually passes through, so brief phases (impact) cannot be missed by polling. */
const installPhaseRecorder = (): void => {
  const store: Record<string, { left: number; top: number; width: number; height: number }> = {};
  const order: string[] = [];
  (window as any).__rm2000PhaseRects = store;
  (window as any).__rm2000PhaseOrder = order;
  const capture = (): void => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    if (!scene) return;
    const field = scene.querySelector<HTMLElement>(".battle-field");
    if (!field) return;
    const step = scene.getAttribute("data-battle-director-step") ?? "unknown";
    const hasSubmenu = !!scene.querySelector("[data-testid='actor-command-back']");
    const key = step === "command" && hasSubmenu ? "submenu" : step;
    if (key in store) return;
    const sceneRect = scene.getBoundingClientRect();
    if (sceneRect.width <= 0) return;
    const scale = sceneRect.width / 640;
    const rect = field.getBoundingClientRect();
    const round = (value: number): number => Math.round(((value / scale) + Number.EPSILON) * 100) / 100;
    store[key] = {
      left: round(rect.left - sceneRect.left),
      top: round(rect.top - sceneRect.top),
      width: round(rect.width),
      height: round(rect.height),
    };
    order.push(key);
  };
  const observer = new MutationObserver(capture);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-battle-director-step", "data-battle-phase", "class", "style"],
  });
  capture();
};
/* eslint-enable @typescript-eslint/no-explicit-any */

function formatRect(rect: Rect | null): string {
  if (!rect) return "<absent>";
  return `${rect.width}×${rect.height} @ (${rect.left}, ${rect.top})`;
}

function formatText(entry: TextRect): string {
  return `${entry.group}/${entry.cls} "${entry.text}" ${formatRect(entry.rect)}`;
}

function assertNoTextIntersections(probe: Probe, where: string): void {
  const detail = probe.textIntersections
    .map((pair) => `  ${formatText(pair.a)}  ×  ${formatText(pair.b)}  (overlap ${pair.overlapX}×${pair.overlapY} logical px)`)
    .join("\n");
  expect.soft(
    probe.textIntersections.length,
    `${where}: visible text glyph rects intersect (${probe.textIntersections.length} pair(s)) among `
    + `${probe.textRects.length} measured text rects:\n${detail}`,
  ).toBe(0);
}

function assertNoScrollOverflow(probe: Probe, where: string): void {
  for (const entry of probe.overflow) {
    expect.soft(
      entry.scrollWidth,
      `${where}: ${entry.label} scrolls horizontally (scrollWidth ${entry.scrollWidth} > clientWidth ${entry.clientWidth})`,
    ).toBeLessThanOrEqual(entry.clientWidth);
    expect.soft(
      entry.scrollHeight,
      `${where}: ${entry.label} scrolls vertically (scrollHeight ${entry.scrollHeight} > clientHeight ${entry.clientHeight})`,
    ).toBeLessThanOrEqual(entry.clientHeight);
  }
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 768 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("rm2000 gate (a) — an unauthored project boots the rm2000 strict battle screen", async ({ page }) => {
  test.setTimeout(180_000);
  await seedDefaultSkinBattleProject(page);
  await enterBattle(page);
  await waitForActorCommand(page);
  await waitForRuntimeFont(page);

  const probe = await page.evaluate(probeBattle);
  // Stage sanity is a *measurement*, not a guard: the logical box is what every
  // logical-px number below is divided by.
  expect(
    [probe.sceneLayout.width, probe.sceneLayout.height],
    `stage layout box must be the ${LOGICAL_WIDTH}×${LOGICAL_HEIGHT} logical stage `
    + `(measured ${probe.sceneLayout.width}×${probe.sceneLayout.height}, `
    + `own --battle-stage-scale=${probe.stageScaleAttr}, cumulative=${probe.cumulativeScale})`,
  ).toEqual([LOGICAL_WIDTH, LOGICAL_HEIGHT]);

  expect.soft(
    probe.skin,
    `default battle skin: data-battle-skin="${probe.skin}" (ui-style="${probe.uiStyle}") on a project that authors no battleUiStyle`,
  ).toBe("rm2000");
  expect.soft(
    probe.flow,
    `default battle flow: data-battle-flow="${probe.flow}" (phase "${probe.phase}") on a project that authors no battleFlow`,
  ).toBe("strict");
});

test("rm2000 gate (b,c,d,e) — command/target phase pixel geometry and typography", async ({ page }) => {
  test.setTimeout(180_000);
  await seedDefaultSkinBattleProject(page);
  await enterBattle(page);
  await waitForActorCommand(page);
  await waitForRuntimeFont(page);
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-sequence-busy", "false");

  const commandProbe = await page.evaluate(probeBattle);
  const context = `skin="${commandProbe.skin}" flow="${commandProbe.flow}" scale=${commandProbe.cumulativeScale}`;

  /* (c) integer geometry */
  expect.soft(
    commandProbe.commandColumnLogicalWidth,
    `command column width: used grid track = ${commandProbe.commandColumnLogicalWidth}px `
    + `(grid-template-columns "${commandProbe.gridColumns}"), ${context}`,
  ).toBe(COMMAND_COLUMN_LOGICAL);
  expect.soft(
    commandProbe.hudRowLogicalHeight,
    `HUD row height: used grid track = ${commandProbe.hudRowLogicalHeight}px `
    + `(grid-template-rows "${commandProbe.gridRows}"), ${context}`,
  ).toBe(HUD_ROW_LOGICAL);
  expect.soft(
    commandProbe.commandHost ? commandProbe.commandHost.width : null,
    `command column width, measured: .battle-command-host = ${formatRect(commandProbe.commandHost)} logical px`,
  ).toBeCloseTo(COMMAND_COLUMN_LOGICAL, 1);
  expect.soft(
    commandProbe.party ? commandProbe.party.height : null,
    `HUD row height, measured: .battle-party = ${formatRect(commandProbe.party)} logical px`,
  ).toBeCloseTo(HUD_ROW_LOGICAL, 1);

  const fractionalDetail = commandProbe.fractional
    .map(({ label, rect }) => `  ${label} → ${formatRect(rect)}`)
    .join("\n");
  expect.soft(
    commandProbe.fractional.length,
    `command phase: ${commandProbe.fractional.length} of ${commandProbe.structural.length} layout rects have a `
    + `fractional logical left/top/width/height (tolerance ${INTEGER_EPSILON}px):\n${fractionalDetail}`,
  ).toBe(0);

  /* (d) typography */
  const fontDetail = commandProbe.fontSizes
    .map((entry) => `  ${entry.px}px → ${entry.samples.join(" | ")}`)
    .join("\n");
  expect.soft(
    commandProbe.fontSizes.length,
    `command phase: ${commandProbe.fontSizes.length} distinct computed font sizes inside the battle scene `
    + `(max ${MAX_FONT_SIZES}):\n${fontDetail}`,
  ).toBeLessThanOrEqual(MAX_FONT_SIZES);
  const oddFonts = commandProbe.fontSizes.filter((entry) => !Number.isInteger(entry.px) || entry.px % 2 !== 0);
  expect.soft(
    oddFonts.map((entry) => entry.px),
    `command phase: non-even logical font sizes ${JSON.stringify(oddFonts.map((entry) => entry.px))} — `
    + oddFonts.map((entry) => `${entry.px}px on ${entry.samples[0]}`).join("; "),
  ).toEqual([]);

  /* (b) + (e) */
  assertNoTextIntersections(commandProbe, "command phase");
  assertNoScrollOverflow(commandProbe, "command phase");

  /* target phase: the message strip is visible here, so it can collide with the HUD.
     Confirm with the keyboard — the classic runtime is keyboard-only and the command
     menu deliberately swallows pointer events (battle.css keyboard-only rule). */
  const scene = page.getByTestId("battle-scene");
  await expect(scene.locator(".battle-command[data-battle-command-cursor='true']"))
    .toHaveAttribute("data-testid", "actor-command-attack");
  await page.keyboard.press("z");
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  const targetProbe = await page.evaluate(probeBattle);
  assertNoTextIntersections(targetProbe, "target phase");
  assertNoScrollOverflow(targetProbe, "target phase");
  const targetFractional = targetProbe.fractional
    .map(({ label, rect }) => `  ${label} → ${formatRect(rect)}`)
    .join("\n");
  expect.soft(
    targetProbe.fractional.length,
    `target phase: ${targetProbe.fractional.length} of ${targetProbe.structural.length} layout rects have a `
    + `fractional logical rect:\n${targetFractional}`,
  ).toBe(0);
});

test("rm2000 gate (f) — keyboard-only phase walk keeps the field box byte-identical", async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  // One actor + one one-shot enemy: the walk owns the whole round, so it reaches
  // impact and the victory result from a single confirmed action.
  // actor_mage learns skill_arcane_bolt at level 1, so the skill submenu always
  // has a usable row for the keyboard walk.
  await seedDefaultSkinBattleProject(page, { partyActorIds: ["actor_mage"], enemyCount: 1, fragileEnemy: true });
  await page.evaluate(installPhaseRecorder);
  await enterBattle(page);

  const scene = page.getByTestId("battle-scene");
  await page.screenshot({ path: `${EVIDENCE_DIR}/intro.png` });

  await waitForActorCommand(page);
  await waitForRuntimeFont(page);
  await expect(scene).toHaveAttribute("data-battle-sequence-busy", "false");
  await page.screenshot({ path: `${EVIDENCE_DIR}/command.png` });

  const cursor = scene.locator(".battle-command[data-battle-command-cursor='true']");
  await expect(cursor).toHaveAttribute("data-testid", "actor-command-attack");
  await page.keyboard.press("ArrowDown");
  await expect(cursor).toHaveAttribute("data-testid", "actor-command-skill");

  await page.keyboard.press("z");
  await expect(page.getByTestId("actor-command-back")).toBeVisible();
  await expect(scene.locator(".battle-command-menu .battle-submenu-header")).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/submenu.png` });

  await page.keyboard.press("z");
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect", { timeout: 10_000 });
  await page.screenshot({ path: `${EVIDENCE_DIR}/target.png` });

  await page.keyboard.press("z");
  // Wait on the concrete recorder predicate rather than on a brief attribute value.
  await page.waitForFunction(
    () => "impact" in ((window as unknown as { __rm2000PhaseRects: Record<string, unknown> }).__rm2000PhaseRects),
    undefined,
    { timeout: 30_000 },
  );
  await page.screenshot({ path: `${EVIDENCE_DIR}/impact.png` });

  await expect(scene).toHaveAttribute("data-battle-director-step", "result", { timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 30_000 });
  await page.screenshot({ path: `${EVIDENCE_DIR}/result.png` });

  const rects = await page.evaluate(() =>
    (window as unknown as { __rm2000PhaseRects: Record<string, Rect> }).__rm2000PhaseRects);
  const order = await page.evaluate(() =>
    (window as unknown as { __rm2000PhaseOrder: string[] }).__rm2000PhaseOrder);
  const walk = ["intro", "command", "submenu", "target", "impact", "result"];
  const observed = walk.filter((phase) => phase in rects);
  expect(
    observed,
    `phase walk must pass through every phase — observed order ${JSON.stringify(order)}`,
  ).toEqual(walk);

  const table = walk.map((phase) => `  ${phase.padEnd(8)} ${formatRect(rects[phase] ?? null)}`).join("\n");
  const baseline = JSON.stringify(rects.intro);
  for (const phase of walk) {
    expect.soft(
      JSON.stringify(rects[phase]),
      `field box must not shift between phases (0 logical px). Measured .battle-field per phase:\n${table}`,
    ).toBe(baseline);
  }
});

for (const partySize of [1, 2, 3, 4]) {
  test(`rm2000 gate (g) — party ${partySize} × enemies 1..8 stay contained`, async ({ page }) => {
    test.setTimeout(600_000);
    const failures: string[] = [];
    for (const enemyCount of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await seedDefaultSkinBattleProject(page, { partySize, enemyCount });
      await enterBattle(page);
      await waitForActorCommand(page);
      await waitForRuntimeFont(page);
      await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-sequence-busy", "false");
      const probe = await page.evaluate(probeBattle);
      const where = `party ${partySize} × enemies ${enemyCount} (scale ${probe.cumulativeScale})`;

      for (const entry of probe.overflow) {
        if (entry.scrollWidth > entry.clientWidth) {
          failures.push(`${where}: ${entry.label} scrollWidth ${entry.scrollWidth} > clientWidth ${entry.clientWidth}`);
        }
        if (entry.scrollHeight > entry.clientHeight) {
          failures.push(`${where}: ${entry.label} scrollHeight ${entry.scrollHeight} > clientHeight ${entry.clientHeight}`);
        }
      }
      for (const pair of probe.textIntersections) {
        failures.push(`${where}: text overlap ${formatText(pair.a)} × ${formatText(pair.b)} (${pair.overlapX}×${pair.overlapY} logical px)`);
      }
      for (const entry of probe.fractional) {
        failures.push(`${where}: fractional layout rect ${entry.label} → ${formatRect(entry.rect)}`);
      }
    }
    expect(failures, `party ${partySize} matrix defects:\n${failures.join("\n")}`).toEqual([]);
  });
}
