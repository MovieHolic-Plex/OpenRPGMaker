// 주인공 6인의 **전투 캐릭터셋**(리소스 kind "n")을 Grok 이미지 생성으로 다시 만든다.
//
//   node scripts/asset-gen/gen-hero-battle-grok.mjs                 # 전부
//   node scripts/asset-gen/gen-hero-battle-grok.mjs --only=hero-03
//   node scripts/asset-gen/gen-hero-battle-grok.mjs --poses=attack  # 한 포즈만 다시
//   node scripts/asset-gen/gen-hero-battle-grok.mjs --tag=v2        # 새 세션으로 강제 재생성
//   node scripts/asset-gen/gen-hero-battle-grok.mjs --fresh         # 시트를 처음부터 재합성
//
// 기본 동작은 **병합**이다: 출력 PNG 가 이미 있으면 읽어서 이번에 성공한 셀만 덮어쓴다.
// 행 0 의 hero-01~04 는 번들 캐릭터셋에서 잘라낸 승인된 그림이므로 다시 뽑지 않는다.
//
// 왜 Grok 인가: 같은 트리의 scripts/asset-gen/generate.mjs 는 agy(gemini) 를 태운다.
// 이 스크립트는 같은 계약(마젠타 배경 1024px → spriteProcess 크로마키)을 Grok CLI 로 돈다.
// Grok 은 `image_gen` 툴을 갖고 있고(TUI 의 /imagine), 결과를 세션 디렉터리에 떨어뜨린다:
// ~/.grok/sessions/<urlencoded-cwd>/<session-id>/images/<N>.jpg   (1024~1152px, 실측)
// 저장 위치를 인자로 지정할 수 없으므로 --session-id 를 우리가 정해 경로를 결정론적으로 만들고,
// 프롬프트로 "이 절대 경로에 원본을 그대로 복사하라" 고 지시해 파일 이름 추측을 없앤다.
//
// 시트 규약 (src/battle/battlePose.ts 의 POSE_FRAME 이 정본):
//   144×384 PNG = 48px 셀 3열 × 8행. backgroundSize 가 (프레임×3)×(프레임×8) 이므로
//   **PNG 크기는 144×384 를 유지해야 한다**.
//   행 0: col 0 idle, col 1 attack, col 2 hit
//   행 1: col 0 defend, col 1 dead, col 2 victory (2026-09-26 부터 채운다 — 비어 있으면
//         런타임 victoryFrameFor 가 idle 로 떨어진다)
//   행 2~7 은 투명하게 남긴다 — 런타임이 샘플링하지 않고, 뭔가 그려 두면 시트를 읽는
//   사람만 속는다. test/heroBattleSheetContract.test.ts 가 이 범위를 검사한다.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import Jimp from "jimp";
import { processSprite } from "./spriteProcess.mjs";
import { HEROES, POSES, REFERENCE_NEW_POSE, battlerPrompt, beatFor } from "./battlerPrompt.mjs";
// grok 배관(홈 해석·세션 id·호출·사전 점검)은 grokImage.mjs 가 정본이다 — 뒷모습 생성기와 공유한다.
import { arg, assertGrokReady, makeLogger, newSessionId, newestImage, runGrok, sessionDir } from "./grokImage.mjs";

const CELL = 48;
const COLUMNS = 3;
const ROWS = 8;
const TMP = resolve(".omo/asset-gen-tmp/hero-battle-grok");
const OUT_DIR = resolve("public/assets/generated/starter");
const log = makeLogger("hero-battle-grok");

// ── 프롬프트 ────────────────────────────────────────────────────────────────
// 화풍 계약과 인물·포즈 표는 battlerPrompt.mjs 가 정본이다. 포즈 행 확장과 뒷모습 생성기가
// 같은 문구를 공유해야 나란히 놓았을 때 튀지 않는다.
const prompt = (hero, pose, savePath, hasReference) =>
  battlerPrompt({
    who: hero.who,
    beat: beatFor(hero, pose),
    savePath,
    reference: hasReference ? REFERENCE_NEW_POSE : null,
  });

