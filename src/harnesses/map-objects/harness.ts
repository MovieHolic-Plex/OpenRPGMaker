import { defineHarness } from "../_core/manifest";

/**
 * 맵 기물(16px, 아무 칩셋). 조수의 「없는 타일」 카드에서 「직접 그려 줘」를 누르면 열린다 — 지금 맵 칩셋에 없는 물건을
 * 그 칩셋의 색·화풍으로 그리고, 사람이 고른 것을 그 칩셋 끝에 굽는다. 손 도트 실내 맵은 interior-props 가 맡는다.
 */
export const MAP_OBJECTS_HARNESS = defineHarness({
  id: "map-objects",
  title: "공방 · 맵 기물 (16px, 지금 맵 칩셋)",
  summary:
    "지금 맵의 칩셋(16px)에 없는 물건(나무·바위·간판·조각상·바닥 무늬…)을 그 칩셋에서 뽑은 팔레트와 닮은 물체를 기준으로 새로 찍는다. "
    + "후보 3장 → 기계 검사 → 독립 검수(화풍·읽힘·3/4) → 최대 3번 다시 그린 뒤 사람이 고르고, 고른 것을 그 칩셋에 굽는다.",
  scope: {},
  triggers: [
    "조수가 필요한 타일이 없다고 물었고 사용자가 스토어 대신 「직접 그려 줘」를 골랐을 때(손 도트 실내가 아닌 맵)",
    "에디터 사용자가 지금 맵 칩셋에 물건 하나를 자기 AI 계정으로 그려 넣고 싶을 때(왼쪽 막대 「공방」)",
  ],
  seed: "src/harnesses/map-objects/editor/prompts.ts",
  doc: "openwiki/harnesses/map-objects.md",
  stages: [
    { id: "draw", title: "후보 그리기", summary: "기물 하나에 후보 3장(방향 A~C). 팔레트는 그 칩셋 색, 기준은 그 칩셋의 닮은 물체·시트 조각." },
    { id: "review", title: "독립 검수", summary: "다른 대화의 vision 모델이 화풍(STYLE)·읽힘(READ)·3/4(FRONT·TOPDOWN)·배경(BG)을 본다." },
    { id: "pick", title: "고르고 굽기", summary: "사람이 고르면 그 칩셋 끝에 칸을 붙이고 물체(workshop:…)를 만든다. 조수는 stamp_tileset_object 로 놓는다." },
  ],
  entrypoints: { cli: false, editorUi: true, assistantTool: false },
  workshop: () => import("./editor/runner").then((m) => m.createMapObjectRunner()),
});
