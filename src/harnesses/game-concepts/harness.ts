import { defineHarness } from "../_core/manifest";

export const GAME_CONCEPTS_HARNESS = defineHarness({
  id: "game-concepts",
  title: "새 게임 컨셉 카드",
  summary: "새 게임 피드의 공식 컨셉(제목·훅·기획 5칸·도트 썸네일)을 만들고, 사람이 받기/버리기로 고른 것만 스토어에 게시",
  scope: {},
  triggers: ["새 게임 컨셉", "컨셉 피드", "새 게임 썸네일", "공식 컨셉 추가"],
  seed: "harness-data/game-concepts/seed.json",
  doc: "openwiki/harnesses/game-concepts.md",
  stages: [
    { id: "produce", title: "컨셉 쓰기", summary: "시드의 분류별 목표 수만큼 AI가 컨셉 JSON 을 쓴다. 형식·금지 이름·중복을 거른다." },
    { id: "draw", title: "썸네일", summary: "컨셉마다 도트 썸네일(960×540, 480×270 webp)을 생성한다." },
    { id: "check", title: "검사", summary: "형식과 원작 닮음(금지 이름, 그림 비전 판정)을 본다. --redraw 면 실패 그림을 한 번 다시 그린다." },
    { id: "serve", title: "고르기 화면", summary: "사람이 받기/버리기를 고른다. 선택은 현재 그림 해시에 묶인다." },
    { id: "status", title: "현황", summary: "분류별 받음·버림·대기·검사 실패 수." },
    { id: "publish", title: "게시", summary: "받은 것만 스토어에 올린다. 운영은 --target prod 명시." },
    { id: "bundle", title: "비상용 번들", summary: "받은 것 중 분류마다 고르게 20개를 앱 번들로 굽는다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
