/**
 * 공용 오브젝트 게이트 — 영수증·해시·출구 판정(브라우저·노드 공용, Web Crypto 만 쓴다).
 *
 * 영수증은 그림 화소 해시(pixelSha256)에 묶인다. 한 화소라도 바뀌면 영수증이 없어져 다시 판정받아야 한다.
 * 최종 판정은 Opus 5.5 medium 적대적 VQA 다(2026-10-21 사용자 결정, 옵션 A 「사람 허용이 최종」을 대체):
 *   ① 서명된 사람 「거절」은 언제나 최종 차단(덮어쓰기).
 *   ② 보정된 Opus 최종 프로필의 기록(final/<해시>.json, 그림 해시·종류·프로필에 묶임)이 있으면 그 판정이 최종 — pass 면 통과, fail 이면 차단
 *      (사람 허용도 Opus fail 을 뒤집지 않는다. 공방 로컬만 사람 「그래도 넣기」).
 *   ③ Opus 기록이 없을 때만 옛 규칙: 서명된 사람 허용(이제 필수가 아니라 선택) 또는 보정된 옛 프로필의 pass.
 *   bundle·shared·store → 보정된 프로필의 「pass」 영수증만. 공방 「그래도 넣기」도 받지 않는다.
 *   workshop-local      → pass, 또는 사람이 직접 누른 「그래도 넣기」 덮어쓰기. 조수·에이전트는 덮어쓸 수 없다.
 * Python 쪽 같은 규칙: src/harnesses/_core/object_gate/__init__.py. 둘을 같이 고친다.
 */

import { OBJECT_GATE_PROFILE, type ObjectGateEyeAnswer, type ObjectGateJudgeAnswer, type ObjectGateKind, type ObjectGateState, type ObjectGateStyleAnswer, type ObjectGateStyleKind } from './rules';

export type ObjectGateContext = 'bundle' | 'shared' | 'store' | 'workshop-local';

export type ObjectGateHalf = { pass: boolean; reasons: string[] };

export type ObjectGateRun = {
  judge: string; run: number;
  /** 규칙 v6: 3/4 호출(answer)과 화풍 호출(styleAnswer)은 따로다. 옛 영수증은 answer 안에 style 이 들어 있었다. */
  answer: ObjectGateJudgeAnswer | null; styleAnswer?: ObjectGateStyleAnswer | null; eyeAnswer?: ObjectGateEyeAnswer | null;
  pass: boolean; reasons: string[]; ms?: number; error?: string; styleError?: string;
  view34?: ObjectGateHalf; style?: ObjectGateHalf;
};

/** 보조 지표(통과 근거 아님): 칸당 고유색 중앙값·p90, 가장 어두운 5% 화소의 V, 근흑 윤곽 비율. 보고서에서 어느 쪽이 얕은지 보는 용도다. */
export type ObjectGateAuxMetrics = { tileColorsMedian: number; tileColorsP90: number; darkV5: number; nearBlackEdge: number; opaqueTiles: number };

/** 한쪽 판정 요약. 영수증은 3/4 와 화풍을 따로 적고, 둘 다 pass 일 때만 최상위 verdict 가 pass 다. */
export type ObjectGateHalfVerdict = { verdict: ObjectGateState; reasons: string[] };

/**
 * 화풍 판정에 쓴 기준 그림 묶음(2026-10-23). 칩셋마다 그 칩셋 번들의 그림으로 비교한다.
 * id = 쓴 묶음(버들항 기본 묶음은 "beodeul_city"), chipset = 후보의 칩셋(모르면 null), fallback = 후보 칩셋의 묶음이 없거나
 * 그 묶음에 이 화풍 종류가 없어 버들항으로 떨어졌을 때 true(reason 에 이유), hash = 쓴 기준 그림 화소 해시들의 해시.
 * 이 필드가 없는 옛 영수증은 버들항 묶음으로 판정한 것이다.
 */
