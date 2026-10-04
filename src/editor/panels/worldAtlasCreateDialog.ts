import { WORLD_ATLAS_CATALOG } from '@/project/worldAtlas';
import { store } from '@/project/store';
import { getTool } from '@/editor/tools';
import { applyToolToStore } from '@/editor/tools/applyChangesetToStore';
import { selectEditorMap } from '@/editor/mapSelection';
import { openEventSubdialog } from './eventEditor/subdialog';
import { el } from '@/util/dom';
import { genId } from '@/util/id';
import { toast } from '@/util/toast';

export function openWorldAtlasCreateDialog():void {
  openEventSubdialog({title:'세계 지도 만들기',subtitle:'이동 방식과 실제 장소를 함께 만듭니다.',testId:'world-atlas-create-dialog',width:'narrow',render(body,close){
    const select=el('select',{attrs:{'aria-label':'세계 지도 이동 방식'},dataset:{testid:'world-atlas-structure'}}) as HTMLSelectElement;
    WORLD_ATLAS_CATALOG.forEach(c=>select.append(el('option',{text:c.name,attrs:{value:c.id}})));
    const name=el('input',{value:WORLD_ATLAS_CATALOG[0].name,attrs:{type:'text','aria-label':'세계 지도 이름'}}) as HTMLInputElement;
    const seed=el('input',{value:'7',attrs:{type:'number','aria-label':'배치 번호',min:'0',max:'2147483647'}}) as HTMLInputElement;
    const help=el('p',{text:WORLD_ATLAS_CATALOG[0].description});
    select.onchange=()=>{const c=WORLD_ATLAS_CATALOG.find(c=>c.id===select.value)!;name.value=c.name;help.textContent=c.description;};
    const status=el('p',{attrs:{'aria-live':'polite'},dataset:{testid:'world-atlas-create-status'}});
    const create=el('button',{text:'지도와 장소 만들기',class:'btn',attrs:{type:'button'},dataset:{testid:'world-atlas-create-confirm'}}) as HTMLButtonElement;
    create.onclick=async()=>{
      const value=Number(seed.value);if(!Number.isSafeInteger(value)||value<0||value>2147483647){status.textContent='배치 번호를 0~2147483647 정수로 입력하세요.';return;}
      create.disabled=true;select.disabled=true;name.disabled=true;seed.disabled=true;status.textContent='지도와 장소를 만들고 있습니다…';
      const args={id:genId('atlas'),structure:select.value,name:name.value.trim()||'세계 지도',seed:value};
      try{
        await getTool('author_worldmap_structure')!.prepare?.(args,store.getCurrent());
        if(!body.isConnected)return;
        const result=applyToolToStore('author_worldmap_structure',args);
        if(!result.ok)throw new Error(result.summary);
        const atlas=store.getCurrent().worldAtlases!.find(a=>a.id===args.id)!;
        selectEditorMap(atlas.overviewMapId??atlas.nodes.find(n=>n.id===atlas.startNodeId)!.mapId);toast(result.summary,'ok');close();
      }catch(e){status.textContent=e instanceof Error?e.message:String(e);create.disabled=false;select.disabled=false;name.disabled=false;seed.disabled=false;}
    };
    body.append(el('label',{text:'이동 방식',children:[select]}),help,el('label',{text:'지도 이름',children:[name]}),el('label',{text:'배치 번호',children:[seed]}),create,status);
  }});
}
