#!/usr/bin/env python3
"""steampunk_city 조각을 Claude Fable 5.2 (effort medium) 한 방으로 그린다 — 조각마다 `claude -p` 호출 1번, 도구 없음, 참고 그림은 같은 메시지에 넣는다.

  python3 scripts/content/steampunk-city/fable/draw.py --list                 # 주문 목록(모델 호출 없음)
  python3 scripts/content/steampunk-city/fable/draw.py --prompts              # 보낼 글과 참고 그림만 작업 폴더에 쓴다(모델 호출 없음)
  python3 scripts/content/steampunk-city/fable/draw.py --only g-cobble,k-roof-slate-40 --cap-usd 2 [--par 4] [--redo]

그림이 나오면 그 조각 역할의 색으로 맞춰(palette_v3.snap) tiledata/steampunk-city/fable-redraw/src/<id>.png 에 쓴다. 이미 그림이 있는 조각은 --redo 없이는 다시 부르지 않는다.
그 뒤: build.py(조립) → art/<묶음>.py(_gate 내보내기) → object-gate owner-waive → bake_sp.py. 화소가 바뀌면 면제 묶음을 다시 써야 한다.

예산 장치(2026-11-12 실측에서 나온 규칙):
- 호출 전에 최악값(출력 상한 × $20/M + 입력)을 예약하고, 호출 뒤 실제 값을 장부에 적는다. 합계가 --cap-usd 에 닿거나 한 호출이 $0.60 을 넘으면 멈춘다. 비용을 못 읽은 호출은 최악값으로 센다.
- 출력 상한은 CLAUDE_CODE_MAX_OUTPUT_TOKENS, 그리고 --max-budget-usd 를 한 요청의 최악값 바로 위로 건다 — CLI 는 잘린 답을 스스로 세 번 더 이어 부르기 때문이다.
- 잘린 호출은 같은 크기로 다시 부르지 않는다(쪼개서 주문을 고친다). 두 번째 호출은 «잘리지 않았는데 그림이 아닌» 답에만 한 번.
- 앞 조각(needs)이 그림이 안 되면 그것에 매달린 조각은 부르지 않는다. 모델이 claude-fable-5-2 가 아니면 멈춘다(다른 모델로 넘어가지 않는다).
실측: 61조각 61호출 $6.16, 잘림 0. 16×16 바닥 $0.05~0.13, 48×40 벽 모듈 $0.2~0.3, 48×56 이 한 번에 그릴 수 있는 가장 큰 캔버스.
처음 그릴 때는 팔레트 v3.0 의 색을 보였고 그림은 같은 날 v3.1 로(램프·단이 같은 자리끼리) 옮겼다 — 지금 이 실행기는 v3.1 색을 보인다. 참고 그림도 지금 저장소의 그림으로 다시 만든다.
"""
import base64, json, os, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
import numpy as np
from PIL import Image, ImageDraw
import fb_common as C
import fb_prompt as T
import fb_jobs as JB

P3 = C.P3
MODEL, EFFORT = 'claude-fable-5-2', 'medium'
CALL_STOP_USD = 0.60
OUT_PRICE = 20e-6
IN_RESERVE = {'ground': 0.04, 'prop': 0.05, 'part': 0.06, 'roof': 0.06, 'wall': 0.06, 'feat': 0.06}
EXTRA = {'g-tram-n': ['slate'], 'g-tram-s': ['slate'], 'g-rail-n': ['slate', 'wood'], 'g-rail-s': ['slate', 'wood']}     # 바닥 조각이 더 쓸 수 있는 램프(레일·침목)
DOOR = {'k-brick-door1', 'k-brick-door2', 'k-brick-shop', 'k-brick-freight', 'k-stone-door2'}                                # 답에 문 열림 상자를 적게 하는 조각
AFTER = {'x-air-gondola': ['x-air-e']}                                                                                       # 순서만(기낭이 안 되면 곤돌라도 부르지 않는다)
LOCK = threading.Lock()
STATE = {'reserved': 0.0, 'cap': 0.0}
W = C.WORK
LEDGER, STOP = f'{W}/ledger.jsonl', f'{W}/STOP'

