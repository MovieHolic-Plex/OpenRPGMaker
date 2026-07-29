// 아이템 아이콘 / 몬스터 배틀러를 agy generate_image 로 대량 생성한다.
//
// 사용:
//   node scripts/asset-gen/generate.mjs --kind=item    --concurrency=6
//   node scripts/asset-gen/generate.mjs --kind=monster --concurrency=6
//   node scripts/asset-gen/generate.mjs --kind=item --only=gen-potion-small,gen-sword-iron
//
// 이미 만들어진 파일은 건너뛴다(재시작 가능). 실패는 기록하고 계속 진행한다.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { TARGETS } from "./manifest.mjs";
import { processSprite } from "./spriteProcess.mjs";

// agy 는 저장 위치를 지정할 수 없다 — 자기 scratch/brain 아래에 떨어뜨린다(실측).
// 그래서 고유 파일명을 지시하고 이 트리에서 찾아온다.
const AGY_ROOT = join(homedir(), ".gemini", "antigravity-cli");
const LOG = ".omo/asset-gen.log";
const TMP = ".omo/asset-gen-tmp";

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  try {
    appendFileSync(LOG, `${stamped}\n`);
  } catch {
    /* 로그 실패는 생성을 막지 않는다 */
  }
}

// ── 프롬프트 ────────────────────────────────────────────────────────────────
// 질감·배경·구도·금지사항을 모두 못 박는다. 느슨하게 쓰면 액자를 그리거나
// 투명을 체커보드로 그리거나 사진풍으로 나온다(모두 실측).
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

function itemPrompt(entry) {
  return [
    "Use the generate_image tool to draw one RPG inventory item icon.",
    `Subject: ${entry.desc}.`,
    STYLE,
    "Composition: a single object, centered. If it is a long weapon such as a sword, spear, axe or staff,",
    "orient it diagonally from the lower left to the upper right; otherwise stand it upright.",
    "The object fills about 85 percent of the frame with a small even margin on all four sides.",
    "Use a bold, simple, chunky silhouette that stays clearly readable after the image is scaled down to 16 by 16 pixels.",
    BACKGROUND,
    NEGATIVE,
  ].join(" ");
}

function monsterPrompt(entry) {
  return [
    "Use the generate_image tool to draw one RPG battle enemy sprite (a battler).",
    `Subject: ${entry.desc}.`,
    STYLE,
    "Composition: a single creature, full body, front view facing the viewer directly, standing or floating,",
    "centered, in a neutral symmetrical idle battle pose with limbs clear of the body outline.",
    "The creature fills about 85 percent of the frame with a small even margin on all four sides.",
    "Keep the silhouette readable after the image is scaled down to 96 by 96 pixels.",
    BACKGROUND,
    NEGATIVE,
  ].join(" ");
}

// ── agy 실행 ────────────────────────────────────────────────────────────────
function runAgy(prompt, timeoutMs) {
  return new Promise((done) => {
    // 플래그 순서 주의: --dangerously-skip-permissions 가 -p 보다 앞에 와야 한다.
    // 뒤집으면 -p 가 그 플래그를 프롬프트로 먹는다(실측).
    const child = spawn("agy", ["--dangerously-skip-permissions", "-p", prompt], {
      shell: false,
      windowsHide: true,
    });
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => { out += String(d); });
    child.stderr.on("data", (d) => { out += String(d); });
    child.on("error", (error) => { clearTimeout(timer); done({ ok: false, out: `${out}\n${String(error)}` }); });
    child.on("close", (code) => { clearTimeout(timer); done({ ok: code === 0, out }); });
  });
}

/** agy 트리에서 파일명이 일치하는 가장 최근 파일을 찾는다. */
function findGenerated(fileName) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let items;
    try {
      items = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
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

async function generateOne(kind, target, entry) {
  const outPath = resolve(target.outDir, target.fileName(entry.slug));
  if (existsSync(outPath)) return { slug: entry.slug, status: "skip" };

  const genName = `agygen-${kind}-${entry.slug}.png`;
  const prompt = `${kind === "item" ? itemPrompt(entry) : monsterPrompt(entry)} Save the image as ${genName} and then print only the absolute path of the saved file.`;
  const run = await runAgy(prompt, 8 * 60 * 1000);
  const generated = findGenerated(genName);
  if (!generated) {
    return { slug: entry.slug, status: "no-image", detail: run.out.slice(-300).replace(/\s+/g, " ") };
  }
  // 원본(JPEG)을 보관해 두면 프롬프트를 고쳤을 때 재처리만으로 비교할 수 있다.
  const rawPath = join(TMP, `${kind}-${entry.slug}.jpg`);
  copyFileSync(generated, rawPath);
  try {
    const info = await processSprite(rawPath, outPath, target.size);
    return { slug: entry.slug, status: "ok", detail: `bg ${Math.round(info.keyedRatio * 100)}% content ${info.content.w}x${info.content.h}` };
  } catch (error) {
    return { slug: entry.slug, status: "bad-image", detail: String(error instanceof Error ? error.message : error) };
  }
}

async function main() {
  const kind = arg("kind");
  const target = TARGETS[kind];
  if (!target) {
    console.error("--kind=item 또는 --kind=monster 가 필요합니다");
    process.exit(2);
  }
  const concurrency = Math.max(1, Number(arg("concurrency", "6")));
  const only = arg("only");
  const limit = Number(arg("limit", "0"));
  let entries = only ? target.entries.filter((e) => only.split(",").includes(e.slug)) : [...target.entries];
  if (limit > 0) entries = entries.slice(0, limit);

  mkdirSync(".omo", { recursive: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(target.outDir, { recursive: true });

  log(`[gen] ${kind} 시작 — ${entries.length}종, 동시 ${concurrency}, 출력 ${target.outDir} (${target.size}px)`);
  const results = [];
  let cursor = 0;
  let doneCount = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= entries.length) return;
      const entry = entries[index];
      const result = await generateOne(kind, target, entry);
      results.push(result);
      doneCount += 1;
      log(`[gen] ${doneCount}/${entries.length} ${result.status.padEnd(9)} ${entry.slug}${result.detail ? ` — ${result.detail}` : ""}`);
    }
  });
  await Promise.all(workers);

  const tally = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  log(`[gen] ${kind} 완료 — ${JSON.stringify(tally)}`);
  const failed = results.filter((r) => r.status !== "ok" && r.status !== "skip");
  writeFileSync(`.omo/asset-gen-${kind}-report.json`, JSON.stringify({ tally, failed }, null, 2), "utf8");
  if (failed.length > 0) log(`[gen] 실패 ${failed.length}건 — .omo/asset-gen-${kind}-report.json 참고`);
}

await main();
