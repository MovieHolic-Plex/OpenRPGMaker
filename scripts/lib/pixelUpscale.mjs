// 픽셀아트 업스케일러 — xBR 계열 2배 커널(Hyllian 의 2xBR 규칙을 RGBA 로 옮긴 것).
//
// 왜 이 방식인가: 48px 영웅 전투 시트를 이미지 생성 모델에 넣으면 캐릭터가 다른 사람이 된다
// (`scripts/asset-gen/gen-battler-idle-strips.mjs` 머리말). 결정적 업스케일러는 원본 픽셀의
// 형태·색을 그대로 두고 계단만 대각선으로 이어 주므로 "같은 캐릭터" 가 유지된다. 2배 커널을
// 두 번 돌려 4배(48 → 192px 셀)를 만든다 — 몬스터 배틀러(384px 원본)와 같은 급의 밀도다.
//
// 핵심 규칙(출력 사분면 하나 기준, 나머지는 회전):
//   E 를 중심으로 3×3 이웃 A B C / D E F / G H I 와 바깥 고리(A1 B1 C1 C4 F4 I4 I5 H5 G5 G0 D0 A0)를 본다.
//   우하 사분면은 F·H 가 만드는 대각 에지를 검사한다:
//     e = d(E,C) + d(E,G) + d(I,H5) + d(I,F4) + 4·d(H,F)     (E–I 대각 에지가 없다는 증거)
//     i = d(H,D) + d(H,I5) + d(F,I4) + d(F,B) + 4·d(E,I)     (E–I 대각 에지가 있다는 증거)
//   e < i 이고 E 가 F·H 어느 쪽과도 같지 않으면, E3 을 F/H 중 E 에 가까운 색과 절반 섞는다.
// 알파를 색 거리에 강하게 넣어 투명 배경과의 외곽선도 같은 규칙으로 부드러워진다.
// 섞기는 프리멀티플라이드로 해 투명 가장자리에 검은 테가 생기지 않게 한다.

const Y_WEIGHT = 48;
const U_WEIGHT = 7;
const V_WEIGHT = 6;
const A_WEIGHT = 48;

/** 두 픽셀(RGBA 0..255)의 xBR 거리. YUV 가중 + 알파. */
function distance(p, q) {
  const dy = Math.abs((p[0] * 299 + p[1] * 587 + p[2] * 114) / 1000 - (q[0] * 299 + q[1] * 587 + q[2] * 114) / 1000);
  const du = Math.abs((p[0] - p[2]) - (q[0] - q[2]));
  const dv = Math.abs((-p[0] - p[1] * 2 + p[2] * 3) / 4 - (-q[0] - q[1] * 2 + q[2] * 3) / 4);
  const da = Math.abs(p[3] - q[3]);
  return dy * Y_WEIGHT + du * U_WEIGHT + dv * V_WEIGHT + da * A_WEIGHT;
}

function equal(p, q) {
  return p[0] === q[0] && p[1] === q[1] && p[2] === q[2] && p[3] === q[3];
}

/** 프리멀티플라이드 50% 혼합. 투명 픽셀은 색이 0 이라 어두운 테를 만들지 않는다. */
function blendHalf(p, q) {
  const pa = p[3] / 255;
  const qa = q[3] / 255;
  const a = (pa + qa) / 2;
  if (a <= 0) return [0, 0, 0, 0];
  return [
    Math.round((p[0] * pa + q[0] * qa) / 2 / a),
    Math.round((p[1] * pa + q[1] * qa) / 2 / a),
    Math.round((p[2] * pa + q[2] * qa) / 2 / a),
    Math.round(a * 255),
  ];
}

/**
 * RGBA 이미지를 2배로 키운다. 이미지 밖은 **가장자리 픽셀을 복제**해 본다(표준 xBR 경계 처리).
 * 투명으로 보면 셀 경계에 닿은 그림(칸에 잘린 검 끝 등)의 모서리가 반투명으로 둥글려져 원본에
 * 없던 테가 생긴다(실측). 셀 단위로 돌리면 인접 셀은 보이지 않으므로 한 셀을 어디에 놓고 키워도
 * 같은 결과가 나온다 — idle 스트립 프레임 0 == 시트 idle 칸 계약이 4배에서도 성립하는 근거다.
 */
