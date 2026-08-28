// 주인공 4인의 **전투 캐릭터셋**(리소스 kind "n")을 Grok 이미지 생성으로 다시 만든다.
//
//   node scripts/asset-gen/gen-hero-battle-grok.mjs                 # 전부
//   node scripts/asset-gen/gen-hero-battle-grok.mjs --only=hero-03
//   node scripts/asset-gen/gen-hero-battle-grok.mjs --poses=attack  # 한 포즈만 다시
//   node scripts/asset-gen/gen-hero-battle-grok.mjs --tag=v2        # 새 세션으로 강제 재생성
//
// 왜 Grok 인가: 같은 트리의 scripts/asset-gen/generate.mjs 는 agy(gemini) 를 태운다.
// 이 스크립트는 같은 계약(마젠타 배경 1024px → spriteProcess 크로마키)을 Grok CLI 로 돈다.
// Grok 은 `image_gen` 툴을 갖고 있고(TUI 의 /imagine), 결과를 세션 디렉터리에 떨어뜨린다:
// ~/.grok/sessions/<urlencoded-cwd>/<session-id>/images/<N>.jpg   (1024~1152px, 실측)
// 저장 위치를 인자로 지정할 수 없으므로 --session-id 를 우리가 정해 경로를 결정론적으로 만들고,
// 프롬프트로 "이 절대 경로에 원본을 그대로 복사하라" 고 지시해 파일 이름 추측을 없앤다.
//
// 시트 규약 (src/player/battleFieldDom.ts 실측):
//   144×384 PNG = 48px 셀 3열 × 8행. 런타임은 **행 0 만** 쓴다.
//   col 0 = idle, col 1 = attack, col 2 = hit/dead. backgroundPosition 의 Y 는 항상 0.
//   backgroundSize 가 (프레임×3)×(프레임×8) 이므로 **PNG 크기는 144×384 를 유지해야 한다**.
//   행 1~7 은 투명하게 남긴다 — 런타임이 절대 보여주지 않고, 예전 48×64 오슬라이스
//   버그(발밑에 아랫행 머리 16px 이 따라오던 증상)의 재발을 구조적으로 막는다.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import Jimp from "jimp";
import { processSprite } from "./spriteProcess.mjs";

const CELL = 48;
const COLUMNS = 3;
const ROWS = 8;
const TMP = resolve(".omo/asset-gen-tmp/hero-battle-grok");
const OUT_DIR = resolve("public/assets/generated/starter");
const LOG = resolve(".omo/asset-gen.log");
const GROK_SESSIONS = join(homedir(), ".grok", "sessions");

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function log(line) {
  const stamped = `${new Date().toISOString()} [hero-battle-grok] ${line}`;
  console.log(stamped);
  try {
    appendFileSync(LOG, `${stamped}\n`);
  } catch {
    /* 로그 실패가 생성을 막지는 않는다 */
  }
}

// ── 프롬프트 ────────────────────────────────────────────────────────────────
// 전투 화면의 기준은 **이미 출하된 몬스터 배틀러**다(초원 슬라임 등): 굵은 사각 픽셀,
// 납작한 셀 셰이딩, 1px 짙은 외곽선, 높은 채도. 아군도 같은 손맛이어야 나란히 섰을 때
// 튀지 않는다. 이전 시트가 어색했던 실측 원인 3개를 프롬프트로 못 박는다:
//   1. 정면 보행 스프라이트였다 → 측면(좌향) 전투 포즈를 강제한다.
//   2. 48px 셀 안에서 24px 밖에 안 차서 적보다 절반 크기로 보였다 → 전신이 프레임을 채우게 한다.
//   3. 4인의 화풍·명도가 서로 달랐다 → 공통 STYLE 문단을 전원에 붙인다.
const STYLE = [
  "16-bit SNES era Japanese RPG battle sprite, in the visual style of RPG Maker 2003 battle graphics.",
  "Texture: hand-drawn pixel art with visibly chunky square pixels, a limited palette of roughly 16 flat",
  "saturated colors, a solid near-black outline one pixel thick around the entire silhouette, cel shading in",
  "two or three flat steps with a single light source from the upper left, and small specular highlights as",
  "flat light patches. Bold readable shapes: the head is large, the hands and weapon are oversized,",
  "the costume reads instantly from a distance.",
  "Absolutely no anti-aliasing, no soft gradients, no blur, no glow bloom, no noise, no dithering texture,",
  "no painterly brush strokes, no airbrush, no 3D render, no photorealism.",
].join(" ");

