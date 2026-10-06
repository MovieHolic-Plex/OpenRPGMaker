const $=s=>document.querySelector(s);
const labels={field:'필드',menu:'Esc 메뉴',party:'파티',bag:'가방',shop:'상점'};
const state={screen:'field',cursor:0,hp:24,potions:5,gold:1600,orbs:10,modal:null};
let ctx,master,musicSource,musicGain,started=0,offset=0,selectedTrack='town',playing=false,playCount=0,generation=0;
const buffers=new Map();let volume=.4;
async function context(){
 if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=volume;master.connect(ctx.destination);}
 if(ctx.state==='suspended')await ctx.resume();return ctx;
}
async function buffer(id){
 await context();if(!buffers.has(id))buffers.set(id,fetch(`assets/${id}.${id==='previous-town'?'ogg':'wav'}`).then(r=>{if(!r.ok)throw Error('음원을 불러오지 못했습니다.');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)));
 return buffers.get(id);
}
function position(){return playing?offset+ctx.currentTime-started:offset;}
async function play(){
 if(playing)return;const ticket=++generation,b=await buffer(selectedTrack);if(ticket!==generation)return;
 musicGain=ctx.createGain();musicGain.gain.setValueAtTime(0,ctx.currentTime);musicGain.gain.linearRampToValueAtTime(1,ctx.currentTime+.04);musicGain.connect(master);
 musicSource=ctx.createBufferSource();musicSource.buffer=b;musicSource.loop=true;musicSource.connect(musicGain);musicSource.start(0,offset%b.duration);started=ctx.currentTime;playing=true;playCount++;
 $('#play').textContent='Ⅱ 일시정지';$('#audio-status').textContent='반복 재생 중 · 메뉴 이동은 재생 위치를 유지합니다.';
}
function pause(reset=false){
 ++generation;offset=reset?0:position();playing=false;
 if(musicSource){musicGain.gain.cancelScheduledValues(ctx.currentTime);musicGain.gain.setTargetAtTime(0,ctx.currentTime,.012);musicSource.stop(ctx.currentTime+.06);const oldGain=musicGain;musicSource.onended=()=>oldGain.disconnect();musicSource=null;}
 $('#play').textContent='▶ 재생';$('#audio-status').textContent=reset?'정지했습니다.':'일시정지했습니다.';
}
async function cue(id){const b=await buffer(id),s=ctx.createBufferSource();s.buffer=b;s.connect(master);s.onended=()=>s.disconnect();s.start();}
function sound(id){void cue(id).catch(e=>$('#audio-status').textContent=e.message);}
$('#play').onclick=()=>playing?pause():void play().catch(e=>$('#audio-status').textContent=e.message);
$('#stop').onclick=()=>pause(true);
$('#volume').oninput=e=>{volume=Number(e.target.value);if(master)master.gain.setTargetAtTime(volume,ctx.currentTime,.02);};
document.querySelectorAll('[data-track]').forEach(b=>b.onclick=async()=>{
 if(selectedTrack===b.dataset.track)return;const resume=playing;pause(true);selectedTrack=b.dataset.track;
 document.querySelectorAll('[data-track]').forEach(x=>x.classList.toggle('selected',x===b));if(resume)await play().catch(e=>$('#audio-status').textContent=e.message);
});
document.querySelectorAll('[data-cue]').forEach(b=>b.onclick=()=>sound(b.dataset.cue));
setInterval(()=>{const t=Math.floor(position());$('#time').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;},100);

