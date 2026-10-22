import { defineHarness } from "../_core/manifest";

/**
 * 버들항식 부품 조립 건물 하네스 — 테마 넷(중세 판타지 왕국 · 사막 오아시스 · 설원 북방 · 버들항 귀족 구역).
 * 건물은 한 장짜리 그림이 아니라 잠긴 팔레트 + 재사용 부품(지붕·벽 칸·창·문·기단·층 띠·굴뚝·탑·현관)을 조립해 만든다.
 * 그림은 행 문자열 격자로 화소를 직접 찍은 코드 손 도트(rounds/<테마>/<판>.py)이고, 그리는 쪽(Opus 그리기 프로세스)과
 * 판정하는 쪽(독립 Opus 검수 프로세스, 숨긴 함정)이 다르다. 감독·에이전트는 고르지 않는다 — 사람이 시트에서 고른 것만
 * 그림 해시에 묶어 기록하고, 번들·타일셋에 굽는 일은 별도 작업이다(AGENTS.md 「새 타일·타일 학습은 공용에」).
 */
export const BUILDING_KIT_HARNESS = defineHarness({
  id: "building-kit",
  title: "테마 건물 부품 조립 (버들항 계열 oprn-atlas)",
  summary:
    "버들항(beodeul_city)과 같은 계열 oprn-atlas 의 16px 3/4 탑뷰 건물을 테마 넷(중세 판타지 왕국·사막 오아시스·설원 북방·버들항 귀족 구역)에 "
    + "부품 조립으로 만든다. 테마마다 잠긴 팔레트(공유 램프는 버들항 실화소에서 뽑고, 테마 램프는 버들항 출처 또는 밝기 범위 안의 손 램프) → "
    + "줄(line) 셋의 화풍 판 style-r1(부품 최소 세트 + 조립 건물 둘) → 기계 관문(P 팔레트·Z 크기·Q 불투명·F 윗면 띠·S 반복 이음·J 세트 이음·"
    + "Y 줄 재료·G 바닥 닿음 + 조립 A1~A11, WARN OUTLINE·CONTRAST·T·L·N) → 독립 Opus 검수(숨긴 함정 통과 시 회차 무효, 유효 3회 다수결) → "
    + "사람이 시트에서 (항목, 줄)마다 pick/reject(그림 해시에 묶임) → 사람이 고른 부품으로 조립한 건물만 object-gate 3/4 영수증(kind structure) → "
    + "village 로 그 줄의 건물을 길·마당·광장이 있는 마을에 놓는다. "
    + "관문 통과는 합격이 아니다. 번들 굽기·타일셋 배선·참고문서는 사람이 고른 뒤의 별도 작업이다.",
  scope: {},
  triggers: [
    "버들항 계열 테마 건물(중세 판타지 왕국·사막 오아시스·설원 북방·버들항 귀족 구역)의 지붕·벽 칸·창·문·기단·층 띠·굴뚝·탑·현관 부품 후보를 새로 그리거나 다시 낼 때",
    "같은 테마 건물을 부품 교체로 크기·용도 변형(작은 집·긴 집·여관·대장장이·길드·교회·성문탑)으로 늘릴 때",
    "테마 건물 후보를 사람이 시트에서 줄마다 고르게 하거나, 고른 부품으로 조립한 건물이 지금 그림과 맞는지 확인할 때",
    "새 건물 그림을 번들·공용 DB·스토어에 넣기 전 3/4 관문(object-gate kind structure) 영수증을 확인할 때 — 부품은 조립 건물 영수증으로 덮인다",
    "기존 버들항 건물 원본의 국소 보정에는 쓰지 않는다 — beodeul-architecture / beodeul-building-review",
    "테마 건물을 마을 단위로 놓아 접지·길·문 방향·건물끼리 어울림을 볼 때",
  ],
  seed: "harness-data/building-kit/fantasy-kingdom/seed.json",
  doc: "openwiki/harnesses/building-kit.md",
  stages: [
    { id: "palette", title: "팔레트 뽑기", summary: "테마 팔레트를 다시 뽑는다 — 공유 램프(잔디·포석·기단 돌·나무·쇠)는 버들항 실제 화소에서, 테마 램프는 seed 출처(버들항 칸·조각) 또는 손 램프(단마다 버들항 같은 단 밝기 ±0.04 안). --check 는 비교만." },
    { id: "validate", title: "시드 점검", summary: "테마 넷 seed(규칙·줄·부품 세트 pieces/joins·조립 레시피·판 모듈 후보 키·팔레트 최신·Actor1·기준 그림)를 점검한다. 판 모듈이 아직 없으면 「그리기 전」으로 보고한다." },
    { id: "list", title: "항목 목록", summary: "테마·줄별 부품 세트와 조립 레시피. 줄마다 ★ = 사람이 고른 것(현재 그림과 해시가 맞을 때), - = 그 줄에서 뺀 항목." },
    { id: "draw", title: "후보 그리기", summary: "판 모듈 후보를 그려 qa-runs/harnesses/building-kit/<테마>/<판>/ 에 1배·4배·부품 PNG 와 manifest.json(해시)을 쓴다. --agent 는 (줄, 후보)마다 새 Opus 그리기 프로세스를 띄운다." },
    { id: "dry", title: "후보 한 장 미리보기", summary: "후보 하나를 그려 관문과 조립 결과를 그대로 보여 준다 — 그리기 에이전트가 스스로 고칠 때 쓰는 입구." },
    { id: "gate", title: "기계 관문", summary: "부품마다 P 팔레트·Z 크기·Q 불투명·F 윗면 띠·S 반복 이음·J 세트 이음·G 바닥 닿음(Y 줄 재료), 같은 항목 후보끼리 R, WARN OUTLINE·CONTRAST·T·L·N. FAIL 이 있으면 검수·시트로 가지 않는다." },
    { id: "assemble", title: "조립", summary: "조립 레시피대로 부품을 붙여 building.png·kit.json(칸 격자 lower/upper·walkGrid·door)을 만들고 조립 관문 A1~A11(문 하나·지붕/벽 틈 없음·지붕이 벽을 덮음·기단이 바닥에 닿음·맞닿은 조각 이음·지붕 비율이 버들항 실측 밴드 안·용마루 하한·같은 땅 행·탑 지붕 폭/재료)을 건다." },
    { id: "review", title: "독립 검수", summary: "관문을 통과한 조립 건물만. 버들항 기준 건물 + 섞인 후보 + 숨긴 함정(지붕/벽 틈·문 둘·평면 채우기·잡음·얇은 지붕 입면·색만 바꾼 원본) 보드를 새 Opus 판정자에게 보인다. 함정을 하나라도 통과시키면 그 회차 무효, 유효 3회 다수결, 영수증은 그림 해시+판정 원문 해시에 묶인다." },
    { id: "sheet", title: "고르기 시트", summary: "검수 PASS 후보만 버들항 기준 건물·Actor1·1배/3배·조립 건물·거리 장면과 함께 ~/claude-viz/bk-<테마>-<판>.html 자체완결 시트로 쓴다(--show-failed 는 실패 사유와 함께 회색)." },
    { id: "pick", title: "고르기(사람)", summary: "사람이 시트에서 고른 후보를 시트 때 해시(--sha 앞 8자리)와 현재 그림 해시로 대조해 ledger.json 에 (항목, 줄)마다 기록하고 picked/<줄>/<항목>.png 로 복사한다. 에이전트 대리 선택 경로는 없다." },
    { id: "reject", title: "버리기(사람)", summary: "사람이 버린 후보와 이유를 그림 해시와 함께 기록한다(다음 판의 「하지 말 것」)." },
    { id: "objgate", title: "3/4 관문 영수증", summary: "사람이 고른 부품으로 조립한 건물마다 object-gate require_pass(kind structure, context bundle)를 받는다. 부품은 조립 건물 영수증으로 덮인다. 영수증이 없으면 「3/4 관문 미통과」." },
    { id: "village", title: "마을 놓기", summary: "그 줄의 조립 건물(검수 PASS 영수증이 지금 그림 해시와 맞는 것만, --all 은 전부)을 테마 팔레트 색만으로 그린 잔디(북방은 눈) 바닥·구불구불한 길·광장·우물·나무 위에 놓는다. 문은 길을 향하고 마당 1~2칸을 거쳐 길까지 걸어갈 수 있다(BFS 확인). 건물끼리 겹치지 않고 같은 --seed 면 같은 마을이 나온다. PNG 1배·2배와 ~/claude-viz/bk-village-<테마>-<판>-<줄>.html." },
    { id: "status", title: "현황", summary: "테마별 판·관문·검수·시트·고른 것(현재 해시와 맞는지)·3/4 영수증 유무를 보여 준다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
