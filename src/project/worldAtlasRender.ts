import {atlasCartographicTerrain,atlasRoomArtwork,atlasEncounterSymbol} from './worldAtlasArtwork';
import { atlasNodeForMap, atlasTravelOptions, type AtlasState, type WorldAtlas } from './worldAtlas';

export interface AtlasRenderOptions {
  state?: AtlasState; mapId?: string; revealAll?: boolean;
  /** Real tile renders. Field overview uses every map at its exact geographic footprint. */
  mapImages?: Record<string, string>; landmarkImages?:Record<number,string>; dark?: boolean;
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Shared SVG renderer for the runtime, editor, PNG export and assistant evidence. */
export function renderWorldAtlasSvg(atlas: WorldAtlas, options: AtlasRenderOptions={}): string {
  const room=atlas.structure==='room-network',run=atlas.structure==='run-path',field=atlas.structure==='field-overview';
  const colors=room?{bg:'#111b2c',land:'#233b4b',land2:'#31566a',water:'#101a2a',ink:'#dce9e8',mute:'#8ba3ad',road:'#a6b6a8',accent:'#e8c785'}:
    run?{bg:'#eee4d1',land:'#ddd0b5',land2:'#d0bd98',water:'#e6dcc8',ink:'#332e28',mute:'#746958',road:'#8d806b',accent:'#ad6449'}:
    {bg:'#f0ead8',land:'#b4c896',land2:'#739b62',water:'#a3c4c6',ink:'#34483e',mute:'#64735e',road:'#e3d4a6',accent:'#c07a58'};
  const sx=900/atlas.width,sy=500/atlas.height;
  const px=(x:number)=>30+x*sx,py=(y:number)=>76+y*sy;
  const state=options.state??{switches:{}};
  const current=options.mapId?atlasNodeForMap(atlas,options.mapId):atlas.nodes.find(n=>n.id===atlas.startNodeId);
  const allowed=new Set(options.mapId?atlasTravelOptions(atlas,state,options.mapId).filter(o=>o.available).map(o=>o.node.id):[]);
  const visible=(id:string)=>options.revealAll||!room||state.switches[atlas.nodes.find(n=>n.id===id)!.visitSwitchId]||id===current?.id;
  const output:string[]=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-label="${esc(atlas.name)}" style="width:100%;height:auto;font-family:system-ui,sans-serif">`,
    `<defs><pattern id="atlas-grain" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 7h2M5 2h1" stroke="${colors.ink}" stroke-opacity=".06"/></pattern><clipPath id="atlas-crop"><rect x="24" y="68" width="912" height="516" rx="5"/></clipPath></defs>`,
    `<rect width="960" height="640" fill="${colors.bg}"/><text x="30" y="36" font-size="22" font-weight="600" fill="${room?'#e3edea':colors.ink}">${esc(atlas.name)}</text>`,
    `<text x="930" y="35" text-anchor="end" font-size="13" fill="${room?'#9bb9c3':colors.mute}">${atlas.nodes.length} 장소 · ${atlas.edges.length} 연결</text><g clip-path="url(#atlas-crop)">`];
  if(atlas.overviewMapId&&options.mapImages?.[atlas.overviewMapId]) {
    output.push(`<image x="30" y="76" width="900" height="500" preserveAspectRatio="none" style="image-rendering:pixelated" href="${esc(options.mapImages[atlas.overviewMapId]!)}"/>`);
  } else if(field) {
    for(const node of atlas.nodes){const image=options.mapImages?.[node.mapId];if(image)output.push(`<image x="${px(node.x)}" y="${py(node.y)}" width="${node.w*sx}" height="${node.h*sy}" preserveAspectRatio="none" style="image-rendering:pixelated" href="${esc(image)}"/>`);
      else output.push(`<rect x="${px(node.x)}" y="${py(node.y)}" width="${node.w*sx}" height="${node.h*sy}" fill="${colors.land}"/>`);}
  } else if(!room&&!run) {
    output.push(atlasCartographicTerrain(atlas.structure==='stage-nodes'));
  } else if(run) {
    for(let i=0;i<9;i++)output.push(`<path d="M${82+i*9} 560Q${235+i*8} 433 ${113+i*12} 298T${283+i*7} 88M${872-i*9} 561Q${720-i*8} 439 ${846-i*12} 296T${674-i*7} 88" fill="none" stroke="#b6ab91" stroke-width="1" opacity=".2"/>`);

  }
  output.push(`<rect x="24" y="68" width="912" height="516" fill="url(#atlas-grain)"/>`);
  for(const edge of atlas.edges){const a=atlas.nodes.find(n=>n.id===edge.from)!,b=atlas.nodes.find(n=>n.id===edge.to)!;
    if(!visible(a.id)||!visible(b.id))continue;
    const locked=edge.requires.some(id=>!state.switches[id]);
    const ax=px(a.x+a.w/2),ay=py(a.y+a.h/2),bx=px(b.x+b.w/2),by=py(b.y+b.h/2);
    if(field||atlas.overviewMapId)continue; // Geographic imagery already contains these roads.
    const route=room?`M${ax} ${ay}H${(ax+bx)/2}V${by}H${bx}`:run?`M${ax} ${ay}C${ax+(bx-ax)*.22} ${ay-30} ${bx-(bx-ax)*.3} ${by+34} ${bx} ${by}`:atlas.structure==='stage-nodes'?`M${ax} ${ay}Q${(ax+bx)/2} ${ay-12} ${bx} ${by}`:`M${ax} ${ay}H${bx}V${by}`;
    if(!room&&!run)output.push(`<path d="${route}" fill="none" stroke="${colors.ink}" stroke-opacity=".22" stroke-width="12" stroke-linejoin="round"/>`);
    output.push(`<path d="${route}" fill="none" stroke="${edge.secret?colors.accent:colors.road}" stroke-width="${run?2:room?4:6}" stroke-linejoin="round" ${locked||edge.secret?'stroke-dasharray="4 6"':''} opacity="${locked ? .6 : 1}"/>`);
  }
  for(const [index,node] of atlas.nodes.entries()){if(!visible(node.id))continue;
    const x=px(node.worldEntrance?.x??node.x+node.w/2),y=py(node.worldEntrance?.y??node.y+node.h/2),visited=state.switches[node.visitSwitchId],cleared=state.switches[node.clearSwitchId],active=node.id===current?.id;
    const selected=active||allowed.has(node.id);
    output.push(`<g data-atlas-node="${esc(node.id)}"><title>${esc(node.name)}${cleared?' · 클리어':visited?' · 발견':''}</title>`);
    if(room){const image=options.mapImages?.[node.mapId];
      if(node.roomShape!==undefined)output.push(atlasRoomArtwork(node.roomShape,px(node.x),py(node.y),node.w*sx,node.h*sy,image,active));
      else {
        output.push(`<rect x="${px(node.x)}" y="${py(node.y)}" width="${node.w*sx}" height="${node.h*sy}" fill="${colors.land2}" stroke="${active?colors.accent:colors.road}"/>`);
        if(image)output.push(`<image x="${px(node.x)}" y="${py(node.y)}" width="${node.w*sx}" height="${node.h*sy}" opacity=".7" href="${esc(image)}"/>`);
      }
      output.push(`<text x="${x}" y="${py(node.y+node.h)+14}" text-anchor="middle" font-size="13" fill="${colors.ink}">${esc(node.name)}</text>`);
      if(active)output.push(`<circle cx="${x}" cy="${py(node.y+node.h)-13}" r="4" fill="${colors.accent}"/>`);

    } else {
      const size=run?(node.kind==='boss'?25:18):field?5:8;
      if(!atlas.overviewMapId)output.push(`<circle cx="${x}" cy="${y}" r="${size+(active?5:0)}" fill="${selected?colors.accent:run?colors.bg:'#eee1bc'}" stroke="${colors.ink}" stroke-width="${active?3:run?1:2}"/>`);
      if(!room&&!run&&!field&&!atlas.overviewMapId){
        const icon=node.kind==='town'?(index===6?3:index===4?2:index===2?1:0):atlas.structure==='stage-nodes'&&index===5?3:atlas.structure==='stage-nodes'&&index===3?6:undefined;
        if(icon!==undefined){const image=options.landmarkImages?.[icon]??'/assets/atlas-cartography/icons/'+icon+'.png';
          output.push(`<image x="${x-24}" y="${y-54}" width="48" height="44" preserveAspectRatio="xMidYMax meet" style="image-rendering:pixelated" href="${esc(image)}"/>`);
        }
      }
      if(run)output.push(`<g style="color:${colors.ink}">${atlasEncounterSymbol(node.kind,x,y)}</g>`);
      if(cleared)output.push(`<text x="${x}" y="${y+4}" text-anchor="middle" font-size="14" fill="${colors.ink}">✓</text>`);
      const labelY=y+(run?36:25),labelWidth=Math.max(64,node.name.length*13+14);
      output.push(`<rect x="${x-labelWidth/2}" y="${labelY-16}" width="${labelWidth}" height="23" rx="3" fill="${run?colors.bg:'#f2ebce'}" fill-opacity=".93"/><text x="${x}" y="${labelY}" text-anchor="middle" font-size="13" fill="${colors.ink}">${esc(node.name)}</text>`);
    }
    const pin=atlas.pins.find(p=>p.nodeId===node.id);if(pin&&state.switches[pin.switchId])output.push(`<path d="M${x+16} ${y-16}v16m0-16h12l-4 5 4 5h-12" stroke="${colors.accent}" stroke-width="3" fill="none"/>`);
    output.push('</g>');
  }
  output.push('</g>');
  const foot=room?'발견한 방 · 능력 관문 · 지도 핀':run?'전투 / 사건 / 보물 / 상점 / 휴식 · 다음 층으로 전진':atlas.structure==='stage-nodes'?'실선: 열린 길 · 점선: 클리어 관문 / 비밀 출구':field?'이어지는 강 · 실제 호수와 절벽 · 다리와 열쇠 관문':atlas.overviewMapId?'대륙을 직접 걷기 · 거점 입구로 들어가기':'마을과 도로 · 물길 해금 · 왕복 이동';
  output.push(`<text x="30" y="617" font-size="14" fill="${room?'#b4c7cb':colors.mute}">${esc(foot)}</text></svg>`);
  return output.join('');
}