const menu=[['도감','dex'],['파티','party'],['가방','bag'],['원정 수첩','card'],['지도','map'],['배지','badges'],['저장','save'],['설정','options']];
const row=(name,i,action,count='')=>`<button class="${state.cursor===i?'selected':''}" data-action="${action}">${name}${count?`<span class="count">${count}</span>`:''}</button>`;
function show(screen){state.screen=screen;state.cursor=0;state.modal=null;render();}
function field(){return `<div class="field"><div class="trail"></div><div class="area">별싹 마을 · UI 시안</div><div class="sprite walking"></div></div>`;}
function render(){
 let html='';
 if(state.screen==='field'||state.screen==='menu'){
  html=field();if(state.screen==='field')html+='<div class="window dialog">눈송냥이 바람 냄새를 맡고 있다.<br>Esc를 누르면 메뉴를 연다.</div>';
  else html+=`<div class="window menu">${menu.map(([name,id],i)=>row(name,i,id)).join('')}</div>`;
 }else if(state.screen==='party'){
  html=`<div class="page"><div class="page-title">함께 걷는 동료</div><button class="party-main selected" data-action="summary"><div class="sprite"></div><div class="party-name">눈송냥 ♀</div><div class="level">Lv. 8　얼음</div><div class="hp"><i style="width:${state.hp/38*100}%"></i></div><div class="hp-label">${state.hp} / 38</div></button>${[0,1,2,3,4].map(i=>`<div class="empty-slot" style="top:${24+i*22}px">—</div>`).join('')}<div class="bottom">동료를 선택하세요.　Esc 돌아가기</div></div>`;
 }else if(state.screen==='bag'){
  html=`<div class="page"><div class="page-title">가방　/　도구</div><div class="bag-left">도구 주머니<div class="bag-mark"></div></div><div class="window list">${row('회복약',0,'heal','× '+state.potions)}${row('포획구',1,'orb','× '+state.orbs)}${row('돌아가기',2,'back')}</div><div class="bottom item-description">${['동료 한 마리의 HP를 20 회복한다.','야생 몬스터를 잡을 때 사용하는 도구.','이전 화면으로 돌아간다.'][state.cursor]}</div></div>`;
 }else{
  html=`<div class="page"><div class="page-title">도구점　/　구입</div><div class="window money">소지금<br>${state.gold.toLocaleString()} G</div><div class="shop-sign">MART<br>도구점</div><div class="window list">${row('포획구',0,'buy-orb','80 G')}${row('회복약',1,'buy-potion','120 G')}${row('돌아가기',2,'back')}</div><div class="bottom item-description">${['포획구 · 한 개에 80 G','회복약 · 한 개에 120 G','이전 화면으로 돌아간다.'][state.cursor]}</div></div>`;
 }
 if(state.modal)html+=`<div class="window sheet-modal"><p>${state.modal}</p><button data-action="dismiss">Enter · 확인</button></div>`;
 $('#stage').innerHTML=html;$('#screen-label').textContent=labels[state.screen];
 document.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===state.screen)));
 $('#stage').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{sound('confirm');action(b.dataset.action);$('.stage-wrap').focus();});
}
function action(id){
 if(id==='dismiss'){state.modal=null;render();return;}
 if(id==='party'||id==='bag'){show(id);return;}
 if(id==='back'){show('menu');return;}
 if(id==='summary')state.modal=`눈송냥　♀　Lv. 8<br>HP ${state.hp} / 38<br>얼음숨결　PP 20 / 20<br>몸통박치기　PP 35 / 35`;
 else if(id==='heal'){
  if(state.potions===0)state.modal='회복약이 없습니다.';
  else if(state.hp===38)state.modal='이미 건강합니다.';
  else{const before=state.hp;state.hp=Math.min(38,state.hp+20);state.potions--;state.modal=`눈송냥의 HP가 ${state.hp-before} 회복되었다!<br>남은 회복약 ${state.potions}개`;}
 }else if(id==='buy-orb'||id==='buy-potion'){
  const cost=id==='buy-orb'?80:120;if(state.gold<cost)state.modal='소지금이 부족합니다.';
  else{state.gold-=cost;state[id==='buy-orb'?'orbs':'potions']++;state.modal=`${id==='buy-orb'?'포획구':'회복약'} 한 개를 구입했습니다.`;}
 }else state.modal={dex:'눈송냥 · 눈 위에 둥근 발자국을 남긴다.',card:'별빛섬 원정 수첩<br>이름: 여행자　배지: 0개',map:'별싹 마을 → 이끼숲<br>메뉴의 색·글자·여백 검토용 시안입니다.',badges:'여덟 배지<br>○ ○ ○ ○ ○ ○ ○ ○',save:'UI 시안입니다.<br>게임의 저장 데이터에는 영향을 주지 않습니다.',options:'음량은 오른쪽 음악 패널에서 조절합니다.',orb:'필드에서 사용할 수 없습니다.'}[id]??'준비 중';
 render();
}
document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>{sound('confirm');show(b.dataset.screen);$('.stage-wrap').focus();});
$('.stage-wrap').addEventListener('keydown',e=>{
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape'].includes(e.key))return;e.preventDefault();
 if(e.key==='Escape'){sound('cancel');if(state.modal){state.modal=null;render();}else show(state.screen==='field'?'menu':state.screen==='menu'?'field':'menu');return;}
 if(e.key==='Enter'){if(state.modal){sound('confirm');action('dismiss');}else if(state.screen==='field'){sound('confirm');show('menu');}else $('#stage .selected[data-action]')?.click();return;}
 if(state.modal)return;const count=state.screen==='menu'?8:['bag','shop'].includes(state.screen)?3:1;
 state.cursor=(state.cursor+(e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:1)+count)%count;sound('cursor');render();
});
const fit=()=>{const wrap=$('.stage-wrap'),scale=Math.max(1,Math.floor(Math.min(wrap.clientWidth/240,wrap.clientHeight/160)));$('#stage').style.transform=`scale(${scale})`;};
new ResizeObserver(fit).observe($('.stage-wrap'));
let frame=0;setInterval(()=>{const sprite=$('.walking');if(sprite)sprite.style.backgroundPosition=`${-[0,1,2,1][frame++%4]*32}px 0`;},150);
render();fit();

