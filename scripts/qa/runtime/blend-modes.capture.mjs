// 겹치기(블렌드) 캡처 — 출하 플레이어(player.html)에서 이벤트 그림과 그림 표시의 겹치기를 실제로 그린다.
//
// 시작 맵 플레이어 위 줄에 같은 NPC 그림 넷(보통·더하기·스크린·곱하기)을 세우고, 화면 위쪽에
// 같은 얼굴 그림 넷을 같은 순서의 겹치기로 띄운다. 「겹치기 없음」 판(전부 보통)과 나란히 찍어
// 차이가 겹치기에서만 오는지 본다. 캡처 뒤 스프라이트 blendMode 값과 DOM 층 mix-blend-mode 를 같이 남긴다.
//
// 사용: node scripts/qa/runtime/blend-modes.capture.mjs --out /tmp/blend-modes
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";
const MODES = ["normal", "add", "screen", "multiply"];
const PICTURE_X = (index) => 24 + index * 74;
/** 2배 그림(3칸 폭)이 서로 겹치지 않게 3칸 간격. */
const SPRITE_X = (startX, index) => startX - 5 + index * 3;

function page(id, graphic, commands = [], trigger = { kind: "action" }) {
  return {
    id: `${id}-page`, name: id, conditions: [], trigger, graphic,
    movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "same", overlapForbidden: false, commands,
  };
}

async function buildProject(withBlend) {
  const project = JSON.parse(await readFile(SOURCE, "utf8"));
  const map = project.maps[project.startMapId];
  const { x, y } = project.startPos;
  const sprites = MODES.map((mode, index) => ({
    id: `ev_blend_${mode}`, name: `겹치기 ${mode}`, x: SPRITE_X(x, index), y: y - 2, trigger: { kind: "action" }, commands: [],
    pages: [page(`ev_blend_${mode}`, {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people2" }, direction: "down", pattern: 73, scale: 2, scaleMode: "manual",
      ...(withBlend && mode !== "normal" ? { blendMode: mode } : {}),
    })],
  }));
  const pictures = MODES.map((mode, index) => ({
    kind: "showPicture", pictureId: `pic${index + 1}`, resourceId: "easyrpg-faceset-actor1-07",
    x: PICTURE_X(index), y: 164, scale: 100, opacity: 255, rotation: 0,
    ...(withBlend && mode !== "normal" ? { blendMode: mode } : {}),
  }));
  const director = {
    id: "ev_blend_director", name: "겹치기 데모", x, y, trigger: { kind: "parallel" }, commands: [],
    pages: [page("ev_blend_director", { transparent: true }, [...pictures, { kind: "wait", ms: 600_000 }], { kind: "parallel" })],
  };
  map.events = [...map.events.filter((event) => !(event.x >= x - 6 && event.x <= x + 5 && event.y === y - 2)), ...sprites, director];
  return JSON.stringify(project);
}

const outArg = process.argv.indexOf("--out");
const outDir = resolve(outArg >= 0 ? process.argv[outArg + 1] : "/tmp/blend-modes");
await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const report = { runs: [], errors: [] };
try {
  for (const withBlend of [false, true]) {
    const id = withBlend ? "blend" : "plain";
    const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const tab = await context.newPage();
    tab.on("pageerror", (error) => report.errors.push(`${id}: ${String(error?.message ?? error)}`));
    tab.on("console", (message) => { if (message.type() === "error") report.errors.push(`${id} console.error: ${message.text()}`); });
    const projectJson = await buildProject(withBlend);
    await tab.addInitScript(([projectUrl, namespace]) => {
      try { localStorage.clear(); } catch { /* 그대로 */ }
      window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: namespace, qaInstrumentation: true };
    }, [PROJECT_URL, `blend-modes-${id}`]);
    await tab.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
    await tab.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await tab.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
    await tab.keyboard.press("Enter");
    await tab.waitForFunction(() => Boolean(window.__oprnDebug?.readState?.()?.currentMapId), null, { timeout: 120_000 });
    await tab.waitForFunction(() => document.querySelectorAll("[data-testid^='picture-pic'] img").length >= 4, null, { timeout: 30_000 });
    await tab.waitForTimeout(800);
    const file = `${id}.png`;
    await tab.screenshot({ path: join(outDir, file) });
    const shown = await tab.evaluate(() => {
      const scene = window.__oprnHooksScene;
      const sprites = scene.children.list
        .filter((child) => typeof child.blendMode === "number" && child.texture?.key?.includes("people2") && child.scaleX >= 1.5)
        .map((child) => ({ x: Math.round(child.x), blendMode: child.blendMode }))
        .sort((a, b) => a.x - b.x);
      const layers = [...document.querySelectorAll(".picture-layer")].map((layer) => ({
        testid: layer.dataset.testid,
        mixBlendMode: getComputedStyle(layer).mixBlendMode,
        pictures: [...layer.querySelectorAll("[data-picture-id]")].map((item) => item.dataset.pictureId),
      }));
      return { renderer: scene.renderer?.type, sprites, layers };
    });
    report.runs.push({ id, file, shown });
    await context.close();
  }
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
} finally {
  await browser.close();
  await server.close();
}
