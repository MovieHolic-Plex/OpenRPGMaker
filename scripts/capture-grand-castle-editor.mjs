import fs from 'node:fs';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const out=process.argv[2]??'output/grand-castle/editor';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:3400,height:2700}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://mdc-server:9888/?hostProject=castle-fortress-city-20260921',{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByTestId('edit-canvas').waitFor({timeout:90000});
 await page.waitForFunction(()=>Boolean(window.__oprnEditCamera),null,{timeout:60000});
 const zoom=page.getByTestId('editor-zoom-stepper');
 for(let n=0;n<8;n++){const z=await zoom.textContent();if(z==='1x')break;await page.getByTestId('editor-zoom-prev').click();}
 // Wait for real map pixels, not just the surrounding canvas container.
 let painted=false;for(let n=0;n<12;n++){const png=PNG.sync.read(await page.getByTestId('edit-canvas').screenshot());const colors=new Set();for(let y=100;y<png.height-100;y+=8)for(let x=100;x<png.width-100;x+=8){const i=(y*png.width+x)*4;colors.add(png.data.readUInt32BE(i));}if(colors.size>60){painted=true;break;}await page.waitForTimeout(500);}if(!painted)throw Error('Map pixels did not render');
 await page.screenshot({path:out+'/editor.png'});
 await page.getByTestId('edit-canvas').screenshot({path:out+'/canvas.png'});
 fs.writeFileSync(out+'/proof.json',JSON.stringify({url:page.url(),zoom:await zoom.textContent(),pageErrors:errors},null,2));
 console.log(JSON.stringify({url:page.url(),zoom:await zoom.textContent(),pageErrors:errors}));
 await page.evaluate(()=>window.oprn.team.lock({resource:'map:grand-river-fortress',release:true}));
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
