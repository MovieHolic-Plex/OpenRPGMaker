/**
 * 공용 오브젝트 게이트 — 영수증·해시·출구 판정(브라우저·노드 공용, Web Crypto 만 쓴다).
 *
 * 영수증은 그림 화소 해시(pixelSha256)에 묶인다. 한 화소라도 바뀌면 영수증이 없어져 다시 판정받아야 한다.
 * 출구(context)마다 받는 조건이 다르다:
 *   bundle·shared·store → 보정된 프로필의 「pass」 영수증만. 사람 덮어쓰기도 받지 않는다(예외 없음).
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
  style?: ObjectGateHalfVerdict & { styleKind: ObjectGateStyleKind; refs: string[]; scale: number; score?: number };
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
}): string | null {
  const { receipt, pixelSha256, kind, context } = input;
  if (!receipt) return '3/4·화풍 판정 영수증이 없다 — object-gate review 를 먼저 받아라';
  if (receipt.pixelSha256 !== pixelSha256) return '영수증의 그림 해시가 지금 그림과 다르다 — 고친 뒤 다시 판정받아라';
  if (kind && receipt.kind !== kind) return `영수증 종류(${receipt.kind})가 요청 종류(${kind})와 다르다`;
  if (!input.calibratedProfiles.has(receipt.profileHash)) return `판정 프로필 ${receipt.profileHash} 가 보정되지 않았다(위반 표본을 다 잡지 못했거나 보정 전)`;
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
