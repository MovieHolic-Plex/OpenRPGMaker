// 진단용. 시작 맵의 이벤트 스프라이트가 런타임에서 실제로 놓인 좌표를 덤프한다.
// 시나리오를 새로 쓸 때 좌표 기대치를 실물에서 읽기 위한 도구다.
//
// 주의: 스프라이트 앵커가 타일 하단중앙이라 px=(tileX*16+8, (tileY+1)*16) 이다.
// 그리고 movement 가 fixed 가 아닌 NPC 는 **같은 세션 안에서도 움직인다** —
// 두 번 덤프하면 좌표가 다르다. 고정 좌표 인접을 전제하는 시나리오를 쓰지 마라.
//
// 사용: node scripts/_dump-event-tiles.mjs [픽스처경로]
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE = process.argv[2] ?? "test/fixtures/projects/editor-authored-demo-v3.json";
const projectJson = await readFile(join(REPO_ROOT, FIXTURE), "utf8");

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage();
await page.addInitScript(() => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "dump" };
});
await page.route("**/__runtime-qa/project.json", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
);
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 90_000 });
await page.keyboard.press("Enter");
await page.waitForFunction(() => window.__oprnDebug != null, undefined, { timeout: 90_000 });
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const sprites = window.__oprnCharacterSprites?.() ?? null;
  const state = window.__oprnDebug.readState();
  return {
    map: state.currentMapId,
    player: { x: state.x, y: state.y },
    events: Object.entries(sprites?.events ?? {}).map(([id, s]) => ({ id, px: s.x, py: s.y })),
  };
});

console.log(`map=${dump.map} player=(${dump.player.x},${dump.player.y})`);
console.log("이벤트 스프라이트 픽셀 좌표(타일 크기로 나눠야 타일 좌표):");
for (const e of dump.events) console.log(`  ${e.id.padEnd(24)} px=(${e.px},${e.py})  tile≈(${Math.floor(e.px / 16)},${Math.floor(e.py / 16)}) 또는 (${Math.floor(e.px / 32)},${Math.floor(e.py / 32)})`);

await browser.close();
await server.close();
