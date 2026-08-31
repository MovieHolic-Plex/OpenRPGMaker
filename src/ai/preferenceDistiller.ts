// ai/preferenceDistiller.ts
// 집계된 신호를 성향 문장으로 증류한다. lite 모델 1회 호출 — 비싼 감독 모델을 쓰지 않는다.
//
// 왜 LLM 이 필요한가: 결정론 집계는 "author_house 를 8회 썼고 그중 2회 되돌려졌다"까지만 안다.
// 그 숫자를 그대로 프롬프트에 넣으면 모델이 통계로 읽고 행동을 바꾸지 않는다. "집은 2채 이하로,
// 규모를 키우지 말 것" 같은 지시 가능한 문장으로 바꾸는 단계가 필요하다.
//
// 실패는 조용히 무시한다 — 카운터는 이미 저장돼 있으므로 손실이 없고, 다음 턴에 다시 시도한다.
// 연속 실패가 상한에 닿으면 preferenceSignals 가 pending 앞 절반을 버려 큐가 막히지 않게 한다.
//
// assistantSession 을 import 하지 않는다(그쪽은 툴 레지스트리 전체를 끌고 온다). 필요한 것은
// chatCompletion 시그니처뿐이라 ChatFn 을 여기서 좁게 정의한다.

import {
  chatCompletion,
  configForLiteModel,
  loadAiConfig,
  type AiConfig,
  type ChatRequest,
  type ChatResult,
} from "./llmClient";
import {
  dropPreferenceFactsUnpinned,
  loadPreferenceFacts,
  upsertPreferenceFacts,
  type PreferenceScope,
  type PreferenceStrength,
  type PreferenceUpsertInput,
} from "./preferenceMemory";
import {
  consumePendingSignals,
  loadPreferenceSignals,
  notePreferenceDistillFailure,
  shouldDistillPreferences,
  type PreferenceSignalState,
} from "./preferenceSignals";

