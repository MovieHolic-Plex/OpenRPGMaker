const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:850}});
page.on('pageerror', e => console.log('PAGE ERROR',e.message));
await page.route('**/audit-event-fixture', route => route.fulfill({contentType:'text/html',body:`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font:18px system-ui;background:#f6f3ec;padding:32px;color:#25313a}#list{padding:30px;min-height:220px}section{background:white;padding:22px;margin:18px;border:1px solid #ccc}h1{font-size:25px}.cmd-item{border:1px solid #bbb;padding:16px;margin:8px;background:#fafafa}.cmd-head{display:flex;gap:12px}.cmd-actions,.cmd-cat-icon,.cmd-runtime-support{display:none}.cmd-drag-handle{display:inline-block;width:36px;height:30px;background:#ddd}.cmd-drag-handle svg{width:20px}#plain{padding:15px;background:#ddd;width:160px}pre{font-size:15px;white-space:pre-wrap}</style></head><body><h1>Event editor drag review — isolated in-memory fixture</h1><p>No user project is loaded or saved. Native browser drag operations.</p><div id="plain" draggable="true">External text: [0]</div><section><h2>Command list (host reused after page change)</h2><div id="list"></div></section><pre id="result"></pre></body></html>`}));
await page.goto(`${process.env.EVENT_REVIEW_ORIGIN ?? 'http://127.0.0.1:9813'}/audit-event-fixture`);
await page.evaluate(async () => {
const {renderCommandList} = await import('/src/editor/panels/eventEditor/commandList.ts');
window.observed={oldCalls:[],currentCalls:[],externalCalls:[]};
const makeActions=(calls)=>({addCommand(){},insertCommand(){},replaceCommand(){},deleteCommand(){},moveCommand(){},moveCommandTo(path,index){calls.push({path,index})}});
window.oldActions=makeActions(window.observed.oldCalls);
window.currentActions=makeActions(window.observed.currentCalls);
window.paint=(actions=window.currentActions)=>renderCommandList(document.querySelector('#list'),[{kind:'text',body:'A: Keep original dialogue'},{kind:'text',body:'B: Continue story'}],[],actions);
window.paint(window.oldActions);
window.paint();
document.querySelector('#plain').addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain','[0]'));
});
await page.locator('#plain').dragTo(page.locator('#list'),{targetPosition:{x:600,y:10}});
const external=await page.evaluate(()=>structuredClone(window.observed));
await page.locator('.cmd-drag-handle').first().dragTo(page.locator('#list'),{targetPosition:{x:650,y:10}});
const after=await page.evaluate(()=>structuredClone(window.observed));
const result={fixture:'No persistence bridge; isolated component',externalDrop:external,ownedDragAfterHostReuse:after};
await page.evaluate(result=>document.querySelector('#result').textContent=JSON.stringify(result,null,2),result);

await page.screenshot({path:path.join(__dirname, 'drag-observation.png'),fullPage:true});
fs.writeFileSync(path.join(__dirname, 'observations.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
await browser.close();
})();
