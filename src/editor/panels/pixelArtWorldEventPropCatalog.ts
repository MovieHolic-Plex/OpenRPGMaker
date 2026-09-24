import { PIXEL_ART_WORLD_EVENT_PROPS, canAttachEventPropReferences } from '@/project/pixelArtWorldEventProps';
import { importPixelArtWorldEventProp } from '@/editor/pixelArtWorldEventPropImport';
import { store } from '@/project/store';
import { el } from '@/util/dom';

export function appendPixelArtWorldEventPropCatalog(content:HTMLElement, options:{signal:AbortSignal;controls:(HTMLButtonElement|HTMLSelectElement)[];refreshTargets:(()=>void)[];isBusy:()=>boolean;setBusy:(busy:boolean)=>void;onImported:(tilesetId:string)=>void}):void {
  content.append(el('h3',{text:'연출 오브젝트 · 명시적 이벤트 프레임'}),el('p',{class:'external-tileset-note',text:'사용자 원본에서 전체 오브젝트와 프레임 자료를 가져옵니다. 참고자료는 선택한 타일셋의 AI 참고문서에 추가됩니다. 실제 상호작용·충돌·이동은 별도로 저작하세요.'}));
  for(const pack of PIXEL_ART_WORLD_EVENT_PROPS){
    if(!pack.rights.runtimeImportAllowed){content.append(el('article',{class:'external-tileset-card',dataset:{search:`${pack.name} ${pack.filename} XP RTP`.toLocaleLowerCase()},children:[el('h3',{text:pack.name}),el('p',{text:'제한된 분석 자료 · OPRN 실행 소재 가져오기 비활성'}),el('p',{text:'RPG Maker XP 소유자·RPG Maker 제작물 전용 RTP 개변 자료입니다. XP 소유 확인만으로 OPRN 게임 사용이 허용되지 않습니다. 공용 새 프로젝트 자동 등록 대상이 아닙니다.'}),el('a',{text:'제작자 조건 확인 ↗',attrs:{href:pack.sourcePage,target:'_blank',rel:'noopener noreferrer'}})]}));continue;}
    const status=el('p',{attrs:{role:'status','aria-live':'polite'},dataset:{testid:`${pack.id}-status`}});
    const select=el('select',{attrs:{'aria-label':`${pack.name} 참고문서 대상`},dataset:{testid:`${pack.id}-target`}});
    const refresh=()=>{
      const previous=select.value;select.replaceChildren(el('option',{attrs:{value:''},text:'AI 참고자료를 보관할 32px 사용자 타일셋'}));
      for(const target of Object.values(store.getCurrent().tilesets))if(canAttachEventPropReferences(target,pack))select.append(el('option',{attrs:{value:target.id},text:target.name}));
      select.value=previous;if(select.selectedIndex<0)select.value='';
    };
    options.refreshTargets.push(refresh);refresh();select.addEventListener('focus',refresh);
    const input=el('input',{attrs:{type:'file',accept:'.png,image/png',hidden:''},dataset:{testid:`${pack.id}-file`}});
    const button=el('button',{class:'btn',text:'받은 오브젝트 PNG 가져오기',attrs:{type:'button'},on:{click:()=>{
      if(!select.value){status.textContent='참고자료를 보관할 사용자 타일셋을 먼저 선택하세요.';return;}input.click();
    }}});
    options.controls.push(button,select);
    input.addEventListener('change',async()=>{
      const file=input.files?.[0],target=select.value;input.value='';
      if(!file||!target||options.isBusy()||options.signal.aborted)return;
      options.setBusy(true);options.controls.forEach(c=>{c.disabled=true;});status.textContent='원본과 전체 프레임 확인 중…';
      try{
        await importPixelArtWorldEventProp(file,pack,target,options.signal);
        status.textContent=`오브젝트 그래픽과 ${pack.variants.length}종 프레임 참고자료를 추가했습니다. 이벤트 배치와 상호작용은 AI 참고문서를 읽고 별도로 저작하세요.`;
        options.refreshTargets.forEach(f=>f());options.onImported(target);
      }catch(error){if(!options.signal.aborted)status.textContent=error instanceof Error?error.message:'가져오지 못했습니다.';}
      finally{options.setBusy(false);options.controls.forEach(c=>{c.disabled=false;});}
    });
    content.append(el('article',{class:'external-tileset-card',dataset:{search:`${pack.name} ${pack.filename} 연출 event prop`.toLocaleLowerCase()},children:[
      el('h3',{text:pack.name}),el('p',{text:`${pack.width}×${pack.height}px · ${pack.variants.length}종 전체 객체 · ${pack.variants.filter(v=>v.kind==='loop').length}종 반복 동작 · 명시 배열 사용`}),select,
      el('div',{class:'external-tileset-actions',children:[el('a',{class:'btn',text:'다운로드 ↗',attrs:{href:pack.sourcePage,target:'_blank',rel:'noopener noreferrer'}}),button,input,el('a',{text:'이용 조건 ↗',attrs:{href:pack.termsUrl,target:'_blank',rel:'noopener noreferrer'}})]}),
      el('small',{text:`${pack.filename} · 원본·가공 소재 재배포 금지. 공개 게임에 Pixel Art World 크레딧 필요.`}),status,
    ]}));
  }
}
