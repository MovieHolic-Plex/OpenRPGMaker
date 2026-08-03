// 포켓몬 스킨 아군 공용 뒷모습을 3/4 후면(우상단 응시)으로 재생성한다.
// 기존 ally-creature-back.png(정후면)이 "뒤 정방향이라 어색" 하다는 감독 지적(2026-08-03).
// 파이프라인은 generate.mjs 와 동일: agy generate_image(마젠타 배경) → processSprite 크로마키.
//
//   node scripts/asset-gen/gen-ally-back-34.mjs
import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { processSprite } from "./spriteProcess.mjs";

const AGY_ROOT = join(homedir(), ".gemini", "antigravity-cli");
// 후보는 임시 경로에 받고, 감독 승인분만 수동으로 승격한다(v1 이 실자산을 덮은 사고 후 규칙).
const VER = process.argv[2] ?? "v2";
const OUT = resolve(`.omo/asset-gen-tmp/ally-back34-${VER}.png`);
const GEN_NAME = `agygen-skin-ally-back34-${VER}.png`;

const STYLE = [
  "16-bit SNES era Japanese RPG pixel art, in the visual style of RPG Maker 2003 battle graphics.",
  "Texture: hand-drawn pixel art with visibly chunky square pixels, a limited palette of roughly 16 flat colors,",
  "a solid dark outline one pixel thick around the entire silhouette, cel shading in two or three flat steps",
  "with a single light source from the upper left, and small specular highlights as flat light patches.",
  "Absolutely no anti-aliasing, no soft gradients, no blur, no glow bloom, no noise, no dithering texture,",
  "no painterly brush strokes, no airbrush, no 3D render, no photorealism.",
].join(" ");

const BACKGROUND = [
  "Background: every single pixel that is not the subject must be exactly one flat uniform solid pure magenta,",
  "hex #FF00FF. That magenta must be one constant color across the whole background with no gradient,",
  "no shading, no vignette, no texture, no pattern and no lighting variation.",
].join(" ");

const NEGATIVE = [
  "Do NOT draw any of the following: border, frame, box, panel, rectangle outline, inner margin line,",
  "drop shadow, ground shadow, contact shadow, reflection, checkerboard or transparency grid,",
  "gradient background, scenery, floor, horizon, text, letters, numbers, labels, watermark, signature,",
  "UI elements, health bars, multiple objects, duplicated copies, collage, grid of variations, or a character sheet.",
  "Exactly one subject, nothing else.",
].join(" ");

// 기존 자산과 같은 캐릭터로 읽히도록 생김새를 못 박는다(정후면 원본 실측 묘사).
const CREATURE = [
  "Subject: the player's partner monster seen from behind, a chubby round hamster-like creature.",
  "Its fur is soft lavender purple with a slightly darker purple on the lower body and paws.",
  "It has two small round ears with pink inner ears, a tiny tuft of fur spiking up on top of its head,",
  "a diamond pattern of four or five soft pink round spots on the middle of its back,",
  "a small pink oval tail patch at the base of its back, stubby short arms and stubby feet.",
].join(" ");

const COMPOSITION = [
  "Composition: reproduce the reference image almost exactly — same full-body straight rear view, same pose,",
  "same proportions, same palette, same pixel density, same spot pattern — with exactly ONE change:",
  "the creature's HEAD is turned to its right, shown in right profile, so it looks toward the upper right",
  "of the frame at a distant opponent. In the turned head we see: the right side profile of its face past",
  "its shoulder — a small snout, one eye, and both ears (the left ear stays near the top, the right ear",
  "moves toward the right edge of the head). The body below the neck stays in the straight rear view",
  "exactly like the reference. The creature is centered and fills about 85 percent of the frame.",
  "The one-pixel dark outline around the whole silhouette is mandatory, matching the reference.",
].join(" ");

// 텍스트 단독 프롬프트는 3연속 실루엣 붕괴(v1-v3) — 원본 정후면 자산을 참조로 준다.
const REFERENCE = resolve("public/assets/generated/battle-skins/sprites/ally-creature-back.png").replaceAll("\\", "/");

const prompt = [
  `First, open and carefully study the reference image at ${REFERENCE} —`,
  "it is the finished straight-rear-view battle sprite of the creature, and it defines the exact character design:",
  "colors, palette, proportions, ear shape, pink back spots, tail patch, outline weight and pixel density.",
  "Then use the generate_image tool to draw the SAME creature in the SAME pixel art style and palette,",
  "matching the reference's pixel density and its one-pixel dark outline exactly.",
  CREATURE, STYLE, COMPOSITION, BACKGROUND, NEGATIVE,
  `Save the image as ${GEN_NAME} and then print only the absolute path of the saved file.`,
].join(" ");

function runAgy(text, timeoutMs) {
  return new Promise((done) => {
    const child = spawn("agy", ["--dangerously-skip-permissions", "-p", text], { shell: false, windowsHide: true });
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => { out += String(d); });
    child.stderr.on("data", (d) => { out += String(d); });
    child.on("error", (error) => { clearTimeout(timer); done({ ok: false, out: `${out}\n${String(error)}` }); });
    child.on("close", (code) => { clearTimeout(timer); done({ ok: code === 0, out }); });
  });
}

function findGenerated(fileName) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let items;
    try { items = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of items) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name === fileName) found.push(full);
    }
  };
  walk(AGY_ROOT, 0);
  if (found.length === 0) return null;
  return found.map((p) => ({ p, m: statSync(p).mtimeMs })).sort((a, b) => b.m - a.m)[0].p;
}

const run = await runAgy(prompt, 8 * 60 * 1000);
const generated = findGenerated(GEN_NAME);
if (!generated) {
  console.error("no-image", run.out.slice(-400).replace(/\s+/g, " "));
  process.exit(1);
}
console.log("generated:", generated);
await processSprite(generated, OUT, 712);
console.log("written:", OUT);
