// 48px 영웅 전투 시트·idle 스트립을 xBR 로 4배 키운 고해상도 짝을 만든다.
//
//   node scripts/asset-gen/gen-battler-hires-sheets.mjs            # hero-01..06 시트 + idle 스트립
//   node scripts/asset-gen/gen-battler-hires-sheets.mjs --check    # 커밋된 PNG 와 바이트 비교
//
// 왜: 몬스터 배틀러는 384px 원본(화면 밀도 1.6)인데 영웅은 48px 셀을 2배로 그려 밀도 0.5 였다.
// 픽셀아트를 모델에 다시 그리게 하면 캐릭터가 바뀌므로(gen-battler-idle-strips.mjs 머리말) 결정적
// 업스케일러(scripts/lib/pixelUpscale.mjs, xBR 2배×2)로 형태·색을 그대로 두고 계단만 잇는다.
//
// 출력은 원본과 **같은 파일명**으로 `starter/hires/` 와 `starter/hires/idle/` 아래에 둔다 —
// 배경 URL 이 원본 파일명을 포함해야 "이 액터의 저작 시트를 쓴다" 를 재는 기존 계약
// (`test/battleFieldAllySprite.test.ts`, `test/battlerIdleAnimation.test.ts` 의 `idle/hero-0N-battle.png`
// 부분문자열)이 그대로 성립한다. 셀 단위로 키우므로 idle 스트립 프레임 0 == 시트 idle 칸이 4배에서도 유지된다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { writePng } from "../lib/pixelPng.mjs";
import { upscaleCells } from "../lib/pixelUpscale.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const STARTER = path.join(ROOT, "public/assets/generated/starter");
const HIRES = path.join(STARTER, "hires");
export const CELL = 48;
export const FACTOR = 4;
export const HERO_SLUGS = [1, 2, 3, 4, 5, 6].map((index) => `hero-0${index}-battle`);

function readPng(file) {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

/** 시트/스트립 하나를 4배 PNG 바이트로. 결정적 — 같은 입력이면 같은 바이트. */
export function renderHiresPng(sourceFile) {
  const image = readPng(sourceFile);
  const up = upscaleCells(image, CELL, CELL, FACTOR);
  return { width: up.width, height: up.height, bytes: writePng(up.width, up.height, up.data, { filter: "adaptive" }) };
}

export function hiresTargets() {
  return HERO_SLUGS.flatMap((slug) => [
    { slug, kind: "sheet", source: path.join(STARTER, `${slug}.png`), output: path.join(HIRES, `${slug}.png`) },
    { slug, kind: "idle", source: path.join(STARTER, "idle", `${slug}.png`), output: path.join(HIRES, "idle", `${slug}.png`) },
  ]);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
  const check = process.argv.includes("--check");
  let drift = 0;
  for (const target of hiresTargets()) {
    if (!existsSync(target.source)) {
      console.log(`skip    ${path.relative(ROOT, target.source)} — 소스 없음`);
      continue;
    }
    const { width, height, bytes } = renderHiresPng(target.source);
    const relative = path.relative(ROOT, target.output);
    if (check) {
      if (!existsSync(target.output) || !readFileSync(target.output).equals(bytes)) {
        console.error(`DRIFT   ${relative}`);
        drift += 1;
      } else console.log(`OK      ${relative}`);
      continue;
    }
    mkdirSync(path.dirname(target.output), { recursive: true });
    writeFileSync(target.output, bytes);
    console.log(`WROTE   ${relative} ${width}×${height} (${(bytes.length / 1024).toFixed(0)}KB)`);
  }
  if (check && drift > 0) {
    console.error(`${drift}건이 커밋된 시트와 다르다. node scripts/asset-gen/gen-battler-hires-sheets.mjs 로 재생성하라.`);
    process.exit(1);
  }
}
