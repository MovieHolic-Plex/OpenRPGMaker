// 비교 시트: 카테고리 → 과제 → (모델 × 반복) 그림과 기계 지표. 자체완결 HTML + 같은 폴더의 그림 사본.
//   node src/harnesses/space-craft/node/sheet.mjs --runs gpt=<dir>,gemini=<dir> --name <시트 이름>
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const runs = (option('runs') ?? '').split(',').filter(Boolean).map(pair => { const [label, dir] = pair.split('='); return { label, dir: resolve(dir) }; });
if (!runs.length) throw Error('--runs gpt=<dir>,gemini=<dir>');
const name = option('name', 'space-craft');
const seed = JSON.parse(readFileSync(resolve('harness-data/space-craft/seed.json'), 'utf8'));
const vizRoot = resolve(homedir(), 'claude-viz'), assetDir = resolve(vizRoot, name);
mkdirSync(assetDir, { recursive: true });
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = file => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7'];

function attemptsOf(run, caseId) {
  if (!existsSync(run.dir)) return [];
  return readdirSync(run.dir).filter(d => d.startsWith(`${caseId}-r`)).sort().map(attempt => {
    const dir = resolve(run.dir, attempt);
    return { attempt, dir, result: read(resolve(dir, 'result.json')), measure: read(resolve(dir, 'measure.json')), judge: read(resolve(dir, 'judge.json')) };
  });
}
function copy(run, attempt, file) {
  const target = `${run.label}-${attempt}-${file.replace(/\//g, '_')}`;
  copyFileSync(resolve(run.dir, attempt, file), resolve(assetDir, target));
  return `${name}/${target}`;
}


/** 시트 안 사람 판정 — 이 브라우저(localStorage)에 저장하고, 판정자와 1점 안으로 맞은 비율을 위 띠에 바로 보인다. */
function humanLabels(KEY) {
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const HUMAN = { good: 4.5, ok: 3, bad: 1.5 };
  function paint() {
    const labels = load();
    let n = 0; const hit = { gpt: [0, 0], gemini: [0, 0] };
    document.querySelectorAll('.human').forEach(el => {
      const v = labels[el.dataset.key];
      el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
      if (!v) return; n++;
      for (const j of ['gpt', 'gemini']) { const s = parseFloat(el.dataset[j]); if (Number.isNaN(s)) continue; hit[j][1]++; if (Math.abs(s - HUMAN[v]) <= 1) hit[j][0]++; }
    });
    const bar = document.getElementById('agree');
    bar.innerHTML = n
      ? '사람 판정 ' + n + '개 · 판정자가 사람과 1점 안으로 맞은 수: GPT ' + hit.gpt[0] + '/' + hit.gpt[1] + ' · Gemini ' + hit.gemini[0] + '/' + hit.gemini[1] + ' <button id="copy">판정 복사</button>'
      : '사람 판정 0개 — 그림마다 좋다/보통/별로를 눌러 주세요(이 브라우저에 저장됩니다)';
    const copy = document.getElementById('copy');
    if (copy) copy.onclick = () => navigator.clipboard.writeText(JSON.stringify(load())).then(() => { copy.textContent = '복사됨'; });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.human button'); if (!b) return;
    const labels = load(); const key = b.parentElement.dataset.key;
    if (labels[key] === b.dataset.v) delete labels[key]; else labels[key] = b.dataset.v;
    localStorage.setItem(KEY, JSON.stringify(labels)); paint();
  });
  paint();
}

