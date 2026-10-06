// Actual desktop startup; no project creation or game-content mutation.
import { _electron } from 'playwright';
import {resolve} from 'node:path';
import fs from 'node:fs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
const out=resolve('verify-shots/maker-click-first/desktop');fs.mkdirSync(out,{recursive:true});
const app=await _electron.launch({args:[resolve('dist-electron/main.cjs'),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],env:{...process.env,OPRN_RENDERER_DIR:resolve('dist'),XDG_CONFIG_HOME:mkdtempSync(tmpdir()+'/oprn-fullscreen-'),OPRN_OPEN_PROJECT_DIR:undefined},timeout:90000});
const report={actualElectron:true};
try{
 const page=await app.firstWindow();await page.waitForSelector('.studio-window-controls');
 report.startup=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {fullscreen:w.isFullScreen(),bounds:w.getBounds(),url:w.webContents.getURL()};});
 report.geometry=await app.evaluate(({BrowserWindow,screen})=>({window:BrowserWindow.getAllWindows()[0].getBounds(),display:screen.getPrimaryDisplay().bounds}));
 const controls=await page.locator('.studio-window-controls button').evaluateAll(buttons=>buttons.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,color:s.color,background:s.backgroundColor,visible:r.right<=innerWidth&&r.bottom<=innerHeight,uncovered:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e};}));report.controls=controls;
 report.navigation=await page.locator('.start-rail button').evaluateAll(buttons=>buttons.filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();const native=[...document.querySelectorAll('.studio-window-controls button')].map(b=>b.getBoundingClientRect());return {text:e.textContent,uncovered:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),noNativeOverlap:native.every(n=>r.right<=n.left||r.left>=n.right||r.bottom<=n.top||r.top>=n.bottom)};}));
 await page.screenshot({path:out+'/startup.png'});
 await page.getByTestId('window-toggle-fullscreen').click();
 await page.waitForTimeout(500);
 report.afterClick=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen());
 await page.getByTestId('window-toggle-fullscreen').click();await page.waitForTimeout(500);
 report.restored=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen());
 report.passed=report.startup.fullscreen&&!report.afterClick&&report.restored&&report.controls.every(c=>c.visible&&c.uncovered&&c.color==='rgb(255, 249, 235)')&&report.navigation.every(n=>n.uncovered&&n.noNativeOverlap);
 if(!report.passed)throw Error('Native fullscreen click control failed');
}finally{fs.writeFileSync(out+'/proof.json',JSON.stringify(report,null,2));await app.close();}
console.log(JSON.stringify(report));