IMG = {
 'ground': [('ground-hero@6x.png', 'Reference paving of the house style with the player standing on it (64x48 source pixels = 4x3 tiles, 6x). Another chipset and another palette: take ONLY how quiet the ground is under the figure - close tones, joints barely darker than the stones, no visible 16-pixel grid.')],
 'prop': [('props@4x.png', 'Objects of THIS chipset in its new look and palette, with the player between them (4x): gas lamp 16x48, player 24x32, then other finished pieces. Take the materials, the tone steps, the top faces seen from above, and the SIZES relative to the player.')],
 'roof': [('right-roof@4x.png', 'THE VIEW STANDARD (another chipset, another palette; 4x): a building of this game with the player beside it. The roof is a RECTANGULAR block of horizontal tile bands on top - vertical left and right edges, eave as wide as the ridge - and a flat front wall strip below. Take ONLY this construction and the proportions next to the player.')],
}
IMG['part'] = IMG['prop']
IMG['feat'] = IMG['roof'] + IMG['prop']
IMG['wall'] = IMG['roof']
HERO = ('hero-scale.png', 'The PLAYER CHARACTER at 1x (left) and 4x (right) on the 16-pixel map grid: sprite frame 24x32, the figure is 16 px wide and 24 px tall. Draw to this scale and for this camera.')


def log(m):
    with LOCK:
        print(time.strftime('%H:%M:%S'), m, flush=True)


def jobs():
    J = T.Jobs()
    JB.add_ground(J); JB.add_kit(J); JB.add_props(J); JB.add_parts(J)
    for j in J.J:
        j['role'] = 'ground' if j['cls'] == 'ground' else 'structure'
        j['extra'] = EXTRA.get(j['id'], [])
        j['images'] = [f for f, _ in IMG[j['cls']] + [HERO]]
    return J.J


def refs():
    rd = f'{W}/refs'
    os.makedirs(rd, exist_ok=True)
    hero = C.hero()
    g = Image.new('RGBA', (24 + 8 + 24 * 4 + 16, 32 * 4 + 16), (150, 156, 146, 255))
    d = ImageDraw.Draw(g)
    for x in range(0, g.width, 16): d.line([(x, 0), (x, g.height)], fill=(136, 142, 132, 255))
    for y in range(0, g.height, 16): d.line([(0, y), (g.width, y)], fill=(136, 142, 132, 255))
    g.alpha_composite(hero, (4, g.height - 8 - 32))
    g.alpha_composite(hero.resize((96, 128), Image.NEAREST), (36, g.height - 8 - 128))
    g.convert('RGB').save(f'{rd}/hero-scale.png')
    mc = Image.open(os.path.join(C.ROOT, 'tiledata/sengoku-edo/buildings/_gate/se-machiya-a.png')).convert('RGBA')      # 오너가 «맞다» 고 한 직각 지붕
    c = Image.new('RGBA', (mc.width + 40, mc.height + 12), C.BG + (255,))
    c.alpha_composite(mc, (4, 4)); c.alpha_composite(hero, (mc.width + 10, mc.height + 4 - 32))
    C.big(c, 4).save(f'{rd}/right-roof@4x.png')
    ps = [p for p in (C.src(k) for k in ('p-gas-lamp', 'q-clock-post', 'q-kiosk', 'q-stall-parts')) if p is not None]
    c = Image.new('RGBA', (sum(p.width + 6 for p in ps) + 40, 56), C.BG + (255,))
    x = 4
    for p in ps[:1] + [hero] + ps[1:]:
        c.alpha_composite(p, (x, 52 - p.height)); x += p.width + 6
    C.big(c, 4).save(f'{rd}/props@4x.png')
    pv = Image.open(os.path.join(C.ROOT, 'harness-data/object-gate/style-refs/ground/paving.png')).convert('RGBA')
    pv.alpha_composite(hero, (20, 8))
    C.big(pv, 6).save(f'{rd}/ground-hero@6x.png')


