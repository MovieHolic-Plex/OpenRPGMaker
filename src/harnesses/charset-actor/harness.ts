import { defineHarness } from "../_core/manifest";

export const CHARSET_ACTOR_HARNESS = defineHarness({
  id: "charset-actor",
  title: "RM2000 캐릭터 GIF 공방",
  summary: "GPT 6.1 sol high가 자유롭게 도트를 만들고 사람이 걷는 GIF를 보며 남기기/폐기한다. 결손만 자동 차단하며 남긴 캐릭터만 다운로드한다.",
  scope: {},
  triggers: ["에디터용 24×32 캐릭터를 변형·대량 저작하거나 머리 잘림·투명 결손을 검사하고 CharSet 팩을 만들 때"],
  seed: "harness-data/charset-actor/briefs.json",
  doc: "openwiki/harnesses/charset-actor.md",
  stages: [
    { id: "ingest", title: "원본 입력", summary: "원본 칩을 저장하고 실제 캐릭터 칸과 수정 강도를 정한다." },
    { id: "produce", title: "자유 대량 저작", summary: "--count 100 [--reference 원본.png] [--prompt 방향]으로 자유 저작을 시작한다. 작업은 터미널과 독립적으로 계속된다." },
    { id: "bulk", title: "묶음 저작", summary: "manifest를 읽어 GPT high 원샷 저작과 독립 검수를 실행한다. --detach로 드라이버를 유지한다." },
    { id: "check", title: "픽셀 검사", summary: "12프레임 구조·색 키·투명 구멍·머리 결손·걸음 동작을 검사한다." },
    { id: "views", title: "그림 굽기", summary: "현재 격자 해시에 결부한 PNG·GIF·필름 띠를 만든다." },
    { id: "audit", title: "투명 결손 QA", summary: "--run RUN으로 모든 12프레임을 체커·흰색·검정 배경에서 펼치고 결손 좌표·출하 PNG 재읽기를 기록한다. --refresh-previews로 동일 픽셀의 진단 GIF를 추가한다." },
    { id: "walk-qa", title: "걷기 전파 전후 QA", summary: "--run RUN --out 저장소밖경로로 실제 격자를 보존하고 새 걷기의 픽셀 출처·12프레임·PNG/GIF 전후를 재읽는다." },
    { id: "verify", title: "계약 확인", summary: "임시 저장 대상에서 결손·GIF·사람의 선택 해시·패킹과 이전 검수 계약을 확인한다." },
    { id: "export", title: "선택 팩", summary: "자유 저작은 사람이 남긴 캐릭터만 ZIP으로 묶는다. 기존 검수 실행은 이전 계약을 유지한다." },
    { id: "status", title: "현황", summary: "저작 진행과 검수 판정을 표시한다." },
    { id: "serve", title: "GIF 공방", summary: "자동 걷기 GIF 갤러리·남기기/폐기·일시 정지/재개·선택 팩 다운로드 화면을 연다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
