import { defineHarness } from "../_core/manifest";

/**
 * 손 도트 실내 기물(16px, interior-chipset). 파이썬 하네스(harness.py·web/)는 이 서버의 작업자용이고,
 * 에디터 「공방」은 editor/ 의 실행기로 사용자 계정 모델이 같은 흐름을 돈다. 칩셋 굽기는 2단계.
 */
export const INTERIOR_PROPS_HARNESS = defineHarness({
  id: "interior-props",
  title: "슈퍼하네싱 · 실내 기물 (16px)",
  summary:
    "실내 칩셋(interior-chipset, 48칸 폭)의 가구·소품을 3/4 시점(꼭대기 윗면 3행 이상 + 남쪽 면)으로 다시 찍거나 새로 정의한다. "
    + "후보 5장을 다른 방향으로 그리고 기계 검사 → 자기 점검 → 독립 검수(꼭대기 면 규칙) → 최대 3번 다시 그린 뒤 사람이 고른다.",
  scope: {},
  triggers: [
    "실내 맵의 가구·소품(책장·옷장·벽난로·진열장·궤짝…)이 정면도라 3/4 로 안 읽힌다는 지적이 있을 때",
    "실내 칩셋에 없는 기물을 새로 만들어야 할 때(이름·설명·칸 수를 정의)",
    "에디터 사용자가 자기 AI 계정으로 기물 후보를 뽑아 고르고 싶을 때(왼쪽 막대 「공방」)",
  ],
  seed: "src/assets/handInteriorSpec.json",
  doc: "openwiki/harnesses/interior-props.md",
  stages: [
    { id: "draw", title: "후보 그리기", summary: "기물 하나에 후보 5장(방향 A~E). 깨지면 고치기 2번, 자기 점검 1번." },
    { id: "review", title: "독립 검수", summary: "다른 대화의 vision 모델이 3/4·「지금보다 나빠졌나」를 본다. 가구는 꼭대기 윗면 3행 미만이면 FRONT." },
    { id: "pick", title: "고르기", summary: "사람이 고르거나 이유를 붙여 버린다. 버린 이유는 다음 판의 「하지 말 것」이 된다." },
  ],
  entrypoints: { cli: false, editorUi: true, assistantTool: false },
  workshop: () => import("./editor/runner").then((m) => m.createInteriorRunner()),
});
