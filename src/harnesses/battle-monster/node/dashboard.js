/* The browser owns presentation and sends human decisions. It runs no harness stages. */
const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="review-token"]').content;
let items = [], selected = null, filter = 'pending', busy = false;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let rendered = '', modification = null, toastTimer;
const labels = {pending:'검토 대기',allow:'Allow · 보관됨',modify:'Modify · 수정 요청',deny:'Deny · 제외됨'};
const imageCache = new Map();
function loadImage(src) {
  if (!imageCache.has(src)) imageCache.set(src,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;}));
  return imageCache.get(src);
}
function row(){return items.find(item=>item.key===selected);}
function visible(){return items.filter(item=>filter==='history'?['modify','deny'].includes(item.choice):item.choice===filter);}
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
  for(const scene of item.motions??[]) {
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
function toast(message,error=false){
  $('toast').textContent=message;$('toast').setAttribute('role',error?'alert':'status');$('toast').classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);
}
function stateText(item){return item.working?(item.choice==='modify'?'AI가 수정 중':'결과 준비 중'):item.failed?'작업을 다시 요청해 주세요':labels[item.choice];}
async function render(){
  const pending=items.filter(item=>item.choice==='pending').length;
  $('pending-count').textContent=pending;$('allow-count').textContent=items.filter(item=>item.choice==='allow').length;
  document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
  const candidates=visible();
  if(!candidates.some(item=>item.key===selected))selected=candidates[0]?.key??null;
  $('list').replaceChildren();$('list-empty').hidden=!!candidates.length;
  for(const item of candidates){
    const button=document.createElement('button');button.type='button';button.className='result-card';button.dataset.key=item.key;button.setAttribute('aria-pressed',String(item.key===selected));button.setAttribute('aria-label',`${item.name} ${stateText(item)}`);
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.setAttribute('aria-hidden','true');
    const text=document.createElement('span');const name=document.createElement('span');name.className='card-name';name.textContent=item.name;
    const status=document.createElement('span');status.className='card-status';status.textContent=stateText(item);text.append(name,status);button.append(canvas,text);
    button.addEventListener('click',()=>{selected=item.key;render();});$('list').append(button);
    loadImage(item.image).then(im=>draw(canvas,im,0,item.cell,1)).catch(()=>{});
  }
  const item=row();$('empty-view').hidden=!!item;$('result-view').hidden=!item;
  if(!item)return;
  $('name').textContent=item.name;$('edition').textContent=item.parent?'수정된 결과':item.phase==='idle'?'새 그림':'새 결과';$('choice').textContent=labels[item.choice];
  renderMotions(item);$('skill').textContent=item.skill?'스킬 · '+item.skill:'';
  $('note').hidden=!item.note||['allow','deny'].includes(item.note);$('note').textContent=item.note?'수정 요청 · '+item.note:'';
  $('progress').hidden=!item.working&&!item.failed;
  $('progress').textContent=item.failed?'작업 중 문제가 생겼습니다. Modify로 다시 요청할 수 있어요.':item.choice==='modify'?'AI가 새 후보를 만들고 있습니다. 준비되면 검토 대기에 표시됩니다.':'선택은 저장됐습니다. 결과를 받을 수 있도록 준비 중입니다.';
  for(const id of ['allow','modify','deny'])$(id).disabled=busy||item.working||(id==='allow'&&!item.ready);
  $('download').hidden=!item.download;$('download').href=item.download||'';$('download').download=item.name+'.zip';
  $('play').textContent=playing?'일시 정지':'움직임 재생';$('play').setAttribute('aria-pressed',String(playing));
}
async function refresh(force=false){
  const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw Error('결과를 불러오지 못했습니다.');
  const data=await response.json();const fingerprint=JSON.stringify(data);
  const count=data.working+(data.making??0);
  $('activity').textContent=count?`AI가 새 결과 ${count}개를 준비 중`:'그림과 움직임을 보고 골라주세요';
  if(fingerprint!==rendered||force){if(!rendered&&!data.items.some(i=>i.choice==='pending')&&data.items.some(i=>i.choice==='allow'))filter='allow';items=data.items;rendered=fingerprint;await render();}
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
    toast(action==='allow'?'Allow · 결과를 보관했습니다':action==='modify'?'Modify · AI에 수정 요청을 보냈습니다':'Deny · 검토 목록에서 제외했습니다');
    selected=null;await refresh(true);
  }catch(error){toast(error.message,true);await refresh(true).catch(()=>{});}
  finally{busy=false;submit.disabled=false;render();}
}
function openModify(){const item=row();if(!item||busy||item.working)return;modification={...item};$('instruction').value=item.choice==='modify'?item.note:'';$('modify-dialog').showModal();$('instruction').focus();}
$('allow').addEventListener('click',()=>decide('allow'));
$('deny').addEventListener('click',()=>decide('deny'));
$('modify').addEventListener('click',openModify);
$('cancel-modify').addEventListener('click',()=>$('modify-dialog').close());
$('modify-form').addEventListener('submit',event=>{event.preventDefault();const text=$('instruction').value.trim();if(!text){$('instruction').focus();return;}decide('modify',text,modification);});
$('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'일시 정지':'움직임 재생';$('play').setAttribute('aria-pressed',String(playing));document.querySelectorAll('.motion-gallery img').forEach(im=>{im.src=playing?im.dataset.gif:im.dataset.poster;});});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;selected=null;render();}));
document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.repeat||$('modify-dialog').open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||document.activeElement.isContentEditable)return;const id={a:'allow',m:'modify',d:'deny'}[event.key.toLowerCase()];if(id&&!$(id).disabled){event.preventDefault();$(id).click();}});
refresh().catch(error=>toast(error.message,true));
setInterval(()=>{if(!busy&&!$('modify-dialog').open)refresh().catch(()=>{$('activity').textContent='연결을 다시 확인하고 있습니다…';});},3000);
