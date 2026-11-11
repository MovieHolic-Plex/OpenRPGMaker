// 실행 스트림 연결 누수 재현(모델 없음): 가짜 호스트가 끝나지 않는 실행 스트림을 주고, 페이지가 편집기 클라이언트처럼
// 제 리더를 끊고 이어 받기를 N 번 연다. 그 뒤 평범한 요청 하나가 5초 안에 답을 받는지 본다.
// 하네스 구동기(editorDriver.mjs)의 가로채기가 이어 받기에 밀린 앞 가지를 끊지 않으면 연결 6개(브라우저의 호스트당 상한)가 다 차서 답이 오지 않는다.
//   node scripts/qa/harness-stream-leak.mjs [editorDriver.mjs 경로] [이어 받기 수=5]
//   기대: {"ping":"ok", "superseded":5, "serverLiveStreams":1}. 고치기 전 구동기(git show <옛 커밋>:… > 파일)는 "NO ANSWER in 5s", serverLiveStreams 6.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { firefox } from "playwright";
const [driverPath = 'src/harnesses/assistant-capability/node/editorDriver.mjs', resumesArg = '5'] = process.argv.slice(2);
const source = readFileSync(driverPath, 'utf8');
const from = source.indexOf('await page.addInitScript(') + 'await page.addInitScript('.length;
const to = source.indexOf(',{...(config??{}),hideStartMarker');
const initScript = `(${source.slice(from, to)})({})`;
let live = 0, peak = 0;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>leak</title>'); return; }
  if (url.pathname === '/ping') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
  if (url.pathname === '/v1/agent/run') {
    let seq = Number(url.searchParams.get('after') ?? 0);
    live++; peak = Math.max(peak, live);
    res.writeHead(200, { 'content-type': 'application/x-ndjson', 'X-Oprn-Run-Id': 'run-leak-0001' });
    const timer = setInterval(() => res.write(JSON.stringify({ seq: seq++, type: 'heartbeat' }) + '\n'), 100);
    res.on('close', () => { clearInterval(timer); live--; });
    return;
  }
  res.writeHead(404).end();
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false, 'network.notify.IPv6': false,
  'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
const page = await (await browser.newContext()).newPage();
await page.addInitScript(initScript);
await page.goto(base + '/');
const result = await page.evaluate(async resumes => {
  const readSome = async response => { const reader = response.body.getReader(); await reader.read(); await reader.read(); await reader.cancel(); };
  await readSome(await fetch('/v1/agent/run?provider=x', { method: 'POST', body: '{}' }));
  let lastSeq = 1;
  for (let i = 0; i < resumes; i++) { await readSome(await fetch('/v1/agent/run?provider=x&runId=run-leak-0001&after=' + (lastSeq + 1))); lastSeq += 2; }
  await new Promise(done => setTimeout(done, 500));
  const t0 = performance.now();
  let ping;
  try { ping = await (await fetch('/ping', { signal: AbortSignal.timeout(5000) })).text(); } catch (error) { ping = 'NO ANSWER in 5s (' + error.name + ')'; }
  const count = type => window.__capEvents.filter(e => e.type === type).length;
  return { ping, pingMs: Math.round(performance.now() - t0), open: count('stream_open'), superseded: count('stream_superseded'), closed: count('stream_closed'), errors: count('stream_error') };
}, Number(resumesArg));
console.log(JSON.stringify({ driver: driverPath.split('/').slice(-1)[0], resumes: Number(resumesArg), ...result, serverLiveStreams: live, serverPeak: peak }));
await browser.close(); server.close(); process.exit(0);
