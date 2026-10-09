import { defineHarness } from '../_core/manifest';
export const POKEMON_CHARACTER_CASTING_HARNESS = defineHarness({
  id:'pokemon-character-casting',title:'포켓몬 캐릭터 후보 승인',scope:{genre:'monster-collect'},
  summary:'역할별 원작 판형의 머리·복장을 수정한 16역할 후보를 원본·수정본·GIF로 비교하고 Allow/Deny한다. 현재 그림에 묶인 승인만 결과를 굽고 공용 등록한다.',
  triggers:['포켓몬류 NPC 후보를 브렌던 규격으로 만들고 사용자가 승인·반려할 때','감독자·조수는 사용자의 Allow를 대신 기록하지 않는다.'],
  seed:'harness-data/pokemon-character-casting/seed.json',doc:'openwiki/harnesses/pokemon-character-casting.md',
  stages:[
    {id:'prepare-cast',title:'전체 16역할 준비',summary:'역할별 판형에 명시한 머리·복장 수정을 적용하고 네이티브·GIF·출처 검사를 거쳐 16역할 검토 묶음으로 저장한다. 자동 승인하지 않는다.'},
    {id:'prepare-theme-cast',title:'테마 주민·조련사 준비',summary:'사막·설원·해안 9역할(주민 남·여, 조련사)을 원작 판형의 머리·복장 수정으로 만들고 검사 후 theme-cast-v1 묶음으로 저장한다. 다른 묶음과 판정은 건드리지 않으며 자동 승인하지 않는다.'},
    {id:'prepare',title:'후보 준비',summary:'명시한 시드의 서로 다른 native 전신 후보를 굽고 중복 몸체 검사와 기존 네이티브 모션 구조 검사와 미리보기를 연결한다.'},
    {id:'queue',title:'후보 등록',summary:'외부 native48×128과 GIF를 불변 후보 패키지로 가져온다. 검증된 판형 공유는 표시하고, 출처가 확인되지 않은 복제와 같은 그림의 중복 등록은 거부한다.'},
    {id:'serve',title:'사용자 검토 화면',summary:'SQLite에 보존되는 Allow/Deny, 반려 이유, 방향·프레임 검토, 승인 결과 다운로드.'},
    {id:'status',title:'승인 현황',summary:'미결정·승인·반려·오래된 승인과 역할별 현재 선택을 읽는다.'},
    {id:'build',title:'승인 결과 굽기',summary:'현재 패키지의 사용자 Allow와 네이티브 구조·재생 검수를 다시 확인한다. 미결정·Deny·변조는 거부한다.'},
  ],entrypoints:{cli:true,editorUi:false,assistantTool:false},
});
