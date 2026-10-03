import { defineHarness } from "../_core/manifest";

/**
 * 번들 타일셋 joseon_baram(조선·바람의나라풍, 16px, 3/4 시점) 조각·지도 제작 하네스.
 * 새 도구가 아니라 scripts/content/lib/joseon/ 의 기존 도구(팔레트 잠금·게이트·판정·적대 검수·빌더·재굽기)를 한 입구로 묶는다.
 */
export const JOSEON_BARAM_HARNESS = defineHarness({
  id: "joseon-baram",
  title: "조선 칩셋 도트 (joseon_baram · 바람의나라풍)",
  summary:
    "번들 타일셋 joseon_baram 의 조선 조각(기와집·초가·문루·담·나무·소품·다리)과 지도(마을 20호·국내성·국내성 원작 규모)를 만드는 기존 도구를 한 입구로 묶는다. "
    + "팔레트 잠금 검사 → 조각 관문(P·E·T·L·S·A·K·TR·V) → 눈으로 본 판정(조각 해시에 묶임) → 지도 관문 → 재굽기 → 16구역 적대 검수 순서로 간다. "
    + "그림은 코드 도트(tk.py·blocks.py)로만 그리고 생성 이미지·생성 캐릭터(Actor1 을 쓴다)·바람의나라 스크린샷 커밋은 금지다. "
    + "다른 타일셋(버들항·jp_city·modern4)은 별도 하네스다.",
  scope: {},
  triggers: [
    "조선(바람의나라풍) 타일셋 joseon_baram 의 조각(기와집·초가·문루·정자·담·성벽·나무·소품·다리)을 새로 그리거나 고친 뒤 게이트·판정을 돌릴 때",
    "조선 마을 20호·국내성·국내성 원작 규모 지도를 다시 굽거나(지도 관문 M1~M7) 번들 시트·타일셋·참고문서를 재생성(rebuild-joseon.sh)할 때",
    "조선 지도·조각을 독립 리뷰어(조선다움·3/4)에게 16구역 크롭으로 적대 검수시킬 때",
    "버들항·jp_city·modern4·포켓몬풍 등 joseon_baram 이 아닌 타일셋에는 쓰지 않는다 — 타일셋마다 별도 하네스",
  ],
  seed: "harness-data/joseon-baram/seed.json",
  doc: "openwiki/harnesses/joseon-baram.md",
  stages: [
    { id: "palette", title: "팔레트 잠금 검사", summary: "palette.json 이 램프 합집합과 같고(허용 색 밖 없음) 시드의 색 수와 맞는지 본다. 파일을 쓰지 않는다." },
    { id: "validate", title: "시드·메타 점검", summary: "시드 구조, 시드가 가리키는 파일, 조각 메타 분류, 지도 관문 임계 대조, 바람의나라 스크린샷 추적 여부를 점검한다(--deep 은 카탈로그와 판정 목록 대조)." },
    { id: "list", title: "조각·지도 목록", summary: "조각(분류·기록된 판정·적대 리뷰 기록)과 지도(크기·산출물)를 보여 준다. 해시 신선도는 gate 가 판단한다." },
    { id: "gate", title: "조각 관문", summary: "조각 관문 P·E·T·L·S·A·K·TR·V 를 돌린다(--candidate 는 A 만 건너뜀, --sheets 는 기준 옆 검수 시트, --piece 로 좁힘)." },
    { id: "verdict", title: "판정 기록", summary: "검수 시트를 눈으로 본 뒤 조각마다 한 줄 판정(pass·note·user·redo)을 현재 해시에 묶어 기록한다(verdict.py)." },
    { id: "build", title: "재굽기", summary: "rebuild-joseon.sh 로 번들 시트·타일셋·참고문서·저장 증명·장소 카드를 다시 만든다(--dry 는 계획과 입력 점검만, 약 70초)." },
    { id: "map", title: "지도 빌드", summary: "지도 빌더(demo20·demo_gungnae·demo_gungnae_full)를 돌려 지도 관문 M1~M7 을 통과해야 산출한다(--dry 는 계획만)." },
    { id: "review", title: "적대 검수 묶음", summary: "지도를 4x4 = 16구역 원 해상도 크롭으로 자르고(zones) 조각 6배 그림·기준 시트(pieces)를 만들어 렌즈 두 개(조선다움·3/4) 프롬프트와 함께 묶는다. record 로 리뷰어 출력을 해시에 묶어 기록한다." },
    { id: "status", title: "현황", summary: "팔레트·판정·적대 리뷰·번들 산출물·기록(ledger) 현황. --fresh 는 게이트를 돌려 현재 해시 기준으로 센다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
