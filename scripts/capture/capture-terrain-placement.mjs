// Actual editor interactions, plus captured production-planner observations. Memory fixture only.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const out="verify-shots/terrain-placement";mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:["--disable-background-networking","--no-proxy-server","--js-flags=--max-old-space-size=8192"]});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];const findings={};
page.on("crash",()=>{errors.push("PAGE CRASH");console.log("PAGE CRASH");});
page.on("pageerror",e=>{errors.push(e.stack??e.message);console.log(e.message);});
try {
  console.log("opening editor");
  await page.goto(`${process.env.TERRAIN_CAPTURE_URL??"http://127.0.0.1:9833"}/?blankProject=1`,{waitUntil:"load",timeout:120000});
  for(let attempt=0;attempt<3;attempt++){try{await page.waitForFunction(()=>window.__oprnEditorStore&&window.__oprnEditWorldToClient,null,{timeout:60000});break;}catch(error){console.log("boot retry",attempt);if(attempt===2)throw error;await page.reload({waitUntil:"load",timeout:120000});}}
  await page.getByTestId("boot-loader").waitFor({state:"hidden",timeout:120000});
  console.log("editor ready");
  findings.contracts=await page.evaluate(async()=>{
    const {editorState}=await import("/src/editor/editorState.ts"),{createBlankMap}=await import("/src/project/defaults/defaultMaps.ts");
    const {reliefDoodadCatalog,planReliefDoodad}=await import("/src/editor/reliefDoodads.ts");
    const {terrainMaterialTile}=await import("/src/editor/terrainMaterials.ts");
    const {terrainReachability}=await import("/src/project/terrainReachability.ts");
    const {planTerrainCluster,planMoveDoodadGroup,deleteDoodadGroup}=await import("/src/editor/terrainClusters.ts");
    const {cloneExtraLayers,cropExtraLayers,layerTileAt,setLayerTileAt}=await import("/src/project/mapLayers.ts");
    const {normalizeDoodadGroups}=await import("/src/project/doodadGroups.ts");
    const {requestEditorCameraFocus}=await import("/src/editor/editorCameraFocus.ts");
    const {resetMapEditHistory}=await import("/src/editor/mapEditHistory.ts");
    const store=window.__oprnEditorStore,p=store.getCurrent(),original=p.maps[p.startMapId],tileset=p.tilesets[original.tilesetId];
    const map=createBlankMap("지형 설치 확인",40,30,original.tilesetId,original.tileSize);map.id=original.id;
    map.relief={width:40,height:30,levels:new Array(1200).fill(0),ramps:new Array(1200).fill(0)};
    for(let y=10;y<=17;y++)for(let x=12;x<=23;x++)map.relief.levels[y*40+x]=2;
    const ramp=reliefDoodadCatalog(tileset).find(d=>d.id==="ramp:slope");
    const rampFindings=[];
    for(const [dir,x,y] of [["n",17,17],["s",17,10],["e",12,14],["w",23,14]])for(const width of [2,4,6]){
      const draft={...map,...cloneExtraLayers(map)},plan=planReliefDoodad(draft,ramp,{x,y,face:"top"},{width});if(plan.ok)plan.apply(draft);
      const reached=terrainReachability({...p,maps:{...p.maps,[draft.id]:draft}},draft,{x:5,y:25});
      rampFindings.push({dir,width,ok:plan.ok,reason:plan.reason,codes:[...new Set(draft.relief.ramps.filter(Boolean))],cells:draft.relief.ramps.filter(Boolean).length,plateauReachable:reached[14*40+17]===1});
    }
    const materials=Object.fromEntries(["grass","dirt","stone","water"].map(m=>[m,terrainMaterialTile(tileset,m)]));
    const props=reliefDoodadCatalog(tileset).filter(d=>d.kind==="prop");
    const prop=props.find(d=>d.tab==="tree")??props[0],clusterFindings=[];
    if(prop){
      for(const density of [15,35,70]){
        const draft={...map,lowerTiles:map.lowerTiles.slice(),upperTiles:map.upperTiles.slice(),...cloneExtraLayers(map)};
        const before=JSON.stringify(draft.upperTiles),plan=planTerrainCluster(draft,tileset,prop,29,23,6,density);
        if(plan.ok)plan.apply(draft);const g=draft.doodadGroups?.[0];
        const clone={...draft,...cloneExtraLayers(draft)};
        if(clone.doodadGroups)clone.doodadGroups[0].cells[0].before=99999;
        const independent=g?.cells[0].before!==99999;
        const move=g?planMoveDoodadGroup(draft,tileset,g.id,-1,0):null;
        if(move?.ok)move.apply(draft);
        const movedGroup=draft.doodadGroups?.[0],serialized=JSON.parse(JSON.stringify(draft));
        serialized.doodadGroups=normalizeDoodadGroups(serialized.doodadGroups,1200);
        const saveShape=!!serialized.doodadGroups?.length;
        if(movedGroup)deleteDoodadGroup(draft,movedGroup.id);
        clusterFindings.push({density,ok:plan.ok,cells:g?.cells.length,move:move?.ok,restored:JSON.stringify(draft.upperTiles)===before,independent,saveShape});
      }
    }
    store.updateMap(map.id,draft=>Object.assign(draft,map),{label:"지형 설치 화면 fixture"});
    editorState.set({currentMapId:map.id,tool:"relief",layer:"lower",zoom:1,reliefDoodadOpen:false,reliefDoodad:null,terrainBrush:"height",terrainReachability:false});
    requestEditorCameraFocus({mapId:map.id,tileX:20,tileY:15,immediate:true});resetMapEditHistory();
    return{tileset:tileset.id,materials,ramps:rampFindings,clusters:clusterFindings,propId:prop?.id,bridgeIds:reliefDoodadCatalog(tileset).filter(d=>d.kind==="bridge").map(d=>d.id)};
  });
  console.log(JSON.stringify(findings.contracts));
  const historyKey=async key=>{await page.keyboard.down("Control");await page.keyboard.down(key);await page.waitForTimeout(100);await page.keyboard.up(key);await page.keyboard.up("Control");await page.waitForTimeout(700);};
  const clickCell=async(x,y)=>{
    const point=await page.evaluate(async({x,y})=>{const {reliefLiftField,cellLift}=await import("/src/project/relief/screen.ts");const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId],lift=m.relief?cellLift(reliefLiftField(m.relief),x,y):0;return window.__oprnEditWorldToClient((x+.5)*m.tileSize,(y+.5-lift)*m.tileSize);},{x,y});
    await page.mouse.click(point.x,point.y);await page.waitForTimeout(700);
  };
  await page.getByTestId("relief-doodad-toggle").click();
  await page.getByTestId("relief-ramp-width").selectOption("6");
  await page.getByTestId("relief-doodad-ramp:slope").click();
  await clickCell(17,17);
  findings.rampUI=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent();return p.maps[p.startMapId].relief.ramps.filter(Boolean).length;});
  await page.getByTestId("relief-doodad-close").click();
  await page.getByTestId("terrain-tool-surface").click();
  await page.getByTestId("terrain-material").selectOption("dirt");
  const heights=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent();return JSON.stringify(p.maps[p.startMapId].relief.levels);});
  await clickCell(16,14);
  findings.surfaceHeightUnchanged=await page.evaluate(before=>{const p=window.__oprnEditorStore.getCurrent();return JSON.stringify(p.maps[p.startMapId].relief.levels)===before;},heights);
  await page.getByTestId("terrain-tool-river").click();await page.getByTestId("terrain-width").selectOption("5");
  for(let y=9;y<=25;y++)await clickCell(7,y);
  await page.getByTestId("relief-doodad-toggle").click();await page.getByTestId("relief-doodad-tab-tree").click();
  if(findings.contracts.propId){
    await page.getByTestId(`relief-doodad-${findings.contracts.propId}`).click();
    const head=await page.locator(".relief-pop-head").boundingBox(),area=await page.locator(".canvas-area").boundingBox();
    await page.mouse.move(head.x+80,head.y+14);await page.mouse.down();await page.mouse.move(area.x+90,area.y+24,{steps:8});await page.mouse.up();
    await clickCell(29,23);
  }
  await page.getByTestId("relief-doodad-close").click();
  await page.getByTestId("terrain-tool-group").click();
  const groupCell=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId],c=m.doodadGroups?.[0]?.cells[0];return c?{x:c.index%m.width,y:Math.floor(c.index/m.width)}:null;});
  if(groupCell){
    await page.locator(".canvas-area").screenshot({path:`${out}/cluster-placed.png`});
    await clickCell(groupCell.x,groupCell.y);await page.getByTestId("terrain-group-move").click();await clickCell(groupCell.x-1,groupCell.y);
    findings.moveUI=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId];return m.doodadGroups?.[0]?.cells[0]?.index;});
    await clickCell(groupCell.x-1,groupCell.y);await page.getByTestId("terrain-group-delete").click();
    await page.locator(".canvas-area").screenshot({path:`${out}/cluster-deleted.png`});
    findings.deleteUI=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent();return !p.maps[p.startMapId].doodadGroups;});
    await historyKey("z");
    findings.undoGroup=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent();return !!p.maps[p.startMapId].doodadGroups?.length;});
    await historyKey("y");
    findings.redoGroup=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent();return !p.maps[p.startMapId].doodadGroups;});
    await historyKey("z");
    findings.finalGroupRestored=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent();return !!p.maps[p.startMapId].doodadGroups?.length;});
  }
  await page.getByTestId("relief-doodad-toggle").click();await page.getByTestId("relief-doodad-tab-bridge").click();
  await page.getByTestId("relief-doodad-bridge:horizontal").click();
  await clickCell(4,22);
  findings.bridgeFirstClick=await page.evaluate(async()=>{const {editorState}=await import("/src/editor/editorState.ts");return !!editorState.get().reliefBridgeStart;});
  await clickCell(10,22);
  findings.bridgeUI=await page.evaluate(()=>{const p=window.__oprnEditorStore.getCurrent();return p.maps[p.startMapId].relief.ramps.filter(v=>v===9).length;});
  await page.getByTestId("relief-doodad-close").click();
  await page.getByTestId("terrain-tool-height").click();await page.mouse.move(20,40);await page.waitForTimeout(800);
  await page.screenshot({path:`${out}/editor-tools.png`});await page.locator(".canvas-area").screenshot({path:`${out}/editor-map.png`});
  await page.getByTestId("terrain-reachability").click();await page.waitForTimeout(800);await page.screenshot({path:`${out}/editor-reachability.png`});
  const fixture=await page.evaluate(async()=>{
    const {serialize}=await import("/src/project/io/serialize.ts"),p=window.__oprnEditorStore.getCurrent(),map=p.maps[p.startMapId];
    return serialize({...p,maps:{[map.id]:map},tilesets:{[map.tilesetId]:{...p.tilesets[map.tilesetId],referenceDocuments:[]}},assets:{...p.assets,uploaded:{}}});
  });
  writeFileSync(`.vite-cache/terrain-placement-fixture-wire.json`,fixture);
  console.log(JSON.stringify(findings));
} finally {writeFileSync(`${out}/observations.json`,JSON.stringify({findings,errors},null,2)+"\n");await browser.close();}
