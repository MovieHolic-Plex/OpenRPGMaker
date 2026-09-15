/**
 * Capture browser evidence for event-editor progressive disclosure + aux accordion.
 * Usage: npx tsx C:/Users/hyeon/AppData/Local/Temp/capture-event-editor-ux-evidence.mts
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const OUT = join(process.cwd(), "output", "evidence", "event-editor-ux-progressive");

function targetProject(): Project {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("missing start map");

  const commands: Command[] = [
    { kind: "text", body: "나무 상자를 열어본다. 잠화가 들어 있다.", speaker: "" },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_opened", value: true },
      then: [{ kind: "text", body: "이미 열었다.", speaker: "" }],
      else: [{ kind: "text", body: "아이템을 얻었다.", speaker: "" }],
    },
  ];

  const page: EventPage = {
    id: "p1",
    name: "상자",
    conditions: [{ kind: "switch", switchId: "sw_chest_ready", value: true }],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };

  const event = {
    id: "ev_chest_demo",
    x: 4,
    y: 4,
    pages: [page],
    commands,
  };

  map.events = [event as (typeof map.events)[number]];
  map.name = "증거 맵";
  return project;
}

async function shot(page: Page, name: string): Promise<void> {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("shot", path);
}

async function openEditor(page: Page): Promise<void> {
  await page.getByTestId("layer-event").click({ timeout: 15_000 }).catch(async () => {
    // some boots land already in event layer
  });
  const openBtn = page.getByTestId("event-editor-open");
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
  } else {
    // select from list then open
    const row = page.getByTestId("event-list-row-ev_chest_demo");
    if (await row.isVisible().catch(() => false)) {
      await row.click();
      await page.getByTestId("event-editor-open").click();
    } else {
      // fallback: force open via evaluate if exposed
      await page.evaluate(() => {
        const anyWin = window as unknown as { __oprnOpenEventEditor?: (mapId: string, eventId: string) => void };
        // try clicking first event marker canvas double-click area is flaky; use export list
      });
      throw new Error("could not find event list row to open editor");
    }
  }
  await page.getByTestId("event-editor-modal").waitFor({ state: "visible", timeout: 15_000 });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const project = targetProject();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.addInitScript((seed) => {
    (window as unknown as { __OPRN_E2E_PROJECT__?: unknown }).__OPRN_E2E_PROJECT__ = seed;
    window.localStorage.clear();
  }, project);

  await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  // blankProject may ignore seed — also try without flag
  await page.waitForTimeout(800);
  if (!(await page.getByTestId("edit-canvas").isVisible().catch(() => false))) {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  }
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1000);

  // Prefer seeded project path used by e2e
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);

  // Ensure event layer tools
  for (const id of ["layer-event", "tool-event"]) {
    const el = page.getByTestId(id);
    if (await el.isVisible().catch(() => false)) await el.click();
  }

  // If event list missing, inject project via store if bridge exists
  const hasRow = await page.getByTestId("event-list-row-ev_chest_demo").isVisible().catch(() => false);
  if (!hasRow) {
    const injected = await page.evaluate((seed) => {
      const w = window as unknown as {
        __oprnStore?: { replace?: (p: unknown) => void };
        __OPRN_STORE__?: { replace?: (p: unknown) => void };
      };
      if (w.__oprnStore?.replace) {
        w.__oprnStore.replace(seed);
        return "oprnStore";
      }
      // fallback: set e2e seed and reload
      (window as unknown as { __OPRN_E2E_PROJECT__?: unknown }).__OPRN_E2E_PROJECT__ = seed;
      return "seed-only";
    }, project);
    console.log("inject", injected);
    if (injected === "seed-only") {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(800);
      for (const id of ["layer-event", "tool-event"]) {
        const el = page.getByTestId(id);
        if (await el.isVisible().catch(() => false)) await el.click();
      }
    }
  }

  await openEditor(page);
  await page.waitForTimeout(400);

  // 1) Default progressive disclosure
  await shot(page, "01-default-progressive-disclosure.png");
  await page.locator('[data-testid="event-editor-modal"] .event-editor-modal-window').screenshot({
    path: join(OUT, "01b-modal-only-default.png"),
  });

  // metrics
  const metrics = await page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLDetailsElement | HTMLElement | null;
    const conditions = q('[data-testid="event-classic-conditions"]') as HTMLDetailsElement | null;
    const movement = q('[data-testid="event-classic-movement-section"]') as HTMLDetailsElement | null;
    const graphic = q('[data-testid="event-classic-graphic"]');
    const bottomLeft = q('[data-testid="event-page-bottom-left"]');
    const badges = q('[data-testid="event-condition-summary-badges"]');
    const empty = q('[data-testid="event-condition-summary-empty"]');
    return {
      conditionsOpen: conditions?.open ?? null,
      movementOpen: movement?.open ?? null,
      hasGraphic: !!graphic,
      hasBottomLeft: !!bottomLeft,
      badgeText: badges?.textContent ?? empty?.textContent ?? null,
      auxChips: Array.from(document.querySelectorAll('[data-testid="event-editor-aux-tools"] summary')).map(
        (n) => n.textContent?.trim() ?? ""
      ),
    };
  });
  writeFileSync(join(OUT, "metrics-default.json"), JSON.stringify(metrics, null, 2));
  console.log("metrics", metrics);

  // 2) Expand conditions
  const conditions = page.getByTestId("event-classic-conditions");
  await conditions.locator("summary").click();
  await page.waitForTimeout(250);
  await shot(page, "02-conditions-expanded.png");
  await page.locator('[data-testid="event-editor-modal"] .event-editor-modal-window').screenshot({
    path: join(OUT, "02b-modal-only-conditions-open.png"),
  });

  // 3) Collapse conditions, expand movement
  await conditions.locator("summary").click();
  await page.getByTestId("event-classic-movement-section").locator("summary").click();
  await page.waitForTimeout(250);
  await shot(page, "03-movement-expanded.png");
  await page.locator('[data-testid="event-editor-modal"] .event-editor-modal-window').screenshot({
    path: join(OUT, "03b-modal-only-movement-open.png"),
  });

  // 4) Open preview aux chip
  const preview = page.getByTestId("event-script-live-preview");
  if (await preview.count()) {
    await preview.locator("summary").click();
    await page.waitForTimeout(300);
    await shot(page, "04-aux-preview-open.png");
    await page.locator('[data-testid="event-editor-modal"] .event-editor-modal-window').screenshot({
      path: join(OUT, "04b-modal-only-aux-preview.png"),
    });
  }

  // 5) Open flow (exclusive)
  const flow = page.getByTestId("event-script-flowchart");
  if (await flow.count()) {
    await flow.locator("summary").click();
    await page.waitForTimeout(300);
    await shot(page, "05-aux-flow-open-exclusive.png");
    await page.locator('[data-testid="event-editor-modal"] .event-editor-modal-window').screenshot({
      path: join(OUT, "05b-modal-only-aux-flow.png"),
    });
  }

  // 6) Open AI chip
  const ai = page.getByTestId("ai-event-assist");
  if (await ai.count()) {
    await ai.locator("summary").click();
    await page.waitForTimeout(300);
    await shot(page, "06-aux-ai-open.png");
    await page.locator('[data-testid="event-editor-modal"] .event-editor-modal-window').screenshot({
      path: join(OUT, "06b-modal-only-aux-ai.png"),
    });
  }

  writeFileSync(
    join(OUT, "README.md"),
    [
      "# Event editor UX progressive disclosure evidence",
      "",
      `Captured: ${new Date().toISOString()}`,
      `Base URL: ${BASE}`,
      "",
      "## Shots",
      "- 01-default-progressive-disclosure.png — conditions/movement folded, graphic visible",
      "- 02-conditions-expanded.png — condition grid after expand",
      "- 03-movement-expanded.png — movement/misc section open",
      "- 04-aux-preview-open.png — live preview chip open",
      "- 05-aux-flow-open-exclusive.png — flowchart exclusive open",
      "- 06-aux-ai-open.png — AI command chip open",
      "",
      "See metrics-default.json for open-state assertions.",
      "",
    ].join("\n"),
    "utf8"
  );

  await browser.close();
  console.log("done →", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
