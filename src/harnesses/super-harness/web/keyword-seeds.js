// Keyword input stays mounted while progress refreshes, preserving typing/focus.
export function mountKeywordSeeds(host, changed) {
  host.innerHTML = `<h2>키워드 하나로 공간을 계속 만들어 보세요.</h2>
    <p>관련 공간 기획 → 필요한 타일 제작 → 전체 공간 데모 → 검수까지 이어집니다. 나온 그림을 보고 Allow / Deny만 하세요.</p>
    <form><label for="seed-keyword">어떤 세계를 만들까요?</label><div class="seed-input"><input id="seed-keyword" name="keyword" maxlength="200" required placeholder="예: 조선시대 항구, 폐쇄된 우주정거장, 마법학교" autocomplete="off"><button type="submit" disabled>이 키워드로 계속 만들기</button></div></form>
    <p class="seed-message" role="status" aria-live="polite">키워드 제작 연결을 확인하고 있습니다…</p>
    <div class="seed-streams"></div>
    <small>6개씩 제안합니다. 제작·확인 중인 공간이 12개 쌓이면 새 제안만 기다리고, 처리되면 계속 추가합니다. 하루 상한은 없습니다.</small>`;
  const form = host.querySelector('form'), button = form.querySelector('button');
  const message = host.querySelector('.seed-message'), list = host.querySelector('.seed-streams');
  let active = '', items = [], busy = false, refreshing = false, key = '';
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paint = () => {
    const next = JSON.stringify([items,active,busy]);
    if (key === next) return;
    key = next;
    list.innerHTML = items.length ? `<button data-filter="" aria-pressed="${!active}">모든 공간 보기</button>` + items.map(s => `<article>
      <div class="seed-title"><button data-filter="${esc(s.id)}" aria-pressed="${active===s.id}">${esc(s.keyword)} · 공간 ${s.concepts.length}개 보기</button><button data-seed="${esc(s.id)}" data-action="${s.active?'pause':'resume'}-seed" ${busy?'disabled':''}>${s.active?'새 공간 추가 중지':'계속 추가하기'}</button></div>
      <p>${esc(s.label)}</p><small>기획 ${s.wave}차 · 검수/선택 단계 ${s.review} · 완성 ${s.done}${s.blocked?' · 수정 점검 '+s.blocked:''}</small>
      ${s.error?`<p class="seed-error">공간 제안 오류: ${esc(s.error)}${s.errors>=3?' · 3회 실패해 새 추가를 멈췄습니다. 기존 공간과 그림은 보존됩니다.':''}</p>`:''}</article>`).join('') : '';
  };
  async function refresh() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    try {
      const r = await fetch('/api/seeds', {signal:AbortSignal.timeout(8000)});
      if (!r.ok) throw Error('키워드 제작 서버에 연결하지 못했습니다. 잠시 후 자동으로 다시 확인합니다.');
      const data = await r.json();
      if (!Array.isArray(data.items)) throw Error('키워드 제작 응답을 확인하지 못했습니다.');
      items = data.items;
      button.disabled = busy;
      if (!busy && (!message.dataset.receipt || !data.schedulerOnline)) message.textContent = data.schedulerOnline ? '키워드를 입력하면 자동으로 시작합니다. 같은 키워드는 기존 흐름을 이어서 봅니다.' : '제작 실행기 연결 대기 · 키워드는 저장되며 실행기가 연결되면 시작합니다.';
      paint(); changed(items,active);
    } catch(error) { message.textContent=error.message;button.disabled=true; }
    finally { refreshing=false; }
  }
  async function act(body) {
    if(busy)return;
    busy=true;button.disabled=true;paint();
    try {
      const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
      const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'요청을 저장하지 못했습니다.');
      if(body.action==='start-seed'){active=data.seed;form.reset();}
      message.textContent=body.action==='pause-seed'?'새 공간 추가를 중지했습니다. 시작한 공간은 데모까지 계속 제작합니다.':body.action==='resume-seed'?'새 공간 추가를 다시 켰습니다.':'키워드를 저장했습니다. 관련 공간과 데모가 아래에 모입니다.';
      message.dataset.receipt='1';
    } catch(error) {message.textContent=error.message;}
    finally {busy=false;button.disabled=false;await refresh();paint();}
  }
  form.onsubmit=e=>{e.preventDefault();const keyword=form.elements.keyword.value.trim();if(keyword)act({action:'start-seed',keyword});};
  list.onclick=e=>{const el=e.target.closest('button');if(!el)return;if(el.hasAttribute('data-filter')){active=el.dataset.filter;paint();changed(items,active,true);}else if(el.dataset.action)act({action:el.dataset.action,seed:el.dataset.seed});};
  refresh();setInterval(refresh,5000);
}