def base_prompt(j):
    imgs = IMG[j['cls']] + [HERO]
    pal = T.palette_text(j['role']) + ''.join(f'\n  {r}: ' + ' '.join(f'{i}={c}' for i, c in enumerate(P3.RAMPS[r])) for r in j['extra'])
    con = {'variant': T.C_VARIANT, 'roof': T.C_ROOF, 'wallmod': T.C_WALLMOD, 'feat': T.C_FEAT}.get(j['contract']) or {'ground': T.C_GROUND, 'prop': T.C_PROP, 'part': T.C_PART}[j['cls']]
    door = j['id'] in DOOR
    return T.TEMPLATE.format(cap=j['cap'], rowtok=round(j['w'] * 0.8), imglist='\n'.join(f'- picture {i + 1}: {c}' for i, (_, c) in enumerate(imgs)), name=j['name'], w=j['w'], h=j['h'], canvas_note='',
                             kind=j['kind'], kind_rule=T.KIND[j['kind']], text=j['text'], contract=con.replace('{last}', str(j['w'] - 1)), colour_rules=T.CR_GROUND if j['role'] == 'ground' else T.CR_STRUCT, palette=pal,
                             door_ex=' "door": [x, y, w, h],' if door else '', opaque_note=' This piece has no transparent pixel.' if j['cls'] in ('ground', 'roof', 'wall') else '',
                             eg='gstone:2' if j['role'] == 'ground' else 'brass:3',
                             door_rule='- "door": the door OPENING you drew (the leaf area the figure walks through, without frame) as [first column, first row, width, height] in canvas pixels.\n' if door else '')


def prompt_of(j):
    """틀 + 먼저 그려진 이웃 조각(needs)의 행 문자열."""
    p, add = base_prompt(j), ''
    for dep, head in j['needs']:
        legend, rows = C.png_to_rows(C.src(dep))
        add += (f'\n\n== {head} as row strings, {len(rows[0])}x{len(rows)} ==\nlegend: {{' + ', '.join(f'"{k}": "{v}"' for k, v in legend.items()) + '}\nrows:\n' + '\n'.join(rows) + '\n')
    return p.replace('\n== OUTPUT FORMAT (strict) ==', add + '\n== OUTPUT FORMAT (strict) ==') if add else p


def spent():
    n, usd = 0, 0.0
    if os.path.exists(LEDGER):
        for line in open(LEDGER):
            if line.strip():
                n += 1; usd += json.loads(line)['usd_counted']
    return n, usd


def reserve(amount):
    """호출 전: 쓴 돈 + 날고 있는 호출의 최악값 + 이 호출의 최악값이 상한 안인가. 날고 있는 호출 때문에만 모자라면 기다린다."""
    while True:
        with LOCK:
            if os.path.exists(STOP): return False
            _, usd = spent()
            if usd + STATE['reserved'] + amount <= STATE['cap']:
                STATE['reserved'] += amount; return True
            if STATE['reserved'] <= 1e-9: return False
        time.sleep(5)


def settle(amount, rec):
    """호출 뒤: 실제 값을 장부에 적고, 한 호출이 $0.60 을 넘었거나 합계가 상한에 닿으면 STOP."""
    with LOCK:
        STATE['reserved'] -= amount
        with open(LEDGER, 'a') as f: f.write(json.dumps(rec, ensure_ascii=False) + '\n')
        _, usd = spent()
        if rec['usd_counted'] > CALL_STOP_USD: open(STOP, 'w').write(f'call {rec["key"]} cost ${rec["usd_counted"]:.3f} > ${CALL_STOP_USD}')
        elif usd >= STATE['cap']: open(STOP, 'w').write(f'total ${usd:.2f} reached the cap')


