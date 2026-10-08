import { defineHarness } from '../_core/manifest';

export const SPACE_CRAFT_HARNESS = defineHarness({
  id: 'space-craft',
  title: '조수 공간 제작 시각 품질',
  summary: '실제 입력창으로 방·판타지 실내·현대 실내·무림 장소를 만들게 하고, 저장·재로드 뒤 결정론 지표(도달·빈 바닥·대칭·칩셋 계열)와 원본 크기 렌더를 남긴다. 기계 통과는 시각 합격이 아니다.',
  scope: {},
  triggers: ['조수가 만든 방·실내·장소가 보기에 괜찮은지 카테고리·모델별로 잴 때'],
  seed: 'harness-data/space-craft/seed.json',
  doc: 'openwiki/harnesses/space-craft.md',
  stages: [
    { id: 'list', title: '과제 목록', summary: '카테고리·시작 칩셋·기대 계열을 나열한다.' },
    { id: 'prepare', title: '격리 정본 준비', summary: '과제·반복마다 별도 SQLite 프로젝트를 만든다. 공용 DB 사본은 실행당 하나를 하드링크한다.' },
    { id: 'run', title: '실제 수행', summary: '실제 입력창에 자연어를 보내고 적용·저장·새 브라우저 재로드까지 확인한다(assistant-capability 실행기 재사용).' },
    { id: 'measure', title: '결정론 지표·렌더', summary: '조수가 만들거나 바꾼 맵마다 칩셋 계열·도달 비율·빈 바닥·대칭을 재고 원본 크기 PNG와 4분면 확대를 남긴다.' },
    { id: 'sheet', title: '비교 시트', summary: '카테고리 × 모델 × 반복을 그림과 지표로 나란히 놓은 자체완결 HTML을 굽는다.' },
    { id: 'status', title: '진행 상황', summary: '과제별 실행·측정 여부를 보여 준다.' },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
