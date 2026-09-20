import fs from 'node:fs';import{isDeepStrictEqual}from'node:util';import assert from 'node:assert/strict';import{chromium}from'playwright';import{configFromEnv,loadCurrentJson}from'../supabase-resource-root/supabaseRest.mjs';
const out='output/evidence/village-ten',plans=JSON.parse(fs.readFileSync(out+'/plans.json')),before=JSON.parse(fs.readFileSync(out+'/local-before.json')),projectId='oprn-hill-forest-harmony-20260918-a4e1';
await loadCurrentJson({...await configFromEnv(),projectId});const host='http://127.0.0.1:9825',origin=process.env.BRIDGE_DEV_ORIGIN??'http://127.0.0.1:9832';
const conf=JSON.parse((await(await fetch(host)).text()).match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/)[1]),bridge=await(await fetch(host+'/__oprn/bridge.js')).text();
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',args:['--no-sandbox','--no-proxy-server']});
try{
 const context=await browser.newContext({viewport:{width:1740,height:1500}});await context.route('**/__oprn/**',async r=>{const u=new URL(r.request().url());try{await r.fulfill({response:await r.fetch({url:host+u.pathname+u.search,maxRetries:2})});}catch{await r.abort();}});await context.addInitScript({content:`window.__OPRN_BRIDGE__=${JSON.stringify(conf)};\n${bridge}`});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Page error',e.message)});const bootErrors=[];for(let attempt=0;attempt<3;attempt++){await page.goto(origin+'/?map=map_forest_cliff_village',{waitUntil:'domcontentloaded'});try{await page.waitForFunction(()=>window.__oprnProjectE2E?.currentProject()?.project?.maps?.map_forest_cliff_village,null,{timeout:45000});break;}catch(e){if(attempt===2)throw e;bootErrors.push(...errors.splice(0));}}console.log('Editor loaded');
 const loaded=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);for(const[id,m]of Object.entries(before.maps))assert.ok(isDeepStrictEqual(loaded.maps[id],m),'Concurrent edit '+id);
 const proofs=[];for(const plan of plans){const mapId=plan.map.id; if(loaded.maps[mapId]){console.log('Already exists',mapId);continue;}
 const proof=await page.evaluate(async plan=>{
  const live=p=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===p).at(-1)?.name??p);const{store}=await live('/src/project/store.ts'),{paintTilesBulk}=await live('/src/editor/tileActions.ts'),{editorState}=await live('/src/editor/editorState.ts'),{canMove,isPassable}=await live('/src/project/collision.ts'),{autotileNeighborMask,autotileVariantForMask}=await live('/src/project/defaults/autotileEngine.ts');
  const mapId=plan.map.id,w=plan.map.width,h=plan.map.height,idx=(x,y)=>y*w+x,original=structuredClone(store.getCurrent().maps[mapId]),ts=store.getCurrent().tilesets[plan.map.tilesetId];const p=store.getCurrent();let m=structuredClone(plan.map);
  const road=ts.autotileGroups.find(g=>g.id==='forest_harmony_road_47'),roadSet=new Set(road.memberTileIds),lake=ts.autotileGroups.find(g=>g.id==='forest_harmony_lake_47');
  plan.entry=plan.spec.entry;plan.exit=plan.spec.exit;const core=idx(...plan.entry),deck=new Set(plan.bridges.map(c=>idx(c.x,c.y))),houseCells=new Set(),reserved=new Set(deck),roadCells=new Set();
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

  for(const i of roadCells){if(m.lowerTiles[i]!==854)m.lowerTiles[i]=1516;reserved.add(i);}
  const placements=[],missed=[];
  let allowValleyProps=true;
  const natural=(x,y)=>x>1&&y>1&&x<w-2&&y<h-2&&(plan.plateau[idx(x,y)]||allowValleyProps)&&!reserved.has(idx(x,y))&&!houseCells.has(idx(x,y))&&!plan.forest[idx(x,y)]&&m.upperTiles[idx(x,y)]===-1&&m.lowerTiles[idx(x,y)]===240;
  function place(id,x0,y0,radius,zone){const group=ts.tileGroups.find(g=>g.id.endsWith(id));if(!group){missed.push(id);return;}const v=group.previewMap,q=[];for(let y=y0-radius;y<=y0+radius;y++)for(let x=x0-radius;x<=x0+radius;x++)q.push({x,y,d:Math.abs(x-x0)+Math.abs(y-y0)});q.sort((a,b)=>a.d-b.d);for(const c of q){let fits=true;for(let dy=0;dy<v.height;dy++)for(let dx=0;dx<v.width;dx++)if(!natural(c.x+dx,c.y+dy))fits=false;if(!fits)continue;const candidate=structuredClone(m);for(let dy=0;dy<v.height;dy++)for(let dx=0;dx<v.width;dx++){const n=dy*v.width+dx,i=idx(c.x+dx,c.y+dy);if(v.lowerTiles[n]>=0&&v.lowerTiles[n]!==240)candidate.lowerTiles[i]=v.lowerTiles[n];candidate.upperTiles[i]=v.upperTiles[n];}if(!reaches(candidate))continue;m=candidate;placements.push({id,x:c.x,y:c.y,zone});return;}missed.push({id,x0,y0,zone});}
  for(const [k,r] of plan.houses.entries()){
   place('village-prop-extension:11:0',r.x-2,r.y+r.h-1,4,'집 화단');
   place(k%2?'village-life-new:herb-planter-v2':'village-prop-extension:16:0',r.x+r.w+1,r.y+r.h-1,4,'집 텃밭');
   place(k%2?'village-life-new:birdhouse':'village-life-new:fruit-basket',r.x-2,r.y+r.h+2,3,'생활 소품');
   place('forest-trees:tree',r.x+r.w+3,r.y-2,4,'독립 나무');
   place('forest-trees:small-bush',r.x-4,r.y+1,3,'길가 관목');
  }
  place('village-life-new:stone-well-low',plan.houses[0].front.x+4,plan.houses[0].front.y+3,5,'공용 우물');
  place('village-prop-extension:16:2',plan.houses[0].x-3,plan.houses[0].y+4,4,'집 근처 게시판');
  if(plan.spec.orchard)for(let y=26;y<=38;y+=6)for(let x=27;x<=45;x+=6)place('forest-trees:tree',x,y,2,'과수원');
  const grass=[],small=[];
  for(let y=5;y<h-5;y+=7)for(let x=5;x<w-5;x+=7){
   if((x*17+y*11)%5===0)continue;
   for(const[dx,dy]of[[0,0],[1,0],[0,1],[1,1]])if(natural(x+dx,y+dy)){const tile=(x+y)%3?304:70;m.lowerTiles[idx(x+dx,y+dy)]=tile;grass.push({x:x+dx,y:y+dy,tile});}
   if(natural(x+2,y+1)){m.upperTiles[idx(x+2,y+1)]=289;if(!reaches(m))m.upperTiles[idx(x+2,y+1)]=-1;else small.push({x:x+2,y:y+1,tile:289});}
  }
  const paint=(edits,exact=false)=>{if(edits.length)paintTilesBulk(mapId,edits,{preservePattern:exact,clusterExpand:false});};
  try{
   store.update(project=>{project.maps[mapId]={...m,lowerTiles:Array(w*h).fill(240),upperTiles:Array(w*h).fill(-1)};if(!project.mapTree.children.some(n=>n.mapId===mapId))project.mapTree.children.push({mapId,children:[]});},{scope:'project',origin:'ai',label:'두 절벽 사이 숲 위 나무다리 저작'});
   editorState.set({currentMapId:mapId,zoom:1,showGrid:false,layer:'lower',tool:'paint',selectedTile:240,activePaletteStamp:null});
   const edits=[];for(let i=0;i<w*h;i++){if(m.lowerTiles[i]!==240)edits.push({layer:'lower',x:i%w,y:Math.floor(i/w),tile:m.lowerTiles[i]});if(m.upperTiles[i]>=0)edits.push({layer:'upper',x:i%w,y:Math.floor(i/w),tile:m.upperTiles[i]});}paint(edits,true);
   paint(plan.forest.flatMap((v,i)=>v?[{layer:'upper',x:i%w,y:Math.floor(i/w),tile:1617}]:[]));
   for(const[groupId,seed]of[['forest_harmony_road_47',1516],['forest_harmony_lake_47',1563],['builtin_tall_grass',304],['builtin_undergrowth',70]]){const g=ts.autotileGroups.find(g=>g.id===groupId);paint(m.lowerTiles.flatMap((t,i)=>g.memberTileIds.includes(t)?[{layer:'lower',x:i%w,y:Math.floor(i/w),tile:seed}]:[]));}
   paint(plan.bridges.map(c=>({...c,layer:'upper'})),true);
   m=store.getCurrent().maps[mapId];const result=connectivity(),bad=[];
   for(const[id,layer]of[['forest_harmony_canopy_47','upper'],['forest_harmony_road_47','lower'],['forest_harmony_lake_47','lower'],['builtin_tall_grass','lower'],['builtin_undergrowth','lower']]){const g=ts.autotileGroups.find(g=>g.id===id),arr=layer==='upper'?m.upperTiles:m.lowerTiles;for(let i=0;i<w*h;i++)if(g.memberTileIds.includes(arr[i])){const mask=autotileNeighborMask({width:w,height:h,lowerTiles:arr},i%w,Math.floor(i/w),t=>(g.connectTileIds??g.memberTileIds).includes(t),8);if(arr[i]!==autotileVariantForMask(g,mask))bad.push([id,i]);}}
   const badTrunks=plan.trunks.edits.filter(c=>m.lowerTiles[idx(c.x,c.y)]!==c.tile),fronts=plan.houses.map(r=>({id:r.id,reachable:result.seen.has(idx(r.front.x,r.front.y)),onPlateau:plan.plateau[idx(r.front.x,r.front.y)]}));
   const exitReachable=result.seen.has(idx(...plan.exit));
   if(!exitReachable||bad.length||badTrunks.length||fronts.some(f=>!f.reachable))throw Error('Final audit '+JSON.stringify({exitReachable,bad,badTrunks,fronts}));
   const saved=await store.flush();return{mapId,width:w,height:h,houses:fronts,canopyCells:plan.forest.filter(Boolean).length,trunkRuns:plan.trunks.placements.length,badAutotiles:bad.length,badTrunks:badTrunks.length,passableCells:result.passable,reachableCells:result.reachable,exitReachable,placements,missed,grass:grass.length,smallProps:small.length,routes,saved:{kind:saved.kind,sha256:saved.sha256}};

  }catch(e){store.update(project=>{if(original)project.maps[mapId]=original;else{delete project.maps[mapId];project.mapTree.children=project.mapTree.children.filter(n=>n.mapId!==mapId);}},{scope:'project',origin:'ai',label:'고원마을 검증 실패 복구'});await store.flush();throw e;}
 },plan);
 proofs.push(proof);fs.writeFileSync(out+'/editor-proof.json',JSON.stringify(proofs,null,2));console.log('Created',mapId,proof.placements.length);}
 const expected=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__oprnProjectE2E?.currentProject()?.project?.maps?.map_forest_cliff_village,null,{timeout:120000});const saved=await page.evaluate(()=>window.__oprnProjectE2E.currentProject().project);for(const plan of plans)assert.deepEqual(saved.maps[plan.map.id],expected.maps[plan.map.id]);for(const[id,m]of Object.entries(before.maps))assert.deepEqual(saved.maps[id],m);assert.deepEqual(saved.tilesets,before.tilesets);assert.deepEqual(saved.assets,before.assets);fs.writeFileSync(out+'/editor-saved-project.json',JSON.stringify(saved));fs.writeFileSync(out+'/reload-proof.json',JSON.stringify({reloaded:true,otherMapsUnchanged:true,errors},null,2));
}finally{await browser.close();}
