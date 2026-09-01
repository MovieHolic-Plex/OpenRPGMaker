// editor/operators/operatorIntent.ts
// 의도 파서 — 한 문장을 "어느 생성기를, 어떤 파라미터로" 로 옮긴다.
//
// **모델은 타일도 좌표도 만지지 않는다.** 산출물은 JSON 한 덩이(op + params)뿐이고,
// 그것마저 레지스트리 스펙으로 검증·클램프된 뒤에야 생성기에 닿는다. 이게 이 파일의 요지다 —
// 조수 경로가 좌표·타일 인덱스를 직접 뱉어서 생긴 문제(균일 산포·비결정성·게이트 증식)를
// 반복하지 않으려면 모델의 출력 표면이 이만큼 좁아야 한다.
//
// 프롬프트는 레지스트리에서 생성한다. 오퍼레이터를 추가해도 이 파일을 고칠 필요가 없다.
//
// LLM 이 없거나 실패해도 기능이 죽지 않게 키워드 폴백을 함께 둔다. 폴백으로 해석했으면
// source: "heuristic" 으로 그 사실을 밝힌다 — 사용자가 "AI 가 이해했다" 고 오해하면 안 된다.

import { clampOperatorParams, type OperatorDef, type OperatorParamSpec } from "./operatorTypes";
import { getOperator, listOperators } from "./operatorRegistry";

export interface OperatorIntent {
  readonly operatorId: string;
  readonly params: Record<string, number | boolean>;
  /** llm = 모델이 해석 · heuristic = 키워드 폴백. 사용자에게 그대로 밝힌다. */
  readonly source: "llm" | "heuristic";
  /** 로그·요약에 그대로 실리는 사람용 한 줄(예: "숲 · 밀도 0.9 · 오솔길 끔"). */
  readonly note: string;
}

export interface OperatorIntentFailure {
  readonly error: string;
}

export type OperatorIntentResult = OperatorIntent | OperatorIntentFailure;

export function isOperatorIntentFailure(value: OperatorIntentResult): value is OperatorIntentFailure {
  return (value as OperatorIntentFailure).error !== undefined;
}

function describeParam(spec: OperatorParamSpec): string {
  const hint = spec.hint ? ` — ${spec.hint}` : "";
  if (spec.kind === "toggle") {
    return `  · ${spec.id} (${spec.label}): true|false, 기본 ${spec.defaultValue}${hint}`;
  }
  return `  · ${spec.id} (${spec.label}): ${spec.min}~${spec.max} 사이 수, 기본 ${spec.defaultValue}${hint}`;
}

/** 레지스트리를 그대로 프롬프트로 옮긴다 — 오퍼레이터 추가 시 프롬프트 수정 불필요. */
export function buildOperatorIntentPrompt(operators: readonly OperatorDef[] = listOperators()): string {
  const catalog = operators.map((operator) => {
    const params = operator.params.map(describeParam).join("\n");
    return `- ${operator.id} (${operator.label}): ${operator.hint}\n${params}`;
  }).join("\n");
  return [
    "너는 RPG 맵 편집기의 의도 파서다. 사용자의 한 문장을 아래 생성기 하나와 파라미터로 옮긴다.",
    "타일 번호·좌표·배치는 절대 만들지 마라 — 그것은 생성기가 한다. 너는 무엇을 얼마나 할지만 고른다.",
    "",
    "사용 가능한 생성기:",
    catalog,
    "",
    "규칙:",
    "- JSON 객체 하나만 출력한다. 설명·코드펜스 금지.",
    '- 형식: {"op": "<생성기 id>", "params": {"<파라미터 id>": <값>}}',
    "- 문장에서 읽히는 파라미터만 넣는다. 언급이 없으면 넣지 마라(기본값이 쓰인다).",
    "- 범위를 벗어난 값은 금지. 모르는 파라미터 이름도 금지.",
    "- 정도를 나타내는 말은 수치로 옮긴다. 예: 울창하게/빽빽하게 → 밀도 0.85~0.95, 성기게/듬성듬성 → 0.25~0.35.",
  ].join("\n");
}

/** 코드펜스·잡담이 섞여 와도 첫 JSON 객체를 건져낸다. */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

/** 사람이 읽는 한 줄 — 기본값과 다른 것만 적는다(무엇을 바꿨는지가 정보다). */
export function describeIntent(def: OperatorDef, params: Record<string, number | boolean>): string {
  const changed = def.params
    .filter((spec) => params[spec.id] !== spec.defaultValue)
    .map((spec) => {
      const value = params[spec.id];
      if (spec.kind === "toggle") return `${spec.label} ${value ? "켬" : "끔"}`;
      return `${spec.label} ${value}`;
    });
  return changed.length > 0 ? `${def.label} · ${changed.join(" · ")}` : `${def.label} · 기본 설정`;
}

