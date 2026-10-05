// Keyword input stays mounted while progress refreshes, preserving typing/focus.
export function mountKeywordSeeds(host, changed, enlarge) {
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
      <div class="seed-title"><button data-filter="${esc(s.id)}" aria-pressed="${active===s.id}">${s.priority?"우선 제작 · ":""}${esc(s.keyword)} · 공간 ${s.concepts.length}개 보기</button><button data-seed="${esc(s.id)}" data-action="${s.active?'pause':'resume'}-seed" ${busy?'disabled':''}>${s.active?'새 공간 추가 중지':'계속 추가하기'}</button></div>
      <p>${esc(s.label)}</p>${s.production?`<p><strong>${s.production.mode==="dedicated"?"세계관 전체 기획":"기존 키트 확장"}</strong> · ${esc(s.production.reason)}</p>`:""}${s.conceptArt?.image?`<section aria-label="컨셉아트"><button data-concept-image="${esc(s.id)}" style="display:block;width:100%;padding:0;background:transparent" aria-label="${esc(s.keyword)} 컨셉아트 확대"><img src="/data/${esc(s.conceptArt.image.path)}" alt="${esc(s.keyword)} 미술 방향 시안" style="display:block;width:100%;max-height:420px;object-fit:contain"></button><p>미술 방향 시안입니다. 완성된 게임 맵은 아닙니다. 클릭하면 확대합니다.</p><p>${esc(s.conceptArt.label)}</p>${s.conceptArt.reasons?.length?`<p class="seed-error">${esc(s.conceptArt.reasons.join(" · "))}</p>`:""}<button data-concept-seed="${esc(s.id)}" data-decision="allow" ${!s.conceptArt.canAllow||busy?"disabled":""}>Allow · 이 방향으로 제작</button> <button data-concept-seed="${esc(s.id)}" data-decision="deny" ${busy?"disabled":""}>Deny · 다른 시안</button></section>`:""}${s.theme?`<p><strong>전용 세트 제작</strong> · ${esc(s.theme.label)}</p><p><small>건축 · 바닥 · 가구 · 식생 · 인물 · 생물 · 탈것 · 효과를 함께 기획합니다. 기존 그림으로 자동 대체하지 않습니다.</small></p>${s.theme.error?`<p class="seed-error">${esc(s.theme.error)}</p>`:""}`:""}<small>기획 ${s.wave}차 · 검수/선택 단계 ${s.review} · 완성 ${s.done}${s.blocked?' · 수정 점검 '+s.blocked:''}</small>
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
      message.textContent=body.action==='theme-concept-decision'?(body.decision==='allow'?'미술 방향을 저장했습니다. 전용 세트 제작을 이어갑니다.':'다른 컨셉아트 제작 요청을 저장했습니다.'):body.action==='pause-seed'?'새 공간 추가를 중지했습니다. 시작한 공간은 데모까지 계속 제작합니다.':body.action==='resume-seed'?'새 공간 추가를 다시 켰습니다.':'키워드를 저장했습니다. 관련 공간과 데모가 아래에 모입니다.';
      message.dataset.receipt='1';
    } catch(error) {message.textContent=error.message;}
    finally {busy=false;button.disabled=false;await refresh();paint();}
  }
  form.onsubmit=e=>{e.preventDefault();const keyword=form.elements.keyword.value.trim();if(keyword)act({action:'start-seed',keyword});};
  list.onclick=e=>{const el=e.target.closest('button');if(!el)return;if(el.dataset.conceptImage){const s=items.find(s=>s.id===el.dataset.conceptImage);enlarge('/data/'+s.conceptArt.image.path,s.keyword+' 컨셉아트');return;}if(el.dataset.conceptSeed){const s=items.find(s=>s.id===el.dataset.conceptSeed);act({action:'theme-concept-decision',seed:s.id,sha256:s.conceptArt.image.sha256,briefSha256:s.conceptArt.image.briefSha256,decision:el.dataset.decision});return;}if(el.hasAttribute('data-filter')){active=el.dataset.filter;paint();changed(items,active,true);}else if(el.dataset.action)act({action:el.dataset.action,seed:el.dataset.seed});};
  refresh();setInterval(refresh,5000);
}
