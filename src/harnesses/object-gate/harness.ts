import { defineHarness } from '../_core/manifest';

export const OBJECT_GATE_HARNESS = defineHarness({
  id: 'object-gate',
  title: '공용 오브젝트 게이트 (3/4 시점)',
  summary: '새로 만든 기물 그림이 번들·공용 DB·스토어·공방 칩셋에 들어가기 전에 3/4 시점(윗면+앞면)을 판정해 그림 해시에 묶인 영수증을 남긴다. 판정자 둘×두 번 만장일치, 위반 표본을 하나도 놓치지 않는 보정 프로필만 효력이 있다. 번들·공용·스토어는 예외 없이 막고, 공방 로컬만 사람이 「그래도 넣기」를 누를 수 있다.',
  scope: {},
  triggers: [
    '어느 하네스·에디터 공방·스크립트든 새 기물(오브젝트) 그림을 번들·공용 DB·스토어·칩셋에 굽거나 올리기 전',
    '굽기·게시 스크립트에 3/4 시점 관문을 붙일 때(require_pass / objectGateRefusal)',
  ],
  seed: 'harness-data/object-gate/seed.json',
  doc: 'openwiki/harnesses/object-gate.md',
  stages: [
    { id: 'review', title: '판정', summary: '그림 하나(--png --kind --name) 또는 묶음(--batch items.jsonl)을 판정자 둘×두 번으로 재고 화소 해시 영수증을 쓴다.' },
    { id: 'calibrate', title: '보정', summary: '라벨 붙은 위반·정상 표본으로 현재 프로필을 잰다. 위반을 하나라도 통과시키면 프로필을 rejected 로 남긴다.' },
    { id: 'check', title: '출구 확인', summary: '그림 하나가 출구(bundle·shared·store·workshop-local)를 지나갈 수 있는지 영수증만 보고 답한다(모델 호출 없음).' },
    { id: 'status', title: '현황', summary: '프로필·영수증 수와 통과율을 보여 준다.' },
    { id: 'audit', title: '기존 그림 감사', summary: '이미 번들에 든 기물을 판정만 하고 보고서를 쓴다. 막지 않는다.' },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
