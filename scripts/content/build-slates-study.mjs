import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {regions,groups,facts} from './slates-study-catalog.mjs';
const out='verify-shots/slates-study';await mkdir(out,{recursive:true});
const project=JSON.parse(await readFile('output/slates-study/source-project.json','utf8'));
const sourceUrl='data:image/png;base64,'+(await readFile('public/assets/slates/slates-v2-32px.png')).toString('base64');
const browser=await chromium.launch();let alpha,studyAtlas;
try{const page=await browser.newPage();const measured=await page.evaluate(async url=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;const alpha=Array.from({length:1232},(_,i)=>{let clear=0,soft=0,opaque=0;for(let y=0;y<32;y++)for(let x=0;x<32;x++){const a=data[(((i/56|0)*32+y)*c.width+i%56*32+x)*4+3];if(a===0)clear++;else if(a===255)opaque++;else soft++;}return{clear,soft,opaque};});const sheet=document.createElement('canvas');sheet.width=1792;sheet.height=736;const sc=sheet.getContext('2d');sc.drawImage(im,0,0);for(let y=0;y<3;y++){for(const id of [243,23+y*56])sc.drawImage(im,id%56*32,Math.floor(id/56)*32,32,32,y*32,704,32,32);}return{alpha,atlas:sheet.toDataURL()};},sourceUrl);alpha=measured.alpha;studyAtlas=measured.atlas;}finally{await browser.close();}
const catalog=alpha.map((a,id)=>{const x=id%56,y=Math.floor(id/56);let region=regions.findLast(r=>x>=r.rect[0]&&y>=r.rect[1]&&x<r.rect[0]+r.rect[2]&&y<r.rect[1]+r.rect[3]);const group=groups.find(g=>g.tileIds.includes(id));const fact=facts.find(f=>f.tile===id);const empty=a.clear===1024;
 return{id,x,y,...a,empty,region:region?.id??'unknown',label:empty?'빈 칸':fact?.label??(group?group.name+' · 조각 '+(group.tileIds.indexOf(id)+1):region?.name+' · 개별 조각'),role:fact?.role??group?.role??region?.role??'unknown',scope:empty?'픽셀 확인':fact?'개별 확인':group?'블록 확인':'구역 분류',confidence:empty||fact||group?'높음':region?.confidence??'낮음',rule:group?.rule??region?.rule??'추가 검토 필요'};});
