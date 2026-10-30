// 문으로 걸어 들어가기 증거 영상 — 출하 플레이어(player.html, shim 경로)에서 체크포인트로 문 앞에 서서, 문 앞에 멈춰 보고(발동 안 함),
// 문 쪽으로 걸어 들어가는 1배 영상(소리 포함). door-kinds.clips.mjs 와 같되 느린 기계에서도 장면이 뜰 때까지 기다리고, 걸음마다 상태를 적는다.
//   DE_FIXTURE=/tmp/door-enter/after.play.json DE_OUT=/tmp/door-enter/after DE_CLIPS='[...]' node scripts/qa/runtime/door-enter.clips.mjs [clip,clip]
// clip = {key, mapId, x, y, facing, steps:["up" | "wait:ms" | "tap:x,y" | "action", ...], pauseMs?, tailMs?, holdMs?}
// 결과: <out>/<key>-av.webm (영상+소리), <key>.webm, facts.json
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { installOpeningEvidence } from "../../lib/runtimeOpeningEvidence.mjs";

const out = resolve(process.env.DE_OUT ?? "verify-shots/runtime-qa/door-enter");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.DE_FIXTURE ?? "/tmp/door-enter/after.play.json"), "utf8"));
const project = fixture.project ?? fixture;
const clips = JSON.parse(process.env.DE_CLIPS ?? "[]");
const only = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const facts = { clips: {}, errors: [] };
const log = (...a) => console.error("[door-enter]", ...a);

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const st = (page) => page.evaluate(() => { const s = window.__oprnDebug?.readState?.(); return s ? { map: s.currentMapId ?? s.mapId, x: s.x ?? s.player?.x, y: s.y ?? s.player?.y, facing: s.facing ?? s.playerFacing } : null; }).catch(() => null);
try {
  for (const clip of clips) {
    if (only && !only.has(clip.key)) continue;
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
    const page = await context.newPage();
    const videoStart = Date.now();
    await installOpeningEvidence(page, true);
    page.on("pageerror", (e) => facts.errors.push(`${clip.key}: ${String(e).slice(0, 300)}`));
    const checkpoint = { id: `de-${clip.key}`, mapId: clip.mapId, x: clip.x, y: clip.y, facing: clip.facing ?? "up", party: [{ actorId: "actor_hero", level: 5 }], ...(clip.variables ? { variables: clip.variables } : {}), ...(clip.switches ? { switches: clip.switches } : {}) };
    await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => {
      localStorage.clear();
      window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, qaCheckpoint };
    }, ["/__runtime-qa/project.json", `de-${clip.key}-${Date.now()}`, checkpoint]);
    await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 300_000 });
    for (let i = 0; i < 2400; i++) {
      const ready = await page.evaluate((mapId) => { const s = window.__oprnDebug?.readState?.(); return !!s && (s.currentMapId ?? s.mapId) === mapId && !!document.querySelector('[data-testid="runtime-state-json"]'); }, clip.mapId).catch(() => false);
      if (ready) break;
      await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((n) => /시작하기|Start/.test(n.innerText) && n.offsetParent !== null); b?.click(); });
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(clip.settleMs ?? 2500);
    const before = await st(page);
    const t0 = Date.now();
    // 첫 키 입력이 오디오 문맥을 깨운다.
    await page.keyboard.press("Shift");
    const trail = [];
    for (const step of clip.steps ?? ["up"]) {
      const at = +((Date.now() - videoStart) / 1000).toFixed(2);
      if (step.startsWith("wait:")) { await page.waitForTimeout(Number(step.slice(5))); trail.push({ step, at, state: await st(page) }); continue; }
      if (step === "action") { await page.keyboard.press("z"); }
      else if (step.startsWith("tap:")) {
        const [tx, ty] = step.slice(4).split(",").map(Number);
        const point = await page.evaluate(([x, y]) => {
          const canvas = document.querySelector("canvas"); const camera = window.__oprnCamera?.();
          if (!canvas || !camera) return null;
          const rect = canvas.getBoundingClientRect(); const size = camera.tileSize ?? 16;
          return { x: rect.left + ((x + 0.5) * size - camera.scrollX) * camera.zoom * (rect.width / camera.width), y: rect.top + ((y + 0.5) * size - camera.scrollY) * camera.zoom * (rect.height / camera.height) };
        }, [tx, ty]);
        if (point) await page.mouse.click(point.x, point.y, { button: "left" });
      } else {
        const key = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[step];
        await page.keyboard.down(key); await page.waitForTimeout(clip.holdMs ?? 200); await page.keyboard.up(key);
      }
      await page.waitForTimeout(clip.pauseMs ?? 700);
      trail.push({ step, at, state: await st(page) });
    }
    await page.waitForTimeout(clip.tailMs ?? 2500);
    const after = await st(page);
    const sound = await page.evaluate(() => window.__oprnStopOpeningRecording?.()).catch((e) => { log(clip.key, "audio ERR", e); return null; });
    const video = await page.video().path();
    await context.close();
    await copyFile(video, resolve(out, `${clip.key}.webm`));
    const seg = { before, after, trail, walkStartSec: +((t0 - videoStart) / 1000).toFixed(2) };
    if (sound?.dataUrl && sound.record?.startedAt) {
      const audioPath = resolve(out, `${clip.key}-audio.webm`);
      await writeFile(audioPath, Buffer.from(sound.dataUrl.split(",")[1], "base64"));
      const offset = Math.max(0, (sound.record.startedAt - videoStart) / 1000).toFixed(2);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", resolve(out, `${clip.key}.webm`), "-itsoffset", offset, "-i", audioPath, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", resolve(out, `${clip.key}-av.webm`)]);
      seg.audio = { offset: Number(offset), media: sound.record.media.map((m) => m.src.split("/").pop()) };
    }
    facts.clips[clip.key] = seg;
    log(clip.key, JSON.stringify(seg));
    await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
}
