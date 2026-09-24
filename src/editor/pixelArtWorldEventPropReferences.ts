import {eventPropAssembly,validateEventPropAssembly,type PixelArtWorldEventPropPack,type PixelArtWorldEventPropVariant} from '@/project/pixelArtWorldEventProps';
import type {TilesetReferenceCategory} from '@/project/tilesetReferences';
function canvas(w:number,h:number){const value=document.createElement('canvas');value.width=w;value.height=h;return value;}
function paintFrame(ctx:CanvasRenderingContext2D,atlas:HTMLCanvasElement,pack:PixelArtWorldEventPropPack,index:number,x:number,y:number){ctx.drawImage(atlas,index%4*pack.frameWidth,Math.floor(index/4)*pack.frameHeight,pack.frameWidth,pack.frameHeight,x,y,pack.frameWidth,pack.frameHeight);}
/** Same anchor formula as generic event sprites: tile center, tile bottom, scale1. */
function renderAssembly(atlas:HTMLCanvasElement,pack:PixelArtWorldEventPropPack,variant:PixelArtWorldEventPropVariant,wrong=false){
  const value=canvas(384,320),ctx=value.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#50545b';ctx.fillRect(0,0,384,320);
  ctx.strokeStyle='#666b73';for(let i=0;i<=12;i++){ctx.beginPath();ctx.moveTo(i*32,0);ctx.lineTo(i*32,320);ctx.stroke();}for(let i=0;i<=10;i++){ctx.beginPath();ctx.moveTo(0,i*32);ctx.lineTo(384,i*32);ctx.stroke();}
  const parts=wrong?variant.parts.slice(1):variant.parts;
  for(const p of parts)paintFrame(ctx,atlas,pack,p.frames[0],(5+p.x)*32+16-pack.frameWidth/2,(7+p.y)*32+32-pack.frameHeight);
  ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(wrong?'WRONG: missing event part':'EVENT ANCHORS: diagnostic grid',6,15);return value;
}
export function createEventPropReferences(pack:PixelArtWorldEventPropPack,source:HTMLImageElement,atlas:HTMLCanvasElement,assetId:string):TilesetReferenceCategory{
  const original=canvas(pack.width,pack.height);original.getContext('2d')!.drawImage(source,0,0);
  const images=[{id:'source',name:pack.filename,caption:'사용자 원본 전체. 투명색/반투명을 보존합니다.',dataUrl:original.toDataURL()}, {id:'atlas',name:'event-atlas.png',caption:'실제 generic sprite 프레임 atlas. 크기 조절 없이 바닥 중앙 정렬.',dataUrl:atlas.toDataURL()}];
  const documents=[{id:'read-first',name:'원본·전체 프레임·권리.md',markdown:`# ${pack.name}\n\n[제작자](${pack.sourcePage}) · [규약](${pack.termsUrl}) · ${pack.rights.credit}\n\nSHA256:${pack.sha256}. 원본${pack.width}×${pack.height}. 소재 재배포 금지. 공개 작품에 크레딧.\n\n이 자료는 이벤트 그림과 명시한 프레임 조립이다. 움직이는 NPC/차량 기능, 실제 상호작용/통행/벽·바닥 받침은 자동 설치하지 않는다. 방향은 그림의 의미이며 generic sprite는 바라보는 방향에 따라 프레임을 자동 전환하지 않는다.\n\n원본은 아래 전체 사각형으로 추출한다. atlasOffset만큼 투명 여백을 더해 ${pack.frameWidth}×${pack.frameHeight} 프레임 바닥 중앙에 맞춘다. 원본 그림 내부 여백은 자르지 않는다. atlas4열, frame=index. uploaded sprite ID:\`${assetId}\`.\n\n\`\`\`json\n${JSON.stringify({atlas:{width:atlas.width,height:atlas.height,frameWidth:pack.frameWidth,frameHeight:pack.frameHeight,frames:pack.frames.length,columns:4},frames:pack.frames,variants:pack.variants},null,2)}\n\`\`\`\n\n![원본](image:source)\n\n![실제 atlas](image:atlas)\n\n${pack.notes.join('\n\n')}`}];
  for(const variant of pack.variants){
    const example=eventPropAssembly(pack,variant,assetId);if(validateEventPropAssembly(pack,variant,example).length)throw Error('Invalid event assembly');
    const incorrect=structuredClone(example);incorrect.events.shift();const errors=validateEventPropAssembly(pack,variant,incorrect);
    const good=renderAssembly(atlas,pack,variant),bad=renderAssembly(atlas,pack,variant,true),comparison=canvas(776,320);comparison.getContext('2d')!.drawImage(good,0,0);comparison.getContext('2d')!.drawImage(bad,392,0);
    images.push({id:variant.id,name:variant.name+'-assembly.png',caption:'왼쪽: 모든 이벤트 조각. 오른쪽: 첫 조각 삭제 오류. 회색 격자는 진단용이며 게임 배경이 아닙니다.',dataUrl:comparison.toDataURL()});
    const steps=Math.max(...variant.parts.map(p=>p.frames.length)),fw=Math.max(pack.frameWidth,(Math.max(...variant.parts.map(p=>p.x))+1)*32),fh=pack.frameHeight;
    const strip=canvas(Math.max(220,fw*steps),fh+20),ctx=strip.getContext('2d')!;ctx.fillStyle='#50545b';ctx.fillRect(0,0,strip.width,strip.height);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(variant.kind==='static'||variant.kind==='assembly'?'STATIC: complete parts':'EXPLICIT FRAME ORDER',3,14);
    for(let s=0;s<steps;s++)for(const part of variant.parts)paintFrame(ctx,atlas,pack,part.frames[s%part.frames.length],s*fw+part.x*32,20+part.y*32);
    images.push({id:variant.id+'-sequence',name:variant.name+'-frames.png',caption:'명시된 프레임 전체 순서.120ms는 제작자 지정 속도가 아닌 편집 예시.',dataUrl:strip.toDataURL()});
    documents.push({id:variant.id,name:variant.name+'.md',markdown:`# ${variant.name}\n\n종류:${variant.kind}, 방향:${variant.direction??'방향 아님/고정'}. placement:${pack.placement}.\n\nloop는 parallel 페이지의 setEventGraphicPattern/wait 목록이 종료될 때 다시 실행되는 예제다. sequence는 action으로 한 번 재생한다. static/assembly는 명령이 없다. 각120ms는 예시이며 실제 게임 속도는 저작자가 정한다.\n\n![전체 프레임](image:${variant.id}-sequence)\n\n원본 crop와 모든 프레임은 먼저 읽기 문서를 따른다. 아래는12×10 전체 배열과 이벤트의 실제 좌표다. 타일 -1은 그림/바닥 없음이며 완성 맵이 아니다. 이벤트 1×1, scale1, 그림 바닥 중앙 기준 위치는(x*32+16-${pack.frameWidth/2},y*32+32-${pack.frameHeight}). 원본 투명 여백 때문에 실제 밑동은 alphaBounds를 대조한다.\n\n\`\`\`json\n${JSON.stringify({variant,expected:example,incorrect,errors},null,2)}\n\`\`\`\n\n![정상/누락 비교](image:${variant.id})\n\n여러 예제를 같은 맵에 합칠 때 이벤트 ID는 중복되지 않게 새로 부여한다. 1×1 이벤트 충돌은 큰 차량/가구의 전체 면적을 자동으로 막지 않는다. footprint/통행/상호작용과 실제 지지물은 별도로 저작한다. ${pack.notes.join(' ')}`});
  }
  return{id:pack.id,name:pack.name,description:'원본·전체 프레임·정적/애니메이션·복수 이벤트 조립. 실행 공간과 상호작용 별도.',documents,images};
}
