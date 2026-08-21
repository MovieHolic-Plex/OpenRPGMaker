import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { openDatabase, switchDatabaseTab, type DatabaseTabSpec } from "./rm2k3-database-helpers";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block" });

const ALL_TABS: readonly DatabaseTabSpec[] = [
  { label: "Overview", slug: "overview", testId: "db-tab-overview" },
  { label: "Actors", slug: "actors", testId: "db-tab-actors" },
  { label: "Classes", slug: "classes", testId: "db-tab-classes" },
  { label: "Skills", slug: "skills", testId: "db-tab-skills" },
  { label: "Items", slug: "items", testId: "db-tab-items" },
  { label: "Crops", slug: "crops", testId: "db-tab-crops" },
  { label: "Characters", slug: "characters", testId: "db-tab-characters" },
  { label: "Equipment", slug: "equipment", testId: "db-tab-equipment" },
  { label: "Enemies", slug: "enemies", testId: "db-tab-enemies" },
  { label: "Monster Species", slug: "monster-species", testId: "db-tab-monster-species" },
  { label: "Troops", slug: "troops", testId: "db-tab-troops" },
  { label: "Elements", slug: "elements", testId: "db-tab-elements" },
  { label: "States", slug: "states", testId: "db-tab-states" },
  { label: "Animations", slug: "animations", testId: "db-tab-animations" },
  { label: "Battle Screen", slug: "battle-screen", testId: "db-tab-battle-screen" },
  { label: "Battle Commands", slug: "battle-commands", testId: "db-tab-battle-commands" },
  { label: "Terrain", slug: "terrain", testId: "db-tab-terrain" },
  { label: "Tilesets", slug: "tilesets", testId: "db-tab-tilesets" },
  { label: "Structure Kits", slug: "structure-kits", testId: "db-tab-structure-kits" },
  { label: "Common Events", slug: "common-events", testId: "db-tab-common-events" },
  { label: "System", slug: "system", testId: "db-tab-system" },
  { label: "Terms", slug: "terms", testId: "db-tab-terms" },
  { label: "Switches", slug: "switches", testId: "db-tab-switches" },
  { label: "Variables", slug: "variables", testId: "db-tab-variables" },
];

type TabProbe = {
  slug: string;
  detailTextLen: number;
  enabledButtons: number;
  disabledButtons: number;
  inputs: number;
  selects: number;
  stubTexts: string[];
  empty: boolean;
};

async function probeTab(page: Page, tab: DatabaseTabSpec, outDir: string): Promise<TabProbe> {
  await switchDatabaseTab(page, tab);
  await page.waitForTimeout(300);
  const probe = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="database-modal"]');
    if (!modal) return null;
    const body = modal.querySelector(".db-body") ?? modal;
    const buttons = Array.from(body.querySelectorAll("button"));
    const stubTexts = Array.from(body.querySelectorAll("*"))
      .filter((node) => node.children.length === 0)
      .map((node) => node.textContent ?? "")
      .filter((text) => /준비 중|준비중|not implemented|coming soon/i.test(text));
    return {
      detailTextLen: (body.textContent ?? "").trim().length,
      enabledButtons: buttons.filter((b) => !b.disabled).length,
      disabledButtons: buttons.filter((b) => b.disabled).length,
      inputs: body.querySelectorAll("input, textarea").length,
      selects: body.querySelectorAll("select").length,
      stubTexts: [...new Set(stubTexts)],
      empty: (body.textContent ?? "").trim().length < 20,
    };
  });
  if (!probe) throw new Error("database modal missing");
  await page.getByTestId("database-modal").screenshot({ path: `${outDir}/tab-${tab.slug}.png` });
  return { slug: tab.slug, ...probe };
}

test("DB modal all-tabs sweep: render, no console errors, no stubs", async ({ page }, testInfo) => {
  const outDir = testInfo.outputPath("tabs");
  mkdirSync(outDir, { recursive: true });
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // freshProject는 원격 미설정이라 리소스/동기화 요청이 거절된다 — 환경 노이즈.
    if (/Failed to load resource|ERR_CONNECTION_REFUSED/i.test(text)) return;
    consoleErrors.push(`console: ${text}`);
  });

  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);

  const probes: TabProbe[] = [];
  for (const tab of ALL_TABS) {
    probes.push(await probeTab(page, tab, outDir));
  }
  writeFileSync(`${outDir}/probe.json`, JSON.stringify({ probes, consoleErrors }, null, 2));

  const emptyTabs = probes.filter((p) => p.empty).map((p) => p.slug);
  const stubTabs = probes.filter((p) => p.stubTexts.length > 0).map((p) => `${p.slug}: ${p.stubTexts.join(", ")}`);
  expect(emptyTabs, `tabs with empty body: ${emptyTabs.join(", ")}`).toEqual([]);
  expect(stubTabs, `tabs with stub texts: ${stubTabs.join("; ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join("\n")}`).toEqual([]);
});
