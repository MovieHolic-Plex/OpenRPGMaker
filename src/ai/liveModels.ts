// 제공자가 «지금 실제로 내주는» 모델 목록의 공용 모양과 순수 해석기.
//
// 왜: 모델 목록을 코드에 박아 두면 새 모델이 나올 때마다 사람이 고쳐야 했다(2026-11-28 실측: Codex 백엔드는
// gpt-6.1-terra·gpt-5.6-terra·gpt-5.6-luna 를 이미 내주는데 설정 화면에는 없었다). 동반 서비스가 GPT(Codex 백엔드 /models)와
// Claude(Anthropic /v1/models)의 실제 목록을 받아 오고, 편집기는 그 목록을 기존 프리셋 뒤에 덧붙여 보여 준다.
// Google 은 이 경로에 없다(계정 직접 OAuth 비활성화).
//
// 이 모듈은 브라우저 번들과 순수 Node(동반 서비스) 양쪽에서 로드된다 — `@/` 별칭 없이 상대 경로 + 확장자만 쓴다.
import { modelDisplayName } from "./modelDisplayName.ts";

export type LiveModelFamily = "gpt" | "claude";
export const LIVE_MODEL_FAMILIES: readonly LiveModelFamily[] = ["gpt", "claude"];

export function isLiveModelFamily(value: unknown): value is LiveModelFamily {
  return value === "gpt" || value === "claude";
}

export interface LiveModel {
  readonly id: string;
  readonly label: string;
}

export type LiveModelSource = "codex-backend" | "anthropic-api" | "anthropic-compat";

/** 동반 서비스(GET /v1/models)의 응답. 목록을 못 받아도 HTTP 200 + ok:false 다 — 호출부는 프리셋으로 물러난다. */
export type LiveModelResult =
  | { readonly ok: true; readonly family: LiveModelFamily; readonly source: LiveModelSource; readonly fetchedAt: number; readonly models: readonly LiveModel[] }
  | { readonly ok: false; readonly family: LiveModelFamily; readonly reason: "no-credential" | "upstream-error" | "timeout"; readonly message: string; readonly fetchedAt: number };

/** GPT 모델 id 의 화면 이름: `gpt-6.2-sol` → `GPT-6.2 Sol`(설정 화면이 이미 쓰는 표기). */
export function gptModelLabel(id: string): string {
  return modelDisplayName(id).replace(/^GPT (?=\d)/u, "GPT-");
}

const GPT_ID = /^gpt-[a-z0-9][a-z0-9._-]*$/iu;
const CLAUDE_ID = /^claude-[a-z0-9][a-z0-9._-]*$/iu;

export function isGptModelId(id: string): boolean {
  return GPT_ID.test(id.trim());
}

export function isClaudeModelId(id: string): boolean {
  return CLAUDE_ID.test(id.trim());
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * Codex 백엔드 `GET /backend-api/codex/models` 응답 → 고를 수 있는 GPT 모델.
 * 서버가 `visibility: "hide"` 로 숨긴 것(gpt-reserve·codex-auto-review 등 내부용)과 `supported_in_api:false` 는 뺀다.
 * 순서는 서버의 `priority` 다(작을수록 앞) — 서버가 권하는 순서를 그대로 따른다.
 */
export function parseCodexModelList(payload: unknown): LiveModel[] {
  const rows = Array.isArray(record(payload)?.models) ? record(payload)!.models as unknown[] : [];
  const picked: Array<{ model: LiveModel; priority: number; index: number }> = [];
  rows.forEach((row, index) => {
    const item = record(row);
    const slug = typeof item?.slug === "string" ? item.slug.trim() : "";
    if (!item || !slug || !isGptModelId(slug)) return;
    if (item.visibility === "hide" || item.supported_in_api === false) return;
    const priority = typeof item.priority === "number" && Number.isFinite(item.priority) ? item.priority : Number.MAX_SAFE_INTEGER;
    picked.push({ model: { id: slug, label: gptModelLabel(slug) }, priority, index });
  });
  picked.sort((a, b) => a.priority - b.priority || a.index - b.index);
  return dedupe(picked.map((entry) => entry.model));
}

/**
 * Anthropic `GET /v1/models` 응답(`{ data: [{ id, display_name }] }`) → Claude 모델.
 * 서버가 준 순서(최신 우선)를 지킨다. claude-* 가 아닌 항목(프록시가 섞어 내는 다른 계열)은 뺀다.
 */
export function parseAnthropicModelList(payload: unknown): LiveModel[] {
  const rows = Array.isArray(record(payload)?.data) ? record(payload)!.data as unknown[] : [];
  const out: LiveModel[] = [];
  for (const row of rows) {
    const item = record(row);
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!item || !id || !isClaudeModelId(id)) continue;
    const name = typeof item.display_name === "string" ? item.display_name.trim() : "";
    out.push({ id, label: name || modelDisplayName(id) });
  }
  return dedupe(out);
}

function dedupe(models: readonly LiveModel[]): LiveModel[] {
  const seen = new Set<string>();
  const out: LiveModel[] = [];
  for (const model of models) {
    const key = model.id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(model);
  }
  return out;
}

export interface ModelOption {
  readonly id: string;
  readonly label: string;
  /** true 면 코드에 박힌 프리셋이 아니라 서버 목록에서만 온 모델. */
  readonly live: boolean;
}

/**
 * 프리셋(코드에 박힌 권장 목록)을 앞에, 서버 목록에서 새로 알게 된 모델을 뒤에 붙인다. 같은 id 는 프리셋 한 번만.
 * 서버 목록이 비어 있거나 없으면 프리셋 그대로다 — 목록을 못 받는 것이 설정 화면을 비우지 않는다.
 */
export function mergeModelOptions(
  presets: readonly { readonly id: string; readonly label: string }[],
  live: readonly LiveModel[] | undefined,
): ModelOption[] {
  const out: ModelOption[] = presets.map((preset) => ({ id: preset.id, label: preset.label, live: false }));
  const known = new Set(out.map((option) => option.id.toLowerCase()));
  for (const model of live ?? []) {
    if (known.has(model.id.toLowerCase())) continue;
    known.add(model.id.toLowerCase());
    out.push({ id: model.id, label: model.label, live: true });
  }
  return out;
}
