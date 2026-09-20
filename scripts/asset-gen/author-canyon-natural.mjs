import fs from 'node:fs';import{isDeepStrictEqual}from'node:util';import assert from 'node:assert/strict';import{chromium}from'playwright';import{configFromEnv,loadCurrentJson}from'../supabase-resource-root/supabaseRest.mjs';
const out='output/evidence/canyon-natural',plan=JSON.parse(fs.readFileSync(out+'/plan.json')),before=JSON.parse(fs.readFileSync(out+'/local-before.json')),mapId=plan.map.id,projectId='oprn-hill-forest-harmony-20260918-a4e1';
await loadCurrentJson({...await configFromEnv(),projectId});const host='http://127.0.0.1:9825',origin=process.env.BRIDGE_DEV_ORIGIN??'http://127.0.0.1:9832';
const conf=JSON.parse((await(await fetch(host)).text()).match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/)[1]),bridge=await(await fetch(host+'/__oprn/bridge.js')).text();
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
try{
 const context=await browser.newContext({viewport:{width:1740,height:1500}});await context.route('**/__oprn/**',async r=>{const u=new URL(r.request().url());try{await r.fulfill({response:await r.fetch({url:host+u.pathname+u.search,maxRetries:2})});}catch{await r.abort();}});await context.addInitScript({content:`window.__OPRN_BRIDGE__=${JSON.stringify(conf)};\n${bridge}`});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Page error',e.message)});const bootErrors=[];for(let attempt=0;attempt<3;attempt++){await page.goto(origin+'/?map=map_forest_cliff_village',{waitUntil:'domcontentloaded'});try{await page.waitForFunction(()=>window.__oprnProjectE2E?.currentProject()?.project?.maps?.map_forest_cliff_village,null,{timeout:45000});break;}catch(e){if(attempt===2)throw e;bootErrors.push(...errors.splice(0));}}console.log('Editor loaded');
 const loaded=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);for(const[id,m]of Object.entries(before.maps))assert.ok(isDeepStrictEqual(loaded.maps[id],m),'Concurrent edit '+id);const prev=fs.existsSync(out+'/editor-saved-project.json')?JSON.parse(fs.readFileSync(out+'/editor-saved-project.json')):before;assert.deepEqual(loaded.maps[mapId],prev.maps[mapId],'New map changed concurrently');
 const proof=await page.evaluate(async plan=>{
  const live=p=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===p).at(-1)?.name??p);const{store}=await live('/src/project/store.ts'),{paintTilesBulk}=await live('/src/editor/tileActions.ts'),{editorState}=await live('/src/editor/editorState.ts'),{canMove,isPassable}=await live('/src/project/collision.ts'),{autotileNeighborMask,autotileVariantForMask}=await live('/src/project/defaults/autotileEngine.ts');
  const mapId=plan.map.id,w=plan.map.width,h=plan.map.height,idx=(x,y)=>y*w+x,original=structuredClone(store.getCurrent().maps[mapId]),ts=store.getCurrent().tilesets[plan.map.tilesetId];const p=store.getCurrent();let m=structuredClone(plan.map);
  const road=ts.autotileGroups.find(g=>g.id==='forest_harmony_road_47'),roadSet=new Set(road.memberTileIds),lake=ts.autotileGroups.find(g=>g.id==='forest_harmony_lake_47');
  const core=idx(...plan.entry),deck=new Set(plan.deck.map(c=>idx(c.x,c.y))),houseCells=new Set(),reserved=new Set(deck),roadCells=new Set();
  for(const r of plan.houses){for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)houseCells.add(idx(x,y));for(let y=r.front.y-1;y<=r.front.y+1;y++)for(let x=r.front.x-1;x<=r.front.x+1;x++)reserved.add(idx(x,y));}
  function connectivity(map=m){const pass=Array.from({length:w*h},(_,i)=>isPassable(p,map,i%w,Math.floor(i/w))),q=[core],seen=new Set(q);if(!pass[core])throw Error('Start blocked');for(let k=0;k<q.length;k++){const i=q[k],x=i%w,y=Math.floor(i/w);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=idx(nx,ny);if(nx>=0&&ny>=0&&nx<w&&ny<h&&pass[n]&&!seen.has(n)&&canMove(p,map,x,y,nx,ny)){seen.add(n);q.push(n);}}}return{passable:pass.filter(Boolean).length,reachable:seen.size,seen};}
  const targets=[plan.exit,...plan.houses.map(r=>[r.front.x,r.front.y])];
  const reaches=map=>{const c=connectivity(map);return targets.every(a=>c.seen.has(idx(...a)));};
  if(!reaches(m))throw Error('Base plateau targets blocked '+JSON.stringify(targets.map(a=>({a,reachable:connectivity().seen.has(idx(...a))}))));
  const clear=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&!plan.forest[idx(x,y)]&&!houseCells.has(idx(x,y))&&(deck.has(idx(x,y))||(m.upperTiles[idx(x,y)]===-1&&([240,854].includes(m.lowerTiles[idx(x,y)])||roadSet.has(m.lowerTiles[idx(x,y)]))))&&isPassable(p,m,x,y);
  const routes=[];
  function route(a,b,width=2){
   const start=idx(...a),end=idx(...b),q=[start],g=new Map([[start,0]]),prev=new Map(),closed=new Set();const heuristic=i=>.7*(Math.abs(i%w-end%w)+Math.abs(Math.floor(i/w)-Math.floor(end/w)));let cells;
   if(!clear(...a)||!clear(...b))throw Error('Invalid road anchors '+JSON.stringify({a,b}));
   while(q.length){q.sort((a,b)=>g.get(b)+heuristic(b)-g.get(a)-heuristic(a));const i=q.pop();if(closed.has(i))continue;if(i===end){cells=[];let n=i;while(n!==undefined){cells.push(n);n=prev.get(n);}break;}closed.add(i);const x=i%w,y=Math.floor(i/w);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=idx(nx,ny);if(!clear(nx,ny)||closed.has(n)||!canMove(p,m,x,y,nx,ny))continue;const cost=g.get(i)+(roadCells.has(n)?.7:1);if(cost<(g.get(n)??Infinity)){g.set(n,cost);prev.set(n,i);q.push(n);}}}
   if(!cells)throw Error('No path '+JSON.stringify({a,b}));for(let k=0;k<cells.length;k++){const i=cells[k];if(deck.has(i))continue;roadCells.add(i);if(width===2){const n=cells[Math.min(k+1,cells.length-1)],horizontal=Math.floor(n/w)===Math.floor(i/w),x=i%w+(horizontal?0:1),y=Math.floor(i/w)+(horizontal?1:0);if(clear(x,y)&&!deck.has(idx(x,y)))roadCells.add(idx(x,y));}}routes.push({a,b,width,length:cells.length});
  }
  for(const[a,b]of plan.routes)route(a,b);
  route([14,22],[plan.houses[0].front.x,plan.houses[0].front.y],1);
  route([62,24],[plan.houses[1].front.x,plan.houses[1].front.y],1);
  for(const i of roadCells){m.lowerTiles[i]=1516;reserved.add(i);}
  const placements=[],missed=[];
  let allowValleyProps=false;
  const natural=(x,y)=>x>1&&y>1&&x<w-2&&y<h-2&&(plan.plateau[idx(x,y)]||allowValleyProps)&&!reserved.has(idx(x,y))&&!houseCells.has(idx(x,y))&&!plan.forest[idx(x,y)]&&m.upperTiles[idx(x,y)]===-1&&m.lowerTiles[idx(x,y)]===240;
  function place(id,x0,y0,radius,zone){const group=ts.tileGroups.find(g=>g.id.endsWith(id));if(!group){missed.push(id);return;}const v=group.previewMap,q=[];for(let y=y0-radius;y<=y0+radius;y++)for(let x=x0-radius;x<=x0+radius;x++)q.push({x,y,d:Math.abs(x-x0)+Math.abs(y-y0)});q.sort((a,b)=>a.d-b.d);for(const c of q){let fits=true;for(let dy=0;dy<v.height;dy++)for(let dx=0;dx<v.width;dx++)if(!natural(c.x+dx,c.y+dy))fits=false;if(!fits)continue;const candidate=structuredClone(m);for(let dy=0;dy<v.height;dy++)for(let dx=0;dx<v.width;dx++){const n=dy*v.width+dx,i=idx(c.x+dx,c.y+dy);if(v.lowerTiles[n]>=0&&v.lowerTiles[n]!==240)candidate.lowerTiles[i]=v.lowerTiles[n];candidate.upperTiles[i]=v.upperTiles[n];}if(!reaches(candidate))continue;m=candidate;placements.push({id,x:c.x,y:c.y,zone});return;}missed.push({id,x0,y0,zone});}
  for(const[id,x,y,r,z]of[
   ['village-prop-extension:11:0',16,19,2,'숲길지기 정원'],['village-life-new:birdhouse',10,16,1,'숲길지기 정원'],
   ['village-prop-extension:16:0',20,20,1,'작은 텃밭'],['tibo-unfake:seed-sack',22,22,1,'작은 텃밭'],['village-life-new:herb-planter-v2',12,24,1,'정원'],
   ['forest-trees:tree',8,24,1,'서쪽 전망'],['forest-trees:tree',21,28,1,'서쪽 전망'],['forest-trees:small-bush',18,24,1,'서쪽 길가'],
   ['village-life-new:stone-well-low',66,23,1,'쉼터 우물'],['village-prop-extension:16:2',65,21,1,'쉼터 게시판'],['village-prop-extension:11:0',59,21,1,'쉼터 화단'],
   ['village-life-new:fruit-basket',64,24,1,'쉼터'],['village-prop-extension:26:3',58,31,1,'동쪽 전망'],['forest-trees:tree',68,27,1,'동쪽 전망'],['forest-trees:tree',54,21,1,'동쪽 숲길'],
   ['forest-trees:small-bush',64,31,1,'전망대'],['tibo-unfake:stone-lantern',25,26,1,'서쪽 다리 입구'],['tibo-unfake:stone-lantern',53,26,1,'동쪽 다리 입구']
  ])place(id,x,y,r,z);
  allowValleyProps=true;
  for(const[id,x,y,r,z]of[['forest-trees:tree',38,58,1,'아래 숲 빈터'],['forest-trees:small-bush',42,62,1,'아래 숲 빈터'],['forest-trees:tree',29,42,0,'서쪽 절벽 아래'],['forest-trees:tree',48,33,0,'동쪽 절벽 아래'],['forest-trees:small-bush',29,35,0,'다리 아래']])place(id,x,y,r,z);
  allowValleyProps=false;
  const grass=[],small=[],patches=[[9,21],[17,21],[18,18],[17,27],[23,24],[23,32],[26,31],[56,26],[59,26],[59,33],[65,34],[70,31],[69,23],[72,27],[61,16]];
  for(let k=0;k<patches.length;k++){const[cx,cy]=patches[k];for(const[dx,dy]of[[0,0],[1,0],[0,1],[1,1],[0,2]]){const x=cx+dx,y=cy+dy;if(!natural(x,y))continue;m.lowerTiles[idx(x,y)]=k%4===0?70:304;grass.push({x,y,tile:m.lowerTiles[idx(x,y)]});}
   for(const[dx,dy,tile]of[[2,0,348],[-1,2,288],[2,3,k%3?289:59]]){const x=cx+dx,y=cy+dy;if(!natural(x,y))continue;const i=idx(x,y);m.upperTiles[i]=tile;if(!reaches(m)){m.upperTiles[i]=-1;continue;}small.push({x,y,tile});}
  }
  const paint=(edits,exact=false)=>{if(edits.length)paintTilesBulk(mapId,edits,{preservePattern:exact,clusterExpand:false});};
  try{
   store.update(project=>{project.maps[mapId]={...m,lowerTiles:Array(w*h).fill(240),upperTiles:Array(w*h).fill(-1)};if(!project.mapTree.children.some(n=>n.mapId===mapId))project.mapTree.children.push({mapId,children:[]});},{scope:'project',origin:'ai',label:'두 절벽 사이 숲 위 나무다리 저작'});
   editorState.set({currentMapId:mapId,zoom:1,showGrid:false,layer:'lower',tool:'paint',selectedTile:240,activePaletteStamp:null});
   const edits=[];for(let i=0;i<w*h;i++){if(m.lowerTiles[i]!==240)edits.push({layer:'lower',x:i%w,y:Math.floor(i/w),tile:m.lowerTiles[i]});if(m.upperTiles[i]>=0)edits.push({layer:'upper',x:i%w,y:Math.floor(i/w),tile:m.upperTiles[i]});}paint(edits,true);
   paint(plan.forest.flatMap((v,i)=>v?[{layer:'upper',x:i%w,y:Math.floor(i/w),tile:1617}]:[]));
   for(const[groupId,seed]of[['forest_harmony_road_47',1516],['forest_harmony_lake_47',1563],['builtin_tall_grass',304],['builtin_undergrowth',70]]){const g=ts.autotileGroups.find(g=>g.id===groupId);paint(m.lowerTiles.flatMap((t,i)=>g.memberTileIds.includes(t)?[{layer:'lower',x:i%w,y:Math.floor(i/w),tile:seed}]:[]));}
   paint([...plan.deck,...plan.rails].map(c=>({...c,layer:'upper'})),true);
   m=store.getCurrent().maps[mapId];const result=connectivity(),bad=[];
   for(const[id,layer]of[['forest_harmony_canopy_47','upper'],['forest_harmony_road_47','lower'],['forest_harmony_lake_47','lower'],['builtin_tall_grass','lower'],['builtin_undergrowth','lower']]){const g=ts.autotileGroups.find(g=>g.id===id),arr=layer==='upper'?m.upperTiles:m.lowerTiles;for(let i=0;i<w*h;i++)if(g.memberTileIds.includes(arr[i])){const mask=autotileNeighborMask({width:w,height:h,lowerTiles:arr},i%w,Math.floor(i/w),t=>(g.connectTileIds??g.memberTileIds).includes(t),8);if(arr[i]!==autotileVariantForMask(g,mask))bad.push([id,i]);}}
   const badTrunks=plan.trunks.edits.filter(c=>m.lowerTiles[idx(c.x,c.y)]!==c.tile),fronts=plan.houses.map(r=>({id:r.id,reachable:result.seen.has(idx(r.front.x,r.front.y)),onPlateau:plan.plateau[idx(r.front.x,r.front.y)]}));
   const removed=structuredClone(m);for(const c of plan.deck)removed.upperTiles[idx(c.x,c.y)]=-1;
   const onlyCrossing=!connectivity(removed).seen.has(idx(...plan.exit)),exitReachable=result.seen.has(idx(...plan.exit));
   const leaks=[];for(let x=29;x<=50;x++){if(canMove(p,m,x,28,x,27)||canMove(p,m,x,30,x,31))leaks.push(x);}
   if(!onlyCrossing){const q=[core],prev=new Map([[core,null]]),end=idx(...plan.exit);for(let k=0;k<q.length&&!prev.has(end);k++){const i=q[k],x=i%w,y=Math.floor(i/w);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=idx(nx,ny);if(nx>=0&&ny>=0&&nx<w&&ny<h&&!prev.has(n)&&canMove(p,removed,x,y,nx,ny)){prev.set(n,i);q.push(n);}}}const path=[];let n=end;while(n!=null){path.push([n%w,Math.floor(n/w)]);n=prev.get(n);}throw Error('Bridge bypass '+JSON.stringify({gapLower:[m.lowerTiles[idx(40,28)],m.lowerTiles[idx(40,29)],m.lowerTiles[idx(40,30)]],path}));}
   if(!exitReachable||!onlyCrossing||leaks.length||bad.length||badTrunks.length||fronts.some(f=>!f.reachable||!f.onPlateau))throw Error('Final audit '+JSON.stringify({exitReachable,onlyCrossing,leaks,bad,badTrunks,fronts}));
   const saved=await store.flush();return{mapId,width:w,height:h,cliffHeight:plan.height,houses:fronts,canopyCells:plan.forest.filter(Boolean).length,trunkRuns:plan.trunks.placements.length,badAutotiles:bad.length,badTrunks:badTrunks.length,passableCells:result.passable,reachableCells:result.reachable,bridge:{width:26,depth:3,cells:deck.size,onlyCrossing,exitReachable,railLeaks:leaks.length},placements,missed,grass:grass.length,smallProps:small.length,routes,saved:{kind:saved.kind,sha256:saved.sha256,receipt:saved.receipt}};

  }catch(e){store.update(project=>{if(original)project.maps[mapId]=original;else{delete project.maps[mapId];project.mapTree.children=project.mapTree.children.filter(n=>n.mapId!==mapId);}},{scope:'project',origin:'ai',label:'고원마을 검증 실패 복구'});await store.flush();throw e;}
 },plan);
 const expected=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(id=>window.__oprnProjectE2E?.currentProject()?.project?.maps?.[id],mapId,{timeout:120000});const saved=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);assert.deepEqual(saved.maps[mapId],expected.maps[mapId]);for(const[id,m]of Object.entries(before.maps).filter(([id])=>id!==mapId))assert.ok(isDeepStrictEqual(saved.maps[id],m),'Unrelated map changed '+id);assert.deepEqual(saved.tilesets,before.tilesets);assert.deepEqual(saved.assets,before.assets);
 fs.writeFileSync(out+'/editor-saved-project.json',JSON.stringify(saved));fs.writeFileSync(out+'/editor-proof.json',JSON.stringify({...proof,reloaded:true,otherMapsUnchanged:true,bootErrors,errors},null,2));
 const png=await page.evaluate(async id=>{const live=p=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===p).at(-1)?.name??p);const{store}=await live('/src/project/store.ts'),{drawMapTileLayers,loadTilesetImage}=await live('/src/editor/mapTileDraw.ts');const p=store.getCurrent(),m=p.maps[id],ts=p.tilesets[m.tilesetId],c=document.createElement('canvas');c.width=m.width*16;c.height=m.height*16;drawMapTileLayers(c.getContext('2d'),await loadTilesetImage(ts),m,ts,1);return c.toDataURL();},mapId);fs.writeFileSync(out+'/overview.png',Buffer.from(png.split(',')[1],'base64'));await page.screenshot({path:out+'/editor.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify({...proof,routes:proof.routes.length,placements:proof.placements.length,reloaded:true,errors}));
}finally{await browser.close();}