// ── 레퍼런스 프레임 ─────────────────────────────────────────────────────────
/** 다른 포즈들이 따라 그릴 기준 포즈. 이 프레임 자신은 레퍼런스를 쓰지 않는다. */
const ANCHOR_POSE = "idle";
/** 48px 셀은 그대로는 못 읽힌다 — 니어리스트로 키워야 grok 의 눈에 디자인이 보인다. */
const REFERENCE_PX = 384;
/**
 * 피사체 바운딩 박스가 원본 대비 남겨야 하는 최소 여백. 실측 분포: 정상 프레임은 여백
 * 20~35% 였고, 마젠타 프린지가 남은 궁수 attack 은 0.0% 였다(content == source).
 * 2% 는 "네 변에 닿았다" 만 잡는 느슨한 하한이다 — 정상 프레임을 떨어뜨리지 않는다.
 */
const MIN_MARGIN = 0.02;

/** 이번 실행의 anchor 가 남긴 원본(1024px, 마젠타 배경). 해상도가 가장 높아 최우선이다. */
function anchorRawPath(hero, tag) {
  return join(TMP, "sessions", `${hero.slug}-${ANCHOR_POSE}-${tag}`, "raw.png");
}

/**
 * 세션 cwd 에 reference.png 를 깔고 깔았는지 돌려준다. 우선순위:
 *   1) --reference=<경로> — 포즈 행 확장이나 뒷모습처럼 기준을 손으로 지정할 때
 *   2) 이번 실행의 anchor 원본 — 같은 실행 안에서 승인된 디자인
 *   3) 이미 출하된 시트의 idle 셀 — 승인된 디자인의 정본
 *
 * **어느 경로든 48px 실루엣으로 한 번 떨어뜨린 뒤 REFERENCE_PX 로 되키운다.** 참조는
 * 픽셀이 아니라 **디자인만** 전달해야 한다. 정밀한 참조를 주면 모델이 CRITICAL 지시를
 * 무시하고 포즈까지 베낀다(실측: 1024px 원본을 참조로 준 hero-06 hit 의 포즈 구분이
 * 12.6% 로 무너졌다 — idle 과 사실상 같은 그림. 같은 프롬프트로 48px 유래 참조를 준
 * hero-03 hit 은 58.0% 였다). 목표가 48px 이므로 이 열화로 잃는 정보도 없다.
 */
