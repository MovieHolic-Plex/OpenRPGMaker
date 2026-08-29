// 액터 6인의 **뒷모습 배틀러**(포켓몬식 후면 뷰)를 Grok 이미지 생성으로 만든다.
//
//   node scripts/asset-gen/gen-hero-back-grok.mjs                  # 전부
//   node scripts/asset-gen/gen-hero-back-grok.mjs --only=hero-03
//   node scripts/asset-gen/gen-hero-back-grok.mjs --tag=v2         # 새 세션으로 강제 재생성
//
// 캐시는 두 단계다. `.omo/.../<slug>-<tag>.png`(처리 완료 스탬프)가 있으면 후처리도 건너뛰고
// 출하만 다시 한다. 스탬프는 없고 세션의 `raw.png` 만 있으면 **생성만** 건너뛰고 후처리를 다시
// 돌린다 — 크로마키나 게이트를 고쳤을 때 3분짜리 생성을 다시 태우지 않으려는 것이다.
// 그림 자체를 새로 뽑고 싶으면 `--tag` 를 바꿔라.
//
// 왜 필요한가: 포켓몬 스킨이 파티 전원에게 `ally-creature-back.png`(보라색 생물) 한 장을
// 돌려 쓴다. 어느 액터를 넣어도 같은 생물이 뒤통수를 보이므로 액터별로 나눈다.
//
// 규격은 기존 `ally-creature-back.png` 에 맞춘다: **712×712 통짜 이미지**. 전투 캐릭터셋과
// 달리 3×8 시트가 아니고, 리소스 플랜(oprnGeneratedAssetPlan.json)에도 넣지 않는다 —
// 기존 `bskin-*` 스프라이트가 전부 리졸버 전용이다.
//
// 참조: 출하된 전투 시트의 **idle 셀**(48px)을 384px 로 확대해 세션 cwd 에 reference.png 로
// 깐다. grok 이 그 파일에서 후드·의상·팔레트를 읽어낸다(실측). 자세는 그대로 두고 시점만
// 180° 돌리므로 REFERENCE_NEW_POSE 가 아니라 REFERENCE_BACK_VIEW 를 쓴다.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import Jimp from "jimp";
import { processSprite, sampleBackground } from "./spriteProcess.mjs";
import { HEROES, backViewPrompt } from "./battlerPrompt.mjs";
import { arg, assertGrokReady, makeLogger, newSessionId, newestImage, runGrok, sessionDir } from "./grokImage.mjs";

/** 기존 ally-creature-back.png 실측 규격. */
const SIZE = 712;
const CELL = 48;
/** 48px 셀은 그대로는 못 읽힌다 — 니어리스트로 키워야 grok 의 눈에 디자인이 보인다. */
const REFERENCE_PX = 384;
/** 피사체가 원본 네 변에 닿으면 크로마키가 막혀 마젠타 프린지가 남는다(전투 시트와 같은 이유). */
const MIN_MARGIN = 0.02;
/**
 * 덧댄 띠를 뺀 **원본 영역 안에서** 배경으로 지워져야 하는 최소 비율. 성공한 컷은 51.5% 였고
 * 실패한 컷(flood fill 이 원본 경계에서 멈춘 것)은 0.0% 였다 — 그 사이 어디에 그어도 갈린다.
 */
const MIN_INNER_KEYED = 0.15;
const TMP = resolve(".omo/asset-gen-tmp/hero-back-grok");
const OUT_DIR = resolve("public/assets/generated/battle-skins/sprites");
const SHEET_DIR = resolve("public/assets/generated/starter");
const log = makeLogger("hero-back-grok");

/**
 * 세션 cwd 에 reference.png 를 깐다. 출하된 전투 시트의 idle 셀(행 0 열 0)이 정본이다 —
 * 1024px 원본은 `.omo`(gitignore)라 트리에 없으므로 시트가 유일한 정본이다.
 */
async function writeReference(cwd, hero) {
  const sheet = join(SHEET_DIR, `${hero.slug}-battle.png`);
  if (!existsSync(sheet)) return false;
  const image = await Jimp.read(sheet);
  image.crop(0, 0, CELL, CELL);
  image.resize(REFERENCE_PX, REFERENCE_PX, Jimp.RESIZE_NEAREST_NEIGHBOR);
  // 알파 대신 마젠타를 깔아 배경 규약까지 같이 보여준다.
  const flat = new Jimp(image.bitmap.width, image.bitmap.height, 0xff00ffff);
  flat.composite(image, 0, 0);
  await flat.writeAsync(join(cwd, "reference.png"));
  return true;
}

