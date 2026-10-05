import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { createPiToolset } from '@/ai/piAgent/toolAdapter';
import { PiCharsetSelectionGate } from '@/ai/piAgent/charsetSelectionGate';
import { charsetPreviewCandidates, drawCharsetPreview } from '@/ai/charsetPreview';
import { resolveGraphic } from '@/editor/tools/eventCompile';

const GOLEM = 'charset:tex_easyrpg_charset_monster2:4';
const KING = 'charset:tex_easyrpg_charset_people3:0';
const result = { ok: true, summary: '골렘', data: { matches: [{ selectionId: GOLEM, label: '스톤 골렘' }] } } as const;
function credit(gate: PiCharsetSelectionGate, shape = 'responses', image = 'golem-png', success = true) {
  gate.offer('list_npc_graphics', result, 'golem-png');
  const text = JSON.stringify(result);
  gate.payload(shape === 'gemini' ? { contents: [{ parts: [{ functionResponse: { name: 'list_npc_graphics', response: { output: text } } }, { inlineData: { mimeType: 'image/png', data: image } }] }] }
    : shape === 'anthropic' ? { messages: [{ content: [{ type: 'tool_result', content: [{ type: 'text', text }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } }] }] }] }
    : { input: [{ type: 'function_call_output', output: text }, { type: 'input_image', image_url: `data:image/png;base64,${image}` }] });
  gate.complete(success);
}
function changed() {
  const before = createBlankProject(), after = structuredClone(before), mapId = before.startMapId;
  after.maps[mapId]!.events.push({ id: 'golem', name: '골렘', x: 4, y: 4, pages: [{ id: 'golem-page', graphic: resolveGraphic({ selectionId: GOLEM }) }] } as never);
  return { before, after, mapId };
}

