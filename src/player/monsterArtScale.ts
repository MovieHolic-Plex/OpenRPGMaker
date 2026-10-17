// 몬스터 도트 그림의 정수 배율 표시(픽셀 격자 계약, 시각 QA D12 · 2026-10-16).
// 화면 480×320 = GBA 240×160 의 정확히 2배라서 논리 화소 1 = 화면 2px 이다. 그림 한 도트가 화면에서 항상 2px 의 정수배가 되어야 타일·글꼴과 도트 크기가 섞이지 않는다.
// 전투 몬스터 상자는 128×128(= 64 캔버스 × 2)이다. 그림 캔버스가 64 이하면 2배(128), 112 같은 큰 캔버스는 상자에 들어가는 가장 큰 정수 배율(1배 = 112)로 그린다.
// 비정수 배율(예전 112→128 = 1.14배)은 도트 폭이 1px·2px 로 들쭉날쭉해진다.

/** 몬스터 표시 상자(화면 px). 64 캔버스 × 2배. */
export const MONSTER_ART_BOX = 128;

export interface MonsterArtBox {
  readonly scale: number;
  readonly width: number;
  readonly height: number;
}

/** 캔버스 크기 → 상자 안에 들어가는 최대 정수 배율과 표시 크기. 알 수 없거나 상자보다 큰 그림은 1배. */
export function integerArtBox(naturalWidth: number, naturalHeight: number, box: number = MONSTER_ART_BOX): MonsterArtBox {
  const longest = Math.max(naturalWidth, naturalHeight);
  if (!Number.isFinite(longest) || longest <= 0) return { scale: 2, width: box, height: box };
  const scale = Math.max(1, Math.floor(box / longest));
  return { scale, width: naturalWidth * scale, height: naturalHeight * scale };
}

/**
 * 몬스터 `<img>` 가 불러와지면 표시 크기를 정수 배율로 정한다(`--art-box-width/height`, `data-art-scale`).
 * CSS 는 변수가 없으면 128px 로 그린다. 그림이 이미 있으면 바로, 아니면 load 에서 정한다.
 */
export function bindIntegerArtScale(image: HTMLImageElement, box: number = MONSTER_ART_BOX): void {
  const apply = (): void => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const fit = integerArtBox(image.naturalWidth, image.naturalHeight, box);
    image.style.setProperty("--art-box-width", `${fit.width}px`);
    image.style.setProperty("--art-box-height", `${fit.height}px`);
    image.dataset.artScale = String(fit.scale);
  };
  if (image.complete && image.naturalWidth) apply();
  else image.addEventListener("load", apply, { once: true });
}
