// 보고서용 임시 캡처 스크립트. 복구 패널 자체를 화면으로 남긴다.
// 실행 후 삭제한다 (트리에 남기지 않는다).
import { chromium, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NAV_TIMEOUT_MS = 240_000;
const BOOT_TIMEOUT_MS = 240_000;
const SETTLE_TIMEOUT_MS = 120_000;

let port = "9871";
let outDir = "/tmp/report-shots";
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--port") port = argv[++i] ?? port;
  else if (argv[i] === "--out") outDir = argv[++i] ?? outDir;
}
const baseUrl = `http://127.0.0.1:${port}/`;

async function validProject(): Promise<Project> {
  const raw = await readFile(join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json"), "utf8");
  return deserialize(raw);
}

/** 차단 + 수리를 동시에: 시작 맵을 없애고(수리됨) 타일셋을 전부 비운다(차단됨). */
async function blockedWithRepairs(): Promise<Project> {
  const p = await validProject();
  p.startMapId = "map-does-not-exist";
  p.session = { ...p.session, partyActorIds: [] };
  (p as { tilesets: Record<string, unknown> }).tilesets = {};
  return p;
}

/** 맵이 아예 없는 프로젝트. 가장 단순한 차단. */
async function noMaps(): Promise<Project> {
  const p = await validProject();
  (p as { maps: Record<string, unknown> }).maps = {};
  return p;
}

async function capture(page: Page, name: string, project: Project) {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message ?? e)));
  await page.addInitScript((seed) => {
    (window as unknown as { __OPRN_E2E_PROJECT__?: unknown }).__OPRN_E2E_PROJECT__ = seed;
    const uiMode = window.localStorage.getItem("oprn:editor-ui-mode");
    window.localStorage.clear();
    if (uiMode !== null) window.localStorage.setItem("oprn:editor-ui-mode", uiMode);
  }, project as unknown);

  await page.goto(baseUrl, { waitUntil: "commit", timeout: NAV_TIMEOUT_MS });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: BOOT_TIMEOUT_MS });
  await page.getByTestId("mode-play").click();

  await page.waitForFunction(() => {
    if (document.querySelector("[data-testid='play-recovery-panel']")) return true;
    const reader = (window as unknown as { __oprnPlayBootLog?: () => readonly { stage: string; ok: boolean }[] }).__oprnPlayBootLog;
    const log = typeof reader === "function" ? reader() : [];
    return log.some((e) => e.stage === "ready" && e.ok);
  }, undefined, { timeout: SETTLE_TIMEOUT_MS }).catch(() => null);

  await mkdir(outDir, { recursive: true });
  const shot = join(outDir, `${name}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const panel = page.locator("[data-testid='play-recovery-panel']");
  const hasPanel = (await panel.count()) > 0;
  const reason = hasPanel ? ((await page.locator("[data-testid='play-recovery-reason']").first().textContent()) ?? "").trim() : "";
  const repairs = hasPanel
    ? await page.locator("[data-testid='play-recovery-repairs'] li").allTextContents()
    : [];
  const buttons = hasPanel
    ? await page.locator("[data-testid^='play-recovery-']").evaluateAll((els) =>
        els.filter((e) => e.tagName === "BUTTON").map((e) => ({ testid: (e as HTMLElement).dataset.testid ?? "", label: (e.textContent ?? "").trim() })))
    : [];
  // 패널만 따로도 남긴다 — 보고서에서 확대해 보여주기 좋다.
  if (hasPanel) await panel.screenshot({ path: join(outDir, `${name}-panel.png`) }).catch(() => {});

  return { name, shot, hasPanel, reason, repairs: repairs.map((t) => t.trim()), buttons, pageErrors };
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const out: unknown[] = [];
try {
  {
    const c = await browser.newContext();
    const p = await c.newPage();
    try {
      await p.goto(baseUrl, { waitUntil: "commit", timeout: NAV_TIMEOUT_MS });
      await p.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: BOOT_TIMEOUT_MS });
      process.stdout.write("WARMUP=ok\n");
    } catch (e) {
      process.stdout.write(`WARMUP=failed ${e instanceof Error ? e.message.slice(0, 160) : String(e)}\n`);
    } finally { await c.close(); }
  }
  for (const [name, project] of [
    ["recovery-blocked", await blockedWithRepairs()],
    ["recovery-no-maps", await noMaps()],
  ] as const) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await c.newPage();
    try { out.push(await capture(p, name, project)); }
    catch (e) { out.push({ name, error: e instanceof Error ? e.message : String(e) }); }
    finally { await c.close(); }
  }
} finally { await browser.close(); }

await writeFile(join(outDir, "capture.json"), JSON.stringify(out, null, 2), "utf8");
process.stdout.write(JSON.stringify(out, null, 2) + "\nCAPTURE_DONE\n");
