import { defineHarness } from "../_core/manifest";

/**
 * 슈퍼하네스 — 다른 하네스들 위의 지휘자. 조수가 모르는 공간·장소 낱말(미궁·카타콤…)을 에이전트가 스스로 찾아
 * 개념 카드(재료·구조·금지·예제 맵·그림/이벤트 구분)로 만들고, 적대 검수 2명과 조수 시험(카드 없이/붙여서)을 거쳐
 * 공용 번들 src/assets/conceptCards.json 에 굽는다. 사람은 화면(http://mdc-server:18315/)에서 큐를 보고 교정·폐기만 한다.
 * 파이썬 데몬(sh.py)은 이 서버 전용이다.
 */
export const SUPER_HARNESS = defineHarness({
  id: "super-harness",
  title: "슈퍼하네스 (개념 카드 자동 공급)",
  summary:
    "조수가 재료·구조를 모르는 낱말을 실패 로그·어휘 탐침에서 찾아 개념 카드로 만든다. 만들기·검수·판정은 codex(gpt-6.1-sol medium), "
    + "통과한 카드는 PR 로 자동 머지된다. 에디터에 없는 재료는 부족분으로 남겨 다른 하네스로 보낸다.",
  scope: {},
  triggers: [
    "조수가 특정 공간 낱말(미궁·감옥·하수도…)에서 쓸데없는 기물을 채우거나 장치를 바닥 그림으로만 칠할 때",
    "개념 카드(src/assets/conceptCards.json)를 고치거나 새로 굽고 싶을 때 — 손으로 쓰지 말고 화면에서 교정 지시",
  ],
  seed: "harness-data/super-harness/seed.json",
  doc: "openwiki/harnesses/super-harness.md",
  stages: [
    { id: "discover", title: "낱말 찾기", summary: "조수 실패 로그(검색 0건·빈칸 수리 턴)와 낱말 은행에서 다음 개념을 고른다." },
    { id: "build", title: "카드 만들기", summary: "재료(그림/이벤트)·구조·금지·예제 호출을 쓰고 새 프로젝트에서 예제가 실제로 지어질 때까지 고친다." },
    { id: "review", title: "적대 검수", summary: "서로 안 보는 검수자 2명(개념·구조 / 동작·재료). 둘 다 통과해야 다음으로." },
    { id: "probe", title: "조수 시험", summary: "같은 요청을 카드 없이 2판·붙여서 2판 돌리고 판정자가 전후 그림을 비교한다." },
    { id: "bake", title: "굽기", summary: "origin/main 위 브랜치로 번들에 넣고 PR·머지. 사람이 폐기하면 빼는 PR." },
  ],
  entrypoints: { cli: false, editorUi: false, assistantTool: false },
});
