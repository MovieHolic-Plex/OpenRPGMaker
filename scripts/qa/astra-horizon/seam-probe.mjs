// 타일 줄 사이 실선(스크롤 이음매) 탐침 — 체크포인트에서 부팅해 카메라를 소수 위치로 옮겨 가며 게임 캔버스를 찍고,
// 위아래 줄과 동떨어진 가로줄(타일 경계에만 생기는 1px 선)을 센다.
//   node scripts/qa/astra-horizon/seam-probe.mjs <outDir> [checkpointId=first-town-grove] [mapId x y]
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer, runRuntimeQa } from "../../lib/runtimeQaRun.mjs";
import { loadCheckpointSet, selectCheckpoints, scenarioForCheckpoint, checkpointBootState } from "../../lib/runtimeQaCheckpoints.mjs";

const [outArg, cpArg = "first-town-grove", mapArg, xArg, yArg] = process.argv.slice(2);
if (!outArg) throw new Error("usage: seam-probe.mjs <outDir> [checkpointId]");
const out = resolve(outArg);
await mkdir(out, { recursive: true });
const set = await loadCheckpointSet("astra-horizon");
const [picked] = selectCheckpoints(set, cpArg);
const checkpoint = mapArg ? { ...picked, mapId: mapArg, x: Number(xArg), y: Number(yArg) } : picked;
const scenario = scenarioForCheckpoint({ id: "seam", beats: [] }, set, checkpoint);
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const results = [];
try {
  const page = await (await browser.newContext({ viewport: scenario.viewport })).newPage();
  await runRuntimeQa(page, scenario, { serverUrl: server.url, outDir: join(out, "boot"), checkpoint: checkpointBootState(checkpoint) });
  const base = await page.evaluate(() => {
    const cam = window.__oprnHooksScene.cameras.main;
    cam.stopFollow();
    return { x: Math.floor(cam.scrollX), y: Math.floor(cam.scrollY), zoom: cam.zoom, round: cam.roundPixels };
  });
  // 따라가기를 끊고 카메라 스크롤을 기준점에서 SEAM_STEPS(세계 픽셀, 소수 포함)만큼 옮긴다.
  for (const f of (process.env.SEAM_STEPS ?? "0,0.125,0.25,0.375,0.5,0.625,0.75,0.875").split(",").map(Number)) {
    await page.evaluate(([x, y]) => { const cam = window.__oprnHooksScene.cameras.main; cam.scrollX = x; cam.scrollY = y; }, [base.x + f, base.y + f]);
    await page.waitForTimeout(250);
    const seams = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const g = document.createElement("canvas"); g.width = c.width; g.height = c.height;
      const x = g.getContext("2d"); x.drawImage(c, 0, 0);
      const d = x.getImageData(0, 0, g.width, g.height).data, W = g.width, H = g.height;
      const px = (i) => [d[i], d[i + 1], d[i + 2]];
      const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      let rows = [];
      for (let y = 1; y < H - 1; y++) {
        let n = 0;
        for (let xx = 0; xx < W; xx++) {
          const i = (y * W + xx) * 4, up = px(i - W * 4), me = px(i), dn = px(i + W * 4);
          if (diff(up, dn) < 30 && diff(me, up) > 60 && diff(me, dn) > 60) n++;
        }
        if (n > W * 0.08) rows.push([y, n]);
      }
      let cols = [];
      for (let xx = 1; xx < W - 1; xx++) {
        let n = 0;
        for (let y = 0; y < H; y++) {
          const i = (y * W + xx) * 4, l = px(i - 4), me = px(i), r = px(i + 4);
          if (diff(l, r) < 30 && diff(me, l) > 60 && diff(me, r) > 60) n++;
        }
        if (n > H * 0.08) cols.push([xx, n]);
      }
      return { W, H, rows, cols };
    });
    await page.locator("canvas").first().screenshot({ path: join(out, `f${String(f).replace(".", "_")}.png`) });
    results.push({ f, seamRows: seams.rows.length, seamCols: seams.cols.length, rows: seams.rows.slice(0, 8), cols: seams.cols.slice(0, 8), size: [seams.W, seams.H] });
    console.log(JSON.stringify(results.at(-1)));
  }
  await writeFile(join(out, "seams.json"), JSON.stringify({ base, results }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
