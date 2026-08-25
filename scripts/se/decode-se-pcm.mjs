/**
 * public/assets/se/** → dist/se-staging/pcm/<id>.wav (모노 22050Hz PCM16)
 *
 *   node scripts/se/decode-se-pcm.mjs [--staging dist/se-staging] [--filter <부분문자열>]
 *
 * 왜 브라우저인가: 8팩 중 7팩이 Ogg Vorbis 인데 이 환경엔 ffmpeg 이 없고 python 에도
 * 디코더가 없다. Chromium 의 `decodeAudioData` 는 ogg/wav 를 네이티브로 디코딩하고
 * playwright 는 이미 이 레포의 의존성이다 — 새 설치 없이 해결된다.
 *
 * 왜 모노 22050 PCM16 인가: 다운스트림 분석(스펙트로그램·스펙트럼 중심·피치 궤적)은
 * python 표준 `wave` + numpy 로 하는데, 그 조합이 바로 읽을 수 있는 최소 포맷이다.
 * 22050 이면 나이퀴스트 11kHz — 효과음의 밝기 판별에 충분하다.
 */
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TARGET_RATE = 22050;
const BATCH = 24;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** 모노 Float32 → PCM16 wav 바이트. */
function toWav(samples, rate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

async function main() {
  const staging = path.resolve(arg("--staging", path.join(REPO, "dist", "se-staging")));
  const filter = arg("--filter", "");
  const runtimeSrc = await readFile(path.join(REPO, "src", "assets", "seCatalogRuntime.ts"), "utf8");
  const entries = [...runtimeSrc.matchAll(/\["(cc0-se-[^"]+)", "([^"]+)"\]/g)]
    .map(([, id, rel]) => ({ id, rel }))
    .filter((e) => (filter ? e.id.includes(filter) || e.rel.includes(filter) : true));
  if (entries.length === 0) throw new Error("대상이 없다 — --filter 를 확인하라");

  const outDir = path.join(staging, "pcm");
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // 디코딩만 하므로 빈 페이지로 충분하다. AudioContext 는 사용자 입력 없이도 decodeAudioData 가 된다.
  await page.goto("about:blank");

  let done = 0;
  let skipped = 0;
  const failures = [];
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const payload = [];
    for (const e of batch) {
      const out = path.join(outDir, `${e.id}.wav`);
      if (existsSync(out)) {
        skipped += 1;
        continue;
      }
      const bytes = await readFile(path.join(REPO, "public", e.rel));
      payload.push({ id: e.id, b64: bytes.toString("base64") });
    }
    if (payload.length === 0) continue;

    const decoded = await page.evaluate(async ({ items, rate }) => {
      const out = [];
      for (const item of items) {
        try {
          const raw = Uint8Array.from(atob(item.b64), (c) => c.charCodeAt(0));
          // 원본 레이트로 먼저 디코딩한 뒤 OfflineAudioContext 로 모노 리샘플한다.
          const probe = new AudioContext();
          const buf = await probe.decodeAudioData(raw.buffer);
          await probe.close();
          const frames = Math.max(1, Math.ceil((buf.duration * rate)));
          const off = new OfflineAudioContext(1, frames, rate);
          const src = off.createBufferSource();
          src.buffer = buf;
          src.connect(off.destination);
          src.start();
          const rendered = await off.startRendering();
          out.push({ id: item.id, ok: true, data: Array.from(rendered.getChannelData(0)) });
        } catch (err) {
          out.push({ id: item.id, ok: false, error: String(err).slice(0, 120) });
        }
      }
      return out;
    }, { items: payload, rate: TARGET_RATE });

    for (const r of decoded) {
      if (!r.ok) {
        failures.push(`${r.id}: ${r.error}`);
        continue;
      }
      await writeFile(path.join(outDir, `${r.id}.wav`), toWav(r.data, TARGET_RATE));
      done += 1;
    }
    process.stdout.write(`\r  디코딩 ${done + skipped}/${entries.length}`);
  }
  await browser.close();
  process.stdout.write("\n");
  console.log(`새로 디코딩 ${done}개 / 건너뜀 ${skipped}개 / 실패 ${failures.length}개`);
  for (const f of failures.slice(0, 10)) console.log("  실패 " + f);
  console.log(`→ ${outDir}`);
}

await main();
