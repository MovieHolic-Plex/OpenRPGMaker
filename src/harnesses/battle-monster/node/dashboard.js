/* The browser owns presentation and sends human decisions. It runs no harness stages. */
const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="review-token"]').content;
let items = [], selected = null, filter = 'pending', busy = false;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let rendered = '', modification = null, toastTimer, uiVersion = '';
const restoredFilter = sessionStorage.getItem('monster-review-filter');
const requestedCandidate = new URLSearchParams(location.search).get('candidate');
if (['pending','allow','deny','history'].includes(restoredFilter)) filter = restoredFilter;
const labels = {pending:'검토 대기',allow:'Allow · 선택 반영됨',modify:'Modify · 수정 요청',deny:'Deny · 제외됨'};
const imageCache = new Map();
function loadImage(src) {
  if (!imageCache.has(src)) imageCache.set(src,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;}));
  return imageCache.get(src);
}
function row(){return items.find(item=>item.key===selected);}
function visible(){return items.filter(item=>filter==='history'?(item.reviewSupersededBy||item.choice==='modify'||(item.choice==='allow'&&item.active===false)):filter==='allow'?item.choice==='allow'&&item.active!==false:item.choice===filter&&!item.reviewSupersededBy);}
function chooseFilter(value){filter=value;sessionStorage.setItem('monster-review-filter',filter);selected=null;render();}
function draw(canvas,img,pose,size,scale=3){
  canvas.width=size*scale;canvas.height=size*scale;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
  if(img)ctx.drawImage(img,(pose%3)*size,Math.floor(pose/3)*size,size,size,0,0,canvas.width,canvas.height);
}
function motionImage(scene, alt) {
  const im=document.createElement('img');im.width=192;im.height=192;im.alt=alt;
  im.dataset.gif=scene.gif;im.dataset.poster=scene.poster;im.src=playing?scene.gif:scene.poster;
  im.addEventListener('error',()=>{im.alt=alt+' · 새로고침해 주세요';});return im;
}
function renderMotions(item) {
  const gallery=$('motion-gallery');gallery.replaceChildren();
  gallery.classList.toggle('style-pilot',item.phase==='idle');
  for(const scene of item.motions??[]) {
    if(item.phase==='idle'&&!scene.available)continue;
    const tile=document.createElement('figure');tile.className='motion-tile';
    const title=document.createElement('figcaption');title.textContent=scene.label;tile.append(title);
    const pictures=document.createElement('div');pictures.className='motion-pictures';
    const old=item.beforeMotions?.find(m=>m.id===scene.id);
    if(item.beforeMotions) {
      const previous=document.createElement('div');previous.className='motion-version';
      const label=document.createElement('span');label.textContent='이전';previous.append(label);
      if(old?.available)previous.append(motionImage(old,'수정 전 '+scene.label));
      else {const empty=document.createElement('p');empty.className='motion-empty';empty.textContent='추가된 동작';previous.append(empty);}
      pictures.append(previous);
    }
    const current=document.createElement('div');current.className='motion-version';
    if(item.beforeMotions){const label=document.createElement('span');label.textContent='수정 후';current.append(label);}
    if(scene.available)current.append(motionImage(scene,item.name+' · '+scene.label));
    else {const empty=document.createElement('p');empty.className='motion-empty';empty.textContent='아직 없는 동작';current.append(empty);}
    pictures.append(current);tile.append(pictures);gallery.append(tile);
  }
}
async function renderSizeComparison(item) {
  const figure=$('size-comparison');figure.hidden=true;
  if(item.cell<=64)return;
  const human=items.find(candidate=>candidate.kind==='human'&&candidate.cell===64
    &&candidate.choice==='pending'&&!candidate.reviewSupersededBy)
    ??items.find(candidate=>candidate.kind==='human'&&candidate.cell===64
      &&candidate.choice==='allow'&&candidate.active!==false);
  if(!human)return;
  const [monsterImage,humanImage]=await Promise.all([loadImage(item.image),loadImage(human.image)]);
  if(selected!==item.key)return;
  const canvas=$('size-canvas'),scale=2,gap=16;
  canvas.width=(item.cell+gap+human.cell)*scale;canvas.height=item.cell*scale;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(monsterImage,0,0,item.cell,item.cell,0,0,item.cell*scale,item.cell*scale);
  ctx.drawImage(humanImage,0,0,human.cell,human.cell,(item.cell+gap)*scale,
    (item.cell-human.cell)*scale,human.cell*scale,human.cell*scale);
  $('size-caption').textContent=`사람과 크기 비교 · ${item.name} / ${human.name}`;
  canvas.setAttribute('aria-label',`${item.name}와 ${human.name}를 같은 비율로 표시한 크기 비교`);
  figure.hidden=false;
}
function toast(message,error=false){
  $('toast').textContent=message;$('toast').setAttribute('role',error?'alert':'status');$('toast').classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);
}
function stateText(item){return item.reviewSupersededBy?'이전 결과':item.choice==='allow'&&item.active===false?'Allow · 이전에 선택한 버전':labels[item.choice];}
async function render(){
  const pending=items.filter(item=>item.choice==='pending'&&!item.reviewSupersededBy).length;
  const allowed=items.filter(item=>item.choice==='allow'&&item.active!==false).length;
  $('pending-count').textContent=pending;$('allow-count').textContent=allowed;
  $('deny-count').textContent=items.filter(item=>item.choice==='deny').length;
  $('selection-summary').textContent=`Allow ${allowed}종 선택 · Deny ${$('deny-count').textContent}개 제외 · 검토 대기 ${pending}개`;
  $('list-empty').textContent=filter==='allow'?'선택한 몬스터가 없습니다.':filter==='deny'?'제외한 결과가 없습니다.':filter==='history'?'지난 버전이나 수정 요청이 없습니다.':'검토할 결과가 없습니다.';
  $('empty-title').textContent=filter==='pending'?'선택 반영 완료':'결과가 없습니다';
  $('empty-description').textContent=filter==='pending'?`선택한 ${allowed}종은 Allow에, 제외한 결과는 Deny에 반영됐습니다.`:'다른 목록에서 결과를 확인할 수 있습니다.';
  $('show-allowed').hidden=filter!=='pending'||!allowed;
  document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
  const candidates=visible();
  if(!candidates.some(item=>item.key===selected))selected=candidates[0]?.key??null;
  $('list').replaceChildren();$('list-empty').hidden=!!candidates.length;
  for(const item of candidates){
    const button=document.createElement('button');button.type='button';button.className='result-card';button.dataset.key=item.key;button.dataset.choice=item.choice;button.setAttribute('aria-pressed',String(item.key===selected));button.setAttribute('aria-label',`${item.name} ${stateText(item)}`);
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.setAttribute('aria-hidden','true');
    const text=document.createElement('span');const name=document.createElement('span');name.className='card-name';name.textContent=item.name;
    const status=document.createElement('span');status.className='card-status';status.textContent=stateText(item);text.append(name,status);
    if(item.working||item.failed){const task=document.createElement('span');task.className='card-task';task.textContent=item.failed?'작업 실패':item.phase==='idle'?'동작 제작 중':item.choice==='modify'?'AI 수정 중':'받을 파일 준비 중';text.append(task);}
    button.append(canvas,text);
    button.addEventListener('click',()=>{selected=item.key;render();});$('list').append(button);
    loadImage(item.image).then(im=>draw(canvas,im,0,item.cell,1)).catch(()=>{});
  }
  const item=row();$('empty-view').hidden=!!item;$('result-view').hidden=!item;
  if(!item)return;
  $('name').textContent=item.name;$('edition').textContent=item.phase==='idle'?'대기 자세 후보':item.parent?'수정된 결과':'새 결과';$('choice').textContent=stateText(item);$('choice').dataset.choice=item.choice;
  document.querySelector('.motion-tools p').textContent=item.phase==='idle'?'기본 그림을 먼저 골라주세요':'모든 동작을 함께 보기';
  renderMotions(item);$('skill').textContent=item.skill?'스킬 · '+item.skill:'';
  renderSizeComparison(item).catch(()=>{if(selected===item.key)$('size-comparison').hidden=true;});
  $('note').hidden=!item.note||['allow','deny'].includes(item.choice)||['allow','deny'].includes(item.note);$('note').textContent=item.note?'수정 요청 · '+item.note:'';
  $('progress').hidden=!item.working&&!item.failed;
  $('progress').textContent=item.failed?'작업 중 문제가 생겼습니다. Modify로 다시 요청할 수 있어요.':item.choice==='modify'?'AI가 새 후보를 만들고 있습니다. 준비되면 검토 대기에 표시됩니다.':item.phase==='idle'?'Allow 선택은 반영됐습니다. 이 그림으로 동작을 만들고 있습니다. 완성된 후보는 검토 대기에 표시됩니다.':'Allow 선택은 반영됐습니다. 받을 파일을 준비 중이며, Modify·Deny로 선택을 바꿀 수 있습니다.';
  for(const id of ['allow','modify','deny'])$(id).disabled=busy||(id==='allow'&&(!item.ready||(item.choice==='allow'&&item.active!==false&&!item.failed)))||(id==='deny'&&item.choice==='deny');
  $('allow').querySelector('span').textContent=item.choice==='allow'&&item.active!==false&&!item.failed?'선택 반영됨':item.phase==='idle'?'이 그림으로 동작 만들기':'이 결과 선택';
  $('download').hidden=!item.download;$('download').href=item.download||'';$('download').download=item.name+'.zip';
  $('play').textContent=playing?'일시 정지':'움직임 재생';$('play').setAttribute('aria-pressed',String(playing));
}
async function refresh(force=false){
  const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw Error('결과를 불러오지 못했습니다.');
  const data=await response.json();
  if(uiVersion&&data.uiVersion&&uiVersion!==data.uiVersion&&!busy&&!$('modify-dialog').open){location.reload();return;}
  uiVersion=data.uiVersion??uiVersion;
  $('last-decision').textContent=data.lastDecision?`마지막 반영 · ${data.lastDecision.name} ${data.lastDecision.action.toUpperCase()}`:'';
  const fingerprint=JSON.stringify(data);
  const count=data.working+(data.making??0);
  $('activity').textContent=count?`작업 ${count}개 진행 중 · 선택은 즉시 반영`:'그림과 움직임을 보고 골라주세요';
  if(fingerprint!==rendered||force){
    if(!rendered){
      const requested=data.items.find(i=>i.key===requestedCandidate);
      if(requested){selected=requested.key;filter=requested.reviewSupersededBy||requested.choice==='modify'||(requested.choice==='allow'&&requested.active===false)?'history':requested.choice;}
      else if(!restoredFilter&&!data.items.some(i=>i.choice==='pending'&&!i.reviewSupersededBy)&&data.items.some(i=>i.choice==='allow'))filter='allow';
    }
    items=data.items;rendered=fingerprint;await render();
  }
}
function requestId(){return crypto.randomUUID?.()??'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3|8)).toString(16);});}
async function decide(action,note='',target=row()){
  if(!target||busy)return;
  busy=true;for(const id of ['allow','modify','deny'])$(id).disabled=true;
  const submit=$('modify-form').querySelector('[type=submit]');submit.disabled=true;
  try{
    const response=await fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json','X-Review-Token':token},body:JSON.stringify({key:target.key,version:target.version,action,note,requestId:requestId()})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'선택을 저장하지 못했습니다.');
    if($('modify-dialog').open)$('modify-dialog').close();
    toast(action==='allow'?'Allow · 선택한 몬스터에 반영했습니다':action==='modify'?'Modify · AI에 수정 요청을 보냈습니다':'Deny · 제외 목록에 반영했습니다');
    selected=null;await refresh(true);
  }catch(error){toast(error.message,true);await refresh(true).catch(()=>{});}
  finally{busy=false;submit.disabled=false;render();}
}
function openModify(){const item=row();if(!item||busy)return;modification={...item};$('instruction').value=item.choice==='modify'?item.note:'';$('modify-dialog').showModal();$('instruction').focus();}
$('allow').addEventListener('click',()=>decide('allow'));
$('deny').addEventListener('click',()=>decide('deny'));
$('modify').addEventListener('click',openModify);
$('cancel-modify').addEventListener('click',()=>$('modify-dialog').close());
$('modify-form').addEventListener('submit',event=>{event.preventDefault();const text=$('instruction').value.trim();if(!text){$('instruction').focus();return;}decide('modify',text,modification);});
$('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'일시 정지':'움직임 재생';$('play').setAttribute('aria-pressed',String(playing));document.querySelectorAll('.motion-gallery img').forEach(im=>{im.src=playing?im.dataset.gif:im.dataset.poster;});});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{chooseFilter(button.dataset.filter);}));
document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.repeat||$('modify-dialog').open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||document.activeElement.isContentEditable)return;const id={a:'allow',m:'modify',d:'deny'}[event.key.toLowerCase()];if(id&&!$(id).disabled){event.preventDefault();$(id).click();}});
$('show-allowed').addEventListener('click',()=>chooseFilter('allow'));
refresh().catch(error=>toast(error.message,true));
setInterval(()=>{if(!busy&&!$('modify-dialog').open)refresh().catch(()=>{$('activity').textContent='연결을 다시 확인하고 있습니다…';});},3000);