const JUDGE_LABEL = { gpt: 'GPT 판정자', gemini: 'Gemini 판정자' };
/** 원본 그림에 대한 판정자별 규칙 점수·감점 사유·결함. 보정 사본(가구 빼기·밀기) 점수도 작게 보인다. */
function judgeOf(a, mapId) {
  const entry = a.judge?.maps?.find(m => m.mapId === mapId);
  if (!entry) return { html: '', scores: {} };
  const scores = {};
  const parts = Object.keys(JUDGE_LABEL).map(id => {
    const original = entry.verdicts.find(v => v.judge === id && v.variant === 'original');
    if (!original) return '';
    const score = original.score?.overall;
    scores[id] = score;
    const calib = ['stripped', 'shifted'].map(kind => entry.verdicts.find(v => v.judge === id && v.variant === kind)?.score?.overall).filter(n => n !== undefined);
    const parsed = original.parsed ?? {};
    const tone = score === undefined ? 'muted' : score >= 4 ? 'good' : score >= 3 ? '' : 'bad';
    return `<div class="jv"><b>${JUDGE_LABEL[id]}</b> <span class="${tone} score">${score ?? '판정 실패'}</span>
${original.score?.caps?.length ? `<span class="caps">${esc(original.score.caps.join(' · '))}</span>` : ''}
<span class="calib" title="같은 맵을 망가뜨린 사본 점수(가구 빼기·가구 밀기). 원본보다 낮아야 판정자를 믿는다">사본 ${calib.join(' / ')}</span>
<p class="jsum">${esc(parsed.summary ?? '')}</p>${(parsed.defects ?? []).filter(Boolean).length ? `<ul class="defects">${parsed.defects.filter(Boolean).map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</div>`;
  }).join('');
  const values = Object.values(scores).filter(n => typeof n === 'number');
  const split = values.length === 2 && Math.abs(values[0] - values[1]) >= 1.5;
  return { html: `<div class="judges${split ? ' split' : ''}">${split ? '<p class="bad">판정자 의견 갈림 — 사람 판정이 필요합니다</p>' : ''}${parts}</div>`, scores };
}

const summary = runs.map(run => {
  const all = seed.cases.flatMap(entry => attemptsOf(run, entry.id));
  const measured = all.filter(a => a.measure && ['machine-pass', 'machine-fail', 'no-map'].includes(a.measure.status));
  return { run, total: all.length, ran: all.filter(a => a.result).length, measured: measured.length,
    pass: measured.filter(a => a.measure.status === 'machine-pass').length, noMap: measured.filter(a => a.measure.status === 'no-map').length,
    // 판정 평균: 두 판정자 평균을 과제마다 내고, 맵이 없는 과제는 0점으로 센다(못 만든 것도 결과다).
    judged: all.filter(a => a.judge || a.measure?.status === 'no-map' || a.measure?.status === 'not-measured').length,
    judgeMean: (() => {
      const per = all.map(a => {
        if (a.measure?.status === 'no-map' || a.measure?.status === 'not-measured' || a.result?.status === 'harness-error') return 0;
        const v = (a.judge?.maps ?? []).flatMap(m => m.verdicts.filter(x => x.variant === 'original').map(x => x.score?.overall)).filter(n => typeof n === 'number');
        return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
      }).filter(n => n !== null);
      return per.length ? Math.round(per.reduce((x, y) => x + y, 0) / per.length * 10) / 10 : null;
    })() };
});

const sections = Object.entries(seed.categories).map(([categoryId, category]) => {
  const rows = seed.cases.filter(entry => entry.category === categoryId).map(entry => {
    const columns = runs.map((run, index) => {
      const cells = attemptsOf(run, entry.id).map(a => {
        if (!a.result) return `<div class="cell muted">${esc(a.attempt)} · 아직 안 돌림</div>`;
        if (a.result.status === 'harness-error') return `<div class="cell"><b>${esc(a.attempt)}</b> <span class="bad">! 실행 오류(모델 무관 가능)</span><p class="why">${esc(a.result.failure)}</p></div>`;
        const maps = a.measure?.maps ?? [];
        const stats = a.result.stats ?? {};
        const head = `<b>${esc(a.attempt)}</b> ${a.measure ? ({ 'machine-pass': '<span class="good">✓ 기계 검사 통과</span>', 'machine-fail': '<span class="bad">✕ 기계 검사 실패</span>', 'no-map': '<span class="bad">✕ 만든 맵 없음</span>' }[a.measure.status] ?? '') : '<span class="muted">… 측정 전</span>'}`;
        const meta = `<p class="meta">${Math.round((stats.ms ?? a.result.elapsedMs ?? 0) / 1000)}초 · 도구 ${stats.toolCalls ?? '—'}회(오류 ${stats.toolErrors ?? '—'}) · 토큰 ${stats.usage?.totalTokens ? Math.round(stats.usage.totalTokens / 1000) + 'k' : '—'}${a.result.persistence?.reloadEqual === false ? ' · <span class="bad">재로드 불일치</span>' : ''}</p>`;
        const mapHtml = maps.map(m => {
          const src = copy(run, a.attempt, m.render.file);
          const checks = m.checks.map(c => `<li class="${c.ok ? 'good' : c.advisory ? 'note' : 'bad'}">${c.ok ? '✓' : c.advisory ? '·' : '✕'} ${esc(c.detail)}</li>`).join('');
          const judged = judgeOf(a, m.mapId);
          const key = `${run.label}|${a.attempt}|${m.mapId}`;
          const human = `<div class="human" data-key="${esc(key)}" data-gpt="${judged.scores.gpt ?? ''}" data-gemini="${judged.scores.gemini ?? ''}">사람 판정 <button data-v="good">좋다</button><button data-v="ok">보통</button><button data-v="bad">별로</button></div>`;
          return `<figure><a href="${src}" target="_blank"><img loading="lazy" src="${src}" style="width:${Math.min(m.render.width * 2, 640)}px"></a>
<figcaption>${esc(m.name)} · ${m.size.join('×')} · ${esc(m.tilesetId)} · NPC ${m.npcs}</figcaption>${human}${judged.html}<details><summary>기계 검사</summary><ul class="checks">${checks}</ul></details></figure>`;
        }).join('');
        return `<div class="cell">${head}${meta}${mapHtml}<details><summary>조수 답</summary><blockquote>${esc(a.result.answer || '(답 없음)')}</blockquote>
<p class="tools">${esc((a.result.tools ?? []).map(t => t.name + (t.ok ? '' : '✕')).join(' → '))}</p></details></div>`;
      }).join('');
      return `<div class="arm" style="--c:${COLORS[index % COLORS.length]}"><h4><i></i>${esc(run.label)}</h4>${cells || '<p class="muted">시도 없음</p>'}</div>`;
    }).join('');
    return `<section class="case"><h3>${esc(entry.id)}</h3><p class="prompt">「${esc(entry.prompt)}」 · 시작 칩셋 ${esc(entry.startTileset)}</p><div class="arms">${columns}</div></section>`;
  }).join('');
  return `<h2>${esc(category.label)}${category.note ? ` <small>${esc(category.note)}</small>` : ''}</h2>${rows}`;
}).join('');

const tiles = summary.map((s, i) => `<div class="tile" style="--c:${COLORS[i % COLORS.length]}"><div class="tname"><i></i>${esc(s.run.label)}</div>
<div class="hero">${s.judgeMean ?? '—'}<small> / 5</small></div><div class="sub">그림 판정 평균(두 판정자 평균, 맵 못 만든 과제 0점) · 기계 검사 통과 ${s.pass}/${s.measured} · 만든 맵 없음 ${s.noMap}</div></div>`).join('');
const done = summary.every(s => s.measured === s.total && s.total > 0);
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>조수 공간 제작 비교</title>${done ? '' : '<meta http-equiv="refresh" content="120">'}<style>
:root{color-scheme:light;--s1:#fcfcfb;--s2:#f1f0ec;--t1:#0b0b0b;--t2:#52514e;--mu:#8a8984;--rule:#e2e1dc;--good:#006300;--bad:#c02f2f}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--s1:#1a1a19;--s2:#252523;--t1:#fff;--t2:#c3c2b7;--mu:#8f8e86;--rule:#3a3a37;--good:#0ca30c;--bad:#e66767}}
body{margin:0;background:var(--s1);color:var(--t1);font:14px/1.5 system-ui,"Noto Sans KR",sans-serif;padding:24px clamp(12px,3vw,40px)}
h1{font-size:21px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 6px;border-bottom:2px solid var(--rule)}h2 small{font-weight:400;color:var(--t2);font-size:13px}h3{font-size:15px;margin:0}
.lead{color:var(--t2);max-width:80ch}.tiles{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0}
.tile{border:1px solid var(--rule);border-top:4px solid var(--c);border-radius:8px;padding:10px 16px;min-width:240px}
.tname{font-weight:600;display:flex;gap:6px;align-items:center}.tname i,.arm h4 i{width:10px;height:10px;border-radius:2px;background:var(--c);display:inline-block}
.hero{font-size:38px;font-weight:700;font-variant-numeric:tabular-nums}.sub{color:var(--t2);font-size:12.5px}
.case{padding:14px 0;border-bottom:1px solid var(--rule)}.prompt{color:var(--t2);margin:2px 0 8px}
.arms{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px}.arm{border-left:3px solid var(--c);padding-left:12px}
.arm h4{margin:0 0 6px;display:flex;gap:6px;align-items:center}.cell{margin:0 0 14px}.meta{color:var(--t2);font-size:12.5px;margin:2px 0}
figure{margin:6px 0}img{image-rendering:pixelated;max-width:100%;border:1px solid var(--rule);display:block}figcaption{font-size:12px;color:var(--mu)}
.checks{list-style:none;padding:0;margin:4px 0;font-size:12.5px}.good{color:var(--good)}.bad{color:var(--bad);font-weight:600}.muted{color:var(--mu)}.note{color:var(--mu)}
.why{font-size:12px;color:var(--t2);word-break:break-all}blockquote{margin:4px 0;padding:6px 10px;background:var(--s2);border-radius:6px;white-space:pre-wrap;font-size:13px}
.tools{font:11.5px ui-monospace,monospace;color:var(--mu);word-break:break-all}
.hero small{font-size:15px;color:var(--mu);font-weight:400}.judges{margin:6px 0;display:grid;gap:6px}.judges.split{outline:2px solid var(--bad);outline-offset:4px;border-radius:4px}
.jv{background:var(--s2);border-radius:6px;padding:6px 10px;font-size:12.5px}.score{font-size:17px;font-weight:700;margin:0 6px}.caps{color:var(--bad)}.calib{color:var(--mu);margin-left:8px;font-size:11.5px}
.jsum{margin:2px 0}.defects{margin:2px 0;padding-left:18px;color:var(--t2)}
.human{margin:6px 0;font-size:12.5px;display:flex;gap:6px;align-items:center}.human button{font:inherit;padding:3px 10px;border:1px solid var(--rule);border-radius:5px;background:var(--s1);color:var(--t1);cursor:pointer}
.human button.on[data-v=good]{background:#0ca30c;color:#fff}.human button.on[data-v=ok]{background:#c98a00;color:#fff}.human button.on[data-v=bad]{background:#c02f2f;color:#fff}
.agree{position:sticky;top:0;background:var(--s1);border:1px solid var(--rule);border-radius:8px;padding:8px 14px;margin:10px 0;z-index:2;font-size:13.5px}.agree button{font:inherit;margin-left:8px}
</style></head><body>
<h1>조수 공간 제작 비교 — ${esc(Object.values(seed.categories).map(c => c.label).join(' · '))}</h1>
<p class="lead">같은 새 프로젝트에서 같은 자연어 요청을 실제 입력창으로 보냈습니다(모델마다 과제당 1회). 그림을 누르면 원본 크기로 열립니다.</p>
<div class="tiles">${tiles}</div>${done ? '' : '<p class="muted">아직 돌고 있습니다 — 2분마다 새로 고칩니다.</p>'}
<p class="lead"><b>판정자</b>: 두 비전 모델이 같은 그림을 보고 「벽에 붙을 것이 벽에 있나·방 밖으로 튀어나온 것·잘린 것·문 앞 막힘·방이 맵을 채우나·필수 물건·빈 바닥」을 예/아니오로 답하고, 종합 점수는 코드가 규칙으로 냅니다(구조 위반이면 2점 이하 등). 판정자를 믿을 수 있는지 보려고 같은 맵의 가구를 빼거나 밀어 망가뜨린 사본도 보여 주었고, 두 판정자 모두 사본을 원본보다 낮게 매겼습니다(22/22). 그래도 <b>미감은 사람 판정이 기준</b>입니다 — 아래 단추를 누르면 판정자와 얼마나 맞는지 위 띠에 바로 나옵니다.</p>
<div class="agree" id="agree">사람 판정 0개</div>
${sections}<script>(${humanLabels.toString()})(${JSON.stringify(`space-craft-labels:${name}`)});</script></body></html>`;
writeFileSync(resolve(vizRoot, `${name}.html`), html);
console.log(`sheet → http://mdc-server:18301/${name}.html`);
