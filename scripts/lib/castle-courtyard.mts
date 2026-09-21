/** Castle2_5 atlas assembly, measured against the supplied castle reference.
 * All source coordinates and map coordinates are 16px cells. Never scale art.
 * The screenshot composite is deliberately not a source for this builder.
 */
import { createCastleTileset } from '../../src/project/defaults/castleTileset';
import { CASTLE_TILESET_ID } from '../../src/project/defaults/constants';

export const PARTS = {
  gate: [6, 6, 6, 6],       // complete 96×96 open arch; upper over paving
  smallDoor: [4, 7, 2, 4],
  banner: [14, 14, 2, 5],
  redBanner: [16, 14, 2, 5],
  fountain: [18, 24, 4, 4],
  clockTree: [24, 20, 6, 8],
  statue: [22, 27, 2, 5],
  bench: [28, 19, 4, 3],
  lamp: [31, 22, 1, 6],
  well: [28, 28, 4, 4],
  market: [0, 18, 4, 4],
  anvil: [6, 18, 4, 2],
  goods: [8, 16, 2, 2],
  crates: [20, 28, 2, 4],
  crate: [18, 30, 2, 2],
} as const;

export function buildCourtyardCastle() {
  const width = 128, height = 120;
  const lowerTiles = Array<number>(width * height).fill(-1);
  const upperTiles = Array<number>(width * height).fill(-1);
  const opacity = createCastleTileset().tileMeta!;
  const placements: { name: string; x: number; y: number; w: number; h: number }[] = [];
  const idx = (x: number, y: number) => y * width + x;
  const source = (x: number, y: number) => y * 32 + x;
  const set = (x: number, y: number, tile: number, layer = 'lower') => {
    if (x < 0 || y < 0 || x >= width || y >= height) throw Error(`Out of bounds: ${x},${y}`);
    (layer === 'upper' ? upperTiles : lowerTiles)[idx(x,y)] = tile;
  };
  const arch = (x: number, y: number, sx: number, sy: number) => {
    const tile = source(sx,sy);
    if (opacity[tile].tags?.includes('투명')) set(x,y,tile,'upper');
    else { set(x,y,tile); set(x,y,-1,'upper'); }
  };
  const fill = (x: number, y: number, w: number, h: number, sx: number, sy: number, sw=2, sh=2) => {
    for (let yy=0; yy<h; yy++) for (let xx=0; xx<w; xx++) set(x+xx,y+yy,source(sx+xx%sw,sy+yy%sh));
  };
  const clearUpper = (x: number,y: number,w: number,h: number) => {
    for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) set(xx,yy,-1,'upper');
  };
  const stamp = (name: keyof typeof PARTS, x: number, y: number) => {
    const [sx,sy,w,h] = PARTS[name];
    placements.push({name,x,y,w,h});
    for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++) {
      // The tree is an irregular atlas island: its top-right 2×2 cells belong
      // to the neighbouring bench, not to the branches.
      if(name==='clockTree' && xx>=4 && yy<2) continue;
      set(x+xx,y+yy,source(sx+xx,sy+yy),'upper');
    }
  };
  // 9-slice a source rectangle, retaining 32px-wide edges and 32px texture period.
  const panel = (x:number,y:number,w:number,h:number,sx:number,sy:number,sw:number,sh:number) => {
    if(w<4||h<4) throw Error('Panel must retain both edges');
    for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++) {
      const u=xx<2 ? xx : xx>=w-2 ? sw-(w-xx) : 2+(xx-2)%2;
      const v=yy<2 ? yy : yy>=h-2 ? sh-(h-yy) : 2+(yy-2)%2;
      arch(x+xx,y+yy,sx+u,sy+v);
    }
  };
  const pave=(x:number,y:number,w:number,h:number)=>panel(x,y,w,h,12,20,6,6);
  const roof=(x:number,y:number,w:number,h:number)=>panel(x,y,w,h,12,0,8,6);
  const face=(x:number,y:number,w:number,h:number)=> {
    for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++) {
      // Top course, plain brick courses, then the single foundation course.
      const sy= yy===0 ? 6 : yy===h-1 ? 10 : 8+(yy-1)%2;
      const sx=xx%2;
      arch(x+xx,y+yy,sx,sy);
    }
  };
  const building=(name:string,x:number,y:number,w:number,deckH:number,faceH:number)=> {
    roof(x,y,w,deckH);face(x,y+deckH,w,faceH);
    placements.push({name,x,y,w,h:deckH+faceH});
  };
  const gate=(x:number,y:number)=> {
    clearUpper(x,y,6,6);
    for(let yy=0;yy<6;yy++) for(let xx=0;xx<6;xx++) {
      // The atlas supplies an entrance shadow with a gradual stone threshold.
      // Keep it behind the transparent arch, rather than bright paving.
      set(x+xx,y+yy,source(28+xx%2,yy<3?14:12+yy));
    }
    stamp('gate',x,y);
  };
  const tower=(x:number,y:number)=> {
    building('tower',x,y,10,8,10);
    stamp('smallDoor',x+4,y+14);
  };

  // A grassy island inside a moat: correct terrain centers (176), never the
  // dirt-edged 193/194 cells. The 3×3 bank is 208–242, in its original order.
  fill(0,0,width,height,0,24);
  const land={x:8,y:6,w:102,h:106};
  fill(land.x,land.y,land.w,land.h,0,22);
  for(let y=0;y<land.h;y++) for(let x=0;x<land.w;x++) {
    if(x>=2 && x<land.w-2 && y>=2 && y<land.h-2) continue;
    const sx=x<2?x:x>=land.w-2?4+x-(land.w-2):2+x%2;
    const sy=y<2?26+y:y>=land.h-2?30+y-(land.h-2):28+y%2;
    set(land.x+x,land.y+y,source(sx,sy));
  }
  // Opposite bank on the east, for a bridge that actually reaches land.
  fill(122,22,6,76,0,22);
  for(let y=22;y<98;y++) set(122,y,source(0,28+y%2));

  // Approach and both courts first, so all transparent arches have a floor.
  pave(50,88,12,32);
  pave(24,72,68,14);
  pave(48,44,16,34);
  pave(38,54,36,22);
  pave(24,52,14,26);
  pave(76,52,16,26);
  // Grass islands in the formal east garden and upper vestibule.
  fill(78,56,12,16,0,22);
  fill(40,10,32,8,0,22);

  // Curtain wall: long walkable roof decks, with facades only on south edges.
  building('north-curtain',20,14,74,6,6);
  building('west-walk',18,18,6,70,6);
  building('east-walk',92,18,6,70,6);
  building('south-curtain',20,86,74,6,6);

  // Hall is deliberately broad and low, like the reference: roof/deck 14 high,
  // wall only 6 high. Two short wings step forward, instead of huge brick slabs.
  building('keep',34,24,46,14,6);
  building('west-wing',28,32,8,6,8);
  building('east-wing',78,32,8,6,8);
  gate(54,38);
  for(const x of [38,45,64,72]) stamp('banner',x,39);
  for(const x of [31,81]) stamp('smallDoor',x,42);
  // A shallow rear gatehouse gives the north-south axis a second height.
  building('north-gatehouse',50,12,14,8,6);
  gate(54,20);
  stamp('banner',51,21);stamp('banner',61,21);

  // Four corner towers, fully capped, with complete windows/doors.
  tower(16,10);tower(90,10);
  tower(16,82);tower(90,82);
  // Main gatehouse connects the outer approach to the paved inner court.
  building('south-gatehouse',46,82,22,10,6);
  gate(54,92);
  stamp('banner',49,93);stamp('banner',64,93);

  // East postern bridge: stone paving above water, roof parapet and a short
  // foundation below, rather than a masonry rectangle pretending to be floor.
  pave(96,62,32,8);
  for(let x=96;x<128;x++) arch(x,61,2+(x%4),4);
  for(let x=96;x<128;x++) arch(x,62,2+(x%4),5);
  face(98,70,30,2);
  // Leave the east wall opening clear and make the continuous bridge deck.
  clearUpper(92,64,8,6);fill(92,64,8,6,14,22);

  // Complete props, composed from source rectangles. The fountain is off the
  // door axis; the avenue stays open on its right. Garden is asymmetric.
  stamp('fountain',48,61);
  stamp('clockTree',80,59);
  stamp('bench',42,55);stamp('bench',62,55);
  stamp('bench',42,71);stamp('bench',64,71);
  stamp('bench',79,74);
  stamp('market',27,55);stamp('market',33,55);
  stamp('goods',28,60);stamp('anvil',31,61);
  stamp('well',27,69);
  stamp('crates',26,76);stamp('crate',29,78);stamp('crates',87,76);
  stamp('statue',43,75);stamp('statue',70,75);
  for(const [x,y] of [[45,49],[66,49],[45,66],[73,66],[49,100],[63,100]] ) stamp('lamp',x,y);
  // Two monuments and seated rest areas in the outer grass forecourt.
  stamp('statue',28,100);stamp('statue',88,100);
  stamp('bench',30,106);
  stamp('clockTree',18,102);

  // Exterior dressing is a separate ring around the castle: the roads remain
  // open, props sit beside them, and the four zones get different purposes.
  pave(40,0,22,10);                 // north approach
  pave(10,44,14,38);                // west market lane
  pave(100,20,8,10);                // inland landing; timber extends over water
  pave(100,39,10,14);               // cargo yard connects to the wooden harbor
  pave(42,102,34,8);                // south rest court remains on dry land
  stamp('market',10,48);stamp('market',14,48);
  stamp('goods',11,53);stamp('goods',15,53);
  stamp('crates',10,58);stamp('crate',14,60);
  stamp('statue',42,103);stamp('statue',70,103);
  stamp('bench',34,108);
  stamp('lamp',43,6);stamp('lamp',58,6);
  stamp('lamp',46,104);stamp('lamp',74,104);

  const regions = [
    {id:'keep',role:'fortress',label:'북쪽 본성',x:28,y:24,w:58,h:24},
    {id:'fountain-court',role:'plaza',label:'분수 안뜰',x:38,y:52,w:38,h:28},
    {id:'market',role:'market',label:'서쪽 장터',x:24,y:52,w:14,h:28},
    {id:'garden',role:'garden',label:'동쪽 시계나무 정원',x:76,y:52,w:16,h:28},
    {id:'south-gate',role:'gate',label:'남쪽 정문',x:46,y:82,w:22,h:16},
    {id:'east-bridge',role:'bridge',label:'동쪽 해자 돌다리',x:92,y:61,w:36,h:11},
    {id:'outer-court',role:'plaza',label:'성 밖 진입 광장',x:24,y:98,w:70,h:14},
    {id:'north-approach',role:'road',label:'북쪽 정문 접근로',x:40,y:0,w:22,h:14},
    {id:'west-market-lane',role:'market',label:'서쪽 장터길',x:8,y:42,w:20,h:40},
    {id:'east-bank',role:'dock',label:'동쪽 해자 물가',x:98,y:14,w:22,h:18},
    {id:'south-rest',role:'plaza',label:'남쪽 휴식 광장',x:38,y:106,w:42,h:14},
  ];
  return {
    map: {
      id:'map_castle_keep_3',name:'성채 · 쌍문 안뜰성',width,height,
      tilesetId:CASTLE_TILESET_ID,tileSize:16,lowerTiles,upperTiles,events:[],
      locations:regions.map(r=>({id:`second-castle-${r.id}`,name:r.label,x:r.x,y:r.y,w:r.w,h:r.h,note:'Castle2 원본 조각으로 조립',tags:['성채',r.role]})),
      layoutPlan:{version:1,kind:'castle-atlas-courtyard',seed:20260919,regions,
        notes:'참고 성의 회랑·짧은 벽면·완성형 아치를 분석해 새 배치로 조립. 스크린샷 타일을 사용하지 않음.'},
    },
    placements,
  };
}
