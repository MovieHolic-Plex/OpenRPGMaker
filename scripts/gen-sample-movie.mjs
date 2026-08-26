#!/usr/bin/env node
// public/assets/movies/sample-movie.webm 생성기.
//
// 왜 헤드리스 Chromium 인가: 레포에 ffmpeg 도, WebP/VP8 인코더(sharp 등)도 없다. jimp 는 PNG/JPEG 만
// 낸다 — 애니메이션 WebP/APNG 를 만들어도 <video> 는 그걸 재생하지 않으므로 "진짜 재생"이 아니다.
// Playwright 의 Chromium 은 MediaRecorder(VP8) 를 지원하니, 캔버스를 captureStream 해서
// 실제 WebM 을 뽑는다. 생성물은 커밋되므로 이 스크립트는 편집기 런타임 의존이 아니다.
//
// 사용법: node scripts/gen-sample-movie.mjs [--seconds 3] [--out public/assets/movies/sample-movie.webm]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 320;
const HEIGHT = 180;
const FPS = 24;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
}

const seconds = Number.parseFloat(arg("seconds", "3"));
const outPath = resolve(REPO_ROOT, arg("out", "public/assets/movies/sample-movie.webm"));

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const base64 = await page.evaluate(
    async ({ width, height, fps, durationMs }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("2d context unavailable");

      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 300_000 });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const finished = new Promise((resolveFinished) => {
        recorder.onstop = () => resolveFinished();
      });

      // 편집기 팔레트(--bg-sunken / --accent 계열)에 가까운 흙빛 + 호박색 스윕.
      const draw = (progress) => {
        const sky = context.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, "#1d2024");
        sky.addColorStop(1, "#2a2521");
        context.fillStyle = sky;
        context.fillRect(0, 0, width, height);

        context.save();
        context.translate(width / 2, height / 2);
        context.rotate(progress * Math.PI * 2);
        for (let index = 0; index < 6; index += 1) {
          context.rotate((Math.PI * 2) / 6);
          context.fillStyle = `hsl(${(index * 24 + progress * 360) % 360} 72% 58%)`;
          context.fillRect(28, -6, 46, 12);
        }
        context.restore();

        const sweep = (progress * (width + 120)) - 60;
        const glow = context.createLinearGradient(sweep - 60, 0, sweep + 60, 0);
        glow.addColorStop(0, "rgba(255,255,255,0)");
        glow.addColorStop(0.5, "rgba(255,225,170,0.32)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);

        context.fillStyle = "#f4f0e8";
        context.font = "700 18px 'Malgun Gothic', system-ui, sans-serif";
        context.fillText("SAMPLE MOVIE", 16, height - 40);
        context.fillStyle = "rgba(244,240,232,0.68)";
        context.font = "600 12px 'Malgun Gothic', system-ui, sans-serif";
        context.fillText(`${(progress * 100).toFixed(0)}%`, 16, height - 20);
      };

      recorder.start();
      const started = performance.now();
      await new Promise((resolveFrames) => {
        const tick = () => {
          const elapsed = performance.now() - started;
          draw(Math.min(1, elapsed / durationMs));
          if (elapsed >= durationMs) {
            resolveFrames();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
      recorder.stop();
      await finished;

      const blob = new Blob(chunks, { type: "video/webm" });
      const buffer = await blob.arrayBuffer();
      let binary = "";
      for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    { width: WIDTH, height: HEIGHT, fps: FPS, durationMs: Math.round(seconds * 1000) }
  );

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new Error("recorder produced no data");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);
  console.log(`wrote ${outPath} (${bytes.length} bytes, ${seconds}s ${WIDTH}x${HEIGHT} vp8/webm)`);
} finally {
  await browser.close();
}
