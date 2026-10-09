import { defineHarness } from '../_core/manifest';

export const BEODEUL_BUILDING_REVIEW_HARNESS = defineHarness({
  id: 'beodeul-building-review',
  title: '버들항 건물 · 사람의 허용/거절',
  summary: '원본 도트 부품·명시한 지붕 색상표·간판 격자로 후보를 저작하고 독립적인 적대적 이미지 검사 두 단계를 통과한 것만 사람이 허용/거절한다. 판단은 그림 해시에 묶이며 재저작하면 미선택으로 돌아간다. 선택 전에는 게임 번들·맵에 설치하지 않는다.',
  scope: {},
  triggers: ['버들항 건물 후보를 새 지붕·창문·벽 재질로 만들고 사람이 하나씩 고를 때'],
  seed: 'harness-data/beodeul-building-review/seed.json',
  doc: 'openwiki/harnesses/beodeul-building-review.md',
  stages: [
    { id: 'build', title: '비공개 초안 굽기', summary: '원본 도트 부품을 1:1로 조립한다. 초안은 검수 화면에 공개하지 않는다.' },
    { id: 'validate', title: '파일 계약 확인', summary: '전체 초안 존재·크기·해시·원본 픽셀 일치를 확인한다. 문 개수의 시각 판정은 gate 단계에서 한다.' },
    { id: 'gate', title: '적대적 Visual QA', summary: '독립적인 질감·구조 이미지 검사와 숨긴 반려 표본 검사를 수행한다. 누락·실패·낡은 결과는 공개를 차단한다.' },
    { id: 'publish', title: '검증 통과 후보 공개', summary: '모든 후보의 현재 그림과 시드·검사 규칙이 일치하는 서명된 통과 증거가 있어야 공개한다. 사람의 허용은 별도다.' },
    { id: 'produce', title: '후보 생성·검증·공개', summary: '활성 시드 전체에 build → validate → gate → publish를 직렬로 수행한다. 실패하면 공개하지 않는다.' },
    { id: 'serve', title: '허용/거절 화면', summary: '큰 카드 갤러리·검색/필터·고정 메모/결정 패널·집중 보기·원본 비교로 검수하며 메모만 저장도 제공한다.' },
    { id: 'repair', title: '메모대로 고쳐 다시 올리기', summary: '검수 화면의 「메모대로 고쳐 다시 올리기」 요청을 받는 별도 서비스(:18322). 거절 메모를 작업자(codex)에게 주어 원본 부품으로 다시 그리고, 같은 build→validate→gate→publish를 거친다. 실패하면 시드를 원래 바이트로 되돌린다.' },
    { id: 'status', title: '현재 선택', summary: '현재 그림 해시와 일치하는 허용/거절/미선택을 보여 준다.' },
    { id: 'export', title: '허용한 것만 내보내기', summary: '사람이 현재 그림을 허용한 후보만 파일 팩으로 내보낸다(CLI 전용). 공용 설치는 install, 스토어 올리기는 슈퍼하네싱 탭의 「스토어에 올리기」 또는 store-server/scripts/publishBuildings.ts.' },
    { id: 'install', title: '허용한 건물 공용 번들 설치', summary: '결정 로그에서 현재 그림 해시에 허용된 후보만 시트·카탈로그·참고문서로 굽는다(--profile <id>, 프로필은 profiles.json).' },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
