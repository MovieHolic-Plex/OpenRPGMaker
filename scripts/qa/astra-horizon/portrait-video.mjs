// 대화 흉상을 출하 플레이어(player.html, 480x320 = 1배)에서 영상으로 찍는다. 장면마다 시작·끝 시각을 적어 ffmpeg 로 자른다.
//   node scripts/qa/astra-horizon/portrait-video.mjs <project.json> <outDir>
// 결과: <outDir>/raw-*.webm(통 영상), <outDir>/scenes.json({file, scene, startMs, endMs}), 흉상이 처음 뜰 때마다 bust-*.png.
// 장면: 오프닝 뒤 집(엄마) → 연구소 박사 → 회복 센터 직원 / 체크포인트 route-1-meadow 에서 연구소 라이벌 나루(첫 대결 등장) / gym-leader(유림) / champion(챔피언 나루).
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const checkpoints = JSON.parse(await readFile(new URL("../runtime/checkpoints/astra-horizon.json", import.meta.url), "utf8")).checkpoints;
const out = resolve(outArg);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const scenes = [];
const VIEW = { width: 480, height: 320 };

async function session(name, checkpoint, body) {
  const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir: out, size: VIEW } });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.addInitScript((cp) => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:astra-portrait-video", qaInstrumentation: true, ...(cp ? { qaCheckpoint: cp } : {}) }; }, checkpoint);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
  const seen = new Set();
  const bustKey = () => page.evaluate(() => {
    const f = document.querySelector(".dialogue-face-bust");
    const m = f && /cast\/([a-z]+)\/bust-([a-z]+)/.exec(f.dataset.bustSrc || f.style.backgroundImage || "");
    return m ? `${m[1]}-${m[2]}` : null;
  });
  const h = {
    page, present,
    mark: (scene) => { const s = { session: name, scene, startMs: Date.now() - t0, endMs: null, busts: [] }; scenes.push(s); console.log("scene", name, scene, s.startMs); return s; },
    end: (s) => { s.endMs = Date.now() - t0; console.log("scene-end", s.scene, s.endMs, s.busts.join(",")); },
    async shotBust(s) {
      const k = await bustKey();
      if (!k) return;
      if (s && !s.busts.includes(k)) s.busts.push(k);
      if (seen.has(k)) return;
      seen.add(k); await page.waitForTimeout(400);
      await page.screenshot({ path: join(out, `bust-${name}-${k}.png`) });
    },
    async teleport(m, x, y) {
      await page.evaluate(([a, b, c]) => window.__oprnDebug.teleport(a, b, c), [m, x, y]);
      await page.waitForFunction(([a, b, c]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === a && s.x === b && s.y === c; }, [m, x, y], { timeout: 15000 });
      await page.waitForTimeout(600);
    },
    async talk(dir) { for (let i = 0; i < 5; i++) { await page.evaluate((d) => window.__oprnInput.face(d), dir); await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700); if (await present("dialogue-box") || await present("battle-scene")) return; } },
    // 대사는 사람이 읽는 속도로 넘긴다(한 줄 1.6초) — 영상에서 표정을 볼 수 있게.
    async advance(s, max = 60, until = async () => false) {
      for (let i = 0; i < max; i++) {
        await h.shotBust(s);
        if (await until()) return;
        if (!(await present("dialogue-box")) && !(await present("cinematic-sequence")) && !(await present("runtime-choices"))) { await page.waitForTimeout(600); if (!(await present("dialogue-box")) && !(await present("cinematic-sequence")) && !(await present("runtime-choices"))) return; }
        await page.waitForTimeout(await present("dialogue-box") ? 1600 : 400);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(250);
      }
    },
    battleCommand: () => page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 60000 }).then(() => true, () => false),
  };
  try {
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 360000 });
    if (checkpoint) await page.waitForFunction(() => window.__oprnDebug?.readLive?.()?.currentMapId, undefined, { timeout: 360000 });
    await body(h);
  } finally {
    const video = page.video();
    await context.close();
    const file = video ? await video.path() : null;
    for (const s of scenes) if (s.session === name) s.file = file;
  }
}

try {
  await session("story", null, async (h) => {
    const { page } = h;
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
    await page.waitForTimeout(1500);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
    await h.advance(null, 120); // 오프닝 연출
    const mom = h.mark("mom");
    await h.teleport("mx_map_home_house", 8, 7); await h.talk("up");
    await h.advance(mom, 40);
    await page.waitForTimeout(800); h.end(mom);
    const prof = h.mark("professor");
    await h.teleport("mx_map_lab", 7, 6); await h.talk("up");
    await h.advance(prof, 80, async () => (await page.evaluate(() => (window.__oprnHooksScene.session.monsterParty ?? []).length)) > 0 && !(await h.present("dialogue-box")) && !(await h.present("runtime-choices")));
    h.end(prof);
    const nurse = h.mark("nurse");
    await h.teleport("mx_map_home_center", 7, 5); await h.talk("up");
    await h.advance(nurse, 40);
    await page.waitForTimeout(800); h.end(nurse);
  });
  // 나루 첫 만남(연구소 대결)은 스타터를 받은 직후 상태(route-1-meadow 체크포인트)에서 연구소로 옮겨 건다 —
  // 이야기 흐름 그대로 이어 가면 박사 장면 뒤 나루가 자리를 옮겨 말이 걸리지 않을 때가 있었다.
  await session("naru-first", checkpoints.find((c) => c.id === "route-1-meadow"), async (h) => {
    await h.teleport("mx_map_lab", 12, 6); await h.page.waitForTimeout(600);
    const s = h.mark("naru-first");
    await h.talk("up");
    await h.advance(s, 60, () => h.present("battle-scene"));
    await h.battleCommand(); await h.page.waitForTimeout(1200); h.end(s);
  });
  for (const [cpId, scene] of [["gym-leader", "yurim"], ["champion", "naru-champion"]]) {
    const cp = checkpoints.find((c) => c.id === cpId);
    await session(cpId, cp, async (h) => {
      await h.page.waitForTimeout(1200);
      const s = h.mark(scene);
      await h.talk(cp.facing ?? "up");
      await h.advance(s, 60, () => h.present("battle-scene"));
      await h.battleCommand(); await h.page.waitForTimeout(1200); h.end(s);
    });
  }
} finally {
  await writeFile(join(out, "scenes.json"), JSON.stringify(scenes, null, 1));
  console.log(JSON.stringify(scenes, null, 1));
  await browser.close(); await server.close();
}
