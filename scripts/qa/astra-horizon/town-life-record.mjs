// 마을 생활(주민 걸음·새·따라오는 동료)을 프레임 단위로 찍는다 — 실시간 녹화는 부하에 따라 끊기므로
// 게임 루프를 QA 프레임 제어로 멈추고 한 프레임(33ms)씩 진행하며 캔버스를 뜬다. 결과는 1배 속도 mp4 와 프레임별 좌표 기록.
//   node scripts/qa/astra-horizon/town-life-record.mjs <outDir> [checkpointId=first-town-grove] [mapId x y facing]
//   ROUTE="up*3,right*4,wait*10,down*2"  주인공 경로(wait*N = N프레임 가만히)   FRAMES=360   SHOT_EVERY=1
// --netns 와 같은 이유로 unshare -rn 안에서 돌리는 것을 권한다.
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer, runRuntimeQa } from "../../lib/runtimeQaRun.mjs";
import { loadCheckpointSet, selectCheckpoints, scenarioForCheckpoint, checkpointBootState } from "../../lib/runtimeQaCheckpoints.mjs";

const [outArg, cpArg = "first-town-grove", mapArg, xArg, yArg, facingArg] = process.argv.slice(2);
if (!outArg) throw new Error("usage: town-life-record.mjs <outDir> [checkpointId] [mapId x y facing]");
const out = resolve(outArg);
await rm(join(out, "frames"), { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });
const set = await loadCheckpointSet(process.env.CHECKPOINT_SET ?? "astra-horizon");
const [picked] = selectCheckpoints(set, cpArg);
const checkpoint = mapArg ? { ...picked, mapId: mapArg, x: Number(xArg), y: Number(yArg), facing: facingArg ?? picked.facing } : picked;
const scenario = scenarioForCheckpoint({ id: "town-life", beats: [] }, set, { ...checkpoint, beats: [{ id: "arrive", ops: [{ kind: "hold", dir: null, ms: 600 }], shot: false }] });
const FRAMES = Number(process.env.FRAMES ?? 360);
const DELTA = 33;
const SHOT_EVERY = Number(process.env.SHOT_EVERY ?? 1);
// 경로: 걸음 묶음 사이 wait*N 은 N 프레임 동안 손을 뗀다.
const plan = (process.env.ROUTE ?? "wait*30").split(",").filter(Boolean).map((seg) => {
  const [dir, n] = seg.split("*");
  return { dir, n: Number(n ?? 1) };
});

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const log = [];
try {
  const page = await (await browser.newContext({ viewport: scenario.viewport })).newPage();
  await runRuntimeQa(page, scenario, { serverUrl: server.url, outDir: join(out, "boot"), checkpoint: checkpointBootState(checkpoint) });
  await page.evaluate(() => window.__oprnQaFrames.pause());
  let frame = 0;
  for (const seg of plan) {
    if (seg.dir !== "wait") {
      await page.evaluate(([dir, n]) => window.__oprnDebug.playerRoute(Array.from({ length: n }, () => ({ kind: "move", dir }))), [seg.dir, seg.n]);
    }
    // 걸음 묶음은 다 걸을 때까지(최대 n*12 프레임), wait 는 n 프레임.
    const limit = seg.dir === "wait" ? seg.n : seg.n * 14 + 4;
    for (let k = 0; k < limit && frame < FRAMES; k += 1, frame += 1) {
      const sample = await page.evaluate(([delta, shoot]) => {
        window.__oprnQaFrames.step({ frames: 1, deltaMs: delta });
        const s = window.__oprnHooksScene;
        const round = (v) => Math.round(v * 10) / 10;
        const spr = (v) => v ? { x: round(v.x), y: round(v.y), f: v.frame?.name ?? null, vis: v.visible, d: Math.round(v.depth ?? 0) } : null;
        const events = {};
        for (const [id, v] of s.eventSprites ?? []) if (/resident|_local|skybird|guide|barista|ambient|walker|bird/.test(id)) events[id] = spr(v);
        const followers = {};
        for (const [id, v] of s.followerSprites ?? []) followers[id] = spr(v);
        const extra = {};
        for (const [id, v] of s.ambientFlyerSprites ?? []) extra[id] = spr(v);
        const canvas = document.querySelector("canvas");
        const png = shoot ? canvas.toDataURL("image/png") : null;
        return { map: s.map?.id, nf: s.session.followers?.length ?? 0, trail: (s.session.followerTrail ?? []).slice(0, 3).map((q) => `${q.x},${q.y}`).join(' '), keys: [...(s.eventSprites?.keys() ?? [])].length, t: s.game.loop.time, hero: spr(s.player), tile: [s.tileX, s.tileY], facing: s.facing, moving: s.moving, followers, events, extra, png };
      }, [DELTA, frame % SHOT_EVERY === 0]);
      if (sample.png) await writeFile(join(out, "frames", `f${String(frame).padStart(5, "0")}.png`), Buffer.from(sample.png.split(",")[1], "base64"));
      delete sample.png;
      log.push({ frame, ...sample });
      if (!(frame % 30) && seg.dir === "wait" && k > 0) { /* noop */ }
      if (seg.dir !== "wait" && k > 2) {
        const idle = await page.evaluate(() => { const s = window.__oprnHooksScene; return !s.moving && !s.playerRoute; });
        if (idle) { frame += 1; break; }
      }
    }
    if (frame >= FRAMES) break;
  }
  await writeFile(join(out, "log.json"), JSON.stringify(log));
} finally {
  await browser.close();
  await server.close();
}
const fps = (1000 / DELTA / SHOT_EVERY).toFixed(3);
const ff = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", fps, "-pattern_type", "glob", "-i", join(out, "frames", "f*.png"),
  "-vf", "scale=iw*2:ih*2:flags=neighbor,format=yuv420p", "-c:v", "libx264", "-crf", "18", "-movflags", "+faststart", join(out, "video.mp4")], { stdio: "inherit" });
console.log(JSON.stringify({ frames: log.length, fps, video: join(out, "video.mp4"), ffmpeg: ff.status }));
