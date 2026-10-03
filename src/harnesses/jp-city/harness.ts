import { defineHarness } from "../_core/manifest";

/** 번들 타일셋 jp_city(modern3, 16px, 3/4 시점)의 주택가·역·공원·신사 그림 후보 하네스. 생성 이미지가 아니라 손 도트(pxgrid)다. */
export const JP_CITY_HARNESS = defineHarness({
  id: "jp-city",
  title: "일본 도시 칩셋 도트 (jp_city · modern3)",
  summary:
    "번들 타일셋 jp_city 에 넣을 주택가·역·공원·신사 그림(건물 부품·소품·바닥 타일·여러 칸 키트) 후보를 3/4 시점으로 찍는다. "
    + "항목마다 작업자 5명이 다른 방향으로 pxgrid 램프 격자에 한 글자씩 놓고, 기계 검사와 독립 검수를 거친 뒤 사람이 고른다. "
    + "고른 결과는 harness-data/jp-city/picked/ 까지만 남기고, 시트에 굽는 일은 scripts/content/jp-city/bake_jp.py 가 한다. 다른 타일셋은 별도 하네스다.",
  scope: {},
  triggers: [
    "jp_city 번들 타일셋의 주택가·역·공원·신사 그림(단독주택·아파트·담·승강장·개찰구·도리이·고마이누·배전·벚나무 등)을 새로 그리거나 다시 그릴 후보가 필요할 때",
    "jp_city 에 들어갈 건물 부품·소품·바닥 타일·키트를 사람이 후보 중에서 고르게 하고 싶을 때",
    "modern3 가 아닌 타일셋(조선·포켓몬풍·버들항 판타지·modern4 현대 거리)에는 쓰지 않는다 — 타일셋마다 별도 하네스",
  ],
  seed: "harness-data/jp-city/seed.json",
  doc: "openwiki/harnesses/jp-city.md",
  stages: [
    { id: "palette", title: "팔레트", summary: "modern3 램프(28개·154색)에서 pxgrid 팔레트(palette.pal)와 재료 글자표(mats.txt)를 다시 쓴다." },
    { id: "validate", title: "시드 점검", summary: "시드 항목의 크기·슬롯·칸·조립 예·참고 그림 해석을 점검한다." },
    { id: "list", title: "항목 목록", summary: "묶음(houses·station·park·shrine)별 시드 항목과 고른 것을 보여 준다." },
    { id: "draw", title: "후보 그리기", summary: "항목 하나에 후보 5장을 백그라운드로 그린다(작업자 → 기계 검사 → 독립 검수 → 최대 3번 다시 그림)." },
    { id: "status", title: "현황", summary: "판과 후보의 상태·검수 결과를 보여 준다." },
    { id: "sheet", title: "고르기 시트", summary: "참고 그림·후보·맥락(조립 예·반복)을 한 장에 놓은 자체완결 HTML 을 ~/claude-viz 에 쓴다." },
    { id: "review", title: "다시 검수", summary: "이미 그린 판을 참고 그림 옆에서 다시 독립 검수한다." },
    { id: "pick", title: "고르기", summary: "사용자가 고른 후보를 기록하고 picked/<항목>.pxg|png 로 복사한다(굽기와 다음 판의 이웃 기준이 된다)." },
    { id: "reject", title: "버리기", summary: "사용자가 버린 후보와 이유를 기록한다(다음 판의 '하지 말 것')." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