export type ObjectGateStyleRefSet = { id: string; chipset: string | null; fallback: boolean; reason?: string; hash: string };
export type ObjectGateReceipt = {
  schema: 'oprn-object-gate-receipt/1';
  pixelSha256: string;
  width: number;
  height: number;
  kind: ObjectGateKind;
  name: string;
  label?: string;
  profileHash: string;
  /** 3/4 와 화풍 둘 다 pass 일 때만 pass. 하나라도 fail 이면 fail, 그 밖(판정자 의견이 갈림·사용자 정의 영역)은 refer(사람 확인 필요 — pass 로 세지 않고 모든 출구에서 막는다). */
  verdict: ObjectGateState;
  reasons: string[];
  /** 규칙 v4 부터. 보고서가 어느 반쪽이 떨어졌는지 말할 수 있도록 따로 적는다. */
  view34?: ObjectGateHalfVerdict;
  style?: ObjectGateHalfVerdict & { styleKind: ObjectGateStyleKind; refs: string[]; scale: number; score?: number; refSet?: ObjectGateStyleRefSet };
  metrics?: ObjectGateAuxMetrics;
  /** 규칙 v7: 독립 눈(전체 인상) 답의 판정 목록(right|borderline|wrong). 거부권 계산에 쓰인 근거. */
  eye?: { verdicts: string[] };
  runs: ObjectGateRun[];
  decidedAt: string;
  /** 판정한 원본 PNG 를 칸 크기별로 자른 칸 해시(정렬 변형 포함). 시트 칸 관문이 이걸로 「판정받은 그림의 칸」을 알아본다. */
  cells?: Record<string, string[]>;
  /** 사람이 「그래도 넣기」를 누른 기록. workshop-local 출구에서만 효력이 있다. */
  override?: { by: 'human'; at: string; note?: string };
};

/**
 * 정면형 소품(front_prop) 종류 선언의 사람 승인 기록. 화소 해시·종류·승인자·시각을 묶는다 — 그림이 한 화소라도 바뀌면 해시가 달라져 승인은 자동으로 무효다.
 * 승인된 그림만 3/4 반쪽을 면제한다(화풍 반쪽은 그대로 pass 여야 한다). 감독·에이전트는 승인할 수 없다: 승인 입구(cli `approve-front-prop`)는 터미널 대화형 확인만 받는다.
 */
export type ObjectGateFrontPropApproval = { schema: 'oprn-object-gate-front-prop-approval/1'; pixelSha256: string; kind: 'front_prop'; approvedBy: string; approvedAt: string; by: 'human'; note?: string };

export function validFrontPropApproval(approval: ObjectGateFrontPropApproval | null | undefined, pixelSha256: string): approval is ObjectGateFrontPropApproval {
  return !!approval && approval.schema === 'oprn-object-gate-front-prop-approval/1' && approval.by === 'human' && approval.kind === 'front_prop'
    && approval.pixelSha256 === pixelSha256 && typeof approval.approvedBy === 'string' && approval.approvedBy.trim().length > 0 && !!approval.approvedAt;
}

