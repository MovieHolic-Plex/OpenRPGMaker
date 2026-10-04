const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageUrl = (im, width=1000) => `/thumb?p=${encodeURIComponent(im.path)}&w=${width}&v=${im.v}`;

export function renderChoices(host, initial, onUpdate, enlarge) {
  let state = initial, busy = false, message = '';
  const active = {}, frame = {};
  function render() {
    const working = ['art', 'art-layout-review', 'art-context-review'].includes(state.stage);
    const workLabel = state.stage === 'art-layout-review' ? '제작 전 배치·비례·여백 검수' : state.stage === 'art-context-review' ? '조립 예시 독립 검수' : `피드백 반영 재생성 ${state.revision || 1}차`;
    host.innerHTML = `<h1>${esc(state.title)}</h1>
      <p class="choice-lead">${working ? `${workLabel} ${state.status === 'running' ? '진행 중' : '대기'}` : state.blocked ? '고를 수 있는 수준까지 후보를 고쳐야 합니다.' : state.complete ? '칩 선택을 저장했습니다.' : '예시를 보고 사용할 칩을 골라 주세요.'}</p>
      <div class="choice-steps" aria-label="제작 진행"><span class="done">1 기획·검수 완료</span><span class="current">2 ${working ? workLabel : state.blocked ? '조립 예시 수정 필요' : state.complete ? '칩 선택 완료' : '내 칩 선택'}</span><span>3 공용 등록·조립 연결</span><span>4 맵 제작·검수</span></div>
      <div class="choice-notice">${working ? '검수 지적을 다음 제작의 수정 지시로 저장했습니다. 수정 후보를 만들고 같은 기준으로 다시 검수합니다. 통과한 뒤 사람이 선택합니다.' : state.blocked ? '현재는 선택할 수 있는 후보가 없는 항목이 있습니다. 부품 검수와 조립 예시 검수를 통과한 뒤 선택할 수 있습니다. 아래 예시와 수정 이유를 확인하세요.' : state.complete ? '다음 작업: 선택한 칩의 공용 등록과 조립 연결이 필요합니다. 이 화면에서 자동 등록·맵 제작까지 실행되지는 않습니다.' : '① 후보 이름을 눌러 비교 → ② 예시와 검수 결과 확인 → ③ 이 후보 선택. 선택은 바로 저장되며 다른 후보로 바꿀 수 있습니다.'}
      <div>${working ? (state.paused ? '전체 자동 실행이 멈춰 있어 새 작업은 시작되지 않습니다.' : '자동 처리 중입니다. 후보별 수정 상한을 넘으면 사람 확인으로 전환합니다.') : state.paused ? (state.blocked ? '전체 자동 실행은 멈춰 있습니다. 후보 수정도 아직 실행 중이 아닙니다.' : '전체 자동 실행은 멈춰 있습니다. 후보 보기와 선택 저장은 가능합니다.') : '선택한 뒤에도 공용 등록과 재료 승인이 끝나야 맵을 만듭니다.'}</div></div>
      <p class="choice-progress">${esc(state.note)} · 자동 수정 ${Number(state.revision || 0)} / ${Number(state.maxRevisions || 5)}회</p>
      ${state.repairPolicy?.phase === 'calibration' ? '<p class="choice-progress">형태·시점 명세 재설계 → 작은 시점 표본 검수 → 공간 재조립 검수</p>' : ''}
      <p class="choice-progress">${state.selectedCount} / ${state.total}개 선택 완료</p>
      <p role="status" class="choice-message">${esc(message)}</p><div class="choice-groups"></div>`;
    if (!state.groups.length) {
      host.querySelector('.choice-groups').textContent = '선택용 예시를 아직 준비하지 못했습니다. 아래 제작 기록에서 현재 그림을 확인할 수 있습니다.'; return;
    }
    for (const group of state.groups) {
      const candidate = group.candidates.find(c => c.id === active[group.id]) || group.candidates.find(c => c.selected) || group.candidates.find(c => c.eligible) || group.candidates[0];
      active[group.id] = candidate.id;
      const section = document.createElement('section'); section.className = 'choice-group';section.dataset.group = group.id;
      const idx = Math.min(frame[group.id] || 0, Math.max(0,candidate.images.length-1));
      const im = candidate.images[idx];
      section.innerHTML = `<h2>${esc(group.title)}</h2><p>${esc(group.description)}</p>
        ${group.staleSelection ? '<p class="choice-error">이전에 고른 그림이 바뀌었습니다. 새 후보를 확인하고 다시 골라 주세요.</p>' : ''}
        <div class="candidate-tabs" role="group" aria-label="${esc(group.title)} 후보">${group.candidates.map(c => `<button data-candidate="${esc(c.id)}" aria-pressed="${c.id===candidate.id}"><b>${esc(c.title)}</b><span>${c.selected ? '✓ 선택됨' : c.stale ? '그림 변경됨' : c.eligible ? '검수 통과' : '수정 필요'}</span></button>`).join('')}</div>
        <div class="choice-toolbar"><strong>${esc(candidate.title)} · ${candidate.selected ? '선택됨' : esc(candidate.summary)}</strong>
        <div class="choice-states" role="group" aria-label="예시 상태">${candidate.images.map((r,i)=>`<button data-frame="${i}" aria-pressed="${i===idx}">${esc(r.label)}</button>`).join('')}</div></div>
        ${im ? `<button class="scene-open" aria-label="${esc(group.title+' '+candidate.title)} 예시 확대"><img class="choice-scene" src="${imageUrl(im)}" alt="${esc(candidate.title+' '+im.label)}"></button>` : '<p class="choice-error">그림이 바뀌어 예시를 표시할 수 없습니다. 새 후보 준비가 필요합니다.</p>'}
        <p class="choice-caption">${esc(candidate.caution)} 그림을 누르면 확대됩니다.</p>
        ${candidate.reasons.length ? `<details class="choice-reasons" ${state.blocked ? 'open' : ''}><summary>선택할 수 없는 이유 · 검수 지적 ${candidate.reasons.length}건</summary><ul>${candidate.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
        <div class="choice-actions"><button class="primary choose-candidate" ${busy || !candidate.eligible || candidate.selected ? 'disabled' : ''}>${busy ? '저장 중…' : candidate.selected ? '✓ 선택 저장됨' : `${esc(candidate.title)} 선택`}</button>${candidate.selected ? '<button class="clear-choice">선택 취소</button>' : ''}${candidate.sheet ? '<button class="show-sheet">원본 칩 보기</button>' : ''}<span>${candidate.eligible ? '선택 후에도 변경할 수 있습니다.' : '검수 통과 후 선택할 수 있습니다.'}</span></div>`;
      section.insertBefore(section.querySelector('.choice-actions'), section.querySelector('.scene-open') || section.querySelector('.choice-caption'));
      section.querySelectorAll('[data-candidate]').forEach(b => b.onclick = () => {active[group.id]=b.dataset.candidate;frame[group.id]=0;render();});
      section.querySelectorAll('[data-frame]').forEach(b => b.onclick = () => {frame[group.id]=Number(b.dataset.frame);render();});
      section.querySelector('.scene-open')?.addEventListener('click',()=>enlarge(imageUrl(im,1600)));
      section.querySelector('.show-sheet')?.addEventListener('click',()=>enlarge(imageUrl(candidate.sheet,1600)));
      section.querySelector('.clear-choice')?.addEventListener('click', async () => {
        if(busy)return; busy=true; render();
        try {
          const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clear-art',cid:state.id,group:group.id})});
          const result=await r.json(); if(!r.ok || !result.ok)throw new Error(result.error || '취소하지 못했습니다.');
          state=result.choices;message=group.title+' 선택을 취소했습니다.';onUpdate();
        }catch(error){message=error.message;}finally{busy=false;render();}
      });
      section.querySelector('.choose-candidate').onclick = async () => {
        if (busy || !candidate.eligible || candidate.selected) return;
        busy=true;message='선택을 저장하는 중…';render();
        try {
          const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'choose-art',cid:state.id,group:group.id,candidate:candidate.id,fingerprint:candidate.fingerprint})});
          const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || '저장하지 못했습니다. 다시 시도해 주세요.');
          state=result.choices;message=`${group.title} · ${candidate.title} 선택을 저장했습니다.`;onUpdate();
        }catch(error){message=error.message;}
        finally{busy=false;render();}
      };
      host.querySelector('.choice-groups').append(section);
    }
  }
  render();
}
