/* 스크린샷의 특정 영역을 잘라 확대 저장한다 — 참조 이미지와 구현 결과를 픽셀 단위로 대조할 때 쓴다.
 *
 * 왜 필요했나: vxace 전투 스킨 1차 구현은 참조 스크린샷을 "비슷한 배치" 로만 읽어서 만들었고,
 * 파티 셀의 실제 구조(얼굴이 셀 전체 배경이고 HUD 가 그 위에 얹힌다)를 놓쳤다. 영역을 4배로
 * 확대해 보고서야 드러났다. 눈으로 재려면 확대가 필요하다.
 *
 * 사용법:
 *   REF_SRC=<이미지> REGIONS='[{"name":"cell","x":0,"y":294,"w":137,"h":116,"scale":4}]' \
 *     node scripts/crop-compare.mjs <출력디렉터리> <파일접두사>
 *
 * 좌표는 원본 이미지 px 다. 확대는 최근접 이웃이라 원본 픽셀 경계가 그대로 보인다.
 */
import Jimp from "jimp";
import { mkdirSync } from "node:fs";

const src = process.env.REF_SRC;
if (!src) {
  console.error("REF_SRC 환경변수에 원본 이미지 경로가 필요하다.");
  process.exit(1);
}
const outDir = process.argv[2] ?? ".";
const prefix = process.argv[3] ?? "crop";
mkdirSync(outDir, { recursive: true });

const regions = JSON.parse(process.env.REGIONS ?? "[]");
if (!Array.isArray(regions) || regions.length === 0) {
  console.error("REGIONS 에 [{name,x,y,w,h,scale}] 배열이 필요하다.");
  process.exit(1);
}

const image = await Jimp.read(src);
console.log(`src ${image.bitmap.width}x${image.bitmap.height}`);
for (const region of regions) {
  const w = Math.min(region.w, image.bitmap.width - region.x);
  const h = Math.min(region.h, image.bitmap.height - region.y);
  const scale = region.scale ?? 4;
  const crop = image
    .clone()
    .crop(region.x, region.y, w, h)
    .resize(w * scale, h * scale, Jimp.RESIZE_NEAREST_NEIGHBOR);
  const path = `${outDir}/${prefix}-${region.name}.png`;
  await crop.writeAsync(path);
  console.log(`${path}  src ${region.x},${region.y} ${w}x${h} -> ${w * scale}x${h * scale}`);
}