/**
 * 사람의 허용/거절 기록(검토 화면 `serve-holds` 가 쓴다). 2026-10-20 사용자 결정(옵션 A): **AI 판정은 1차 거름·조언이고, 최종 통과는 서명된 사람 허용이다.**
 * 이유: AI 판정 보정이 두 번(규칙 v9·v10) 실패했고, 사용자가 매번 눈으로 판정하고 있었다.
 *
 * 기록은 그림 화소 해시·종류에 묶이고 검토 화면 서버가 저장소 밖 키로 HMAC 서명한다. profileHash 는 사람이 본 AI 조언(영수증)의 프로필을 적어 둔 것이다 —
 * 효력 조건은 「그 그림·그 종류의 영수증이 어느 프로필로든 있다」(AI 가 한 번은 판정해 조언이 남았다)이고, 프로필의 보정 여부는 보지 않는다.
 * 허용 = 모든 출구 통과, 거절 = 최종(모든 출구에서 막고 공방 「그래도 넣기」도 무효).
 * 출구는 서명을 확인한 기록만 받는다(노드 store.readHoldDecision · Python read_hold_decision). 감독·에이전트·MCP 도구는 쓰지 않는다.
 * 스키마 이름(hold-decision)은 서명 대상이라 바꾸지 않는다(2026-10-20 이전 기록 4건이 그대로 유효하다).
 *
 * by: 'human' = 사람이 검토 화면에서 직접 누른 결정. by: 'delegated' = 사용자가 감독자에게 위임해 감독자가 독립 검수 뒤 같은 검토 API 로 기록한 허용.
 * 위임 기록은 delegatedBy(위임한 사람)·evidence(근거 영수증·검수 결과 경로)가 둘 다 있어야 하고, 두 필드는 위임 기록의 서명 대상에만 들어간다
 * (사람 기록의 서명 문자열은 그대로라 기존 기록이 그대로 유효하다). 출구 효력은 사람 허용과 같다 — 그림 해시·종류·서명 확인은 똑같이 요구한다.
 */
export type ObjectGateHoldDecision = {
  schema: 'oprn-object-gate-hold-decision/1'; pixelSha256: string; profileHash: string; kind: ObjectGateKind;
  decision: 'allow' | 'reject'; decidedBy: string; decidedAt: string; by: 'human' | 'delegated'; via: 'review-page'; reasons: string[]; note?: string;
  /** by === 'delegated' 일 때만. 위임한 사람(예: 사용자 이름). */ delegatedBy?: string; /** by === 'delegated' 일 때만. 독립 검수 근거(영수증·결과 파일 경로). */ evidence?: string;
  /** 그림을 다시 그려 이 해시가 물러났을 때(2026-10-22, `object-gate supersede-holds`): 새 그림 해시나 설명. 있으면 허용은 효력이 없다(거절은 그대로). */ supersededBy?: string; supersededAt?: string;
  sig: string;
};
/** 서명 대상 문자열(sig 제외, 키 이름순). Python hold_payload 와 같다. */
export function objectGateHoldPayload(d: ObjectGateHoldDecision): string {
  const keys = ['schema', 'pixelSha256', 'profileHash', 'kind', 'decision', 'decidedBy', 'decidedAt', 'by', 'via', 'reasons', 'note'] as const;
  const extra = d.by === 'delegated' ? (['delegatedBy', 'evidence'] as const) : ([] as const);
  // 물러남 표시는 있을 때만 서명 대상에 더한다 — 없는 기록의 서명 문자열은 그대로다(Python hold_payload 와 같다).
  const retired = d.supersededBy ? (['supersededBy', 'supersededAt'] as const) : ([] as const);
  return JSON.stringify([...keys, ...extra, ...retired].map(k => [k, (d as Record<string, unknown>)[k] ?? null]));
}
const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
/** 서명 확인을 마친 기록이 이 영수증(그림 해시·종류)에 묶인 사람 결정이면 'allow'|'reject', 아니면 null. 프로필은 보지 않는다. */
export function humanDecision(d: ObjectGateHoldDecision | null | undefined, receipt: ObjectGateReceipt | null | undefined): 'allow' | 'reject' | null {
  if (!d || !receipt) return null;
  const ok = d.schema === 'oprn-object-gate-hold-decision/1' && (d.by === 'human' || (d.by === 'delegated' && d.decision === 'allow' && nonEmpty(d.delegatedBy) && nonEmpty(d.evidence))) && d.via === 'review-page' && (d.decision === 'allow' || d.decision === 'reject')
    && d.pixelSha256 === receipt.pixelSha256 && d.kind === receipt.kind && typeof d.decidedBy === 'string' && d.decidedBy.trim().length > 0 && !!d.decidedAt
    && typeof d.profileHash === 'string' && d.profileHash.length > 0;
  // 물러난(다시 그려 대체된) 그림의 허용은 효력이 없다. 거절은 그대로 최종이다.
  if (ok && d.decision === 'allow' && nonEmpty(d.supersededBy)) return null;
  return ok ? d.decision : null;
}
export function holdAllows(d: ObjectGateHoldDecision | null | undefined, receipt: ObjectGateReceipt): boolean {
  return humanDecision(d, receipt) === 'allow';
}

