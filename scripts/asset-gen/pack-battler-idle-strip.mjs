// 영상 클립에서 잘라낸 키드 프레임들을 **배틀러 idle 스트립**으로 묶는다.
//
// 왜 영상인가 (근거): 384·712px 통짜 배틀러는 프레임마다 이미지를 새로 생성하면 실루엣이
// 튄다(`src/assets/generatedEffectSheets.ts` 머리말과 같은 문제). 영상 모델은 한 클립 안에서
// 같은 픽셀을 이어 그리므로 실루엣이 유지된다 — 실측: 이 저장소에 실린 세 몬스터 스트립의
// 원본 클립에서 `loop_diff` 0.93~2.47, 루프 이음매의 발 높이 차 0px.
// 48px 픽셀아트 액터는 반대로 절차 생성한다(`gen-battler-idle-strips.mjs`).
//
// **프레이밍 규약**: 정적 원본(`--reference`)의 알파 바운딩 박스를 재서, 모든 프레임을 그
// 박스와 같은 상대 위치·배율로 셀에 앉힌다. 이걸 안 하면 애니메이션 배틀러가 정적 배틀러보다
// 크거나 작게 나와서, 카탈로그에 등록하는 순간 적의 크기가 갑자기 변한다.
// 프레임 간 공통 바운딩 박스를 쓰므로 동작(숨·날개짓)은 셀 안에서 그대로 살아 있다.
//
// 사용:
//   node scripts/asset-gen/pack-battler-idle-strip.mjs \
//     --frames <키드 PNG 디렉터리> --reference public/assets/generated/starter/monster-slime-01.png \
//     --out public/assets/generated/starter/monster-slime-01-idle.png [--cell 192] [--pick 1,5,9,...]
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import Jimp from "jimp";

const ROOT = path.resolve(import.meta.dirname, "../..");

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

function requireArg(name) {
  const value = arg(name);
  if (typeof value !== "string") throw new Error(`--${name} 이 필요하다`);
  return value;
}

/** 알파 > 8 인 픽셀의 바운딩 박스. 없으면 전체. */
function alphaBox(image) {
  const { data, width, height } = image.bitmap;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** 여러 프레임을 덮는 하나의 박스 — 프레임마다 다른 박스를 쓰면 피사체가 셀 안에서 튄다. */
function unionBox(boxes) {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

async function main() {
  const framesDir = requireArg("frames");
  const referencePath = requireArg("reference");
  const outPath = requireArg("out");
  const cell = Number(arg("cell", "192"));
  const pick = arg("pick");

  if (!existsSync(framesDir)) throw new Error(`프레임 디렉터리가 없다: ${framesDir}`);
  let files = readdirSync(framesDir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();
  if (typeof pick === "string") {
    const wanted = pick.split(",").map((n) => Number(n.trim()));
    files = wanted.map((n) => {
      const hit = files[n];
      if (!hit) throw new Error(`--pick 의 인덱스 ${n} 가 프레임 범위를 벗어난다 (총 ${files.length}장)`);
      return hit;
    });
  }
  if (files.length === 0) throw new Error("프레임 PNG 가 없다");

  const reference = await Jimp.read(path.resolve(ROOT, referencePath));
  const refBox = alphaBox(reference);
  // 정적 원본에서 피사체가 차지하는 비율과 바닥 위치. 이 두 값을 셀에 그대로 옮긴다.
  const refScaleW = refBox.w / reference.bitmap.width;
  const refCenterX = (refBox.x + refBox.w / 2) / reference.bitmap.width;
  const refBottomY = (refBox.y + refBox.h) / reference.bitmap.height;

  const frames = [];
  for (const file of files) frames.push(await Jimp.read(path.join(framesDir, file)));
  const box = unionBox(frames.map((f) => alphaBox(f)));

  const targetW = Math.max(1, Math.round(cell * refScaleW));
  // **폭 기준으로 맞춘다.** 상하 진폭이 큰 모든(날갯짓·도움)은 전집합 박스가 정적 원본보다
  // 세로로 길어진다. 높이로 맞추면 실루에잣 폭이 줄어 정적 배틀러보다 명함하게 작아진다
  // (실상: 박지 상대폭 0.906 → 0.380). 높이는 셀을 넘지지만 않으면 된다.
  // 원본의 종횡비 대신 **원본이 쓰던 상대 폭·높이**에 맞춘다. 클립 프레임이 정사각이 아니어도
  // 정적 배틀러와 같은 실루엣 크기로 보이는 게 목적이다.
  const scale = Math.min(targetW / box.w, cell / box.h);
  const drawW = Math.max(1, Math.round(box.w * scale));
  const drawH = Math.max(1, Math.round(box.h * scale));
  const drawX = Math.round(cell * refCenterX - drawW / 2);
  // 발밑(박스 밑변)을 정적 원본과 같은 지점에 둔다. 셀 밖으로 나가면 잠금만 올린다.
  const drawY = Math.max(0, Math.min(cell - drawH, Math.round(cell * refBottomY - drawH)));

  const strip = new Jimp(cell * frames.length, cell, 0x00000000);
  for (let i = 0; i < frames.length; i += 1) {
    const piece = frames[i]
      .clone()
      .crop(box.x, box.y, box.w, box.h)
      .resize(drawW, drawH, Jimp.RESIZE_BILINEAR);
    strip.composite(piece, i * cell + drawX, drawY);
  }

  const absoluteOut = path.resolve(ROOT, outPath);
  await strip.writeAsync(absoluteOut);
  console.log(
    `write ${path.relative(ROOT, absoluteOut)}  ${strip.bitmap.width}×${strip.bitmap.height}  ` +
      `${frames.length} frames (cell ${cell}px, 피사체 ${drawW}×${drawH} @ ${drawX},${drawY})`
  );
}

await main();
