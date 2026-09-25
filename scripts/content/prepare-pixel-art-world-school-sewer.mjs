// Metadata only: all indices refer to unchanged 32px, eight-column user originals.
import {writeFile} from 'node:fs/promises';
const cell=(x,y)=>({x,y}), unique=a=>[...new Set(a)].filter(t=>t>=0).sort((a,b)=>a-b);
function scene(id,name,w,h,floor,notes){return{id,name,width:w,height:h,lowerTiles:Array(w*h).fill(floor),upperTiles:Array(w*h).fill(-1),approachCells:[],placements:[],notes,passableTiles:[floor],lowerTileIds:[]};}
function put(s,layer,x,y,rows){for(let dy=0;dy<rows.length;dy++)for(let dx=0;dx<rows[dy].length;dx++){if(x+dx<0||y+dy<0||x+dx>=s.width||y+dy>=s.height)throw Error('Bounds');s[layer][(y+dy)*s.width+x+dx]=rows[dy][dx];}}
function fill(s,layer,x,y,w,h,t){put(s,layer,x,y,Array.from({length:h},()=>Array(w).fill(t)));}
function finish(s){s.lowerTileIds=unique(s.lowerTiles);return s;}
const common={width:256,tileSize:32,checkedAt:'2026-09-24',termsUrl:'https://yms.main.jp/dotartworld/page1/rule.html',credit:'Pixel Art World / ドット絵世界 — https://yms.main.jp/dotartworld/'};
const school={...common,id:'paw-wood-school-exterior',name:'Pixel Art World · 목조학교 외관',filename:'ST-Schl-WE01.png',height:1600,sha256:'',sourcePage:'https://yms.main.jp/dotartworld/page2/tile-schoolw01.html',floorTile:0,notes:'목조 원본400칸 보존. 기와 교사·석축 출입구·창과 문의 검토 배열만 지원한다. 현대 학교1824px 시트 번호를 섞지 않는다. 닫힌 문 그림은 통행 차단이며 문 앞 접근에서 전이 이벤트를 별도로 저작한다. 지붕 보행·문 개방·실내 자동연결 없음.',recipes:[],scenes:[],assemblies:[]};
const sewer={...common,id:'paw-sewer',name:'Pixel Art World · 하수도',filename:'ST-Sewer-01.png',height:1504,sha256:'',sourcePage:'https://yms.main.jp/dotartworld/page2/tile-sewer01.html',floorTile:0,notes:'정적 마른 통로·한 단계 계단·투명 칸막이·수면/수중 바닥만 검토한다. 수로는 차단하고 마른 바닥과 구별한다. 높이는 그림이며 실제 다층/점프/수영/수위변화 이벤트는 없다. SC-Water01/02는 별도 사용자 파일이고 현재 eventprops 카탈로그에 없다. 프레임/길이조절은 이 장소에서 실행하지 않는다. 분수 이벤트로 대체하지 않는다.',recipes:[],scenes:[],assemblies:[]};
// Exact original identity from the verified download manifest (not a pixel asset).
// Stored constants, never implicitly accept a newly downloaded edition.
school.sha256='36e5f775678a47a27e785620a07ee1c4ba9d67f5a59a6c60d5e230e1ed554970';sewer.sha256='7850f1bc6d82ac8a9947df171e733ddde6614599bd9c6d950e4774deef3b1e1e';
for(const p of [school,sewer])p.downloadUrl='https://yms.main.jp/dotartworld/sozai/tileset/'+p.filename;
const s=scene('wood-school-courtyard','목조학교 · 작은 교사와 석축 출입구',13,10,0,'13×10칸. 기와지붕(1,1)11×3, 목조벽(2,3)9×3, 창2쌍(2,4)/(9,4), 닫힌 양문(5,4)2×2. 지붕은124→132→140의 상단/중간/처마 세 행이며 처마140을 중간 반복하지 않는다. 창과 문은 벽 위에, 그림 밑동을 외벽 하단과 맞춘다. 남쪽 석축은 높이2칸, 출입구x5..6을 끝까지 비운다. 입구(5,9)에서 현관 앞(5,6)/(6,6)까지 짧은 흙길. 문 그림(5,5)/(6,5)은 차단, 앞칸의 조사 전이로 실내 연결을 따로 저작한다. 석축 위/지붕 위 이동은 지원하지 않는다.');
fill(s,'lowerTiles',2,3,9,2,216);fill(s,'lowerTiles',2,5,9,1,224);
for(const[y,t]of[[1,124],[2,132],[3,140]])fill(s,'upperTiles',1,y,11,1,t);
for(const x of[2,9])put(s,'upperTiles',x,4,[[240,241],[248,249]]);
put(s,'upperTiles',5,4,[[256,257],[264,265]]);
fill(s,'lowerTiles',5,6,2,4,2);
for(const[x,w]of[[0,5],[7,6]]){put(s,'upperTiles',x,8,[[56,...Array(w-2).fill(57),58],[72,...Array(w-2).fill(73),74]]);}
s.approachCells=[cell(5,9),cell(5,6),cell(6,6),cell(2,7),cell(10,7)];s.passableTiles=[0,2];finish(s);school.scenes.push(s);
function sub(id,name,parent,x,y,w,h,notes){const q=scene(id,name,w,h,0,notes);for(const l of['lowerTiles','upperTiles'])q[l]=Array.from({length:h},(_,dy)=>parent[l].slice((y+dy)*parent.width+x,(y+dy)*parent.width+x+w)).flat();q.approachCells=[];q.passableTiles=[...parent.passableTiles];return finish(q);}
school.assemblies.push(sub('wood-school-whole-building','기와지붕·창·양문 교사 전체',s,1,1,11,6,'11×6 고정 건물, 하위/상위 전체 배열. 마지막행은 문 앞 실제 지면이며 현관 접근(4,5)/(5,5)을 비운다. 원본 기와면124/132/140의 세 행 구별. 창 상부240/241과 하부248/249, 문256/257+264/265를 자르지 않는다.'),sub('wood-school-stone-gate','석축 · 두 칸 출입구',s,3,7,6,3,'6×3 고정 석축 출입구. 가운데2칸(x2/3)은 앞에서 뒤까지 흙길. 돌담56/57/58의 상단과72/73/74의 밑단을 보존한다. 석축높이를 통행높이로 추정하지 않는다.'));
for(const [id,name,rows]of[['wood-school-window','목조벽의 온전한 창',[[240,241],[248,249]]],['wood-school-door','목조벽의 닫힌 양문',[[256,257],[264,265]]]]){const a=scene(id,name,4,4,0,'4×4 고정 예제. 뒤벽216/224를 먼저 놓고 (1,1)에 원본2×2 창/양문 전체를 상위로 배치한다. 벽/그림은 차단, 남쪽 바닥(2,3)에서 접근. 창은 바닥 가구가 아니며 문 그림은 개방/전이 이벤트가 아니다.');fill(a,'lowerTiles',0,0,4,2,216);fill(a,'lowerTiles',0,2,4,1,224);put(a,'upperTiles',1,1,rows);a.approachCells=[cell(2,3)];finish(a);school.assemblies.push(a);}
const n=scene('sewer-maintenance','하수도 · 마른 정비통로와 계단',10,9,0,'10×9칸. 북쪽 벽57/65 두 행, 정비문79/87. y2는 깊이1칸의 마른 금속발판112/113/114. 중앙계단(4,3)3×3은 윗발판→계단머리→두단계 그림→낮은길로 이어진다. y3..5의 나머지는 보행불가 수직면. 아래 마른길은 y6 한 행, 남쪽y7 수면선304와y8 물312는 차단. 동쪽 입구(9,6)→마른길→계단→문앞(2,2)의 짧고 명료한 경로. 8행으로 줄이면3행 계단 난간이 윗발판을 갈라 연결이 끊기므로 난간을 잘라내거나 통행으로 속이지 않고9행을 유지한다. 계단 양옆 난간은 차단이며 실제 고도/수영/수위변화/문 전이는 별도 이벤트다. 원본 수중바닥288을 마른바닥0과 혼동하지 않는다.');
fill(n,'lowerTiles',0,0,10,1,57);fill(n,'lowerTiles',0,1,10,1,65);put(n,'upperTiles',2,0,[[79],[87]]);
for(let x=0;x<10;x++){n.upperTiles[2*10+x]=x===0?112:x===9?114:113;n.upperTiles[3*10+x]=145;n.upperTiles[4*10+x]=8;n.upperTiles[5*10+x]=8;}
// The raised landing's vertical face is masonry, not an expanse of walkable tan floor.
fill(n,'lowerTiles',0,3,10,2,57);fill(n,'lowerTiles',0,5,10,1,65);
fill(n,'lowerTiles',4,3,3,3,0);put(n,'upperTiles',4,3,[[192,193,194],[200,201,202],[208,209,210]]);
fill(n,'lowerTiles',0,7,10,1,304);fill(n,'lowerTiles',0,8,10,1,312);
n.passableTiles=[0,112,113,114,193,201,209];n.approachCells=[cell(9,6),cell(7,6),cell(5,6)];
finish(n);sewer.scenes.push(n);
sewer.assemblies.push(sub('sewer-stair-platform','마른 발판과 한 단계 계단 전체',n,2,2,7,5,'7×5. 윗 발판에서 아래 바닥까지 중앙열x3만 연결한다. 원본 계단(0,24)3×3 전체이며 타일193은 투명한 위쪽 연결칸이다. 난간열은 차단. 145/8은 수직면의 그림자이며 하위 실제 벽/바닥을 보존. 계단 밑은 마른 바닥0, 양옆은 막힌 수직 석벽57/65다. 계단이 다른 맵/고도를 자동 생성하지 않는다.'));
const arch=scene('sewer-partition','하수도 · 투명 칸막이 뒤의 마른 길',5,5,0,'5×5. 원본(0,9)3×2 투명 아치 전체를 (1,1)에 놓고 바닥0을 보존한다. 아래 중앙81의 투명 공간은 발판이 드러나는 통과칸, 위73은 헤더라 차단한다. 뒤쪽 접근은 좌우 끝의 우회로로 연결한다. 이 정적 예제는 아치 머리 아래를 관통하는 캐릭터 가림/고도 이동을 지원한다고 주장하지 않는다.');put(arch,'upperTiles',1,1,[[72,73,74],[80,81,82]]);arch.passableTiles=[0,81];arch.approachCells=[cell(2,4),cell(2,0)];finish(arch);sewer.scenes.push(arch);
const barrel=scene('sewer-barrel','하수도 드럼통 · 온전한 바닥 소품',3,4,0,'원본(2,22)1×2 [178,186] 전체. 하위 마른바닥0, 상위 드럼통. 두 행 모두 차단, 남쪽 접근(1,3). 수로나 좁은 계단 진입부를 막지 않는다.');put(barrel,'upperTiles',1,1,[[178],[186]]);barrel.approachCells=[cell(1,3)];finish(barrel);sewer.assemblies.push(barrel);
const water=scene('sewer-water-section','하수도 · 벽 수면선과 수중 바닥',5,6,0,'5×6 단면 교본. 위2행240/248은 물 밖 벽, 다음256은 벽 위 수면선, 다음264/272는 수중 벽, 마지막288은 제작자가 기본 수중 바닥으로 표시한 원본이다. 전부 보행불가 벽/물이며 평평한 마른바닥0으로 재분류하지 않는다. 수면선을 여러행 반복하지 않는다. 수위 애니메이션이나 물줄기는 없다.');for(const[y,t]of[240,248,256,264,272,288].entries())fill(water,'lowerTiles',0,y,5,1,t);water.passableTiles=[];finish(water);sewer.assemblies.push(water);
for(const p of[school,sewer]){
 for(const a of p.assemblies){a.approachCells??=[];a.errorEdits=[];const first=a.upperTiles.findIndex(t=>t>=0);if(first>=0)a.errorEdits.push({layer:'upperTiles',index:first,tile:-1,code:'MISSING_COMPLETE_PART'});else a.errorEdits.push({layer:'lowerTiles',index:2*a.width,tile:p.floorTile,code:'WATERLINE_REPLACED_BY_DRY_FLOOR'});}
 for(const a of p.scenes){a.errorEdits=[{layer:'upperTiles',index:a.upperTiles.findIndex(t=>t>=0),tile:-1,code:'MISSING_STRUCTURAL_PART'},{layer:'upperTiles',index:a.approachCells[0].y*a.width+a.approachCells[0].x,tile:a.upperTiles.find(t=>t>=0),code:'ENTRY_BLOCKED'}];}
 for(const a of[...p.scenes,...p.assemblies]){if(a.lowerTiles.length!==a.width*a.height||a.upperTiles.length!==a.width*a.height)throw Error('Length');for(const t of[...a.lowerTiles,...a.upperTiles])if(!Number.isInteger(t)||t< -1||t>=p.width*p.height/1024)throw Error('Tile range');}
}
await writeFile(new URL('../../tiledata/pixel-art-world/school-sewer.json',import.meta.url),JSON.stringify([school,sewer],null,2)+'\n');
await writeFile(new URL('../../src/assets/pixelArtWorldSchoolSewerCatalog.json',import.meta.url),JSON.stringify([school,sewer],null,2)+'\n');
console.log('Prepared metadata only: school/sewer2 originals,3 scenes,7 complete assemblies.');