/**
 * Opus 최종 판정 기록(2026-10-21). 적대적(검사관) 지시문으로 Opus 5.5 medium 이 여러 그림을 한 호출에 보고 pass/fail 과 이유를 낸다.
 * 그림 화소 해시·종류·판정 프로필 해시에 묶인다. 출구는 보정된(final-profiles/<해시>.json status calibrated) 프로필의 기록만 받는다.
 */
export type ObjectGateFinal = {
  schema: 'oprn-object-gate-final/1';
  pixelSha256: string; width: number; height: number;
  kind: ObjectGateKind; styleKind: ObjectGateStyleKind; name: string; label?: string;
  profileHash: string;
  judge: { provider: 'claude-cli'; model: string; effort: string };
  verdict: 'pass' | 'fail';
  view34: 'pass' | 'fail'; style: 'pass' | 'fail'; kindOk: boolean; sure: boolean;
  reasons: string[];
  answer: unknown;
  decidedAt: string;
  cells?: Record<string, string[]>;
};
export type ObjectGateFinalProfileRecord = {
  schema: 'oprn-object-gate-final-profile/1'; profileHash: string; status: 'calibrated' | 'rejected'; calibratedAt: string;
  judge: { provider: 'claude-cli'; model: string; effort: string };
  bad: { total: number; caught: number; missed: string[] }; good: { total: number; passed: number; falseFail: string[] };
  sets?: Record<string, { bad: { total: number; caught: number }; good: { total: number; passed: number } }>;
  tiers?: Record<string, { bad: { total: number; passed: number }; good: { total: number; passed: number } }>;
  errors?: string[]; note?: string;
  /** 조건 (b): 칩셋 원본(알려진 정상) 묶음별 전체 판정 통과. */
  originals?: Record<string, { total: number; passed: number; failed: string[] }>;
  families?: Record<string, { bad: number; caught: number; good: number; passed: number }>;
  uncertain?: Array<{ label: string; verdict: string; reasons: string[] }>;
  excludedNegatives?: string[];
};
/** 이 그림·종류에 효력이 있는 Opus 최종 기록인가(보정된 프로필·해시 일치). 종류가 다르면 효력 없음이 아니라 「종류 불일치」로 막는다(refusal). */
export function finalApplies(final: ObjectGateFinal | null | undefined, pixelSha256: string, calibratedFinalProfiles: ReadonlySet<string> | undefined): final is ObjectGateFinal {
  return !!final && final.schema === 'oprn-object-gate-final/1' && final.pixelSha256 === pixelSha256 && (final.verdict === 'pass' || final.verdict === 'fail')
    && !!calibratedFinalProfiles?.has(final.profileHash);
}

export type ObjectGateConfusion = { badTotal: number; caught: number; missed: string[]; goodTotal: number; passed: number; falseFail: string[] };

export type ObjectGateProfileRecord = {
  schema: 'oprn-object-gate-profile/1';
  profileHash: string;
  status: 'calibrated' | 'rejected';
  calibratedAt: string;
  /** 3/4 반쪽(옛 필드 이름 유지). 규칙 v6 부터 확실(A) 라벨만 센다. caught = pass 가 아니게 막은 것(fail 또는 refer). */
  bad: { total: number; caught: number; missed: string[]; refer?: number };
  good: { total: number; passed: number; falseFail: string[]; refer?: number };
  /** 규칙 v6: 다툼(C)·사용자 수락(U) 라벨은 통과·차단 기준에서 빼고 따로 적는다. */
  tiers?: Record<string, { bad: { total: number; passed: number }; good: { total: number; passed: number } }>;
  /** 규칙 v6: 규칙을 조정할 때 쓰지 않은 숨김 표본의 결과(개발 표본과 따로). */
  fresh?: { bad: { total: number; caught: number; missed: string[] }; good: { total: number; passed: number; falseFail: string[] } };
  holdout?: { bad: { total: number; caught: number; missed: string[] }; good: { total: number; passed: number; falseFail: string[] } };
  /** 규칙 v4 의 화풍 반쪽. 둘 다 기준을 넘어야 calibrated 다. 옛 프로필 기록에는 없다. */
  style?: ObjectGateConfusion & { groups?: Record<string, { total: number; passed: number }> };
  judge?: string;
  note?: string;
};

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

