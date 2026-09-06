# Real-browser QA handoff

## Ownership and current result

Lead ran all three scenarios against **baseline production** at
`http://127.0.0.1:43791/?blankProject=1`, `E2E_FREEZE_DEV_SERVER=1`.
All three PASS with zero reported pageerrors. Screenshots in the lead worktree:

- `.omo/evidence/ai-seven/reasoning.png`
- `.omo/evidence/ai-seven/ghost-preview.png`
- `.omo/evidence/ai-seven/transport-error.png`

This child did not rerun browser QA or full build/gates. Its delivery changes only
the two tests, not authentication, session/turn behavior, CSS or wiki pages.

## Configuration and isolation

Use a disposable browser context and blankProject fixture. Intercept all
`**/v1/chat/completions` requests BEFORE sending; never let a missing fixture fall
through to a real provider. Fulfill any remote `**/rest/v1/**` requests locally
(e.g. JSON `[]`); never write real project/conversation data.

In the page, load the real modules and configure the supported model:

```js
const llm = await import('/src/ai/llmClient.ts');
localStorage.setItem(llm.AI_CONFIG_STORAGE_KEY, JSON.stringify({
  ...llm.defaultAiConfig(), agentMode: 'chat',
  model: 'gemini-3.7-flash', liteModel: 'gemini-3.7-flash'
}));
const panel = await import('/src/editor/panels/aiChatPanel.ts');
await panel.whenAiChatPanelSettled(); // boot/persistence only, NOT turn completion
(await import('/src/ai/intentDeclarationClient.ts')).resetIntentDeclarationCache();
```

`loadAiConfig()` forces OAuth. Do not set fake API keys/baseUrl or fake model names;
unsupported names are normalized. `agentMode:chat` alone does not turn off the
balanced autonomy planner. The structured intent below declares single-step.
Start each case with visible `[data-testid=ai-new-chat]` (NOT hidden ai-new-session).
After a transport error, click `[data-testid=ai-gate-modal-close]` before another
composer click. Use `[data-testid=ai-input]` and `[data-testid=ai-send]`.

## Exact HTTP fixtures

Parse the request JSON, not prompt wording or a global fetch count.
For `payload.response_format?.type === 'json_object'`, return status 200,
Content-Type `application/json`, body:

```js
JSON.stringify({choices:[{message:{role:'assistant',content:JSON.stringify({
  mode:'other', needsPlan:false
})},finish_reason:'stop'}]})
```

Optional faithful intent tools: reasoning uses `mode:'question'`,
`tools:['get_project_summary','get_map_region']`; ghost uses `mode:'create'`,
`space:'none'`, `tools:['create_map']`. Both keep `needsPlan:false`.
This is one separate non-streaming request. Normal model requests should then
have `stream:true`. Count `payload.messages.filter(m => m.role === 'tool').length`
to select the next body; never let intent/auth/logging traffic consume it.

SSE helpers (status 200, Content-Type `text/event-stream`):

```js
const sse = deltas => [...deltas.map(delta => 'data: '+JSON.stringify({
  choices:[{delta}]
})), 'data: [DONE]', ''].join('\n\n');
const tool = (id, name, args) => ({tool_calls:[{
  index:0,id,type:'function',function:{name,arguments:JSON.stringify(args)}
}]});
```

### Reasoning merge

1. Input `요약해줘`.
2. 0 tool results: `sse([tool('c1','get_project_summary',{})])`.
3. 1 tool result: `sse([{reasoning:'reasoning-first-sentinel'},
   tool('c2','get_map_region',{mapId:currentStartMapId,x:0,y:0,w:2,h:2})])`.
   Read currentStartMapId from `(await import('/src/project/store.ts')).store.getCurrent().startMapId`.
4. 2 tool results: `sse([{reasoning:'reasoning-second-sentinel'},
   {content:'answer-sentinel'}])`.
5. Observe exactly two `[data-testid=ai-reasoning-item]` in the same
   `[data-testid=ai-reasoning]`, exact sentinel texts, toggle count 2. Click
   `.ai-reasoning-toggle`; `[data-testid=ai-reasoning-body]` becomes unhidden.
   Actual query results must both be ok:true; exactly 1 intent + 3 chat requests.

### Successful write ghost

1. Subscribe BEFORE sending via `subscribeAgentGhostPreview` from
   `/src/editor/agentGhostPreview.ts`; retain every preview with mapId matching
   `map_ai_seven_ghost`. Create a bounded promise resolved by that matching event.
2. Input `새 맵 만들어줘`.
3. 0 tool results: `sse([tool('c_live','create_map',{
   id:'map_ai_seven_ghost',name:'미리보기 검증',width:6,height:5})])`.
4. Hold the next chat route on a deferred promise (not a sleep). After the ghost
   subscription resolves, capture state/screenshot, then release this response:
   `sse([{content:'draft-complete-sentinel'}])`.
5. Event must include `{mapId:'map_ai_seven_ghost',toolName:'live_project_diff',
   bounds:{x:0,y:0,width:6,height:5}}`. The ghost is temporary and off-map work
   only renders on the corresponding map; do not infer missing publication from
   absence on the old map canvas. After terminal, the store contains the 6x5 map,
   real tool result is ok:true, and `getAgentGhostPreviewState().previews` is empty.
   Unsubscribe. Exactly 1 intent + 2 chat requests.

### Refused fetch / 401 recovery

1. Input `연결 확인`; intent succeeds as above.
2. For every non-intent model request call Playwright `route.abort('connectionrefused')`.
3. Immediately after send, `.ai-chat-panel.is-turn-running` exists; ai-send stays
   mounted/visible and disabled alongside visible ai-abort.
4. The session performs 4 chat attempts (initial + 3 retries), then clears running.
   ai-send remains mounted/visible and enabled; ai-abort is hidden.
   `[data-testid=ai-retry-turn]` and `[data-testid=ai-error-open-settings]` exist.
   The system bubble retains the actual error. Close ai-gate-modal-close, click
   ai-error-open-settings and assert `[data-testid=ai-settings-modal]` opens.
5. Repeat with non-intent HTTP 401 body `unauthorized-sentinel`: one chat request,
   no retry, same terminal recovery UI. Do not match translated prose.

## Exact completion signal (no polling)

Child tests subscribe to `recordAiActivity` terminal publication before UI click
(`channel==='chat' && result.pending!==true`), preserving the actual panel/session/
parser/tool/draft/apply chain. Publication follows terminal cleanup in aiTurnRunner.
For the real browser, register a MutationObserver on `.ai-chat-panel` BEFORE
click, remember that `is-turn-running` has appeared, and resolve only when that
class subsequently disappears. Use a bounded rejection timer (20s accommodates
the real 1.5+3+4.5 second retry backoffs), disconnect/clear timer on completion.
For reasoning/ghost screenshot points, subscribe to the exact matching DOM or
preview event instead; a terminal-only snapshot misses transient previews.
