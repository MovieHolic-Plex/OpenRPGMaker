import {eventPropAssembly,type PixelArtWorldEventPropPack,type PixelArtWorldEventPropVariant} from './pixelArtWorldEventProps';
export const WATER_SUPPORT_SOURCE={filename:'ST-Sewer-01.png',sha256:'7850f1bc6d82ac8a9947df171e733ddde6614599bd9c6d950e4774deef3b1e1e',width:256,height:1504,sourcePage:'https://yms.main.jp/dotartworld/page2/tile-sewer01.html'};
export function isWaterEventProp(pack:PixelArtWorldEventPropPack){return pack.id==='paw-eventprop-water01'||pack.id==='paw-eventprop-water02';}
/** A separate static teaching layout; never inserts a map or event into the current project. */
export function waterSupportExample(pack:PixelArtWorldEventPropPack,variant:PixelArtWorldEventPropVariant,assetId:string){
  if(!isWaterEventProp(pack))throw Error('물줄기 전용 표본입니다.');
  const frame=variant.parts[0].frames[0],composite=pack.frameComposites?.find(c=>c.index===frame);
  if(!composite)throw Error('완성 물줄기 기하가 없습니다.');
  const length=composite.height/32,width=7,height=length+3,lowerTiles=Array(width*height).fill(57),upperTiles=Array<number>(width*height).fill(-1);
  for(let x=0;x<width;x++){lowerTiles[(length-1)*width+x]=65;lowerTiles[length*width+x]=304;lowerTiles[(length+1)*width+x]=312;lowerTiles[(length+2)*width+x]=0;}
  const event=eventPropAssembly(pack,variant,assetId).events[0];event.id=`water-${variant.id}`;event.x=3;event.y=length;
  const splashWidth=pack.frameWidth/32,splashLeft=3-Math.floor(splashWidth/2),supportCells=Array.from({length:splashWidth},(_,x)=>({x:splashLeft+x,y:length}));
  return {width,height,tileSize:32,lowerTiles,upperTiles,events:[event],anchor:{x:3,y:length},supportCells,source:WATER_SUPPORT_SOURCE,passableTiles:[0],blockedTiles:[57,65,304,312],notes:'남향 벽 배수구는 위쪽 석벽, 물보라는 차단 수면선304 위. 아래 마른 보행로0은 별도1행. source/atlas 전체 프레임을1이벤트로 그리며 타일에 정적 배수구를 중복 배치하지 않는다. 고도·유량·수영 기능 없음.'};
}
export function validateWaterSupportExample(expected:ReturnType<typeof waterSupportExample>,actual:ReturnType<typeof waterSupportExample>){
  const errors:{code:string;x:number;y:number}[]=[];
  if(actual.width!==expected.width||actual.height!==expected.height||actual.lowerTiles.length!==expected.lowerTiles.length||actual.upperTiles.length!==expected.upperTiles.length)return[{code:'DIMENSIONS',x:0,y:0}];
  for(const layer of['lowerTiles','upperTiles']as const)expected[layer].forEach((tile,i)=>{if(actual[layer][i]!==tile)errors.push({code:expected.supportCells.some(c=>c.y*expected.width+c.x===i)?'SPLASH_SUPPORT_CHANGED':'LAYOUT_CHANGED',x:i%expected.width,y:Math.floor(i/expected.width)});});
  if(actual.events.length!==1||actual.events[0].x!==expected.anchor.x||actual.events[0].y!==expected.anchor.y||actual.events[0].pages[0].graphic.pattern!==expected.events[0].pages[0].graphic.pattern)errors.push({code:'WHOLE_FRAME_ANCHOR',...expected.anchor});
  return errors;
}
