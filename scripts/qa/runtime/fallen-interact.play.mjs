// 폴른 스타 필드 상호작용 실플레이 — 문 열기·궤짝 열기·상자 뒤지기·집주인 같은 방 들킴·다른 방 못 봄.
// 출하 플레이어(player.html), 광장 체크포인트에서 시작. 한 번 부팅해 1배 영상 하나를 찍고 구간 표시(marks)로 자른다.
//   FS_FIXTURE=/tmp/fsi-new/demos/chrono-bell.project.json node scripts/qa/runtime/fallen-interact.play.mjs
// 결과: verify-shots/runtime-qa/fallen-interact/{facts.json, full.webm, clip-*.mp4}
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-interact");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.FS_FIXTURE ?? "/tmp/fsi-new/demos/chrono-bell.project.json"), "utf8"));
const project = fixture.project ?? fixture;
const facts = { clips: {}, sounds: [], errors: [] };
const log = (...a) => console.error("[interact]", ...a);

const CHECKPOINT = {
  id: "fs-interact-start",
  mapId: "fs_hub", x: 32, y: 22, facing: "up",
  switches: { sw_fs_main_started: true, sw_fs_main_step0: true },
  party: [{ actorId: "actor_hero", level: 6 }],
  gold: 100,
};
const SOUND = /\.(ogg|wav|mp3|m4a)(\?|$)/;
const focus = {};
/** 칸 (x,y) 중심의 화면 좌표(css px) — 확대 영상을 그 칸 중심으로 자른다. */
const cellScreen = (page, x, y) => page.evaluate(([cx, cy]) => {
  const scene = window.__oprnHooksScene; const cam = scene.cameras.main; const canvas = document.querySelector("canvas");
  const rect = canvas.getBoundingClientRect(); const size = scene.map?.tileSize ?? 16;
  const sx = rect.width / canvas.width, sy = rect.height / canvas.height;
  return { x: Math.round(rect.left + ((cx + 0.5) * size - cam.worldView.x) * cam.zoom * sx), y: Math.round(rect.top + ((cy + 0.5) * size - cam.worldView.y) * cam.zoom * sy) };
}, [x, y]);

const state = (page) => page.evaluate(() => {
  const s = window.__oprnDebug.readState();
  return { map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, inv: s.inventory, vars: s.variables, self: s.selfSwitches };
});
const eventPos = (page, id) => page.evaluate((i) => { const e = window.__oprnHooksScene?.eventPositions?.[i]; return e ? { x: e.x, y: e.y, d: e.direction } : null; }, id);

async function drain(page, texts, { pace = 900, max = 60 } = {}) {
  let last = null;
  for (let i = 0; i < max; i++) {
    const info = await page.evaluate(() => ({
      box: document.querySelector('[data-testid="dialogue-box"]')?.innerText ?? null,
      running: window.__oprnHooksScene?.running === true,
    }));
    if (info.box === null) {
      if (!info.running) return "done";
      await page.waitForTimeout(150);
      continue;
    }
    const clean = info.box.replace(/\s+/g, " ").trim();
    if (clean && clean !== last) { texts.push(clean); last = clean; }
    await page.waitForTimeout(pace);
    await page.keyboard.press("Enter", { delay: 120 });
    await page.waitForTimeout(200);
  }
  return "max";
}

async function settle(page) {
  for (let i = 0; i < 200; i++) {
    const info = await page.evaluate(() => ({ running: window.__oprnHooksScene?.running === true, box: !!document.querySelector('[data-testid="dialogue-box"]') }));
    if (!info.running) return i;
    if (info.box) await page.keyboard.press("Enter", { delay: 150 });
    await page.waitForTimeout(350);
  }
  return -1;
}

/** 원본 해상도 무손실 스크린숏(영상은 VP8 압축이라 글자 판정에 못 쓴다). */
const shots = [];
function shot(page, tag, delay) {
  shots.push(page.waitForTimeout(delay).then(() => page.screenshot({ path: resolve(out, `native-${tag}.png`) })).catch(() => {}));
}

async function placeAt(page, mapId, x, y, dir) {
  await settle(page);
  await page.evaluate(([m, px, py, d]) => { window.__oprnInput.face(d); window.__oprnDebug.teleport(m, px, py); }, [mapId, x, y, dir]);
  await page.waitForTimeout(700);
  await page.evaluate((d) => window.__oprnInput.face(d), dir);
  await page.waitForTimeout(250);
  return state(page);
}

async function walkKey(page, key, ms, stopOnMapChange = false) {
  const from = (await state(page)).map;
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await page.waitForTimeout(60);
    if (stopOnMapChange && (await state(page)).map !== from) break;
  }
  await page.keyboard.up(key);
}

