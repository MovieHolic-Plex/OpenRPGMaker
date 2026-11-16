/**
 * 이미 있는 오너 면제 묶음의 출구만 넓힌다 — `npm run harness -- object-gate owner-waive-extend`(cli.ts 가 이 함수를 부른다).
 *
 * 그림을 다시 읽지 않고, 그 출구를 연 오너의 말·날짜·기록한 쪽을 넓힘 기록(extensions)으로 묶음에 더한다. 묶음 머리(처음 오너의 말·출구)는 그대로다.
 * 스토어 출구로 넓히는 것은 Fable 묶음(이름이 fable- 로 시작)뿐이다 — 오너의 말(2026-11-15)은 «Fable 이 만든 것» 이다. 다른 오너 묶음은 거절한다.
 * 서명된 사람 거절·보정된 Opus 최종 기록은 넓힌 뒤에도 출구에서 그대로 막는다(objectGateRefusal).
 * 오너의 말 없이는 넓히지 못한다 — 감독·에이전트가 스스로 출구를 열지 않는다.
 */
import { OBJECT_GATE_STORE_EXTEND_PREFIX, OBJECT_GATE_WAIVER_ALLOWED_CONTEXTS, ownerWaiverReaches, type ObjectGateContext } from '../../_core/objectGate';
import { listOwnerWaiverBatches, writeOwnerWaiverBatch } from './store';

export const OWNER_WAIVE_EXTEND_USAGE = 'owner-waive-extend --batch <있는 묶음 id> --contexts store --owner "<그 출구를 연 오너의 말 원문>" --decided-at <YYYY-MM-DD> --recorded-by "<기록한 쪽·위임 근거>" [--note 메모]';

export type OwnerWaiveExtendInput = { batch?: string; contexts?: string; owner?: string; decidedAt?: string; recordedBy?: string; note?: string };

/** 인자가 빠지면 던진다(사용법). 거절이면 code 3, 넓혔거나 이미 열려 있으면 code 0. */
export function extendOwnerWaiver(input: OwnerWaiveExtendInput): { code: 0 | 3; message: string } {
  const id = input.batch?.trim(), owner = input.owner?.trim(), decidedAt = input.decidedAt?.trim(), recordedBy = input.recordedBy?.trim();
  if (!id || !owner || !decidedAt || !recordedBy || !input.contexts?.trim()) throw Error(OWNER_WAIVE_EXTEND_USAGE);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(decidedAt)) throw Error(`--decided-at 은 YYYY-MM-DD: ${decidedAt}`);
  const contexts = [...new Set(input.contexts.split(',').map(c => c.trim()).filter(Boolean))] as ObjectGateContext[];
  const badContext = contexts.filter(c => !(OBJECT_GATE_WAIVER_ALLOWED_CONTEXTS as readonly string[]).includes(c));
  if (!contexts.length || badContext.length) return { code: 3, message: `거절: 오너 면제가 닿을 수 없는 출구 ${badContext.join(', ') || '(없음)'} (허용: ${OBJECT_GATE_WAIVER_ALLOWED_CONTEXTS.join(', ')})` };
  const batch = listOwnerWaiverBatches().find(b => b.id === id);
  if (!batch) return { code: 3, message: `거절: 면제 묶음 ${id} 가 없다 — 새 묶음은 owner-waive 로 만든다(object-gate waivers 로 목록)` };
  if (contexts.includes('store') && !id.startsWith(OBJECT_GATE_STORE_EXTEND_PREFIX)) return { code: 3, message: `거절: 스토어 출구로 넓히는 것은 Fable 묶음(이름이 ${OBJECT_GATE_STORE_EXTEND_PREFIX} 로 시작)뿐이다 — ${id} 는 넓히지 않는다` };
  const fresh = contexts.filter(c => !ownerWaiverReaches(batch, c));
  if (!fresh.length) return { code: 0, message: `오너 면제 묶음 ${id}: 출구 ${contexts.join(', ')} 는 이미 열려 있다 — 바꾸지 않았다` };
  const note = input.note?.trim();
  const path = writeOwnerWaiverBatch({ ...batch, extensions: [...(batch.extensions ?? []), { contexts: fresh, owner, decidedAt, recordedBy, ...(note ? { note } : {}) }] });
  return { code: 0, message: `오너 면제 묶음 ${id}: 출구 ${fresh.join(', ')} 를 넓혔다(${batch.items.length}장) → ${path}\n  면제는 통과가 아니다 — 스토어로 나가도 보고에는 «3/4 관문 미통과 — 오너 면제» 로 쓴다.` };
}
