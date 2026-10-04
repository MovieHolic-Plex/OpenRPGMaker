import { defineHarness } from "../_core/manifest";
export const POKEMON_CHARACTER_MOTION_HARNESS = defineHarness({
  id: "pokemon-character-motion", title: "몬스터 수집 캐릭터 모션", scope: { genre: "monster-collect" },
  summary: "생성 원본의 4방향 3포즈를 공통 격자·배율·팔레트로 가져오고 걷기·오프닝 클립을 재생 검수한 뒤 해시에 묶인 관문을 통과한 결과만 굽는다.",
  triggers: ["몬스터 수집 게임의 주인공·NPC 걷기 도트나 오프닝 그림 모션을 생성·교체할 때", "픽셀 수치가 방향·다리 교대 의미를 증명하지 않는다. 애니메이션 재생 증거를 남긴다."],
  seed: "harness-data/pokemon-character-motion/seed.json", doc: "openwiki/harnesses/pokemon-character-motion.md",
  stages: [
    {id:"status",title:"현황",summary:"역할별 후보와 관문·검수·결과 해시 상태를 읽는다."},
    {id:"import",title:"가져오기",summary:"생성 아틀라스 또는 기존 네이티브 시트를 불변 출처와 함께 후보로 저장한다."},
    {id:"check",title:"구조 검사",summary:"12프레임·색 합집합·알파·머리 흔들림·다리 변화·연속성을 검사한다."},
    {id:"preview",title:"재생 검수",summary:"원본 크기와 3배율로 네 방향 및 선택 클립을 재생하는 HTML을 만든다."},
    {id:"review",title:"시각 판정",summary:"재생 증거·검수자·이유를 출처와 최종 그림 해시에 묶어 기록한다."},
    {id:"gate",title:"출하 관문",summary:"구조 검사와 현재 해시의 시각 판정을 확인한다. 실패는 종료 코드 1이다."},
    {id:"build",title:"굽기",summary:"현재 관문·검수의 해시가 같은 결과만 로컬 출력 폴더에 복사한다."},
  ], entrypoints:{cli:true,editorUi:false,assistantTool:false},
});
