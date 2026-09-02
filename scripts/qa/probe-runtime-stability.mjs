// 런타임 안정성 프로브 — 「될 때도 있고 안 될 때도 있는」 이동을 숫자로 잡는다.
//
//   node scripts/qa/probe-runtime-stability.mjs
//
// 출하 경로(player.html, 런타임 QA 서버)에서 세 가지를 잰다:
//   [tap]      방향키를 짧게 탭했을 때 실제로 걸음이 나가는가 — keyboard.press(즉시)·delay 30/120ms·
//              훅 dir(d)→dir(null) 네 방식 × 4회. 고치기 전 실측: 즉시 탭 1/4, 훅 0/4.
//   [talk]     NPC 와 대화 한 번에 타일 계층 재생성·카메라 startFollow(스크롤 스냅)가 몇 번 일어나는가.
//              고치기 전: 재생성 6회(오브젝트 10,944개)·스냅 6회. 고친 뒤: 0·0.
//   [parallel] 100ms 주기 병렬 공통 이벤트를 심은 픽스처에서 3초 정지·1.5초 걷기 동안의 같은 계수와,
//              걷는 동안 카메라 scrollY 의 프레임 델타(3.5px 초과 스파이크 = 스냅). 고치기 전: 정지 3초에
//              재생성 24회·스파이크 5/89(6~9px). 고친 뒤: 0회·0/89.
// 계수는 QA 계측 훅 `__oprnPerf()`(src/player/runtimePerfCounters.ts) 로 읽는다.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__probe/project.json";
const FIXTURE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");

function withParallel(projectJson) {
  const project = JSON.parse(projectJson);
  project.commonEvents = project.commonEvents ?? [];
  project.commonEvents.push({
    id: "probe_parallel",
    name: "probe ambient",
    trigger: "parallel",
    commands: [
      { kind: "setEventGraphicPattern", eventId: "ev_lantern_guard", pattern: 1 },
      { kind: "wait", ms: 100 },
    ],
  });
  return JSON.stringify(project);
}

async function boot(browser, serverUrl, projectJson, tag) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript(([projectUrl, ns]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true };
  }, [PROJECT_URL, `probe:${tag}`]);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${serverUrl}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug && window.__oprnDebug.readState().currentMapId, null, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  return page;
}

const readState = (page) => page.evaluate(() => window.__oprnDebug.readState());
const readPerf = (page) => page.evaluate(() => window.__oprnPerf());
const diff = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, b[k] - a[k]]));

async function resetTo(page, x, y) {
  await page.evaluate(([x, y]) => {
    window.__oprnDebug.teleport("map_lantern_village", x, y);
    window.__oprnInput.face("down");
  }, [x, y]);
  await page.waitForTimeout(300);
}

async function tapTest(page, label, tap) {
  await resetTo(page, 14, 18);
  const before = await readState(page);
  for (let i = 0; i < 4; i += 1) {
    await tap();
    await page.waitForTimeout(350);
  }
  const after = await readState(page);
  console.log(`[tap] ${label}: 4 taps → moved ${after.y - before.y} tiles (y ${before.y}→${after.y})`);
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
try {
  const fixture = await readFile(FIXTURE, "utf8");
  // ── 1. 기본 픽스처: 탭 소실 + 대화 한 번의 재생성 횟수
  const page = await boot(browser, server.url, fixture, "plain");
  await tapTest(page, "keyboard.press (down+up 즉시)", () => page.keyboard.press("ArrowDown"));
  await tapTest(page, "keyboard.press delay 30ms", () => page.keyboard.press("ArrowDown", { delay: 30 }));
  await tapTest(page, "keyboard.press delay 120ms", () => page.keyboard.press("ArrowDown", { delay: 120 }));
  await tapTest(page, "hook dir(down)→dir(null) 같은 태스크", () => page.evaluate(() => { window.__oprnInput.dir("down"); window.__oprnInput.dir(null); }));

  // 대화: NPC 는 배회하므로 런타임 상태에서 현재 좌표를 읽어 바로 아래 칸에서 위를 보고 조사한다.
  let perfBeforeTalk = null;
  for (const npcId of ["ev_lantern_elder", "ev_lantern_healer", "ev_lantern_scout", "ev_lantern_guard"]) {
    const pos = await page.evaluate((id) => {
      const text = document.querySelector("[data-testid='runtime-state-json']")?.textContent ?? "{}";
      const ev = JSON.parse(text).events?.[id];
      return ev ? { x: ev.x, y: ev.y } : null;
    }, npcId);
    if (!pos) continue;
    await resetTo(page, pos.x, pos.y + 1);
    await page.evaluate(() => window.__oprnInput.face("up"));
    await page.waitForTimeout(200);
    perfBeforeTalk = await readPerf(page);
    await page.evaluate(() => window.__oprnInput.action());
    const opened = await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 4000 }).then(() => true).catch(() => false);
    if (opened) { console.log(`[talk] ${npcId} 대화 열림 (${pos.x},${pos.y})`); break; }
    perfBeforeTalk = null;
  }
  if (!perfBeforeTalk) throw new Error("대화를 열 NPC 를 찾지 못했다");
  for (let i = 0; i < 12; i += 1) {
    const open = await page.evaluate(() => document.querySelector("[data-testid='dialogue-box']") !== null);
    if (!open) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);
  const perfAfterTalk = await readPerf(page);
  console.log("[talk] 장로 대화 1회 동안 계수 증가:", diff(perfBeforeTalk, perfAfterTalk));
  await page.close();

  // ── 2. 병렬 공통 이벤트(100ms 주기) 픽스처: 정지 3초 계수 + 걷는 동안 카메라 점프
  const page2 = await boot(browser, server.url, withParallel(fixture), "parallel");
  await resetTo(page2, 14, 18);
  const p0 = await readPerf(page2);
  await page2.waitForTimeout(3000);
  const p1 = await readPerf(page2);
  console.log("[parallel] 정지 3초 동안 계수 증가:", diff(p0, p1));
  const cam = await page2.evaluate(async () => {
    const samples = [];
    window.__oprnInput.dir("down");
    await new Promise((resolve) => {
      let frames = 0;
      const tick = () => {
        const c = window.__oprnCamera();
        samples.push(c.scrollY);
        frames += 1;
        if (frames < 90) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    window.__oprnInput.dir(null);
    const deltas = samples.slice(1).map((v, i) => v - samples[i]);
    const spikes = deltas.filter((d) => Math.abs(d) > 3.5);
    return { frames: samples.length, maxDelta: Math.max(...deltas.map(Math.abs)), spikes: spikes.length, deltas: deltas.map((d) => Number(d.toFixed(1))) };
  });
  console.log(`[parallel] 걷는 동안 카메라 scrollY 프레임 델타: max=${cam.maxDelta.toFixed(1)}px, 3.5px 초과 스파이크 ${cam.spikes}/${cam.frames - 1}`);
  console.log("[parallel] deltas:", cam.deltas.join(" "));
  const p2 = await readPerf(page2);
  console.log("[parallel] 걷기 1.5초 동안 계수 증가:", diff(p1, p2));
  await page2.close();
} finally {
  await browser.close();
  await server.close();
}
