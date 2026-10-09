#!/usr/bin/env bun
// scripts/audio-ai-descriptions-run.mjs — 1파일/1호출 agy 청취 배치 러너.
// 사용법: bun scripts/audio-ai-descriptions-run.mjs --manifest <json> --out <jsonl> [--limit N] [--offset N] [--model gemini-3.1-pro-high] [--dry-run]
// manifest: [{id, kind: "music"|"sound", source: "cdn-bgm"|"local", file?: string, path?: string}]
// 한 건당: (CDN이면 다운로드)→메타 제거 익명화→agy -p 단독 분석→즉시 삭제→JSONL append. 실패는 1회 재시도 후 fail 기록.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CDN_BASE = "https://cheapcdn.sgp1.cdn.digitaloceanspaces.com/rpg-zzu/bgm/v1";
const PUBLIC = new URL("../public/", import.meta.url).pathname;

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const manifestPath = arg("manifest", "");
const outPath = arg("out", "");
const limit = Number(arg("limit", "0"));
const offset = Number(arg("offset", "0"));
const model = arg("model", "gemini-3.1-pro-high");
const dryRun = process.argv.includes("--dry-run");
if (!manifestPath || !outPath) { console.error("usage: --manifest <json> --out <jsonl>"); process.exit(2); }
const items = JSON.parse(await Bun.file(manifestPath).text());
mkdirSync(join(outPath, ".."), { recursive: true });
const slice = items.slice(offset, limit > 0 ? offset + limit : undefined);

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { code: r.status ?? 1, out: String(r.stdout ?? ""), err: String(r.stderr ?? "").slice(0, 500) };
}
function promptFor(sample, kind) {
  const shape = kind === "music"
    ? "description (2-4 concrete sentences suitable for a music resource picker, describe the SOUND)"
    : "description (1-3 concrete sentences suitable for a sound-effect picker: what it sounds like, attack/decay/texture, no scene poetry)";
  return "Listen to the actual complete audio attachment @" + sample + ". Analyze only this file. Do not read other files, source code, catalogs, filenames, or prior conversations. Do not modify anything. If you cannot actually access the audio, return audio_available=false and do not invent an analysis. Return concise Korean JSON with exactly these keys: audio_available, " + shape + ", dominant_sounds (each: sound, audible_evidence, confidence high/medium/low), vocals (music: vocal presence; sound: n/a allowed), tempo_feel (qualitative only, no guessed BPM or key; sound: n/a allowed), development (opening/middle/ending; very short sounds may say single-event), mood, suggested_game_scenes (clearly an interpretation), uncertain_claims. Be conservative with exact instrument identification and loop claims.";
}
let ok = 0, fail = 0;
for (const [n, item] of slice.entries()) {
  const dir = mkdtempSync(join(tmpdir(), "agy-batch-"));
  const t0 = Date.now();
  const rec = { id: item.id, kind: item.kind, model, startedAt: new Date().toISOString() };
  try {
    let src;
    if (item.source === "cdn-bgm") {
      src = join(dir, "orig.mp3");
      const d = sh("curl", ["-sSL", "--max-time", "180", "-o", src, CDN_BASE + "/" + item.file]);
      if (d.code !== 0 || !existsSync(src)) throw new Error("download failed: " + d.err);
    } else {
      src = join(PUBLIC, item.path);
      if (!existsSync(src)) throw new Error("local missing: " + item.path);
    }
    const ext = item.source === "cdn-bgm" ? String(item.file).split(".").pop().toLowerCase().replace(/[^a-z0-9]/g,"") || "mp3" : String(item.path).split(".").pop().toLowerCase().replace(/[^a-z0-9]/g,"") || "bin";
    const sample = join(dir, "sample." + ext);
    const s = sh("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", src, "-map", "0:a:0", "-c:a", "copy", "-map_metadata", "-1", "-id3v2_version", "0", "-write_id3v1", "0", sample]);
    if (s.code !== 0) throw new Error("anonymize failed: " + s.err);
    if (dryRun) { rec.status = "dry-run"; }
    else {
      let raw = "", attemptErr = "";
      for (let attempt = 1; attempt <= 2; attempt++) {
        const r = sh("agy", ["-p", promptFor(sample, item.kind), "--model", model], { timeout: 300000 });
        raw = r.out;
        if (r.code === 0 && raw.includes("audio_available")) break;
        attemptErr = "exit=" + r.code + " " + (r.err || raw).slice(0, 300);
        if (attempt === 2) throw new Error("agy failed twice: " + attemptErr);
      }
      const m = raw.match(/```json\s*([\s\S]*?)```/);
      const parsed = JSON.parse(m ? m[1] : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      if (parsed === null || typeof parsed !== "object" || typeof parsed.audio_available !== "boolean") {
        throw new TypeError("analysis requires a boolean audio_available");
      }
      if (parsed.audio_available && (typeof parsed.description !== "string"
        || parsed.description.trim().length === 0 || parsed.description.length > 4000)) {
        throw new TypeError("analysis requires a nonempty description of at most 4000 UTF-16 code units");
      }
      rec.status = parsed.audio_available === false ? "no-audio" : "ok";
      rec.result = parsed;
      if (rec.status === "ok") ok++; else fail++;
    }
  } catch (e) {
    rec.status = "fail";
    rec.error = String(e && e.message ? e.message : e).slice(0, 500);
    fail++;
  } finally {
    rec.elapsedMs = Date.now() - t0;
    try {
      appendFileSync(outPath, JSON.stringify(rec) + "\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  console.log("[" + (offset + n + 1) + "/" + items.length + "] " + item.id + " " + rec.status + " " + rec.elapsedMs + "ms");
}
console.log("DONE ok=" + ok + " fail=" + fail);
process.exitCode = fail > 0 ? 1 : 0;
