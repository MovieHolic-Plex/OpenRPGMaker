import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { editorState } from "../editorState";
import { store } from "@/project/store";
import { DEFAULT_TERRAIN_GAMEPLAY, type TerrainGameplayRules, type TerrainStamp } from "@/project/terrainDesign";
import { selectTerrainFeature } from "../terrainDesignActions";
import { recordMapEditIfChanged } from "../mapEditHistory";
import { canEditMap, toastMapEditLockNotice } from "../mapEditLocks";
import { readTerrainLibrary, writeTerrainLibrary, parseTerrainLibrary } from "../terrainStampLibrary";
import { renderTileCellsToCanvas } from "../harnessSuggestion/kitRender";

export function mountTerrainEvolutionPanel(body: HTMLElement): () => void {
  const root=el("div",{class:"terrain-evolution-controls"});body.append(root);
  const section=(title:string,id:string)=>{const details=el("details",{dataset:{testid:`terrain-design-${id}`}});details.append(el("summary",{text:title}));root.append(details);return details;};
  const select=(host:HTMLElement,key:string,label:string,options:readonly (readonly [string,string])[],change:(v:string)=>void)=>{const input=el("select",{attrs:{"aria-label":label},dataset:{testid:`terrain-design-${key}`},on:{change:e=>change((e.target as HTMLSelectElement).value)}}) as HTMLSelectElement;for(const[value,text]of options)input.append(el("option",{value,text}));host.append(el("label",{class:"terrain-design-field",children:[el("span",{text:label}),input]}));return input;};
  const number=(host:HTMLElement,key:string,label:string,min:number,max:number,change:(v:number)=>void)=>{const input=el("input",{attrs:{type:"number",min:String(min),max:String(max),step:"1","aria-label":label},dataset:{testid:`terrain-design-${key}`},on:{change:e=>{const v=Number((e.target as HTMLInputElement).value);if(Number.isFinite(v))change(Math.max(min,Math.min(max,Math.round(v))));}}}) as HTMLInputElement;host.append(el("label",{class:"terrain-design-field",children:[el("span",{text:label}),input]}));return input;};
  const check=(host:HTMLElement,key:string,label:string,change:(v:boolean)=>void)=>{const input=el("input",{attrs:{type:"checkbox"},dataset:{testid:`terrain-design-${key}`},on:{change:e=>change((e.target as HTMLInputElement).checked)}}) as HTMLInputElement;host.append(el("label",{class:"terrain-design-check",children:[input,el("span",{text:label})]}));return input;};
  const button=(host:HTMLElement,key:string,text:string,click:()=>void)=>{const b=el("button",{class:"relief-bar-size",text,attrs:{type:"button"},dataset:{testid:`terrain-design-${key}`},on:{click}});host.append(b);return b;};
  const edit=section("적용한 지형 재편집","features");
  const feature=select(edit,"feature","지형 선택",[],selectTerrainFeature);
  button(edit,"feature-new","새 지형 그리기",()=>editorState.set({terrainFeatureId:null,terrainPoints:null,terrainDragPoint:null}));
  edit.append(el("p",{text:"점을 드래그하고 높이·폭·수위를 바꾼 뒤 적용하세요. 다른 편집과 겹친 부분은 먼저 되돌려 주세요."}));
  const finish=section("침식 · 평활화 · 모서리","finishing");finish.open=true;
  const finishMethod=select(finish,"finish-method","다듬기 방식",[["smooth","평활화"],["erode","침식"],["corners","절벽 모서리 정리"]],v=>editorState.set({terrainFinishMethod:v as "smooth"|"erode"|"corners"}));
  const finishPasses=number(finish,"finish-passes","반복 횟수",1,8,v=>editorState.set({terrainFinishPasses:v}));
  const route=section("게임 상태로 경로 검사","route-state");route.open=true;
  const bodySize=[number(route,"body-width","몸 폭",1,8,v=>{const b=[...editorState.get().terrainRouteBody] as [number,number,number];b[0]=v;editorState.set({terrainRouteBody:b});}),number(route,"body-height","몸 높이",1,8,v=>{const b=[...editorState.get().terrainRouteBody] as [number,number,number];b[1]=v;b[2]=Math.min(v,b[2]);editorState.set({terrainRouteBody:b});}),number(route,"pass-rows","통행 차단 행",1,8,v=>{const b=[...editorState.get().terrainRouteBody] as [number,number,number];b[2]=Math.min(v,b[1]);editorState.set({terrainRouteBody:b});})];
  const events=check(route,"route-events","문·NPC 점유 검사",v=>editorState.set({terrainRouteEvents:v}));
  const door=select(route,"route-door","문 이벤트",[],v=>editorState.set({terrainRouteDoorId:v}));
  const doors=select(route,"route-doors","문 상태",[["authored","조건·스위치대로"],["open","열린 상태"],["closed","닫힌 상태"]],v=>editorState.set({terrainRouteDoors:v as "authored"|"open"|"closed"}));
  const switches=el("div",{class:"terrain-design-switches"});route.append(switches);
  const gameplay=section("게임 시야 · 높이 규칙","gameplay");
  const setRule=<K extends keyof TerrainGameplayRules>(key:K,value:TerrainGameplayRules[K])=>{const id=editorState.get().currentMapId;if(!id)return;if(!canEditMap(id)){toastMapEditLockNotice(id);return;}recordMapEditIfChanged(id,()=>store.updateMap(id,map=>{map.terrainDesign??={};map.terrainDesign.gameplay={...DEFAULT_TERRAIN_GAMEPLAY,...map.terrainDesign.gameplay,[key]:value};},{label:"지형 게임 규칙"}));};
  const block=check(gameplay,"vision-blocking","지형이 시야를 차단",v=>setRule("visionBlocking",v));
  const gain=check(gameplay,"high-ground-vision","고지에서 시야 확대",v=>setRule("highGroundVision",v));
  const projectile=check(gameplay,"projectile-height","발사체 높이 충돌",v=>setRule("projectileHeight",v));
  const radius=number(gameplay,"vision-radius","기본 시야 반경",1,32,v=>setRule("visionRadius",v));
  const bonus=number(gameplay,"vision-gain","높이당 추가 반경",0,4,v=>setRule("visionGain",v));
  const preview=check(gameplay,"vision-preview","캔버스에서 시야 미리보기",v=>editorState.set({terrainVisionPreview:v,terrainPoints:null}));
  gameplay.append(el("p",{text:"미리보기를 켜고 캔버스를 누르면 관찰 위치가 바뀝니다. 게임의 시야·NPC 감지에도 같은 규칙이 적용됩니다."}));
  const library=section("공용 지형 도장","shared-stamps");
  const search=el("input",{attrs:{type:"search",placeholder:"도장 이름 검색","aria-label":"도장 검색"},dataset:{testid:"terrain-design-stamp-search"}}) as HTMLInputElement;library.append(search);
  const cards=el("div",{class:"terrain-stamp-cards",dataset:{testid:"terrain-design-stamp-cards"}});library.append(cards);
  let shared:TerrainStamp[]=[],lastCards="",lastFeature="",lastEvents="",lastSwitches="";
  const refresh=async()=>{try{shared=await readTerrainLibrary();lastCards="";sync();}catch(e){toast(`공용 도장을 읽지 못했습니다: ${(e as Error).message}`,"error");}};
  const failure=(e:unknown)=>toast((e as Error).message,"error");
  button(library,"stamp-share","선택 도장을 공용에 저장",()=>{const stamp=store.getCurrent().terrainStamps?.find(s=>s.id===editorState.get().terrainStampId);if(!stamp){toast("먼저 도장을 선택하세요","info");return;}void writeTerrainLibrary([stamp]).then(()=>refresh()).catch(failure);});
  button(library,"stamp-refresh","공용 목록 새로고침",()=>void refresh());
  button(library,"stamp-export","공용 도장 내보내기",()=>{const blob=new Blob([JSON.stringify({format:"oprn-terrain-stamps",version:1,stamps:shared})],{type:"application/json"}),url=URL.createObjectURL(blob),a=el("a",{attrs:{href:url,download:"terrain-stamps.json"}});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const file=el("input",{attrs:{type:"file",accept:".json,application/json"},dataset:{testid:"terrain-design-stamp-import-file"}}) as HTMLInputElement;file.hidden=true;library.append(file);
  file.addEventListener("change",()=>{const f=file.files?.[0];if(!f)return;if(f.size>24*1024*1024){failure(new Error("도장 파일은 24MB 이하로 나누어 주세요"));return;}void f.text().then(text=>writeTerrainLibrary(parseTerrainLibrary(text))).then(()=>refresh()).catch(failure).finally(()=>{file.value="";});});
  button(library,"stamp-import","도장 파일 가져오기",()=>file.click());
  library.append(el("p",{text:"이 브라우저의 모든 프로젝트에서 공유됩니다. 다른 기기로 옮길 때는 파일을 내보내세요. 같은 칩셋에서 사용할 수 있습니다."}));
  function sync():void {
    const s=editorState.get(),p=store.getCurrent(),map=s.currentMapId?p.maps[s.currentMapId]:undefined;
    edit.hidden=!["contour","road","ridge","valley","lake"].includes(s.terrainBrush);finish.hidden=s.terrainBrush!=="finish";route.hidden=s.terrainBrush!=="route";library.hidden=s.terrainBrush!=="stamp";
    const fk=JSON.stringify(map?.terrainDesign?.features?.map(f=>[f.id,f.tool,f.points,f.options]));
    if(fk!==lastFeature){lastFeature=fk;feature.replaceChildren(el("option",{value:"",text:"새 지형"}));for(const f of map?.terrainDesign?.features??[])feature.append(el("option",{value:f.id,text:`${{contour:"절벽",road:"길",ridge:"능선",valley:"계곡",lake:"호수"}[f.tool]} · ${f.points.length}점 · ${f.id.slice(-6)}`}));}
    feature.value=s.terrainFeatureId??"";finishMethod.value=s.terrainFinishMethod;finishPasses.value=String(s.terrainFinishPasses);bodySize.forEach((input,n)=>{if(document.activeElement!==input)input.value=String(s.terrainRouteBody[n]);});events.checked=s.terrainRouteEvents;doors.value=s.terrainRouteDoors;
    const ek=JSON.stringify(map?.events.map(e=>[e.id,e.name]));if(ek!==lastEvents){lastEvents=ek;door.replaceChildren(el("option",{value:"",text:"선택 안 함"}));for(const e of map?.events??[])door.append(el("option",{value:e.id,text:e.name}));}door.value=s.terrainRouteDoorId;
    const sk=JSON.stringify([p.switches,s.terrainRouteSwitches]);if(sk!==lastSwitches){lastSwitches=sk;switches.replaceChildren();for(const sw of p.switches.filter(sw=>map?.events.some(e=>e.pages?.some(pg=>pg.conditions.some(c=>c.kind==="switch"&&c.switchId===sw.id))))){const toggle=check(switches,`route-switch-${sw.id}`,sw.name,v=>editorState.set({terrainRouteSwitches:{...editorState.get().terrainRouteSwitches,[sw.id]:v}}));toggle.checked=s.terrainRouteSwitches[sw.id]??p.session?.switches?.[sw.id]??false;}}
    const g={...DEFAULT_TERRAIN_GAMEPLAY,...map?.terrainDesign?.gameplay};block.checked=g.visionBlocking;gain.checked=g.highGroundVision;projectile.checked=g.projectileHeight;radius.value=String(g.visionRadius);bonus.value=String(g.visionGain);preview.checked=s.terrainVisionPreview;
    const ck=JSON.stringify([map?.tilesetId,search.value,shared.map(s=>[s.id,s.name])]);if(ck!==lastCards){lastCards=ck;cards.replaceChildren();for(const stamp of shared.filter(st=>st.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))){const b=el("button",{class:"terrain-stamp-card",attrs:{type:"button"},dataset:{stampId:stamp.id},on:{click:()=>{if(stamp.tilesetId!==map?.tilesetId){toast("같은 칩셋의 맵에서 사용하세요","info");return;}store.update(d=>{d.terrainStamps=[...(d.terrainStamps??[]).filter(s=>s.id!==stamp.id),structuredClone(stamp)];},{scope:"project",label:"공용 지형 도장 가져오기"});editorState.set({terrainStampId:stamp.id,terrainStampCapture:false,terrainPoints:null});}}});const tileset=p.tilesets[stamp.tilesetId];if(tileset)b.append(renderTileCellsToCanvas({tileset,widthTiles:stamp.width,heightTiles:stamp.height,scale:Math.min(1,6/Math.max(stamp.width,stamp.height)),backgroundTile:null,cells:stamp.cells.flatMap((c,i)=>c.layers.map((tile,n)=>({dx:i%stamp.width,dy:Math.floor(i/stamp.width),layer:n<2?"lower" as const:"upper" as const,tile})))}));b.append(el("span",{text:`${stamp.name} · ${stamp.width}×${stamp.height}`}));cards.append(b);}
      if(!cards.childElementCount)cards.append(el("p",{text:"공용 도장이 없습니다. 프로젝트 도장을 선택해 공용에 저장하세요."}));}
  }
  search.addEventListener("input",sync);const offState=editorState.subscribe(sync),offStore=store.subscribe(sync);sync();void refresh();
  return()=>{offState();offStore();root.remove();};
}
