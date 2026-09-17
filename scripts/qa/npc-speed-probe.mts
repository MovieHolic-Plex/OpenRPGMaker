// Run: ./node_modules/.bin/vite-node --script scripts/qa/npc-speed-probe.mts
// NPC 이동속도 수정 증거 probe — 명령 무버가 페이지 speed를 물려받는지 실측.
//
// 설계: 빈 프로젝트에 NPC 1명을 두고 playerTouch 페이지에 moveEvent 명령
// (오른쪽 4칸, 비반복, wait)을 건다. 주인공이 NPC 바로 아래칸에서 시작해
// 위로 한 걸음 부딪히면 NPC가 4칸 걷는다. NPC 페이지 speed 8(빠름,
// 80ms/칸 이동 + frequency 8 = 80ms 대기)이면 4칸에 프레임이 적게 들고,
// 수정 전 하드코딩 speed 3(400ms/칸 이동 + 560ms 대기)이면 5배 이상 든다.
//
// 측정: wall-clock이 아니라 결정적 프레임 스테핑(__oprnQaFrames)으로 잰다.
// 프레임을 멈춘 뒤 50ms씩 한 프레임씩 전진하며 NPC 스프라이트 좌표를 읽고,
// 걸음 시작 프레임부터 4칸(64px) 도착 프레임까지의 프레임 수를 셈한다.
// 프레임 수는 박스 부하와 무관하게 결정적이다:
// speed 8 → ≈14프레임, speed 3 → ≈80프레임. 상한 20프레임이면 둘을 가른다.
//
// 판정: 걸음 프레임 수 ≤ 20이면 PASS(페이지 속도대로 걷는다).
// 샷 + results.json + SUMMARY.md를 verify-shots/runtime-qa/npc-speed/에 남긴다.
import { mkdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createBlankProject } from "../../src/project/defaults";
import { DEFAULT_EASYRPG_CHARSET_ID } from "../../src/project/defaults/constants";
import { serialize } from "../../src/project/io";
import {
  startPlayerQaServer,
  pauseRuntimeFrames,
  performObservedFrames,
  resumeRuntimeFrames,
} from "../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/npc-speed");
const TARGET = "speed-npc";
// deltaMs 50ms/프레임: speed 8(80ms/칸)은 대기 2 + 이동 2 프레임/칸 → 4칸 ≈ 14프레임,
// speed 3(400ms/칸)은 대기 12 + 이동 8 프레임/칸 → 4칸 ≈ 80프레임. 상한 20이면 둘을 가른다.
const FRAME_MS = 50;
const EXPECTED_UPPER_FRAMES = 20;
const MAX_FRAMES = 200;
const moves = Array.from({ length: 4 }, () => ({ kind: "move", dir: "right" }));

const project = createBlankProject();
const map = project.maps[project.startMapId];
// 주인공 (2,5) — NPC (2,4) 바로 아래. 오른쪽 4칸 (3..6,4)은 빈 칸이어야 한다.
project.startPos = { x: 2, y: 5 };
map.events = [{
  id: TARGET,
  x: 2,
  y: 4,
  trigger: { kind: "playerTouch" },
  commands: [],
  pages: [{
    id: "p1",
    name: "속도 NPC",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "playerTouch" },
    priority: "same",
    // 핵심: 페이지 속도를 가장 빠르게. 명령 무버가 이 값을 물려받는지 본다.
    movement: { type: "fixed", speed: 8, frequency: 8 },
    commands: [{ kind: "moveEvent", eventId: "", route: { moves, repeat: false, wait: true } }],
  }],
}];

