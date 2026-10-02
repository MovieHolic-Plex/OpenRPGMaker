// Bounded evidence: real registered tools, shipped interpreter, isolated fixture.
// No LLM response is mocked, and no user's project is changed.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
const base = process.argv[2];
if (!base) throw new Error('Supply the worktree editor URL.');
const evidenceDir = resolve('verify-shots/quest-library');
const fixtureDir = resolve('output/evidence/quest-library');
await mkdir(evidenceDir, { recursive: true }); await mkdir(fixtureDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('oprn:editor-ui-mode','expert'); localStorage.setItem('oprn:coachmarks-basic-v1','1'); });
  await page.goto(`${base}/?blankProject=1&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ai-input').waitFor({ timeout: 180000 }).catch(async error => { console.log(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0,1200) })); throw error; });
  console.log('Editor ready');
  const report = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { runTool } = await import('/src/editor/tools/toolRunner.ts');
    const { QUEST_PRESETS } = await import('/src/project/quest/questPresets.ts');
    const { serialize, deserialize, resolveEventPage } = await import('/src/project/io.ts');
    const { createInterpreter } = await import('/src/player/interpreter.ts');
    const { startSession } = await import('/src/project/session.ts');
    const original = store.getCurrent();
    const tilesets = Object.fromEntries([...new Set(Object.values(original.maps).map(m => m.tilesetId))].map(id => { const { referenceDocuments, ...tile } = original.tilesets[id]; return [id,tile]; }));
    const ctx = { project: structuredClone({ ...original, tilesets, quests: [] }) };
    const model = ctx.project.maps[ctx.project.startMapId];
    const used = new Set();
    const scan = value => { if (!value || typeof value !== 'object') return; if (value.type === 'uploaded' && value.id) used.add(value.id); for (const [k,v] of Object.entries(value)) { if (/resourceId$/i.test(k) && typeof v === 'string') used.add(v); else if (v && typeof v === 'object') scan(v); } };
    scan(ctx.project.maps); scan(ctx.project.database); scan(ctx.project.system); scan(ctx.project.tilesets);
    ctx.project.assets.uploaded = Object.fromEntries(Object.entries(ctx.project.assets.uploaded).filter(([id]) => used.has(id)));
    const [itemId, secondItem] = ctx.project.database.items.map(item => item.id);
    const troopId = ctx.project.database.troops[0].id;
    const actorId = ctx.project.database.actors[1].id;
    const recipeId = 'qa_quest_recipe';
    ctx.project.system.craftRecipes = [{ id: recipeId, ingredients: [{ itemId, count: 2 }], outputItemId: secondItem, outputCount: 1 }];
    ctx.project.system.timeSystem = { ...(ctx.project.system.timeSystem ?? {}), enabled: true };
    const defs = [], toolResults = [];
    for (const preset of QUEST_PRESETS) {
      const key = `library_${preset.id}`, mapId = `map_${key}`;
      ctx.project.maps[mapId] = { ...structuredClone(model), id: mapId, name: preset.title, events: [] };
      const npc = (x, y, name, targetMap = mapId) => ({ create: { mapId: targetMap, x, y, name, graphicQuery: '청년 남성' } });
      const point = (i, extra = {}) => ({ mapId, x: 8 + i * 2, y: 5, ...extra });
      const steps = preset.pattern.map((kind, i) => {
        const target = npc(8 + i * 2, 5, `${preset.title} 인물 ${i + 1}`);
        switch (kind) {
          case 'talk': return { kind, target, lines: ['다음 단서는 푸른 표식입니다.'], ...(preset.id === 'appointment' ? { timePhase: 'night' } : {}) };
          case 'collect': return { kind, itemId, count: ['gather','world_repair','repeatable_contract'].includes(preset.id) ? 3 : 1, sources: Array.from({ length: ['gather','world_repair','repeatable_contract'].includes(preset.id) ? 3 : 1 }, (_, j) => ({ kind: 'pickup', mapId, x: 8 + j * 3, y: 9 })) };
          case 'kill': return { kind, troopId, at: point(i, { graphicQuery: '청년 남성' }) };
          case 'reach': return { kind, ...point(i) };
          case 'inspect': return { kind, at: point(i), lines: ['표식에는 푸른색이라고 적혀 있다.'] };
          case 'craft': return { kind, at: point(i), recipeId };
          case 'deliver': return { kind, target, itemId: preset.id === 'crafting' || (preset.id === 'trade_chain' && i === 1) ? secondItem : itemId, count: preset.id === 'world_repair' ? 3 : 1, ...(preset.id === 'trade_chain' ? { gives: [{ itemId: i === 0 ? secondItem : itemId, count: 1 }] } : {}) };
          case 'escort': return { kind, target, destination: { mapId, x: 14, y: 9 } };
          case 'choice': return { kind, target, prompt: '어떻게 해결할까요?', options:
            preset.id === 'alternate_solution' ? [{ text: '20G를 지불한다', cost: { gold: 20 } }, { text: '결투로 해결한다', troopId }] :
            preset.id === 'duel' ? [{ text: '결투한다', troopId }, { text: '힌트를 듣는다', completes: false }] :
            preset.id === 'moral_choice' ? [{ text: '주인에게 돌려준다', effects: { switches: [{ id: 'outcome_owner', value: true }] } }, { text: '주민을 돕는다', effects: { switches: [{ id: 'outcome_help', value: true }] } }] :
            [{ text: '푸른 표식', lines: ['정답입니다.'] }, { text: '붉은 표식', completes: false, lines: ['다시 생각해 보세요.'] }] };
        }
      });
      if (preset.id === 'time_echo') {
        const futureId = `${mapId}_future`;
        ctx.project.maps[futureId] = { ...structuredClone(model), id: futureId, name: '미래', events: [] };
        steps[1].mapId = futureId; steps[2].target.create.mapId = futureId;
        const transfer = (id, to) => ({ id, x: 3, y: 3, trigger: { kind: 'action' }, commands: [{ kind: 'transfer', mapId: to, x: 3, y: 4 }] });
        ctx.project.maps[mapId].events.push(transfer('to_future', futureId)); ctx.project.maps[futureId].events.push(transfer('to_past', mapId));
      }
      const def = { key, presetId: preset.id, title: preset.title, summary: preset.example, giver: npc(5,5,'의뢰인'), order: 'sequence', steps, rewards: { gold: 100 },
        dialogue: { accepted: '부탁드립니다.', reminder: '목표를 마친 뒤 돌아와 주세요.', completed: '의뢰 완료! 100G를 받았습니다.', afterComplete: '고맙습니다.' } };
      if (preset.id === 'custom') def.blueprint = [...preset.pattern];
      if (['delivery','trade_chain','crafting','custom'].includes(preset.id)) def.onAcceptItems = [{ itemId, count: preset.id === 'crafting' ? 2 : 1 }];
      if (preset.id === 'recruitment') def.effects = { actors: [actorId] };
      if (preset.id === 'repeatable_contract') def.repeatable = true;
      if (preset.id === 'story_chain') def.requiresQuestKeys = ['library_errand'];
      if (['mechanism','puzzle_choice','alternate_solution','world_repair'].includes(preset.id)) def.gates = [{ mapId, x: 18, y: 12, requiresStep: steps.length - 1, lockedText: '아직 닫혀 있습니다.' }];
      if (['world_repair','time_echo'].includes(preset.id)) {
        const targetMap = preset.id === 'time_echo' ? `${mapId}_future` : mapId;
        ctx.project.maps[targetMap].events.push({ id: `world_${key}`, x: 17, y: 5, trigger: { kind: 'action' }, commands: [{ kind: 'text', body: '이전 모습입니다.' }] });
        def.worldChanges = [{ target: { mapId: targetMap, eventId: `world_${key}` }, lines: ['마을이 달라졌어요!'], passable: true }];
      }
      defs.push(def);
      const result = runTool(ctx, 'create_quest', { def }, { dryRun: false });
      toolResults.push({ preset: preset.id, ok: result.ok, summary: result.summary, issues: result.issues });
    }
    if (toolResults.some(result => !result.ok)) return { toolResults };
    const project = deserialize(serialize(ctx.project));
    const checks = [], rows = [];
    const check = (preset, name, ok) => { checks.push({ preset, name, ok: Boolean(ok) }); if (!ok) throw new Error(`${preset}: ${name}`); };
    for (const def of defs) {
      const mapId = `map_${def.key}`;
      const session = { ...startSession(project), currentMapId: mapId, gold: 0, inventory: {}, selfSwitches: {}, switches: {}, variables: {}, followers: [], partyActorIds: [project.database.actors[0].id] };
      const flags = { started: `sw_${def.key}_started`, done: `sw_${def.key}_done`, progress: `var_${def.key}_progress` };
      const run = (id, choice = 0, battle = 'victory') => {
        const map = Object.values(project.maps).find(map => map.events.some(e => e.id === id));
        if (!map) throw new Error(`Event missing ${id}`);
        session.currentMapId = map.id;
        const event = map.events.find(e => e.id === id), page = resolveEventPage(event, session);
        const interpreter = createInterpreter(page?.commands ?? [], session, project, { currentEventId: id });
        let result = interpreter.start(), text = [];
        for (let n = 0; result.kind !== 'done' && n < 250; n++) {
          if (result.kind === 'text') text.push(result.body);
          if (result.kind === 'battleProcessing') session.battleResult = battle;
          result = interpreter.resume(result.kind === 'choices' ? choice : result.kind === 'battleProcessing' ? battle : undefined);
        }
        if (result.kind !== 'done') throw new Error(`Interpreter stalled ${id}: ${result.kind}`);
        return text;
      };
      const objective = (step, i, choice = 0, battle = 'victory') => {
        const id = `ev_${def.key}_${step.kind}${i}`;
        if (step.kind === 'collect') step.sources.forEach((_, j) => run(`ev_${def.key}_pick${i}_${j}`));
        else if (step.kind === 'escort') { run(id); run(`ev_${def.key}_destination${i}`); }
        else run(id, choice, battle);
      };
      const giver = `ev_${def.key}_giver`;
      // Must not start or award rewards through an objective or an early report.
      objective(def.steps[0],0); check(def.presetId,'blocked before acceptance',!session.switches[`sw_${def.key}_step0`]);
      if (def.requiresQuestKeys) {
        run(giver); check(def.presetId,'prerequisite blocks acceptance',!session.switches[flags.started]);
        session.switches.sw_library_errand_done = true; // Explicit prerequisite contract probe.
      }
      run(giver,1); check(def.presetId,'decline leaves quest inactive',!session.switches[flags.started]);
      run(giver); check(def.presetId,'accept starts quest',session.switches[flags.started]);
      run(giver); check(def.presetId,'early report never rewards',session.gold === 0 && !session.switches[flags.done]);
      for (let i = def.steps.length - 1; i > 0; i--) objective(def.steps[i],i);
      check(def.presetId,'cannot skip ordered stages',!def.steps.slice(1).some((_,i) => session.switches[`sw_${def.key}_step${i+1}`]));
      for (const [i,step] of def.steps.entries()) {
        const done = `sw_${def.key}_step${i}`;
        if (step.kind === 'choice') {
          const wrong = step.options.findIndex(o => o.completes === false);
          if (wrong >= 0) { objective(step,i,wrong); check(def.presetId,'wrong choice permits retry without completing',!session.switches[done]); }
          if (step.options[0].troopId) {
            objective(step,i,0,'escape'); check(def.presetId,'escape never completes',!session.switches[done]);
            objective(step,i,0,'defeat'); check(def.presetId,'defeat never completes',!session.switches[done]);
          }
          if (step.options[0].cost?.gold) {
            objective(step,i); check(def.presetId,'insufficient gold neither completes nor charges',!session.switches[done] && session.gold === 0);
            session.gold = 20; // Explicit native cost check, not a claimed playthrough.
          }
        }
        if (step.kind === 'craft') {
          const materials = session.inventory[itemId]; session.inventory[itemId] = 0;
          objective(step,i); check(def.presetId,'missing materials do not complete crafting',!session.switches[done]); session.inventory[itemId] = materials;
        }
        if (step.kind === 'deliver') {
          const held = session.inventory[step.itemId] ?? 0;
          session.inventory[step.itemId] = Math.max(0,step.count - 1);
          objective(step,i); check(def.presetId,'missing quantity blocks delivery without consumption',!session.switches[done] && session.inventory[step.itemId] === step.count - 1);
          session.inventory[step.itemId] = held;
        }
        if (step.kind === 'escort') {
          run(`ev_${def.key}_destination${i}`); check(def.presetId,'cannot arrive before joining',!session.switches[done]);
          const config = project.system.companions;
          project.system.companions = { maxCompanions: 1, overflow: 'reject' };
          session.followers = [{ id: 'qa_other', name: 'other follower', kind: 'mascot' }];
          run(`ev_${def.key}_escort${i}`); check(def.presetId,'full follower capacity does not mark joining',!session.switches[`sw_${def.key}_escort${i}`]);
          session.followers = []; project.system.companions = config;
          run(`ev_${def.key}_escort${i}`);
          session.followers = []; // Explicit lost-follower contract probe.
          run(`ev_${def.key}_destination${i}`); check(def.presetId,'arrival without actual follower cannot complete',!session.switches[done] && !session.switches[`sw_${def.key}_escort${i}`]);
          run(`ev_${def.key}_escort${i}`); check(def.presetId,'NPC becomes a native follower',session.followers.some(f => f.name === `quest:${def.key}:${i}`));
        }
        if (step.timePhase) {
          session.gameTime = { day: 1, hour: 12, minute: 0 };
          objective(step,i); check(def.presetId,'wrong time blocks appointment',!session.switches[done]);
          session.gameTime = { day: 1, hour: 22, minute: 0 };
        }
        objective(step,i); check(def.presetId,`stage ${i+1} completes`,session.switches[done]);
        if (step.kind === 'escort') check(def.presetId,'arrival removes only quest follower',!session.followers.some(f => f.name === `quest:${def.key}:${i}`));
        const progress = session.variables[flags.progress]; objective(step,i);
        check(def.presetId,`stage ${i+1} does not count twice`,session.variables[flags.progress] === progress);
      }
      const beforeReward = session.gold;
      run(giver); check(def.presetId,'report pays reward once',session.switches[flags.done] && session.gold === beforeReward + 100);
      if (def.effects?.actors) check(def.presetId,'real actor joins party',session.partyActorIds.includes(actorId));
      if (def.presetId === 'moral_choice') check(def.presetId,'chosen outcome recorded exclusively',session.switches.outcome_owner && !session.switches.outcome_help);
      for (const change of def.worldChanges ?? []) check(def.presetId,'world change persists on existing event',run(change.target.eventId).includes('마을이 달라졌어요!'));
      run(giver,1); check(def.presetId,'completed report cannot pay again',session.gold === beforeReward + 100);
      if (def.repeatable) {
        run(giver); check(def.presetId,'new acceptance resets objectives',!session.switches[flags.done] && session.variables[flags.progress] === 0);
        run(giver); check(def.presetId,'new acceptance cannot immediately pay',session.gold === 100);
        objective(def.steps[0],0); run(giver); check(def.presetId,'new cycle sources work and reward once',session.gold === 200 && session.switches[flags.done]);
      }
      rows.push({ id: def.presetId, title: def.title, pattern: def.steps.map(s => s.kind), checks: checks.filter(c => c.preset === def.presetId).length, passed: true });
    }
    const rejects = [];
    const reject = (name, def) => {
      const before = serialize(ctx.project), result = runTool(ctx,'create_quest',{ def },{ dryRun:false });
      rejects.push({ name, rejected: !result.ok, unchanged: before === serialize(ctx.project) });
    };
    reject('unknown preset', { ...defs[0], key:'bad_id',presetId:'unknown' });
    reject('wrong preset pattern', { ...defs[0],key:'bad_pattern',steps:defs[2].steps });
    reject('missing item reference', { ...defs[3],key:'bad_item',steps:[{...defs[3].steps[0],itemId:'missing'}] });
    reject('missing recipe', { ...defs[6],key:'bad_recipe',steps:[{...defs[6].steps[0],recipeId:'missing'},defs[6].steps[1]] });
    reject('stage sequence required', { ...defs[7],key:'bad_order',order:'any' });
    reject('sources cannot reach goal', { ...defs[4],key:'bad_sources',steps:[{...defs[4].steps[0],count:10}] });
    return { toolResults, checks, rows, rejects, questCount: project.quests.length, project: JSON.parse(serialize(project)), limits: ['Battles here use explicit interpreter outcomes; this is not 28 physical playthroughs.','No LLM response or end-to-end generation quality is asserted.'] };
  });
  await writeFile(resolve(evidenceDir,'tool-evidence.json'),JSON.stringify({ ...report, project: undefined, browserErrors: errors },null,2));
  assert.ok(report.toolResults.every(r => r.ok),JSON.stringify(report.toolResults.filter(r => !r.ok)));
  assert.ok(report.rows.length === 28);
  assert.ok(report.rejects.every(r => r.rejected && r.unchanged));
  await writeFile(resolve(fixtureDir,'project.json'),JSON.stringify(report.project));
  console.log(JSON.stringify({ quests: report.questCount, checks: report.checks.length, rejects: report.rejects, errors }));
} finally { await browser.close(); }