async function writeReference(cwd, hero, tag) {
  const anchorRaw = anchorRawPath(hero, tag);
  const shipped = join(OUT_DIR, `${hero.slug}-battle.png`);
  let source = null;
  let fromSheet = false;
  if (referenceArg && existsSync(referenceArg)) source = referenceArg;
  else if (existsSync(anchorRaw)) source = anchorRaw;
  else if (existsSync(shipped)) {
    source = shipped;
    fromSheet = true;
  }
  if (!source) return false;

  const image = await Jimp.read(source);
  // 출하 시트는 3열×8행이므로 idle 셀만 떼어낸다. 원본/지정 파일은 이미 한 장이다.
  if (fromSheet) image.crop(0, 0, CELL, CELL);
  // 48px 로 떨어뜨렸다 되키운다 — 최종 출력과 같은 정보량으로 맞춘다.
  if (image.bitmap.width !== CELL) image.resize(CELL, CELL, Jimp.RESIZE_BEZIER);
  image.resize(REFERENCE_PX, REFERENCE_PX, Jimp.RESIZE_NEAREST_NEIGHBOR);
  // 알파를 마젠타로 메운다 — 우리가 요구하는 배경색과 같아야 배경까지 그대로 따라 그린다.
  const flat = new Jimp(image.bitmap.width, image.bitmap.height, 0xff00ffff);
  flat.composite(image, 0, 0);
  await flat.writeAsync(join(cwd, "reference.png"));
  return true;
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
  const hasReference = pose.id === ANCHOR_POSE ? false : await writeReference(cwd, hero, tag);
  const sessionId = newSessionId();
  const dir = sessionDir(cwd, sessionId);
  log(`generate ${hero.slug}/${pose.id} session=${sessionId} ref=${hasReference ? "있음" : "없음"}`);
  await runGrok(prompt(hero, pose, savePath, hasReference), cwd, sessionId);
  // 지시대로 복사했으면 raw.png 가 있다. grok 이 무시했을 때만 세션 images/ 를 뒤진다.
  const raw = existsSync(savePath) ? savePath : newestImage(dir);
  if (!raw) throw new Error(`${hero.slug}/${pose.id}: 이미지를 못 찾았다 (${savePath} / ${dir})`);
  // 48px 은 1024~1152px 원본을 20배 이상 줄인다 — 니어리스트는 칼날 같은 얇은 형태를
  // 통째로 잃고 JPEG 노이즈를 굳힌다. 베지어(가중 평균)가 외곽선을 끊지 않는다(시안 비교 실측).
  const report = await processSprite(raw, framePath, CELL, Jimp.RESIZE_BEZIER);
  log(
    `  → ${framePath} keyed=${Math.round(report.keyedRatio * 100)}% ` +
      `content=${report.content.w}×${report.content.h}/${report.source.w}×${report.source.h}`,
  );
  // 마진 게이트 — 피사체가 프레임 네 변에 닿으면 테두리에서 시작하는 flood fill 이 막혀
  // JPEG 로 번진 경계 마젠타가 살아남고, 48px 로 줄이면 **외곽선에 분홍 프린지로 굳는다**
  // (실측: 궁수 attack 이 content 1024×1024 로 나와 실루엣 전체에 마젠타가 남았다).
  // keyedRatio 검사(<5%)로는 안 걸린다 — 그 프레임은 42% 였다. 육안 검수에만 의존하지 않도록
  // 여기서 실패로 확정하고 재생성하게 만든다. COMPOSITION 은 이미 "작은 균일 마진" 을 요구한다.
  const margin = Math.min(1 - report.content.w / report.source.w, 1 - report.content.h / report.source.h);
  if (margin < MIN_MARGIN) {
    // **불량 프레임을 반드시 지운다.** processSprite 는 던지기 전에 이미 파일을 썼으므로,
    // 남겨두면 (1) 다음 실행의 프레임 캐시가 "이미 있다" 로 건너뛰고 (2) 시트 합성의
    // 캐시 폴백이 그걸 집어가 결국 불량이 출하된다(실측으로 둘 다 일어났다).
    rmSync(framePath, { force: true });
    throw new Error(
      `${hero.slug}/${pose.id}: 마진이 없다 (content ${report.content.w}×${report.content.h} / ` +
        `source ${report.source.w}×${report.source.h}, 여백 ${(margin * 100).toFixed(1)}% < ${MIN_MARGIN * 100}%) — ` +
        `피사체가 프레임 변에 닿아 외곽선에 마젠타가 남는다. 같은 인자로 다시 돌려라.`,
    );
  }
  const shifted = await bottomAlignFrame(framePath);
  if (shifted > 0) log(`  → ${hero.slug}/${pose.id} 바닥 정렬 ${shifted}px`);
  return framePath;
}

/**
 * 48×48 프레임의 내용을 셀 **바닥에 붙인다**. 옮긴 픽셀 수를 돌려준다.
 *
 * 왜 필요한가: processSprite 는 비율을 지키려고 내용 주위를 **정사각으로** 크롭하므로,
 * 가로로 긴 피사체는 위아래에 같은 여백이 생기고 결과가 셀 **중앙**에 놓인다. 서 있는
 * 포즈는 내용이 거의 정사각이라 차이가 없지만(실측: defend 가 y 1~47), 누워 있는 dead 는
 * 세로 여백이 크게 남아 전투 화면에서 시체가 **공중에 떠 보인다**. 스프라이트는 바닥선에
 * 서야 하므로 프레임 단계에서 내려 붙인다. 세로 크기는 바뀌지 않는다.
 */
