import { defineHarness } from '../_core/manifest';
export const POKEMON_CHARACTER_CASTING_HARNESS = defineHarness({
  id:'pokemon-character-casting',title:'포켓몬 캐릭터 후보 승인',scope:{genre:'monster-collect'},
  summary:'서로 다른 전신의 NPC 후보·색 없는 실루엣·걷기 GIF·12포즈·배치 모형을 보고 사용자가 Allow/Deny한다. 현재 그림에 묶인 승인만 결과를 굽고 공용 등록한다.',
  triggers:['포켓몬류 NPC 후보를 브렌던 규격으로 만들고 사용자가 승인·반려할 때','감독자·조수는 사용자의 Allow를 대신 기록하지 않는다.'],
  seed:'harness-data/pokemon-character-casting/seed.json',doc:'openwiki/harnesses/pokemon-character-casting.md',
  stages:[
    {id:'prepare',title:'후보 준비',summary:'명시한 시드의 서로 다른 native 전신 후보를 굽고 중복 몸체 검사와 기존 네이티브 모션 구조 검사와 미리보기를 연결한다.'},
    {id:'queue',title:'후보 등록',summary:'외부 native48×128과 GIF를 불변 후보 패키지로 가져온다. 색·머리만 바꾼 동일 몸체는 거부하고 자동 승인하지 않는다.'},
    {id:'serve',title:'사용자 검토 화면',summary:'SQLite에 보존되는 Allow/Deny, 반려 이유, 방향·프레임 검토, 승인 결과 다운로드.'},
    {id:'status',title:'승인 현황',summary:'미결정·승인·반려·오래된 승인과 역할별 현재 선택을 읽는다.'},
    {id:'build',title:'승인 결과 굽기',summary:'현재 패키지의 사용자 Allow와 네이티브 구조·재생 검수를 다시 확인한다. 미결정·Deny·변조는 거부한다.'},
  ],entrypoints:{cli:true,editorUi:false,assistantTool:false},
});
