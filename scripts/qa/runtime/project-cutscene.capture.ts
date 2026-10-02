// 임의 프로젝트의 자동 컷신을 출하 플레이어(player.html)에서 돌리며 일정 간격으로 찍는다 — 조수가 만든 컷신을
// 사람이 보듯 확인하는 용도. 대사는 일정 간격으로 Enter 를 눌러 넘긴다.
//
// 사용: npx tsx scripts/qa/runtime/project-cutscene.capture.ts --project qa-runs/<id>/project.json \
//         [--map <mapId> --x <n> --y <n>] [--seconds 20] [--every 300] [--advance 1100] --out /tmp/cutscene
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
// @ts-expect-error — mjs 도우미(타입 없음)
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectPath = resolve(arg("project") ?? "");
const outDir = resolve(arg("out") ?? "/tmp/cutscene");
const seconds = Number(arg("seconds") ?? 20);
const everyMs = Number(arg("every") ?? 300);
const advanceMs = Number(arg("advance") ?? 1100);

const project = JSON.parse(await readFile(projectPath, "utf8"));
if (arg("map")) {
  project.startMapId = arg("map");
  project.startPos = { x: Number(arg("x") ?? 0), y: Number(arg("y") ?? 0) };
}
const projectJson = JSON.stringify(project);

await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const errors: string[] = [];
const frames: { file: string; atMs: number; state: unknown }[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console.error: ${message.text()}`); });
  await page.addInitScript(([projectUrl]) => {
    try { localStorage.clear(); } catch { /* 그대로 */ }
    (window as unknown as { __OPENRPG_BOOT__: unknown }).__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "project-cutscene", qaInstrumentation: true };
  }, [PROJECT_URL]);
  await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  // 오프닝이 있으면 넘긴다 — 맵이 뜰 때까지 Enter.
  for (let tries = 0; tries < 60; tries += 1) {
    const onMap = await page.evaluate("Boolean(window.__oprnDebug?.readState?.()?.currentMapId)");
    if (onMap) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  const started = Date.now();
  let lastAdvance = started;
  let index = 0;
  while (Date.now() - started < seconds * 1000) {
    const file = `f${String(index).padStart(3, "0")}.png`;
    await page.screenshot({ path: join(outDir, file) });
    // tsx 가 함수에 __name 을 끼워 넣으므로 문자열 식으로 읽는다.
    const state = await page.evaluate(`(() => {
      const s = window.__oprnHooksScene?.session?.m2Runtime?.screen ?? {};
      return { letterbox: s.letterbox ?? 0, looks: Object.keys(s.spriteLooks ?? {}), distortion: s.distortion ?? null, tint: s.tint ?? null, weather: s.weather ?? null,
        emitters: (window.__oprnHooksScene?.children?.list ?? []).filter((o) => o.type === "ParticleEmitter").length,
        text: document.querySelector(".dialogue-overlay")?.textContent?.slice(0, 60) ?? "" };
    })()`);
    frames.push({ file, atMs: Date.now() - started, state });
    index += 1;
    if (Date.now() - lastAdvance >= advanceMs) {
      await page.keyboard.press("Enter");
      lastAdvance = Date.now();
    }
    await page.waitForTimeout(everyMs);
  }
  await writeFile(join(outDir, "frames.json"), JSON.stringify({ frames, errors }, null, 1));
  console.log(JSON.stringify({ outDir, frames: frames.length, errors }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
