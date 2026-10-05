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
    const deciding=state.stage==='art-review' && !state.installation;
    const working=['art','art-layout-review','art-context-review','art-demo'].includes(state.stage);
    const pending=state.groups.filter(g=>!g.candidates.some(c=>c.decision==='allow') && g.candidates.some(c=>(c.eligible || state.demo) && !c.decision));
    const completed=state.groups.filter(g=>!pending.includes(g));
    let status = '마음에 드는 예시에 Allow, 아닌 예시에 Deny를 눌러 주세요. 여러 개 Allow해도 됩니다.';
    if(state.installation) status='등록된 결과입니다.';
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