let videoPath = null;
let videoT0 = 0;
const marks = {};
const mark = (name) => { marks[name] = +((Date.now() - videoT0) / 1000).toFixed(2); log("mark", name, marks[name]); };
if (process.env.QA_CLIPS_ONLY) {
  // 이미 찍은 full.webm·facts.json 으로 구간 영상만 다시 만든다(소리 섞기 손볼 때).
  const old = JSON.parse(await readFile(resolve(out, "facts.json"), "utf8"));
  Object.assign(marks, old.marks); Object.assign(focus, old.focus); facts.sfx = old.sfx ?? [];
  Object.assign(facts, old, { marks, focus, sfx: facts.sfx });
  videoPath = resolve(out, "full.webm");
} else {
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
  videoT0 = Date.now();
  const page = await context.newPage();
  page.on("pageerror", (e) => facts.errors.push(String(e)));
  page.on("console", (m) => { if (/\[fsi-|door open fx|\[player\]/.test(m.text())) { facts.console = facts.console ?? []; facts.console.push(`${((Date.now() - videoT0) / 1000).toFixed(2)} ${m.text()}`); } });
  page.on("request", (r) => { const u = r.url(); if (SOUND.test(u)) facts.sounds.push({ t: +((Date.now() - videoT0) / 1000).toFixed(2), url: u.split("/").pop() }); });
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
    localStorage.clear();
    // 효과음 큐 기록 — 영상에는 소리가 없으므로 이 시각에 실제 파일을 ffmpeg 로 섞는다.
    window.__qaSfx = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) {
      try { if (!this.loop) window.__qaSfx.push({ at: Date.now(), src: this.currentSrc || this.src, volume: this.volume, rate: this.playbackRate }); } catch {}
      return play.apply(this, a);
    };
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, qaCheckpoint };
  }, ["/__runtime-qa/project.json", `fs-interact-${Date.now()}`, CHECKPOINT]);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => !!window.__oprnDebug && !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  await page.waitForTimeout(2500);
  await drain(page, [], { pace: 250 });
  await settle(page);
  facts.bootS = +((Date.now() - videoT0) / 1000).toFixed(1);

  // 1) 문 — 광장에서 리사네 문으로 걸어 들어간다.
  await placeAt(page, "fs_hub", 32, 22, "up");
  await page.waitForTimeout(600);
  focus.door = await cellScreen(page, 32, 20);
  mark("door_start");
  await walkKey(page, "ArrowUp", 4000, true);
  await page.waitForFunction(() => window.__oprnDebug.readState().currentMapId === "fs_lisa_home", null, { timeout: 20_000 });
  await page.waitForTimeout(900);
  mark("door_end");
  facts.clips.door = { entered: await state(page) };
  if (process.env.QA_ONLY !== "door") {

  // 2) 다른 방 — 리사가 거실 쪽(x14~15, 오른쪽)으로 걸어가는 동안 안방 화장대를 뒤진다. 못 본다(방 이름 기척만).
  const searchWhen = async (tag, { box, from, dir, until }) => {
    await placeAt(page, "fs_lisa_home", from[0], from[1], dir);
    let lisa = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 90_000) {
      lisa = await eventPos(page, "ev_fs_lisa");
      if (lisa && until(lisa)) break;
      await page.waitForTimeout(40);
    }
    const before = await state(page);
    focus[tag] = await cellScreen(page, Math.round((box[0] + (lisa?.x ?? box[0])) / 2), box[1] + 1);
    mark(`${tag}_start`);
    await page.evaluate(() => window.__oprnInput.action());
    const texts = [];
    await page.waitForTimeout(300);
    shot(page, tag, 1300);
    await drain(page, texts);
    await page.waitForTimeout(400);
    // 한 걸음 물러서 흔적을 보여 준다.
    await page.evaluate(() => window.__oprnInput.face("down"));
    await page.waitForTimeout(1300);
    mark(`${tag}_end`);
    const after = await state(page);
    const r = { box, from, lisaAtPress: lisa, texts, dGold: after.gold - before.gold, warned: after.vars?.var_fs_lisa_warned ?? 0, searched: !!after.self?.[`ev_fs_box_fs_lisa_home_${box[0]}_${box[1]}`]?.A };
    log(tag, JSON.stringify(r));
    return r;
  };
  facts.clips.otherRoom = await searchWhen("other_room", { box: [8, 11], from: [8, 12], dir: "up", until: (l) => l.x >= 14 && l.x <= 15 && l.d === "right" });
  // 3) 같은 방 — 리사가 안방으로 돌아와 왼쪽을 보며 걸을 때 다른 화장대·협탁. 들킨다(돌아봄 → 「!」 → 꾸중).
  facts.clips.sameRoom = await searchWhen("same_room", { box: [6, 11], from: [6, 12], dir: "up", until: (l) => l.x === 11 && l.d === "left" && l.y === 13 });

  // 4) 궤짝(chest) — 부두 선원 궤짝. 5) 나무 상자(crate).
  const streetSearch = async (tag, bx, by) => {
    const tries = [[bx, by + 1, "up"], [bx - 1, by, "right"], [bx + 1, by, "left"], [bx, by - 1, "down"]];
    for (const [x, y, dir] of tries) {
      const s = await placeAt(page, "fs_hub", x, y, dir);
      if (s.map !== "fs_hub" || s.x !== x || s.y !== y) continue;
      await page.waitForTimeout(700);
      focus[tag] = await cellScreen(page, bx, by);
      mark(`${tag}_start`);
      const before = await state(page);
      await page.evaluate(() => window.__oprnInput.action());
      const texts = [];
      await page.waitForTimeout(300);
      shot(page, tag, 900);
      await drain(page, texts);
      await page.waitForTimeout(1500);
      mark(`${tag}_end`);
      const after = await state(page);
      return { box: [bx, by], from: [x, y], texts, dGold: after.gold - before.gold };
    }
    return { box: [bx, by], error: "no walkable neighbour" };
  };
  facts.clips.chest = await streetSearch("chest", 29, 35);
  facts.clips.crate = await streetSearch("crate", 35, 29);
  facts.clips.barrel = await streetSearch("barrel", 47, 32);
  facts.clips.sack = await streetSearch("sack", 44, 30);

  }
  await Promise.all(shots);
  facts.sfx = (await page.evaluate(() => window.__qaSfx ?? [])).map((c) => ({ ...c, t: +((c.at - videoT0) / 1000).toFixed(3) }));
  videoPath = await page.video().path();
  await context.close();
} finally {
  facts.marks = marks;
  facts.focus = focus;
  facts.errors = facts.errors.slice(0, 8);
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
  await browser.close();
  await server.close?.();
}

}
if (videoPath) {
  if (!process.env.QA_CLIPS_ONLY) await copyFile(videoPath, resolve(out, "full.webm"));
  for (const tag of ["door", "other_room", "same_room", "chest", "crate", "barrel", "sack"]) {
    const a = marks[`${tag}_start`], b = marks[`${tag}_end`];
    if (a === undefined || b === undefined) continue;
    const start = Math.max(0, a - 0.4);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", videoPath, "-ss", String(start), "-to", String(b + 0.3),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", resolve(out, `clip-${tag}.mp4`)]);
    // 확대: 대상 칸 중심 320×180 을 960×540 으로(최근접 — 도트가 뭉개지지 않게).
    const f = focus[tag];
    if (f) {
      const cw = 320, ch = 180;
      const cx = Math.max(0, Math.min(960 - cw, f.x - cw / 2)), cy = Math.max(0, Math.min(540 - ch, f.y - ch / 2));
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", videoPath, "-ss", String(start), "-to", String(b + 0.3),
        "-vf", `crop=${cw}:${ch}:${cx}:${cy},scale=960:540:flags=neighbor`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", resolve(out, `zoom-${tag}.mp4`)]);
    }
    for (const name of [`clip-${tag}.mp4`, `zoom-${tag}.mp4`]) muxSfx(resolve(out, name), start, b + 0.3);
    log("clip", tag, start, b);
  }
}
console.error("DONE");

