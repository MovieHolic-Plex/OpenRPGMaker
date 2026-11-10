// 작은 일 실행 결과(summary.json)를 자체완결 HTML 한 장으로. 바깥 CDN·스크립트 없음.
// 원인별 묶음은 실행 폴더의 causes.json(사람이 결과를 읽고 쓴 것: [{ title, why, jobs:[id…] }])이 있으면 그것을 쓰고,
// 없으면 통과하지 못한 일을 까닭 글 그대로 나열한다 — 원인을 지어내지 않는다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { JobResult } from './run';
import { loadSuite } from './suite';

const esc = (text: unknown): string => String(text ?? '').replace(/[&<>"]/gu, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const minutes = (ms: number): string => (ms / 60_000).toFixed(1);
const kilo = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : String(n));
const STATUS: Record<string, string> = { pass: '통과', fail: '불합격', timeout: '시간 초과', infra: '기반 오류' };
const badge = (status: string): string => `<span class="badge ${status}">${STATUS[status] ?? status}</span>`;

function traceHtml(result: JobResult): string {
  if (!result.trace.length) return '<p class="muted">도구 호출 없음</p>';
  const rows = result.trace.map((step, index) => `<li class="${step.ok ? '' : 'bad'}"><b>${index + 1}. ${esc(step.name)}</b> ${step.ok ? '✓' : '✗ 거절·실패'}${step.args && step.args !== '{}' ? `<code>${esc(step.args.slice(0, 220))}</code>` : ''}${!step.ok || index === result.trace.length - 1 ? `<span class="res">${esc(step.result.slice(0, 320))}</span>` : ''}</li>`);
  return `<ol class="trace">${rows.join('')}</ol>`;
}
const callLine = (result: JobResult): string => result.toolCalls.map(call => `${esc(call.name)}${call.ok ? '' : '✗'}`).join(' → ') || '(호출 없음)';

function jobRow(result: JobResult): string {
  return `<tr class="${result.status}"><td><b>${esc(result.id)}</b><div class="req">${esc(result.request)}</div></td><td>${badge(result.status)}</td>` +
    `<td class="why">${esc(result.reason)}<details><summary>호출 순서 · 조수의 마지막 말</summary><p class="calls">${callLine(result)}</p>${traceHtml(result)}<p class="answer">${esc(result.answer.slice(0, 900))}</p></details></td>` +
    `<td>${result.complete === null ? '-' : result.complete ? '완료' : '<span class="muted">미완료</span>'}</td><td class="num">${result.toolCallCount}${result.toolErrors ? `<span class="err"> ✗${result.toolErrors}</span>` : ''}</td><td class="num">${minutes(result.wallMs)}</td>` +
    `<td class="num">${kilo(result.tokens.input + result.tokens.cacheRead)} / ${kilo(result.tokens.output)}</td><td class="num">${result.systemPromptChars === null ? '-' : result.systemPromptChars.toLocaleString('en')}</td><td class="num">${result.toolsOffered ?? '-'}</td></tr>`;
}

export function writeSmallJobsReport(options: { run?: string; html?: string }): number {
  if (!options.run) throw Error('small-jobs-report --run <실행 폴더> [--html <출력.html>]');
  const run = resolve(options.run);
  const summary = JSON.parse(readFileSync(resolve(run, 'summary.json'), 'utf8'));
  const suite = loadSuite();
  const results: JobResult[] = summary.jobs;
  const causes: Array<{ title: string; why: string; jobs: string[] }> = existsSync(resolve(run, 'causes.json')) ? JSON.parse(readFileSync(resolve(run, 'causes.json'), 'utf8')) : [];
  const byId = new Map(results.map(result => [result.id, result]));
  const notPassed = results.filter(result => result.status !== 'pass');
  const c = summary.counts, m = summary.medians;
  const tile = (value: string, label: string, sub = ''): string => `<div class="tile"><div class="v">${value}</div><div class="l">${label}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  const families = Object.keys(suite.families).filter(family => results.some(result => result.family === family));
  const familyBars = families.map(family => {
    const n = summary.perFamily[family];
    const cells = results.filter(result => result.family === family).map(result => `<span class="cell ${result.status}" title="${esc(result.id)} — ${STATUS[result.status]}"></span>`).join('');
    return `<tr><td>${esc(suite.families[family])}</td><td class="num"><b>${n.pass}</b>/${n.jobs}</td><td>${cells}</td><td class="muted">${n.fail ? `불합격 ${n.fail} ` : ''}${n.timeout ? `시간 초과 ${n.timeout} ` : ''}${n.infra ? `기반 오류 ${n.infra}` : ''}</td></tr>`;
  }).join('');
  const causeHtml = causes.length
    ? causes.map(cause => `<section class="cause"><h3>${esc(cause.title)} <span class="muted">— ${cause.jobs.length}건</span></h3><p>${esc(cause.why)}</p>${cause.jobs.map(id => byId.get(id)).filter((result): result is JobResult => !!result).map(result =>
      `<div class="ex"><div>${badge(result.status)} <b>${esc(result.id)}</b> <span class="req">${esc(result.request)}</span></div><p class="why">${esc(result.reason)}</p><p class="calls">${callLine(result)}</p><details><summary>호출 발췌</summary>${traceHtml(result)}</details></div>`).join('')}</section>`).join('')
    : notPassed.length ? `<p class="muted">원인별 묶음(causes.json)이 없다 — 통과하지 못한 일을 판정 글 그대로 싣는다.</p>${notPassed.map(result => `<div class="ex"><div>${badge(result.status)} <b>${esc(result.id)}</b> <span class="req">${esc(result.request)}</span></div><p class="why">${esc(result.reason)}</p><p class="calls">${callLine(result)}</p></div>`).join('')}` : '<p>모두 통과했다.</p>';
  const uncovered = causes.length ? notPassed.filter(result => !causes.some(cause => cause.jobs.includes(result.id))) : [];
  const tables = families.map(family => `<h3>${esc(suite.families[family])} <span class="muted">${summary.perFamily[family].pass}/${summary.perFamily[family].jobs}</span></h3><table class="jobs"><thead><tr><th>일 · 요청</th><th>결과</th><th>까닭</th><th>턴 끝</th><th>호출</th><th>분</th><th>토큰 in/out</th><th>지시문 자</th><th>도구 수</th></tr></thead><tbody>${results.filter(result => result.family === family).map(jobRow).join('')}</tbody></table>`).join('');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>작은 일 30가지 — ${esc(summary.modelPin)} · ${esc(summary.assistantVersion)}</title><style>
:root{--bg:#fbfaf7;--fg:#1d1c1a;--mut:#6b675f;--line:#e2ded5;--card:#fff;--pass:#1f7a4a;--fail:#b3261e;--timeout:#9a6200;--infra:#5f6470;--passbg:#e3f3e9;--failbg:#fbe6e4;--timeoutbg:#fbeed2;--infrabg:#e9eaee}
@media(prefers-color-scheme:dark){:root{--bg:#16161a;--fg:#ececec;--mut:#a09d96;--line:#33333a;--card:#1e1e24;--pass:#6fd39b;--fail:#ff8a80;--timeout:#f0b455;--infra:#aab0bd;--passbg:#173524;--failbg:#40201d;--timeoutbg:#3b2d10;--infrabg:#2a2c33}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}main{max-width:1180px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:38px 0 10px;padding-top:14px;border-top:1px solid var(--line)}h3{font-size:16px;margin:22px 0 8px}.muted{color:var(--mut);font-weight:400}.meta{color:var(--mut);font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.tile .v{font-size:23px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}.tile .l{font-size:13px;color:var(--mut)}.tile .s{font-size:12px;color:var(--mut);margin-top:2px}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:13.5px}th{font-size:12px;color:var(--mut);font-weight:600;white-space:nowrap}tr:last-child td{border-bottom:0}.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}.badge.pass{background:var(--passbg);color:var(--pass)}.badge.fail{background:var(--failbg);color:var(--fail)}.badge.timeout{background:var(--timeoutbg);color:var(--timeout)}.badge.infra{background:var(--infrabg);color:var(--infra)}
.cell{display:inline-block;width:22px;height:14px;border-radius:3px;margin-right:3px}.cell.pass{background:var(--pass)}.cell.fail{background:var(--fail)}.cell.timeout{background:var(--timeout)}.cell.infra{background:var(--infra)}
.fam td:first-child{width:190px}.fam td:nth-child(2){width:70px}.jobs td:first-child{width:250px}.req{color:var(--mut);font-size:12.5px;margin-top:2px}.why{max-width:520px}.err{color:var(--fail)}details{margin-top:6px}summary{cursor:pointer;color:var(--mut);font-size:12.5px}.calls{font:12px/1.5 ui-monospace,Menlo,monospace;color:var(--mut);word-break:break-all;margin:6px 0}
.trace{margin:6px 0;padding-left:20px;font-size:12.5px}.trace li{margin:3px 0}.trace li.bad b{color:var(--fail)}.trace code{display:block;font:11.5px/1.45 ui-monospace,Menlo,monospace;color:var(--mut);word-break:break-all}.trace .res{display:block;font-size:12px;color:var(--fg);opacity:.85;word-break:break-word;border-left:2px solid var(--line);padding-left:8px;margin-top:2px}
.answer{white-space:pre-wrap;font-size:12.5px;color:var(--mut);border-left:2px solid var(--line);padding-left:8px}.cause{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:4px 16px 12px;margin:12px 0}.ex{border-top:1px dashed var(--line);padding:8px 0 2px}.ex .why{margin:4px 0;max-width:none}pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow:auto;font-size:12.5px}
</style></head><body><main>
<h1>작은 일 30가지 — 조수 ${esc(summary.assistantVersion)} · ${esc(summary.model)}</h1>
<p class="meta">기준 main ${esc(summary.git.mainBase || '-')} · 머리 ${esc(summary.git.sha)} (${esc(summary.git.branch)}${summary.git.dirty ? ' · 작업 트리 변경 있음' : ''}) · ${esc(String(summary.startedAt).slice(0, 16))} ~ ${esc(String(summary.finishedAt).slice(0, 16))} UTC · 일마다 새 픽스처 · 한 턴(되물으면 「네가 판단해서 진행해 줘」 한 번) · 상한 ${summary.timeLimitMin}분 · 판정은 저장·재로드한 문서의 기계 검사(모델 판정자 없음)</p>
<div class="tiles">${tile(`${c.pass} / ${c.jobs}`, '통과', `불합격 ${c.fail} · 시간 초과 ${c.timeout} · 기반 오류 ${c.infra}`)}${tile(`${c.complete} / ${c.jobs}`, '턴이 «완료»로 끝남', '조수 자신의 턴 끝 판정')}${tile(String(m.toolCalls), '도구 호출 중앙값', `합계 ${summary.totals.toolCalls}회`)}${tile(`${minutes(m.wallMs)}분`, '걸린 시간 중앙값', `합계 ${minutes(summary.totals.wallMs)}분`)}${tile(`${kilo(m.inputTokens)} / ${kilo(m.outputTokens)}`, '토큰 in / out 중앙값', `합계 ${kilo(summary.totals.inputTokens)} / ${kilo(summary.totals.outputTokens)}`)}${tile(Number(m.systemPromptChars).toLocaleString('en'), '지시문 글자 중앙값', '첫 모델 호출')}${tile(String(m.toolsOffered), '처음 실린 도구 수 중앙값', m.toolSchemaChars ? `도구 설명 ${Number(m.toolSchemaChars).toLocaleString('en')}자` : '')}</div>
<h2>가족별</h2><table class="fam"><thead><tr><th>가족</th><th>통과</th><th>일마다</th><th></th></tr></thead><tbody>${familyBars}</tbody></table>
<p class="meta">칸 색: <span class="badge pass">통과</span> <span class="badge fail">불합격</span> <span class="badge timeout">시간 초과</span> <span class="badge infra">기반 오류</span> — 시간 초과와 기반 오류도 통과가 아닌 것으로 센다. 다시 돌려 초록으로 바꾸지 않았다.</p>
<h2>무엇이 왜 실패하나</h2>${causeHtml}${uncovered.length ? `<section class="cause"><h3>묶지 못한 것 <span class="muted">— ${uncovered.length}건</span></h3>${uncovered.map(result => `<div class="ex"><div>${badge(result.status)} <b>${esc(result.id)}</b> <span class="req">${esc(result.request)}</span></div><p class="why">${esc(result.reason)}</p><p class="calls">${callLine(result)}</p></div>`).join('')}</section>` : ''}
<h2>일마다</h2>${tables}
<h2>다시 재기</h2><pre>npm run -s build:fast &amp;&amp; node scripts/build-electron.mjs
npm run harness -- assistant-capability small-jobs-selfcheck            # 판정기 자기검사(모델 없음)
npm run harness -- assistant-capability small-jobs --model ${esc(summary.modelPin)}${summary.assistantVersion === 'v2' ? ' --v2' : ''} --out &lt;새 폴더&gt; [--only id,가족]
npm run harness -- assistant-capability small-jobs-report --run &lt;그 폴더&gt; --html &lt;출력.html&gt;</pre>
<p class="meta">묶음: ${esc(summary.suite)} · 픽스처: ${Object.entries(suite.fixtures).map(([id, text]) => `${esc(id)} = ${esc(text)}`).join(' / ')}</p>
</main></body></html>`;
  const out = resolve(options.html ?? resolve(run, 'report.html'));
  writeFileSync(out, html);
  console.log(`${out} (${(html.length / 1024).toFixed(0)}KB)`);
  return 0;
}
