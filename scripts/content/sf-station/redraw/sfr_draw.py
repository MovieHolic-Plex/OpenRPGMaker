"""시범 그리기: Claude Fable 5.2 effort medium, 조각마다 호출 1번(그림이 아니면 한 번 더, 세 번째는 없음).
object-oneshot/pilot_draw.py 와 같은 CLI 인자·같은 답 형식. 다른 점: 참고 PNG 를 Read 도구 대신 같은 메시지의 그림 블록으로 보낸다(도구 없음 → 호출 1번 = 요청 1번),
출력 상한(CLAUDE_CODE_MAX_OUTPUT_TOKENS)을 조각 크기별로 건다, 예산을 호출 전(최악값 예약)과 호출 후 모두 검사한다.
usage: python3 sp_draw.py [--only id,id] [--par 3]
"""
import base64, json, os, re, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
import sfr_lib as L

H = L.HERE
D = json.load(open(f'{H}/units.json', encoding='utf-8'))
MODEL, EFFORT = 'claude-fable-5-2', 'medium'
CAP_USD = 33.0            # 전체 상한(지시 $35 에서 여유 $2)
CALL_STOP_USD = 0.62     # 한 호출이 이걸 넘으면 멈추고 보고
OUT_PRICE = 20e-6        # 출력 토큰 단가(오늘 CLI 보고값에서 역산: 출력 $20/M, 캐시 쓰기 $5/M)
IN_RESERVE = 0.06   # 입력 쪽 최악값
CAP_OVERRIDE = {}
LOCK = threading.Lock()
LEDGER = f'{H}/ledger.jsonl'
STOP = f'{H}/STOP'
STATE = {'reserved': 0.0}
INFRA = re.compile(r'\b(429|500|502|503|504|529)\b|overloaded|rate.?limit|quota|timeout|timed out|ECONN|socket|network|fetch failed|upstream', re.I)


def log(m):
    with LOCK:
        print(time.strftime('%H:%M:%S'), m, flush=True)


def spent():
    n, usd = 0, 0.0
    if os.path.exists(LEDGER):
        for line in open(LEDGER):
            if line.strip():
                r = json.loads(line)
                n += 1
                usd += r['usd_counted']
    return n, usd


def reserve(amount):
    """호출 전 검사: 지금까지 쓴 돈 + 날고 있는 호출의 최악값 + 이 호출의 최악값이 상한 안인가. 날고 있는 호출 때문에만 모자라면 그 호출이 끝나길 기다린다."""
    while True:
        with LOCK:
            if os.path.exists(STOP):
                return False
            _, usd = spent()
            if usd + STATE['reserved'] + amount <= CAP_USD:
                STATE['reserved'] += amount
                return True
            if STATE['reserved'] <= 1e-9:
                return False
        time.sleep(5)


def settle(amount, rec):
    """호출 후 검사: 실제 값을 장부에 적고, 한 호출이 $0.60 을 넘었거나 합계가 상한에 닿으면 STOP."""
    with LOCK:
        STATE['reserved'] -= amount
        with open(LEDGER, 'a') as f:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')
        _, usd = spent()
        if rec['usd_counted'] > CALL_STOP_USD:
            open(STOP, 'w').write(f'call {rec["key"]} cost ${rec["usd_counted"]:.3f} > ${CALL_STOP_USD}')
        elif usd >= CAP_USD:
            open(STOP, 'w').write(f'total ${usd:.2f} reached the cap')


def blocks(o, prompt):
    out = [{'type': 'text', 'text': prompt}]
    for i, f in enumerate(o['images']):
        out.append({'type': 'text', 'text': f'[picture {i + 1}]'})
        out.append({'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': base64.b64encode(open(f'{H}/refs/{f}', 'rb').read()).decode()}})
    return out


def prompt_of(o):
    p = open(f'{H}/prompts/{o["id"]}.txt', encoding='utf-8').read()
    if o.get('needs'):
        a = pick(o['needs'])
        if a:
            head = o.get('needs_head') or 'ROOF PIECE (already drawn; it sits directly above your canvas: its last row touches your row 0)'
            add = (f'\n\n== {head} as row strings ==\nlegend: {{' + ', '.join(f'"{k}": "{v}"' for k, v in a['legend'].items())
                   + '}\nrows:\n' + '\n'.join(a['rows']) + '\n')
            p = p.replace('\n== OUTPUT FORMAT (strict) ==', add + '\n== OUTPUT FORMAT (strict) ==')
    return p


def pick(pid):
    """그 조각의 «그림» 으로 읽힌 마지막 답(없으면 None)."""
    o = next(x for x in D['objects'] if x['id'] == pid)
    for n in (2, 1):
        f = f'{H}/shots/{pid}__{n}.json'
        if os.path.exists(f):
            d = json.load(open(f))
            r = L.read_answer(o, (d.get('cli') or {}).get('result'))
            if r['lenientOk']:
                return r
    return None


