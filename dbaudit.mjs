import { chromium } from 'playwright';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1600,height:900}});
for(let a=1;a<=3;a++){try{await p.goto('http://localhost:9999/',{waitUntil:'networkidle'});await p.waitForTimeout(14000);await p.locator('[data-testid=topbar-data], button:has-text("데이터")').first().click({timeout:20000});break;}catch(e){console.log('retry',a);}}
await p.waitForTimeout(900); await p.locator('text=데이터베이스').first().click({force:true}).catch(()=>{}); await p.waitForTimeout(3000);
const r=e=>{const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
console.log('AUDIT',JSON.stringify(await p.evaluate(()=>{
  const R=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
  const q=s=>document.querySelector(s);
  const table=q('.db-actor-studio-table');
  const rows=[...document.querySelectorAll('.db-actor-table-row.db-list-row')];
  const lastRow=rows[rows.length-1];
  const insp=q('.db-studio-inspector-pane')||q('.oprn-record-detail-pane');
  const inspFields=[...(insp?.querySelectorAll('input,select,textarea')||[])];
  const lastField=inspFields[inspFields.length-1];
  // 코치마크 오버레이
  const coach=[...document.querySelectorAll('[class*=coach],[class*=onboard],[class*=tour],[data-testid*=coach]')].filter(e=>e.getBoundingClientRect().width>100).map(e=>({cls:String(e.className).slice(0,40),r:R(e),z:getComputedStyle(e).zIndex,text:(e.innerText||'').replace(/\s+/g,' ').slice(0,60)}));
  // 0카운트 탭
  const zero=[...document.querySelectorAll('.db-tab[data-count="0"]')].map(e=>e.textContent.trim());
  const searches=[...document.querySelectorAll('.database-modal-window input[type=search], .database-modal-window input:not([type])')].slice(0,4).map(e=>({ph:e.placeholder,r:R(e),vis:getComputedStyle(e).color}));
  return {
    modal:R(q('.database-modal-window')),
    listPane:R(q('.db-studio-table-pane')), table:R(table), lastRow:R(lastRow),
    listDeadSpaceBelowRows: table&&lastRow? Math.round(table.getBoundingClientRect().bottom-lastRow.getBoundingClientRect().bottom):null,
    inspector:R(insp), lastFieldBottom:lastField?R(lastField):null,
    inspectorDeadSpaceBelowFields: insp&&lastField? Math.round(insp.getBoundingClientRect().bottom-lastField.getBoundingClientRect().bottom):null,
    inspectorFieldCount:inspFields.length,
    coach, zeroCountTabs:zero, searches,
    footer:R(q('.database-modal-footer')), footerStatusLen:(q('[data-testid=db-footer-status]')?.textContent||'').length,
  };
}),null,1));
await p.screenshot({path:'verify-shots/uiux-adversarial/db-audit.png'});
await b.close(); console.log('AUDIT_DONE');
