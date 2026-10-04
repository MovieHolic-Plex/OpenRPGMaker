import { atlasNodeForMap, atlasTravelOptions, type AtlasState, type WorldAtlas } from './worldAtlas';

export interface AtlasRenderOptions {
  state?: AtlasState; mapId?: string; revealAll?: boolean;
  /** Real tile renders. Field overview uses every map at its exact geographic footprint. */
  mapImages?: Record<string, string>; dark?: boolean;
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Shared SVG renderer for the runtime, editor, PNG export and assistant evidence. */
export function renderWorldAtlasSvg(atlas: WorldAtlas, options: AtlasRenderOptions={}): string {
  const room=atlas.structure==='room-network',run=atlas.structure==='run-path',field=atlas.structure==='field-overview';
  const colors=room?{bg:'#111b2c',land:'#233b4b',land2:'#31566a',water:'#101a2a',ink:'#dce9e8',mute:'#8ba3ad',road:'#a6b6a8',accent:'#e8c785'}:
    run?{bg:'#eee4d1',land:'#ddd0b5',land2:'#d0bd98',water:'#e6dcc8',ink:'#332e28',mute:'#746958',road:'#8d806b',accent:'#ad6449'}:
    {bg:'#497b9d',land:'#93b77b',land2:'#739b62',water:'#6cacc6',ink:'#192f34',mute:'#406660',road:'#e3ce9c',accent:'#d27445'};
  const sx=900/atlas.width,sy=500/atlas.height;
  const px=(x:number)=>30+x*sx,py=(y:number)=>76+y*sy;
  const state=options.state??{switches:{}};
  const current=options.mapId?atlasNodeForMap(atlas,options.mapId):atlas.nodes.find(n=>n.id===atlas.startNodeId);
  const allowed=new Set(options.mapId?atlasTravelOptions(atlas,state,options.mapId).filter(o=>o.available).map(o=>o.node.id):[]);
  const visible=(id:string)=>options.revealAll||!room||state.switches[atlas.nodes.find(n=>n.id===id)!.visitSwitchId]||id===current?.id;
  const output:string[]=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-label="${esc(atlas.name)}" style="width:100%;height:auto;font-family:system-ui,sans-serif">`,
    `<defs><pattern id="atlas-grain" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 7h2M5 2h1" stroke="${colors.ink}" stroke-opacity=".06"/></pattern><clipPath id="atlas-crop"><rect x="24" y="68" width="912" height="516" rx="5"/></clipPath></defs>`,
    `<rect width="960" height="640" fill="${colors.bg}"/><text x="30" y="36" font-size="23" font-weight="600" fill="${room?'#e3edea':run?colors.ink:'#f4f0dd'}">${esc(atlas.name)}</text>`,
    `<text x="930" y="35" text-anchor="end" font-size="13" fill="${room?'#9bb9c3':run?colors.mute:'#d6e6df'}">${atlas.nodes.length} 장소 · ${atlas.edges.length} 연결</text><g clip-path="url(#atlas-crop)">`];
  if(atlas.overviewMapId&&options.mapImages?.[atlas.overviewMapId]) {
    output.push(`<image x="30" y="76" width="900" height="500" preserveAspectRatio="none" style="image-rendering:pixelated" href="${esc(options.mapImages[atlas.overviewMapId]!)}"/>`);
  } else if(field) {
    for(const node of atlas.nodes){const image=options.mapImages?.[node.mapId];if(image)output.push(`<image x="${px(node.x)}" y="${py(node.y)}" width="${node.w*sx}" height="${node.h*sy}" preserveAspectRatio="none" style="image-rendering:pixelated" href="${esc(image)}"/>`);
      else output.push(`<rect x="${px(node.x)}" y="${py(node.y)}" width="${node.w*sx}" height="${node.h*sy}" fill="${colors.land}"/>`);}
  } else if(!room&&!run) {
    // A fictional regional relief, in the atlas's own coordinates (not Earth geography).
    output.push(`<rect x="24" y="68" width="912" height="516" fill="${colors.water}"/><path d="M66 138H166V108H354V84H591V109H742V142H902V317H862V392H767V487H596V550H365V522H178V457H96V323H56V188H66Z" fill="${colors.land}" stroke="#c2d4a0" stroke-width="8"/>`,
      `<path d="M141 177h166v42h-43v43H141zM424 102h146v91H423zM721 181h105v116h-83v-43h-22zM300 413h167v59H300z" fill="${colors.land2}"/>`,
      `<path d="M635 95v105h-35v89h58v146h-24v101" fill="none" stroke="${colors.water}" stroke-width="21" stroke-linejoin="round"/>`,
      `<path d="M105 92l25-30 25 30m25 0 25-30 25 30m440 53 25-30 25 30m5 1 25-30 25 30" fill="none" stroke="#b7c491" stroke-width="13"/>`);
  } else if(run) {
    output.push(`<rect x="24" y="68" width="912" height="516" fill="${colors.bg}"/><path d="M260 68Q440 237 330 400T422 584M718 68Q584 242 719 417T646 584" fill="none" stroke="${colors.land}" stroke-width="56" opacity=".28"/>`);
  }
  output.push(`<rect x="24" y="68" width="912" height="516" fill="url(#atlas-grain)"/>`);
  for(const edge of atlas.edges){const a=atlas.nodes.find(n=>n.id===edge.from)!,b=atlas.nodes.find(n=>n.id===edge.to)!;
    if(!visible(a.id)||!visible(b.id))continue;
    const locked=edge.requires.some(id=>!state.switches[id]);
    const ax=px(a.x+a.w/2),ay=py(a.y+a.h/2),bx=px(b.x+b.w/2),by=py(b.y+b.h/2);
    if(field||atlas.overviewMapId)continue; // Geographic imagery already contains these roads.
    const route=room||run?`M${ax} ${ay}L${bx} ${by}`:`M${ax} ${ay}H${bx}V${by}`;
    if(!room&&!run)output.push(`<path d="${route}" fill="none" stroke="${colors.ink}" stroke-opacity=".22" stroke-width="12" stroke-linejoin="round"/>`);
    output.push(`<path d="${route}" fill="none" stroke="${edge.secret?colors.accent:colors.road}" stroke-width="${run?3:room?3:7}" stroke-linejoin="round" ${locked||edge.secret?'stroke-dasharray="7 5"':''} opacity="${locked ? .6 : 1}"/>`);
  }
  for(const node of atlas.nodes){if(!visible(node.id))continue;
    const x=px(node.x+node.w/2),y=py(node.y+node.h/2),visited=state.switches[node.visitSwitchId],cleared=state.switches[node.clearSwitchId],active=node.id===current?.id;
    const selected=active||allowed.has(node.id);
    output.push(`<g data-atlas-node="${esc(node.id)}"><title>${esc(node.name)}${cleared?' · 클리어':visited?' · 발견':''}</title>`);
    if(room){const image=options.mapImages?.[node.mapId];output.push(`<rect x="${px(node.x)}" y="${py(node.y)}" width="${node.w*sx}" height="${node.h*sy}" rx="2" fill="${colors.land2}" stroke="${selected?colors.accent:colors.road}" stroke-width="${active?3:1}"/>`);
      if(image)output.push(`<image x="${px(node.x)+3}" y="${py(node.y)+3}" width="${node.w*sx-6}" height="${node.h*sy-6}" preserveAspectRatio="none" opacity=".75" style="image-rendering:pixelated" href="${esc(image)}"/>`);
      output.push(`<rect x="${px(node.x)+3}" y="${py(node.y+node.h)-25}" width="${node.w*sx-6}" height="22" fill="${colors.bg}" opacity=".85"/><text x="${x}" y="${py(node.y+node.h)-9}" text-anchor="middle" font-size="13" fill="${colors.ink}">${esc(node.name)}</text>`);
    } else {
      const size=run?19:field?7:10;
      output.push(`<circle cx="${x}" cy="${y}" r="${size+(active?5:0)}" fill="${selected?colors.accent:run?colors.bg:'#ede6bc'}" stroke="${colors.ink}" stroke-width="${active?3:2}"/>`);
      if(run){const symbols:Record<string,string>={battle:'⚔',elite:'!!',boss:'王',camp:'休',treasure:'宝',shop:'店',event:'?'};
        output.push(`<text x="${x}" y="${y+6}" text-anchor="middle" font-size="19" fill="${colors.ink}">${symbols[node.kind]??'•'}</text>`);}
      if(cleared)output.push(`<text x="${x}" y="${y+4}" text-anchor="middle" font-size="14" fill="${colors.ink}">✓</text>`);
      const labelY=y+(run?36:25),labelWidth=Math.max(64,node.name.length*13+14);
      output.push(`<rect x="${x-labelWidth/2}" y="${labelY-16}" width="${labelWidth}" height="23" rx="3" fill="${run?colors.bg:'#f2ebce'}" fill-opacity=".93"/><text x="${x}" y="${labelY}" text-anchor="middle" font-size="13" fill="${colors.ink}">${esc(node.name)}</text>`);
    }
    const pin=atlas.pins.find(p=>p.nodeId===node.id);if(pin&&state.switches[pin.switchId])output.push(`<path d="M${x+16} ${y-16}v16m0-16h12l-4 5 4 5h-12" stroke="${colors.accent}" stroke-width="3" fill="none"/>`);
    output.push('</g>');
  }
  output.push('</g>');
  const foot=room?'발견한 방 · 능력 관문 · 지도 핀':run?'전투 / 사건 / 보물 / 상점 / 휴식 · 다음 층으로 전진':atlas.structure==='stage-nodes'?'실선: 열린 길 · 점선: 클리어 관문 / 비밀 출구':field?'실제 필드 지형 · 가장자리 출입구 · 능력으로 여는 길':atlas.overviewMapId?'대륙을 직접 걷기 · 거점 입구로 들어가기':'마을과 도로 · 물길 해금 · 왕복 이동';
  output.push(`<text x="30" y="617" font-size="14" fill="${room?'#b4c7cb':run?colors.mute:'#e9edda'}">${esc(foot)}</text></svg>`);
  return output.join('');
}
