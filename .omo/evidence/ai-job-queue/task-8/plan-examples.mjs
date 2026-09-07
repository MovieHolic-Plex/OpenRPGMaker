// Machine-consumed examples, not fabricated complete job results. GROK supplies opaque image response JSON.
import { PROJECT_ID, hash } from './qa-wire.mjs';
import { canonicalJson } from '../../../../scripts/lib/aiJobs/validation.mjs';
export function familyPlans({ tilesetId, tileIds, imageResponse, provider = 'google-antigravity' }) {
  if (!tilesetId || !Array.isArray(tileIds) || !tileIds.length || !imageResponse?.image?.dataUrl?.startsWith('data:image/')) {
    throw new Error('Supply a disposable tileset, selected tile IDs and an opaque provider image response');
  }
  const text = content => ({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) } }] });
  const tool = (name, args) => ({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null,
    tool_calls: [{ id: `task8-${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
  const intent = (tools, region = false) => text({ mode: 'modify', space: region ? 'outdoor' : 'none', facility: null,
    targetMapId: null, useSelection: region, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false,
    tools, summary: 'Controlled disposable QA change', source: 'llm' });
  const op = (key, response, kind = 'text', hold = false) => ({ key, kind, provider: kind === 'image' ? 'google-antigravity' : provider,
    response, responseSha256: hash(canonicalJson(response)), hold });
  const plan = (id, family, operations, operation) => ({ id, match: { family, projectId: PROJECT_ID, ...(operation ? { operation } : {}) }, operations });
  const session = (prefix, responses) => responses.map((response, index) => op(`${prefix}/provider/${index}`, response, 'text', index === 0));
  const mapResponses = region => [intent(['create_map'], region), tool('create_map', { name: region ? 'Task8 Region Room' : 'Task8 Assistant Room', width: 8, height: 8 }), text('Review the controlled map proposal.')];
  const cluster = operation => plan(`tileset-${operation}`, 'tileset', session(`tileset/${operation}`, [
    intent(['upsert_tile_group']), tool('upsert_tile_group', { tilesetId, name: `Task8 ${operation}`, tileIds, role: 'prop', defaultLayer: 'lower' }), text('Review the controlled tile group.')]), operation);
  const knowledge = text({ summary: 'Controlled captured atlas review', proposals: [{ template: 'desk', tileIds, name: 'Task8 Desk', confidence: 0.7 }] });
  const analysis = (operation, response) => plan(`tileset-${operation}`, 'tileset', [op(`tileset/${operation}/provider/0`, response, 'text', true)], operation);
  return [
    plan('assistant', 'assistant', session('assistant', mapResponses(false))),
    plan('region', 'region', session('region', mapResponses(true))),
    plan('database-artwork', 'database', [op('database/text', text({ name: 'Task8 Fixture Potion', price: 37 }), 'text', true), op('database/artwork', imageResponse, 'image')]),
    plan('event-commands', 'event-commands', [op('event-commands/assist/0', text([{ kind: 'text', body: 'Task8 retained command' }]), 'text', true)]),
    cluster('cluster-edit'), cluster('range-classify'), cluster('unclassified-analysis'),
    analysis('knowledge-analysis', knowledge),
    analysis('proposal-draft', text({ tiles: tileIds.map(tile => ({ tile, label: `Task8 tile ${tile}` })) })),
    analysis('question-followup', knowledge),
    analysis('structure-kit-metadata', text({ description: 'Task8 captured structure', tags: ['fixture'], placement: [{ zone: 'againstWall', facing: 'north', strength: 'hard' }] })),
    plan('image', 'image', [op('image/provider/generate', imageResponse, 'image', true)]),
  ];
}
