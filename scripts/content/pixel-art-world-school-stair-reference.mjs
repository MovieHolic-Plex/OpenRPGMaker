// Metadata + user-local rendered examples; never commits source pixels.
export function schoolStairReference(blueprint, guide, render) {
 const f=blueprint.floors.find(f=>f.level===2),width=9,height=9,origin={x:23,y:6};
 const crop=layer=>Array.from({length:height},(_,y)=>f[layer].slice((origin.y+y)*f.width+origin.x,(origin.y+y)*f.width+origin.x+width)).flat();
 const lowerTiles=crop('lowerTiles'),upperTiles=crop('upperTiles');
 const token=(tile)=>blueprint.tiles.findIndex(t=>t.source==='ST-Schl-I01.png'&&t.tile===tile&&t.layer==='lower');
 const badGap=[...lowerTiles],badLanding=[...lowerTiles];badGap[2*width+4]=token(6);
 for(const y of [6,7])badLanding[y*width+4]=token(57);
 const variants=[{id:'normal',caption:'정상: 이어진 중앙 벽과 열린 계단참',lowerTiles},
  {id:'divider-gap',caption:'DIVIDER_GAP: (4,2) 천장 연결 누락',lowerTiles:badGap},
  {id:'landing-blocked',caption:'LANDING_BLOCKED: (4,6),(4,7) 계단참 막힘',lowerTiles:badLanding}];
 const used=[...new Set([...lowerTiles,...upperTiles,...badGap,...badLanding].filter(t=>t>=0))].sort((a,b)=>a-b);
 const dictionary=used.map(id=>{const t=blueprint.tiles[id],s=blueprint.sources.find(s=>s.filename===t.source);return {id,...t,...(s.format==='xp-autotile'?{xpMask:s.variantMasks[t.tile]}:{sourceCell:{x:t.tile%8,y:Math.floor(t.tile/8)},sourcePixel:{x:t.tile%8*32,y:Math.floor(t.tile/8)*32}})};});
 const sources=blueprint.sources.filter(s=>dictionary.some(t=>t.source===s.filename)).map(s=>({filename:s.filename,sha256:s.sha256,width:s.width,height:s.height,format:s.format}));
 const payload={tileSize:32,width,height,sourceOrigin:origin,lowerTiles,upperTiles,stairs:[{direction:'up',origin:{x:1,y:2},action:{x:2,y:4},approach:{x:2,y:5}},{direction:'down',origin:{x:5,y:3},action:{x:6,y:4},approach:{x:6,y:5}}],invalid:[{code:'DIVIDER_GAP',cells:[{x:4,y:2}],lowerTiles:badGap},{code:'LANDING_BLOCKED',cells:[{x:4,y:6},{x:4,y:7}],lowerTiles:badLanding}],sources,dictionary};
 return {id:'school-stairwell',name:'학교 계단실 · 연결 벽과 열린 계단참',description:'사용자 검수9×9 중간층. 전체 배열·이식 좌표·정상/오류3그림. 이벤트 별도.',documents:[{id:'guide',name:'계단실 조립.md',markdown:guide},{id:'arrays',name:'전체 배열과 번호 사전.md',markdown:'```json\n'+JSON.stringify(payload)+'\n```\n\n'+variants.map(v=>`![${v.id}](image:${v.id})`).join('\n\n')}],images:variants.map(v=>({id:v.id,name:v.id+'.png',caption:v.caption,dataUrl:render(width,height,v.lowerTiles,upperTiles)}))};
}
