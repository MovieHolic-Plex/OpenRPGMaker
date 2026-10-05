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
  let state=initial, busy=false, message='';
  const savedOpen = new Set();
  function render() {
    host.dataset.busy=String(busy);
    const deciding=state.stage==='art-review' && !state.installation;
    const working=['art','art-layout-review','art-context-review'].includes(state.stage);
    const pending=state.groups.filter(g=>!g.candidates.some(c=>c.decision==='allow') && g.candidates.some(c=>c.eligible && !c.decision));
    const completed=state.groups.filter(g=>!pending.includes(g));
    let status = '마음에 드는 예시에 Allow, 아닌 예시에 Deny를 눌러 주세요. 여러 개 Allow해도 됩니다.';
    if(state.installation) status='등록된 결과입니다.';
    else if(state.complete && !pending.length) status='선호하는 예시를 저장했습니다. 현재 공용 등록·조립 연결에서 멈춰 있습니다. 추가 선택은 필요 없습니다.';
    else if(state.stage==='blocked') status='새 예시 제작이 멈췄습니다. 기존 그림과 결정은 보존되어 있습니다.';
    else if(working) status=state.status==='running'?'새 예시를 준비하고 있습니다. 지금 누를 버튼은 없습니다.':state.paused?'새 예시 제작을 요청했습니다. 전체 작업이 일시 정지되어 실행을 기다립니다.':'새 예시 제작을 기다립니다.';
    host.innerHTML=`<h1>${esc(state.title)}</h1><p class="choice-lead">1. 예시 보기 → 2. 결과 확인</p><p class="decision-intro">${esc(status)}</p>
      <p class="example-caption">${state.id==='underground-prison'?'아래 그림은 계단·문을 방에 놓아 본 예시입니다. 전체 감옥의 완성 결과는 다음에 확인합니다.':'공간에 놓인 모습을 보고 선택해 주세요.'} Deny는 이 예시만 거절합니다.</p>
      <p class="choice-message" role="status" aria-live="polite">${esc(message)}</p><div class="decision-gallery"></div>`;
    function groupElement(group) {
      const section=document.createElement('section');section.className='choice-group';
      const candidates=group.candidates.filter(c=>!c.stale && c.images.length && (c.eligible || c.selected || c.decision));
      section.innerHTML=`<h2>${esc(titleOf(group))}</h2><div class="choice-compare"></div>`;
      if(!candidates.length) { section.innerHTML+='<p>검수를 통과한 새 예시를 준비 중입니다.</p>';return section; }
      candidates.forEach((c,number)=>{
        const card=document.createElement('article');card.className='choice-option'+(c.decision==='allow'?' selected':'')+(c.decision==='deny'?' denied':'');
        card.innerHTML=`<h3>예시 ${number+1}<span class="choice-badge">${c.decision==='allow'?'Allow · 좋아요':c.decision==='deny'?'Deny · 다른 예시':''}</span></h3>${pictures(c.images,titleOf(group))}
          <div class="binary-actions"><button data-decision="allow" aria-pressed="${c.decision==='allow'}" ${busy||!deciding||!c.eligible?'disabled':''}>Allow <small>좋아요</small></button><button data-decision="deny" aria-pressed="${c.decision==='deny'}" ${busy||!deciding||!c.eligible?'disabled':''}>Deny <small>다른 예시</small></button></div>`;
        bindPictures(card,c.images,enlarge);
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
  async function save(group,candidate,decision) {
    if(busy || candidate.decision===decision)return;
    busy=true;message='저장 중…';render();
    try {
      const result=await post({action:'decide-example',cid:state.id,group:group.id,candidate:candidate.id,
        fingerprint:candidate.fingerprint,images:candidate.images.map(im=>({path:im.path,v:im.v})),decision});
      state=result.choices;message=decision==='allow'?'Allow를 저장했습니다.':'Deny를 저장했습니다. 이 예시는 사용하지 않습니다.';
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
