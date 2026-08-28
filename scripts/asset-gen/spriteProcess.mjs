// agy generate_image 결과(1024x1024 JPEG, 마젠타 배경)를 게임용 스프라이트 PNG 로 바꾼다.
//
// 왜 이 단계가 필요한가 (모두 실측):
//  - generate_image 는 크기·포맷을 지정할 수 없다. 확장자를 .png 로 줘도 내용은 JPEG(ffd8ffe0)다.
//  - "투명 배경" 을 요구하면 투명을 체커보드 픽셀로 그려버린다 — 알파가 없다.
//    그래서 단색 마젠타로 받아 여기서 크로마키한다.
//  - JPEG 크로마 서브샘플링 때문에 경계의 마젠타가 번진다 → 허용 오차가 필요하다.
import Jimp from "jimp";

// 배경 판정은 **테두리에서 시작하는 flood fill** 로 한다. 절대 색거리(#FF00FF 기준)로
// 하면 두 방향으로 다 실패한다(둘 다 실측):
//   - 모델이 어두운 마젠타(rgb 187,58,140)를 칠하면 배경을 못 잡는다.
//   - 허용 오차를 넓히면 보라색 피사체(마법사 로브·수정 골렘)를 갉아먹는다.
// 배경은 네 변에 닿아 있고 피사체는 중앙에 있으므로, 테두리에서 번져 들어가면
// 색이 비슷해도 안쪽에 갇힌 영역은 건드리지 않는다.
const FILL_TOLERANCE = 62;

function colorDistance(data, idx, ref) {
  const dr = data[idx] - ref.r;
  const dg = data[idx + 1] - ref.g;
  const db = data[idx + 2] - ref.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** 테두리 픽셀들의 중앙값 색 — 코너 하나만 보면 피사체가 코너에 닿았을 때 틀린다. */
function sampleBackground(bitmap) {
  const { width, height, data } = bitmap;
  const samples = [];
  const push = (x, y) => {
    const idx = (y * width + x) * 4;
    samples.push([data[idx], data[idx + 1], data[idx + 2]]);
  };
  for (let i = 1; i < 8; i += 1) {
    const fx = Math.floor((width * i) / 8);
    const fy = Math.floor((height * i) / 8);
    push(fx, 0);
    push(fx, height - 1);
    push(0, fy);
    push(width - 1, fy);
  }
  const median = (channel) => {
    const values = samples.map((s) => s[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  return { r: median(0), g: median(1), b: median(2) };
}

/** 테두리에서 배경색과 비슷한 픽셀을 번져 들어가며 알파 0 으로 만든다. */
function floodFillBackground(bitmap) {
  const { width, height, data } = bitmap;
  const reference = sampleBackground(bitmap);
  const visited = new Uint8Array(width * height);
  const stack = [];
  const consider = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const flat = y * width + x;
    if (visited[flat]) return;
    visited[flat] = 1;
    if (colorDistance(data, flat * 4, reference) > FILL_TOLERANCE) return;
    data[flat * 4 + 3] = 0;
    stack.push(x, y);
  };
  for (let x = 0; x < width; x += 1) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    consider(0, y);
    consider(width - 1, y);
  }
  while (stack.length > 0) {
    const y = stack.pop();
    const x = stack.pop();
    consider(x + 1, y);
    consider(x - 1, y);
    consider(x, y + 1);
    consider(x, y - 1);
  }
  return reference;
}

/** flood fill 이 못 닿은, 배경색과 같은 색의 내부 구멍을 지운다. */
function removeEnclosedBackground(bitmap, reference) {
  const { width, height, data } = bitmap;
  for (let flat = 0; flat < width * height; flat += 1) {
    const idx = flat * 4;
    if (data[idx + 3] === 0) continue;
    if (colorDistance(data, idx, reference) <= FILL_TOLERANCE) data[idx + 3] = 0;
  }
}

/**
 * 알파 경계를 radius 픽셀 깎는다. 분리형(가로→세로) 최소 필터라
 * O(W*H*radius*2) — 박스 스캔(O(W*H*radius^2))보다 충분히 빠르다.
 */
function erodeAlpha(image, radius) {
  const { width, height, data } = image.bitmap;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) alpha[i] = data[i * 4 + 3] > 0 ? 1 : 0;

  const rowPass = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dx = -radius; dx <= radius && keep; dx += 1) {
        const sx = x + dx;
        if (sx < 0 || sx >= width || alpha[y * width + sx] === 0) keep = 0;
      }
      rowPass[y * width + x] = keep;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = 1;
      for (let dy = -radius; dy <= radius && keep; dy += 1) {
        const sy = y + dy;
        if (sy < 0 || sy >= height || rowPass[sy * width + x] === 0) keep = 0;
      }
      if (keep === 0) data[(y * width + x) * 4 + 3] = 0;
    }
  }
}

