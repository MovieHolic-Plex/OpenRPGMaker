const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageUrl = (im, width=1000) => `/thumb?p=${encodeURIComponent(im.path)}&w=${width}&v=${im.v}`;
const RATINGS = [['like','좋아요'],['revise','고칠 점 있어요'],['replace','다른 예시가 필요해요']];
const TAGS = [['identity','무엇인지 잘 모르겠어요'],['direction','방향·높이'],['scale','크기'],['layout','배치·빈 공간'],['style','색·분위기'],['repetition','반복']];

export function renderChoices(host, initial, onUpdate, enlarge) {
  let state = initial, busy = false, message = '';
  let groupId = state.groups.find(g => !g.candidates.some(c => c.selected))?.id || state.groups[0]?.id;
  const frame = {}, drafts = {};
  function description(group) {
    if(state.id === 'underground-prison') {
      const places = {
        stairs: ['출입구로 올라가는 계단', '그림 아래 중앙의 계단입니다. 설계 의도: 감옥 바닥(화면 위쪽)에서 상층 출입구(화면 아래쪽)로 올라갑니다. 그림에서 오르내리는 방향과 높낮이가 자연스럽게 읽히는지 봐 주세요.'],
        'iron-door': ['철문이 놓인 통로', '철문이 통로를 막은 모습과 열린 모습을 함께 확인해 주세요. 열림·닫힘은 같은 예시 묶음으로 채택됩니다.'],
        'wood-door': ['잠긴 나무문이 있는 통로', '문이 주변 벽과 어울리고 출입구로 읽히는지 봐 주세요. 열림·닫힘은 같은 예시 묶음으로 채택됩니다.'],
      };
      if(places[group.id]) return places[group.id];
    }
    return [group.title+' 배치 예시', group.description];
  }
  const draftKey = (group,candidate,im) => JSON.stringify([group.id,candidate.id,candidate.fingerprint,im?.path,im?.v]);
  function render() {
    const working = ['art', 'art-layout-review', 'art-context-review'].includes(state.stage);
    const group = state.groups.find(g => g.id === groupId) || state.groups[0];
    const installed = Boolean(state.installation);
    host.innerHTML = `<h1>${esc(state.title)} · 예시 보고 평가하기</h1>
      <p class="choice-lead">공간에 놓인 모습을 보고, 마음에 드는 점과 고칠 점을 알려 주세요.</p>
      <div class="choice-notice">${working ? esc(state.note) : installed ? '등록된 예시와 남긴 평가를 확인할 수 있습니다.' : state.complete ? '예시 채택을 저장했습니다. 다음은 공용 등록과 맵 조립입니다.' : '마음에 드는 예시는 채택하고, 어색한 예시에는 평가를 남겨 주세요. 부품 이름이나 제작 규칙을 알 필요는 없습니다.'}
      <div>${state.id==='underground-prison' ? '지금은 계단·문을 검수용 방에 배치한 예시입니다. 전체 감옥 맵과 통행 연결은 후속 제작·검수 대상입니다.' : '아래 예시는 현재 제작 자료입니다. 완성·공용 등록 여부는 각 검수와 저장 기록으로 확인합니다.'}</div></div>
      <nav class="choice-checklist" aria-label="평가할 장면">${state.groups.map((g,i) => {
        const selected = g.candidates.find(c => c.selected);
        const rated = g.candidates.reduce((n,c)=>n+(c.evaluations?.length || (c.evaluation?1:0)),0);
        return `<button data-group="${esc(g.id)}" aria-current="${g.id===group?.id ? 'step' : 'false'}" ${busy?'disabled':''}><span>${i+1}. ${esc(description(g)[0])}</span><small>${selected ? '✓ 예시 '+(g.candidates.indexOf(selected)+1)+' 채택됨' : rated ? `평가 ${rated}건 저장됨` : '예시 보기·평가하기'}</small></button>`;
      }).join('')}</nav><p role="status" class="choice-message">${esc(message)}</p><div class="choice-groups"></div>`;
    host.querySelectorAll('[data-group]').forEach(b => b.onclick = () => { groupId=b.dataset.group; render(); });
    if (!group || !group.candidates.length) {
      host.querySelector('.choice-groups').textContent = '아직 볼 수 있는 예시가 없습니다. 제작 후 이곳에 표시됩니다.';return;
    }
    const [title,guide] = description(group);
    const section = document.createElement('section');section.className='choice-group';section.dataset.group=group.id;
    const count = Math.max(0,...group.candidates.map(c=>c.images.length));
    const idx = Math.min(frame[group.id] || 0,Math.max(0,count-1));
    const frames=group.candidates.find(c=>c.images.length===count)?.images || [];
    section.innerHTML=`<h2>${esc(title)}</h2><p class="example-guide">${esc(guide)}</p>
      ${group.staleSelection ? '<p class="choice-error">채택했던 예시가 변경되었습니다. 새 그림을 다시 확인해 주세요.</p>' : ''}
      ${count>1 ? `<div class="choice-states" role="group" aria-label="장면 상태"><span>함께 보기:</span> ${frames.map((im,i)=>`<button data-frame="${i}" aria-pressed="${i===idx}" ${busy?'disabled':''}>${esc(im.label)}</button>`).join('')}</div>` : ''}
      <div class="choice-compare"></div><p class="example-storage-note">평가는 보고 있는 그림과 함께 저장되어 다음 제작·검수에 전달됩니다. 평가 저장만으로 재제작이 시작되지는 않습니다.</p>`;
    for (const [number,candidate] of group.candidates.entries()) {
      const im=candidate.images[idx], key=draftKey(group,candidate,im);
      const saved = candidate.evaluations?.find(e=>e.image?.path===im?.path && e.image?.v===im?.v) || (candidate.evaluation?.image?.path===im?.path ? candidate.evaluation : null);
      const draft=drafts[key] ||= {rating:saved?.rating || '',tags:[...(saved?.tags || [])],text:saved?.comment || ''};
      const canChoose=candidate.eligible && !working && !installed;
      const card=document.createElement('article');card.className='choice-option example-option'+(candidate.selected?' selected':'');
      card.innerHTML=`<h3>예시 ${number+1}<span class="choice-badge">${candidate.selected?'✓ 채택됨':saved?'평가 저장됨':''}</span></h3>
        ${im ? `<button class="scene-open" aria-label="${esc(title)} 예시 ${number+1} 확대"><img class="choice-scene" src="${imageUrl(im)}" alt="${esc(title+' · '+im.label)} 예시 ${number+1}"></button><p class="example-caption">${esc(im.label)} · 그림을 누르면 확대됩니다.</p>` : '<p class="choice-error">이 상태의 예시가 없습니다.</p>'}
        <button class="primary choose-candidate" ${busy || !canChoose || candidate.selected ? 'disabled':''}>${candidate.selected?'✓ 이 예시 채택됨':!candidate.eligible?'수정 후 채택 가능':working?'제작·검수 중':installed?'등록 완료':'이 예시로 진행'}</button>
        ${candidate.selected && !installed?'<button class="clear-choice">채택 취소</button>':''}
        ${!candidate.eligible && !working?'<p class="example-caption">채택 전 수정이 필요한 예시입니다. 평가 의견은 남길 수 있습니다.</p>':''}
        <form class="example-evaluation"><fieldset ${busy || !im ? 'disabled':''}><legend>이 예시는 어떤가요?</legend>
          <div class="example-ratings">${RATINGS.map(([k,label])=>`<label><input type="radio" name="rating" value="${k}" ${draft.rating===k?'checked':''} required>${label}</label>`).join('')}</div>
          <p class="example-caption">고칠 부분이 있다면 골라 주세요. 여러 개 선택할 수 있습니다.</p>
          <div class="example-tags">${TAGS.map(([k,label])=>`<label><input type="checkbox" value="${k}" ${draft.tags.includes(k)?'checked':''}>${label}</label>`).join('')}</div>
          <label class="example-text">구체적으로 어떤가요?<textarea maxlength="2000" aria-label="예시 ${number+1} 평가 의견" placeholder="예: 계단이 올라가는지 내려가는지 모르겠어요. 문이 너무 작아요.">${esc(draft.text)}</textarea></label>
          <button type="submit" class="save-evaluation">${busy?'저장 중…':saved?'평가 수정 저장':'평가 남기기'}</button>
          ${saved?`<small>저장한 평가: ${esc(RATINGS.find(r=>r[0]===saved.rating)?.[1])} · ${esc(saved.image?.label)} · ${esc(saved.at)}</small>`:''}
        </fieldset></form>
        <details class="example-source"><summary>사용된 부품·검수 정보</summary><p>${esc(group.title)} · ${esc(candidate.title)} · ${esc(candidate.summary)}</p>
          ${candidate.sheet?`<button class="choice-part" aria-label="${esc(candidate.title)} 원본 부품 확대"><img src="${imageUrl(candidate.sheet,256)}" alt="${esc(candidate.title)} 원본 부품"></button>`:''}
          ${candidate.reasons.length?`<ul>${candidate.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:''}
          <p>${esc(candidate.caution)}</p></details>`;
      card.querySelector('.scene-open')?.addEventListener('click',()=>enlarge(imageUrl(im,1600)));
      const part=card.querySelector('.choice-part img');
      if(part){const size=()=>part.style.width=Math.min(part.naturalWidth*4,256)+'px';part.onload=size;if(part.complete)size();}
      card.querySelector('.choice-part')?.addEventListener('click',()=>enlarge(imageUrl(candidate.sheet,1600)));
      card.querySelector('.choose-candidate').onclick=()=>{if(canChoose && !candidate.selected)save('choose-art',group,candidate);};
      card.querySelector('.clear-choice')?.addEventListener('click',()=>save('clear-art',group,candidate));
      const form=card.querySelector('form');
      form.querySelectorAll('[name=rating]').forEach(input=>input.onchange=()=>{draft.rating=input.value;});
      form.querySelectorAll('[type=checkbox]').forEach(input=>input.onchange=()=>{draft.tags=[...form.querySelectorAll('[type=checkbox]:checked')].map(e=>e.value);});
      form.querySelector('textarea').oninput=e=>{draft.text=e.target.value;};
      form.onsubmit=e=>{e.preventDefault();if(!busy && im)save('evaluate-art',group,candidate,{rating:draft.rating,tags:draft.tags,text:draft.text,imagePath:im.path,imageHash:im.v});};
      section.querySelector('.choice-compare').append(card);
    }
    section.querySelectorAll('[data-frame]').forEach(b=>b.onclick=()=>{frame[group.id]=Number(b.dataset.frame);render();});
    host.querySelector('.choice-groups').append(section);
  }
  async function save(action,group,candidate,extra={}) {
    if(busy)return;
    busy=true;message='저장하는 중…';render();
    try {
      const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,cid:state.id,group:group.id,candidate:candidate.id,fingerprint:candidate.fingerprint,...extra})});
      const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || '저장하지 못했습니다. 다시 시도해 주세요.');
      state=result.choices;
      const label=description(group)[0];
      message=action==='evaluate-art'?`${label} · 평가를 저장했습니다. 다음 제작·검수에 전달됩니다.`:action==='clear-art'?`${label} · 채택을 취소했습니다.`:`${label} · 예시 채택을 저장했습니다.`;
      // Keep this scene visible so the user can evaluate it after choosing it.
      onUpdate();
    }catch(error){message=error.message;}
    finally{busy=false;render();host.querySelector('.choice-message')?.scrollIntoView({block:'nearest'});}
  }
  render();
}
