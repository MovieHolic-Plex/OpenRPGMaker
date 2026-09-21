import { describe, expect, it, afterEach } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { deserialize, serialize } from '@/project/io';
import { applyTemplate, normalizeAiAuthoring, templateSlots } from '@/project/aiAuthoring';
import { collectDialogue, checkDialogueStructure, parseDialogueFindings } from '@/ai/authoring/dialogueInventory';
import { clearPromptInspection, inspectPromptPayload, inspectionEpoch, latestPromptInspection, publishPromptInspection, redactPromptText } from '@/ai/authoring/promptInspection';
import type { Command } from '@/project/types';

function dialogueProject() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  const commands: Command[] = [
    { kind: 'text', speaker: '안내인', body: '여행자님, 안녕하세요.' },
    { kind: 'choices', prompt: '어디로 갈까요?', options: [{ text: '광장', branch: [{ kind: 'loop', body: [{ kind: 'text', body: ' 기다려요. ' }] }] }], cancelBranch: [{ kind: 'text', body: '' }] },
  ];
  map.events.push({ id: 'guide', name: '안내인', x: 1, y: 1, trigger: { kind: 'action' }, commands: [{ kind: 'text', body: 'LEGACY MIRROR' }], pages: [
    { id: 'one', name: '첫 만남', conditions: [], graphic: {}, trigger: { kind: 'action' }, priority: 'same', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands },
    { id: 'two', name: '다음 만남', conditions: [], graphic: {}, trigger: { kind: 'action' }, priority: 'same', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', speaker: '경비병', body: '멈춰!' }] },
  ] });
  return project;
}

describe('feature16 project preferences and library', () => {
  it('keeps old projects absent and roundtrips editable templates and style rules through actual IO', () => {
    const project = createBlankProject();
    expect(deserialize(serialize(project)).aiAuthoring).toBeUndefined();
    project.aiAuthoring = { templates: [{ id: 'greet', name: '인사', tags: ['마을', '대사'], body: '{{인물}}: {{인사}}' }], dialogueStyleRules: '존댓말을 쓴다.', maxDialogueChars: 80 };
    const loaded = deserialize(serialize(project));
    expect(loaded.aiAuthoring).toEqual(project.aiAuthoring);
    loaded.aiAuthoring!.templates[0].name = '수정한 이름';
    expect(deserialize(serialize(loaded)).aiAuthoring!.templates[0].name).toBe('수정한 이름');
    loaded.aiAuthoring!.templates = [];
    expect(deserialize(serialize(loaded)).aiAuthoring!.templates).toEqual([]);
  });
  it('normalizes corrupt optional fields, duplicates, tags and nonfinite lengths idempotently', () => {
    const value = normalizeAiAuthoring({ templates: [null, { id: 'x', name: ' 이름 ', body: 'hello', tags: [' a ', 'a', 3] }, { id: 'x', name: 'duplicate', body: 'gone' }], maxDialogueChars: NaN, dialogueStyleRules: 2 });
    expect(value).toEqual({ templates: [{ id: 'x', name: '이름', body: 'hello', tags: ['a'] }], dialogueStyleRules: '', maxDialogueChars: 240 });
    expect(normalizeAiAuthoring(value)).toEqual(value);
    expect(normalizeAiAuthoring(undefined).templates).toEqual([]);
  });
  it('fills every unique slot literally and rejects missing/prototype-inherited values', () => {
    expect(templateSlots('{{ 인물 }} / {{인물}} / {{장소}}')).toEqual(['인물', '장소']);
    expect(applyTemplate('{{인물}} {{인물}}', { 인물: '$& <script>' })).toBe('$& <script> $& <script>');
    expect(() => applyTemplate('{{constructor}}', {})).toThrow();
    expect(() => applyTemplate('{{인물}}', { 인물: '  ' })).toThrow();
  });
});

describe('feature16 dialogue collection and grounded review', () => {
  it('collects choices, prompts, nested branches and all pages without legacy duplication', () => {
    const rows = collectDialogue(dialogueProject());
    expect(rows).toHaveLength(6);
    expect(rows.map(row => row.kind)).toEqual(['text', 'prompt', 'choice', 'text', 'text', 'text']);
    expect(rows.at(-1)?.pageId).toBe('two');
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.some(row => row.text.includes('LEGACY'))).toBe(false);
    expect(rows.find(row => row.text.includes('기다려'))?.path).toContain('branch');
  });
  it('uses legacy commands when no pages exist, and separates structural checks from LLM claims', () => {
    const project = dialogueProject();
    project.maps[project.startMapId].events[0].pages = [];
    expect(collectDialogue(project).map(row => row.text)).toEqual(['LEGACY MIRROR']);
    const findings = checkDialogueStructure(collectDialogue(dialogueProject()), 5);
    expect(findings.some(item => item.message.includes('비어'))).toBe(true);
    expect(findings.some(item => item.message.includes('공백'))).toBe(true);
    expect(findings.every(item => item.source === 'structure')).toBe(true);
  });
  it('rejects hallucinated sources/quotes and malformed success instead of calling it a clean review', () => {
    const rows = collectDialogue(dialogueProject());
    const valid = { rowId: rows[0].id, quote: '여행자님', message: '규칙상 호칭을 통일하세요.' };
    expect(parseDialogueFindings(JSON.stringify({ findings: [valid] }), rows)[0].source).toBe('llm');
    expect(parseDialogueFindings('{"findings":[]}', rows)).toEqual([]);
    for (const item of [{ ...valid, rowId: 'imaginary' }, { ...valid, quote: 'not in source' }, { ...valid, quote: '' }]) {
      expect(() => parseDialogueFindings(JSON.stringify({ findings: [item] }), rows)).toThrow();
    }
    expect(() => parseDialogueFindings('{}', rows)).toThrow();
  });
});

describe('feature16 actual request projection', () => {
  afterEach(clearPromptInspection);
  it('redacts credentials in nested objects and text before retention without mutating the request', () => {
    const payload = { messages: [{ role: 'user', content: 'key=known-private-value Bearer abc123 api_key="some-other-key"' }], authorization: 'private', nested: { access_token: 'secret', inlineData: { data: 'binary' } }, tools: [{ type: 'function', function: { name: 'get_event', parameters: { name: { type: 'string' } } } }] };
    const snapshot = inspectPromptPayload(payload, 'actual boundary', 'model', ['known-private-value']);
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('known-private-value'); expect(json).not.toContain('abc123'); expect(json).not.toContain('some-other-key');
    expect(json).not.toContain('binary'); expect(snapshot.toolNames).toEqual(['get_event']);
    expect(payload.authorization).toBe('private');
    expect(snapshot.sections.map(section => section.name)).toEqual(Object.keys(payload));
    expect(redactPromptText('https://user:pass@host/?access_token=abc')).not.toContain('pass');
  });
  it('bounds retained display, reports omissions, and rejects late results after clearing lifecycle', () => {
    const snapshot = inspectPromptPayload({ messages: 'x'.repeat(100000) }, 'wire', 'model');
    expect(snapshot.sections[0].text.length).toBe(80000);
    expect(snapshot.sections[0].omittedCharacters).toBe(20000);
    expect(snapshot.estimatedTokens).toBe(Math.ceil(100000 / 3));
    const oldEpoch = inspectionEpoch(); publishPromptInspection(snapshot, oldEpoch);
    expect(latestPromptInspection()).toEqual(snapshot);
    clearPromptInspection(); publishPromptInspection(snapshot, oldEpoch);
    expect(latestPromptInspection()).toBeNull();
  });
});
