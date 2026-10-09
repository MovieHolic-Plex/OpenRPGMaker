import { defineHarness } from "../_core/manifest";

/**
 * 타일셋 구현 하네스 — 테마 하나(`harness-data/tileset-authoring/<테마>/seed.json`)를
 * 「손 도트 조각 → 검사 → 사용자 고르기 → 시트 굽기 → 공용 번들 배선 → 검증」으로 구현한다.
 * 버들항(beodeul_city)을 구현한 순서를 일반화한 것. 그리기는 테마별 레시피가 맡고, 하네스는
 * 계약·검사·번호 등록부·굽기·배선·검증을 소유한다. 생성 이미지는 쓰지 않는다(손 도트만).
 */
export const TILESET_AUTHORING_HARNESS = defineHarness({
  id: "tileset-authoring",
  title: "타일셋 구현 (손 도트 → 공용 번들)",
  summary:
    "테마 계약(seed.json)대로 16px 손 도트 타일을 그려 후보 시트를 만들고, 자동 검사를 거쳐 사용자가 고른 것만 시트로 구워 "
    + "공용 번들(bundled.ts·defaultAssets·참고문서)까지 배선·검증한다. 첫 테마: 포켓몬풍 야외(pokemon-overworld).",
  scope: {},
  triggers: [
    "새 테마의 타일셋(바닥·길·물가·나무·울타리·집 조각)을 처음부터 만들 때",
    "포켓몬풍(젠3 느낌) 야외 맵 타일이 필요할 때 — 테마 pokemon-overworld",
    "만든 타일을 한 프로젝트 행에만 넣지 않고 공용 번들로 올릴 때(AGENTS.md 「새 타일은 공용에 추가한다」)",
  ],
  seed: "harness-data/tileset-authoring/pokemon-overworld/seed.json",
  doc: "openwiki/harnesses/tileset-authoring.md",
  stages: [
    { id: "status", title: "현황", summary: "테마별로 후보 run·고른 판·구운 시트·배선 여부를 보여 준다." },
    { id: "spec", title: "계약 검증", summary: "seed.json(칸 크기·열 수·역할·팔레트·시점)이 서로 맞는지 본다. 칸 번호 등록부와 충돌하면 실패." },
    { id: "draw", title: "그리기", summary: "테마 레시피로 조각·오토타일을 그려 후보 시트(candidate.png)·미리보기·맵 데모를 qa-runs 에 쓴다." },
    { id: "check", title: "검사", summary: "오토타일 16변형 완결, 이음새, 색 수, 투명 칸, 시점(윗면 높이)·좌우 대칭 같은 자동 검사. 통과율은 근거가 아니다." },
    { id: "pick", title: "고르기", summary: "사용자가 후보 run 을 고른다. 에이전트는 고르지 않는다." },
    { id: "bake", title: "굽기", summary: "고른 run 을 public/assets/<테마>/ 시트와 harness-data 타일셋 정의로 굽는다. 번호 등록부(ledger)는 한 번 준 번호를 바꾸지 않는다." },
    { id: "wire", title: "배선", summary: "bundled.ts · defaultAssets · ensureBundledTilesets · 참고문서 번들을 한꺼번에 연결한다. 하나라도 빠지면 실패." },
    { id: "verify", title: "검증", summary: "새 프로젝트와 기존 프로젝트 양쪽 로드, 정본 저장 후 재로드, 화소 비교." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