/**
 * 원본 주위에 **원본의 배경색** 띠를 덧대고 그 경로를 돌려준다.
 *
 * 왜 덧대나: 서 있는 전신을 요구하면 모델이 세로를 꽉 채운다(실측: 프롬프트로 "네 변에 여백" 을
 * 두 번 강화했는데도 content 높이가 1024/1024 로 두 번 연속 나왔다). 피사체가 변에 닿으면
 * 테두리에서 시작하는 flood fill 이 그 변에서 막혀 JPEG 로 번진 마젠타가 살아남고 축소 후
 * 외곽선에 분홍 프린지로 굳는다. 띠를 두르면 flood fill 이 네 방향 모두 배경에서 출발해
 * 피사체 경계까지 닿는다. 피사체 비율과 정사각 크롭 결과는 바뀌지 않는다 — processSprite 가
 * 내용 바운딩 박스를 다시 잡기 때문이다.
 *
 * 왜 순수 #FF00FF 가 아니라 샘플링한 색인가: processSprite 는 배경 판정 기준색을 **테두리
 * 중앙값**에서 뽑는다. 순수 마젠타로 덧대면 그 중앙값이 순수 마젠타로 바뀌는데, 모델이 칠하는
 * 배경은 그것과 꽤 다를 수 있다(실측: rgb 216,39,217 — 순수 마젠타와의 거리 67 로 허용 오차
 * 62 를 넘는다). 그러면 flood fill 이 덧댄 띠만 지우고 원본 경계에서 그대로 멈춘다(실측:
 * keyed 26% = 띠 면적 362768/1411344 와 정확히 일치, 결과물은 마젠타 사각 덩어리였다).
 * 같은 `sampleBackground` 를 재사용해 색을 고르면 기준색이 원본과 같게 유지된다.
 */
async function padWithBackground(inputPath, outputPath) {
  const image = await Jimp.read(inputPath);
  const bg = sampleBackground(image.bitmap);
  const pad = Math.max(8, Math.round(Math.max(image.bitmap.width, image.bitmap.height) * 0.08));
  const canvas = new Jimp(image.bitmap.width + pad * 2, image.bitmap.height + pad * 2, Jimp.rgbaToInt(bg.r, bg.g, bg.b, 255));
  canvas.composite(image, pad, pad);
  await canvas.writeAsync(outputPath);
  return { path: outputPath, bg };
}

/** 처리 끝난 스탬프를 출하 경로로 복사한다. 캐시로 건너뛴 경우에도 반드시 지나야 한다. */
async function publish(stamp, outPath) {
  const final = await Jimp.read(stamp);
  await final.writeAsync(outPath);
  log(`out ${outPath} ${final.bitmap.width}×${final.bitmap.height}`);
}

