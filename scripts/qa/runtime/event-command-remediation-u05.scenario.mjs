import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "@playwright/test";
import { runRuntimeQa } from "../../lib/runtimeQaRun.mjs";
import { normalizeScenario } from "../../lib/runtimeQa.mjs";
import { eventCommandQaOp } from "../../lib/runtimeQaEventCommands.mjs";

const HERO = "hero", OTHER = "other", REWARD = "reward", POISON = "state_poison_u05", SLEEP = "state_sleep_u05";
const state = (path, equals) => ({ source: "state", path, equals });
const present = (selector, equals = true) => ({ source: "dom", selector, read: "present", equals });
const text = (selector, equals) => ({ source: "dom", selector, read: "text", equals });
const key = key => ({ kind: "key", key });
const op = (trigger, observe) => ({ kind: "eventCommand", trigger, observe, timeoutMs: 60000 });
const m2 = (id, fields) => ({ kind: "m2Command", commandId: `m2-${id}`, fields });
const actor = (id, target, value, operation = "set", extra = {}) => m2(id, { target, value, operation, ...extra });
const param = (target, value) => actor("014-change-parameters", target, value, "set", { parameter: "attack", valueSource: "number" });
const battle = (target, slots) => actor("092-change-battle-commands", target, "", "set", { slots });
const boot = { id: "boot", ops: [op(key("Enter"), [state(["mapId"], "map_u05"), state(["player"], { x: 2, y: 3 }), state(["inputEnabled"], true), state(["running"], false)])] };
const ready = value => [present('[data-testid="dialogue-box"].page-ready'), text('[data-testid="dialogue-box"] .body', value)];
const m2Actor = (who, field, value) => state(["m2Runtime", "actors", who, field], value);

export function scenario(projectFixture, id, observations) {
  return { id: `event-command-remediation-u05-${id}`, projectFixture, beats: [boot,
    { id: "execute", note: "Real action key executes authored commands in dedicated player.html; untargeted values distinguish party mistakes.", shot: true,
      ops: [{ kind: "face", dir: "up" }, op(key("z"), [...ready("U05_DONE"), ...observations])] },
  ] };
}

