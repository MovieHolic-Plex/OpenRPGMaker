export const RECOLLECTION_BGM_ID = "cc0-bgm-rtp-emo-001";
export const RECOLLECTION_PICTURE_ID = "pic_memory";
export const RECOLLECTION_TINT = "#c4a070";
// 예전 기본 `easyrpg-picture-cloud` 는 2026-10-07 저작권 정리로 그림이 지워졌다 — 컷신 검증이 「존재하지 않는 리소스」로 막아
// 회상·오프닝 템플릿 전체가 실패했다(ci-full 40165485978). 같은 구름 그림인 OPRN 자체 파노라마 층을 쓴다.
export const DEFAULT_RECOLLECTION_PICTURE_RESOURCE_ID = "oprn-pano-clouds";

export type RecollectionBeatsInput = {
  readonly speaker: string;
  readonly lines: readonly string[];
  readonly pictureResourceId?: string;
  readonly bgmResourceId?: string;
};

export type RecollectionBeat =
  | { readonly kind: "fade"; readonly direction: "in" | "out"; readonly durationMs: number; readonly wait: true }
  | { readonly kind: "tint"; readonly color: string; readonly durationMs: number; readonly wait: true }
  | { readonly kind: "music"; readonly action: "bgm"; readonly resourceId: string; readonly loop: true }
  | { readonly kind: "music"; readonly action: "stop" }
  | {
      readonly kind: "picture";
      readonly action: "show";
      readonly pictureId: string;
      readonly resourceId: string;
      readonly x: number;
      readonly y: number;
      readonly durationMs: number;
      readonly wait: true;
    }
  | { readonly kind: "picture"; readonly action: "erase"; readonly pictureId: string }
  | { readonly kind: "say"; readonly speaker: string; readonly text: string }
  | { readonly kind: "wait"; readonly ms: number };

export function recollectionBeats(input: RecollectionBeatsInput): RecollectionBeat[] {
  const pictureResourceId = input.pictureResourceId?.trim() || DEFAULT_RECOLLECTION_PICTURE_RESOURCE_ID;
  const bgmResourceId = input.bgmResourceId?.trim() || RECOLLECTION_BGM_ID;
  const beats: RecollectionBeat[] = [
    { kind: "fade", direction: "out", durationMs: 400, wait: true },
    { kind: "music", action: "bgm", resourceId: bgmResourceId, loop: true },
    { kind: "tint", color: RECOLLECTION_TINT, durationMs: 500, wait: true },
    {
      kind: "picture",
      action: "show",
      pictureId: RECOLLECTION_PICTURE_ID,
      resourceId: pictureResourceId,
      x: 32,
      y: 24,
      durationMs: 400,
      wait: true,
    },
    { kind: "wait", ms: 250 },
  ];
  for (const [index, line] of input.lines.entries()) {
    beats.push({ kind: "say", speaker: input.speaker, text: line });
    if (index < input.lines.length - 1) beats.push({ kind: "wait", ms: 350 });
  }
  beats.push(
    { kind: "picture", action: "erase", pictureId: RECOLLECTION_PICTURE_ID },
    { kind: "tint", color: "neutral", durationMs: 400, wait: true },
    { kind: "fade", direction: "in", durationMs: 400, wait: true },
    { kind: "music", action: "stop" },
  );
  return beats;
}
