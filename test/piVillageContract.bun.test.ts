import { expect, test } from 'bun:test';
import { resolveVillageContract, validateVillageContract, villageDraftReceipt, assertVillageContractArgs } from '../src/ai/piAgent/villageContract';
import { connectContractVillage } from '../src/ai/piAgent/villageConnection';
import { parseConstructionDeclaration } from '../src/ai/constructionDeclaration';
import { createBlankProject } from '../src/project/defaults';
import { runTool } from '../src/editor/tools/toolRunner';
import type { IntentDeclaration } from '../src/ai/intentDeclaration';
const intent = { source: 'llm', mode: 'create', tools: ['author_village'], construction: { houseCount: 2, npcCount: 0 } } as IntentDeclaration;
test('zero residents survives intent parsing; bounds and exact counts are locked before tool execution', () => {
 const base=createBlankProject();
 expect(parseConstructionDeclaration({ npcCount:0 })?.npcCount).toBe(0);
 const contract=resolveVillageContract(base,{...intent,useSelection:true},base.startMapId,{mapId:base.startMapId,x:20,y:10,width:24,height:30})!;
 expect(contract.npcCount).toBe(0);
 expect(contract.args.target).toEqual({kind:'existing',mapId:base.startMapId,bounds:{x:20,y:10,w:24,h:30}});
 expect(()=>assertVillageContractArgs(contract,{...contract.args,npcCount:1})).toThrow();
 expect(validateVillageContract(base,base,contract).issues).toContain('요청한 마을이 시공되지 않았습니다.');
});
test('a silent village passes without taste heuristics; post-build geometry tampering fails', () => {
 const base=createBlankProject();const contract=resolveVillageContract(base,intent,base.startMapId,null)!;
 const ctx={project:base}; const args={...contract.args,seed:7,interior:false};const result=runTool(ctx,'author_village',args);
 expect(result.ok).toBe(true);
 const receipt=villageDraftReceipt({name:'author_village',args,result},ctx.project)!;
 expect(validateVillageContract(ctx.project,base,contract,receipt).issues).toEqual([]);
 ctx.project.maps[contract.mapId]!.lowerTiles[0]=999;
 expect(validateVillageContract(ctx.project,base,contract,receipt).issues).toContain('구조 검사 이후 지형·건물·기존 이벤트가 변경되었습니다.');
});
test('an existing silent NPC outside the selected area is preserved and does not block completion', () => {
 const base=createBlankProject(); const map=base.maps[base.startMapId]!;
 map.width=90; map.height=60; map.lowerTiles=new Array(90*60).fill(map.lowerTiles[0]);map.upperTiles=new Array(90*60).fill(-1);
 map.events.push({id:'existing-silent',x:2,y:2,trigger:{kind:'action'},commands:[],pages:[]} as never);
 const contract=resolveVillageContract(base,{...intent,useSelection:true},map.id,{mapId:map.id,x:45,y:10,width:40,height:40})!;
 const ctx={project:base};const args={...contract.args,seed:7,interior:false};const result=runTool(ctx,'author_village',args);
 expect(result.ok).toBe(true);
 const receipt=villageDraftReceipt({name:'author_village',args,result},ctx.project)!;
 expect(validateVillageContract(ctx.project,base,contract,receipt).issues).toEqual([]);
 expect(ctx.project.maps[map.id]!.events.find(e=>e.id==='existing-silent')).toEqual(map.events[0]);
 expect(ctx.project.maps[map.id]!.lowerTiles[0]).toBe(map.lowerTiles[0]);
});
test('live regression: restoring the old blank-map centre must not strand the player', () => {
 const base=createBlankProject();const contract=resolveVillageContract(base,{...intent,construction:{houseCount:4,npcCount:0,morphology:"green"}},base.startMapId,null)!;
 const ctx={project:base};const args={...contract.args,morphology:'green',forestDensity:'normal',interior:true};
 const result=runTool(ctx,'author_village',args);expect(result.ok).toBe(true);
 const receipt=villageDraftReceipt({name:'author_village',args,result},ctx.project)!;
 expect(validateVillageContract(ctx.project,base,contract,receipt).issues).toEqual([]);
 const stranded=structuredClone(ctx.project);stranded.startPos={x:10,y:8};
 expect(validateVillageContract(stranded,base,contract,receipt).issues.join(' ')).toContain('문앞 도달 실패');
});
test('a genre preset brief is a whole-game request, never a one-village contract', () => {
 const base=createBlankProject();
 expect(resolveVillageContract(base,intent,base.startMapId,null,'장르 프리셋: 몬스터 수집\n\n## 사용자가 확정한 게임 기획')).toBeUndefined();
 expect(resolveVillageContract(base,intent,base.startMapId,null,'숲마을 하나 지어 줘')).toBeDefined();
});
// 2026-09-28 실측: 숲·길안내 NPC가 있는 시작 맵에서 「위로 올라가면 마을」이 target:{kind:"existing"} 계약으로 얼어
// author_village 가 village-requires-scope 로 5번 거부됐다. 방향이 있으면 새 맵 + 코드 연결, 방향 없는 내용 있는 맵은 계약 없음.
test('「위로 올라가면 마을」 builds a new map, links it north and keeps the start on the origin map', () => {
 const base=createBlankProject(); const origin=base.maps[base.startMapId]!;
 origin.events.push({id:'ev_guide',x:10,y:13,trigger:{kind:'action'},commands:[],pages:[]} as never);
 expect(resolveVillageContract(base,{...intent,construction:undefined},origin.id,null,'마을 만들어')).toBeUndefined();
 const construction=parseConstructionDeclaration({houseCount:2,npcCount:0,approach:'north'});
 const contract=resolveVillageContract(base,{...intent,construction},origin.id,null,'위로 올라가면 마을')!;
 expect(contract.args.target).toMatchObject({kind:'new',mapId:'map_village'});
 expect(contract.connection).toEqual({fromMapId:origin.id,side:'north'});
 const ctx={project:base};const args={...contract.args,seed:7,interior:false};const result=runTool(ctx,'author_village',args);
 expect(result.ok).toBe(true);
 const built=villageDraftReceipt({name:'author_village',args,result},ctx.project)!;
 expect(validateVillageContract(ctx.project,base,contract,built).issues.join(' ')).toContain('북쪽으로 마을에 가는 출입구가 없습니다');
 const linked=connectContractVillage(ctx,base,{fromMapId:origin.id,villageMapId:contract.mapId,side:'north',doorFronts:built.data.village.doorFronts??[]});
 expect(linked.ok).toBe(true);
 if(!linked.ok) return;
 expect(ctx.project.startMapId).toBe(origin.id);
 expect(ctx.project.startPos).toEqual(base.startPos);
 expect(linked.connection.originGate.y).toBeLessThan(base.startPos.y);
 const receipt={...built,built:structuredClone(ctx.project),connection:linked.connection};
 expect(validateVillageContract(ctx.project,base,contract,receipt).issues).toEqual([]);
});