export function xbr2x(width, height, data) {
  const out = new Uint8Array(width * 2 * height * 2 * 4);
  const at = (x, y) => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    const i = (cy * width + cx) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const put = (x, y, p) => {
    const i = (y * width * 2 + x) * 4;
    out[i] = p[0];
    out[i + 1] = p[1];
    out[i + 2] = p[2];
    out[i + 3] = p[3];
  };

  /**
   * 사분면 하나를 계산한다. 인자는 그 사분면 기준으로 회전한 이웃이다:
   *   E 중심, F 오른쪽, H 아래, I 우하, B 위, D 왼쪽, C 우상, G 좌하,
   *   F4/I4 = F/I 의 오른쫽, H5/I5 = H/I 의 아래.
   */
  const quadrant = (E, B, C, D, F, G, H, I, F4, I4, H5, I5) => {
    if (equal(E, F) || equal(E, H)) return E;
    const e = distance(E, C) + distance(E, G) + distance(I, H5) + distance(I, F4) + 4 * distance(H, F);
    const i = distance(H, D) + distance(H, I5) + distance(F, I4) + distance(F, B) + 4 * distance(E, I);
    if (e >= i) return E;
    const px = distance(E, F) <= distance(E, H) ? F : H;
    return blendHalf(E, px);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const A = at(x - 1, y - 1);
      const B = at(x, y - 1);
      const C = at(x + 1, y - 1);
      const D = at(x - 1, y);
      const E = at(x, y);
      const F = at(x + 1, y);
      const G = at(x - 1, y + 1);
      const H = at(x, y + 1);
      const I = at(x + 1, y + 1);
      const A0 = at(x - 2, y - 1);
      const D0 = at(x - 2, y);
      const G0 = at(x - 2, y + 1);
      const A1 = at(x - 1, y - 2);
      const B1 = at(x, y - 2);
      const C1 = at(x + 1, y - 2);
      const C4 = at(x + 2, y - 1);
      const F4 = at(x + 2, y);
      const I4 = at(x + 2, y + 1);
      const G5 = at(x - 1, y + 2);
      const H5 = at(x, y + 2);
      const I5 = at(x + 1, y + 2);
      // 우하(E3): 그대로. 우상(E1): 세로 뒤집기(B↔H, C↔I, A↔G, 바깥 고리도). 좌하(E2): 가로 뒤집기.
      // 좌상(E0): 둘 다. 각 사분면은 "그 방향의 대각 이웃" 이 I 자리에 오게 회전한다.
      const E3 = quadrant(E, B, C, D, F, G, H, I, F4, I4, H5, I5);
      const E1 = quadrant(E, H, I, D, F, A, B, C, F4, C4, B1, C1);
      const E2 = quadrant(E, B, A, F, D, I, H, G, D0, G0, H5, G5);
      const E0 = quadrant(E, H, G, F, D, C, B, A, D0, A0, B1, A1);
      put(x * 2, y * 2, E0);
      put(x * 2 + 1, y * 2, E1);
      put(x * 2, y * 2 + 1, E2);
      put(x * 2 + 1, y * 2 + 1, E3);
    }
  }
  return { width: width * 2, height: height * 2, data: out };
}

/** 셀 격자 이미지를 셀 단위로 `factor`배(2의 거듭제곱) 키운다. 셀은 서로 보이지 않는다(경계는 자기 픽셀 복제). */
export function upscaleCells(image, cellWidth, cellHeight, factor) {
  if (factor < 2 || (factor & (factor - 1)) !== 0) throw new Error(`배율은 2의 거듭제곱이어야 한다: ${factor}`);
  const columns = image.width / cellWidth;
  const rows = image.height / cellHeight;
  if (!Number.isInteger(columns) || !Number.isInteger(rows)) {
    throw new Error(`이미지 ${image.width}×${image.height} 가 셀 ${cellWidth}×${cellHeight} 로 나누어지지 않는다`);
  }
  const outCellW = cellWidth * factor;
  const outCellH = cellHeight * factor;
  const out = new Uint8Array(outCellW * columns * outCellH * rows * 4);
  const outWidth = outCellW * columns;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let cell = { width: cellWidth, height: cellHeight, data: new Uint8Array(cellWidth * cellHeight * 4) };
      for (let y = 0; y < cellHeight; y += 1) {
        const src = ((row * cellHeight + y) * image.width + column * cellWidth) * 4;
        cell.data.set(image.data.subarray(src, src + cellWidth * 4), y * cellWidth * 4);
      }
      for (let scale = 1; scale < factor; scale *= 2) cell = xbr2x(cell.width, cell.height, cell.data);
      for (let y = 0; y < outCellH; y += 1) {
        const dst = ((row * outCellH + y) * outWidth + column * outCellW) * 4;
        out.set(cell.data.subarray(y * outCellW * 4, (y + 1) * outCellW * 4), dst);
      }
    }
  }
  return { width: outWidth, height: outCellH * rows, data: out };
}