/**
 * 그림 정규화: 완전 투명 화소의 RGB 를 0 으로, 불투명 화소의 경계 상자로 잘라낸다.
 * 굽기에서 여백·투명 색만 달라진 같은 그림이 같은 해시를 갖게 한다(시트에 붙인 조각과 원본 PNG 가 같은 영수증을 쓴다).
 */
export function normalizeObjectGateImage(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): { width: number; height: number; rgba: Uint8Array } {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3]! > 0) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { width: 0, height: 0, rgba: new Uint8Array(0) };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y + y0) * width + (x + x0)) * 4, d = (y * w + x) * 4;
    if (rgba[s + 3]! === 0) continue;
    out[d] = rgba[s]!; out[d + 1] = rgba[s + 1]!; out[d + 2] = rgba[s + 2]!; out[d + 3] = rgba[s + 3]!;
  }
  return { width: w, height: h, rgba: out };
}

/** sha256(`${w}x${h}:` + RGBA 바이트) — 정규화(normalizeObjectGateImage)한 뒤의 그림. Python pixel_sha256 과 같은 정의. */
export async function objectGatePixelSha256(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): Promise<string> {
  const n = normalizeObjectGateImage(width, height, rgba);
  const head = new TextEncoder().encode(`${n.width}x${n.height}:`);
  const all = new Uint8Array(head.length + n.rgba.length);
  all.set(head, 0); all.set(n.rgba, head.length);
  return hex(await globalThis.crypto.subtle.digest('SHA-256', all));
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
};

/** 판정 프로필(지시문·종류 기준·판정자·반복 수)의 해시. 무엇이든 바뀌면 다시 보정해야 쓸 수 있다. */
export async function objectGateProfileHash(profile: unknown = OBJECT_GATE_PROFILE): Promise<string> {
  return hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(profile)))).slice(0, 16);
}

