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
    return { attempt, dir, result: read(resolve(dir, 'result.json')), measure: read(resolve(dir, 'measure.json')) };
  });
}
function copy(run, attempt, file) {
  const target = `${run.label}-${attempt}-${file.replace(/\//g, '_')}`;
  copyFileSync(resolve(run.dir, attempt, file), resolve(assetDir, target));
  return `${name}/${target}`;
}

const summary = runs.map(run => {
  const all = seed.cases.flatMap(entry => attemptsOf(run, entry.id));
  const measured = all.filter(a => a.measure && ['machine-pass', 'machine-fail', 'no-map'].includes(a.measure.status));
  return { run, total: all.length, ran: all.filter(a => a.result).length, measured: measured.length,
    pass: measured.filter(a => a.measure.status === 'machine-pass').length, noMap: measured.filter(a => a.measure.status === 'no-map').length };
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
          return `<figure><a href="${src}" target="_blank"><img loading="lazy" src="${src}" style="width:${Math.min(m.render.width * 2, 640)}px"></a>
<figcaption>${esc(m.name)} · ${m.size.join('×')} · ${esc(m.tilesetId)} · NPC ${m.npcs}</figcaption><ul class="checks">${checks}</ul></figure>`;
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
<div class="hero">${s.measured ? `${s.pass}/${s.measured}` : '—'}</div><div class="sub">기계 검사 통과 (측정한 시도 기준) · 실행 ${s.ran}/${s.total} · 만든 맵 없음 ${s.noMap}</div></div>`).join('');
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
</style></head><body>
<h1>조수 공간 제작 비교 — 방 · 판타지 실내 · 현대 실내 · 무림</h1>
<p class="lead">같은 새 프로젝트에서 같은 자연어 요청을 실제 입력창으로 보냈습니다. 아래 ✓/✕는 <b>기계 검사</b>(칩셋 계열, 입구에서 모든 바닥 도달, 빈 바닥 비율·빈 정사각형, 좌우 복붙 대칭)일 뿐 「보기 좋다」는 뜻이 아닙니다. 그림을 직접 보고 판단해 주세요. 그림을 누르면 원본 크기로 열립니다.</p>
<div class="tiles">${tiles}</div>${done ? '' : '<p class="muted">아직 돌고 있습니다 — 2분마다 새로 고칩니다.</p>'}
${sections}</body></html>`;
writeFileSync(resolve(vizRoot, `${name}.html`), html);
console.log(`sheet → http://mdc-server:18301/${name}.html`);