async function generateBack(hero, tag) {
  const outPath = join(OUT_DIR, `${hero.slug}-back.png`);
  const stamp = join(TMP, `${hero.slug}-${tag}.png`);
  if (existsSync(stamp)) {
    // 스탬프만 보고 그냥 끝내면 안 된다 — 출하 파일이 없거나 낡았을 때 아무 일도 안 하고
    // "skip" 만 찍는다. 스탬프는 **생성**의 캐시이고 출하는 매번 다시 쓴다(같은 내용이면 무해).
    log(`skip ${hero.slug} — 처리된 스탬프가 이미 있다`);
    await publish(stamp, outPath);
    return stamp;
  }
  const cwd = join(TMP, "sessions", `${hero.slug}-${tag}`);
  mkdirSync(cwd, { recursive: true });
  const savePath = join(cwd, "raw.png");
  const hasReference = await writeReference(cwd, hero);
  if (!hasReference) throw new Error(`${hero.slug}: 참조로 쓸 전투 시트가 없다`);
  let found = existsSync(savePath) ? savePath : null;
  if (found) {
    // 후처리(크로마키·패딩·게이트)를 고쳐서 다시 돌리는 경우다. 그림은 멀쩡한데 파이프라인만
    // 틀렸던 것이므로 3분짜리 생성을 다시 태울 이유가 없다. 새 그림을 원하면 --tag 를 바꿔라.
    log(`reuse ${hero.slug} — 기존 raw.png 를 다시 처리한다 (${savePath})`);
  } else {
    const sessionId = newSessionId();
    const dir = sessionDir(cwd, sessionId);
    log(`generate ${hero.slug} session=${sessionId}`);
    await runGrok(backViewPrompt({ who: hero.who, savePath }), cwd, sessionId);
    found = existsSync(savePath) ? savePath : newestImage(dir);
    if (!found) throw new Error(`${hero.slug}: 이미지를 못 찾았다 (${savePath} / ${dir})`);
  }
  const original = await Jimp.read(found);
  const { path: raw, bg } = await padWithBackground(found, join(cwd, "padded.png"));
  // 712px 은 1024px 원본을 1.4배 줄이는 정도라 니어리스트가 가장 선명하다(축소율이 작다).
  // 전투 프레임의 48px 처럼 20배 줄일 때만 가중 평균 필터가 필요하다.
  const report = await processSprite(raw, stamp, SIZE);
  // 덧댄 띠는 정의상 전부 배긴다. 전체 keyed 비율만 보면 **원본 안에서 아무것도 안 지워져도**
  // 띠 면적(≈26%)만으로 그럴싸해 보인다(실측: keyed 26% 로 통과한 결과물이 마젠타 사각형이었다).
  // 그래서 띠를 빼고 **원본 영역 안에서** 지워진 비율을 따로 잰다.
  const padArea = report.source.w * report.source.h - original.bitmap.width * original.bitmap.height;
  const innerArea = original.bitmap.width * original.bitmap.height;
  const innerKeyed = (report.keyedRatio * report.source.w * report.source.h - padArea) / innerArea;
  log(
    `  → ${stamp} keyed=${Math.round(report.keyedRatio * 100)}% (원본 안 ${Math.round(innerKeyed * 100)}%) ` +
      `bg=rgb(${bg.r},${bg.g},${bg.b}) ` +
      `content=${report.content.w}×${report.content.h}/${report.source.w}×${report.source.h}`,
  );
  const margin = Math.min(1 - report.content.w / report.source.w, 1 - report.content.h / report.source.h);
  if (margin < MIN_MARGIN) {
    // processSprite 는 던지기 전에 이미 파일을 쓴다. 남겨두면 다음 실행의 캐시가 집어간다.
    rmSync(stamp, { force: true });
    throw new Error(
      `${hero.slug}: 마진이 없다 (content ${report.content.w}×${report.content.h} / ` +
        `source ${report.source.w}×${report.source.h}, 여백 ${(margin * 100).toFixed(1)}% < ${MIN_MARGIN * 100}%) — ` +
        `피사체가 프레임 변에 닿아 외곽선에 마젠타가 남는다. 같은 인자로 다시 돌려라.`,
    );
  }
  if (innerKeyed < MIN_INNER_KEYED) {
    rmSync(stamp, { force: true });
    throw new Error(
      `${hero.slug}: 크로마키가 원본 안으로 못 들어갔다 (원본 안 ${(innerKeyed * 100).toFixed(1)}% < ` +
        `${MIN_INNER_KEYED * 100}%, 배경색 rgb(${bg.r},${bg.g},${bg.b})) — 모델이 칠한 배경이 균일하지 않아 ` +
        `flood fill 이 중간에 막혔다. 같은 인자로 다시 돌려라.`,
    );
  }
  await publish(stamp, outPath);
  return stamp;
}

const tag = String(arg("tag", "v1"));
const only = String(arg("only", "")).split(",").map((s) => s.trim()).filter(Boolean);
const heroes = only.length > 0 ? HEROES.filter((h) => only.includes(h.slug)) : HEROES;
if (heroes.length === 0) throw new Error(`--only 이 아무 주인공과도 안 맞는다: ${only.join(",")}`);

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

await assertGrokReady(TMP, log);

log(`시작 — ${heroes.length}장 (${heroes.map((h) => h.slug).join(",")}) tag=${tag}`);
const settled = await Promise.allSettled(heroes.map((hero) => generateBack(hero, tag)));
const failures = [];
settled.forEach((result, index) => {
  if (result.status === "rejected") {
    failures.push(`${heroes[index].slug}: ${result.reason?.message ?? result.reason}`);
  }
});
for (const failure of failures) log(`FAIL ${failure}`);
if (failures.length > 0) {
  log(`끝 — 실패 ${failures.length}/${heroes.length}. 실패한 것만 --only 로 다시 돌려라.`);
  process.exitCode = 1;
} else {
  log(`끝 — ${heroes.length}장 전부 성공.`);
}