/** 출구 판정. 막으면 사람이 읽을 이유를 돌려준다(null = 통과). */
export function objectGateRefusal(input: {
  receipt: ObjectGateReceipt | null | undefined;
  pixelSha256: string;
  kind?: ObjectGateKind;
  context: ObjectGateContext;
  calibratedProfiles: ReadonlySet<string>;
  /** front_prop 종류의 사람 승인 기록(없으면 null). 이 그림 해시에 묶인 유효한 승인이 있을 때만 3/4 반쪽을 면제한다. */
  approval?: ObjectGateFrontPropApproval | null;
  /** 사람 결정(서명 확인을 마친 것만 넘긴다). 거절이면 최종 차단. 허용은 Opus 최종 기록이 없을 때만 통과로 센다(2026-10-21). */
  hold?: ObjectGateHoldDecision | null;
  /** Opus 최종 판정 기록(final/<해시>.json). 보정된 최종 프로필의 것만 효력이 있다. */
  final?: ObjectGateFinal | null;
  calibratedFinalProfiles?: ReadonlySet<string>;
}): string | null {
  const { receipt, pixelSha256, kind, context } = input;
  // 2026-10-21: Opus 최종 판정이 우선이다. 사람 거절만 그 위에 있다.
  const final = finalApplies(input.final, pixelSha256, input.calibratedFinalProfiles) ? input.final : null;
  if (final) {
    if (kind && final.kind !== kind) return `최종 판정 종류(${final.kind})가 요청 종류(${kind})와 다르다`;
    const finalHuman = humanDecision(input.hold, { pixelSha256, kind: final.kind } as ObjectGateReceipt);
    if (finalHuman === 'reject') return `사람이 검토 화면에서 거절했다(${input.hold!.decidedBy}, ${input.hold!.decidedAt.slice(0, 10)}) — 최종이다. 다시 그려 새 해시로 다시 받아라`;
    if (final.verdict === 'pass') return null;
    if (context === 'workshop-local' && receipt?.pixelSha256 === pixelSha256 && receipt.override?.by === 'human') return null;
    const why = final.reasons.length ? final.reasons.join(' · ') : 'fail';
    return `Opus 최종 판정 불합격(${why}) — 다시 그려 새 해시로 다시 받아라`;
  }
  if (!receipt) return '3/4·화풍 판정 영수증이 없다 — object-gate final-review 로 Opus 최종 판정을 받아라';
  if (receipt.pixelSha256 !== pixelSha256) return '영수증의 그림 해시가 지금 그림과 다르다 — 고친 뒤 다시 판정받아라';
  if (kind && receipt.kind !== kind) return `영수증 종류(${receipt.kind})가 요청 종류(${kind})와 다르다`;
  // 사람 결정이 최종이다(2026-10-20). 허용 = 통과(프로필 보정 여부·AI 판정과 무관), 거절 = 모든 출구에서 막는다.
  const human = humanDecision(input.hold, receipt);
  if (human === 'reject') return `사람이 검토 화면에서 거절했다(${input.hold!.decidedBy}, ${input.hold!.decidedAt.slice(0, 10)}) — 최종이다. 다시 그려 새 해시로 다시 받아라`;
  if (human === 'allow') return null;
  if (!input.calibratedProfiles.has(receipt.profileHash)) return `판정 프로필 ${receipt.profileHash} 가 보정되지 않았다 — AI 판정(${receipt.verdict})은 조언일 뿐이다. Opus 최종 판정(object-gate final-review)을 받아라`;
  // front_prop: 사람이 이 그림 해시에 대해 종류를 승인했다면 3/4 반쪽은 면제 — 남은 것은 화풍 반쪽의 판정뿐이다. 승인이 없으면 아래 보류 경로(번들·공용·스토어 출구 차단).
  if (receipt.kind === 'front_prop' && validFrontPropApproval(input.approval, pixelSha256)) {
    const styleVerdict = receipt.style?.verdict;
    if (styleVerdict === 'pass') return null;
    if (styleVerdict === 'refer') return `화풍 판정 보류(정면형 소품은 사람이 종류를 승인했으나 화풍 반쪽이 사람 확인 필요) — 보류는 통과로 세지 않는다`;
    return `화풍 불합격(정면형 소품은 3/4 면제를 승인받았으나 화풍 반쪽이 떨어졌다: ${receipt.style?.reasons?.join(' · ') || 'fail'})`;
  }
  if (receipt.verdict === 'pass') return null;
  if (receipt.verdict === 'refer') {
    // 보류는 통과로 세지 않는다(번들·공용·스토어 출구는 예외 없이 막는다). 공방 로컬만 사람이 직접 누른 「그래도 넣기」로 확인할 수 있다(Python refusal 과 같다).
    if (context === 'workshop-local' && receipt.override?.by === 'human') return null;
    return `판정 보류(사람 확인 필요: ${receipt.reasons.join(' · ') || '판정자 의견이 갈림'}) — 보류는 통과로 세지 않는다. 그림을 더 분명하게 고치거나 사람이 고르는 하네스 경로를 거쳐라`;
  }
  if (context === 'workshop-local' && receipt.override?.by === 'human') return null;
  const why = receipt.reasons.length ? receipt.reasons.join(' · ') : 'fail';
  return context === 'workshop-local'
    ? `판정 불합격(${why}) — 다시 그리거나 사람이 「그래도 넣기」를 눌러야 한다`
    : `판정 불합격(${why}) — ${context} 출구는 예외 없이 막는다`;
}