/**
 * 모델 응답(또는 아무 JSON 문자열)을 검증된 의도로 바꾼다.
 * 스펙 밖 키·범위 초과·모르는 op 는 여기서 전부 걸러진다 — 생성기는 검증을 하지 않아도 된다.
 */
export function parseOperatorIntentJson(text: string, source: "llm" | "heuristic" = "llm"): OperatorIntentResult {
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== "object") return { error: "생성기 의도를 JSON 으로 읽지 못했습니다." };
  const record = raw as Record<string, unknown>;
  const opId = typeof record.op === "string" ? record.op : typeof record.operatorId === "string" ? record.operatorId : "";
  const def = getOperator(opId);
  if (!def) {
    const known = listOperators().map((operator) => operator.id).join(", ");
    return { error: `모르는 생성기입니다: ${opId || "(없음)"} — 가능한 값: ${known}` };
  }
  const rawParams = (record.params && typeof record.params === "object" && !Array.isArray(record.params))
    ? record.params as Record<string, number | boolean>
    : {};
  const params = clampOperatorParams(def, rawParams);
  return { operatorId: def.id, params, source, note: describeIntent(def, params) };
}

// ── 키워드 폴백 ──
// LLM 이 없거나 실패했을 때의 최소 해석. 모델을 흉내 내려 하지 않고, 확실한 말만 잡는다.
type KeywordRule = { readonly test: RegExp; readonly apply: Record<string, number | boolean> };

const FOREST_KEYWORDS: readonly KeywordRule[] = [
  { test: /울창|빽빽|무성|우거|빼곡|짙은/, apply: { density: 0.9 } },
  { test: /성기|듬성|드문|한산|드물/, apply: { density: 0.3 } },
  { test: /고사목|죽은\s*나무|마른\s*나무|앙상/, apply: { deadRatio: 0.3 } },
  { test: /덤불|수풀|풀숲|하층/, apply: { underbrush: 0.9 } },
  { test: /공터|빈터|빈\s*터|광장/, apply: { clearings: 2 } },
  { test: /길\s*없|오솔길\s*없|길은\s*빼/, apply: { path: false } },
  { test: /오솔길|산책로|샛길/, apply: { path: true } },
];

const OPERATOR_KEYWORDS: readonly { readonly id: string; readonly test: RegExp }[] = [
  { id: "forest", test: /숲|나무|수목|삼림|우거|나무를/ },
];

/** 문장에서 확실한 것만 읽는다. 생성기를 특정하지 못하면 실패로 남긴다(추측하지 않는다). */
export function heuristicOperatorIntent(instruction: string): OperatorIntentResult {
  const text = instruction.trim();
  if (!text) return { error: "무엇을 만들지 한 문장으로 적어 주세요." };
  const matched = OPERATOR_KEYWORDS.find((entry) => entry.test.test(text));
  const def = matched ? getOperator(matched.id) : undefined;
  if (!def) {
    const known = listOperators().map((operator) => operator.label).join(", ");
    return { error: `문장에서 생성기를 알아내지 못했습니다 — 지금 쓸 수 있는 것: ${known}` };
  }
  const applied: Record<string, number | boolean> = {};
  if (def.id === "forest") {
    for (const rule of FOREST_KEYWORDS) {
      if (rule.test.test(text)) Object.assign(applied, rule.apply);
    }
  }
  const params = clampOperatorParams(def, applied);
  return { operatorId: def.id, params, source: "heuristic", note: describeIntent(def, params) };
}

export interface OperatorIntentDeps {
  /** 한 번 호출하고 문자열을 돌려준다. 없으면 키워드 폴백만 쓴다. */
  readonly complete?: (system: string, user: string) => Promise<string>;
  readonly operators?: readonly OperatorDef[];
}

/**
 * 문장 → 의도. LLM 이 있으면 한 번 부르고, 없거나 실패하면 키워드로 떨어진다.
 * 어느 쪽으로 해석했는지는 `source` 로 항상 밝힌다.
 */
export async function resolveOperatorIntent(
  instruction: string,
  deps: OperatorIntentDeps = {},
): Promise<OperatorIntentResult> {
  const text = instruction.trim();
  if (!text) return { error: "무엇을 만들지 한 문장으로 적어 주세요." };
  if (deps.complete) {
    try {
      const reply = await deps.complete(buildOperatorIntentPrompt(deps.operators), text);
      const parsed = parseOperatorIntentJson(reply, "llm");
      if (!isOperatorIntentFailure(parsed)) return parsed;
      // 모델이 형식을 어겼다 — 조용히 실패하지 말고 키워드로 한 번 더 시도한다.
      const fallback = heuristicOperatorIntent(text);
      return isOperatorIntentFailure(fallback) ? parsed : fallback;
    } catch (cause) {
      const fallback = heuristicOperatorIntent(text);
      if (!isOperatorIntentFailure(fallback)) return fallback;
      return { error: cause instanceof Error ? cause.message : String(cause) };
    }
  }
  return heuristicOperatorIntent(text);
}