def call(o, n):
    key = f'{o["id"]}__{n}'
    out = f'{H}/shots/{key}.json'
    if os.path.exists(out):
        return json.load(open(out))
    cap = CAP_OVERRIDE.get(o['id'], o['cap'])
    worst = cap * OUT_PRICE + IN_RESERVE
    if not reserve(worst):
        log(f'SKIP {key}: budget (spent ${spent()[1]:.2f}, reserved ${STATE["reserved"]:.2f}, need ${worst:.2f}) or STOP')
        return None
    prompt = prompt_of(o)
    open(f'{H}/prompts/sent-{key}.txt', 'w', encoding='utf-8').write(prompt)
    cmd = ['claude', '-p', '--model', MODEL, '--effort', EFFORT, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--system-prompt', D['system'],
           '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence', '--max-budget-usd', f'{cap * OUT_PRICE - 0.01:.2f}']
    env = dict(os.environ, CLAUDE_CODE_MAX_OUTPUT_TOKENS=str(cap))
    line = json.dumps({'type': 'user', 'message': {'role': 'user', 'content': blocks(o, prompt)}}) + '\n'
    t0 = time.time()
    d, why = None, ''
    try:
        p = subprocess.run(cmd, input=line, capture_output=True, text=True, cwd=f'{H}/empty', timeout=900, env=env)
        for ln in p.stdout.splitlines():
            if ln.startswith('{'):
                try:
                    j = json.loads(ln)
                except Exception:
                    continue
                if j.get('type') == 'result':
                    d = j
        if d is None:
            why = f'no-result rc={p.returncode} {(p.stderr or p.stdout)[-300:]}'
    except subprocess.TimeoutExpired:
        why = 'timeout 900s'
    wall = round(time.time() - t0, 1)
    if d is None:
        # 비용을 알 수 없는 호출: 최악값을 쓴 것으로 센다(지난번 시간 초과 4건의 비용이 장부에 없었다)
        rec = dict(key=key, at=time.strftime('%Y-%m-%dT%H:%M:%S'), wall=wall, usd=None, usd_counted=worst, why=why, models=[])
        settle(worst, rec)
        json.dump({'key': key, 'piece': o['id'], 'shot': n, 'wall': wall, 'cli': None, 'infra': why}, open(out, 'w'), ensure_ascii=False)
        log(f'INFRA {key}: {why[:160]} (counted ${worst:.2f})')
        return json.load(open(out))
    u = d.get('usage') or {}
    mu = d.get('modelUsage') or {}
    usd = d.get('total_cost_usd') or 0.0
    rec = dict(key=key, at=time.strftime('%Y-%m-%dT%H:%M:%S'), wall=wall, usd=usd, usd_counted=usd, models=list(mu.keys()), input=u.get('input_tokens', 0),
               cache_write=u.get('cache_creation_input_tokens', 0), cache_read=u.get('cache_read_input_tokens', 0), output=u.get('output_tokens', 0),
               thinking=(u.get('output_tokens_details') or {}).get('thinking_tokens'), stop=d.get('stop_reason'), is_error=bool(d.get('is_error')),
               max_out=[v.get('maxOutputTokens') for v in mu.values()], turns=d.get('num_turns'))
    settle(worst, rec)
    json.dump({'key': key, 'piece': o['id'], 'shot': n, 'wall': wall, 'cli': d}, open(out, 'w'), ensure_ascii=False)
    if MODEL not in mu:
        open(STOP, 'w').write(f'reported models {list(mu.keys())} do not include {MODEL}')
    log(f'call {key} {wall:.0f}s in={rec["input"] + rec["cache_write"] + rec["cache_read"]} out={rec["output"]} think={rec["thinking"]} ${usd:.3f} stop={rec["stop"]} maxOut={rec["max_out"]} '
        f'{list(mu.keys())}{" ERROR " + str(d.get("result"))[:120] if d.get("is_error") else ""}')
    return json.load(open(out))


def one(o):
    for n in (1, 2):
        if os.path.exists(STOP):
            return
        d = call(o, n)
        if d is None:
            return
        r = L.read_answer(o, (d.get('cli') or {}).get('result'))
        if r['lenientOk']:
            log(f'PICTURE {o["id"]} shot {n} strict={r["strictOk"]} {r["strictErrors"][:3]}')
            return
        log(f'NOT-A-PICTURE {o["id"]} shot {n}: {r["strictErrors"][:3]} stop={((d.get("cli") or {}).get("stop_reason"))}')
    log(f'NO-PICTURE {o["id"]} after 2 shots')


def main():
    only = set((sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else '').split(',')) - {''}
    par = int(sys.argv[sys.argv.index('--par') + 1]) if '--par' in sys.argv else 3
    if '--seq' in sys.argv:      # 적은 순서대로 하나씩(예산이 모자란 조각은 건너뛰고 다음 것으로)
        byid = {o['id']: o for o in D['objects']}
        ids = sys.argv[sys.argv.index('--seq') + 1].split(',')
        log(f'seq {ids}')
        for i in ids:
            one(byid[i])
        n, usd = spent()
        log(f'done: {n} calls, ${usd:.2f}' + (f' STOP: {open(STOP).read()}' if os.path.exists(STOP) else ''))
        return
    objs = [o for o in D['objects'] if (not only or o['id'] in only) and not o.get('abandoned')]
    first = [o for o in objs if not o.get('needs')]
    later = [o for o in objs if o.get('needs')]
    first.sort(key=lambda o: o.get('pri', 3)); later.sort(key=lambda o: o.get('pri', 3))
    log(f'jobs {len(objs)} par {par}')
    with ThreadPoolExecutor(par) as ex:
        list(ex.map(one, first))
    with ThreadPoolExecutor(par) as ex:
        list(ex.map(one, later))
    n, usd = spent()
    log(f'done: {n} calls, ${usd:.2f}' + (f' STOP: {open(STOP).read()}' if os.path.exists(STOP) else ''))


if __name__ == '__main__':
    main()
