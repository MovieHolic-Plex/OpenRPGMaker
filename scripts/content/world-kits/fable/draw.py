#!/usr/bin/env python3
"""테마 세계 칩셋의 새 그림을 Claude Fable 5.2 (effort medium) 한 방으로 그린다 — 그림 한 장에 `claude -p` 호출 1번, 도구 없음, 참고 그림은 같은 메시지에 넣는다.

  python3 scripts/content/world-kits/fable/draw.py <세계> --list                    # 주문 목록(모델 호출 없음)
  python3 scripts/content/world-kits/fable/draw.py <세계> --prompts                 # 보낼 글과 참고 그림만 작업 폴더에 쓴다(모델 호출 없음)
  python3 scripts/content/world-kits/fable/draw.py <세계> --only id,id,… --cap-usd 2 [--par 4] [--redo]
  python3 scripts/content/world-kits/fable/draw.py <세계> --all --cap-usd 30        # 아직 그림이 없는 주문 전부

주문은 worlds/<세계>.py 의 jobs() 가 준다. 그림이 나오면 tiledata/<세계>/variety/src/<id>.png 에 쓴다(범례가 잠긴 팔레트의 «램프:단» 이라 색은 처음부터 팔레트 안이다).
이미 그림이 있는 주문은 --redo 없이는 다시 부르지 않는다. 그 뒤: build.py(빈 칸 지키기·집 조립·목록) → object-gate owner-waive → 그 세계의 굽기.

예산 장치(steampunk-city/fable/draw.py 와 같은 규칙):
- 호출 전에 최악값(출력 상한 × $20/M + 입력)을 예약하고, 호출 뒤 실제 값을 장부(작업 폴더 ledger.jsonl)에 적는다. 합계가 --cap-usd 에 닿거나 한 호출이 $0.60 을 넘으면 멈춘다.
- 출력 상한은 CLAUDE_CODE_MAX_OUTPUT_TOKENS, 그리고 --max-budget-usd 를 한 요청의 최악값 바로 위로 건다(CLI 는 잘린 답을 스스로 이어 부른다).
- 두 번째 호출은 «잘리지 않았는데 그림이 아닌» 답에만 한 번. 잘린 호출은 같은 크기로 다시 부르지 않는다.
- 앞 조각(needs)이 그림이 안 되면 그것에 매달린 조각은 부르지 않는다. 모델이 claude-fable-5-2 가 아니면 멈춘다.
"""
import base64, json, os, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
import wk_common as C
import wk_prompt as T

MODEL, EFFORT = 'claude-fable-5-2', 'medium'
CALL_STOP_USD = 0.60
OUT_PRICE = 20e-6
IN_RESERVE = 0.06
LOCK = threading.Lock()
STATE = {'reserved': 0.0, 'cap': 0.0}
HERO = ('hero-scale.png', 'The PLAYER CHARACTER at 1x (left) and 4x (right) on the 16-pixel map grid: sprite frame 24x32, the figure is 16 px wide and 24 px tall. Draw to this scale and for this camera.')


def log(m):
    with LOCK: print(time.strftime('%H:%M:%S'), m, flush=True)