describe('charset selection evidence', () => {
  it('credits Gemini multimodal function responses with a legend inside the JSON envelope', () => {
    const { before, after } = changed(), gate = new PiCharsetSelectionGate();
    gate.offer('list_npc_graphics', result, 'golem-png');
    // Actual pi-ai google-shared serializer: all text blocks are joined, images
    // are nested in functionResponse.parts on Gemini 3+ (including Antigravity).
    const wire = (output: string) => ({ request: { contents: [{ role: 'user', parts: [{ functionResponse: {
      name: 'list_npc_graphics', response: { output }, parts: [{ inlineData: { mimeType: 'image/png', data: 'golem-png' } }],
    } }] }] } });
    gate.payload(wire(`${JSON.stringify(result)}\n1: 스톤 골렘`));
    expect(gate.complete(true)).toEqual([]);
    expect(gate.afterWrite(before, after)?.ok).toBe(false);
    gate.payload(wire(JSON.stringify({ ...result, imageLegend: '1: 스톤 골렘' })));
    expect(gate.complete(true)).toEqual([GOLEM]);
    expect(gate.afterWrite(before, after)).toBeNull();
  });
  it.each(['responses', 'gemini', 'anthropic'])('accepts the exact pictured candidate after a successful %s turn', shape => {
    const { before, after } = changed(), gate = new PiCharsetSelectionGate();
    expect(gate.afterWrite(before, after)?.ok).toBe(false);
    credit(gate, shape);
    expect(gate.afterWrite(before, after)).toBeNull();
  });
  it.each(['wrong-image', 'aborted', 'text-only', 'truncated'])('rejects %s reading evidence', variant => {
    const { before, after } = changed(), gate = new PiCharsetSelectionGate();
    if (variant === 'wrong-image' || variant === 'aborted') credit(gate, 'responses', variant === 'wrong-image' ? 'king-png' : 'golem-png', variant !== 'aborted');
    else {
      gate.offer('list_npc_graphics', result, 'golem-png');
      gate.payload({ input: [{ type: 'function_call_output', output: JSON.stringify(variant === 'truncated' ? { ok: true, dataTruncated: true, data: result.data } : result) },
        ...(variant === 'truncated' ? [{ type: 'input_image', image_url: 'data:image/png;base64,golem-png' }] : [])] });
      gate.complete(true);
    }
    expect(gate.afterWrite(before, after)?.ok).toBe(false);
  });
  it('rejects king substitution and slot/frame confusion after viewing a golem', () => {
    const { before, after, mapId } = changed(), gate = new PiCharsetSelectionGate(); credit(gate);
    const graphic = after.maps[mapId]!.events.at(-1)!.pages![0]!.graphic;
    graphic.sprite = { type: 'bundled', id: 'tex_easyrpg_charset_people3' }; graphic.pattern = 25;
    expect(gate.afterWrite(before, after)?.summary).toContain('「왕」');
    graphic.sprite.id = 'tex_easyrpg_charset_monster2'; graphic.pattern = 4;
    expect(gate.afterWrite(before, after)?.ok).toBe(false);
    expect(() => resolveGraphic({ selectionId: KING, query: '골렘' })).toThrow(/후보가 아닙니다/);
  });
  it('resolves a selected slot without manual frame arithmetic', () => {
    expect(resolveGraphic({ selectionId: GOLEM, query: '골렘' })).toEqual({ sprite: { type: 'bundled', id: 'tex_easyrpg_charset_monster2' }, direction: 'down', pattern: 73 });
  });
  it('provides pictured candidates for uploaded sheets and gates their native graphics', async () => {
    const before = createBlankProject(), after = structuredClone(before);
    before.assets.uploaded.custom_golem = { id: 'custom_golem', kind: 'charset', name: '내 골렘', dataUrl: 'data:image/png;base64,fixture', meta: {} };
    after.assets.uploaded = structuredClone(before.assets.uploaded);
    const list = createPiToolset({ project: before }).find(tool => tool.name === 'list_resources')!;
    const response = await list.execute('custom', { kind: 'charset', query: 'custom_golem' });
    const candidates = charsetPreviewCandidates('list_resources', response.details.data);
    expect(candidates).toHaveLength(8);
    const matches = (response.details.data as { matches: { nativeGraphic: unknown }[] }).matches;
    after.maps[after.startMapId]!.events.push({ id: 'custom', name: '골렘', x: 4, y: 4,
      pages: [{ id: 'page', graphic: matches[4]!.nativeGraphic }] } as never);
    const gate = new PiCharsetSelectionGate();
    expect(gate.afterWrite(before, after)?.ok).toBe(false);
    gate.offer('list_resources', response.details, 'custom-image');
    gate.payload({ input: [{ type: 'function_call_output', output: response.content[0]!.type === 'text' ? response.content[0]!.text : '' },
      { type: 'input_image', image_url: 'data:image/png;base64,custom-image' }] });
    gate.complete(true);
    expect(gate.afterWrite(before, after)).toBeNull();
  });
  it('keeps existing graphics on text/position edits, including reordered events', () => {
    const { after } = changed(), edited = structuredClone(after);
    edited.maps[edited.startMapId]!.events.reverse();
    const golem = edited.maps[edited.startMapId]!.events.find(e => e.id === 'golem')!;
    golem.x++; golem.name = '다른 이름';
    expect(new PiCharsetSelectionGate().afterWrite(after, edited)).toBeNull();
  });
  it('rolls a failed write back atomically and shares evidence with discovered tools', async () => {
    const ctx = { project: createBlankProject() }, gate = new PiCharsetSelectionGate();
    const initial = ctx.project;
    const tools = createPiToolset(ctx, { charsetGate: gate });
    const place = tools.find(t => t.name === 'place_npc')!;
    const args = { mapId: initial.startMapId, id: 'golem', name: '골렘', x: 4, y: 4, graphic: { selectionId: GOLEM, query: '골렘' }, pages: [{ lines: ['안녕.'] }] };
    await expect(place.execute('fail', args)).rejects.toThrow(/선택을 되돌렸습니다/);
    expect(ctx.project).toBe(initial);
    credit(gate);
    await expect(place.execute('ok', args)).resolves.toBeTruthy();
    expect(ctx.project.maps[initial.startMapId]!.events.find(e => e.id === 'golem')!.pages![0]!.graphic.pattern).toBe(73);
  });
  it('renders the actual golem source cell at a visible scale, in result order', () => {
    const data = new Uint8ClampedArray(288 * 256 * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 1; data[i + 3] = 255; }
    // Independent RM2000 coordinates: slot 4, down middle frame = (24,192), 24x32.
    for (let y = 192; y < 224; y++) for (let x = 24; x < 48; x++) { const i = (y * 288 + x) * 4; data[i] = 120; data[i + 1] = 80; data[i + 2] = 40; }
    const candidates = charsetPreviewCandidates('list_npc_graphics', result.data);
    const image = drawCharsetPreview(candidates, () => ({ width: 288, height: 256, data }));
    const i = (22 * image.width + 8) * 4;
    expect([...image.data.slice(i, i + 4)]).toEqual([120, 80, 40, 255]);
    expect(image.width).toBe(112); expect(image.height).toBe(154);
    expect(charsetPreviewCandidates('list_resources', { matches: [{ id: GOLEM, label: '스톤 골렘' }] })).toEqual(candidates);
  });
  it('keeps a full browse page within the render protocol image size', () => {
    const sheet = { width: 288, height: 256, data: new Uint8ClampedArray(288 * 256 * 4) };
    const candidates = Array.from({ length: 50 }, (_, i) => ({ selectionId: `charset:sheet:${i % 8}`, textureKey: 'sheet', characterIndex: i % 8, label: '후보' }));
    const image = drawCharsetPreview(candidates, () => sheet);
    expect(image.width).toBe(504); expect(image.height).toBe(480);
  });
});
