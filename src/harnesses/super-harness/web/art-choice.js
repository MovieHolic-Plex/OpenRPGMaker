const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageUrl = (im, width=1000) => `/thumb?p=${encodeURIComponent(im.path)}&w=${width}&v=${im.v}`;

export function renderChoices(host, initial, onUpdate, enlarge, requestCorrection = () => {}) {
  let state = initial, busy = false, message = '';
  let groupId = state.groups.find(g => !g.candidates.some(c => c.selected))?.id || state.groups[0]?.id;
  const frame = {};
  function render() {
    const working = ['art', 'art-layout-review', 'art-context-review'].includes(state.stage);
    const group = state.groups.find(g => g.id === groupId) || state.groups[0];
    const remaining = state.groups.filter(g => !g.candidates.some(c => c.selected)).length;
    const installed = Boolean(state.installation);
    const lead = working ? '후보 제작·검수 중입니다. 지금은 선택할 단계가 아닙니다.' : installed ? '선택한 칩의 공용 등록·맵 저장이 끝났습니다.' : state.complete ? '모든 부품의 선택을 저장했습니다.' : `${state.title}에 쓸 부품 ${state.total}종을 고르는 단계입니다.`;
    host.innerHTML = `<h1>${esc(state.title)} · 부품 선택</h1><p class="choice-lead">${esc(lead)}</p>
      <div class="choice-notice">${working ? esc(state.note) : installed ? '아래에서 저장된 선택을 확인할 수 있습니다.' : state.complete ? '다음은 선택한 칩의 공용 등록과 맵 조립입니다. 선택만으로 맵이 완성되지는 않습니다.' : '각 항목에서 마음에 드는 그림 하나를 고르세요. A/B는 서로 다른 그림입니다. 그림 검수에 실패한 후보는 선택할 수 없습니다.'}
      <div>${working || installed ? '' : state.complete ? '선택은 저장되어 있습니다. 다음 공용 등록 작업이 필요합니다.' : '큰 부품 그림을 비교하고, 아래 배치 예시에서 주변과 어울리는지 확인한 뒤 ‘이 그림 사용’을 누르세요.'}</div></div>
      <p class="choice-progress">${state.selectedCount} / ${state.total}종 저장됨${remaining ? ` · ${remaining}종 남음` : ''}</p>
      <nav class="choice-checklist" aria-label="고를 부품">${state.groups.map((g,i) => {
        const selected = g.candidates.find(c => c.selected);
        return `<button data-group="${esc(g.id)}" aria-current="${g.id===group?.id ? 'step' : 'false'}" ${busy?'disabled':''}><span>${i+1}. ${esc(g.title)}</span><small>${selected ? '✓ '+esc(selected.title)+' 저장됨' : g.candidates.some(c=>c.eligible) ? '아직 안 고름' : '수정 필요 · 선택 불가'}</small></button>`;
      }).join('')}</nav><p role="status" class="choice-message">${esc(message)}</p><div class="choice-groups"></div>`;
    host.querySelectorAll('[data-group]').forEach(b => b.onclick = () => { groupId=b.dataset.group; render(); });
    if (!group || !group.candidates.length) {
      host.querySelector('.choice-groups').textContent = '아직 비교할 후보가 없습니다. 제작·검수 후 이곳에 표시됩니다.';
      return;
    }
    const allowed = group.candidates.filter(c => c.eligible);
    const section = document.createElement('section'); section.className = 'choice-group'; section.dataset.group = group.id;
    const count = Math.max(0, ...group.candidates.map(c=>c.images.length));
    const idx = Math.min(frame[group.id] || 0, Math.max(0,count-1));
    const frames = group.candidates.find(c=>c.images.length===count)?.images || [];
    const guide = group.id === 'stairs' ? '계단의 단이 잘 보이는지, 주변 돌바닥과 어울리는지 비교하세요.' : ['iron-door','wood-door'].includes(group.id) ? '문 모양과 색감을 비교하세요. 닫힘·열림은 같은 후보의 한 묶음으로 저장됩니다.' : group.description;
    section.innerHTML = `<h2>${state.groups.indexOf(group)+1}. ${esc(group.title)}</h2><p>${esc(guide)}</p>
      ${allowed.length===1 ? `<p class="choice-only">선택 가능한 후보는 <b>${esc(allowed[0].title)}</b> 하나입니다. 마음에 들면 사용하고, 마음에 들지 않으면 아래 ‘수정 요청 작성’을 눌러 주세요.</p>` : !allowed.length ? '<p class="choice-only">현재 후보를 억지로 고를 필요가 없습니다. 검수를 통과한 후보가 없어 수정이 필요합니다.</p>' : '<p>선택 가능한 후보는 개별 그림 검수를 통과했습니다. 모양과 색감을 비교해 고르면 됩니다.</p>'}
      ${group.staleSelection ? '<p class="choice-error">이전에 고른 그림이 바뀌었습니다. 새 그림을 다시 확인해 주세요.</p>' : ''}
      ${count>1 ? `<div class="choice-states" role="group" aria-label="두 후보의 배치 상태 함께 보기"><span>배치 예시:</span> ${frames.map((im,i)=>`<button data-frame="${i}" aria-pressed="${i===idx}" ${busy?'disabled':''}>${esc(im.label)}</button>`).join('')}</div>` : ''}
      <div class="choice-compare"></div><div class="choice-reject"><span>마음에 드는 그림이 없나요?</span><button class="request-correction" ${busy?'disabled':''}>이 부품 수정 요청 작성</button><small>교정 입력란으로 이동합니다. 입력 후 직접 제출할 수 있습니다.</small></div>`;
    for (const candidate of group.candidates) {
      const im = candidate.images[idx];
      const card = document.createElement('article'); card.className = 'choice-option'+(candidate.selected?' selected':'')+(!candidate.eligible?' unavailable':'');
      const canChoose = candidate.eligible && !working && !installed;
      card.innerHTML = `<h3>${esc(candidate.title)} <span class="choice-badge">${candidate.selected ? '✓ 저장됨' : candidate.eligible ? '선택 가능' : '선택 불가'}</span></h3>
        ${candidate.sheet ? `<button class="choice-part" aria-label="${esc(group.title+' '+candidate.title)} 부품 확대"><img src="${imageUrl(candidate.sheet,256)}" alt="${esc(group.title+' '+candidate.title)} 부품 원본"></button><p class="choice-caption">고를 부품 확대${count>1 ? ' · 대표 원본, 상태별 모습은 아래 예시' : ''}</p>` : ''}
        <button class="primary choose-candidate" ${busy || !canChoose || candidate.selected ? 'disabled' : ''}>${busy ? '저장 중…' : candidate.selected ? '✓ 이 그림으로 저장됨' : !candidate.eligible ? '검수 불합격 · 선택 불가' : working ? '검수 완료 후 선택' : installed ? '등록 완료' : `${esc(candidate.title)} — 이 그림 사용`}</button>
        ${candidate.selected && !installed ? '<button class="clear-choice">선택 취소</button>' : ''}
        ${candidate.reasons.length ? `<details class="choice-reasons"><summary>왜 선택할 수 없나요?</summary><ul>${candidate.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
        <h4>배치 예시${im ? ' · '+esc(im.label) : ''}</h4>
        ${im ? `<button class="scene-open" aria-label="${esc(group.title+' '+candidate.title+' '+im.label)} 배치 예시 확대"><img class="choice-scene" src="${imageUrl(im)}" alt="${esc(candidate.title+' '+im.label)} 배치 예시"></button>` : '<p class="choice-error">이 상태의 예시가 없습니다.</p>'}`;
      const part = card.querySelector('.choice-part img');
      if (part) { const size=()=>part.style.width=Math.min(part.naturalWidth*4,256)+'px'; part.onload=size; if(part.complete)size(); }
      card.querySelector('.choice-part')?.addEventListener('click',()=>enlarge(imageUrl(candidate.sheet,1600)));
      card.querySelector('.scene-open')?.addEventListener('click',()=>enlarge(imageUrl(im,1600)));
      card.querySelector('.choose-candidate').onclick=()=> { if(canChoose && !candidate.selected) save('choose-art',group,candidate); };
      card.querySelector('.clear-choice')?.addEventListener('click',()=>save('clear-art',group,candidate));
      section.querySelector('.choice-compare').append(card);
    }
    const cautions=[...new Set(group.candidates.map(c=>c.caution).filter(Boolean))];
    const note=document.createElement('p');note.className='choice-caption';note.textContent=cautions.join(' ');section.append(note);
    section.querySelectorAll('[data-frame]').forEach(b=>b.onclick=()=>{frame[group.id]=Number(b.dataset.frame);render();});
    section.querySelector('.request-correction').onclick=()=>requestCorrection(group);
    host.querySelector('.choice-groups').append(section);
  }
  async function save(action, group, candidate) {
    if(busy)return;
    busy=true;
    message=action==='clear-art'?'선택을 취소하는 중…':'선택을 저장하는 중…'; render();
    try {
      const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,cid:state.id,group:group.id,...(action==='choose-art'?{candidate:candidate.id,fingerprint:candidate.fingerprint}:{})})});
      const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || '저장하지 못했습니다. 다시 시도해 주세요.');
      state=result.choices;
      message=action==='clear-art'?`${group.title} 선택을 취소했습니다.`:`${group.title} · ${candidate.title} 저장 완료.`;
      if(action==='choose-art') {
        const next=state.groups.find(g=>!g.candidates.some(c=>c.selected));
        if(next){groupId=next.id;message+=` 다음은 ${next.title}입니다.`;}
      }
      onUpdate();
    }catch(error){message=error.message;}
    finally{busy=false;render();host.querySelector('.choice-message')?.scrollIntoView({block:'nearest'});}
  }
  render();
}