const dir = await mkdtemp(join(tmpdir(), "rpg-zzu-npc-speed-"));
const projectPath = join(dir, "project.json");
await writeFile(projectPath, serialize(project));
const projectJson = await readFile(projectPath, "utf8");

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const server = await startPlayerQaServer();
let page;
const results: {
  target: string;
  pageSpeed: number;
  frameMs: number;
  expectedUpperFrames: number;
  stepFrames: number | null;
  pass: boolean;
  errors: string[];
} = {
  target: TARGET,
  pageSpeed: 8,
  frameMs: FRAME_MS,
  expectedUpperFrames: EXPECTED_UPPER_FRAMES,
  stepFrames: null,
  pass: false,
  errors: [],
};
try {
  await mkdir(out, { recursive: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (err) => results.errors.push(`pageerror: ${err.message}`));
  await page.route("**/__runtime-qa/project.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* noop */ }
    (window as unknown as Record<string, unknown>).__OPENRPG_BOOT__ = {
      projectUrl: "/__runtime-qa/project.json",
      saveNamespace: "runtime-qa:npc-speed",
      qaInstrumentation: true,
    };
  });
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => (window as unknown as { __oprnDebug?: unknown; __oprnCharacterSprites?: unknown })
      .__oprnDebug
      && (window as unknown as { __oprnCharacterSprites?: unknown }).__oprnCharacterSprites,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/before.png` });

  // 프레임을 멈추고, 주인공 강제 이동으로 NPC에 부딪힌 뒤,
  // 한 프레임씩 전진하며 NPC 걸음 시작→4칸 도착 프레임 수를 셈한다.
  await pauseRuntimeFrames(page);
  const originX: number | null = await page.evaluate((target: string) => {
    const w = window as unknown as {
      __oprnDebug: { playerRoute: (moves: { kind: string; dir: string }[]) => void };
      __oprnCharacterSprites: () => { events: Record<string, { x: number; y: number } | undefined> };
    };
    w.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }]);
    return w.__oprnCharacterSprites().events[target]?.x ?? null;
  }, TARGET);
  if (originX === null) {
    results.errors.push("measure: no-sprite");
  } else {
    let startedAt: number | null = null;
    let doneAt: number | null = null;
    for (let frame = 1; frame <= MAX_FRAMES; frame += 1) {
      // eslint-disable-next-line no-await-in-loop
      await performObservedFrames(page, { frames: 1, deltaMs: FRAME_MS });
      // eslint-disable-next-line no-await-in-loop
      const x: number | null = await page.evaluate((target: string) => {
        const w = window as unknown as {
          __oprnCharacterSprites: () => { events: Record<string, { x: number; y: number } | undefined> };
        };
        return w.__oprnCharacterSprites().events[target]?.x ?? null;
      }, TARGET);
      if (x === null) { results.errors.push("measure: sprite-gone"); break; }
      if (startedAt === null && Math.abs(x - originX) > 0.5) startedAt = frame;
      if (startedAt !== null && x - originX >= 63) { doneAt = frame; break; }
    }
    if (startedAt === null) {
      results.errors.push("measure: no-step");
    } else if (doneAt === null) {
      results.errors.push(`measure: timeout after ${MAX_FRAMES} frames`);
    } else {
      results.stepFrames = doneAt - startedAt;
    }
  }
  await resumeRuntimeFrames(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/after.png` });
  results.pass = results.stepFrames !== null && results.stepFrames <= EXPECTED_UPPER_FRAMES;
} catch (err) {
  results.errors.push(String((err as Error)?.stack ?? err));
} finally {
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  await server.close?.().catch(() => {});
}
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
await writeFile(`${out}/SUMMARY.md`, [
  "# npc-speed probe (명령 무버 페이지 속도 계승)",
  "",
  `- 대상: ${results.target} (페이지 speed 8 = 80ms/칸, 4칸 ≈ 14프레임 @50ms)`,
  `- 실측 걸음: ${results.stepFrames === null ? "측정 실패" : `${results.stepFrames}프레임`} (상한 ${EXPECTED_UPPER_FRAMES}프레임)`,
  `- pass: ${results.pass ? "PASS — 페이지 속도대로 걷는다" : "FAIL — 페이지 속도와 다르게 걷는다"}`,
  "",
  "## 즉시 확인",
  "",
  "- before.png: 시작 배치",
  "- after.png: 이동 후 배치",
  ...(results.errors.length > 0 ? ["", "## 오류", "", ...results.errors.map((e) => `- ${e}`)] : []),
  "",
].join("\n"));
console.log(JSON.stringify({ pass: results.pass, stepFrames: results.stepFrames, errors: results.errors }, null, 2));
process.exit(results.pass ? 0 : 1);
