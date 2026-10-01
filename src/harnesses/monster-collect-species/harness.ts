import { defineHarness } from "../_core/manifest";

/** 몬스터 수집(포켓몬류) 장르 전용 — 종의 앞·뒤 전투 스프라이트를 만든다. 일반 JRPG 적 그림과 섞지 않는다. */
export const MONSTER_COLLECT_SPECIES_HARNESS = defineHarness({
  id: "monster-collect-species",
  title: "몬스터 수집 종 스프라이트",
  summary:
    "몬스터 수집(포켓몬류) 게임의 종을 도감 시드에서 읽어 앞모습(상대)·뒷모습(내 몬스터) 전투 스프라이트와 대기·공격·피격 애니메이션을 만든다. "
    + "생성 그림 속 픽셀 격자를 찾아 진짜 도트로 옮기고, 사람이 후보를 고르며, 112 캔버스·바닥 정렬로 맞춘다.",
  scope: { genre: "monster-collect" },
  triggers: [
    "몬스터 수집(포켓몬류) 게임의 몬스터 종·스타터·진화 계통 그림을 만들 때",
    "몬스터 수집 전투의 앞모습/뒷모습 스프라이트를 새로 만들거나 다시 그릴 때",
    "JRPG 일반 적(enemy) 그림에는 쓰지 않는다 — 그쪽은 자료집 그림 생성 경로",
  ],
  seed: "harness-data/monster-collect-species/seed.json",
  doc: "openwiki/harnesses/monster-collect-species.md",
  stages: [
    { id: "status", title: "현황", summary: "시드의 종마다 앞·뒤 그림이 골라졌는지, 번들 결과물이 있는지 보여 준다." },
    { id: "front", title: "앞모습 후보", summary: "종 설명을 화풍 계약에 넣어 상대 앞모습(왼쪽 3/4) 후보 N장을 생성·도트화하고 비교 시트를 만든다." },
    { id: "back", title: "뒷모습 후보", summary: "고른 앞모습 도트를 키워 참고로 넣고, 같은 종의 뒷모습(오른쪽 위를 보는 등) 후보를 만든다." },
    { id: "action", title: "큰 동작 후보", summary: "공격·피격처럼 자세가 크게 바뀌는 동작을 sprite-gen 방식(가로 한 줄 한 장 생성)으로 만들고 재생 시트를 만든다. 대기는 생성하지 않는다(build 가 고른 스프라이트를 1px 씩 움직여 만든다)." },
    { id: "pick", title: "고르기", summary: "사람이 고른 후보(앞·뒤 그림 또는 --action 동작 줄)를 출처(격자 원본·해시·프롬프트)와 함께 기록한다." },
    { id: "import", title: "가져오기", summary: "이미 있는 생성 원본 PNG 하나를 도트화해 후보로 등록한다." },
    { id: "build", title: "번들 굽기", summary: "골라 둔 격자 원본을 112 캔버스로 맞춰 public/assets/harnesses/ 아래에 쓰고, 대기·동작 스트립과 anim.json 을 만들고 검사한다." },
    { id: "check", title: "검사", summary: "번들 스프라이트의 색 수·마젠타 잔점·윤곽·앞뒤 색 일치, 애니메이션 프레임(대기 0번=원본·발 고정, 동작 색·몸집)을 검사한다." },
    { id: "preview", title: "미리보기", summary: "번들 스프라이트의 대기·동작을 전투 배율로 재생하는 HTML 한 쪽을 만든다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
