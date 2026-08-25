/**
 * Browser gate for the exact five official Phase 4 pack cards.
 * Screenshot quantity is diagnostic only; pack identity and an actual card click drive the verdict.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import {
  OFFICIAL_GENRE_PACK_IDS,
  verifyExactOfficialGenrePackIds,
  type OfficialGenrePackId,
} from "../src/project/officialGenrePackIds";

const BASE_URL = (process.env.BASE_URL ?? "http://127.0.0.1:9999").replace(/\/$/, "");
const APP_URL = `${BASE_URL}/?forceWelcome=1`;
const ROOT = join(process.cwd(), "output", "evidence", "genre-presets");

type PackResult = Readonly<{
  packId: OfficialGenrePackId;
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

async function inspectOfficialPackDom(page: Page): Promise<ReturnType<typeof verifyExactOfficialGenrePackIds>> {
  const observed = await page.locator("[data-pack-id]").evaluateAll((nodes) => nodes.map((node) => (
    (node as HTMLElement).dataset.packId ?? ""
  )));
  const setResult = verifyExactOfficialGenrePackIds(observed);
  if (!setResult.ok) return setResult;
  for (const packId of OFFICIAL_GENRE_PACK_IDS) {
    if (await page.locator(`[data-pack-id="${packId}"]`).count() !== 1) {
      return { ok: false, missing: [`selector:${packId}`], extra: [], duplicate: [] };
    }
  }
  return setResult;
}

async function runPack(page: Page, packId: OfficialGenrePackId): Promise<PackResult> {
  const folder = join(ROOT, packId);
  mkdirSync(folder, { recursive: true });
  const screenshots: string[] = [];
  try {
    await openWelcome(page);
    const dom = await inspectOfficialPackDom(page);
    if (!dom.ok) throw new Error(`official-pack-dom-mismatch:${JSON.stringify(dom)}`);
    const welcomeShot = join(folder, "01-welcome.png");
    await page.screenshot({ path: welcomeShot });
    screenshots.push(welcomeShot);

    await page.locator(`[data-pack-id="${packId}"]`).click();
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
    for (const packId of OFFICIAL_GENRE_PACK_IDS) packs.push(await runPack(page, packId));
  } finally {
    await browser.close();
  }

  const ok = packs.length === OFFICIAL_GENRE_PACK_IDS.length && packs.every((pack) => pack.selected);
  const manifest = {
    schemaVersion: 1,
    flow: "official-genre-packs",
    createdAt: new Date().toISOString(),
    officialPackIds: OFFICIAL_GENRE_PACK_IDS,
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
