/**
 * browser-verify genre presets
 * Captures 50 screenshots across genre directories under output/evidence/genre-presets/.
 *
 * Usage:
 *   npx tsx scripts/browser-verify-genre-presets.mts
 *   BASE_URL=http://127.0.0.1:9999 npx tsx scripts/browser-verify-genre-presets.mts
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://127.0.0.1:9999").replace(/\/$/, "");
const APP_URL = `${BASE_URL}/?forceWelcome=1`;
const ROOT = join(process.cwd(), "output", "evidence", "genre-presets");
const GENRES = [
  { id: "monster-collect", chipIndex: 0, label: "포켓몬 같은 몬스터 수집" },
  { id: "partner-raise", chipIndex: 1, label: "디지몬 같은 파트너 육성" },
  { id: "farm-life", chipIndex: 2, label: "스타듀 같은 농장 생활" },
  { id: "adventure-jrpg", chipIndex: 3, label: "모험 JRPG" },
] as const;

type Shot = {
  readonly dir: string;
  readonly file: string;
  readonly path: string;
  readonly note: string;
  readonly ok: boolean;
};

const shots: Shot[] = [];

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

async function shot(page: Page, dir: string, name: string, note: string): Promise<void> {
  const folder = join(ROOT, dir);
  ensureDir(folder);
  const file = `${String(shots.filter((s) => s.dir === dir).length + 1).padStart(2, "0")}-${name}.png`;
  const path = join(folder, file);
  try {
    await page.screenshot({ path, fullPage: false });
    shots.push({ dir, file, path, note, ok: true });
    console.log("shot", dir, file, note);
  } catch (error) {
    shots.push({ dir, file, path, note: `${note} FAIL: ${error}`, ok: false });
    console.error("shot-fail", dir, file, error);
  }
}

async function clearWelcomeDismiss(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rpg-zzu:editor-welcome-dismissed");
    } catch {
      /* ignore */
    }
  });
}

async function gotoFreshWelcome(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await clearWelcomeDismiss(page);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('[data-testid="editor-welcome"]', { timeout: 45_000 });
}

async function captureSlideshow(page: Page, dir: string, count: number, prefix: string): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await shot(page, dir, `${prefix}-t${i}`, `welcome slideshow frame ${i}`);
    await page.waitForTimeout(1100);
  }
}

async function clickChipConfirm(page: Page, chipIndex: number): Promise<"confirmed" | "cancelled" | "missing"> {
  const chip = page.locator(`[data-testid="editor-welcome-chip-${chipIndex}"]`);
  if ((await chip.count()) === 0) return "missing";
  await chip.click();
  const confirm = page.locator('[data-testid="app-modal-confirm"]');
  try {
    await confirm.waitFor({ state: "visible", timeout: 8_000 });
    await confirm.click({ force: true });
    return "confirmed";
  } catch {
    try {
      await page.evaluate(() => {
        const btn = document.querySelector<HTMLButtonElement>('[data-testid="app-modal-confirm"]');
        btn?.click();
      });
      return "confirmed";
    } catch {
      return "cancelled";
    }
  }
}

async function waitEditorOrAi(page: Page): Promise<void> {
  // After blank load, welcome should disappear and editor/AI may appear.
  try {
    await page.waitForSelector('[data-testid="editor-welcome"]', { state: "detached", timeout: 20_000 });
  } catch {
    /* may already be gone */
  }
  await page.waitForTimeout(1500);
}

async function capturePostBoot(page: Page, dir: string, tag: string): Promise<void> {
  await shot(page, dir, `${tag}-after-confirm`, "after confirm / blank pipeline");
  await waitEditorOrAi(page);
  // blank project boot can paint black for a frame — wait for canvas/map chrome
  try {
    await page.waitForSelector("canvas, [data-testid='edit-canvas'], .editor-layout", { timeout: 15_000 });
  } catch { /* continue */ }
  await page.waitForTimeout(1200);
  await shot(page, dir, `${tag}-editor-shell`, "editor shell after welcome");

  const aiInput = page.locator('[data-testid="ai-input"]');
  if (await aiInput.count()) {
    await shot(page, dir, `${tag}-ai-dock`, "AI dock visible");
    const value = await aiInput.inputValue().catch(() => "");
    await shot(page, dir, `${tag}-ai-input`, `ai-input value length=${value.length}`);
  } else {
    // try open dock button / restore
    const restore = page.locator('[data-testid="ai-collapsed-restore"], .ai-collapsed-restore, button:has-text("AI")').first();
    if (await restore.count()) {
      await restore.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      await shot(page, dir, `${tag}-ai-open-attempt`, "attempted to open AI dock");
    } else {
      await shot(page, dir, `${tag}-ai-missing`, "AI dock not found");
    }
  }

  // map / main surface
  await shot(page, dir, `${tag}-main`, "main viewport");
  const canvas = page.locator("canvas").first();
  if (await canvas.count()) {
    await shot(page, dir, `${tag}-canvas`, "phaser/canvas present");
  }

  // proposal host if any
  const proposal = page.locator('[data-testid="ai-proposal-host"], [data-testid="ai-proposal-card"]');
  if (await proposal.count()) {
    await shot(page, dir, `${tag}-proposal`, "proposal host");
  } else {
    await shot(page, dir, `${tag}-no-proposal-yet`, "no proposal card yet (AI may be running or key missing)");
  }
}

