import { defineHarness } from "../_core/manifest";

/**
 * 공용 던전·동굴 칩셋 beodeul_dungeon(계열 oprn-atlas — 버들항과 같은 계열, 16px, 3/4 시점) 후보 하네스.
 * 그림은 생성 이미지가 아니라 행 문자열 격자로 화소를 직접 찍은 코드 손 도트다(rounds/<판>.py).
 * 감독·에이전트는 고르지 않는다 — 사람이 시트에서 고른 글자만 그림 해시에 묶어 기록한다. 번들에 굽지 않는다.
 */
export const DUNGEON_CHIPSET_HARNESS = defineHarness({
  id: "dungeon-chipset",
  title: "던전 칩셋 도트 (beodeul_dungeon · oprn-atlas)",
  summary:
    "저작권 정리 뒤 비어 있는 던전·동굴 칩셋을 버들항(beodeul_city)과 같은 계열 oprn-atlas 로 만든다. "
    + "던전은 컨셉이 여럿이라 화풍을 하나로 고정하지 않고 줄(line) 셋 — A 해안 흙굴·B 산속 바위굴·C 검푸른 심층굴(style-r1 의 글자) — 마다 따로 고른다. "
    + "버들항 던전 변형 조각에서 뽑은 잠금 팔레트 → 판(rounds/<판>.py) 줄마다 후보 <줄><번호>(불규칙 동굴 벽·바닥 오토타일, 물·용암·얼음 가장자리, 계단·문·함정·상자·횃불) "
    + "→ 기계 관문(P 팔레트·Z 크기·Q 불투명·O 윤곽·F 윗면·S 이음·G 구조, WARN R) → 버들항 조각·Actor1 옆 고르기 시트 → 사람이 (항목, 줄)마다 pick/reject(그림 해시에 묶임). "
    + "관문 통과는 합격이 아니다. 고른 것은 harness-data/dungeon-chipset/picked/<줄>/ 까지만 가고 번들 굽기·타일셋 배선은 별도 작업이다.",
  scope: {},
  triggers: [
    "던전·동굴·지하묘지·수로·화산굴·얼음굴 맵에 쓸 공용 칩셋 조각(불규칙 바위 벽·천장·바닥 오토타일, 물·용암·얼음 가장자리, 다리, 계단, 문·창살문, 기둥, 횃불, 상자, 함정, 지렛대, 뼈·수정·뿌리)을 새로 그리거나 후보를 다시 낼 때",
    "던전 칩셋 후보를 사람이 줄(A 해안 흙굴·B 산속 바위굴·C 검푸른 심층굴)마다 고르게 하거나, 고른 기록이 지금 그림과 맞는지 확인할 때",
    "버들항 도시 칩셋(beodeul_city) 자체의 건물·마을 조각에는 쓰지 않는다 — beodeul-architecture / beodeul-building-review",
    "조선·무림·jp_city·modern 계열 칩셋에는 쓰지 않는다 — 타일셋마다 별도 하네스",
  ],
  seed: "harness-data/dungeon-chipset/seed.json",
  doc: "openwiki/harnesses/dungeon-chipset.md",
  stages: [
    { id: "palette", title: "팔레트 뽑기", summary: "버들항 변형 조각에서 램프별 실제 화소색(밝기 구간 최빈값)을 뽑아 palette.json 을 다시 쓰고 공용 시트에 있는지 대조한다(--check 는 비교만)." },
    { id: "validate", title: "시드 점검", summary: "시드 항목(묶음·크기·층·통행·기준 그림)·줄(lines, 뺀 항목과 이유)·계열 oprn-atlas·Actor1·팔레트 최신·판 모듈 후보(줄마다 빠짐없이, 키 <줄><번호>)·후보 코드의 hex 색 금지를 점검한다." },
    { id: "list", title: "항목 목록", summary: "묶음(style·cave·edges·built·deco)별 시드 항목. 줄마다 ★A = 사람이 고른 것 중 지금 그림과 해시가 맞는 것, -A = 그 줄에서 뺀 항목." },
    { id: "draw", title: "후보 그리기", summary: "판 모듈의 후보를 그려 qa-runs/harnesses/dungeon-chipset/<판>/ 에 1배·8배·장면 PNG 와 manifest.json(해시)을 쓴다." },
    { id: "gate", title: "기계 관문", summary: "P 팔레트 잠금·Z 크기·Q 불투명(오토타일 47 변형·앞면 조합)·O 윤곽·F 윗면·S 이음(6×6 반복)·G 동굴 구조(FAIL), R 색만 바꾼 후보(WARN). 통과는 합격이 아니다." },
    { id: "sheet", title: "고르기 시트", summary: "후보 1배·4배·장면을 버들항 던전 조각·Actor1 옆에 줄별로 놓고(고른 것은 ★ 줄 표시) 줄별 장면·팔레트까지 담은 자체완결 HTML 을 ~/claude-viz/dungeon-<판>.html 에 쓴다(관문 FAIL 이면 안 쓴다)." },
    { id: "pick", title: "고르기(사람)", summary: "사람이 시트에서 고른 후보(화풍 판은 줄 글자, 이후 판은 <줄><번호>)를 시트 때 해시(--sha 앞자리)와 현재 그림 해시로 대조해 ledger.json 에 (항목, 줄)마다 기록하고 picked/<줄>/<항목>.png 로 복사한다." },
    { id: "reject", title: "버리기(사람)", summary: "사람이 버린 후보와 이유를 그림 해시와 함께 기록한다(다음 판의 「하지 말 것」)." },
    { id: "status", title: "현황", summary: "판별 그림·관문·시트 유무와 줄별·묶음별 고른 것(현재 해시와 맞는지)을 보여 준다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
