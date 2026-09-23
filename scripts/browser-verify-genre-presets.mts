/**
 * Browser gate for the three genres offered when a project starts:
 * monster collection, recollection story, and adventure JRPG.
 * Screenshot quantity is diagnostic only; pack identity and an actual card click drive the verdict.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { newProjectChoiceById, NEW_PROJECT_DIALOG_CHOICE_ORDER } from "../src/editor/newProjectChoices";
import type { GenrePackId } from "../src/project/genrePackId";

const BASE_URL = (process.env.BASE_URL ?? "http://127.0.0.1:9999").replace(/\/$/, "");
const APP_URL = `${BASE_URL}/?forceWelcome=1`;
const ROOT = join(process.cwd(), "output", "evidence", "genre-presets");

const START_PACK_IDS: readonly GenrePackId[] = NEW_PROJECT_DIALOG_CHOICE_ORDER.map((id) => {
  const choice = newProjectChoiceById(id);
  if (!choice) throw new Error(`missing start choice: ${id}`);
  return choice.packId;
});

type PackResult = Readonly<{
  packId: GenrePackId;
  selected: boolean;
  screenshots: readonly string[];
  error?: string;
}>;

async function openWelcome(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => localStorage.removeItem("oprn:editor-welcome-dismissed"));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByTestId("editor-welcome").waitFor({ state: "visible", timeout: 45_000 });
}

async function inspectStartPackDom(page: Page): Promise<{ ok: true } | { ok: false; observed: readonly string[] }> {
  const observed = await page.locator("[data-pack-id]").evaluateAll((nodes) => nodes.map((node) => (
    (node as HTMLElement).dataset.packId ?? ""
  )));
  const ok = observed.length === START_PACK_IDS.length
    && START_PACK_IDS.every((packId, index) => observed[index] === packId);
  return ok ? { ok: true } : { ok: false, observed };
}

async function runPack(page: Page, packId: GenrePackId): Promise<PackResult> {
  const folder = join(ROOT, packId);
  mkdirSync(folder, { recursive: true });
  const screenshots: string[] = [];
  try {
    await openWelcome(page);
    const dom = await inspectStartPackDom(page);
    if (!dom.ok) throw new Error(`start-pack-dom-mismatch:${JSON.stringify(dom)}`);
    const welcomeShot = join(folder, "01-welcome.png");
    await page.screenshot({ path: welcomeShot });
    screenshots.push(welcomeShot);

    const packCard = page.locator(`[data-pack-id="${packId}"]`);
    await packCard.waitFor({ state: "visible", timeout: 5_000 });
    await packCard.click();
    await page.getByTestId("editor-welcome").waitFor({ state: "detached", timeout: 20_000 });
    const selectedShot = join(folder, "02-selected.png");
    await page.screenshot({ path: selectedShot });
    screenshots.push(selectedShot);
    return { packId, selected: true, screenshots };
  } catch (cause) {
    return {
      packId,
      selected: false,
      screenshots,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

async function main(): Promise<void> {
  mkdirSync(ROOT, { recursive: true });
  const health = await fetch(BASE_URL).then((response) => response.status).catch(() => 0);
  if (health !== 200) throw new Error(`dev-server-unreachable:${BASE_URL}:${health}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const packs: PackResult[] = [];
  try {
    for (const packId of START_PACK_IDS) packs.push(await runPack(page, packId));
  } finally {
    await browser.close();
  }

  const ok = packs.length === START_PACK_IDS.length && packs.every((pack) => pack.selected);
  const manifest = {
    schemaVersion: 1,
    flow: "start-genre-packs",
    createdAt: new Date().toISOString(),
    officialPackIds: START_PACK_IDS,
    ok,
    packs,
  };
  writeFileSync(join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
  if (!ok) process.exit(1);
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exit(2);
});
