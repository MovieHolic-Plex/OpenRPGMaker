import { defineHarness } from "../_core/manifest";

export const WORLDMAP_ICONS_HARNESS = defineHarness({
  id: "worldmap-icons",
  title: "월드맵 아이콘",
  summary: "아이콘 검수·사람 선택·해시 확인·공용 월드맵 시트 굽기",
  scope: {},
  triggers: ["월드맵 아이콘", "세계 지도 건물", "월드맵 아이콘 선택·굽기"],
  seed: "harness-data/worldmap-icons/seed.json",
  doc: "openwiki/harnesses/worldmap-icons.md",
  stages: [
    { id: "intake", title: "후보 준비", summary: "세트 원본을 단품·지도 자리 그림으로 준비한다." },
    { id: "review", title: "검수", summary: "시점 계약에 따라 독립 검수자를 돌린다. 사람 선택을 대신하지 않는다." },
    { id: "draw", title: "다시 그리기", summary: "사용자의 교정 지시로 후보 판을 연다." },
    { id: "serve", title: "선택 화면", summary: "받기·버리기·후보 고르기 화면을 연다." },
    { id: "status", title: "현황", summary: "세트별 검수·사람 선택 현황을 읽는다." },
    { id: "export", title: "선택 사본", summary: "현재 그림에 유효한 선택·검수 기록을 내보낸다." },
    { id: "build", title: "공용 시트 굽기", summary: "사람이 받은 원본·후보만 해시를 확인해 굽는다. 칸 번호는 덧붙이기 전용이다." },
    { id: "check", title: "굽기 확인", summary: "선택 기록·원본 해시·칸 좌표·번들 PNG·참고문서를 대조한다." },
    { id: "publish-shared", title: "공용 DB 등록", summary: "선택 시트와 정본 지형 사례를 호스트 공용 SQLite에 등록하고 같은 판본을 다시 읽는다." },
    { id: "preview", title: "후보 미리보기", summary: "후보의 크기·색표와 실제 지도 자리를 확인한다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
