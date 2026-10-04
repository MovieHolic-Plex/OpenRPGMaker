import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch();try{
const p=await b.newPage({viewport:{width:760,height:220}});
await p.route('**/continue-style-inspection',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/index.css"><link rel="stylesheet" href="/src/styles/database/index.css"></head><body><div class="database-modal-window ai-settings-window" style="height:auto;width:100%;margin:20px 0"><div class="database-modal-body"><div class="ai-config-form"><div class="ai-config-actions"><span class="ai-config-saved-hint">연결 확인 중…</span><button class="ai-assistant-action is-primary" disabled>연결하고 계속</button></div><div class="ai-config-actions"><span class="ai-config-saved-hint">ChatGPT · 사용 준비됨</span><button class="ai-assistant-action is-primary">연결하고 계속</button></div></div></div></div></body></html>`}));
await p.goto(`${process.env.AI_CONNECTION_REVIEW_ORIGIN ?? 'http://127.0.0.1:9860'}/continue-style-inspection`);
const style=await p.locator('button:not(:disabled)').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
assert.equal(style.background,'rgb(74, 87, 214)');console.log(style);
await p.screenshot({path:new URL('continue-button.png',import.meta.url).pathname});
}finally{await b.close();}
