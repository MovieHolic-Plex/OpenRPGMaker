// usage: bun pool.ts <jobs.json> <concurrency> <outDir>
// Rolling pool: at most C ChatGPT tabs; a new tab starts only after the previous tab's upload+send finished (spaced uploads).
// Halts everything on login wall / captcha / rate-limit text. Closes every tab it opened.
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
const [jobsPath, cArg, outDir] = process.argv.slice(2);
const C = Number(cArg); mkdirSync(outDir, { recursive: true });
const jobs: { k: string; prompt: string; img?: string }[] = JSON.parse(readFileSync(jobsPath, 'utf8')).filter((j: any) => !existsSync(`${outDir}/${j.k}.gif`));
const T0 = Date.now(); const iso = () => new Date().toISOString();
const raw = (o: any) => { const line = JSON.stringify({ at: iso(), t: Math.round((Date.now() - T0) / 1000), ...o }); appendFileSync(outDir + '/raw.jsonl', line + '\n'); console.log(line); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BLOCK = /verify you are human|captcha|log in to continue|session expired|unusual activity|account (?:has been )?(?:suspended|restricted)|too many requests|rate limit|usage limit|reached (?:the|your) limit|limit resets/i;
const SOFT = /Something went wrong|Upload failed/i;
const memAvailGB = () => Number(readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/)![1]) / 1048576;
const load1 = () => Number(readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
async function connect(id: string) {
  const ws = new WebSocket('ws://127.0.0.1:9377/devtools/page/' + id);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0; const pend = new Map<number, (d: any) => void>();
  ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && pend.has(d.id)) { pend.get(d.id)!(d); pend.delete(d.id); } };
  const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++n; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression: string) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return { ws, send, ev };
}
const GEN = "[...document.querySelectorAll('main img')].filter(i=>/^Generated/i.test(i.alt||'')&&!i.closest('form'))";
const STATE = `JSON.stringify({stop:!!document.querySelector('[data-testid="stop-button"]'),imgs:${GEN}.length,done:${GEN}.filter(i=>i.complete&&i.naturalWidth>200).length,block:((document.body.innerText.match(${BLOCK})||[])[0]||''),soft:((document.body.innerText.match(${SOFT})||[])[0]||''),url:location.href})`;
let halt = ''; const rows: any[] = []; const opened: string[] = [];

