import { defineHarness } from '../_core/manifest';

export const BEODEUL_ARCHITECTURE_HARNESS = defineHarness({
  id: 'beodeul-architecture',
  title: '버들항 건물 · 원본 보존',
  summary: '버들항 원본 보존 보정과 별도 건축 구조 여섯 계열. 원본 지붕·윤곽/수정 마스크, 신규 구조 전체 시트 재조립·source 해시·한 입구·기초를 확인한다. 기계 검사만으로 시각 합격을 선언하지 않는다.',
  scope: {},
  triggers: ['버들항(beodeul_city) 민가·교회를 새로 그리거나 창문·문·벽 재질·기초를 바꿀 때', '버들항 건물이 정면 입면으로 읽힌다는 지적이 있을 때'],
  seed: 'harness-data/beodeul-architecture/seed.json',
  doc: 'openwiki/harnesses/beodeul-architecture.md',
  stages: [
    { id: 'build', title: '손 도트 시트', summary: '기존 민가5종/교회를 국소 보정하고 별도 시트에 폭·높이·용마루·별채가 다른 여섯 구조를 원본 1:1 도트로 조립한다. 프로젝트 저장은 별도다.' },
    { id: 'validate', title: '면과 픽셀 대조', summary: '원본 지붕·알파·박공 수정 영역, 신규 여섯 구조의 source 해시·문 메타·시트 전체 배열을 대조한다. 시각 판정은 별도다.' },
    { id: 'review', title: '시점 검수 그림', summary: '기존 원본/보정/변경 픽셀과 여섯 구조를 정확한 3배로 출력한다. 실제 도안과 마을을 열어 시점을 확인한다.' },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
