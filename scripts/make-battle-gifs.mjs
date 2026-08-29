#!/usr/bin/env node
// 전투 재미 감사 후속 — Playwright 영상(webm)에서 보고서용 GIF 를 잘라낸다.
//
// 입력: evidence/battle-feel-after-2026-08-29/summary.json 의 marks(초 단위 오프셋) +
//       test-results/**/video.webm
// 출력: 같은 증거 디렉터리의 *.gif
//
// 사용: node scripts/make-battle-gifs.mjs
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);
const ROOT = new URL("..", import.meta.url).pathname;
const EVIDENCE = join(ROOT, "evidence/battle-feel-after-2026-08-29");
const RESULTS = join(ROOT, "test-results");

/** test-results 아래에서 가장 최근에 쓰인 video.webm 을 찾는다. */
async function findLatestVideo(dir) {
  let best;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findLatestVideo(path);
      if (nested && (!best || nested.mtimeMs > best.mtimeMs)) best = nested;
      continue;
    }
    if (!entry.name.endsWith(".webm")) continue;
    const info = await stat(path);
    if (!best || info.mtimeMs > best.mtimeMs) best = { path, mtimeMs: info.mtimeMs };
  }
  return best;
}

/**
 * webm 구간 → GIF. 2-pass 팔레트(palettegen/paletteuse)로 색 밴딩을 줄인다.
 * 소스는 1024×768 이지만 보고서 폭에 맞춰 축소하고, 파일 크기를 위해 fps 를 낮춘다.
 */
async function clip(video, { out, start, duration, fps = 16, width = 620 }) {
  const filters = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`;
  await run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", String(start), "-t", String(duration),
    "-i", video,
    "-filter_complex", filters,
    "-loop", "0",
    join(EVIDENCE, out),
  ]);
  const info = await stat(join(EVIDENCE, out));
  console.log(`${out.padEnd(28)} ${start.toFixed(2)}s +${duration.toFixed(2)}s  ${(info.size / 1024).toFixed(0)} KB`);
}

const summary = JSON.parse(await readFile(join(EVIDENCE, "summary.json"), "utf8"));
const marks = summary.marks ?? {};
const video = await findLatestVideo(RESULTS);
if (!video) throw new Error("video.webm 을 찾지 못했다 — 먼저 녹화 스펙을 실행하세요.");
console.log(`source: ${video.path}`);

const span = (from, to, pad = 0.25) => ({
  start: Math.max(0, (marks[from] ?? 0) - pad),
  duration: Math.max(0.5, (marks[to] ?? 0) - (marks[from] ?? 0) + pad * 2),
});

// 1) 커맨드 메뉴 → 대상 선택 → 공격 1회 (핵심 컷)
await clip(video.path, { out: "gif-01-attack-sequence.gif", ...span("cutAStart", "cutAEnd", 0.6) });
// 2) 빨리감기 — 연출 중 확인 키
await clip(video.path, { out: "gif-02-fast-forward.gif", ...span("cutBStart", "cutBEnd", 0.3) });
// 3) 전투 마무리 + 결과 화면
await clip(video.path, { out: "gif-03-finish-and-result.gif", ...span("cutCStart", "cutCEnd", 0.3), fps: 14 });
// 4) 커맨드 메뉴 정지컷 근처 — 한국어 라벨 + 적 HP 노출 확인용 짧은 루프
await clip(video.path, {
  out: "gif-04-command-menu.gif",
  start: Math.max(0, (marks.commandMenu ?? 0) - 0.2),
  duration: 2.2,
  fps: 12,
});
