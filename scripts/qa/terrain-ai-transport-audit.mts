// Real SDK normalization of the exact terrain tool exposure used by the editor.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildRequest} from '@oh-my-pi/pi-ai/providers/google-gemini-cli';
import {getBundledModel} from '@oh-my-pi/pi-catalog';
import {createPiToolset} from '../../src/ai/piAgent/toolAdapter';
import {buildSessionRegistryTools} from '../../src/ai/sessionToolExposure';
import {antigravityToolEnumPayload,ToolSchemaTransportError} from '../lib/ohMyPiToolEnums';
const project=JSON.parse(fs.readFileSync('verify-shots/terrain-ai-edit/contracts/project.json','utf8'));
const task=fs.readFileSync('.vite-cache/terrain-ai-edit/task.txt','utf8');
const intent={mode:'modify',source:'llm',tools:['inspect_terrain','sculpt_relief','resize_terrain_house_roof','lay_terrain_road','check_terrain_access'],space:'none',targetMapId:'houses_native'} as any;
const names=buildSessionRegistryTools({requestText:task,intent,contextWindow:200000}).map(t=>t.function.name);
const tools=createPiToolset({project},{toolNames:[...new Set([...names,'edit_world_terrain','read_world_terrain'])]});
const source=JSON.stringify(tools),observations:any[]=[];
function level(payload:any){return payload.request.tools[0].functionDeclarations.find((d:any)=>d.name==='edit_world_terrain').parameters.properties.ops.items.properties.level;}
for(const id of ['gemini-3.7-flash','claude-opus-4-6']){
 const model=getBundledModel('google-antigravity',id)!;
 const wire=buildRequest(model as never,{messages:[{role:'user',content:'READY',timestamp:0}],tools} as never,'offline-project',{},true),original=JSON.stringify(wire);
 const encode=antigravityToolEnumPayload(id,tools),encoded=encode(wire);
 assert.deepEqual(level(encoded).enum,['1','2']);assert.equal(level(encoded).nullable,true);
 assert.equal(JSON.stringify(wire),original);assert.equal(JSON.stringify(tools),source);assert.deepEqual(encode(encoded),encoded);
 for(const corrupt of [(w:any)=>{level(w).enum=[1,3,null];},(w:any)=>{level(w).nullable=false;}]){
  const broken=structuredClone(wire);corrupt(broken);const old=JSON.stringify(broken);assert.throws(()=>encode(broken),ToolSchemaTransportError);assert.equal(JSON.stringify(broken),old);
 }
 observations.push({model:id,toolCount:tools.length,nullableIntegerEnumPreserved:true,sourceUnchanged:true,idempotent:true,broadenedEnumAndLostNullRejected:true});
}
for(const leaf of [{type:'integer',enum:[1,null]},{type:['integer','null'],enum:[1,2]},{type:['integer','null'],enum:[1,1,null]},{type:['integer','null'],enum:[1,1.5,null]},{type:['integer','null'],enum:[null]}]){
 assert.throws(()=>antigravityToolEnumPayload('offline',[{name:'invalid',parameters:{type:'object',properties:{level:leaf}}}]),ToolSchemaTransportError);
}
const proof={realSdkPayload:true,offlineNoProviderRequest:true,observations,malformedSchemasRejected:5};
fs.writeFileSync('verify-shots/terrain-ai-edit/contracts/transport.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