/**
 * 영상에는 소리가 없다(Playwright 녹화) — 실행 중 기록한 효과음 큐(HTMLMediaElement.play 시각·파일·음량)대로
 * 실제 SE 파일을 그 시각에 놓아 섞는다. 큐가 없는 구간도 무음 트랙을 넣어 모든 영상에 소리 트랙이 있게 한다.
 */
function muxSfx(file, start, end) {
  const cues = (facts.sfx ?? []).filter((c) => c.t >= start - 0.05 && c.t <= end);
  const local = (src) => resolve("public", decodeURIComponent(new URL(src).pathname).replace(/^\//, ""));
  const args = ["-y", "-loglevel", "error", "-i", file];
  const parts = [];
  cues.forEach((c, i) => {
    args.push("-i", local(c.src));
    const ms = Math.max(0, Math.round((c.t - start) * 1000));
    parts.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=${c.volume ?? 1}[a${i}]`);
  });
  const dur = (end - start).toFixed(3);
  const mix = cues.length
    ? `${parts.join(";")};${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:duration=longest,apad,atrim=0:${dur}[aout]`
    : `anullsrc=r=48000:cl=stereo,atrim=0:${dur}[aout]`;
  const tmp = file.replace(/\.mp4$/, ".mux.mp4");
  execFileSync("ffmpeg", [...args, "-filter_complex", mix, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", tmp]);
  execFileSync("mv", [tmp, file]);
  log("mux", file.split("/").pop(), cues.map((c) => `${(c.t - start).toFixed(2)}s ${c.src.split("/").pop()}`).join(", ") || "(silent)");
}
