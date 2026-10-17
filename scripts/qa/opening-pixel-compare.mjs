// 오프닝 비교 뷰어 — 참조 캡처와 회차별 결과 컨택트 시트를 한 장의 자체완결 HTML 로 묶어 claude-viz 에 올린다.
// 그림은 data URI 로, 동영상은 같은 디렉터리 파일로 복사해 상대 경로로 참조한다(외부 CDN·절대경로 금지).
// 사용: node scripts/qa/opening-pixel-compare.mjs <out.html-name> --ref <dir> --run <name>=<outDir> [--run ...] [--title "..."]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const values = (n) => argv.flatMap((a, i) => (a === '--' + n ? [argv[i + 1]] : []));
const names = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--ref' && argv[i - 1] !== '--run' && argv[i - 1] !== '--title');
const [htmlName] = names;
if (!htmlName) throw Error('Usage: opening-pixel-compare.mjs <name> --ref <dir> --run <label>=<outDir> [--run ...]');
const viz = path.join(os.homedir(), 'claude-viz');
fs.mkdirSync(viz, { recursive: true });
const name = htmlName.replace(/\.html$/u, '');
const dataUri = (file) => (fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : null);
const copies = [];
const copyMedia = (file, label) => {
  if (!fs.existsSync(file)) return null;
  const target = `${name}-${label}`;
  fs.copyFileSync(file, path.join(viz, target));
  copies.push(target);
  return target;
};
const esc = (v) => String(v ?? '').replace(/[&<>]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const refDir = flag('ref');
const refSheets = refDir && fs.existsSync(refDir)
  ? fs.readdirSync(refDir).filter((f) => f.endsWith('.png')).sort().map((f) => ({ label: f, uri: dataUri(path.join(refDir, f)) }))
  : [];

const runs = values('run').map((spec) => {
  const at = spec.indexOf('=');
  const label = spec.slice(0, at), dir = path.resolve(spec.slice(at + 1));
  const record = fs.existsSync(path.join(dir, 'record.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'record.json'), 'utf8')) : {};
  const summary = fs.existsSync(path.join(dir, 'SUMMARY.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'SUMMARY.json'), 'utf8')) : null;
  const measure = fs.existsSync(path.join(dir, 'measure.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'measure.json'), 'utf8')) : null;
  const shotsRoot = path.join(dir, 'player-shots');
  const shots = fs.existsSync(shotsRoot) ? fs.readdirSync(shotsRoot).filter((f) => f.endsWith('.png')).sort() : [];
  return {
    label, dir, summary, measure,
    sheet: dataUri(path.join(dir, 'contact-sheet.png')),
    animatic: copyMedia(path.join(dir, 'opening-animatic.mp4'), `${label}-animatic.mp4`),
    player: copyMedia(path.join(dir, 'opening-player.webm'), `${label}-player.webm`),
    shotList: (record.shotList ?? []).map((s) => ({
      id: s.id, seconds: ((s.durationMs ?? 0) / 1000).toFixed(1),
      moves: (s.layers ?? []).filter((l) => l.region || l.glow || l.shaft || l.walk || l.emote).map((l) => `${l.id}(${l.region ?? (l.glow ? 'glow' : l.shaft ? 'shaft' : l.walk ? 'walk' : l.emote)})`).join(' '),
      caption: (s.caption ?? []).join(' / '),
    })),
    shots: shots.map((f) => ({ label: f, uri: dataUri(path.join(shotsRoot, f)) })),
    handoff: record.handoff ?? null, resourceFailures: record.resourceFailures ?? [], pageErrors: record.pageErrors ?? [],
    issues: summary?.issues ?? [],
  };
});

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(flag('title', name))}</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;background:#0b0d11;color:#e6e9ef;font:14px/1.55 system-ui,sans-serif}
 header{padding:20px 24px;border-bottom:1px solid #232833;position:sticky;top:0;background:#0b0d11ee;backdrop-filter:blur(6px);z-index:2}
 h1{margin:0 0 6px;font-size:20px}
 .meta{color:#98a2b3;font-size:13px}
 nav a{color:#9fd6c3;margin-right:14px;font-size:13px;text-decoration:none}
 main{padding:20px 24px;display:grid;gap:28px;max-width:1400px}
 section h2{font-size:15px;margin:0 0 10px;color:#9fd6c3;font-weight:600}
 section h3{font-size:13px;margin:16px 0 8px;color:#c8cdd6;font-weight:600}
 video{width:100%;background:#000;border:1px solid #232833;border-radius:6px}
 img.sheet{width:100%;border:1px solid #232833;border-radius:6px;image-rendering:pixelated}
 table{width:100%;border-collapse:collapse;font-size:12.5px}
 th,td{border-bottom:1px solid #232833;padding:6px 8px;text-align:left;vertical-align:top}
 th{color:#98a2b3;font-weight:500}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
 .grid img{width:100%;border:1px solid #232833;border-radius:4px}
 .note{color:#98a2b3;font-size:12px}
 .cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
 .pill{display:inline-block;border:1px solid #2c3441;border-radius:999px;padding:1px 8px;margin:0 6px 4px 0;font-size:12px;color:#c8cdd6}
 pre{white-space:pre-wrap;background:#0e1117;border:1px solid #232833;border-radius:6px;padding:10px;font-size:12px}
</style></head><body>
<header><h1>${esc(flag('title', name))}</h1>
<div class="meta">참조 ${refSheets.length}장 · 회차 ${runs.length}개</div>
<nav>${refSheets.length ? '<a href="#ref">참조 캡처</a>' : ''}${runs.map((r, i) => `<a href="#run${i}">${esc(r.label)}</a>`).join('')}</nav></header>
<main>
 ${refSheets.length ? `<section id="ref"><h2>참조: 실제 출하 오프닝 캡처 (crimson-oath intro)</h2>
 <div class="grid">${refSheets.map((s) => `<figure style="margin:0"><img src="${s.uri}" alt="${esc(s.label)}"><figcaption class="note">${esc(s.label)}</figcaption></figure>`).join('')}</div></section>` : ''}
 ${runs.map((r, i) => `<section id="run${i}"><h2>${esc(r.label)}</h2>
   ${r.summary ? `<div>${'<span class="pill">턴 ' + esc(r.summary.stats?.turns) + '</span>'}<span class="pill">도구 ${esc(r.summary.stats?.toolCalls)}</span><span class="pill">오류 ${esc(r.summary.stats?.toolErrors)}</span><span class="pill">모델 ${esc(r.summary.model)}</span><span class="pill">그림 ${esc(r.summary.imageModel)}</span></div>` : ''}
   ${r.measure ? `<h3>객관 측정 (measure.json)</h3><pre>${esc(JSON.stringify({ shots: r.measure.shotCount, totalSeconds: r.measure.totalSeconds, avgShotMs: r.measure.averageShotMs, minSimultaneousMotion: r.measure.minSimultaneousMotion, averageSimultaneousMotion: r.measure.averageSimultaneousMotion, transitions: r.measure.transitions, regionLoops: r.measure.regionLoops, walks: r.measure.walks, emoteLayers: r.measure.emoteLayers, captionColors: r.measure.captionColors, textSizes: r.measure.textSizes, nonIntegerSprites: r.measure.nonIntegerSprites }, null, 1))}</pre>` : ''}
   ${r.sheet ? `<h3>공용 렌더러 컨택트 시트</h3><img class="sheet" src="${r.sheet}" alt="contact sheet">` : '<p class="note">contact-sheet.png 없음</p>'}
   ${r.animatic ? `<h3>애니메틱 전체 재생 (mp4, 무음)</h3><video controls src="${r.animatic}"></video>` : ''}
   ${r.player ? `<h3>실제 출하 플레이어 (타이틀 → 오프닝 → 시작 맵 handoff, 무음)</h3><video controls src="${r.player}"></video>` : ''}
   ${r.shots.length ? `<h3>플레이어 단계 스크린샷</h3><div class="grid">${r.shots.map((s) => `<figure style="margin:0"><img src="${s.uri}" alt="${esc(s.label)}"><figcaption class="note">${esc(s.label)}</figcaption></figure>`).join('')}</div>` : ''}
   <h3>샷 표</h3><table><thead><tr><th>샷</th><th>길이</th><th>움직이는 것</th><th>자막</th></tr></thead><tbody>
   ${r.shotList.map((s) => `<tr><td>${esc(s.id)}</td><td>${esc(s.seconds)}s</td><td>${esc(s.moves) || '<span class="note">없음</span>'}</td><td>${esc(s.caption)}</td></tr>`).join('')}
   </tbody></table>
   <h3>기록</h3><pre>${esc(JSON.stringify({ handoff: r.handoff, resourceFailures: r.resourceFailures, pageErrors: r.pageErrors, issues: r.issues }, null, 1))}</pre>
 </section>`).join('')}
</main></body></html>`;
fs.writeFileSync(path.join(viz, `${name}.html`), html);
console.log(JSON.stringify({ html: path.join(viz, `${name}.html`), media: copies, url: `http://mdc-server:18301/${name}.html` }, null, 1));