const criteria={monster:{name:'필드 몬스터',checks:['네 방향 GIF의 얼굴·몸을 확인했다.','걷기·발·뒷모습의 연결을 확인했다.']},ui:{name:'UI 시안',checks:['메뉴·파티·가방·상점을 확인했다.','키보드 이동과 글자 크기를 확인했다.']},music:{name:'음악·효과음',checks:['새 BGM 두 곡과 기존 곡을 들어봤다.','메뉴 효과음과 반복 구간을 들어봤다.']}};
let reviewState;
async function loadReviews(){const response=await fetch('/api/reviews');if(!response.ok)throw Error('검토 기록을 불러오지 못했습니다.');reviewState=await response.json();
 $('#reviews').innerHTML=Object.entries(criteria).map(([id,c])=>`<article class="review" data-group="${id}"><h2>${c.name}</h2><div class="decision">${reviewState.decisions[id]?.decision?.toUpperCase()??'PENDING'} · ${reviewState.packages[id].slice(0,8)}</div>${c.checks.map((t,i)=>`<label><input type="checkbox" data-check="${i}">${t}</label>`).join('')}<textarea aria-label="${c.name} 수정 의견" placeholder="고칠 부분을 적어주세요."></textarea><div class="decisions"><button class="allow" disabled data-decision="allow">Allow</button><button class="deny" data-decision="deny">Deny</button></div></article>`).join('');
 document.querySelectorAll('.review').forEach(card=>{
  card.querySelectorAll('input').forEach(input=>input.onchange=()=>card.querySelector('.allow').disabled=![...card.querySelectorAll('input')].every(x=>x.checked));
  card.querySelectorAll('[data-decision]').forEach(button=>button.onclick=async()=>{
   const group=card.dataset.group,decision=button.dataset.decision,note=card.querySelector('textarea').value.trim();if(decision==='deny'&&!note){$('#review-status').textContent='수정할 부분을 한 줄 적어주세요.';card.querySelector('textarea').focus();return;}
   const payload={group,decision,note,package:reviewState.packages[group],checks:[...card.querySelectorAll('input')].map(x=>x.checked)};button.disabled=true;
   try{const res=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await res.json();if(!res.ok)throw Error(body.error);await loadReviews();$('#review-status').textContent=`${criteria[group].name}: ${decision.toUpperCase()} 저장됨. 게임 적용은 별도입니다.`;}catch(e){$('#review-status').textContent=e.message;button.disabled=false;}
  });
 });
}
await loadReviews().catch(e=>$('#review-status').textContent=e.message);
// Read-only observability for native browser evidence; no approval or player-store hooks.
window.fieldKit=Object.freeze({snapshot:()=>({screen:state.screen,hp:state.hp,potions:state.potions,gold:state.gold,orbs:state.orbs,playing,selectedTrack,playCount,position:position(),contextState:ctx?.state??'not-started',volume})});
