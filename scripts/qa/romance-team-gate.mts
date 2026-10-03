// Synthetic provider-boundary checks; not live AI/image evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { runPiTeam } from '../lib/piTeamRuntime';
import { defaultTeamSpec } from '../../src/ai/piAgent/teamSpec';
import type { PiAgentDoneEvent } from '../../src/ai/piAgent/protocol';
const project = JSON.parse(fs.readFileSync('output/qa/romance-scene/authored.json','utf8'));
const stats = {ms:1,turns:1,toolCalls:0,toolErrors:0};
const cases = ['draft-three-finishes','no-finish','no-image','stale-image','stale-tileset','valid-review'] as const;
const receipts = [];
for (const name of cases) {
 const p = structuredClone(project);
 if (name === 'draft-three-finishes') p.maps[p.startMapId].events.find(e=>e.id==='ev_romance_partner').pages[0].id='ev_romance_partner_draft';
 let rejected = 0;
 const request = {mode:'team' as const,provider:'synthetic',task:'첫 만남 구현 검사',project:p,mapIds:[p.startMapId],team:defaultTeamSpec()};
 try {
  await runPiTeam(request, {runAgent: async (r, options) => {
   const done: PiAgentDoneEvent = {type:'done',project:r.project,stats,changedKeys:[]};
   const tool = (id: string) => options!.extraTools!.find(t=>t.name===id)!;
   if (options?.extraTools?.some(t=>t.name==='report_review')) {
    if (name !== 'no-image') options.onEvent?.({type:'execution_status',name:'map.image.delivered',ok:true,summary:'synthetic image receipt'});
    await tool('report_review').execute('review',{ok:true,findings:[]});return done;
   }
   if (options?.extraTools?.some(t=>t.name==='report_task')) { await tool('report_task').execute('task',{report:'synthetic read-only review'});return done; }
   if (name === 'no-finish') return done;
   if (name === 'draft-three-finishes') {
    for (let i=0;i<3;i++) {try {await tool('finish').execute('finish',{report:'false completion'});}catch {rejected++;}}
    assert.equal(rejected,3);return done;
   }
   await tool('review_map').execute('review',{mapId:p.startMapId});
   if (name === 'stale-image') r.project.maps[p.startMapId].events.find(e=>e.id==='ev_romance_partner')!.pages![0]!.commands.unshift({kind:'text',body:'검수 후 새로 바뀐 대사입니다.'});
   if (name === 'stale-tileset') r.project.tilesets[r.project.maps[p.startMapId].tilesetId]!.tileGrafts=[];
   try {await tool('finish').execute('finish',{report:'verified scene'});}catch {rejected++;}
   return done;
  }});
  assert.equal(name,'valid-review','accepted invalid completion');receipts.push({name,accepted:true});
 } catch (error) {
  assert.notEqual(name,'valid-review',String(error));receipts.push({name,accepted:false,rejectedFinishes:rejected,reason:String(error)});
 }
}
fs.writeFileSync('verify-shots/romance-scene/team-gate-proof.json',JSON.stringify({synthetic:true,cases:receipts},null,2)+'\n');
console.log(JSON.stringify(receipts));
