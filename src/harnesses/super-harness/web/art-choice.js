const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageUrl = im => `/thumb?p=${encodeURIComponent(im.path)}&w=1000&v=${encodeURIComponent(im.v)}`;
const titleOf = g => ({stairs:'출입구가 있는 방', 'iron-door':'철문이 있는 통로', 'wood-door':'나무문이 있는 통로'}[g.id] || g.title.replace(/칩 세트/g,'공간'));

function pictures(images, title) {
  return `<div class="example-pictures">${images.map((im,i)=>`<figure><button class="scene-open" data-image="${i}" aria-label="${esc(title)} 확대"><img class="choice-scene" src="${imageUrl(im)}" alt="${esc(title+' · '+im.label)}"></button>${images.length>1?`<figcaption>${esc(im.label)}</figcaption>`:''}</figure>`).join('')}</div>`;
}
function bindPictures(host, images, enlarge) {
  host.querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>enlarge(imageUrl(images[Number(b.dataset.image)])));
}
async function post(body) {
  const r = await fetch('/api/action', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const result = await r.json();
  if(!r.ok || !result.ok) throw Error(result.error || '저장하지 못했습니다. 다시 눌러 주세요.');
  return result;
}

export function renderChoices(host, initial, onUpdate, enlarge) {
  let state={...initial,demo:initial.demo || initial.groups.some(g=>g.id==='space-demo')}, busy=false, message='';
  const savedOpen = new Set();
  function render() {
    host.dataset.busy=String(busy);
    host.classList.toggle('whole-space-demo', Boolean(state.demo));
    const deciding=state.stage==='art-review' && !state.installation;
    const working=['art','art-layout-review','art-context-review','art-demo'].includes(state.stage);
    const pending=state.groups.filter(g=>!g.candidates.some(c=>c.decision==='allow') && g.candidates.some(c=>(c.eligible || state.demo) && !c.decision));
    const completed=state.groups.filter(g=>!pending.includes(g));
    let status = '마음에 드는 예시에 Allow, 아닌 예시에 Deny를 눌러 주세요. 여러 개 Allow해도 됩니다.';
    if(state.installation) status='등록된 결과입니다.';
    else if(state.installationProgress) status='공용 칩셋 등록과 맵 저장을 마쳤습니다. 최종 플레이 확인이 남아 있으며, 추가 선택은 필요 없습니다.';
    else if(state.complete && !pending.length) status='데모 평가를 저장했습니다. 추가로 선택하거나 입력하실 필요가 없습니다.';
    else if(state.stage==='blocked') status='제작 문제를 운영에서 확인해야 합니다. 지금 하실 일은 없고, 기존 그림과 결정은 보존됩니다.';
    else if(working) status=state.demo?'공간 전체 데모입니다. 검수와 필요한 수정을 진행하며, 끝나면 아래에서 평가할 수 있습니다.':state.status==='running'?'실제 타일로 공간 전체 데모를 준비하고 있습니다.':'공간 전체 데모 제작을 요청했습니다. 아래에서 현재 작업과 대기 이유를 확인할 수 있습니다.';
    host.innerHTML=`<h1>${esc(state.title)}</h1><p class="choice-lead">실제 타일로 만든 공간 데모</p><p class="decision-intro">${esc(status)}</p>
      <p class="example-caption">${state.demo?'아래는 실제 후보 타일로 조립한 공간 전체입니다. 검수 중에도 데모를 볼 수 있습니다.':'타일로 공간 전체 데모를 만드는 중입니다.'} Deny는 이 예시만 거절합니다.</p>
      <p class="choice-message" role="status" aria-live="polite">${esc(message)}</p><div class="decision-gallery"></div>`;
    function groupElement(group) {
      const section=document.createElement('section');section.className='choice-group';
      const candidates=group.candidates.filter(c=>!c.stale && c.images.length && (state.demo || c.eligible || c.selected || c.decision));
      section.innerHTML=`<h2>${esc(titleOf(group))}</h2><div class="choice-compare"></div>`;
      if(!candidates.length) { section.innerHTML+='<p>검수를 통과한 새 예시를 준비 중입니다.</p>';return section; }
      candidates.forEach((c,number)=>{
        const card=document.createElement('article');card.className='choice-option'+(c.decision==='allow'?' selected':'')+(c.decision==='deny'?' denied':'');
        card.innerHTML=`<h3>예시 ${number+1}<span class="choice-badge">${c.decision==='allow'?'Allow · 좋아요':c.decision==='deny'?'Deny · 다른 예시':''}</span></h3>${pictures(c.images,titleOf(group))}<p>${esc(c.eligible?'데모 검수 완료 · 평가해 주세요.':(state.demo?'공간 데모 검수·수정 중':c.summary+' · 검수·수정 진행 중'))}</p>
          <div class="binary-actions"><button data-decision="allow" aria-pressed="${c.decision==='allow'}" ${busy||!deciding||!c.eligible?'disabled':''}>Allow <small>좋아요</small></button><button data-decision="deny" aria-pressed="${c.decision==='deny'}" ${busy||!deciding||!c.eligible?'disabled':''}>Deny <small>다른 예시</small></button><button data-modify ${busy||!deciding||!c.eligible?'disabled':''}>수정 요청</button></div><form class="demo-modify" hidden><label>고칠 곳<textarea maxlength="2000" required placeholder="예: 빈 공간을 줄이고 출입구를 옮겨 줘"></textarea></label><button type="submit">수정 요청 보내기</button></form>`;
        bindPictures(card,c.images,enlarge);
        card.querySelector('[data-modify]').onclick=()=>{card.querySelector('form').hidden=false;card.querySelector('textarea').focus();};
        card.querySelector('form').onsubmit=e=>{e.preventDefault();save(group,c,'deny',card.querySelector('textarea').value);};
        card.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>save(group,c,b.dataset.decision));
        section.querySelector('.choice-compare').append(card);
      });return section;
    }
    const gallery=host.querySelector('.decision-gallery');
    pending.forEach(g=>gallery.append(groupElement(g)));
    if(completed.length) {
      const details=document.createElement('details');details.className='decided-examples';details.open=savedOpen.has('history');
      details.innerHTML='<summary>이미 본 예시 · 결정 바꾸기</summary>';
      completed.forEach(g=>details.append(groupElement(g)));
      details.ontoggle=()=>details.open?savedOpen.add('history'):savedOpen.delete('history');gallery.append(details);
    }
    if(!state.groups.length) gallery.textContent='볼 수 있는 예시를 준비 중입니다.';
  }
  async function save(group,candidate,decision,text='') {
    if(busy || (candidate.decision===decision && !text))return;
    busy=true;message='저장 중…';render();
    try {
      if(text) await post({action:'evaluate-art',cid:state.id,group:group.id,candidate:candidate.id,
        fingerprint:candidate.fingerprint,imagePath:candidate.images[0].path,imageHash:candidate.images[0].v,
        rating:'revise',tags:[],text});
      const result=await post({action:'decide-example',cid:state.id,group:group.id,candidate:candidate.id,
        fingerprint:candidate.fingerprint,images:candidate.images.map(im=>({path:im.path,v:im.v})),decision,text});
      state={...result.choices,demo:result.choices.groups.some(g=>g.id==='space-demo')};message=decision==='allow'?'Allow를 저장했습니다.':'Deny를 저장했습니다. 이 예시는 사용하지 않습니다.';
      onUpdate();
    } catch(e) { message=e.message; }
    finally { busy=false;render(); }
  }
  render();
}

