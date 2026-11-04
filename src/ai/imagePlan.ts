// ai/imagePlan.ts
// 그림 도안 먼저 짓기(AI 설정 「그림 도안 먼저」) — 모호한 새로 짓기를 넓힌 장면(vagueWiden)을 짓기 전에 이미지 모델로 위에서 본 도안 한 장을 받아
// 조수의 첫 요청에 참고 그림(userImages)으로 싣는다. 조수는 도안의 구도를 따르되 프로젝트의 실제 칩만 쓴다.
// 근거: agent/img-room-test(2026-10-30) 도안을 보여 준 판이 기준 방 대비 12승 6무 10패. 호출(그림 생성·계정 확인)은 aiChatPanel.ts 가 한다.

export function imagePlanPrompt(widen: { readonly label: string; readonly traits: readonly string[] }): string {
  return [
    `Design a mockup of a game map: ${widen.label} (${widen.traits.join(", ")}).`,
    "Style: 16px-per-tile SNES-era JRPG map, 3/4 top-down view (tops of buildings and objects visible, short front faces, no side faces), orthographic, crisp pixel art, no perspective, no isometric angle.",
    "Show the whole place as one map screenshot seen from above: its outline, where each zone sits, the paths between them, height changes as cliffs with stairs, and one clear landmark.",
    "No people, no characters, no monsters, no text, no labels, no UI, no grid lines.",
  ].join(" ");
}

export const IMAGE_PLAN_NOTE = "[그림 도안] 짓기 전에 이 장면을 이미지 모델로 그린 도안 한 장을 함께 싣는다. 도안의 큰 구도(장소 윤곽·구역 자리·길·높낮이·랜드마크 위치)를 따르되, 칸과 물건은 이 프로젝트의 실제 칩셋 조각만 쓴다. 도안의 색·질감을 그대로 베끼지 않는다.";
export const IMAGE_PLAN_SKIPPED_LINE = "그림 도안은 건너뛰었어요 — 그림 계정이 연결돼 있지 않습니다.";
export const IMAGE_PLAN_FAILED_LINE = "그림 도안을 받지 못해 도안 없이 지을게요.";