async function bottomAlignFrame(framePath) {
  const image = await Jimp.read(framePath);
  const { width, height, data } = image.bitmap;
  let maxY = -1;
  for (let y = height - 1; y >= 0 && maxY < 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        maxY = y;
        break;
      }
    }
  }
  const shift = maxY < 0 ? 0 : height - 1 - maxY;
  if (shift === 0) return 0;
  const moved = new Jimp(width, height, 0x00000000);
  moved.composite(image, 0, shift);
  await moved.writeAsync(framePath);
  return shift;
}

/** 48×48 셀 하나를 완전 투명으로 비운다. */
function clearCell(sheet, col, row) {
  const { data, width } = sheet.bitmap;
  for (let y = row * CELL; y < (row + 1) * CELL; y += 1) {
    for (let x = col * CELL; x < (col + 1) * CELL; x += 1) {
      const idx = (y * width + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 0;
    }
  }
}

/**
 * 프레임들을 시트에 심는다.
 *
 * `base` 가 있으면 그 PNG 를 읽어 **그 위에 덮어쓴다**. 행 1(defend/dead)을 추가하면서
 * 필요해진 동작이다 — 행 0 의 hero-01~04 는 번들 캐릭터셋에서 잘라낸 승인된 그림이라
 * grok 으로 다시 뽑을 수 없고, 뽑아서도 안 된다. 그래서 새 행만 얹는다.
 *
 * 셀은 합성 전에 `clearCell` 로 비운다. Jimp.composite 는 알파 블렌딩이라 그냥 얹으면
 * 새 프레임의 투명 여백으로 **이전 포즈의 실루엣이 그대로 비친다** — 같은 셀을 두 번
 * 생성할 때 유령이 남는다.
 */
async function composeSheet(hero, framePaths, base) {
  const sheet = base ? await Jimp.read(base) : await new Jimp(CELL * COLUMNS, CELL * ROWS, 0x00000000);
  if (sheet.bitmap.width !== CELL * COLUMNS || sheet.bitmap.height !== CELL * ROWS) {
    throw new Error(
      `${hero.slug}: 기존 시트 크기가 ${sheet.bitmap.width}×${sheet.bitmap.height} 다 — ${CELL * COLUMNS}×${CELL * ROWS} 가 아니면 병합하지 않는다`,
    );
  }
  for (const { col, row, path } of framePaths) {
    const frame = await Jimp.read(path);
    clearCell(sheet, col, row);
    sheet.composite(frame, col * CELL, row * CELL);
  }
  const out = join(OUT_DIR, `${hero.slug}-battle.png`);
  await sheet.writeAsync(out);
  log(`sheet ${out} ${sheet.bitmap.width}×${sheet.bitmap.height} (${base ? "병합" : "신규"}, 셀 ${framePaths.length}개)`);
  return out;
}

const tag = String(arg("tag", "v1"));
const referenceArg = String(arg("reference", "")).trim();
// 기본은 병합이다. --fresh 는 시트를 처음부터 다시 만든다(전 포즈가 있어야 한다).
const fresh = process.argv.includes("--fresh");
const only = String(arg("only", "")).split(",").map((s) => s.trim()).filter(Boolean);
const poseFilter = String(arg("poses", "")).split(",").map((s) => s.trim()).filter(Boolean);
const heroes = only.length > 0 ? HEROES.filter((h) => only.includes(h.slug)) : HEROES;
const poses = poseFilter.length > 0 ? POSES.filter((p) => poseFilter.includes(p.id)) : POSES;
if (heroes.length === 0) throw new Error(`--only 이 아무 주인공과도 안 맞는다: ${only.join(",")}`);
if (poses.length === 0) throw new Error(`--poses 가 아무 포즈와도 안 맞는다: ${poseFilter.join(",")}`);

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

await assertGrokReady(TMP, log);

// 인물별로 anchor(idle) 를 **먼저** 끝내고 나머지 포즈를 띄운다. 나머지가 anchor 원본을
// reference.png 로 보기 때문에 이 순서가 곧 캐릭터 일관성이다 — 전부 동시에 띄우면 서로를
// 못 보고 포즈마다 다른 사람이 나온다. 인물끼리는 여전히 완전 병렬이라 벽시계는
// 장당 1~3분 × 2단계로 끝난다. 하나가 실패해도 나머지는 살린다.
const anchorJobs = heroes.flatMap((hero) =>
  poses.filter((pose) => pose.id === ANCHOR_POSE).map((pose) => ({ hero, pose })),
);
const restJobs = heroes.flatMap((hero) =>
  poses.filter((pose) => pose.id !== ANCHOR_POSE).map((pose) => ({ hero, pose })),
);
const jobs = [...anchorJobs, ...restJobs];
log(`시작 — ${jobs.length}장 (heroes=${heroes.map((h) => h.slug).join(",")} poses=${poses.map((p) => p.id).join(",")}) tag=${tag}`);
const settled = [
  ...(await Promise.allSettled(anchorJobs.map(({ hero, pose }) => generateFrame(hero, pose, tag)))),
  ...(await Promise.allSettled(restJobs.map(({ hero, pose }) => generateFrame(hero, pose, tag)))),
];

const failures = [];
const byHero = new Map();
settled.forEach((result, index) => {
  const { hero, pose } = jobs[index];
  if (result.status === "fulfilled") {
    if (!byHero.has(hero.slug)) byHero.set(hero.slug, []);
    byHero.get(hero.slug).push({ col: pose.col, row: pose.row, path: result.value });
  } else {
    failures.push(`${hero.slug}/${pose.id}: ${result.reason?.message ?? result.reason}`);
  }
});
for (const failure of failures) log(`FAIL ${failure}`);

// 시트가 이미 있으면 **이번에 성공한 셀만** 덮어쓴다. 캐시 프레임으로 나머지를 채우지
// 않는 게 중요하다 — hero-01~04 의 행 0 은 번들 캐릭터셋에서 잘라낸 승인된 그림인데,
// .omo 에 남은 옛 grok 프레임을 같이 얹으면 그 승인된 그림이 조용히 교체된다.
//
// 시트가 없거나 --fresh 면 새로 만든다. 이때는 구멍 난 시트를 낼 수 없으므로 전 포즈가
// 차야 하고, 부족한 포즈는 같은 태그의 남은 프레임 파일에서 채운다.
for (const hero of heroes) {
  const frames = byHero.get(hero.slug) ?? [];
  const out = join(OUT_DIR, `${hero.slug}-battle.png`);
  const base = fresh ? null : existsSync(out) ? out : null;
  if (base) {
    if (frames.length === 0) {
      log(`skip sheet ${hero.slug} — 이번에 성공한 프레임이 없어 기존 시트를 그대로 둔다`);
      continue;
    }
    await composeSheet(hero, frames, base);
    continue;
  }
  const filled = POSES.map((pose) => {
    const hit = frames.find((f) => f.col === pose.col && f.row === pose.row);
    if (hit) return hit;
    const cached = join(TMP, `${hero.slug}-${pose.id}-${tag}.png`);
    return existsSync(cached) ? { col: pose.col, row: pose.row, path: cached } : null;
  });
  const missing = POSES.filter((_, index) => filled[index] === null).map((pose) => pose.id);
  if (missing.length > 0) {
    log(`skip sheet ${hero.slug} — 프레임 없음: ${missing.join(",")}`);
    continue;
  }
  await composeSheet(hero, filled, null);
}

if (failures.length > 0) {
  log(`끝 — 실패 ${failures.length}/${jobs.length}. 실패한 것만 --only/--poses 로 다시 돌려라.`);
  process.exitCode = 1;
} else {
  log(`끝 — ${jobs.length}장 전부 성공.`);
}
