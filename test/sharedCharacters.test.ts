import { afterEach, describe, expect, it } from 'vitest';
import { ensureSharedCharacters, installSharedCharacters, sharedCharacterSemantics } from '@/project/sharedCharacters';
import { listCharacterSprites, exportCharacterGraphics } from '@/project/characterGraphics';
import { sharedCharacterGraphicsProject, validateSharedCharacterGraphics } from '@/project/sharedCharacterGraphics';
import { queryNpcGraphics } from '@/assets/charsetQuery';
import type { Project } from '@/project/types';
import type { SharedContentLibrary } from '@/project/sharedContentSchema';

const id = 'shared_charset_actor_0123456789abcdef01234567';
function library(): SharedContentLibrary {
  return { version:1, projectDefaults:true, roots:[], places:{}, tilesets:{}, maps:{}, previews:{}, sourceProjectId:'fixture',
    assets:{[id]:{id, kind:'charset', name:'청록 배달원', dataUrl:'data:image/png;base64,iVBORw0KGgo=', meta:{width:288,height:256,frameWidth:24,frameHeight:32,frames:96}}},
    characters:{[id]:{assetId:id,characterIndex:0, description:{label:'청록 배달원',role:'배달원',appearance:'청록 바람막이를 입은 사람',attributes:{clothing:'청록 바람막이'},tags:['배달']},
      source:{candidateId:'fixture/person',base:'Actor1:0',inspected:{},acceptance:{decision:'accept'}}}} };
}
function install(value = library()) { installSharedCharacters({revision:'fixture',libraries:{kept:value}}); }
function project(): Project { return {assets:{uploaded:{}}, resourceProfiles:[],charsetLabels:[]} as unknown as Project; }
afterEach(() => installSharedCharacters({revision:'empty',libraries:{}}));

describe('Human-kept shared character catalog', () => {
  it('adds the same single usable character to new and existing projects without guessing age', () => {
    install();
    const fresh=project(), existing=project();
    existing.assets.uploaded.other={id:'other',name:'저자 그림',kind:'picture',dataUrl:'data:image/png;base64,AA==',meta:{}};
    for (const value of [fresh,existing]) {
      expect(ensureSharedCharacters(value)).toBe(true);
      expect(listCharacterSprites(value).filter(sprite=>sprite.textureKey===id)).toHaveLength(1);
      expect(value.resourceProfiles[0]?.characterSlots?.[0]?.graphicAttributes?.age).toBeUndefined();
      expect(ensureSharedCharacters(value)).toBe(false);
    }
    expect(existing.assets.uploaded.other?.name).toBe('저자 그림');
  });
  it('preserves author labels, face choices and existing pixels on reload', () => {
    install(); const value=project(); ensureSharedCharacters(value);
    const asset=value.assets.uploaded[id]!;
    value.charsetLabels![0]={...value.charsetLabels![0]!,label:'우리 프로젝트의 이름',origin:'user'};
    const slot=value.resourceProfiles[0]!.characterSlots![0]!;
    slot.status='mapped'; slot.faceResourceId='easyrpg-faceset-actor1-00'; slot.graphicAttributes={age:'노년'};
    expect(ensureSharedCharacters(value)).toBe(false);
    expect(value.assets.uploaded[id]).toBe(asset);
    expect(value.charsetLabels![0]?.label).toBe('우리 프로젝트의 이름');
    expect(slot.faceResourceId).toBe('easyrpg-faceset-actor1-00');
    expect(slot.graphicAttributes.age).toBe('노년');
  });
  it('exposes name, clothing and role to NPC discovery as uploaded graphics', () => {
    install();
    for (const query of ['청록 배달원','청록 바람막이','배달원']) {
      const result=queryNpcGraphics(query,50).find(match=>match.entry.textureKey===id);
      expect(result?.entry.spriteType).toBe('uploaded');
    }
    const value=library(); value.characters![id]!.description.attributes!.age='청년'; install(value);
    expect(sharedCharacterSemantics()[0]?.age).toBe('youth');
  });
  it('withdraws discovery while retaining project pixels and keeping the remaining face catalog readable', () => {
    install(); const value=project(); ensureSharedCharacters(value);
    const document=exportCharacterGraphics(sharedCharacterGraphicsProject());
    const pixels=value.assets.uploaded[id];
    installSharedCharacters({revision:'withdrawn',libraries:{}});
    expect(queryNpcGraphics('청록 배달원',50).some(match=>match.entry.textureKey===id)).toBe(false);
    expect(ensureSharedCharacters(value)).toBe(false);
    expect(value.assets.uploaded[id]).toBe(pixels);
    expect(validateSharedCharacterGraphics(document).mappings.some(row=>row.textureKey===id)).toBe(false);
  });
  it.each([
    ['고양이형 갑각 짐승', '바위 지대의 필드 몬스터'],
    ['붉은 갑피를 가진 소 계열 사족 마수', '근거리 돌진'],
    ['닭 계열의 언데드 조류 몬스터', '묘지 길목'],
  ])('classifies the authored species rather than requiring an exact tag: %s', (kind, role) => {
    const value = library(), description = value.characters![id]!.description;
    description.attributes = {kind}; description.role = role; install(value);
    expect(sharedCharacterSemantics()[0]?.tags).toContain('몬스터');
    expect(queryNpcGraphics('monster', 100).some(match => match.entry.textureKey === id)).toBe(true);
    expect(queryNpcGraphics('people', 100).some(match => match.entry.textureKey === id)).toBe(false);
    const p = project(); ensureSharedCharacters(p);
    expect(p.charsetLabels![0]?.tags).toContain('몬스터');
  });
  it('does not classify a human hunter by a monster word in their role or clothes', () => {
    const value = library(), description = value.characters![id]!.description;
    description.attributes = {kind:'사람',clothing:'몬스터 문양 재킷'};
    description.role = '몬스터 사냥꾼'; install(value);
    expect(sharedCharacterSemantics()[0]?.tags).not.toContain('몬스터');
    expect(queryNpcGraphics('monster', 100).some(match => match.entry.textureKey === id)).toBe(false);
  });
  it('does not index absent traits or a removed feather as visible features', () => {
    const value = library(), description = value.characters![id]!.description;
    description.attributes = {kind:'몬스터',hair:'청록 비늘; 긴 털과 갈기 없음',clothing:'옷 없음; 별도 갑피 없이 이마의 작은 황금빛 표식'};
    description.appearance = '청록 몸과 황금빛 표식. 원본의 깃털과 큰 무기는 제거했다.';
    install(value);
    for (const query of ['깃털','갈기','갑피','옷']) {
      expect(queryNpcGraphics(query,100).some(match => match.entry.textureKey === id)).toBe(false);
    }
    expect(queryNpcGraphics('황금빛 표식',100).some(match => match.entry.textureKey === id)).toBe(true);
    expect(description.appearance).toContain('깃털');
  });
});
