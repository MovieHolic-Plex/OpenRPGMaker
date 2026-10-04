import { defineHarness } from '../_core/manifest';
export const INTERVIEW_SCENE_BANK_HARNESS = defineHarness({
  id: 'interview-scene-bank', title: '인터뷰 선택 배경',
  summary: '1,457개 누적 선택의 장면·프롬프트를 고정하고 원본 무결성과 해시에 묶인 실제 도트·선택 검수를 모두 통과한 그림만 배포한다.',
  scope: {}, triggers: ['새 게임 인터뷰의 누적 선택 배경을 대량 생성·검수·배포할 때'],
  seed: 'harness-data/interview-scene-bank/seed.json', doc: 'openwiki/harnesses/interview-scene-bank.md',
  stages: [
    { id: 'plan', title: '장면 계획', summary: '실제 질문에서 1,457개 고유 장면과 누적 프롬프트를 만든다.' },
    { id: 'batch', title: '다음 열 장', summary: '합격작을 건너뛰고 미제작·탈락 장면 열 개의 생성 작업을 내보낸다.' },
    { id: 'import', title: '후보 등록', summary: '--key <장면> --image <원본>으로 생성 원본과 해시를 보관한다.' },
    { id: 'gate', title: '원본 무결성 관문', summary: '전체 배경 비율·불투명·해시·중복을 검사하고 크기와 색 수는 진단으로 기록한다. 도트 표현은 실제 시각 검수한다.' },
    { id: 'review', title: '실제 그림 검수', summary: '--key <장면> --verdict <JSON>으로 원본 해시에 묶인 판정을 등록한다.' },
    { id: 'build', title: '합격작 배포', summary: '규격과 시각 판정이 모두 유효한 그림만 앱 매니페스트에 넣는다.' },
    { id: 'status', title: '제작 현황', summary: '미제작·규격 탈락·검수 대기·합격 수를 보고한다.' },
  ], entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
