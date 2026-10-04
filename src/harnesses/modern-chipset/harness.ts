import { defineHarness } from "../_core/manifest";

/** 도쿄·현대 거리(modern4 팔레트) 탈것 도트 — 장르와 무관한 칩셋 제작 하네스. 생성 이미지가 아니라 손 도트(pxgrid)다. */
export const MODERN_CHIPSET_HARNESS = defineHarness({
  id: "modern-chipset",
  title: "현대 칩셋 도트 (modern4)",
  summary:
    "modern4 팔레트 현대 거리 칩셋의 기물·건물·타일을 3/4 시점으로 찍는다. 현재 지원 종류는 탈것(vehicle)이고 소품·건물·바닥 타일로 넓힌다. "
    + "프로젝트 안에서 받아들여진 그림을 기준으로, 작업자 5명이 다른 방향으로 pxgrid 에 한 픽셀씩 놓고 기계 검사와 독립 검수를 거친 뒤 사람이 고른다. "
    + "다른 타일셋(조선·포켓몬풍 야외 등)은 별도 하네스다.",
  scope: {},
  triggers: [
    "modern4 팔레트 현대 거리/도시 칩셋에 자동차·버스·트럭·열차 같은 탈것(그리고 앞으로 소품·건물·바닥 타일)이 필요할 때",
    "기존 탈것 도트가 순수 옆모습이라 3/4(윗면이 면으로 보임)이 안 지켜진다는 지적이 있을 때",
    "modern4 가 아닌 다른 타일셋(조선·포켓몬풍·버들항 판타지)에는 쓰지 않는다 — 타일셋마다 별도 하네스",
  ],
  seed: "harness-data/modern-chipset/seed.json",
  doc: "openwiki/harnesses/modern-chipset.md",
  stages: [
    { id: "save-parking-project", title: "주차장 정본 저장", summary: "선택한 공용 키트를 새 SQLite 프로젝트에 저장하고 재로드·통행을 확인한다." },
    { id: "publish-parking", title: "선택한 주차장 등록", summary: "현재 검수·선택 해시의 주차장 표본을 두 층 키트와 공용 참고문서로 굽는다." },
    { id: "palette", title: "팔레트", summary: "modern4 램프에서 탈것 전용 pxgrid 팔레트(palette.pal)를 다시 쓴다." },
    { id: "draw", title: "후보 그리기", summary: "탈것·시점 하나에 후보 5장을 백그라운드로 그린다(작업자 → 기계 검사 → 독립 검수 → 최대 3번 다시 그림)." },
    { id: "status", title: "현황", summary: "판과 후보의 상태·검수 결과를 보여 준다." },
    { id: "sheet", title: "고르기 시트", summary: "기준 경찰차·지금 것·후보를 나란히 놓은 자체완결 HTML 을 ~/claude-viz 에 쓴다." },
    { id: "review", title: "다시 검수", summary: "이미 그린 판을 기준차 옆에서 다시 독립 검수한다." },
    { id: "pick", title: "고르기", summary: "사용자가 고른 후보를 기록하고 picked/ 로 복사한다(다음 판의 화풍 기준이 된다)." },
    { id: "reject", title: "버리기", summary: "사용자가 버린 후보와 이유를 기록한다(다음 판의 '하지 말 것')." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