for(const id of ['slates_32','slates_reference_32']){
 const ts=project.tilesets[id];
 catalog.forEach(c=>{if(ts.tileMeta[c.id]?.userLocked)return;const f=facts.find(x=>x.tile===c.id);ts.tileMeta[c.id]={...ts.tileMeta[c.id],label:c.label,description:c.rule+' ['+c.scope+']',tags:['Slates',c.region,c.scope],role:c.role,source:'ai',origin:'ai',confidence:c.confidence==='높음'?'high':c.confidence==='중간'?'medium':'low',...(f?{repeatability:f.repeatability}:{})};});
 const old=(ts.tileGroups??[]).filter(g=>!g.id.startsWith('slates-study-'));
 ts.tileGroups=[...old,...groups.map(g=>({id:'slates-study-'+g.id,name:g.name,role:g.role,defaultLayer:g.layer,layerHome:g.layer==='mixed'?'perCell':g.layer,tileIds:g.tileIds,description:g.name+' · Slates v2 원본 확인',placementRules:g.rule,source:'ai',origin:'ai',confidence:'high',sourceRect:{x:g.rect[0]*32,y:g.rect[1]*32,width:g.rect[2]*32,height:g.rect[3]*32}}))];
}
const ts=structuredClone(project.tilesets.slates_32);ts.id='slates_study_32';ts.name='Slates 32px · 조합 연구실';ts.count=1235;ts.image={type:'uploaded',id:'slates_study_atlas'};ts.terrain=Array(1235).fill(0);project.assets.uploaded.slates_study_atlas={id:'slates_study_atlas',name:'Slates 연구실 · 물과 판자 받침 3칸',kind:'tileset',dataUrl:studyAtlas,meta:{tileSize:32,width:1792,height:736}};
ts.passability=Array.from({length:1232},()=>({up:true,down:true,left:true,right:true}));ts.priority=Array(1232).fill('lower');
const allow=(id,pass,layer)=>{ts.passability[id]={up:pass,down:pass,left:pass,right:pass};ts.priority[id]=layer;};
const W=30,H=23,map={id:'slates_study',name:'Slates · 조합 연구실',width:W,height:H,tileSize:32,tilesetId:ts.id,lowerTiles:Array(W*H).fill(57),upperTiles:Array(W*H).fill(-1),events:[],bgm:{mode:'none'},encounters:[]};
const put=(x,y,id,layer='lower',pass=true)=>{if(x<0||y<0||x>=W||y>=H)throw Error('Out of map');map[layer==='lower'?'lowerTiles':'upperTiles'][y*W+x]=id;if(id>=0)allow(id,pass,layer);};
const fill=(x,y,w,h,id)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)put(x+i,y+j,id);};
const nine=(x,y,w,h,sx,sy)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++){const xx=i===0?0:i===w-1?2:1,yy=j===0?0:j===h-1?2:1;put(x+i,y+j,(sy+yy)*56+sx+xx,'lower',sx!==16||(xx===1&&yy===1));}};
const kits=[];
const house=(x,y,extra=0)=>{const rows=[[150,151],[204,205],[644,647],...Array.from({length:extra},()=>[196,199]),[1060,647]];const matrix=[];rows.forEach((row,dy)=>{const lower=dy===rows.length-1?[588,591]:[69,69];row.forEach((id,dx)=>{put(x+dx,y+dy,lower[dx]);put(x+dx,y+dy,id,'upper',false);});matrix.push({tiles:lower,upperTiles:row});});kits.push({id:'slates-study-house-'+extra,kind:'section',name:extra?'목조 집 · 벽 한 행 추가':'작은 목조 집',width:2,height:rows.length,rows:matrix,learnedFrom:'db-authored',ai:{description:'원본 지붕·박공·벽·창·문을 조립한 2열 집',placementRules:'폭 2칸 고정. 몸통 행만 세로 확장하고 지붕은 한 번 배치. 문은 장식이며 진입 이벤트 미설정.',role:'building',tags:['Slates','목조','집'],repeatability:'fixed',layerHome:'perCell',origin:'ai',confidence:'medium'}});};
fill(1,1,12,10,69);house(3,3);house(8,2,1);
fill(16,1,12,11,243);allow(243,false,'lower');nine(18,3,7,7,16,4);
// A one-cell board bridge uses water backing on transparent lower tiles.
const bridgeRows=[];for(let y=0;y<3;y++){const id=1232+y;put(21,9+y,id,'lower',true);ts.tileMeta[id]={...ts.tileMeta[id],label:'세로 판자 다리 · '+['상단','몸통','하단'][y],defaultLayer:'lower',passage:'passable',source:'ai',origin:'ai'};bridgeRows.push({tiles:[id],upperTiles:[-1]});}
kits.push({id:'slates-study-pier',kind:'section',name:'세로 판자 다리 · 1×3',width:1,height:3,rows:bridgeRows,learnedFrom:'db-authored',ai:{description:'원본 23·79·135에 물 243을 합친 32px 타일 3개',placementRules:'물 위 하위 레이어. 다리 칸은 통행 가능, 옆 물 칸은 불가. 끝막음 유지.',role:'prop',repeatability:'fixed',layerHome:'lower',origin:'ai',confidence:'high'}});
fill(1,13,12,8,69);
const wallRows=[];for(let y=0;y<5;y++){const row=[];for(let x=0;x<9;x++){const col=x===0?0:x===8?3:1+(x-1)%2;const srcY=y<3?10+y:3+y-3;const id=srcY*56+40+col;if(y===1&&x>0&&x<8){row.push(-1);}else{put(2+x,14+y,id,'upper',false);row.push(id);}}wallRows.push({tiles:Array(9).fill(69),upperTiles:row});}
kits.push({id:'slates-study-wall',kind:'section',name:'석조 흉벽 · 보행로와 전면',width:9,height:5,rows:wallRows,learnedFrom:'db-authored',ai:{description:'끝을 보존해 가로로 늘린 흉벽과 아래 석조 면',placementRules:'완성 스탬프. 위 흉벽과 아래 전면 벽은 막고 둘째 행 보행면만 통과. 출입 계단은 별도.',role:'castle',repeatability:'fixed',layerHome:'perCell',origin:'ai',confidence:'medium'}});
for(const [name,x,y,sx]of[['침엽수',17,15,8],['활엽수',22,15,12],['죽은 나무',26,15,14]]){const rows=[];const h=sx===14?2:3,sy=sx===14?19:18;for(let dy=0;dy<h;dy++){const row=[];for(let dx=0;dx<2;dx++){const id=(sy+dy)*56+sx+dx;put(x+dx,y+dy,id,'upper',dy<h-1);row.push(id);}rows.push({tiles:[-1,-1],upperTiles:row});}kits.push({id:'slates-study-tree-'+sx,kind:'section',name,width:2,height:h,rows,learnedFrom:'db-authored',ai:{description:name+' 2×'+h+' 원본 블록',placementRules:'순서 고정. 밑동 마지막 행은 막고 수관은 위에 그린다. 하위 바닥을 보존.',role:'prop',repeatability:'fixed',layerHome:'upper',origin:'ai',confidence:'high'}});}
for(const [x,y,id]of[[16,19,629],[18,20,630],[20,19,631],[23,20,964],[26,20,1023]])put(x,y,id,'upper',id<632);
for(let x=0;x<W;x++)put(x,12,65);for(let y=12;y<H;y++)put(14,y,65);
ts.structureKits=kits;project.tilesets[ts.id]=ts;project.maps[map.id]=map;
if(!project.mapTree.children.some(n=>n.mapId===map.id))project.mapTree.children.push({mapId:map.id,children:[]});
const summary={sourceSlots:1232,empty:catalog.filter(c=>c.empty).length,nonempty:catalog.filter(c=>!c.empty).length,opaque:catalog.filter(c=>c.opaque===1024).length,partial:catalog.filter(c=>!c.empty&&c.opaque!==1024).length,individual:facts.length,groups:groups.length,regions:regions.length,compositeTiles:project.tilesets.slates_reference_32.count-1232,kits:kits.length};
await writeFile('public/assets/slates/slates-study-32px.png',Buffer.from(studyAtlas.split(',')[1],'base64'));
await writeFile(`${out}/project.json`,JSON.stringify(project));await writeFile('public/assets/slates/slates-study-catalog.json',JSON.stringify({summary,regions,groups,facts,tiles:catalog,kits},null,2));
await writeFile(`${out}/layout.json`,JSON.stringify({mapId:map.id,spawn:{x:14,y:12},summary},null,2));
console.log(summary);
