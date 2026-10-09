import { defineHarness } from "../_core/manifest";

/**
 * 무림(중국 무협) 공용 칩셋 murim_wuxia(계열 oprn-murim, 16px, 3/4 시점) 후보 하네스.
 * 그림은 생성 이미지가 아니라 행 문자열 격자로 화소를 직접 찍은 코드 손 도트다(rounds/<판>.py).
 * 화풍은 컨셉 줄(line: A 밝은 문파 · B 강남 무관)마다 따로 간다 — 이후 판은 줄마다 후보(A1 A2 B1 B2)를 그리고,
 * 줄의 화풍 기준은 style-r1 의 그 글자 조각이다.
 * 감독·에이전트는 고르지 않는다 — 사람이 시트에서 고른 후보만 그림 해시에 묶어 (항목, 줄)마다 기록한다. 번들에 굽지 않는다.
 */
export const MURIM_CHIPSET_HARNESS = defineHarness({
  id: "murim-chipset",
  title: "무림 칩셋 도트 (murim_wuxia · oprn-murim)",
  summary:
    "중국 무협 배경 공용 칩셋 murim_wuxia 의 객잔·누각 뼈대·객잔 살림·도장·바깥(산문·대숲·석등) 조각 후보를 코드 손 도트로 찍는다. "
    + "잠긴 팔레트(청회색 유약 기와·주칠·황토·흰 회벽·짙은 나무·소나무·청석·대나무·금, 7단 램프, joseon_baram 과 밝기 호환) → "
    + "화풍 판 style-r1(후보 글자 = 컨셉 줄) 뒤로는 줄(A 밝은 문파·B 강남 무관)마다 후보 A1·A2·B1·B2 를 그 줄 style 조각과 같은 색·결로 그린다. "
    + "판(rounds/<판>.py) → 기계 관문(P·Z·Q·O·F·S·R·J 조각 맞물림·Y 줄 재료·G 바닥 닿음·K 탁자·걸상 배치 견본, 경고 T·L·N) → 조선 조각·줄 기준 조각·Actor1 옆 고르기 시트 → 사람이 (항목, 줄)마다 pick/reject(그림 해시에 묶임) 순서. "
    + "관문 통과는 합격이 아니다. 고른 것은 harness-data/murim-chipset/picked/<줄>/ 까지만 가고 번들 굽기는 별도 작업이다.",
  scope: {},
  triggers: [
    "무림·무협·중국풍 칩셋(murim_wuxia) 의 바닥·벽·지붕·문·계단·객잔 가구·도장 기물·산문·대숲·석등 같은 조각을 새로 그리거나 후보를 다시 낼 때",
    "무림 칩셋 후보를 사람이 줄(A 밝은 문파·B 강남 무관)마다 고르게 하거나, 고른 기록이 지금 그림과 맞는지 확인할 때",
    "조선(joseon_baram)·jp_city·버들항·modern 계열 칩셋에는 쓰지 않는다 — 타일셋마다 별도 하네스",
  ],
  seed: "harness-data/murim-chipset/seed.json",
  doc: "openwiki/harnesses/murim-chipset.md",
  stages: [
    { id: "validate", title: "시드 점검", summary: "시드 줄(lines)·항목(크기·종류·층·반복·조선 기준 조각·세트 조각과 맞물림)·판 모듈(후보 키: 화풍 판은 글자, 이후 판은 줄마다 <줄><번호> 2개 이상)·금지 조항·팔레트 호환을 점검한다." },
    { id: "palette", title: "팔레트 보고", summary: "잠긴 팔레트의 램프 단별 밝기를 joseon_baram 범위와 대조하고 가장 가까운 조선 램프를 보여 준다(파일을 쓰지 않는다)." },
    { id: "list", title: "항목 목록", summary: "묶음(style·frame·inn·dojo·outdoor)별 시드 항목. 줄마다 ★ 는 사람이 고른 것 중 지금 그림과 해시가 맞는 것." },
    { id: "draw", title: "후보 그리기", summary: "판 모듈의 후보를 그려 qa-runs/harnesses/murim-chipset/<판>/ 에 1배·8배 PNG 와 manifest.json(해시)을 쓴다." },
    { id: "gate", title: "기계 관문", summary: "P 팔레트 잠금·Z 크기·Q 불투명 계약·O 먹 윤곽·F 윗면 행·S 반복 이음·R 색만 바꾼 후보·J 세트 조각 맞물림·Y 줄 재료·G 바닥 닿음(걸상·가구 발이 칸 아래 경계)·K 배치 견본(탁자+걸상 layout: 화소 일치·좌우 앉는 면 = 탁자 윗면 가운데 ±2px·뒤 걸상 절반 이상 보임·앞 걸상 2~4px)(FAIL), T 가는 줄·L 빛·N 1px 잡티(WARN). 줄별로 센다. 통과는 합격이 아니다." },
    { id: "sheet", title: "고르기 시트", summary: "후보를 줄별로 묶어 1배·4배·반복·조립 보기로, 조선 같은 용도 조각·그 줄 화풍 기준 조각·Actor1 옆에 놓고 줄별 장면(판 모듈의 scenes — frame 6×5, inn 8×6 객잔 홀)까지 담은 자체완결 HTML 을 ~/claude-viz/murim-<판>.html 에 쓴다(관문 FAIL 이면 안 쓴다). 고른 후보에 ★ 줄 표시." },
    { id: "pick", title: "고르기(사람)", summary: "사람이 고른 후보를 시트 때 해시와 대조해 (항목, 줄)마다 ledger.json 에 기록하고 picked/<줄>/<항목>.png 로 복사한다. 화풍 판은 후보 글자 = 줄, 이후 판은 <줄><번호>. 그림이 바뀌면 그 기록은 무효." },
    { id: "reject", title: "버리기(사람)", summary: "사람이 버린 후보와 이유를 기록한다(다음 판의 「하지 말 것」)." },
    { id: "status", title: "현황", summary: "판별 그림·관문·시트 유무와 줄별·묶음별 고른 것(현재 해시와 맞는지)을 보여 준다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
