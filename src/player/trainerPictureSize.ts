/** 전투 인물 그림(TroopRecord.trainerSprite·에메랄드 인물) 크기 계약. 렌더러(emeraldTrainerIntro)와 내보내기 수집기(webExportAssets)가 같이 쓴다.
 *  가로 64(화면 2배) 또는 128(화면 1배), 세로는 가로와 같거나 1.5배(옛 키 큰 그림). 화면 폭은 어느 쪽이든 128px. */
export const TRAINER_PICTURE_WIDTHS: readonly number[] = [64, 128];
export const TRAINER_DISPLAY_WIDTH = 128;

/** 64×64 · 64×96(기존 계약) + 128×128 · 128×192(큰 캔버스). */
export const isTrainerPictureSize = (width: number, height: number): boolean =>
  TRAINER_PICTURE_WIDTHS.includes(width) && (height === width || height === width * 1.5);

/** 볼 던지기 시트: 한 칸이 정사각(64 또는 128) × 2~8칸. 맞지 않으면 undefined. */
export function trainerThrowFrames(width: number, height: number): number | undefined {
  if (!TRAINER_PICTURE_WIDTHS.includes(height) || width % height !== 0) return undefined;
  const frames = width / height;
  return frames >= 2 && frames <= 8 ? frames : undefined;
}
