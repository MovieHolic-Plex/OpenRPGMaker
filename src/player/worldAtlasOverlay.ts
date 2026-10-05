import { store } from '@/project/store';
import { atlasCanTravel, atlasNodeForMap, atlasTravelOptions, visitAtlasMap, worldAtlasForMap, type WorldAtlas } from '@/project/worldAtlas';
import { renderWorldAtlasSvg } from '@/project/worldAtlasRender';
import { drawMapTileLayers, loadTilesetImage } from '@/editor/mapTileDraw';
import { withWorldCoastRenderPass } from '@/project/defaults/worldCoastMapping';
import type { PlaySession } from '@/project/session';
import type { TransferRequest } from './playSceneTypes';
import './worldAtlasOverlay.css';

interface AtlasScene {
  getMapId(): string; getSession(): PlaySession;
  transferTo(request: TransferRequest): Promise<void>;
  game: {registry:{get(key:string):unknown}};
  running: boolean;
}

export function createWorldAtlasController(scene: AtlasScene) {
  let button: HTMLButtonElement|null=null,dialog: HTMLDivElement|null=null,host: HTMLElement|null=null;
  let priorMap='',generation=0,busy=false,lastFocus: HTMLElement|null=null;
  const imageCache=new Map<string,string>();
  function close(){generation++;dialog?.remove();dialog=null;busy=false;lastFocus?.focus();}
  async function mapImages(atlas:WorldAtlas){
    const project=store.getCurrent(),images:Record<string,string>={};
    const ids=atlas.overviewMapId?[atlas.overviewMapId]:['field-overview','room-network'].includes(atlas.structure)?atlas.nodes.map(n=>n.mapId):[];
    for(const id of ids){
      const map=project.maps[id],tileset=map&&project.tilesets[map.tilesetId];if(!map||!tileset)continue;
      let data=imageCache.get(id);
      if(!data){const image=await loadTilesetImage(tileset),canvas=document.createElement('canvas');canvas.width=map.width*map.tileSize;canvas.height=map.height*map.tileSize;
        const ctx=canvas.getContext('2d');if(!ctx)continue;ctx.imageSmoothingEnabled=false;
        withWorldCoastRenderPass(()=>drawMapTileLayers(ctx,image,map,tileset,1));data=canvas.toDataURL('image/png');imageCache.set(id,data);}
      images[id]=data;
    }
    return images;
  }
  async function open(){
    const project=store.getCurrent(),atlas=worldAtlasForMap(project,scene.getMapId());
    if(!atlas||!host||scene.running||host.querySelector('[data-testid="main-menu"],[data-testid="battle-scene"],[data-testid="dialogue-box"],[data-testid="title-screen"]'))return;
    if(dialog){close();return;}
    lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:button;
    dialog=document.createElement('div');dialog.className='world-atlas-overlay';dialog.dataset.testid='world-atlas';dialog.dataset.playInputOwner='play-ui';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',atlas.name);
    const panel=document.createElement('section');panel.className='world-atlas-panel';
    const top=document.createElement('div');top.className='world-atlas-top';
    const heading=document.createElement('h2');heading.textContent=atlas.name;
    const exit=document.createElement('button');exit.type='button';exit.textContent='닫기 · M / Esc';exit.dataset.testid='world-atlas-close';exit.onclick=()=>{if(!busy)close();};top.append(heading,exit);
    const picture=document.createElement('div');picture.className='world-atlas-picture';picture.dataset.testid='world-atlas-picture';
    const controls=document.createElement('div');controls.className='world-atlas-controls';
    const status=document.createElement('p');status.className='world-atlas-status';status.setAttribute('aria-live','polite');status.dataset.testid='world-atlas-status';
    const session=scene.getSession(),current=atlasNodeForMap(atlas,scene.getMapId());
    const redraw=()=>{picture.innerHTML=renderWorldAtlasSvg(atlas,{state:session,mapId:scene.getMapId(),mapImages:Object.fromEntries(imageCache)});};
    redraw();
    if(['stage-nodes','run-path'].includes(atlas.structure)){
      status.textContent=current?`${current.name} · ${session.switches[current.clearSwitchId]?'관문 통과':'관문 인물과 대화해 다음 길을 여세요.'}`:'';
      const next=atlasTravelOptions(atlas,session,scene.getMapId());
      if(!next.length)status.textContent+=' · 마지막 장소입니다.';
      for(const option of next){const move=document.createElement('button');move.type='button';move.dataset.testid='world-atlas-travel-'+option.node.id;
        move.textContent=option.available?option.node.name:`${option.node.name} · ${option.missing.join(' / ')}`;move.disabled=!option.available;
        move.onclick=async()=>{
          // Never trust a rendered button: re-read the current map and saved switches at admission.
          if(busy||!atlasCanTravel(atlas,scene.getSession(),scene.getMapId(),option.node.id))return;
          busy=true;controls.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent=option.node.name+' 이동 중';
          try{await scene.transferTo({mapId:option.node.mapId,...option.node.entry,fade:'black'});visitAtlasMap(project,scene.getSession(),scene.getMapId());close();}
          catch{busy=false;status.textContent='이동하지 못했습니다. 지도를 닫고 다시 시도하세요.';exit.disabled=false;}
        };controls.append(move);
      }
    }else{
      status.textContent=atlas.overviewMapId?'대륙의 거점 입구를 밟으면 그 장소로 들어갑니다.':'지도는 현재 장소와 연결을 보여줍니다. 필드의 출입구로 이동하세요.';
      if(current){const pin=atlas.pins.find(p=>p.nodeId===current.id);
        if(pin){
        const toggle=document.createElement('button');toggle.type='button';toggle.dataset.testid='world-atlas-pin';
        const refresh=()=>{toggle.textContent=session.switches[pin.switchId]?'현재 장소 핀 지우기':'현재 장소에 핀 남기기';toggle.setAttribute('aria-pressed',String(session.switches[pin.switchId]===true));};
        toggle.onclick=()=>{session.switches[pin.switchId]=!session.switches[pin.switchId];refresh();redraw();};refresh();controls.append(toggle);
        }
        const doors=atlas.edges.flatMap(e=>e.from===current.id&&e.fromExit?[{to:e.to,p:e.fromExit}]:e.to===current.id&&!e.oneWay&&e.toExit?[{to:e.from,p:e.toExit}]:[]);
        const nav=document.createElement('span');nav.textContent=doors.map(d=>atlas.nodes.find(n=>n.id===d.to)!.name).join(' · ');controls.append(nav);
      }
    }
    panel.append(top,picture,controls,status);dialog.append(panel);host.append(dialog);exit.focus();
    const token=++generation;
    try{await mapImages(atlas);if(token===generation&&dialog){redraw();picture.dataset.atlasReady='true';}}catch{if(token===generation)status.textContent+=' 지도 그림을 불러오지 못했습니다.';}
  }
  const key=(e:KeyboardEvent)=>{
    if(dialog){
      if(e.key==='Escape'||e.key.toLowerCase()==='m'){e.preventDefault();e.stopImmediatePropagation();if(!busy)close();}
      else if(e.key==='Tab'){
        const focusable=Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const first=focusable[0],last=focusable.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
      return;
    }
    if(e.key.toLowerCase()==='m'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&worldAtlasForMap(store.getCurrent(),scene.getMapId())&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"]'))){e.preventDefault();e.stopImmediatePropagation();void open();}
  };
  document.addEventListener('keydown',key,true);
  return {
    get isOpen(){return dialog!==null;},
    update(){
      const mapId=scene.getMapId();if(mapId!==priorMap){priorMap=mapId;visitAtlasMap(store.getCurrent(),scene.getSession(),mapId);}
      const dialogueHost=scene.game.registry.get('dialogueHost') as HTMLElement|undefined;
      // Dialogue lives in a scaled logical 320×240 layer. The atlas uses the actual stage viewport.
      const newHost=dialogueHost?.closest<HTMLElement>('.play-viewport')??dialogueHost;
      if(newHost!==host){close();button?.remove();button=null;host=newHost??null;}
      const atlas=worldAtlasForMap(store.getCurrent(),mapId);
      if(!atlas||!host){button?.remove();button=null;return;}
      if(!button){button=document.createElement('button');button.type='button';button.className='world-atlas-open';button.textContent='세계 지도 · M';button.dataset.testid='world-atlas-open';button.dataset.playInputOwner='play-ui';button.onclick=()=>void open();host.append(button);}
      button.hidden=!!host.querySelector('[data-testid="title-screen"],[data-testid="main-menu"],[data-testid="battle-scene"],[data-testid="dialogue-box"],[data-testid="ending-screen"],[data-testid="game-over-screen"]');
    },
    destroy(){close();button?.remove();document.removeEventListener('keydown',key,true);imageCache.clear();},
  };
}
