// project/dialoguePortraitPosition.ts
// 흉상·전신 초상이 화면에 있는 대사는 대사창이 **항상 아래**다 (2026-10-17, vn-bust-bottom-1).
//
// 왜: 흉상은 화면 아래에서 올라와 창 옆에 서는 그림이라, 창이 위·가운데에 있으면 초상이 공중에 뜨거나 창 반대편 빈 곳에 걸린다.
// 위·가운데 설정은 지우지 않는다 — 초상이 없는 대사(48px 얼굴·나레이션·선택지 없는 독백)는 저작한 위치를 그대로 쓴다.
// 결정은 이 파일 한 곳이다. 플레이어(src/player/dialogue.ts) · 편집기 안내문 · 조수 도구 설명이 같은 문구와 같은 함수를 본다.
import type { MessageWindowPosition } from "./types";

/** 대사에 실린 초상 종류. face = 48px 작은 얼굴(창 안), bust = 흉상, full = 전신. */
export type DialoguePortraitMode = "face" | "bust" | "full";

/** 흉상·전신이 있으면 창을 아래로 강제한다. 작은 얼굴은 창 안에 있으니 해당 없다. */
export function portraitForcesBottom(mode: DialoguePortraitMode): boolean {
  return mode === "bust" || mode === "full";
}

/** 저작한 위치에 초상 규칙을 겹친 최종 위치. */
export function positionWithPortrait(position: MessageWindowPosition, mode: DialoguePortraitMode): MessageWindowPosition {
  return portraitForcesBottom(mode) ? "bottom" : position;
}

/** 편집기 · 조수 도구가 위치 설정 곁에 보이는 한 줄. 문구를 바꾸면 i18n 카탈로그 키도 같이 바꾼다. */
export const PORTRAIT_BOTTOM_NOTICE = "흉상이 있는 대사는 항상 아래에 나옵니다. 위·가운데는 흉상 없는 대사에만 적용됩니다.";
/** 도구 설명용 문장형. */
export const PORTRAIT_BOTTOM_RULE = "흉상·전신 초상이 있는 대사는 이 설정과 상관없이 대사창이 항상 아래에 나온다(초상 없는 대사만 설정을 따른다).";
