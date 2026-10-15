import { defineHarness } from "../_core/manifest";

/** 포켓몬식 전투 트레이너 앞/뒷모습 그림 — 몬스터 수집 전용 전투 인물 64×64 의 국소 편집, 생성 이미지 아님. */
export const BATTLE_TRAINER_SPRITES_HARNESS = defineHarness({
  id: "battle-trainer-sprites",
  title: "전투 트레이너 스프라이트 (몬스터 수집 전용 그림 편집)",
  summary:
    "전투 화면용 트레이너 그림(상대 앞모습·내 뒷모습)을 만든다. 소스는 몬스터 수집 캠페인 전용 전투 인물 64×64(Actor1 아님)이고, Agy 의 Gemini 4 Argon Medium 이 "
    + "64×64 격자 행 문자열을 직접 국소 편집한다(이미지 생성 도구 금지, 변경 셀 ≤40%·실루엣 ≤10% 검사). 사용자가 시트에서 고른 것만 굽는다. 사람 선택 경로이며 object-gate 영수증은 없다.",
  scope: {},
  triggers: [
    "전투 화면에 트레이너(사람) 그림이 필요할 때 — 포켓몬식 트레이너 앞모습·뒷모습 (던지기 프레임은 아직 없음)",
    "트레이너를 생성 이미지로 새로 뽑지 않는다 — 몬스터 수집 전용 소스 편집 + 사용자 선택",
    "걷기 칩(RM2000 CharSet) 제작은 charset-actor, 몬스터 전투 그림은 monster-collect-species 하네스",
  ],
  seed: "harness-data/battle-trainer-sprites/seed.json",
  doc: "openwiki/harnesses/battle-trainer-sprites.md",
  stages: [
    { id: "list", title: "역할 목록", summary: "역할과 소스 그림(몬스터 수집 전투 인물) 대응을 보여 준다." },
    { id: "draw", title: "후보 그리기", summary: "역할당 후보 5안을 Argon 이 소스 격자의 국소 편집으로 쓰고 변경량 검사(셀 ≤40%·실루엣 ≤10%·새 색 ≤8)를 통과한 것만 남긴다." },
    { id: "status", title: "현황", summary: "판·후보 상태와 사용자가 고른 기록." },
    { id: "sheet", title: "고르기 시트", summary: "원본 옆에 같은 배율으로 나란히, 전투 배경 합성 미리보기 포함 자체완결 HTML 을 ~/claude-viz 에 쓴다." },
    { id: "pick", title: "고르기 기록", summary: "사용자가 고른 역할=글자를 현재 그림 해시에 묶어 기록한다." },
    { id: "bake", title: "번들 굽기", summary: "고른 후보만 public/assets/battle-trainers/<역할>/ 와 index.json 으로 굽는다. 고르기 전에는 거절한다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
