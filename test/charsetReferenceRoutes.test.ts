import { describe, expect, it } from 'vitest';
import { searchResources } from '@/assets/resourceSearch';
import { CHARSET_SEMANTICS } from '@/assets/charsetSemantics';
import { queryNpcGraphics } from '@/assets/charsetQuery';
import { QUERY_TOOLS } from '@/editor/tools/queryTools';
import { createBlankProject } from '@/project/defaults';
import reviewed from '@/assets/sharedCharacterGraphics.json';

describe('Character reference paths use the audited walking chip', () => {
  it('resource search finds both golems and the king, and rejects different hair', () => {
    expect(searchResources('charset', 'king').map(row => row.id)).toEqual(['charset:tex_easyrpg_charset_people3:0']);
    expect(searchResources('charset', 'golem').map(row => row.id).sort()).toEqual([
      'charset:tex_easyrpg_charset_monster2:4', 'charset:tex_easyrpg_charset_monster4:5',
    ]);
    expect(searchResources('charset', '흑발 여성 마법사')).toEqual([]);
    expect(searchResources('charset', 'animal').filter(row => row.id.includes('tex_farming_'))).toHaveLength(2);
  });
  it('keeps the full resource result beyond the NPC tool limit', () => {
    const overrides = CHARSET_SEMANTICS.map(row => ({textureKey:row.textureKey, characterIndex:row.characterIndex, label:'공통 칩'}));
    expect(queryNpcGraphics('공통 칩', 1000, overrides)).toHaveLength(100);
    const result = searchResources('charset', '공통 칩', {charsetLabels:overrides});
    expect(new Set(result.map(row => row.id)).size).toBe(CHARSET_SEMANTICS.length);
    expect(result).toHaveLength(CHARSET_SEMANTICS.length);
  });
  it('describes paired walking chips with the current canonical name', async () => {
    const tool = QUERY_TOOLS.find(tool => tool.name === 'list_resources')!;
    const project = createBlankProject();
    const expected = reviewed.mappings.find(row => row.textureKey === 'tex_easyrpg_charset_actor3' && row.characterIndex === 4)!;
    const result = await tool.run(project, {kind:'faceset',query:'빨간 모자 녹색 코트 여인',limit:50});
    const matches = (result.data as {matches:{id:string;description:string}[]}).matches;
    const face = matches.find(row => row.id === expected.faceResourceId);
    expect(face?.description).toContain('tex_easyrpg_charset_actor3#4 빨간 모자 녹색 코트 여인');
    expect(face?.description).not.toContain('녹색 후드');
  });
  it('preserves a project author name in the paired walking description', async () => {
    const tool = QUERY_TOOLS.find(tool => tool.name === 'list_resources')!;
    const project = createBlankProject();
    project.charsetLabels = [{textureKey:'tex_easyrpg_charset_actor3',characterIndex:4,label:'우리 약초꾼',origin:'user'}];
    const result = await tool.run(project, {kind:'faceset',query:'우리 약초꾼',limit:50});
    expect((result.data as {matches:{description:string}[]}).matches.some(row => row.description.includes('actor3#4 우리 약초꾼'))).toBe(true);
  });
});
