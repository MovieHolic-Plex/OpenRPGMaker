// 번들 샘플 동영상 생성기.
// 헤드리스 Chromium canvas 에서 프레임 JPEG(mjpeg)를 뽑아 Playwright 동반 ffmpeg로
// WebM(VP8, Duration·Cues 포함)으로 인코딩한다. 산출물은 <video>가 즉시 재생·진행 가능하다.
// 실행: node scripts/gen-sample-movie.mjs [출력경로] [프레임수] [fps]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const outPath = process.argv[2] ?? path.join(__dirname, "..", "public", "assets", "movies", "sample-movie.webm");
const FRAMES = Number(process.argv[3] ?? 45);
const FPS = Number(process.argv[4] ?? 15);
function findFfmpeg() {
  const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  for (const d of fs.readdirSync(root)) {
    if (!d.startsWith("ffmpeg-")) continue;
    const p = path.join(root, d, "ffmpeg-win64.exe");
    if (fs.existsSync(p)) return p;
  }
  return null;
}
// node 경로를 ffmpeg(윈도 네이티브)에 넘기기 위한 변환
function toWin(p) { return process.platform === "win32" && !/^[A-Za-z]:/.test(p) ? execConvert(p) : p; }
function execConvert(p) {
  try {
    const r = spawnSync("cygpath", ["-w", p], { encoding: "utf8" });
    if (r.status === 0) return r.stdout.trim();
  } catch {}
  return path.resolve(p);
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c" width="160" height="90"></canvas>');
  const jpegs = await page.evaluate(async ({ FRAMES }) => {
    const outs = [];
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d");
    for (let k = 0; k < FRAMES; k++) {
      ctx.fillStyle = "hsl(" + (k * 12) + ",70%,50%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "20px sans-serif";
      ctx.fillText("OPRN MOVIE " + k, 16, 52);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      outs.push(new Uint8Array(await blob.arrayBuffer()));
    }
    return outs;
  }, { FRAMES });
  const tmpDir = fs.mkdtempSync(path.join(require_tmp(), "sample-movie-"));
  const mjpegPath = path.join(tmpDir, "stream.mjpeg");
  fs.writeFileSync(mjpegPath, Buffer.concat(jpegs));
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error("playwright ffmpeg binary not found under LOCALAPPDATA/ms-playwright");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // image2pipe 입력은 -c:v mjpeg 강제가 필요하다(png 디코더가 없고 컨테이너 추론이 mjpeg를 못 하므로).
  const r = spawnSync(ffmpeg, [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", toWin(mjpegPath),
    "-c:v", "libvpx", "-b:v", "250k", "-an",
    "-f", "webm", toWin(outPath),
  ], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed: " + (r.stderr ?? "").slice(-400));
  console.log("wrote", outPath, fs.statSync(outPath).size, "bytes,", FRAMES, "frames @", FPS, "fps =", (FRAMES / FPS).toFixed(1) + "s");
} finally { await browser.close(); }

function require_tmp() { return process.env.TEMP || "/tmp"; }