const COMPOSITION = [
  "Composition: exactly one full-body character seen from the SIDE, a true side-view profile facing to the",
  "LEFT of the frame — the character's nose, chest and weapon all point left, and we see the left side of the",
  "body, not the front. The torso is turned to the left in profile and must not face the viewer.",
  "This is a player-side battler that stands on the right of a battlefield and faces the",
  "enemies on the left. The whole body from the top of the head to the soles of the feet fills about 90 percent",
  "of the frame height, standing centered with a small even margin, feet level near the bottom edge.",
  "Every weapon, shield and prop stays gripped in a hand or strapped to a limb, physically touching the body.",
  "No ground line, no platform, no shadow under the feet.",
].join(" ");

const BACKGROUND = [
  "Background: every single pixel that is not the character must be exactly one flat uniform solid pure magenta,",
  "hex #FF00FF. That magenta must be one constant color across the whole background with no gradient,",
  "no shading, no vignette, no texture, no pattern and no lighting variation.",
].join(" ");

const NEGATIVE = [
  "Do NOT draw any of the following: border, frame, box, panel, rectangle outline, inner margin line,",
  "drop shadow, ground shadow, contact shadow, reflection, checkerboard or transparency grid,",
  "gradient background, scenery, floor, horizon, text, letters, numbers, labels, watermark, signature,",
  "UI elements, health bars, multiple characters, duplicated copies, collage, grid of variations,",
  "sprite sheet, animation strip, or a front-facing walking sprite.",
  "Do NOT draw a detached, floating, thrown or dropped weapon or shield lying separately from the body,",
  "a second copy of the head, face, arm, leg, weapon or shield, or any extra object the character is not holding.",
  "Exactly one character, nothing else.",
].join(" ");

/** 포즈 3종 = 런타임이 실제로 쓰는 열 3개. */
const POSES = [
  {
    id: "idle",
    col: 0,
    beat: "Pose: battle-ready idle stance, weight on the back foot, weapon held up and ready, head level and looking left at the enemy, calm alert expression.",
  },
  {
    id: "attack",
    col: 1,
    beat: "Pose: mid-attack lunge to the left, front leg driven forward and torso leaning left, weapon swung out to the left at full extension past the body, mouth open in a shout, hair and cloth trailing to the right.",
  },
  {
    id: "hit",
    col: 2,
    beat: "Pose: staggering backwards to the right after taking a hit, feet planted apart with the front knee bent, torso leaning back a little, head tilted back with the eyes squeezed shut and teeth clenched in pain, the free hand clutched against the chest, and the weapon still held firmly in the other hand and lowered across the front of the body. The whole body stays in a clear left-facing side view.",
  },
];

/** 얼굴/직업은 기본 DB(defaultDatabasePartyRecords.ts)의 4인과 짝을 맞춘다. */
const HEROES = [
  {
    slug: "hero-01",
    ko: "주인공",
    who: [
      "A young human swordsman hero: spiky copper-orange hair, a sleeveless royal-blue tunic over a white shirt,",
      "brown leather belt and boots, red shoulder guard, holding a straight steel short sword in his right hand",
      "and a small round wooden shield with an iron rim on his left arm.",
    ].join(" "),
  },
  {
    slug: "hero-02",
    ko: "수호자",
    who: [
      "A stout human guardian knight: full plate armour in polished steel with crimson trim and a crimson cape,",
      "a closed helmet with a short red crest, a large kite shield strapped flat against his left forearm and held",
      "close in front of his chest, and a heavy broad-bladed war axe gripped in his right hand.",
    ].join(" "),
  },
  {
    slug: "hero-03",
    ko: "마도사",
    who: [
      "A slender human sorceress: long violet hair, a deep indigo hooded robe with gold hem and wide sleeves,",
      "a small silver moon pendant, holding a tall wooden staff topped with a glowing cyan crystal in both hands.",
    ].join(" "),
  },
  {
    slug: "hero-04",
    ko: "정찰병",
    who: [
      "A wiry human scout: short dark-green hair under a leather headband, light tan leather jerkin over a forest",
      "green shirt, cross-body strap and small pouches, cloth wraps on the forearms, holding a curved hunting",
      "dagger in the right hand and a short recurve bow in the left.",
    ].join(" "),
  },
];