async function runJob(job: { k: string; prompt: string; img?: string }, sendGate: () => void) {
  const row: any = { k: job.k, status: 'opening' }; rows.push(row);
  let released = false; const release = () => { if (!released) { released = true; sendGate(); } };
  const nt = await (await fetch('http://127.0.0.1:9377/json/new?about:blank', { method: 'PUT' })).json();
  opened.push(nt.id); const c = await connect(nt.id); raw({ ev: 'tab-open', k: job.k });
  try {
    await c.send('Page.enable'); await c.send('Page.navigate', { url: 'https://chatgpt.com/' });
    let ok = false; for (let i = 0; i < 40; i++) { await sleep(1000); if (await c.ev("!!document.querySelector('.ProseMirror[contenteditable=true]')")) { ok = true; break; } }
    const body = String(await c.ev('document.body.innerText') || '');
    const b = body.match(BLOCK); if (b) { row.status = 'BLOCK'; row.note = b[0]; halt = b[0]; raw({ ev: 'BLOCK', k: job.k, text: b[0] }); return; }
    if (!ok) throw new Error('no-composer');
    if (await c.ev(GEN + '.length')) throw new Error('not-fresh-chat');
    await c.ev("(()=>{for(const b of document.querySelectorAll('form button[aria-label^=\"Remove\"]'))b.click();return 1})()"); await sleep(500);
    if (job.img) {
    const doc = await c.send('DOM.getDocument', { depth: -1, pierce: false });
    const q = await c.send('DOM.querySelectorAll', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
    let nodeId = 0;
    for (const nid of q.result.nodeIds) { const a = (await c.send('DOM.getAttributes', { nodeId: nid })).result.attributes; const o: any = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; if (o.accept === 'image/*' && !('capture' in o)) { nodeId = nid; break; } }
    if (!nodeId) throw new Error('no-input');
    await c.send('DOM.setFileInputFiles', { files: [job.img], nodeId });
    let chips = 0; for (let i = 0; i < 30; i++) { await sleep(1500); chips = await c.ev("document.querySelectorAll('form button[aria-label^=\"Remove\"]').length"); const fail = await c.ev("[...document.querySelectorAll('body *')].some(e=>e.children.length===0&&/Upload failed/i.test(e.textContent||'')&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden')"); if (fail) throw new Error('upload-failed'); if (chips >= 1 && !(await c.ev("!!document.querySelector('form [role=progressbar], form circle')"))) break; }
    if (chips !== 1) throw new Error('chips=' + chips);
    }
    await c.ev("(()=>{const el=document.querySelector('.ProseMirror[contenteditable=true]');el.focus();document.execCommand('selectAll');document.execCommand('delete');return 1})()");
    if ((await c.ev("document.querySelector('.ProseMirror[contenteditable=true]').innerText.trim().length")) !== 0) throw new Error('composer-dirty');
    const prompt = readFileSync(job.prompt, 'utf8').trim();
    await c.send('Input.insertText', { text: prompt }); await sleep(800);
    const len = await c.ev("document.querySelector('.ProseMirror[contenteditable=true]').innerText.replace(/\\s+/g,'').length");
    const want = prompt.replace(/\s+/g, '').length;
    if (Math.abs(len - want) > 12) throw new Error(`len ${len}/${want}`);
    let sent = false; for (let i = 0; i < 15 && !sent; i++) { sent = await c.ev("(()=>{const b=document.querySelector('[data-testid=\"send-button\"],button[aria-label=\"Send\"],button[aria-label=\"Send prompt\"]');if(!b||b.disabled)return false;b.click();return true})()"); if (!sent) await sleep(1000); }
    if (!sent) throw new Error('no-send');
    row.tSend = Date.now(); row.status = 'running'; raw({ ev: 'sent', k: job.k });
    for (let i = 0; i < 15; i++) { await sleep(1500); row.url = await c.ev('location.href'); if (/\/c\//.test(row.url)) break; }
    release();
    let last = 0, stable = 0; const deadline = Date.now() + 15 * 60_000;
    while (!halt && Date.now() < deadline) {
      await sleep(5000);
      let s: any; try { s = JSON.parse(await c.ev(STATE)); } catch { continue; }
      const secs = (Date.now() - row.tSend) / 1000;
      if (s.block) { row.status = 'BLOCK'; row.note = s.block; halt = s.block; raw({ ev: 'BLOCK', k: job.k, text: s.block, url: s.url }); return; }
      if (s.imgs > 0 && !row.firstSec) row.firstSec = Math.round(secs);
      if (!s.stop && s.done > 0 && s.done === last) stable++; else stable = 0; last = s.done;
      if (stable >= 3 && secs > 40) { row.status = 'done'; row.doneSec = Math.round(secs); break; }
      if (!s.stop && secs > 300 && s.imgs === 0) { row.status = 'fail'; row.note = 'idle-noimg ' + (s.soft || ''); break; }
    }
    if (row.status === 'running') row.status = halt ? 'halted' : 'timeout';
    row.reply = String(await c.ev("(()=>{return [...document.querySelectorAll('main .markdown')].map(x=>x.innerText).join(' | ').slice(0,400)})()") || '');
    if (row.status === 'done') {
      let r: any; for (let a = 0; a < 6; a++) { r = await c.ev(`(async()=>{try{const i=${GEN}.at(-1);if(!i)return 'ERR noimg';const resp=await fetch(i.src,{credentials:'include'});const b=await resp.blob();const buf=new Uint8Array(await b.arrayBuffer());let s='';for(let k=0;k<buf.length;k+=8192)s+=String.fromCharCode.apply(null,buf.subarray(k,k+8192));return JSON.stringify({mime:b.type,w:i.naturalWidth,h:i.naturalHeight,b64:btoa(s)})}catch(e){return 'ERR '+e}})()`); if (typeof r === 'string' && r.startsWith('{')) break; raw({ ev: 'dl-retry', k: job.k, r: String(typeof r === 'string' ? r : JSON.stringify(r)).slice(0, 200) }); await sleep(5000); }
      if (typeof r !== 'string' || !r.startsWith('{')) throw new Error('download ' + String(r).slice(0, 100));
      const o = JSON.parse(r); const ext = /gif/.test(o.mime) ? 'gif' : /png/.test(o.mime) ? 'png' : /webp/.test(o.mime) ? 'webp' : 'bin';
      row.file = `${outDir}/${job.k}.${ext}`; writeFileSync(row.file, Buffer.from(o.b64, 'base64')); Object.assign(row, { mime: o.mime, w: o.w, h: o.h });
    }
    raw({ ev: 'end', k: job.k, url: row.url, status: row.status, doneSec: row.doneSec, file: row.file, note: row.note });
  } catch (e: any) { row.status = row.tSend ? 'dl-fail' : 'send-fail'; row.note = String(e.message || e); raw({ ev: 'fail', k: job.k, url: row.url, note: row.note }); }
  finally {
    release();
    try { c.ws.close(); await fetch('http://127.0.0.1:9377/json/close/' + nt.id); raw({ ev: 'tab-closed', k: job.k }); } catch { raw({ ev: 'close-fail', k: job.k }); }
  }
}

raw({ ev: 'pool-start', C, jobs: jobs.length, mem: memAvailGB().toFixed(1), load: load1() });
const running = new Set<Promise<void>>(); let qi = 0;
while (qi < jobs.length && !halt) {
  while (running.size >= C) await Promise.race(running);
  if (halt) break;
  if (memAvailGB() < 20 || load1() > 32) { raw({ ev: 'guard-wait', mem: memAvailGB().toFixed(1), load: load1() }); await sleep(30000); continue; }
  let gate!: () => void; const sentP = new Promise<void>((r) => (gate = r));
  const p = runJob(jobs[qi++], gate).finally(() => running.delete(p)); running.add(p);
  await sentP; // spacing: next upload only after this one sent (or failed)
}
await Promise.all(running);
writeFileSync(outDir + '/result-' + Date.now() + '.json', JSON.stringify({ C, halt, startedAt: new Date(T0).toISOString(), endedAt: iso(), rows }, null, 1));
console.log('POOL_END ' + JSON.stringify({ halt, done: rows.filter((r) => r.status === 'done').length, total: rows.length, fails: rows.filter((r) => r.status !== 'done').map((r) => r.k + ':' + r.status + ':' + (r.note || '')) }));
process.exit(0);
