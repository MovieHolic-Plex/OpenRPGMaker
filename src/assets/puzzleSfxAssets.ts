/**
 * JRPG 퍼즐 방 효과음 세트 — 원본 SNES(젤다 신들의 트라이포스풍) 샘플 악기 합성음(CC0).
 *
 * 만드는 법: `scripts/content/puzzle-sfx/build.py` 가 `snes.py` 의 변형 A 를 굽는다 — 코드로 합성한 악기 샘플을
 * 32 kHz·BRR·가우스 보간·ADSR·8채널·FIR 에코 경로로 재생하고, 크기는 옛 칩튠판(#3060) 게이트 RMS 에 맞춘다.
 * 녹음·원작 샘플·원작 멜로디는 쓰지 않았다. 내역·측정값은 `public/assets/puzzle-sfx/manifest.json`.
 * 퍼즐 프리셋(`puzzleKit.sfx`)이 쓴다. id·파일 이름은 칩튠판과 같다(기존 프로젝트가 그대로 새 소리를 쓴다).
 */
export const PUZZLE_SFX_CUES = [
  "secret-solved",
  "stone-push",
  "plate-press",
  "switch-clack",
  "wrong",
  "crystal-ping",
  "organ-c",
  "organ-e",
  "organ-g",
  "organ-c2",
] as const;
export type PuzzleSfxCue = (typeof PUZZLE_SFX_CUES)[number];

export const PUZZLE_SFX_TITLES: Readonly<Record<PuzzleSfxCue, string>> = {
  "secret-solved": "퍼즐 해결 징글",
  "stone-push": "바위 밀기",
  "plate-press": "발판 눌림",
  "switch-clack": "레버·스위치",
  wrong: "오답",
  "crystal-ping": "수정·판 뒤집힘",
  "organ-c": "오르간 발판 · 도",
  "organ-e": "오르간 발판 · 미",
  "organ-g": "오르간 발판 · 솔",
  "organ-c2": "오르간 발판 · 높은 도",
};

export function puzzleSfxResourceId(cue: PuzzleSfxCue): string {
  return `cc0-sound-puzzle-${cue}`;
}

export function puzzleSfxPath(cue: PuzzleSfxCue): string {
  return `assets/puzzle-sfx/${cue}.ogg`;
}
