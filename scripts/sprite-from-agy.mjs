// agy 의 generate_image 결과를 게임에서 쓸 수 있는 스프라이트 PNG 로 바꾼다.
//
// 왜 후처리가 필요한가 (실측):
//  - generate_image 는 크기·포맷을 지정할 수 없다. 항상 **1024x1024 JPEG** 로 나온다
//    (확장자를 .png 로 줘도 내용은 JPEG — 시그니처 ffd8ffe0).
//  - "투명 배경" 을 요구하면 투명을 **체커보드 무늬 픽셀로 그려버린다**. 알파 채널이 없다.
//    그래서 프롬프트로 **단색 마젠타(#FF00FF) 배경**을 받아 여기서 크로마키한다.
//  - JPEG 는 크로마 서브샘플링 때문에 경계에 마젠타가 번진다 → 허용 오차가 필요하다.
//
// 사용:
//   node scripts/sprite-from-agy.mjs <입력 JPEG/PNG> <출력 PNG> [크기]
//   node scripts/sprite-from-agy.mjs raw/sword.png public/assets/.../sword.png 32
import Jimp from "jimp";

const KEY = { r: 0xff, g: 0x00, b: 0xff };
// JPEG 번짐 때문에 순수 마젠타가 아니어도 배경으로 봐야 한다.
// r 높음 + b 높음 + g 낮음 이면 마젠타 계열로 판정한다.
const KEY_TOLERANCE = 88;

function isKeyColor(r, g, b) {
  return (
    Math.abs(r - KEY.r) <= KEY_TOLERANCE
    && Math.abs(b - KEY.b) <= KEY_TOLERANCE
    && g <= KEY_TOLERANCE
  );
}

async function main() {
  const [input, output, sizeArg] = process.argv.slice(2);
  if (!input || !output) {
    console.error("사용법: node scripts/sprite-from-agy.mjs <입력> <출력 PNG> [크기=32]");
    process.exit(2);
  }
  const size = Number(sizeArg ?? 32);
  if (!Number.isInteger(size) || size <= 0) {
    console.error(`크기가 잘못됐습니다: ${sizeArg}`);
    process.exit(2);
  }

  const image = await Jimp.read(input);
  console.log(`[sprite] 입력 ${image.bitmap.width}x${image.bitmap.height}`);

  // 1) 마젠타 → 알파 0. 동시에 내용 경계를 잡는다.
  let minX = image.bitmap.width;
  let minY = image.bitmap.height;
  let maxX = -1;
  let maxY = -1;
  let keyed = 0;
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (isKeyColor(r, g, b)) {
      this.bitmap.data[idx + 3] = 0;
      keyed += 1;
      return;
    }
    this.bitmap.data[idx + 3] = 255;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  const total = image.bitmap.width * image.bitmap.height;
  console.log(`[sprite] 배경 제거 ${keyed}/${total} 픽셀 (${Math.round((keyed / total) * 100)}%)`);
  if (maxX < 0) {
    console.error("[sprite] 남은 픽셀이 없습니다 — 배경색이 마젠타가 아닐 수 있습니다.");
    process.exit(1);
  }
  if (keyed / total < 0.05) {
    console.error("[sprite] 배경으로 판정된 픽셀이 5% 미만입니다 — 단색 마젠타 배경으로 다시 생성하세요.");
    process.exit(1);
  }

  // 2) 내용만 정사각형으로 잘라낸다(비율 유지 — 늘어나면 픽셀아트가 깨진다).
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.max(w, h);
  const cropX = Math.max(0, minX - Math.floor((side - w) / 2));
  const cropY = Math.max(0, minY - Math.floor((side - h) / 2));
  const cropW = Math.min(side, image.bitmap.width - cropX);
  const cropH = Math.min(side, image.bitmap.height - cropY);
  image.crop(cropX, cropY, cropW, cropH);
  console.log(`[sprite] 크롭 ${cropW}x${cropH} (내용 ${w}x${h})`);

  // 3) 목표 크기로 축소. 픽셀아트는 보간하면 뭉개지므로 최근접 이웃으로 줄인다.
  image.resize(size, size, Jimp.RESIZE_NEAREST_NEIGHBOR);

  // 4) 축소 과정에서 생긴 반투명 픽셀을 이진화한다 — 런타임이 알파 블렌딩을 하지 않는다.
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    this.bitmap.data[idx + 3] = this.bitmap.data[idx + 3] >= 128 ? 255 : 0;
  });

  await image.writeAsync(output);
  console.log(`[sprite] 저장 ${output} (${size}x${size} PNG, 알파 있음)`);
}

await main();
