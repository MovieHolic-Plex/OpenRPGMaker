import { defineHarness } from "../_core/manifest";

/**
 * 시대별 상호작용 오브젝트(상자·옷장·서랍·항아리·파괴·던전 기믹·현대·조선·SF·무림·스팀펑크)
 * 멀티프레임 PNG 스트립 100종 제작·검사·시트·굽기 하네스.
 *
 * 런타임 코드 화소 자르기(openStatePixels) 대신 4~5프레임 가로 PNG 스트립 + 카탈로그 JSON 으로
 * 일회성 열기(oneshot)·토글(toggle)·박살(break)·점화/가동 루프(loopAfterOpen)를 데이터로 구동한다.
 */
export const INTERACTIVE_PROPS_HARNESS = defineHarness({
  id: "interactive-props",
  title: "상호작용 오브젝트 멀티프레임 PNG (100종)",
  summary:
    "판타지·던전/기믹·파괴·현대·조선·무림·SF·스팀펑크 7개 시대의 상호작용 오브젝트 100종을 "
    + "4~5프레임 가로 PNG 스트립과 카탈로그(src/assets/interactivePropsCatalog.json)로 제작·검수·배포한다. "
    + "시드 100종(웨이브 8회차) → PNG 스트립 수집/제작 → 기계 관문(프레임 폭 배수·투명 여백·순흑 외곽선 경고·프레임 변화량) "
    + "→ GIF 검수 시트 → 해시에 묶인 승인(pick) → public/assets/harnesses/interactive-props/ 및 카탈로그 굽기(build).",
  scope: {},
  triggers: [
    "상자·궤짝·옷장·서랍·통·항아리·자루·자판기·냉장고·반닫이·장독·레버·트랩도어·비밀 책장·화로 등 상호작용 오브젝트의 멀티프레임 열기/박살/기믹/점화 PNG 스트립을 만들거나 늘릴 때",
    "100종 상호작용 오브젝트 시드의 진행 현황을 보거나, 기계 검사·GIF 검수 시트·승인(pick)·번들 카탈로그 굽기(build)를 돌릴 때",
  ],
  seed: "harness-data/interactive-props/seed.json",
  doc: "openwiki/harnesses/interactive-props.md",
  stages: [
    { id: "validate", title: "시드 점검", summary: "100종 시드의 id·시대·동작·재생모드·프레임 규격·효과음 id와 중복 여부를 검사한다." },
    { id: "list", title: "목록 조회", summary: "웨이브·시대·동작별 100종 항목과 현재 승인(★)·굽기 상태를 출력한다." },
    { id: "gate", title: "기계 관문", summary: "가로 PNG 스트립의 크기(frameWidth*frames × frameHeight), 알파 여백, 프레임 간 픽셀 변화량, 1프레임 정지/결손을 검사한다." },
    { id: "sheet", title: "GIF 검수 시트", summary: "웨이브별 애니메이션 GIF 와 정지 프레임 분해 시트를 qa-runs/harnesses/interactive-props/ 에 생성한다." },
    { id: "pick", title: "승인 기록", summary: "검수 통과한 스트립 PNG 를 SHA-256 해시에 묶어 ledger.json 과 picked/ 에 기록한다." },
    { id: "build", title: "카탈로그 굽기", summary: "승인된 스트립을 public/assets/harnesses/interactive-props/<id>.png 로 복사하고 src/assets/interactivePropsCatalog.json 을 생성한다." },
    { id: "status", title: "현황", summary: "시대·웨이브별 시드 수, 승인 완료 수, 번들 굽기 수를 집계한다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