type ChatFn = (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;

export interface DistillResult {
  /** 모델 호출까지 갔고 파싱에 성공했는가. 트리거 조건 미달로 건너뛴 경우도 false. */
  readonly ok: boolean;
  readonly upserted: number;
  readonly dropped: number;
  /** 건너뛴 이유(진단용). 실행됐으면 undefined. */
  readonly skipped?: "not-due" | "no-signals";
}

export const DISTILL_SYSTEM_PROMPT = [
  "당신은 RPG 에디터 사용자의 작업 성향을 정리하는 요약기입니다.",
  "입력은 (1) 이미 기억된 성향 목록, (2) 축별 긍정/부정 집계, (3) 최근 신호 원문입니다.",
  "",
  "규칙:",
  "- 출력은 JSON 객체 하나. 마크다운·코드펜스·설명 금지.",
  "- 형식: {\"upsert\":[{\"text\":string,\"scope\":\"global\"|\"project\",\"strength\":\"strong\"|\"medium\"|\"weak\"}],\"drop\":[id]}",
  "- text 는 한국어 한 문장, 120자 이내. 지시 가능한 선호로 쓰세요(예: \"마을 규모는 집 4채 이하로 작게 유지한다\").",
  "- 통계를 그대로 옮기지 마세요. \"author_house 8회\" 같은 툴 이름·횟수는 text 에 넣지 않습니다.",
  "- scope: 사람의 습관·취향은 global. 특정 게임에서만 참인 사실(장르·세계관·톤 설정)은 project.",
  "- strength: 부정 신호가 3회 이상 누적됐거나 사용자가 명시 선언했으면 strong, 근거가 한두 건이면 weak.",
  "- 근거가 약하면 아무것도 만들지 마세요. upsert 는 최대 3건. 빈 배열이 정답인 경우가 많습니다.",
  "- drop 에는 새 신호와 정면으로 모순되는 기존 성향의 id 만 넣으세요. 근거 없이 지우지 마세요.",
].join("\n");

/** 집계를 모델이 읽을 형태로 요약한다. 부정이 우세한 축을 먼저 보여 준다. */
export function formatCountersForDistill(state: PreferenceSignalState, limit = 12): string {
  const rows = Object.entries(state.counters)
    .map(([key, counter]) => ({ key, ...counter, net: counter.pos - counter.neg }))
    .filter((row) => row.pos > 0 || row.neg > 0)
    .sort((a, b) => a.net - b.net)
    .slice(0, limit);
  if (rows.length === 0) return "(집계 없음)";
  return rows.map((row) => `- ${row.key}: 긍정 ${row.pos} / 부정 ${row.neg}`).join("\n");
}

export function formatPendingForDistill(state: PreferenceSignalState): string {
  if (state.pending.length === 0) return "(신호 없음)";
  const label: Record<string, string> = {
    undo: "되돌림",
    correction: "정정",
    stated: "사용자 선언",
    settled: "유지",
  };
  return state.pending
    .map((signal) => {
      const head = `- [${label[signal.kind] ?? signal.kind}] 지시: ${signal.instruction}`;
      return signal.note && signal.note !== signal.instruction ? `${head}\n  반응: ${signal.note}` : head;
    })
    .join("\n");
}

export function buildDistillUserPayload(state: PreferenceSignalState, projectScopeKey?: string): string {
  const facts = loadPreferenceFacts();
  const scopeKey = projectScopeKey?.trim();
  const known = facts
    .filter((fact) => fact.scope === "global" || (scopeKey ? fact.projectScopeKey === scopeKey : false))
    .map((fact) => `- ${fact.id} [${fact.scope}/${fact.strength}${fact.pinned ? "/고정" : ""}] ${fact.text}`);
  return [
    "## 이미 기억된 성향",
    known.length > 0 ? known.join("\n") : "(없음)",
    "",
    "## 축별 집계(부정 우세 순)",
    formatCountersForDistill(state),
    "",
    "## 최근 신호 원문",
    formatPendingForDistill(state),
  ].join("\n");
}

interface ParsedDistill {
  readonly upsert: readonly { readonly text: string; readonly scope: PreferenceScope; readonly strength: PreferenceStrength }[];
  readonly drop: readonly string[];
}

/** 모델 출력 파싱. 코드펜스가 섞여 와도 첫 JSON 객체를 건져낸다. 실패하면 null. */
export function parseDistillResponse(raw: string): ParsedDistill | null {
  const json = extractJsonObject(raw);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const rec = parsed as Record<string, unknown>;
  const upsert: { text: string; scope: PreferenceScope; strength: PreferenceStrength }[] = [];
  if (Array.isArray(rec.upsert)) {
    for (const entry of rec.upsert.slice(0, 3)) {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as Record<string, unknown>;
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) continue;
      const scope: PreferenceScope = row.scope === "project" ? "project" : "global";
      const strength: PreferenceStrength =
        row.strength === "strong" ? "strong" : row.strength === "medium" ? "medium" : "weak";
      upsert.push({ text, scope, strength });
    }
  }
  const drop = Array.isArray(rec.drop)
    ? rec.drop.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  // upsert 도 drop 도 없으면 파싱은 성공이지만 반영할 것이 없다 — ok 로 처리해 pending 을 비운다
  // (모델이 "근거가 약해 만들 것 없음" 이라고 판단한 정상 결과다).
  return { upsert, drop };
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/u.exec(trimmed);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    if (inner.startsWith("{")) return inner;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

export interface DistillOptions {
  readonly projectScopeKey?: string;
  /** 테스트/대체용 chat 구현. 기본은 lite 설정의 chatCompletion. */
  readonly chat?: ChatFn;
  readonly config?: AiConfig;
  /** 트리거 조건을 무시하고 강제 실행(설정 화면의 "지금 정리" 용). */
  readonly force?: boolean;
  readonly signal?: AbortSignal;
}

/**
 * 성향 증류 1회. 트리거 조건 미달이면 아무것도 하지 않고 skipped 로 돌려준다.
 * 어떤 실패도 throw 하지 않는다 — 호출부는 턴 종료 직후의 fire-and-forget 경로다.
 */
export async function distillPreferences(options: DistillOptions = {}): Promise<DistillResult> {
  const state = loadPreferenceSignals();
  if (state.pending.length === 0) return { ok: false, upserted: 0, dropped: 0, skipped: "no-signals" };
  if (!options.force && !shouldDistillPreferences(state)) {
    return { ok: false, upserted: 0, dropped: 0, skipped: "not-due" };
  }

  const chat = options.chat ?? chatCompletion;
  const config = options.config ?? configForLiteModel(loadAiConfig());
  let raw = "";
  try {
    const result = await chat(config, {
      messages: [
        { role: "system", content: DISTILL_SYSTEM_PROMPT },
        { role: "user", content: buildDistillUserPayload(state, options.projectScopeKey) },
      ],
      response_format: { type: "json_object" },
      ...(options.signal ? { signal: options.signal } : {}),
    });
    raw = typeof result.message.content === "string" ? result.message.content : "";
  } catch {
    notePreferenceDistillFailure();
    return { ok: false, upserted: 0, dropped: 0 };
  }

  const parsed = parseDistillResponse(raw);
  if (!parsed) {
    notePreferenceDistillFailure();
    return { ok: false, upserted: 0, dropped: 0 };
  }

  const scopeKey = options.projectScopeKey?.trim();
  const inputs: PreferenceUpsertInput[] = [];
  for (const entry of parsed.upsert) {
    // project 스코프인데 키를 모르면 전역으로 내린다. 버리면 사용자가 방금 선언한 취향이 사라진다.
    const scope: PreferenceScope = entry.scope === "project" && scopeKey ? "project" : "global";
    inputs.push({
      text: entry.text,
      scope,
      ...(scope === "project" && scopeKey ? { projectScopeKey: scopeKey } : {}),
      strength: entry.strength,
      source: "observed",
    });
  }
  const dropped = dropPreferenceFactsUnpinned(parsed.drop);
  const upserted = inputs.length > 0 ? upsertPreferenceFacts(inputs) : 0;
  consumePendingSignals();
  return { ok: true, upserted, dropped };
}
