import fs from 'node:fs';import{isDeepStrictEqual}from'node:util';import assert from 'node:assert/strict';import{chromium}from'playwright';import{configFromEnv,loadCurrentJson}from'../supabase-resource-root/supabaseRest.mjs';
const out='output/evidence/village-ten',plans=JSON.parse(fs.readFileSync(out+'/plans.json')),before=JSON.parse(fs.readFileSync(out+'/local-before.json')),projectId='oprn-hill-forest-harmony-20260918-a4e1';
await loadCurrentJson({...await configFromEnv(),projectId});const host='http://127.0.0.1:9825',origin=process.env.BRIDGE_DEV_ORIGIN??'http://127.0.0.1:9832';
const conf=JSON.parse((await(await fetch(host)).text()).match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/)[1]),bridge=await(await fetch(host+'/__oprn/bridge.js')).text();
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
try{
 const context=await browser.newContext({viewport:{width:1740,height:1500}});await context.route('**/__oprn/**',async r=>{const u=new URL(r.request().url());try{await r.fulfill({response:await r.fetch({url:host+u.pathname+u.search,maxRetries:2})});}catch{await r.abort();}});await context.addInitScript({content:`window.__OPRN_BRIDGE__=${JSON.stringify(conf)};\n${bridge}`});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Page error',e.message)});const bootErrors=[];for(let attempt=0;attempt<3;attempt++){await page.goto(origin+'/?map=map_forest_cliff_village',{waitUntil:'domcontentloaded'});try{await page.waitForFunction(()=>window.__oprnProjectE2E?.currentProject()?.project?.maps?.map_forest_cliff_village,null,{timeout:45000});break;}catch(e){if(attempt===2)throw e;bootErrors.push(...errors.splice(0));}}console.log('Editor loaded');

 const baseline=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);
 const proof=await page.evaluate(async plans=>{
 const live=p=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===p).at(-1)?.name??p);
 const{store}=await live('/src/project/store.ts'),{paintTilesBulk}=await live('/src/editor/tileActions.ts'),{canMove}=await live('/src/project/collision.ts'),{autotileNeighborMask,autotileVariantForMask}=await live('/src/project/defaults/autotileEngine.ts');const results=[];
 for(const plan of plans.filter(p=>p.stairs.length)){
 const id=plan.map.id,p=store.getCurrent(),m=p.maps[id],w=m.width,h=m.height,ts=p.tilesets[m.tilesetId],g=ts.autotileGroups.find(g=>g.id==='forest_harmony_road_47');
 paintTilesBulk(id,plan.stairs.map(c=>({...c,layer:'lower'})),{preservePattern:true,clusterExpand:false});
 const arr=store.getCurrent().maps[id].lowerTiles;
 paintTilesBulk(id,arr.flatMap((t,i)=>g.memberTileIds.includes(t)?[{x:i%w,y:Math.floor(i/w),layer:'lower',tile:1516}]:[]),{preservePattern:false,clusterExpand:false});
 const n=store.getCurrent().maps[id],bad=plan.stairs.filter(c=>n.lowerTiles[c.y*w+c.x]!==854);
 if(bad.length)throw Error('Stairs still overwritten');
 const mismatches=[];for(let i=0;i<w*h;i++)if(g.memberTileIds.includes(n.lowerTiles[i])){const mask=autotileNeighborMask({width:w,height:h,lowerTiles:n.lowerTiles},i%w,Math.floor(i/w),t=>(g.connectTileIds??g.memberTileIds).includes(t),8);if(n.lowerTiles[i]!==autotileVariantForMask(g,mask))mismatches.push(i);}
 if(mismatches.length)throw Error('Road seams');
 const q=[plan.spec.entry],seen=new Set([q[0].join(',')]);for(let k=0;k<q.length;k++){const[x,y]=q[k];for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const key=[nx,ny].join(',');if(nx>=0&&ny>=0&&nx<w&&ny<h&&!seen.has(key)&&canMove(p,n,x,y,nx,ny)){seen.add(key);q.push([nx,ny]);}}}
 if(!seen.has(plan.spec.exit.join(','))||plan.houses.some(r=>!seen.has([r.front.x,r.front.y].join(','))))throw Error('Unreachable after stairs repair');
 results.push({mapId:id,stairs:plan.stairs.length,badStairs:bad.length,badRoadAutotiles:mismatches.length,allFrontsReachable:true,exitReachable:true});
 }
 await store.flush();return results;
 },plans);
 const expected=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__oprnProjectE2E?.currentProject()?.project?.maps?.map_village_ten_high_meadow,null,{timeout:120000});const saved=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);
 assert.deepEqual(saved.maps,expected.maps);for(const[id,m]of Object.entries(baseline.maps))if(!plans.some(p=>p.stairs.length&&p.map.id===id))assert.deepEqual(saved.maps[id],m);assert.deepEqual(saved.tilesets,baseline.tilesets);fs.writeFileSync(out+'/editor-saved-project.json',JSON.stringify(saved));fs.writeFileSync(out+'/stairs-proof.json',JSON.stringify({results:proof,reloaded:true,otherMapsUnchanged:true},null,2));console.log(JSON.stringify(proof));
}finally{await browser.close();}
