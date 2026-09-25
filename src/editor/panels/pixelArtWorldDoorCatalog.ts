import { PIXEL_ART_WORLD_DOORS, canAttachPixelArtWorldDoorReferences } from '@/project/pixelArtWorldDoors';
import doorAudit from '@/assets/pixelArtWorldDoorAudit.json';
import { importPixelArtWorldDoor } from '@/editor/pixelArtWorldDoorImport';
import { store } from '@/project/store';
import { el } from '@/util/dom';

export function appendPixelArtWorldDoorCatalog(content:HTMLElement, options:{signal:AbortSignal;controls:(HTMLButtonElement|HTMLSelectElement)[];refreshTargets:(()=>void)[];isBusy:()=>boolean;setBusy:(busy:boolean)=>void;onImported:(tilesetId:string)=>void}):void {
  content.append(el('h3',{text:'문·정적 출입구 그래픽'}),el('p',{class:'external-tileset-note',text:'문 시트와 열림 프레임 자료를 가져옵니다. 참고자료는 선택한 타일셋의 AI 참고문서에 추가됩니다. 문 이벤트·충돌·이동 연결은 별도로 저작하세요.'}));
  const held = doorAudit.sources.filter(s=>s.status==='rights-hold');
  content.append(el('p',{class:'external-tileset-note',text:`권리 확인 보류 ${held.length}장: ${held.map(s=>s.filename).join(', ')}. 별도 제공자 이용 조건을 확인하지 못해 가져오기를 제공하지 않습니다. SC-Door-Evs01은 문이 아닌 층 표시기로 제외합니다.`}));
  for(const pack of PIXEL_ART_WORLD_DOORS){
    const status=el('p',{attrs:{role:'status','aria-live':'polite'},dataset:{testid:`${pack.id}-status`}});
    const select=el('select',{attrs:{'aria-label':`${pack.name} 참고문서 대상`},dataset:{testid:`${pack.id}-target`}});
    const refresh=()=>{
      const previous=select.value;select.replaceChildren(el('option',{attrs:{value:''},text:'AI 참고자료를 보관할 32px 사용자 타일셋'}));
      for(const target of Object.values(store.getCurrent().tilesets))if(canAttachPixelArtWorldDoorReferences(target,pack))select.append(el('option',{attrs:{value:target.id},text:target.name}));
      select.value=previous;if(select.selectedIndex<0)select.value='';
    };
    options.refreshTargets.push(refresh);refresh();select.addEventListener('focus',refresh);
    const input=el('input',{attrs:{type:'file',accept:'.png,image/png',hidden:''},dataset:{testid:`${pack.id}-file`}});
    const button=el('button',{class:'btn',text:'받은 문 PNG 가져오기',attrs:{type:'button'},on:{click:()=>{
      if(!select.value){status.textContent='참고자료를 보관할 사용자 타일셋을 먼저 선택하세요.';return;}input.click();
    }}});
    options.controls.push(button,select);
    input.addEventListener('change',async()=>{
      const file=input.files?.[0],target=select.value;input.value='';
      if(!file||!target||options.isBusy()||options.signal.aborted)return;
      options.setBusy(true);options.controls.forEach(c=>{c.disabled=true;});status.textContent='원본과 열림 프레임 확인 중…';
      try{
        await importPixelArtWorldDoor(file,pack,target,options.signal);
        status.textContent=`문 그래픽과 ${pack.variants.length}종 프레임 참고자료를 추가했습니다. 이벤트 배치와 출입 연결은 AI 참고문서를 읽고 별도로 저작하세요.`;
        options.refreshTargets.forEach(f=>f());options.onImported(target);
      }catch(error){if(!options.signal.aborted)status.textContent=error instanceof Error?error.message:'가져오지 못했습니다.';}
      finally{options.setBusy(false);options.controls.forEach(c=>{c.disabled=false;});}
    });
    content.append(el('article',{class:'external-tileset-card',dataset:{search:`${pack.name} ${pack.filename} 문 door`.toLocaleLowerCase()},children:[
      el('h3',{text:pack.name}),el('p',{text:`${pack.width}×${pack.height}px · ${pack.variants.filter(v=>v.openingFrames.length>1).length}종 개방 문 · ${pack.variants.filter(v=>v.openingFrames.length===1).length}종 정적 그림 · 걷기 시트 아님`}),select,
      el('div',{class:'external-tileset-actions',children:[el('a',{class:'btn',text:'다운로드 ↗',attrs:{href:pack.sourcePage,target:'_blank',rel:'noopener noreferrer'}}),button,input,el('a',{text:'이용 조건 ↗',attrs:{href:pack.termsUrl,target:'_blank',rel:'noopener noreferrer'}})]}),
      el('small',{text:`${pack.filename} · 원본·가공 소재 재배포 금지. 공개 게임에 Pixel Art World 크레딧 필요.`}),status,
    ]}));
  }
}