/**
 * @param {number} [filter] Jimp.RESIZE_* 축소 필터. 기본 NEAREST_NEIGHBOR.
 *   16~96px 아이콘·몬스터는 원본 대비 축소율이 작아 니어리스트가 가장 선명하다.
 *   48px 전투 프레임처럼 20배 이상 줄일 때는 니어리스트가 한 픽셀만 찍어
 *   칼날 같은 얇은 형태를 잃고 JPEG 노이즈를 그대로 굳힌다(실측: 48px 에 705색).
 *   그 경우 가중 평균 필터를 넘겨라.
 * @returns {Promise<{ keyedRatio: number, content: {w: number, h: number} }>}
 * @throws 배경이 마젠타가 아니거나 내용이 없으면 던진다.
 */
export async function processSprite(inputPath, outputPath, size, filter = Jimp.RESIZE_NEAREST_NEIGHBOR) {
  const image = await Jimp.read(inputPath);
  const reference = floodFillBackground(image.bitmap);
  // 피사체에 둘러싸여 테두리에서 못 닿는 내부 구멍(활과 팔 사이, 날개 틈 등)은
  // flood fill 로 지워지지 않아 마젠타 덩어리로 남는다(실측: 해골 궁수·실프·토템).
  // 고정 #FF00FF 가 아니라 **이 이미지에서 실제로 뽑은 배경색**과 비교하므로
  // 보라색 피사체를 갉아먹지 않는다.
  removeEnclosedBackground(image.bitmap, reference);

  // 배경이 마젠타 계열인지 확인한다 — 다른 색이면 프롬프트를 무시한 결과이거나
  // 피사체가 프레임을 가득 채워 테두리까지 닿은 것이다. 그대로 쓰면 사각 덩어리가 된다.
  const magentaish = reference.r > reference.g + 40 && reference.b > reference.g + 30;
  let minX = image.bitmap.width;
  let minY = image.bitmap.height;
  let maxX = -1;
  let maxY = -1;
  let keyed = 0;
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    if (this.bitmap.data[idx + 3] === 0) {
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
  const keyedRatio = keyed / total;
  if (maxX < 0) throw new Error("남은 픽셀이 없다 — 전체가 배경으로 판정됐다");
  if (!magentaish) {
    throw new Error(`테두리 색이 마젠타가 아니다 rgb(${reference.r},${reference.g},${reference.b})`);
  }
  if (keyedRatio < 0.05) {
    throw new Error(`배경 판정 ${Math.round(keyedRatio * 100)}% — 피사체가 프레임을 가득 채웠거나 배경이 균일하지 않다`);
  }

  // 경계 침식 — JPEG 서브샘플링으로 번진 마젠타가 허용 오차를 통과해 남고,
  // 축소하면 그 색이 그대로 굳어 테두리에 분홍/보라 점으로 보인다(실측).
  // 원본 해상도에서 알파 경계를 몇 픽셀 깎아내면 16px 결과에서는 눈에 안 띈다.
  erodeAlpha(image, Math.max(2, Math.round(image.bitmap.width / 200)));

  // 비율을 유지한 정사각 크롭 — 늘이면 픽셀아트가 깨진다.
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.max(w, h);
  const cropX = Math.max(0, Math.min(minX - Math.floor((side - w) / 2), image.bitmap.width - side));
  const cropY = Math.max(0, Math.min(minY - Math.floor((side - h) / 2), image.bitmap.height - side));
  image.crop(cropX, cropY, Math.min(side, image.bitmap.width - cropX), Math.min(side, image.bitmap.height - cropY));

  // 픽셀아트는 보간하면 뭉개진다.
  image.resize(size, size, filter);
  // 축소로 생긴 반투명 픽셀을 이진화한다 — 런타임이 알파 블렌딩을 하지 않는다.
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    this.bitmap.data[idx + 3] = this.bitmap.data[idx + 3] >= 128 ? 255 : 0;
  });
  await image.writeAsync(outputPath);
  return { keyedRatio, content: { w, h } };
}
