// 아군 뒷모습 3/4 재생성 — MDC 이미지 API(Notion: "Image Generating API in MDC").
// http://mdc-server(100.73.251.77):8091 /v1/generate/json — god-tibo-imagen,
// 참조 이미지는 reference_b64, 실패 시 fallback=true 로 DuckCoding 재시도.
// 인증 없음(Tailscale 사설망). 지연 2~5분/장 — 타임아웃 길게.
//
//   node scripts/asset-gen/gen-ally-back-34-mdc.mjs mdc-v1
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { processSprite } from "./spriteProcess.mjs";

const VER = process.argv[2] ?? "mdc-v1";
const BASE = process.env.MDC_IMAGE_API || "http://100.73.251.77:8091";
const REF = resolve(".omo/asset-gen-tmp/original-straight-back.png");
const RAW = resolve(`.omo/asset-gen-tmp/ally-back34-${VER}-raw.png`);
const OUT = resolve(`.omo/asset-gen-tmp/ally-back34-${VER}.png`);
mkdirSync(resolve(".omo/asset-gen-tmp"), { recursive: true });

const PROMPT = [
  "Pixel art sprite edit task (NOT photoreal — ignore any photoreal default, this must stay 16-bit pixel art).",
  "The reference image is a finished 16-bit pixel art battle sprite: a chubby lavender-purple hamster-like",
  "creature seen from directly behind (straight rear view), with pink inner ears, a diamond pattern of pink",
  "spots on its back, a pink oval tail patch, stubby arms and feet, and a one-pixel dark outline.",
  "Redraw the SAME sprite with exactly ONE change: turn the creature's HEAD to its right, shown in right",
  "profile, so it looks toward the upper right of the frame at a distant opponent — a short snout and one",
  "eye visible past its right shoulder, both round ears kept on top. The body below the neck stays identical",
  "to the reference: same straight rear view, same pose, same proportions, same palette, same pixel density,",
  "same spot pattern, same outline weight. Chunky square pixels, flat colors, no anti-aliasing, no gradients,",
  "no 3D, no photorealism. Background: every non-subject pixel must be one flat uniform solid pure magenta",
  "hex #FF00FF, no gradient, no texture. Exactly one subject, no text, no frame, no shadow.",
].join(" ");

const refB64 = readFileSync(REF).toString("base64");
console.log("POST", `${BASE}/v1/generate/json`, "ref bytes:", refB64.length);
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 20 * 60 * 1000);
const res = await fetch(`${BASE}/v1/generate/json`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: PROMPT,
    reference_b64: refB64,
    fallback: true,
    priority: 0,
    size: "1024x1024",
    return_base64: true,
  }),
  signal: controller.signal,
});
clearTimeout(timer);
const json = await res.json().catch(() => null);
if (!res.ok || !json?.ok || !json.image_b64) {
  console.error("생성 실패", res.status, JSON.stringify(json)?.slice(0, 500));
  process.exit(1);
}
console.log("engine:", json.engine, "fallback_used:", json.fallback_used, "duration:", json.duration_sec);
writeFileSync(RAW, Buffer.from(json.image_b64, "base64"));
await processSprite(RAW, OUT, 712);
console.log("written:", OUT);