def call(j, n):
    key = f'{j["id"]}__{n}'
    out = f'{W}/shots/{key}.json'
    if os.path.exists(out): return json.load(open(out))
    worst = j['cap'] * OUT_PRICE + IN_RESERVE[j['cls']]
    if not reserve(worst):
        log(f'SKIP {key}: budget (spent ${spent()[1]:.2f}, need ${worst:.2f}) or STOP'); return None
    prompt = prompt_of(j)
    open(f'{W}/prompts/sent-{key}.txt', 'w', encoding='utf-8').write(prompt)
    content = [{'type': 'text', 'text': prompt}]
    for i, f in enumerate(j['images']):
        content += [{'type': 'text', 'text': f'[picture {i + 1}]'}, {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': base64.b64encode(open(f'{W}/refs/{f}', 'rb').read()).decode()}}]
    cmd = ['claude', '-p', '--model', MODEL, '--effort', EFFORT, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--system-prompt', T.SYSTEM,
           '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence',
           '--max-budget-usd', f'{j["cap"] * OUT_PRICE + 0.005:.3f}']
    t0, d, why = time.time(), None, ''
    try:
        p = subprocess.run(cmd, input=json.dumps({'type': 'user', 'message': {'role': 'user', 'content': content}}) + '\n', capture_output=True, text=True, cwd=f'{W}/empty', timeout=900,
                           env=dict(os.environ, CLAUDE_CODE_MAX_OUTPUT_TOKENS=str(j['cap'])))
        for ln in p.stdout.splitlines():
            if ln.startswith('{'):
                try: r = json.loads(ln)
                except Exception: continue
                if r.get('type') == 'result': d = r
        if d is None: why = f'no-result rc={p.returncode} {(p.stderr or p.stdout)[-300:]}'
    except subprocess.TimeoutExpired:
        why = 'timeout 900s'
    wall = round(time.time() - t0, 1)
    if d is None:
        settle(worst, dict(key=key, at=time.strftime('%Y-%m-%dT%H:%M:%S'), wall=wall, usd=None, usd_counted=worst, why=why, models=[], cls=j['cls']))
        json.dump({'key': key, 'cli': None, 'infra': why}, open(out, 'w'), ensure_ascii=False)
        log(f'INFRA {key}: {why[:160]} (counted ${worst:.2f})'); return json.load(open(out))
    u, mu, usd = d.get('usage') or {}, d.get('modelUsage') or {}, d.get('total_cost_usd') or 0.0
    settle(worst, dict(key=key, at=time.strftime('%Y-%m-%dT%H:%M:%S'), wall=wall, usd=usd, usd_counted=usd, models=list(mu), output=u.get('output_tokens', 0), stop=d.get('stop_reason'), subtype=d.get('subtype'),
                       is_error=bool(d.get('is_error')), cls=j['cls'], cap=j['cap']))
    json.dump({'key': key, 'cli': d}, open(out, 'w'), ensure_ascii=False)
    if MODEL not in mu: open(STOP, 'w').write(f'reported models {list(mu)} do not include {MODEL}')
    log(f'call {key} {wall:.0f}s out={u.get("output_tokens", 0)} ${usd:.3f} stop={d.get("stop_reason")} {list(mu)}')
    return json.load(open(out))


def truncated(d):
    c = d.get('cli') or {}
    return c.get('stop_reason') == 'max_tokens' or 'max_budget' in str(c.get('subtype') or '') or 'max_tokens' in str(c.get('subtype') or '')


def one(j):
    """→ True 면 그림이 나왔다(fable-redraw/src/<id>.png)."""
    for n in (1, 2):
        if os.path.exists(STOP): return False
        d = call(j, n)
        if d is None: return False
        r = C.read_answer(j['w'], j['h'], (d.get('cli') or {}).get('result'))
        if r['lenientOk']:
            P3.snap(C.rows_to_png(r['legend'], r['rows']), j['role'], j['extra']).save(os.path.join(C.SRC, j['id'] + '.png'))
            log(f'PICTURE {j["id"]} shot {n} strict={r["strictOk"]} {r["strictErrors"][:3]} door={r["door"]}'); return True
        if truncated(d):
            log(f'TRUNCATED {j["id"]} shot {n}: not repeated at this size'); return False
        log(f'NOT-A-PICTURE {j["id"]} shot {n}: {r["strictErrors"][:3]}')
    return False


def main():
    arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    J = jobs()
    if '--list' in sys.argv:
        for j in J: print(f'{j["id"]:22} {j["w"]:3}x{j["h"]:<3} {j["cls"]:6} cap {j["cap"]:5} needs {[d for d, _ in j["needs"]]} {"(그림 있음)" if C.src(j["id"]) is not None else ""}  {j["ko"]}')
        print(len(J), 'jobs · worst-case if every call hit its cap $%.2f' % sum(j['cap'] * OUT_PRICE + IN_RESERVE[j['cls']] for j in J)); return
    for d in ('prompts', 'shots', 'empty'): os.makedirs(f'{W}/{d}', exist_ok=True)
    os.makedirs(C.SRC, exist_ok=True)
    refs()
    if '--prompts' in sys.argv:
        for j in J: open(f'{W}/prompts/{j["id"]}.txt', 'w', encoding='utf-8').write(base_prompt(j))
        print(len(J), 'prompts →', f'{W}/prompts'); return
    only = set((arg('--only') or '').split(',')) - {''}
    if not only or not arg('--cap-usd'): sys.exit('draw.py --only <id,id,…> --cap-usd <달러> — 무엇을 얼마까지 그릴지 적어야 모델을 부른다(--list 로 id 를 본다)')
    STATE['cap'] = float(arg('--cap-usd')) + spent()[1]        # 이번 실행의 상한(장부의 지난 지출 위에)
    par = int(arg('--par', '4'))
    if '--redo' in sys.argv:
        for i in only:
            for f in [os.path.join(C.SRC, i + '.png')] + [f'{W}/shots/{i}__{n}.json' for n in (1, 2)]:
                if os.path.exists(f): os.replace(f, f + '.old')
    pending = {j['id']: j for j in J if j['id'] in only and C.src(j['id']) is None}
    state, running, running_ids = {}, {}, set()
    deps = lambda j: [d for d, _ in j['needs']] + AFTER.get(j['id'], [])

    def dep_state(d):
        if d in state: return state[d]
        if d in pending or d in running_ids: return None
        return C.src(d) is not None

    log(f'jobs {len(pending)} par {par} cap ${float(arg("--cap-usd")):.2f} work {W}')
    with ThreadPoolExecutor(par) as ex:
        while pending or running:
            for jid in list(pending):
                if any(dep_state(d) is False for d in deps(pending[jid])):
                    log(f'SKIP {jid}: a piece it hangs on did not come out'); state[jid] = False; del pending[jid]
            ready = sorted((j for j in pending.values() if all(dep_state(d) for d in deps(j))), key=lambda j: (j.get('prio') or 5, len(j['needs']), j['w'] * j['h']))
            while ready and len(running) < par:
                j = ready.pop(0); del pending[j['id']]; running_ids.add(j['id']); running[ex.submit(one, j)] = j['id']
            if not running: break
            for f in wait(list(running), return_when=FIRST_COMPLETED)[0]:
                jid = running.pop(f); running_ids.discard(jid)
                try: state[jid] = bool(f.result())
                except Exception as e: state[jid] = False; log(f'ERROR {jid}: {e!r}')
    n, usd = spent()
    log(f'done: pictures {sum(1 for v in state.values() if v)}/{len(state)}, ledger {n} calls ${usd:.2f}' + (f' STOP: {open(STOP).read()}' if os.path.exists(STOP) else ''))


if __name__ == '__main__':
    main()
