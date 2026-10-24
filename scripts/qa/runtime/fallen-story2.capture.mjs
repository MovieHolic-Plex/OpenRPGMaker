// 폴른 스타 1막 대사·연출 확인(2026-10-24 story2) — 체크포인트에서 바로 부팅해 1배 영상을 남긴다. (진단 전용 · 게이트 아님)
//   (J) 관 앞: 세 단계 퍼즐 → 이리스 깨어남 → 「데려가 달라」 선택 → 합류  (JOIN_PICK=0 같이 가자 · 1 여기 숨어 있어)
//   (V) 지하 결전: 발렌 앞 대사 → 전투(파티 Lv 60, 공격만) → F6 · 연막 퇴장 → 렌즈 신호
//   node scripts/qa/runtime/fallen-story2.capture.mjs <play.json> <outDir> [J|V]
// 결과: <outDir>/<장면>/video.webm, offsets.json(구간 ms), frames/*.png
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, onlyArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: fallen-story2.capture.mjs <play.json> <outDir> [J|V]");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/fallen-story2");
const projectJson = await readFile(resolve(projectArg), "utf8");
const outRoot = resolve(outArg ?? "tmp/fs-story2");
const READ_MS = Number(process.env.READ_MS ?? 1700);
const JOIN_PICK = Number(process.env.JOIN_PICK ?? 1);

const party = (lv) => [{ actorId: "actor_hero", level: lv }, { actorId: "actor_fs_elena", level: lv }, { actorId: "actor_fs_iris", level: lv }];
const CHECKPOINTS = {
  J: {
    id: "story2-pod", mapId: "fs_forest", x: 15, y: 8, facing: "up",
    switches: { sw_fs_main_started: true, sw_fs_main_step0: true, sw_fs_valen_marched: true },
    party: party(6).slice(0, 2), items: { item_potion: 3 },
  },
  V: {
    id: "story2-boss", mapId: "fs_vault", x: 15, y: 9, facing: "up",
    switches: { sw_fs_main_started: true, sw_fs_main_step0: true, sw_fs_valen_marched: true, sw_fs_main_step1: true, sw_fs_iris_awake: true, sw_fs_iris_joined: true, sw_fs_valen_arrived: true },
    variables: { var_fs_main_progress: 2 }, party: party(60), items: { item_potion: 3, item_fs_star_key: 1 },
  },
};

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const summary = {};
try {
  for (const key of onlyArg ? [onlyArg] : ["J", "V"]) {
    const out = join(outRoot, key);
    await mkdir(join(out, "frames"), { recursive: true });
    const report = { errors: [], segments: [], lines: [] };
    const context = await browser.newContext({ viewport: { width: 480, height: 270 }, recordVideo: { dir: join(out, "raw"), size: { width: 480, height: 270 } } });
    const t0 = Date.now();
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
    const checkpoint = CHECKPOINTS[key];
    await page.addInitScript(([cp]) => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fallen-story2", qaInstrumentation: true, qaCheckpoint: cp }; }, [checkpoint]);
    await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
    const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
    const text = () => page.evaluate(() => document.querySelector('[data-testid="dialogue-box"]')?.textContent?.replace(/\s+/g, " ").trim() ?? "");
    let n = 0;
    const shot = (tag) => page.screenshot({ path: join(out, "frames", `${String(n++).padStart(3, "0")}-${tag}.png`) });
    const mark = (name) => report.segments.push({ name, atMs: Date.now() - t0 });
    // 대사·선택을 읽는 속도로 넘긴다. picks = 선택지마다 아래로 몇 칸.
    const read = async ({ picks = [], maxRounds = 200, quietNeeded = 5, until } = {}) => {
      let quiet = 0, pickAt = 0;
      for (let i = 0; i < maxRounds && quiet < quietNeeded; i++) {
        if (until && (await until())) return;
        if (await present("runtime-choices")) {
          quiet = 0; const k = picks[pickAt++] ?? 0;
          await page.waitForTimeout(900);
          await shot("choice");
          for (let j = 0; j < k; j++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(300); }
          await page.waitForTimeout(400);
          await page.keyboard.press("Enter");
        } else if (await present("dialogue-box")) {
          quiet = 0;
          const t = await text();
          if (t && report.lines.at(-1) !== t) { report.lines.push(t); await page.waitForTimeout(READ_MS); await shot("line"); }
          await page.keyboard.press("Enter");
        } else quiet++;
        await page.waitForTimeout(350);
      }
    };
    try {
      await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
      await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 420000 });
      await page.waitForTimeout(2500);
      await shot("arrive");
      if (key === "J") {
        mark("pod-start");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(800);
        // 퍼즐: 해(1) · 맨손(2) · 「괜찮아」(1) → 합류 선택
        await read({ picks: [1, 2, 1, JOIN_PICK], quietNeeded: 6 });
        mark("pod-end");
        await page.waitForTimeout(1500);
        await shot("after");
        report.state = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return { party: s.partyActorIds, joined: s.switches?.sw_fs_iris_joined, key: s.inventory?.item_fs_star_key }; });
      } else {
        mark("intro-start");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(800);
        await read({ until: () => present("battle-scene") });
        mark("battle-start");
        // 전투 — Lv 60 이 공격만 고른다. 끝나면 결전 뒤 대사가 이어진다.
        for (let i = 0; i < 160 && !(await present("dialogue-box")); i++) {
          if (await present("battle-scene")) await page.keyboard.press("Enter");
          await page.waitForTimeout(450);
        }
        mark("victory-start");
        await read({ quietNeeded: 14 });
        mark("victory-end");
        await page.waitForTimeout(1500);
        await shot("after");
        report.state = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return { step2: s.switches?.sw_fs_main_step2, map: s.currentMapId }; });
      }
    } catch (e) {
      report.errors.push(String(e?.stack ?? e).slice(0, 400));
      await shot("error").catch(() => {});
    } finally {
      const video = page.video();
      await context.close();
      const p = await video?.path();
      if (p) await rename(p, join(out, "video.webm"));
      await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
      summary[key] = { errors: report.errors.slice(0, 3), segments: report.segments, lines: report.lines.length, state: report.state };
    }
  }
} finally {
  console.log(JSON.stringify(summary, null, 1));
  await browser.close();
  await server.close();
}
