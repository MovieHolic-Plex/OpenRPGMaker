import { defineHarness } from '../_core/manifest';

export const ASSISTANT_CAPABILITY_HARNESS = defineHarness({
  id: 'assistant-capability',
  title: '조수 기능별 수행 검증',
  summary: '실제 입력창·Pi 모델로 자연어 과제를 수행하고 요구·보존·적대적 반례·플레이·시각·SQLite 재로드 증거를 각각 판정한다. 필수 증거 누락은 합격이 아니다.',
  scope: {},
  triggers: ['에디터 조수의 기능별 수행 능력, 기존 콘텐츠 보존, 완료 보고와 실제 결과를 점검할 때'],
  seed: 'harness-data/assistant-capability/seed.json',
  doc: 'openwiki/harnesses/assistant-capability.md',
  stages: [
    { id: 'list', title: '과제 목록', summary: '요구·보존·플레이·시각 기준이 미리 정해진 사례를 나열한다.' },
    { id: 'prepare', title: '격리 정본 준비', summary: '실행마다 별도 SQLite 프로젝트와 초기 상태를 만든다. 기존 폴더 덮어쓰기 금지.' },
    { id: 'run', title: '실제 수행', summary: '직렬로 실제 입력창에 제출하고 적용·저장·새 브라우저 재로드·전용 플레이어를 확인한다.' },
    { id: 'recheck', title: '저장 결과 재관측', summary: '원래 시도와 검증을 보존하고 모델 재실행 없이 같은 저장 결과만 재검증한다.' },
    { id: 'recapture', title: '화면 재관측', summary: '이전 그림을 보존하고 모델 재실행 없이 저장 결과의 렌더 완료 화면을 다시 캡처한다.' },
    { id: 'self-check', title: '검증기 반례', summary: '정상 결과와 무변경·잘못된 대상·범위 위반·분기 결손 결과의 오판을 검사한다.' },
    { id: 'self-check-runtime', title: '플레이 검증기 교정', summary: '알려진 정상 결과를 출하 플레이어에서 실행하여 플레이 검사 자체의 오판을 확인한다.' },
    { id: 'review', title: '시각 검수', summary: '실제로 열어 본 그림의 해시에 묶어 독립 검수 결과를 기록한다.' },
    { id: 'report', title: '결과 집계', summary: '미검증·실패·환경 차단을 숨기지 않고 JSON·HTML·Markdown으로 집계한다.' },
    { id: 'aggregate', title: '여러 실행 집계', summary: '각 기능의 최초 실제 모델 시도를 선택하고 입력 전 기동 장애와 모든 시도를 별도 보존한다.' },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