function prompt(hero, pose, savePath) {
  return [
    "Use your image generation tool exactly once to draw ONE JRPG battle sprite, then stop.",
    "Do not ask questions. Do not critique your own output. Do not regenerate or iterate.",
    `Subject: ${hero.who}`,
    pose.beat,
    STYLE,
    COMPOSITION,
    BACKGROUND,
    NEGATIVE,
    `When the image exists, copy the generated image file itself, unmodified and without any resizing,`,
    `re-encoding, cropping or background edit, to exactly this path: ${savePath}`,
    "Then print the single word DONE and finish.",
  ].join(" ");
}

// ── Grok 호출 ───────────────────────────────────────────────────────────────
/** cwd 는 세션 디렉터리 이름으로 URL 인코딩돼 들어간다(실측: %2Ftmp%2F...). */
function sessionDir(cwd, sessionId) {
  return join(GROK_SESSIONS, encodeURIComponent(cwd), sessionId);
}

/** 결정론적 UUIDv7 풍 문자열 — grok 은 유효한 UUID 만 --session-id 로 받는다. */
function sessionIdFor(seedText) {
  let h = 0x811c9dc5;
  const hex = [];
  for (let i = 0; i < 4; i += 1) {
    for (const ch of `${seedText}#${i}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    hex.push(h.toString(16).padStart(8, "0"));
  }
  const raw = hex.join("");
  return [raw.slice(0, 8), raw.slice(8, 12), `7${raw.slice(13, 16)}`, `a${raw.slice(17, 20)}`, raw.slice(20, 32)].join("-");
}

function runGrok(text, cwd, sessionId) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "grok",
      ["--permission-mode", "bypassPermissions", "--session-id", sessionId, "--cwd", cwd, "-p", text],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 15 * 60 * 1000);
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { out += d.toString(); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`grok exit ${code}: ${out.slice(-400)}`));
      else resolvePromise(out);
    });
  });
}

/** 세션 images/ 에서 가장 최근 파일. grok 은 저장 경로를 인자로 받지 않는다. */
function newestImage(dir) {
  const images = join(dir, "images");
  if (!existsSync(images)) return null;
  const files = readdirSync(images)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => join(images, f))
    .sort();
  return files.at(-1) ?? null;
}

async function generateFrame(hero, pose, tag) {
  const framePath = join(TMP, `${hero.slug}-${pose.id}-${tag}.png`);
  if (existsSync(framePath)) {
    log(`skip ${hero.slug}/${pose.id} — 이미 있다`);
    return framePath;
  }
  const cwd = join(TMP, "sessions", `${hero.slug}-${pose.id}-${tag}`);
  mkdirSync(cwd, { recursive: true });
  const savePath = join(cwd, "raw.png");
  const sessionId = sessionIdFor(`${hero.slug}/${pose.id}/${tag}`);
  const dir = sessionDir(cwd, sessionId);
  log(`generate ${hero.slug}/${pose.id} session=${sessionId}`);
  await runGrok(prompt(hero, pose, savePath), cwd, sessionId);
  // 지시대로 복사했으면 raw.png 가 있다. grok 이 무시했을 때만 세션 images/ 를 뒤진다.
  const raw = existsSync(savePath) ? savePath : newestImage(dir);
  if (!raw) throw new Error(`${hero.slug}/${pose.id}: 이미지를 못 찾았다 (${savePath} / ${dir})`);
  // 48px 은 1024~1152px 원본을 20배 이상 줄인다 — 니어리스트는 칼날 같은 얇은 형태를
  // 통째로 잃고 JPEG 노이즈를 굳힌다. 베지어(가중 평균)가 외곽선을 끊지 않는다(시안 비교 실측).
  const report = await processSprite(raw, framePath, CELL, Jimp.RESIZE_BEZIER);
  log(`  → ${framePath} keyed=${Math.round(report.keyedRatio * 100)}% content=${report.content.w}×${report.content.h}`);
  return framePath;
}

async function composeSheet(hero, framePaths) {
  const sheet = await new Jimp(CELL * COLUMNS, CELL * ROWS, 0x00000000);
  for (const { col, path } of framePaths) {
    const frame = await Jimp.read(path);
    sheet.composite(frame, col * CELL, 0);
  }
  const out = join(OUT_DIR, `${hero.slug}-battle.png`);
  await sheet.writeAsync(out);
  log(`sheet ${out} ${sheet.bitmap.width}×${sheet.bitmap.height}`);
  return out;
}

const tag = String(arg("tag", "v1"));
const only = String(arg("only", "")).split(",").map((s) => s.trim()).filter(Boolean);
const poseFilter = String(arg("poses", "")).split(",").map((s) => s.trim()).filter(Boolean);
const heroes = only.length > 0 ? HEROES.filter((h) => only.includes(h.slug)) : HEROES;
const poses = poseFilter.length > 0 ? POSES.filter((p) => poseFilter.includes(p.id)) : POSES;
if (heroes.length === 0) throw new Error(`--only 이 아무 주인공과도 안 맞는다: ${only.join(",")}`);
if (poses.length === 0) throw new Error(`--poses 가 아무 포즈와도 안 맞는다: ${poseFilter.join(",")}`);

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// 12장을 순차로 돌리면 Grok 지연(장당 1~3분)이 그대로 누적된다. 프레임끼리는 서로를
// 참조하지 않으므로 전부 동시에 띄운다. 하나가 실패해도 나머지는 살린다.
const jobs = heroes.flatMap((hero) => poses.map((pose) => ({ hero, pose })));
log(`시작 — ${jobs.length}장 (heroes=${heroes.map((h) => h.slug).join(",")} poses=${poses.map((p) => p.id).join(",")}) tag=${tag}`);
const settled = await Promise.allSettled(jobs.map(({ hero, pose }) => generateFrame(hero, pose, tag)));

const failures = [];
const byHero = new Map();
settled.forEach((result, index) => {
  const { hero, pose } = jobs[index];
  if (result.status === "fulfilled") {
    if (!byHero.has(hero.slug)) byHero.set(hero.slug, []);
    byHero.get(hero.slug).push({ col: pose.col, path: result.value });
  } else {
    failures.push(`${hero.slug}/${pose.id}: ${result.reason?.message ?? result.reason}`);
  }
});
for (const failure of failures) log(`FAIL ${failure}`);

// 시트는 세 프레임이 전부 있을 때만 덮어쓴다 — 한 열만 새 그림이면 화풍이 섞인다.
// 단, --poses 로 일부만 다시 돌린 경우는 남아 있는 프레임 파일에서 채운다.
for (const hero of heroes) {
  const frames = byHero.get(hero.slug) ?? [];
  const filled = POSES.map((pose) => {
    const hit = frames.find((f) => f.col === pose.col);
    if (hit) return hit;
    const cached = join(TMP, `${hero.slug}-${pose.id}-${tag}.png`);
    return existsSync(cached) ? { col: pose.col, path: cached } : null;
  });
  if (filled.some((f) => f === null)) {
    log(`skip sheet ${hero.slug} — 프레임 ${filled.filter((f) => f === null).length}개가 없다`);
    continue;
  }
  await composeSheet(hero, filled);
}

if (failures.length > 0) {
  log(`끝 — 실패 ${failures.length}/${jobs.length}. 실패한 것만 --only/--poses 로 다시 돌려라.`);
  process.exitCode = 1;
} else {
  log(`끝 — ${jobs.length}장 전부 성공.`);
}