export function renderResult(host, state, onUpdate, enlarge) {
  let busy=false, editing=false, message='', draft='';
  function render() {
    host.dataset.busy=String(busy);
    host.innerHTML=`<h1>${esc(state.title)} · 결과 확인</h1><p class="choice-lead">마음에 들면 Allow. 다르게 만들려면 Deny. 고칠 곳이 있으면 수정을 눌러 주세요.</p>
      ${pictures(state.images,'완성 결과')}<p role="status" class="choice-message">${esc(message)}</p>
      ${state.canDecide?`<div class="binary-actions"><button data-decision="allow" ${busy?'disabled':''}>Allow <small>이 결과로 진행</small></button><button data-decision="deny" ${busy?'disabled':''}>Deny <small>다시 만들기</small></button><button data-edit ${busy?'disabled':''}>수정</button></div>
      ${editing?`<form><label>어떻게 고칠까요?<textarea maxlength="2000" required placeholder="예: 차 종류를 다양하게 하고 빈 공간을 줄여 줘">${esc(draft)}</textarea></label><button type="submit" ${busy?'disabled':''}>수정 요청</button></form>`:''}`:'<p>결과 확인을 마쳤습니다. 다음 작업을 기다립니다.</p>'}`;
    bindPictures(host,state.images,enlarge);
    host.querySelectorAll('[data-decision]').forEach(b=>b.onclick=()=>save(b.dataset.decision));
    host.querySelector('[data-edit]')?.addEventListener('click',()=>{editing=!editing;render();host.querySelector('textarea')?.focus();});
    host.querySelector('textarea')?.addEventListener('input',e=>draft=e.target.value);
    host.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();save('modify');});
  }
  async function save(decision) {
    if(busy)return;busy=true;render();
    try { const result=await post({action:'decide-result',cid:state.id,fingerprint:state.fingerprint,decision,text:draft});message=result.message;state={...state,canDecide:false};onUpdate(); }
    catch(e){message=e.message;}finally{busy=false;render();}
  }
  render();
}