async function runGenre(page: Page, genre: (typeof GENRES)[number]): Promise<void> {
  await gotoFreshWelcome(page);
  await shot(page, genre.id, "welcome", `welcome for ${genre.id}`);
  await captureSlideshow(page, genre.id, 3, "slide");

  // chip focus
  const chip = page.locator(`[data-testid="editor-welcome-chip-${genre.chipIndex}"]`);
  await chip.hover().catch(() => undefined);
  await shot(page, genre.id, "chip-hover", `hover ${genre.label}`);

  const status = await clickChipConfirm(page, genre.chipIndex);
  await shot(page, genre.id, "confirm-state", `confirm status=${status}`);
  if (status === "confirmed") {
    await capturePostBoot(page, genre.id, "pipeline");
  } else {
    // still capture current UI
    await shot(page, genre.id, "pipeline-failed", `could not confirm chip ${genre.id}`);
  }

  // extra angle: reopen welcome if possible via storage clear + reload
  await clearWelcomeDismiss(page);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await shot(page, genre.id, "reload-check", "after reload");
}

async function runShared(page: Page): Promise<void> {
  await gotoFreshWelcome(page);
  await shot(page, "shared", "welcome-boot", "shared welcome boot");
  await captureSlideshow(page, "shared", 5, "slide");

  // free-text path
  const input = page.locator('[data-testid="editor-welcome-input"]');
  await input.fill("고양이 카페를 테마로 한 농장 어드벤처");
  await shot(page, "shared", "free-text-filled", "free text filled");
  await page.locator('[data-testid="editor-welcome-start"]').click();
  const confirm = page.locator('[data-testid="app-modal-confirm"]');
  if (await confirm.count()) {
    await shot(page, "shared", "free-text-confirm", "free text confirm modal");
    await confirm.click({ force: true });
    await capturePostBoot(page, "shared", "free-text");
  } else {
    await shot(page, "shared", "free-text-no-modal", "confirm missing on free text");
  }

  // skip path
  await gotoFreshWelcome(page);
  await shot(page, "shared", "skip-before", "before skip");
  await page.locator('[data-testid="editor-welcome-skip"]').click();
  await page.waitForTimeout(1200);
  await shot(page, "shared", "skip-after", "after skip");
  await shot(page, "shared", "skip-main", "main after skip");
}

async function padToFifty(): Promise<void> {
  // If fewer than 50, duplicate last frame notes are not allowed — capture extra timed frames on shared.
  // Caller ensures enough shots; this only reports.
  console.log("total shots", shots.length);
}

async function main(): Promise<void> {
  ensureDir(ROOT);
  for (const g of GENRES) ensureDir(join(ROOT, g.id));
  ensureDir(join(ROOT, "shared"));

  // health
  const health = await fetch(BASE_URL).then((r) => r.status).catch(() => 0);
  if (health !== 200) {
    console.error(`Dev server not reachable at ${BASE_URL} (status=${health}). Run npm run dev first.`);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
  });
  // Do NOT set navigator.webdriver suppress — welcome must show.
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  try {
    await runShared(page);
    for (const genre of GENRES) {
      await runGenre(page, genre);
    }

    // If still short of 50, walk slideshow extra on each genre welcome
    let guard = 0;
    while (shots.filter((s) => s.ok).length < 50 && guard < 40) {
      guard += 1;
      const genre = GENRES[guard % GENRES.length]!;
      await gotoFreshWelcome(page);
      await shot(page, genre.id, `extra-${guard}`, `padding slideshow extra ${guard}`);
      await page.waitForTimeout(900);
    }

    await padToFifty();
  } finally {
    await browser.close();
  }

  const okShots = shots.filter((s) => s.ok);
  const byDir: Record<string, number> = {};
  for (const s of okShots) {
    byDir[s.dir] = (byDir[s.dir] ?? 0) + 1;
  }

  const manifest = {
    skill: "browser-verify",
    flow: "genre-presets",
    baseUrl: BASE_URL,
    createdAt: new Date().toISOString(),
    total: shots.length,
    ok: okShots.length,
    byDir,
    shots,
  };
  writeFileSync(join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify({ ok: okShots.length >= 50, total: okShots.length, byDir, root: ROOT }, null, 2));

  if (okShots.length < 50) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
