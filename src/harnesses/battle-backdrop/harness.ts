import { defineHarness } from "../_core/manifest";

/** 측면 전투 배경 — 전투가 벌어지는 맵을 참고 그림으로 생성형 이미지 → 맵 팔레트 도트화 → 사람이 고름 → 트룹/맵에 설치. */
export const BATTLE_BACKDROP_HARNESS = defineHarness({
  id: "battle-backdrop",
  title: "측면 전투 배경 (맵 캡처 → 생성형 → 도트화)",
  summary:
    "전투가 벌어지는 맵 영역을 그려 시간·빛·장소 낱말·칩셋 팔레트를 기록하고, 그 캡처를 참고 그림으로 이미지 서버(god-tibo-imagen)가 측면 전투 배경 후보를 그린다. "
    + "후보는 320×180 격자·맵 팔레트(+덧색 8)로 디더링 없이 도트화해 640×360(2배)로 저장한다. 크기·색 수·바닥 띠·밝기 기계 검사와 그림 판정자(인물·글자·낮밤·시점)를 거친 뒤 "
    + "사람이 시트에서 고른 것만(화소 해시에 묶임) 프로젝트 자원으로 넣고 트룹 또는 맵의 전투 배경으로 건다. 생성형 그림은 전투 배경에 한해 사용자가 2026-10-29 허용했다.",
  scope: {},
  triggers: [
    "전투 배경이 장소와 안 맞을 때(밤 편의점 전투에 낮 풀밭 등) — 그 맵을 보고 맞는 측면 전투 배경을 만든다",
    "트룹·맵의 전투 배경을 새로 그려 설치할 때. 바이옴 기본 배경(battle-scenery-*) 고르기만이면 하네스가 필요 없다",
    "편집기 조수는 generate_battle_backdrop 도구로 같은 핵심(src/editor/battleBackdropCore.ts)을 써서 한 장을 만든다",
  ],
  seed: "harness-data/battle-backdrop/seed.json",
  doc: "openwiki/harnesses/battle-backdrop.md",
  stages: [
    { id: "capture", title: "맵 캡처", summary: "프로젝트·맵(또는 트룹으로 전투 맵 찾기)·칸 둘레를 이벤트 없이 그리고 시간·빛·장소 낱말·칩셋 팔레트를 기록한다." },
    { id: "produce", title: "후보 생성", summary: "캡처를 참고 그림으로 측면 전투 배경 후보 N장(기본 4)을 생성하고 바로 도트화한다. 후보마다 구도를 바꾼다." },
    { id: "pixelize", title: "도트화", summary: "16:9 자르기 → 맵 팔레트+덧색 양자화(디더링 없음) → 블록 최빈값 320×180 → 외톨이 점 청소 → 2배 저장." },
    { id: "check", title: "기계 검사·판정", summary: "크기·색 수·바닥 띠 무늬·밝기 + 그림 판정자(인물·글자·낮밤·같은 장소·측면·도트). 통과는 합격이 아니다." },
    { id: "sheet", title: "고르기 시트", summary: "~/claude-viz/battle-backdrop-<이름>.html — 캡처 옆 후보 1배·3배·전투 무대 미리보기·검사표." },
    { id: "pick", title: "사람 선택", summary: "사람이 고른 후보를 현재 도트 화소 해시에 묶는다. 감독·에이전트는 고르지 않는다." },
    { id: "build", title: "설치", summary: "고른 그림을 kind=backdrop 자원으로 넣고 트룹 previewBackgroundResourceId 또는 맵 battleBackground 에 건다. SQLite 폴더는 저장 후 다시 읽어 확인한다." },
    { id: "status", title: "현황", summary: "판별 후보·검사·선택·설치 상태." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: true },
});