export async function provePlayer(serverUrl, ownedRoot) {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(serverUrl).hostname));
  const out = process.env.U05_EVIDENCE_DIR ?? ".omo/evidence/event-command-remediation/U05";
  const sourceFile = join(ownedRoot, "fixtures/editor-map.json");
  const source = await readFile(sourceFile, "utf8");
  const saved = JSON.parse(source);
  const commands = saved.maps.map_u05.events[0].pages[0].commands;
  assert.equal(commands[0].fields.target, HERO);
  assert.equal(commands[0].fields.slots, "cmd_attack,cmd_defend");
  assert.deepEqual(commands[1], { kind: "changeExp", actorId: OTHER, op: "-=", amount: { kind: "var", id: REWARD } });
  for (const i of [2,3]) assert.deepEqual({ source: commands[i].fields.valueSource, inactive: commands[i].fields.valueVariableId, value: commands[i].fields.value }, { source: "number", inactive: REWARD, value: 10 });
  assert.deepEqual(commands[4].fields, { target: HERO, operation: "toggle", value: SLEEP });
  const setup = [
    { kind: "changeExp", actorId: HERO, op: "=", amount: 80 }, { kind: "changeExp", actorId: OTHER, op: "=", amount: 40 },
    { kind: "changeActorHp", actorId: HERO, op: "=", amount: 60 }, { kind: "changeActorHp", actorId: OTHER, op: "=", amount: 45 },
    param(HERO, 7), param(OTHER, 13), actor("019-change-state", HERO, POISON), actor("019-change-state", OTHER, SLEEP),
    actor("022-change-actor-name", HERO, "Hero before"), actor("022-change-actor-name", OTHER, "Other before"),
    actor("023-change-actor-nickname", HERO, "Hero nick"), actor("023-change-actor-nickname", OTHER, "Other nick"),
    battle(HERO, "cmd_attack"), battle(OTHER, "cmd_defend"),
  ];
  const native = [state(["actorExperience", HERO], 80), state(["actorExperience", OTHER], 15), state(["actorVitals", HERO, "hp"], 70), state(["actorVitals", OTHER, "hp"], 45)];
  const observations = [state(["actorExperience", HERO], 80), state(["actorExperience", OTHER], 15),
    state(["actorVitals", HERO, "hp"], 40), state(["actorVitals", HERO, "maxHp"], 40), state(["actorVitals", OTHER, "hp"], 45), m2Actor(HERO, "parameters", -3), m2Actor(OTHER, "parameters", 13), m2Actor(HERO, "states", [POISON, SLEEP]), m2Actor(OTHER, "states", [SLEEP]),
    m2Actor(HERO, "name", "Hero edited"), m2Actor(OTHER, "name", "Other before"), m2Actor(HERO, "nickname", "Hero nick2"), m2Actor(OTHER, "nickname", "Other nick")];
  // Observe damage before Change Actor Class legitimately clamps HP to that class's max40.
  // The barrier does not alter any editor-saved command payload or order.
  const program = [...setup, commands[0], commands[1], { kind: "setVariable", variableId: REWARD, op: "=", value: 99 },
    ...commands.slice(2, 4), { kind: "text", body: "U05_DAMAGE" }, ...commands.slice(4), { kind: "text", body: "U05_DONE" }];
  const edgeProgram = [...setup,
    { ...commands[0], fields: { ...commands[0].fields, target: "actor", actorId: "" } },
    { kind: "setVariable", variableId: REWARD, op: "=", value: 99 }, commands[1],
    { ...commands[2], fields: { ...commands[2].fields, value: 0 } },
    { ...commands[3], fields: { ...commands[3].fields, value: 25, operation: "add" } },
    { ...commands[4], fields: { ...commands[4].fields, operation: "set" } },
    { kind: "text", body: "U05_DONE" },
  ];
  const legacyProgram = [...setup,
    { ...commands[0], fields: { ...commands[0].fields, target: "actor", actorId: HERO } },
    { kind: "changeExp", actorId: "", op: "+=", amount: 25 },
    actor("022-change-actor-name", "", "Legacy party"), actor("023-change-actor-nickname", "party", "Explicit party"),
    { ...commands[4], fields: { ...commands[4].fields, operation: "set" } },
    { kind: "text", body: "U05_DONE" },
  ];
  const cases = [
    { id: "authored", program, observations },
    { id: "edges", program: edgeProgram, observations: [state(["actorExperience", HERO],80), state(["actorExperience", OTHER],0), state(["actorVitals",HERO,"hp"],35), state(["actorVitals",OTHER,"hp"],45),
      m2Actor(HERO,"parameters",7),m2Actor(OTHER,"parameters",13),m2Actor(HERO,"states",[SLEEP]),m2Actor(OTHER,"states",[SLEEP])] },
    { id: "legacy", program: legacyProgram, observations: [state(["actorExperience",HERO],105),state(["actorExperience",OTHER],65),m2Actor("","name","Legacy party"),m2Actor("party","nickname","Explicit party"),m2Actor(HERO,"states",[SLEEP]),m2Actor(OTHER,"states",[SLEEP])] },
  ];
  const battleCases = [
    { id: "battle-canonical", command: commands[0], heroItem: true, otherItem: false },
    { id: "battle-legacy", command: { ...commands[0], fields: { ...commands[0].fields, target: "actor", actorId: HERO } }, heroItem: true, otherItem: false },
    { id: "battle-party", command: { ...commands[0], fields: { ...commands[0].fields, target: "party" } }, heroItem: true, otherItem: true },
    { id: "battle-incomplete", command: { ...commands[0], fields: { ...commands[0].fields, target: "actor", actorId: "" } }, heroItem: false, otherItem: false },
  ];
  const active = id => present(`.battle-actor-status.is-active-actor[data-record-id="${id}"]`);
  const item = yes => present('[data-testid="actor-command-item"]',yes);
  const commandReady = {source:'dom',selector:'[data-testid="battle-scene"]',read:'attribute',name:'data-battle-director-step',equals:'command'};
  const scenarios = [];
  for (const entry of [...cases,...battleCases]) {
    const project = structuredClone(saved);
    // QA setup is authored data, not debug session mutation. Disable unrelated troop event pages.
    for (const troop of project.database.troops) troop.battleEventPages = [];
    const event = project.maps.map_u05.events[0];
    const authoredProgram = entry.program ?? [battle(HERO,"cmd_attack,cmd_defend"),battle(OTHER,"cmd_defend"),entry.command,
      { kind: "battleProcessing", troopId: project.database.troops[0].id, canEscape: true, canLose: true, battleFlow: "strict", onWin: [], onEscape: [], onLose: [] }];
    event.commands = authoredProgram; event.pages[0].commands = authoredProgram;
    project.session.variables[REWARD] = 25;
    const fixture = join(ownedRoot,`fixtures/player-${entry.id}.json`);
    await writeFile(fixture,JSON.stringify(project));
    let spec;
    if(entry.id === 'authored') spec={id:'event-command-remediation-u05-authored',projectFixture:fixture,beats:[boot,
      {id:'damage-before-class',shot:true,ops:[{kind:'face',dir:'up'},op(key('z'),[...ready('U05_DAMAGE'),...native,m2Actor(HERO,'parameters',-3),m2Actor(OTHER,'parameters',13)])]},
      {id:'state-identity-class',shot:true,ops:[op(key('z'),[...ready('U05_DONE'),...observations])]},
    ]};
    else if(entry.program) spec=scenario(fixture,entry.id,entry.observations);
    else spec={id:`event-command-remediation-u05-${entry.id}`,projectFixture:fixture,beats:[boot,
      {id:"hero-menu",shot:true,ops:[{kind:"face",dir:"up"},op(key("z"),[commandReady,active(HERO),present('[data-testid="actor-command-defend"]'),item(entry.heroItem)])]},
      // The dedicated player's battle HUD is keyboard-only; select the visible command cursor.
      {id:"select-defend",ops:[op(key('ArrowDown'),[present('[data-testid="actor-command-defend"][data-battle-command-cursor="true"]')])]},
      {id:"other-menu",shot:true,ops:[op(key('Enter'),[commandReady,active(OTHER),present('[data-testid="actor-command-defend"]'),item(entry.otherItem)])]},
    ]};
    normalizeScenario(spec); scenarios.push({entry,spec,authoredProgram});
  }
  await writeFile(`${out}/player-scenarios.json`,JSON.stringify({sourceFile,sourceHash:createHash('sha256').update(source).digest('hex'),cases:scenarios,pass:"All expected native/M2 values; real next-actor battle menus match; no actor pseudo-ID, remote writes or leaked observation"},null,2));
  const browser=await firefox.launch({headless:true});
  const results=[];
  try {
    for(const {entry,spec} of scenarios){
      const context=await browser.newContext(); const writes=[];
      await context.route(url=>/(?:supabase|dbserver|\/rest\/v1|\/projects?(?:\/|$))/i.test(url.href),async route=>{
        const request=route.request();if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push(`${request.method()} ${request.url()}`);await route.abort('blockedbyclient');}else await route.continue();
      });
      const page=await context.newPage(); page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(120000);
      const pageErrors=[],failedRequests=[];
      page.on('pageerror',error=>pageErrors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')pageErrors.push(message.text());});
      page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
      try{
        const report=await runRuntimeQa(page,spec,{serverUrl,outDir:`${out}/player-${entry.id}`});
        assert.deepEqual(report.errors,[]); assert.ok(report.beats.every(beat=>beat.failures.length===0),JSON.stringify(report));
        const surface=await page.evaluate(()=>({url:location.href,editor:Boolean(document.querySelector('.editor-layout')),canvas:Boolean(document.querySelector('canvas')),pending:Boolean(window.__eventCommandQa),state:JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent)}));
        assert.ok(surface.url.endsWith('/player.html'));assert.equal(surface.editor,false);assert.equal(surface.canvas,true);assert.equal(surface.pending,false);
        assert.equal(Object.hasOwn(surface.state.m2Runtime?.actors??{},'actor'),false);
        assert.deepEqual(writes,[]);
        if(entry.id==='authored'){
          let negative;
          await assert.rejects(eventCommandQaOp(page,{kind:'eventCommand',trigger:{kind:'none'},observe:[state(['actorExperience',HERO],15)],timeoutMs:500}),error=>{negative=error.observation;return negative?.status==='timeout';});
          assert.deepEqual(negative.after,[{value:80}]);assert.equal(await page.evaluate(()=>Boolean(window.__eventCommandQa)),false);
          await writeFile(`${out}/player-authored/wrong-target.json`,JSON.stringify(negative,null,2));
        }
        results.push({id:entry.id,status:'PASS',surface,remoteWrites:writes});
        await writeFile(`${out}/player-${entry.id}/surface.json`,JSON.stringify(results.at(-1),null,2));
        console.log(`U05 ${entry.id}: PASS`);
      }catch(error){
        await page.screenshot({path:`${out}/player-${entry.id}-failure.png`});
        await writeFile(`${out}/player-${entry.id}-failure.json`,JSON.stringify({error:String(error),pageErrors,failedRequests,body:await page.locator('body').innerText()},null,2));
        throw error;
      }finally{await context.close();}
    }
    await writeFile(`${out}/player-observation.json`,JSON.stringify({status:'PASS',results},null,2));
  }finally{await browser.close();await writeFile(`${out}/player-browser-cleanup.json`,JSON.stringify({browserClosed:true,freshContextsClosed:true,remoteWrites:[],noObservationLeaks:true},null,2));}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [url,root]=process.argv.slice(2);assert.ok(url&&root,'Pass owned normal-Node Vite URL and U05 temporary root');
  await mkdir('.omo/evidence/event-command-remediation/U05',{recursive:true});await provePlayer(url,root);
}
