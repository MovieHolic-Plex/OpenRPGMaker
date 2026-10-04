// Real editor handoff and composer, isolated fixture persistence and intercepted AI transport.
// This verifies delivery/claim behavior; it does not generate or save a real game.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const base = process.env.BRIEF_CAPTURE_URL ?? 'http://127.0.0.1:9813';
const out = 'verify-shots/confirmed-brief-autostart';
mkdirSync(out, {recursive:true});
const browser = await chromium.launch({headless:true});
const report = {scope:'Browser fixture; mocked save and AI response, no canonical project writes or model calls', cases:[], errors:[]};
let activePage, activeScenario, activeRequests;
try {
  for (const scenario of ['cold-ready', 'worker-accepted', 'reconnect', 'switch-while-checking', 'save-failure']) {
    if (process.env.BRIEF_CAPTURE_SCENARIO && process.env.BRIEF_CAPTURE_SCENARIO !== scenario) continue;
    const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
    const requests = [];
    activePage = page; activeScenario = scenario; activeRequests = requests;
    console.log('Capturing',scenario);
    let connected = scenario !== 'reconnect';
    let authCalls = 0;
    page.on('pageerror', error => report.errors.push({scenario,message:error.message}));
    await page.route('**/*', async route => {
      const request = route.request(), url = request.url();
      if (url.includes('/auth/status')) {
        authCalls++;
        if (scenario === 'switch-while-checking') {
          await page.evaluate(() => {window.fixtureScope = 'other-project';});
        }
        return route.fulfill({contentType:'application/json', body:JSON.stringify({connected,authKind:'apiKey'})});
      }
      if (url.includes('/v1/agent/run')) {
        const buffer = request.postDataBuffer();
        const body = JSON.parse(buffer[0] === 31 ? gunzipSync(buffer) : buffer);
        const state = await page.evaluate(() => ({pending:window.fixtureStore.getCurrent().gameDesignBrief.generationPending, saves:window.fixtureSaves.length,prompt:window.fixturePrompt}));
        requests.push({mode:body.mode,characters:body.task.length,completePrompt:body.task === state.prompt,internalTasks:body.task.includes('"id":"P03"') && body.task.includes('"id":"F03"'),authorSentence:body.task.includes('하늘 도서관의 마지막 사서'),pending:state.pending,saves:state.saves});
        await page.evaluate(() => {window.fixtureRequests = (window.fixtureRequests ?? 0) + 1;});
        if (scenario === 'worker-accepted') {
          const events = [{type:'team_start',task:body.task,roles:[]},{type:'done',project:body.project,unchangedKeys:['tilesets','database','assets'],changedKeys:[],summary:'Fixture: accepted, no authored changes',stats:{turns:0,toolCalls:0,toolErrors:0}}];
          return route.fulfill({headers:{'X-Oprn-Run-Id':body.runId},contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});
        }
        return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fixture: worker unavailable before start'})});
      }
      if (url.includes('/auth/') || url.includes('/api/')) return route.fulfill({contentType:'application/json',body:'{}'});
      if (url.includes('/__brief_capture')) return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><body><main id="root"></main></body></html>'});
      if (!url.startsWith(base)) return route.abort();
      return route.continue();
    });
    await page.goto(base+'/__brief_capture');
    await page.evaluate(async scenario => {
      await import('/src/styles/index.css');
      const {store} = await import('/src/project/store.ts');
      const {createBlankProject} = await import('/src/project/defaults.ts');
      const {GAME_BRIEF_SLOTS,gameDesignSummary,normalizeGameDesignBrief} = await import('/src/project/gameDesignBrief.ts');
      const {projectInterviewQuestions} = await import('/src/editor/projectInterviewQuestions.ts');
      const {defaultAiConfig,AI_CONFIG_STORAGE_KEY} = await import('/src/ai/llmClient.ts');
      const {editorState} = await import('/src/editor/editorState.ts');
      const {renderAiChatPanel,whenAiChatPanelSettled} = await import('/src/editor/panels/aiChatPanel.ts');
      const {configureProjectInterviewBootPreparation} = await import('/src/editor/projectInterviewBootPreparation.ts');
      window.fixtureScope = scenario;
      window.fixtureStore = store;
      window.fixtureSaves = [];
      store.getProjectIdentity = () => ({kind:'remote',id:window.fixtureScope});
      store.flush = async () => {
        window.fixtureSaves.push({pending:store.getCurrent().gameDesignBrief?.generationPending});
        if (scenario === 'save-failure') throw Error('Fixture: disk full');
        return {kind:'saved'};
      };
      const answers = {};
      for (const slot of GAME_BRIEF_SLOTS) {
        const q = projectInterviewQuestions('story-cutscene', answers).find(q => q.slot === slot);
        answers[slot] = {question:q.title,label:q.label,text:q.choices[0],source:'user'};
      }
      const brief = normalizeGameDesignBrief({version:1,presetId:'story-cutscene',answers,summary:gameDesignSummary(answers)+'\n주인공은 하늘 도서관의 마지막 사서.',generationPending:true});
      const project = createBlankProject('자동 제작 전달 확인');
      project.gameDesignBrief = {...brief,generationPending:true};
      store.replace(project);
      editorState.set({currentMapId:Object.keys(project.maps)[0]});
      localStorage.setItem(AI_CONFIG_STORAGE_KEY,JSON.stringify(defaultAiConfig()));
      configureProjectInterviewBootPreparation(async () => {});
      document.getElementById('root').append(renderAiChatPanel());
      await whenAiChatPanelSettled();
      const {prepareProjectInterviewStartup} = await import('/src/editor/projectInterviewStartup.ts');
      const {applyPendingAiBootIntent} = await import('/src/editor/aiBootIntent.ts');
      const {buildWelcomeGenrePresetPrompt,welcomeGenrePresetById} = await import('/src/editor/welcomeGenrePresets.ts');
      window.fixturePrompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById('story-cutscene'),store.getCurrent().gameDesignBrief);
      await prepareProjectInterviewStartup();
      applyPendingAiBootIntent();
    }, scenario);
    if (scenario === 'reconnect') {
      assert.equal(requests.length,0);
      const before = await page.evaluate(() => ({pending:window.fixtureStore.getCurrent().gameDesignBrief.generationPending,draft:document.querySelector('[data-testid="ai-input"]').value}));
      assert.equal(before.pending,true); assert.match(before.draft,/마지막 사서/); assert.doesNotMatch(before.draft,/"id":"P03"/);
      connected = true;
      await page.evaluate(async () => {const {refreshAiConnectionStatus}=await import('/src/editor/panels/aiConnectionStatus.ts');await refreshAiConnectionStatus();});
    }
    if (scenario === 'cold-ready' || scenario === 'reconnect' || scenario === 'worker-accepted') {
      await page.waitForFunction(accepted => window.fixtureSaves.length >= (accepted ? 2 : 3) && window.fixtureStore.getCurrent().gameDesignBrief.generationPending === (accepted ? undefined : true),scenario === 'worker-accepted',{timeout:90000});
      await page.waitForFunction(() => window.fixtureRequests === 1 && !document.querySelector('[data-testid="ai-send"]').disabled,{},{timeout:90000});
      assert.equal(requests.length,1);
      assert.equal(requests[0].mode,'team');
      assert.equal(requests[0].internalTasks,true); assert.equal(requests[0].authorSentence,true);
      assert.equal(requests[0].pending,undefined); assert.equal(requests[0].completePrompt,true);
      assert.equal(await page.getByTestId('ai-creation-choice').count(),0);
      const state = await page.evaluate(() => ({pending:window.fixtureStore.getCurrent().gameDesignBrief.generationPending,saves:window.fixtureSaves}));
      assert.equal(state.pending,scenario === 'worker-accepted' ? undefined : true);
      // Re-entering startup after the failed dispatch must not enqueue a concurrent duplicate.
      await page.evaluate(async () => {await (await import('/src/editor/projectInterviewStartup.ts')).prepareProjectInterviewStartup();});
      assert.equal(requests.length,1);
      await page.screenshot({path:`${out}/${scenario}.png`});
      report.cases.push({scenario,authCalls,requests,state});
    } else {
      assert.equal(requests.length,0);
      const pending = await page.evaluate(() => window.fixtureStore.getCurrent().gameDesignBrief.generationPending);
      assert.equal(pending,true);
      report.cases.push({scenario,authCalls,requests,pending});
    }
    await page.close();
    console.log('Verified',scenario);
  }
  assert.deepEqual(report.errors,[]);
  report.passed = true;
} catch (error) {
  report.failure = {scenario:activeScenario,message:error.message,requests:activeRequests,
    state:await activePage?.evaluate(() => ({scope:window.fixtureScope,pending:window.fixtureStore?.getCurrent().gameDesignBrief?.generationPending,saves:window.fixtureSaves,requests:window.fixtureRequests,sendDisabled:document.querySelector('[data-testid="ai-send"]')?.disabled,tail:document.body.innerText.slice(-3000)})).catch(()=>null)};
  await activePage?.screenshot({path:`${out}/failure.png`}).catch(()=>{});
  throw error;
} finally {
  writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(JSON.stringify(report,null,2));
