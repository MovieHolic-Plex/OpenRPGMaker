import { defineHarness } from '../_core/manifest';

export const OBJECT_GATE_HARNESS = defineHarness({
  id: 'object-gate',
  title: '공용 오브젝트 게이트 (3/4 시점 + 버들항 화풍)',
  summary: '새로 만든 기물·타일 그림이 번들·공용 DB·스토어·공방 칩셋에 들어가기 전의 관문. 최종 통과는 서명된 사람 허용이다(사용자 결정 2026-10-20: AI 판정 보정 2회 실패, 사용자가 매번 눈으로 판정). 판정자(Claude Sonnet 5.5 high)가 3/4 시점과 버들항 화풍을 따로 판정해 화소 해시에 묶은 영수증은 1차 거름·조언이고, 사람이 검토 화면(serve-holds, 18323)에서 허용하면 그 해시·종류에 묶인 서명 기록이 모든 출구를 연다. 거절은 최종. 사람 결정이 없으면 보정 프로필의 PASS 만 지나간다. 감독·에이전트는 허용·거절하지 않는다.',
  scope: {},
  triggers: [
    '어느 하네스·에디터 공방·스크립트든 새 기물(오브젝트) 그림을 번들·공용 DB·스토어·칩셋에 굽거나 올리기 전',
    '굽기·게시 스크립트에 3/4 시점 관문을 붙일 때(require_pass / objectGateRefusal)',
  ],
  seed: 'harness-data/object-gate/seed.json',
  doc: 'openwiki/harnesses/object-gate.md',
  stages: [
    { id: 'review', title: '판정', summary: '그림 하나(--png --kind [--style-kind] --name) 또는 묶음(--batch items.jsonl)을 판정자 ×네 번으로 재고 3/4·화풍 두 반쪽을 따로 적은 화소 해시 영수증을 쓴다.' },
    { id: 'calibrate', title: '보정', summary: '3/4 위반·정상 표본과 화풍 얕음·버들 수준 표본으로 현재 프로필을 잰다. 위반을 하나라도 통과시키거나 정상 표본 통과율이 하한 아래면 rejected. 답은 프롬프트 해시별로 캐시해 이어 돌릴 수 있다(--offline 은 캐시만).' },
    { id: 'rereview', title: '재검수', summary: '현재 번들 테마 칩셋의 키트·바닥 그룹을 시트에서 합성해 새 프로필로 다시 판정한다(중단 후 이어 돌리기). 보정 통과 프로필만 영수증을 쓰고, --audit 은 보고서만.' },
    { id: 'check', title: '출구 확인', summary: '그림 하나가 출구(bundle·shared·store·workshop-local)를 지나갈 수 있는지 영수증만 보고 답한다(모델 호출 없음).' },
    { id: 'enqueue', title: '대기열 올리기', summary: '묶음(--batch items.jsonl --id --title)을 사람 검토 대기열에 올린다. 영수증이 없는 그림만 AI 판정(review --advisory)을 받고, 어느 프로필로든 판정받은 그림은 다시 부르지 않는다. 아무것도 허용하지 않는다.' },
    { id: 'selftest-holds', title: '위변조 시험', summary: '임시 데이터·임시 키로 사람 허용 규칙(서명·세션·영수증 필수·한 화소·거절 최종·묶음 허용)을 TS·Python 출구 모두에서 확인한다. 모델 호출 없음.' },
    { id: 'serve-holds', title: '사람 검토 대기열', summary: 'AI 가 판정했고 사람 결정이 없는 그림(보류·불합격·미보정 통과)을 묶음별로 1배·4배, 버들항 기준 그림 옆에 AI 조언과 함께 놓고 사람이 허용/거절을 누르는 로컬 화면(기본 포트 18323). 「이 묶음 전부 허용」은 확인 문구를 직접 입력해야 하고 그림마다 서명 기록을 쓴다. 결정은 화소 해시·종류에 묶이고 저장소 밖 키로 서명된다. holds 는 묶음별 현황.' },
    { id: 'status', title: '현황', summary: '프로필·영수증 수와 통과율을 보여 준다.' },
    { id: 'audit', title: '기존 그림 감사', summary: '이미 번들에 든 기물을 판정만 하고 보고서를 쓴다. 막지 않는다.' },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
