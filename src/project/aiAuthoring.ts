/** Project-owned authoring preferences. Absent on older projects; no schema bump. */
export interface PromptTemplate {
  id: string;
  name: string;
  tags: string[];
  body: string;
}
export interface AiAuthoring {
  templates: PromptTemplate[];
  dialogueStyleRules: string;
  maxDialogueChars: number;
}
export const TEMPLATE_BODY_LIMIT = 20000;
export const STYLE_RULES_LIMIT = 12000;
export function normalizeAiAuthoring(value: unknown): AiAuthoring {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ids = new Set<string>();
  const templates: PromptTemplate[] = [];
  if (Array.isArray(raw.templates)) for (const item of raw.templates) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) continue;
    if (typeof item.name !== 'string' || !item.name.trim() || typeof item.body !== 'string') continue;
    ids.add(item.id);
    templates.push({ id: item.id, name: item.name.trim().slice(0, 120), body: item.body.slice(0, TEMPLATE_BODY_LIMIT),
      tags: Array.isArray(item.tags) ? [...new Set<string>(item.tags.filter((tag: unknown): tag is string => typeof tag === 'string').map((tag: string) => tag.trim().slice(0, 60)).filter(Boolean))].slice(0, 30) : [] });
  }
  return { templates, dialogueStyleRules: typeof raw.dialogueStyleRules === 'string' ? raw.dialogueStyleRules.slice(0, STYLE_RULES_LIMIT) : '',
    maxDialogueChars: typeof raw.maxDialogueChars === 'number' && Number.isFinite(raw.maxDialogueChars) ? Math.max(1, Math.min(10000, Math.round(raw.maxDialogueChars))) : 240 };
}
export function templateSlots(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/gu)].map(match => match[1].trim()))];
}
export function applyTemplate(body: string, values: Readonly<Record<string, string>>): string {
  const missing = templateSlots(body).filter(slot => !Object.hasOwn(values, slot) || !values[slot].trim());
  if (missing.length) throw new Error(`변수 값을 입력하세요: ${missing.join(', ')}`);
  return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_match, slot: string) => values[slot.trim()]);
}
