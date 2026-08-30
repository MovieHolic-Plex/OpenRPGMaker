// 액터 전투 시트의 idle 칸에서 **숨쉬기 idle 스트립**을 절차 생성한다.
//
// 왜 절차 생성인가 (근거):
//  - 소스는 48×48 픽셀아트다. 영상 모델에 올리려면 업스케일해야 하고, 그러면 모델이
//    캐릭터를 다시 그려서 **같은 사람이 아니게 된다**. 이 저장소는 이펙트 시트에서 이미
//    같은 결론을 남겼다(`src/assets/generatedEffectSheets.ts` 머리말 — 모델은 프레임마다
//    실루엣을 다시 상상한다). farming 작물 스프라이트도 같은 이유로 절차 2~3프레임이다.
//  - 반대로 384·712px 통짜 배틀러는 영상 클립에서 뽑는다(`pack-battler-idle-strip.mjs`).
//    두 티어의 근거는 `openwiki/runtime-battle.md` 의 배틀러 애니메이션 절에 있다.
//
// 만드는 것: `idle/hero-0N-battle.png` = 48px 셀 4열 × 1행 가로 스트립(원본과 같은 파일명).
// 프레임 0 은 **원본 idle 칸과 픽셀 단위로 같아야 한다** — 감속 모드(prefers-reduced-motion)와
// 애니메이션 미등록 폴백이 첫 프레임을 정지 화면으로 쓰기 때문이다.
//
// 사용:
//   node scripts/asset-gen/gen-battler-idle-strips.mjs            # hero-01..06
//   node scripts/asset-gen/gen-battler-idle-strips.mjs --hero 1   # 하나만
//   node scripts/asset-gen/gen-battler-idle-strips.mjs --check    # 쓰지 않고 검증만
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Jimp from "jimp";

/** 전투 캐릭터셋 규격 — `src/player/battleFieldDom.ts` 의 BATTLE_SHEET_* 와 같아야 한다. */
const CELL = 48;
const SHEET_COLUMNS = 3;
const SHEET_ROWS = 8;

/** idle 칸 좌표 — `src/battle/battlePose.ts` 의 POSE_FRAME.idle 이 정본이다. */
const IDLE_COL = 0;
const IDLE_ROW = 0;

/** 프레임 수. 120ms 간격이면 480ms 주기 — 사람 호흡보다 조금 빠른 게임 호흡. */
const FRAME_COUNT = 4;

/**
 * 프레임별 상진 압축량(px). 0 은 원본 그대로.
 * 1px 을 넘기면 48px 픽셀아트에서 머리가 눈에 띄게 찌그러진다(실측: 2px 은 목이 사라진다).
 * [0,1,1,0] 은 들이마심·내리쉼 두 상태를 각각 두 필드 유지하는 사이클이다 — farming 작물
 * 스프라이트가 2~3프레임인 것과 같은 이유로 48px 에서 상태 수를 더 늘리지 않는다.
 */
const SQUASH_BY_FRAME = [0, 1, 1, 0];

const ROOT = path.resolve(import.meta.dirname, "../..");
const STARTER = path.join(ROOT, "public/assets/generated/starter");
// idle 스트립은 원본과 **같은 파일명**으로 `idle/` 아래에 둔다. 그래야 배경 URL 이 원본
// 파일명을 그대로 포함해서, "이 액터의 저작 시트를 쓰고 있다" 를 재는 기존 계약
// (`test/battleFieldAllySprite.test.ts`)이 애니메이션에도 그대로 성립한다.
const IDLE_DIR = path.join(STARTER, "idle");

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

/** idle 셀만 떼어낸다. */
function idleCell(sheet) {
  return sheet.clone().crop(IDLE_COL * CELL, IDLE_ROW * CELL, CELL, CELL);
}

/** 알파가 있는 가장 아래 행 = 발이 닿는 바닥. 없으면 셀 바닥. */
function groundRow(cell) {
  const { data, width, height } = cell.bitmap;
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) return y;
    }
  }
  return height - 1;
}

/**
 * 숨쉬기 한 프레임을 만든다.
 * 하단 다리·발 구간은 한 픽셀도 움직이지 않고, 상진 60% 만 눌러 아래로 민다.
 * 발이 뜨거나 바닥이 흔들리면 전투 화면에서 캐릭터가 미끄러져 보인다.
 */
function breatheFrame(cell, squash) {
  const out = new Jimp(CELL, CELL, 0x00000000);
  if (squash === 0) {
    out.composite(cell, 0, 0);
    return out;
  }
  const total = groundRow(cell) + 1;
  const lowerHeight = Math.max(1, Math.round(total * 0.4));
  const upperHeight = Math.max(1, total - lowerHeight);
  // NEAREST 로 줄여야 픽셀아트 경계가 흐려지지 않는다.
  const upper = cell
    .clone()
    .crop(0, 0, CELL, upperHeight)
    .resize(CELL, Math.max(1, upperHeight - squash), Jimp.RESIZE_NEAREST_NEIGHBOR);
  const lower = cell.clone().crop(0, upperHeight, CELL, CELL - upperHeight);
  // 상진을 squash px 아래로 밀어 어깨가 내려오게 한다. 하단은 원자리.
  out.composite(upper, 0, squash);
  out.composite(lower, 0, upperHeight);
  return out;
}

async function buildStrip(heroIndex, { check }) {
  const id = `hero-0${heroIndex}-battle`;
  const src = path.join(STARTER, `${id}.png`);
  if (!existsSync(src)) return { id, skipped: "소스 시트 없음" };
  const sheet = await Jimp.read(src);
  if (sheet.bitmap.width !== CELL * SHEET_COLUMNS || sheet.bitmap.height !== CELL * SHEET_ROWS) {
    throw new Error(
      `${id}: 시트 규격이 ${CELL * SHEET_COLUMNS}×${CELL * SHEET_ROWS} 가 아니다 ` +
        `(실측 ${sheet.bitmap.width}×${sheet.bitmap.height}). battleFieldDom 의 BATTLE_SHEET_* 와 어긋난다.`
    );
  }
  const cell = idleCell(sheet);
  const strip = new Jimp(CELL * FRAME_COUNT, CELL, 0x00000000);
  for (let i = 0; i < FRAME_COUNT; i += 1) {
    strip.composite(breatheFrame(cell, SQUASH_BY_FRAME[i]), i * CELL, 0);
  }
  mkdirSync(IDLE_DIR, { recursive: true });
  const outPath = path.join(IDLE_DIR, `${id}.png`);
  if (!check) await strip.writeAsync(outPath);
  return {
    id,
    out: path.relative(ROOT, outPath),
    size: `${strip.bitmap.width}×${strip.bitmap.height}`,
    frames: FRAME_COUNT,
  };
}

async function main() {
  const check = Boolean(arg("check", false));
  const only = arg("hero");
  const indices = typeof only === "string" ? [Number(only)] : [1, 2, 3, 4, 5, 6];
  for (const index of indices) {
    const result = await buildStrip(index, { check });
    if (result.skipped) console.log(`skip  ${result.id} — ${result.skipped}`);
    else console.log(`${check ? "check" : "write"} ${result.out}  ${result.size}  ${result.frames} frames`);
  }
}

await main();