/** One top-layer viewer for live images, documents and Allow/Deny examples. */
export function createImageViewer(dialog) {
  dialog.innerHTML=`<div class="image-toolbar"><strong>그림 크게 보기</strong><button data-zoom="out" aria-label="축소">−</button><output aria-live="polite">불러오는 중…</output><button data-zoom="in" aria-label="확대">＋</button><button data-zoom="actual">100%</button><button data-zoom="fit">화면 맞춤</button><a target="_blank" rel="noopener">원본 열기</a><button data-close aria-label="확대 보기 닫기">닫기 ×</button></div><p class="image-help">휠로 확대·축소 · 드래그로 이동 · Esc로 닫기</p><div class="image-viewport" tabindex="0" aria-label="확대 이미지. 방향키로 이동, 더하기 빼기로 배율 조절"><div class="image-canvas"><img draggable="false" alt="확대 이미지"></div></div>`;
  const viewport=dialog.querySelector('.image-viewport'), canvas=dialog.querySelector('.image-canvas'), img=dialog.querySelector('img'), output=dialog.querySelector('output');
  let scale=1, drag=null, opener=null, ready=false;
  function resize(next, point) {
    if(!ready)return;
    const v=viewport.getBoundingClientRect(), old=img.getBoundingClientRect();
    const anchor=point || {x:v.left+v.width/2,y:v.top+v.height/2};
    const pixel={x:(anchor.x-old.left)/scale,y:(anchor.y-old.top)/scale};
    scale=Math.min(16,Math.max(.05,next));
    img.style.width=`${img.naturalWidth*scale}px`;img.style.height=`${img.naturalHeight*scale}px`;
    canvas.style.width=`${Math.max(viewport.clientWidth,img.naturalWidth*scale+32)}px`;
    canvas.style.height=`${Math.max(viewport.clientHeight,img.naturalHeight*scale+32)}px`;
    const rect=img.getBoundingClientRect();
    viewport.scrollLeft+=rect.left+pixel.x*scale-anchor.x;
    viewport.scrollTop+=rect.top+pixel.y*scale-anchor.y;
    output.textContent=`${Math.round(scale*100)}% · ${img.naturalWidth}×${img.naturalHeight}`;
    dialog.querySelector('[data-zoom="out"]').disabled=scale<=.05;
    dialog.querySelector('[data-zoom="in"]').disabled=scale>=16;
  }
  function fit(){resize(Math.min((viewport.clientWidth-32)/img.naturalWidth,(viewport.clientHeight-32)/img.naturalHeight));viewport.scrollTo(0,0);}
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>b.dataset.zoom==='fit'?fit():resize(b.dataset.zoom==='actual'?1:scale*(b.dataset.zoom==='in'?1.5:1/1.5)));
  viewport.addEventListener('wheel',e=>{if(!ready)return;e.preventDefault();resize(scale*Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.002),{x:e.clientX,y:e.clientY});},{passive:false});
  viewport.onpointerdown=e=>{if(e.button!==0||!ready)return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');};
  viewport.onpointermove=e=>{if(drag){viewport.scrollLeft=drag.left+drag.x-e.clientX;viewport.scrollTop=drag.top+drag.y-e.clientY;}};
  const release=()=>{drag=null;viewport.classList.remove('dragging');};
  viewport.onpointerup=release;viewport.onpointercancel=release;viewport.onlostpointercapture=release;
  dialog.addEventListener('keydown',e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();e.stopPropagation();e.key==='0'?fit():resize(scale*(e.key==='-'?1/1.5:1.5));}if(e.key==='Escape')e.stopPropagation();});
  dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
  dialog.addEventListener('close',()=>{release();if(opener?.isConnected)opener.focus({preventScroll:true});});
  window.addEventListener('resize',()=>{if(dialog.open&&ready)resize(scale);});
  return function open(url, label='공간 그림') {
    const source=new URL(url,location.href);
    if(source.origin!==location.origin || !['/thumb','/data/'].some(p=>source.pathname.startsWith(p)))return;
    // Inspect original pixels, not the resized thumbnail (same server access checks).
    if(source.pathname==='/thumb'){
      const path=source.searchParams.get('p');if(!path)return;
      const version=source.searchParams.get('v');source.pathname='/data/'+path.split('/').map(encodeURIComponent).join('/');source.search='';if(version)source.searchParams.set('v',version);
    }
    opener=document.activeElement;ready=false;release();img.hidden=true;output.textContent='불러오는 중…';
    img.alt=label;dialog.querySelector('a').href=source.href;
    img.onload=()=>{ready=true;img.hidden=false;scale=1;fit();viewport.focus({preventScroll:true});};
    img.onerror=()=>{ready=false;output.textContent='이미지를 불러오지 못했습니다. 원본 열기를 확인해 주세요.';};
    if(!dialog.open)dialog.showModal();img.src=source.href;
  };
}
