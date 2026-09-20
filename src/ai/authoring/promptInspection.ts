/** Shared with the worker: never retain headers, config, credentials or raw image bytes. */
export interface PromptSection { name: string; text: string; characters: number; omittedCharacters: number }
export interface PromptInspection {
  at: number;
  boundary: string;
  model: string;
  sections: PromptSection[];
  toolNames: string[];
  estimatedTokens: number;
  truncation: string;
}
const MAX_DISPLAY_CHARS = 80000;
const SECRET_FIELD = /^(?:authorization|proxy.authorization|(?:x.)?api.?key|token|client.?secret|access.?token|refresh.?token|id.?token|password|secret|credentials?|cookie|set.cookie)$/iu;
export function redactPromptText(text: string, secrets: readonly string[] = []): string {
  let result = text;
  for (const secret of secrets) if (secret.length >= 4) result = result.split(secret).join('[REDACTED]');
  return result
    .replace(/\bBearer\s+[^\s"'<>]+/giu, 'Bearer [REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/gu, '[REDACTED]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)["']?\s*[:=]\s*["']?)[^\s"',}&]+/giu, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/giu, '$1[REDACTED]@')
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gu, '[image/binary omitted]');
}
function scrub(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') return redactPromptText(value, secrets);
  if (Array.isArray(value)) return value.map(item => scrub(item, secrets));
  if (!value || typeof value !== 'object') return value;
  const kind = (value as { type?: unknown }).type;
  if (kind === 'image' || kind === 'image_url' || kind === 'input_image') return '[image omitted]';
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    SECRET_FIELD.test(key) ? '[REDACTED]' : key === 'inlineData' || key === 'inline_data' || key === 'image_url' ? '[image omitted]' : scrub(item, secrets)]));
}
export function inspectPromptPayload(payload: unknown, boundary: string, model: string, secrets: readonly string[] = []): PromptInspection {
  const clean = scrub(payload, secrets);
  const root = clean && typeof clean === 'object' && !Array.isArray(clean) ? clean as Record<string, unknown> : { payload: clean };
  let budget = MAX_DISPLAY_CHARS;
  let characters = 0;
  const sections = Object.entries(root).map(([name, value]) => {
    const full = typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? '';
    characters += full.length;
    const text = full.slice(0, budget);
    budget -= text.length;
    return { name, text, characters: full.length, omittedCharacters: full.length - text.length };
  });
  const toolNames = new Set<string>();
  const visitTools = (value: unknown, insideTools = false): void => {
    if (Array.isArray(value)) { value.forEach(item => visitTools(item, insideTools)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (insideTools && key === 'name' && typeof child === 'string') toolNames.add(child);
      if (key !== 'parameters' && key !== 'parametersJsonSchema' && key !== 'input_schema') visitTools(child, insideTools || key === 'tools' || key === 'functionDeclarations');
    }
  };
  visitTools(clean);
  return { at: Date.now(), boundary, model: redactPromptText(model, secrets), sections, toolNames: [...toolNames],
    estimatedTokens: Math.ceil(characters / 3),
    truncation: '전송 직전 본문을 관측했습니다. 상위 단계의 맥락 압축·제거량은 이 경계에서 알 수 없습니다. 표시 생략은 각 절에 별도로 표시합니다. 이미지 토큰·제공자 내부 처리는 추정에 포함되지 않습니다.' };
}
let latest: PromptInspection | null = null;
let epoch = 0;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) { try { listener(); } catch { /* diagnostics cannot break transport */ } } };
export function inspectionEpoch(): number { return epoch; }
export function publishPromptInspection(snapshot: PromptInspection, expectedEpoch = epoch): void {
  if (expectedEpoch !== epoch) return;
  latest = snapshot;
  notify();
}
export function latestPromptInspection(): PromptInspection | null { return latest; }
export function clearPromptInspection(): void { latest = null; epoch += 1; notify(); }
export function subscribePromptInspection(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