class Run:
    def __init__(self, wid):
        self.W = C.World(wid)
        self.work = self.W.work
        self.ledger, self.stop = f'{self.work}/ledger.jsonl', f'{self.work}/STOP'
        self.jobs = self.W.mod.jobs(self.W)
        for j in self.jobs:
            j.setdefault('needs', []); j.setdefault('cap', C.cap_for(j['w'], j['h'])); j.setdefault('images', [])

    def images(self, j):
        """[(파일, 설명)] — 그 주문의 참고 그림 + 주인공. 변형이면 원본 그림을 맨 앞에."""
        out = []
        if j.get('base'):
            out.append((f'base-{j["base"]}.png', 'THE EXISTING PICTURE of this kind of thing in this chipset with the player beside it (4x). Yours must be a different design of the same kind, the same size, standing on the same cells.'))
        out += [(f, c) for f, c in self.W.mod.IMG.get(j['cls'], self.W.mod.IMG['prop'])]
        return out + [HERO]

    def refs(self):
        from PIL import Image, ImageDraw
        rd = f'{self.work}/refs'
        os.makedirs(rd, exist_ok=True)
        hero = C.hero()
        g = Image.new('RGBA', (24 + 8 + 24 * 4 + 16, 32 * 4 + 16), tuple(C.BG) + (255,))
        d = ImageDraw.Draw(g)
        for x in range(0, g.width, 16): d.line([(x, 0), (x, g.height)], fill=(182, 148, 96, 255))
        for y in range(0, g.height, 16): d.line([(0, y), (g.width, y)], fill=(182, 148, 96, 255))
        g.alpha_composite(hero, (4, g.height - 8 - 32))
        g.alpha_composite(hero.resize((96, 128), Image.NEAREST), (36, g.height - 8 - 128))
        g.convert('RGB').save(f'{rd}/hero-scale.png')
        for j in self.jobs:
            if not j.get('base'): continue
            b = self.W.kit_image(j['base'])
            c = Image.new('RGBA', (b.width + 36, max(b.height, 32) + 8), tuple(C.BG) + (255,))
            c.alpha_composite(b, (4, c.height - 4 - b.height)); c.alpha_composite(hero, (b.width + 8, c.height - 4 - 32))
            C.big(c, 4).save(f'{rd}/base-{j["base"]}.png')
        self.W.mod.refs(self.W, rd)

    def base_prompt(self, j):
        W, m = self.W, self.W.mod
        imgs = self.images(j)
        variant = ''
        if j.get('base'):
            legend, rows = W.png_to_rows(W.kit_image(j['base']))
            k = W.kits[j['base']]
            cells = ' / '.join(''.join('X' if (x, y) in W.kit_pcs(j['base']) else '.' for x in range(k['width'])) for y in range(k['height']))
            variant = T.VARIANT.format(what=j.get('what', 'version'), cells=cells, w=j['w'], h=j['h'], legend='{' + ', '.join(f'"{a}": "{b}"' for a, b in legend.items()) + '}', rows='\n'.join(rows))
        con = T.CONTRACT[j['contract']]
        if j['contract'] == 'wall': con = con.replace('{door}', j['door'])
        opaque = j['contract'] in ('ground', 'tilevar', 'roof', 'wall', 'wallface')
        return T.TEMPLATE.format(cap=j['cap'], rowtok=round(j['w'] * 0.8), imglist='\n'.join(f'- picture {i + 1}: {c}' for i, (_, c) in enumerate(imgs)), blurb=m.BLURB, name=j['name'], w=j['w'], h=j['h'],
                                 kind=j['kind'], kind_rule=T.KIND[j['kind']], text=j['text'], variant=variant, contract=con,
                                 colour_rules=T.CR_GROUND if j['contract'] in ('ground', 'tilevar') else T.CR_STRUCT, palette=T.palette_text(W.ramps), materials=m.MATERIALS,
                                 opaque_note=' This piece has no transparent pixel.' if opaque else '', eg=m.EG)

    def prompt_of(self, j):
        """틀 + 먼저 그려진 이웃 조각(needs)의 행 문자열."""
        p, add = self.base_prompt(j), ''
        for dep, head in j['needs']:
            legend, rows = self.W.png_to_rows(self.W.src_png(dep))
            add += (f'\n\n== {head} as row strings, {len(rows[0])}x{len(rows)} ==\nlegend: {{' + ', '.join(f'"{k}": "{v}"' for k, v in legend.items()) + '}\nrows:\n' + '\n'.join(rows) + '\n')
        return p.replace('\n== OUTPUT FORMAT (strict) ==', add + '\n== OUTPUT FORMAT (strict) ==') if add else p

    def spent(self):
        n, usd = 0, 0.0
        if os.path.exists(self.ledger):
            for line in open(self.ledger):
                if line.strip(): n += 1; usd += json.loads(line)['usd_counted']
        return n, usd

    def reserve(self, amount):
        while True:
            with LOCK:
                if os.path.exists(self.stop): return False
                _, usd = self.spent()
                if usd + STATE['reserved'] + amount <= STATE['cap']:
                    STATE['reserved'] += amount; return True
                if STATE['reserved'] <= 1e-9: return False
            time.sleep(5)

    def settle(self, amount, rec):
        with LOCK:
            STATE['reserved'] -= amount
            with open(self.ledger, 'a') as f: f.write(json.dumps(rec, ensure_ascii=False) + '\n')
            _, usd = self.spent()
            if rec['usd_counted'] > CALL_STOP_USD: open(self.stop, 'w').write(f'call {rec["key"]} cost ${rec["usd_counted"]:.3f} > ${CALL_STOP_USD}')
            elif usd >= STATE['cap']: open(self.stop, 'w').write(f'total ${usd:.2f} reached the cap')

    def call(self, j, n, extra=''):
        key = f'{j["id"]}__{n}'
        out = f'{self.work}/shots/{key}.json'
        if os.path.exists(out): return json.load(open(out))
        worst = j['cap'] * OUT_PRICE + IN_RESERVE
        if not self.reserve(worst):
            log(f'SKIP {key}: budget (spent ${self.spent()[1]:.2f}, need ${worst:.2f}) or STOP'); return None
        prompt = self.prompt_of(j) + extra
        open(f'{self.work}/prompts/sent-{key}.txt', 'w', encoding='utf-8').write(prompt)
        content = [{'type': 'text', 'text': prompt}]
        for i, (f, _) in enumerate(self.images(j)):
            content += [{'type': 'text', 'text': f'[picture {i + 1}]'}, {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': base64.b64encode(open(f'{self.work}/refs/{f}', 'rb').read()).decode()}}]
        cmd = ['claude', '-p', '--model', MODEL, '--effort', EFFORT, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--system-prompt', T.SYSTEM,
               '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence',
               '--max-budget-usd', f'{j["cap"] * OUT_PRICE + 0.005:.3f}']
        t0, d, why = time.time(), None, ''
        try:
            p = subprocess.run(cmd, input=json.dumps({'type': 'user', 'message': {'role': 'user', 'content': content}}) + '\n', capture_output=True, text=True, cwd=f'{self.work}/empty', timeout=900,
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
            self.settle(worst, dict(key=key, at=time.strftime('%Y-%m-%dT%H:%M:%S'), wall=wall, usd=None, usd_counted=worst, why=why, models=[], cls=j['cls']))
            json.dump({'key': key, 'cli': None, 'infra': why}, open(out, 'w'), ensure_ascii=False)
            log(f'INFRA {key}: {why[:160]} (counted ${worst:.2f})'); return json.load(open(out))
        u, mu, usd = d.get('usage') or {}, d.get('modelUsage') or {}, d.get('total_cost_usd') or 0.0
        self.settle(worst, dict(key=key, at=time.strftime('%Y-%m-%dT%H:%M:%S'), wall=wall, usd=usd, usd_counted=usd, models=list(mu), output=u.get('output_tokens', 0), stop=d.get('stop_reason'), subtype=d.get('subtype'),
                                is_error=bool(d.get('is_error')), cls=j['cls'], cap=j['cap'], px=j['w'] * j['h']))
        json.dump({'key': key, 'cli': d}, open(out, 'w'), ensure_ascii=False)
        if MODEL not in mu: open(self.stop, 'w').write(f'reported models {list(mu)} do not include {MODEL}')
        log(f'call {key} {wall:.0f}s out={u.get("output_tokens", 0)} ${usd:.3f} stop={d.get("stop_reason")} {list(mu)}')
        return json.load(open(out))

    def one(self, j):
        """→ True 면 그림이 나왔다(variety/src/<id>.png)."""
        extra = ''
        for n in (1, 2):
            if os.path.exists(self.stop): return False
            d = self.call(j, n, extra)
            if d is None: return False
            r = self.W.read_answer(j['w'], j['h'], (d.get('cli') or {}).get('result'))
            if r['lenientOk']:
                self.W.rows_to_png(r['legend'], r['rows']).save(os.path.join(self.W.src, j['id'] + '.png'))
                log(f'PICTURE {j["id"]} shot {n} strict={r["strictOk"]} {r["strictErrors"][:3]}'); return True
            c = d.get('cli') or {}
            if c.get('stop_reason') == 'max_tokens' or 'max_budget' in str(c.get('subtype') or '') or 'max_tokens' in str(c.get('subtype') or ''):
                log(f'TRUNCATED {j["id"]} shot {n}: not repeated at this size'); return False
            log(f'NOT-A-PICTURE {j["id"]} shot {n}: {r["strictErrors"][:3]}')
            extra = '\n\nYOUR PREVIOUS ANSWER COULD NOT BE READ AS A PICTURE (' + '; '.join(r['strictErrors'][:3]) + '). Answer with the single JSON object only: a "legend" of palette colours and exactly the required rows of exactly the required length.'
        return False


def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    R = Run(sys.argv[1])
    W, J = R.W, R.jobs
    arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    if '--list' in sys.argv:
        for j in J: print(f'{j["id"]:26} {j["w"]:3}x{j["h"]:<3} {j["cls"]:8} cap {j["cap"]:5} {"←" + j["base"] if j.get("base") else "":24} {"(그림 있음)" if W.src_png(j["id"]) is not None else ""}  {j["ko"]}')
        print(len(J), 'jobs · worst-case if every call hit its cap $%.2f' % sum(j['cap'] * OUT_PRICE + IN_RESERVE for j in J)); return
    for d in ('prompts', 'shots', 'empty'): os.makedirs(f'{R.work}/{d}', exist_ok=True)
    os.makedirs(W.src, exist_ok=True)
    R.refs()
    if '--prompts' in sys.argv:
        for j in J: open(f'{R.work}/prompts/{j["id"]}.txt', 'w', encoding='utf-8').write(R.base_prompt(j))
        print(len(J), 'prompts →', f'{R.work}/prompts'); return
    only = set((arg('--only') or '').split(',')) - {''}
    if '--all' in sys.argv: only = {j['id'] for j in J}
    if not only or not arg('--cap-usd'): sys.exit('draw.py <세계> --only <id,id,…>|--all --cap-usd <달러> — 무엇을 얼마까지 그릴지 적어야 모델을 부른다(--list 로 id 를 본다)')
    STATE['cap'] = float(arg('--cap-usd')) + R.spent()[1]        # 이번 실행의 상한(장부의 지난 지출 위에)
    par = min(4, int(arg('--par', '4')))
    if '--redo' in sys.argv:
        for i in only:
            for f in [os.path.join(W.src, i + '.png')] + [f'{R.work}/shots/{i}__{n}.json' for n in (1, 2)]:
                if os.path.exists(f): os.replace(f, f + '.old')
    pending = {j['id']: j for j in J if j['id'] in only and W.src_png(j['id']) is None}
    state, running, running_ids = {}, {}, set()
    deps = lambda j: [d for d, _ in j['needs']]

    def dep_state(d):
        if d in state: return state[d]
        if d in pending or d in running_ids: return None
        return W.src_png(d) is not None

    log(f'jobs {len(pending)} par {par} cap ${float(arg("--cap-usd")):.2f} work {R.work}')
    with ThreadPoolExecutor(par) as ex:
        while pending or running:
            for jid in list(pending):
                if any(dep_state(d) is False for d in deps(pending[jid])):
                    log(f'SKIP {jid}: a piece it hangs on did not come out'); state[jid] = False; del pending[jid]
            ready = sorted((j for j in pending.values() if all(dep_state(d) for d in deps(j))), key=lambda j: (j.get('prio') or 5, len(j['needs']), j['w'] * j['h']))
            while ready and len(running) < par:
                j = ready.pop(0); del pending[j['id']]; running_ids.add(j['id']); running[ex.submit(R.one, j)] = j['id']
            if not running: break
            for f in wait(list(running), return_when=FIRST_COMPLETED)[0]:
                jid = running.pop(f); running_ids.discard(jid)
                try: state[jid] = bool(f.result())
                except Exception as e: state[jid] = False; log(f'ERROR {jid}: {e!r}')
    n, usd = R.spent()
    log(f'done: pictures {sum(1 for v in state.values() if v)}/{len(state)}, ledger {n} calls ${usd:.2f}' + (f' STOP: {open(R.stop).read()}' if os.path.exists(R.stop) else ''))


if __name__ == '__main__':
    main()
