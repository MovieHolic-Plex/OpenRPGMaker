import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
  type CharsetFrameSelection,
} from "@/assets/easyrpgRtp";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";

/**
 * 캐릭터 그림(charset) 시트에서 프레임 한 칸을 요소에 픽셀 단위로 정확히 맞춘다.
 *
 * 두 가지를 못박기 때문에 이 헬퍼를 거치지 않는 크롭을 만들면 안 된다:
 *  - `box-sizing: content-box` — 전역 리셋이 border-box 라서 인라인 크기를 그대로 두면
 *    테두리만큼 패딩 박스(=배경 배치 영역)가 줄어 프레임 오른쪽·아래가 잘린다.
 *  - `background-clip: padding-box` — 배경 배치 영역은 패딩 박스인데 그리는 범위 기본값은
 *    테두리 박스라, 테두리 아래로 **이웃 프레임 픽셀**이 드러난다. Monster3(몬스터 3)처럼
 *    셀 경계에 불투명 픽셀이 닿는 시트에서 프레임 위에 위 행 프레임의 하단이 보였다.
 */
export function applyCharsetFrameCrop(
  target: HTMLElement,
  imagePath: string,
  selection: CharsetFrameSelection,
  scale = 1
): void {
  target.style.boxSizing = "content-box";
  target.style.backgroundClip = "padding-box";
  target.style.backgroundRepeat = "no-repeat";
  target.style.width = `${CHARSET_FRAME_WIDTH * scale}px`;
  target.style.height = `${CHARSET_FRAME_HEIGHT * scale}px`;
  applyTransparentColorKeyBackground(target, imagePath);
  target.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${
    CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale
  }px`;
  target.style.backgroundPosition = charsetFrameCropPosition(selection, scale);
}

/** 같은 시트의 다른 프레임 배경 위치 — 걷기 애니메이션 CSS 변수에 넣는 값. */
export function charsetFrameCropPosition(selection: CharsetFrameSelection, scale = 1): string {
  const source = charsetFrameSource(selection);
  return `-${source.x * scale}px -${source.y * scale}px`;
}
