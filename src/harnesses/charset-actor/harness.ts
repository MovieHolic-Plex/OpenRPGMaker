import { defineHarness } from "../_core/manifest";

export const CHARSET_ACTOR_HARNESS = defineHarness({
  id: "charset-actor",
  title: "RM2000 캐릭터 칩 저작과 검수",
  summary: "GPT 6.1 sol high가 격자를 직접 편집하고 Sonnet medium이 독립 검수한다. 12프레임 결손과 판정/렌더 해시를 검사하며 통과한 후보만 패킹한다. 사용자 선택 화면은 별도 서버다.",
  scope: {},
  triggers: ["에디터용 24×32 캐릭터를 변형·대량 저작하거나 머리 잘림·투명 결손을 검사하고 CharSet 팩을 만들 때"],
  seed: "harness-data/charset-actor/briefs.json",
  doc: "openwiki/harnesses/charset-actor.md",
  stages: [
    { id: "ingest", title: "원본 입력", summary: "원본 칩을 저장하고 실제 캐릭터 칸과 수정 강도를 정한다." },
    { id: "bulk", title: "묶음 저작", summary: "manifest를 읽어 GPT high 원샷 저작과 독립 검수를 실행한다. --detach로 드라이버를 유지한다." },
    { id: "check", title: "픽셀 검사", summary: "12프레임 구조·색 키·투명 구멍·머리 결손·걸음 동작을 검사한다." },
    { id: "views", title: "그림 굽기", summary: "현재 격자 해시에 결부한 PNG·GIF·필름 띠를 만든다." },
    { id: "verify", title: "계약 확인", summary: "별도 임시 저장 대상에서 픽셀·걸음 전파·검수·렌더·잠금·패킹·폐기 계약 94개를 확인한다." },
    { id: "export", title: "검수 팩", summary: "최신 검수 합격만 CharSet과 ZIP으로 패킹한다. --discard-failed는 불량을 후보 밖에 보관한다." },
    { id: "status", title: "현황", summary: "저작 진행과 검수 판정을 표시한다." },
    { id: "serve", title: "후보 화면", summary: "비교·받기/버리기·진행 화면을 별도 서버로 연다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
