import { defineHarness } from "../_core/manifest";

export const BATTLE_MONSTER_HARNESS = defineHarness({
  id: "battle-monster",
  title: "RM2003 전투 몬스터 도트 공방",
  summary: "AI가 9자세 직접 도트 저작·검사·독립 검수·패킹을 맡고 사용자는 결과 대시보드에서 Allow/Modify/Deny를 선택한다. 수정 요청은 새 후보 제작으로 이어진다.",
  scope: {},
  triggers: [
    "일반 JRPG/RM2003 적의 native64·96 도트와 돌격·공격·피격·쓰러짐 자세를 만들거나 고칠 때",
    "몬스터 수집 앞·뒷모습은 monster-collect-species, 걷는 캐릭터 칩은 charset-actor를 쓴다",
  ],
  seed: "harness-data/battle-monster/seed.json",
  doc: "openwiki/harnesses/battle-monster.md",
  stages: [
    { id: "serve", title: "결과 선택 대시보드", summary: "사용자는 그림과 움직임을 보고 Allow/Modify/Deny만 선택한다. 선택 저장·AI 수정·검수·선택 팩은 서버에서 이어진다." },
    { id: "pilot", title: "시범 후보", summary: "기존 조선 5종의 직접 찍은 원본을 승인되지 않은 후보로 가져온다." },
    { id: "init", title: "제작 지시", summary: "종·크기·실루엣·팔레트·동작 계약을 새 후보 작업 폴더에 고정한다." },
    { id: "author", title: "직접 도트 저작", summary: "GPT 6.1 sol high로 full(9자세 완성 후보) 또는 idle/poses 단계를 저작한다. --prepare-only로 지시만 준비할 수 있다." },
    { id: "ingest", title: "원본 가져오기", summary: "명시한 팔레트와 ASCII 도트 원본을 새 후보로 가져온다. 기존 선택을 이관하지 않는다." },
    { id: "check", title: "픽셀 검사·굽기", summary: "크기·색·투명·잘림·9자세 중복과 PNG 재읽기를 검사하고 native 시트·초상·검수 보드를 굽는다." },
    { id: "critique", title: "독립 그림 검수", summary: "별도 GPT high 세션이 1×/3×·세 배경 그림을 보고 좌표별 수정 의견을 낸다. 사람 선택을 대신하지 않는다." },
    { id: "review", title: "후보 비교", summary: "종/후보·기본 자세·9자세·동작 재생·검수·선택의 현재 해시를 보여 주는 독립 HTML을 만든다." },
    { id: "decide", title: "사람 선택 기록", summary: "사용자의 명시적인 keep/rework/discard와 수정 지시를 현재 그림 해시에 묶어 저장한다." },
    { id: "pack", title: "선택 팩", summary: "현재 두 단계의 선택·독립 검수·픽셀 검사를 확인해 원본·시트·등록 메타·출처를 ZIP으로 묶는다." },
    { id: "status", title: "현황", summary: "종마다 기본 자세/9자세 제작과 검수·사람 선택이 현재 그림에 유효한지 보여 준다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
