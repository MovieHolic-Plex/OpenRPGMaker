import { defineHarness } from "../_core/manifest";

/** 포켓몬식 전투 트레이너 앞/뒷모습·볼 던지기 그림 — Actor1(EasyRPG RTP) 변형, 생성 이미지 아님. */
export const BATTLE_TRAINER_SPRITES_HARNESS = defineHarness({
  id: "battle-trainer-sprites",
  title: "전투 트레이너 스프라이트 (Actor1 변형)",
  summary:
    "전투 화면용 트레이너 그림(상대 앞모습·내 뒷모습·볼 던지기 3장)을 만든다. Actor1(EasyRPG RTP, CC BY 4.0) 캐릭터를 출발점으로 Agy 의 Gemini 4 Argon Medium 이 "
    + "64×64 행 문자열 격자를 직접 찍어 변형한다(이미지 생성 도구 금지). 크기·색 수·발 위치·덩어리 검사를 통과한 후보만 시트에 오르고, 사용자가 시트에서 고른 것만 굽는다. 사람 선택 경로이며 object-gate 영수증은 없다.",
  scope: {},
  triggers: [
    "전투 화면에 트레이너(사람) 그림이 필요할 때 — 포켓몬식 트레이너 앞모습·뒷모습·볼 던지기 동작",
    "트레이너를 몬스터처럼 생성 이미지로 뽑거나 직접 그리지 않는다 — Actor1 변형 + 사용자 선택",
    "걷기 칩(RM2000 CharSet) 제작은 charset-actor, 몬스터 전투 그림은 monster-collect-species 하네스",
  ],
  seed: "harness-data/battle-trainer-sprites/seed.json",
  doc: "openwiki/harnesses/battle-trainer-sprites.md",
  stages: [
    { id: "list", title: "역할 목록", summary: "12역할(주인공 남·녀 뒷모습, 상대 트레이너 10종)과 Actor1 원본 블록을 보여 준다." },
    { id: "draw", title: "후보 그리기", summary: "역할당 후보 5안을 Argon 이 격자로 찍고 기계 검사(64×64·색·발 위치·덩어리)를 통과한 것만 남긴다. 뒷모습은 볼 던지기 3프레임까지." },
    { id: "status", title: "현황", summary: "판·후보 상태와 사용자가 고른 기록." },
    { id: "sheet", title: "고르기 시트", summary: "Actor1 원본 옆에 같은 배율으로 나란히, 전투 배경 합성 미리보기 포함 자체완결 HTML 을 ~/claude-viz 에 쓴다." },
    { id: "pick", title: "고르기 기록", summary: "사용자가 고른 역할=글자를 현재 그림 해시에 묶어 기록한다." },
    { id: "bake", title: "번들 굽기", summary: "고른 후보만 public/assets/battle-trainers/<역할>/ 와 index.json 으로 굽는다. 고르기 전에는 거절한다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
