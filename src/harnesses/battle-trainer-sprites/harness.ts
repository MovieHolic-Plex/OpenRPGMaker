import { defineHarness } from "../_core/manifest";

/** 포켓몬식 전투 트레이너 앞/뒷모습 그림 — 몬스터 종 하네스와 같은 생성형 이미지 → 격자 도트화 → 사람 선택. */
export const BATTLE_TRAINER_SPRITES_HARNESS = defineHarness({
  id: "battle-trainer-sprites",
  title: "전투 트레이너 스프라이트 (생성형 → 도트화)",
  summary:
    "전투 화면용 트레이너 그림(상대 앞모습·내 뒷모습)을 만든다. 몬스터 수집 전용 그림체 샘플을 참고 이미지로 이미지 서버(god-tibo-imagen)가 역할별 새 인물을 그리고, "
    + "monster-collect-species 의 격자 검출·도트화로 64×64 투명 PNG 로 정리한다(가장자리 닿음·색 수·마젠타 잔점 검사). 사용자가 시트에서 고른 것만 굽는다. 사람 선택 경로이며 object-gate 영수증은 없다. 던지기 프레임은 아직 없음.",
  scope: {},
  triggers: [
    "전투 화면에 트레이너(사람) 그림이 필요할 때 — 포켓몬식 트레이너 앞모습·뒷모습",
    "소스 그림 색만 바꾸는 편집이나 Actor1 변형은 폐기 — 생성형 이미지 → 도트화 + 사용자 선택",
    "걷기 칩(RM2000 CharSet) 제작은 charset-actor, 몬스터 전투 그림은 monster-collect-species 하네스",
  ],
  seed: "harness-data/battle-trainer-sprites/seed.json",
  doc: "openwiki/harnesses/battle-trainer-sprites.md",
  stages: [
    { id: "list", title: "역할 목록", summary: "역할(주인공 남·녀 앞/뒤, 상대 트레이너)과 brief 를 보여 준다." },
    { id: "draw", title: "후보 그리기", summary: "역할당 후보 5안을 이미지 서버가 생성하고 격자 도트화·64×64 검사를 통과한 것만 남긴다." },
    { id: "status", title: "현황", summary: "판·후보 상태와 사용자가 고른 기록." },
    { id: "sheet", title: "고르기 시트", summary: "참고 샘플 옆에 같은 배율로 나란히, 전투 합성 미리보기 포함 자체완결 HTML 을 ~/claude-viz 에 쓴다." },
    { id: "pick", title: "고르기 기록", summary: "사용자가 고른 역할=글자를 현재 그림 해시에 묶어 기록한다." },
    { id: "bake", title: "번들 굽기", summary: "고른 후보만 public/assets/battle-trainers/<역할>/ 와 index.json 으로 굽는다. 고르기 전에는 거절한다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
