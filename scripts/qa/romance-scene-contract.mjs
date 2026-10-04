// Focused production-tool, schema and adversarial interpreter checks. No live provider.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { withTsModule } from '../ontology-ts-loader.mjs';
const [input, output = 'verify-shots/romance-scene/contract-proof.json'] = process.argv.slice(2);
if (!input) throw Error('Usage: node scripts/qa/romance-scene-contract.mjs <baseline.json> [proof.json]');
const baseline = JSON.parse(fs.readFileSync(input));
let seed, authored;
await withTsModule('src/harnesses/_core/authoringRegistry.ts','registry.mjs',async m=>{assert.equal(m.authoringHarnessFor(baseline),undefined);assert(m.eligibleAuthoringHarnessFor(baseline));});
await withTsModule('src/project/playableSegment.ts','startup.mjs',async m=>{const prepared=m.withVerifiedPlayableSegment(baseline);assert.equal(prepared.gameDesignBrief.implementation.harnessId,'romance-scene');});
await withTsModule('src/harnesses/romance-scene/contract.ts','contract.mjs',async m=>{const p=structuredClone(baseline);p.gameDesignBrief.summary='주인공 이름은 민서. 이웃 이름은 하린. 장소는 달빛 정류장. 선택지는 기다린다 / 먼저 걷는다.';const c=m.compileRomanceContract(p);assert.deepEqual([c.protagonist,c.partner,c.place,...c.choices],['민서','하린','달빛 정류장','기다린다','먼저 걷는다']);});
await withTsModule('src/harnesses/romance-scene/runtime.ts', 'scene.mjs', async m => { seed = m.seedRomanceScene(baseline); assert(seed); });
await withTsModule('src/editor/tools/toolRunner.ts', 'tools.mjs', async ({runTool}) => {
  const ctx = {project: seed};
  const beforeWrite=JSON.stringify(ctx.project);
  const premature=runTool(ctx,'move_event',{mapId:ctx.project.startMapId,eventId:'ev_romance_partner',x:11,y:8});
  assert(!premature.ok && premature.issues.some(i=>i.code==='authoring-prerequisite'),JSON.stringify(premature));
  assert.equal(JSON.stringify(ctx.project),beforeWrite);
  const result = runTool(ctx, 'author_romance_scene', {
    opening: ['안녕하세요, 지우 씨. 저는 옆집에 사는 나래예요. 편지를 부치러 왔어요.'],
    reactionA: '먼저 인사해 줘서 긴장이 풀렸어요. 다음엔 제가 먼저 인사할게요.',
    reactionB: '이 편지는 아직 부치지 못했어요. 지우는 누구에게 편지를 써봤나요?',
    revisitA: '아까 먼저 인사해 준 일을 기억해요. 다시 와 줘서 고마워요.',
    revisitB: '아까 편지를 물어본 일을 기억해요. 다음에는 받는 사람 이야기도 해줄게요.',
    closing: '오늘 이야기해서 반가웠어요, 나래 씨. 다음에 또 인사할게요.',
  });
  assert(result.ok, JSON.stringify(result)); authored = ctx.project;
  const before = JSON.stringify(ctx.project);
  assert(!runTool(ctx, 'author_romance_scene', {opening:['x'], reactionA:'x',reactionB:'x',revisitA:'x',revisitB:'x',closing:'x'}).ok);
  assert.equal(JSON.stringify(ctx.project), before);
});
await withTsModule('src/project/io.ts', 'io.mjs', async m => {
  const reloaded = m.deserialize(m.serialize(authored));
  assert.deepEqual(reloaded.gameDesignBrief.implementation, authored.gameDesignBrief.implementation);
});
await withTsModule('src/harnesses/romance-scene/runtime.ts', 'scene.mjs', async m => {
  const npc = p => p.maps[p.startMapId].events.find(e => e.id === 'ev_romance_partner');
  const choices = p => npc(p).pages[0].commands.find(c => c.kind === 'choices');
  const cases = [
    ['provisional scene', p => npc(p).pages[0].id = 'ev_romance_partner_draft'],
    ['same reactions', p => choices(p).options[1].branch.at(-1).body = choices(p).options[0].branch.at(-1).body],
    ['duplicate relationship gain', p => npc(p).pages[1].commands.unshift({kind:'setVariable',variableId:'var_romance_relation',op:'+=',value:1})],
    ['invisible NPC', p => npc(p).pages[0].graphic.transparent = true],
    ['missing sprite', p => npc(p).pages[0].graphic.sprite.id = 'missing-asset'],
    ['changed protagonist', p => p.database.actors.find(a => a.id === 'actor_hero').name = '임의 변경'],
    ['changed protagonist appearance', p => {const a=p.database.actors.find(a => a.id === 'actor_hero');a.characterIndex=(a.characterIndex??0)+1;}],
    ['deleted contract', p => delete p.gameDesignBrief.implementation],
    ['changed choice', p => choices(p).options[0].text = '다른 선택'],
    ['stale brief', p => p.gameDesignBrief.summary += ' 다른 계획'],
    ['missing ending command', p => npc(p).pages.forEach(pg => pg.commands.forEach(c => {if(c.kind === 'choices') c.options.forEach(o => o.branch = o.branch.filter(b => b.kind !== 'triggerEnding'));}))],
    ['unreachable NPC', p => {npc(p).x = -10;}],
  ];
  const runtime = m.inspectRomanceScene(authored, seed); assert(runtime.ok, JSON.stringify(runtime));
  const mutants = cases.map(([name, mutate]) => {const p = structuredClone(authored);mutate(p);const r = m.inspectRomanceScene(p, seed);assert(!r.ok, name);return {name,blocked:true,reason:r.blockers};});
  const renamed = structuredClone(seed); npc(renamed).pages[0].id = 'ev_romance_partner_first';
  const renameResult = m.inspectRomanceScene(renamed, seed); assert(!renameResult.ok);
  mutants.push({name:'rename draft page only',blocked:true,reason:renameResult.blockers});
  fs.mkdirSync(dirname(output),{recursive:true});
  fs.writeFileSync(output, JSON.stringify({productionToolRunner:true,legacyBriefNotAutoActivated:true,productionStartupSeed:true,firstConversationBeforeDecoration:true,atomicRejection:true,schemaRoundtrip:true,runtime,mutants},null,2)+'\n');
  fs.writeFileSync('output/qa/romance-scene/authored.json',JSON.stringify(authored));
  console.log(JSON.stringify({ok:runtime.ok,blockedMutants:mutants.length,output}));
});
