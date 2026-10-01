#!/usr/bin/env python3
"""탈것 하네스 — Sonnet 5명이 같은 탈것을 다른 방향으로 찍고, 검사·독립 검수를 거친 뒤 사용자가 고른다.

  harness.py palette                                   harness-data/modern-chipset/vehicles.pal 다시 쓰기
  harness.py draw car side [--n 5] [--note "…"]        판을 열고 백그라운드로 그린다(바로 돌아온다). 판 id 출력
  harness.py status [판]                               판·후보 상태
  harness.py sheet <판>                                고르는 시트를 ~/claude-viz/veh-<판>.html 에 쓴다(자체완결)
  harness.py pick <판> <글자> [--note]                 사용자가 고른 후보를 기록(+ harness-data/…/picked/ 에 pxg·png 복사 + 다음 판의 anchors)
  harness.py reject <판> <글자> --why "…"              사용자가 버린 후보와 이유 기록(다음 판 「하지 말 것」)
  harness.py review <판>                               이미 그린 판을 (다시) 검수에

취향 판단은 사용자만 한다. 이 스크립트는 깨짐을 거르고, 기준차 옆에 놓은 독립 검수를 돌릴 뿐 후보를 고르지 않는다.
"""
import argparse, base64, concurrent.futures as cf, datetime, glob, io, json, os, shutil, subprocess, sys, threading, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import palette as PAL  # noqa: E402

DATA = os.path.join(ROOT, 'harness-data/modern-chipset')
RUNS = os.path.join(ROOT, 'qa-runs/harnesses/modern-chipset')
VIZ = os.path.expanduser('~/claude-viz')
MODEL = os.environ.get('VEH_HARNESS_MODEL', 'claude-sonnet-5-5')
EFFORT = os.environ.get('VEH_HARNESS_EFFORT', 'high')
MAX_ATTEMPTS = int(os.environ.get('VEH_HARNESS_ATTEMPTS', '3'))
TIMEOUT = int(os.environ.get('VEH_HARNESS_TIMEOUT', str(40 * 60)))
LETTERS = 'ABCDE'
DIRECTIONS = {
    'A': '기준차 충실 — ref 의 윗면 조각 비율·유리 띠 각도·명암 갈림을 그대로 배워 승용 세단으로 옮긴다. 가장 보수적인 안.',
    'B': '지금 차에서 출발 — old 의 형태·비례를 유지하되 윗면(지붕·보닛·트렁크)을 면으로 키우고 접힘선·유리 띠를 넣는다.',
    'C': '둥근 차체 — 보닛·트렁크 모서리를 둥글게(ref 처럼) 이어 상자 느낌을 없앤다. 차체 윤곽이 부드럽게 흐르게.',
    'D': '낮고 날렵한 차 — 지붕을 낮추고 유리 띠를 완만하게. 윗면 조각은 ref 의 70% 이상 행 수를 지킨다.',
    'E': '자유 — 위 넷과 다른 해석 하나. 단 규칙(윗면이 면으로 읽힘·유리 띠·접힘선·1px 윤곽)은 지킨다.',
}


def now(): return datetime.datetime.now().isoformat(timespec='seconds')
def claude_bin(): return shutil.which('claude') or os.path.expanduser('~/.local/bin/claude')
def seed(): return json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))
def ledger():
    p = os.path.join(DATA, 'ledger.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {'picks': [], 'rejects': []}
def save_ledger(l): json.dump(l, open(os.path.join(DATA, 'ledger.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
def rdir(rid): return os.path.join(RUNS, rid)
def state_path(rid): return os.path.join(rdir(rid), 'state.json')
_lock = threading.RLock()
def load_state(rid):
    with _lock: return json.load(open(state_path(rid), encoding='utf-8'))
def upd(rid, letter=None, **kw):
    with _lock:
        s = json.load(open(state_path(rid), encoding='utf-8'))
        if letter: s['cands'][letter].update(kw)
        else: s.update(kw)
        tmp = state_path(rid) + '.tmp'
        json.dump(s, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(tmp, state_path(rid))


def up8(im, k=8, bg=(150, 154, 160, 255)):
    b = Image.new('RGBA', (im.width * k, im.height * k), bg); b.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST)); return b


def reference_img():
    r = seed()['reference']
    return Image.open(os.path.join(ROOT, r['png'])).convert('RGBA').crop(tuple(r['box']))


def old_img(vehicle, view):
    p = os.path.join(DATA, 'old', f'{vehicle}-{view}.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


def anchors(vehicle, view):
    return sorted(glob.glob(os.path.join(DATA, 'picked', f'{vehicle}-*.png')))


def make_brief(rid, vehicle, view, note):
    s = seed(); v = s['vehicles'][vehicle]; vw = v['views'][view]; b = os.path.join(rdir(rid), 'brief'); os.makedirs(b, exist_ok=True)
    ref = reference_img(); up8(ref).save(os.path.join(b, 'ref-x8.png'))
    old = old_img(vehicle, view)
    if old: up8(old).save(os.path.join(b, 'old-x8.png'))
    an = []
    for p in anchors(vehicle, view):
        shutil.copy(p, os.path.join(b, 'anchor-' + os.path.basename(p))); up8(Image.open(p).convert('RGBA')).save(os.path.join(b, 'anchor-x8-' + os.path.basename(p))); an.append(os.path.basename(p))
    L = ledger(); rej = [r for r in L['rejects'] if r['vehicle'] == vehicle and r['view'] == view]
    md = [f'# {v["title"]} · {view} — 작업지시서', '', f'- 설명: {v["desc"]} / 시점: {vw["desc"]} / 캔버스 {vw["w"]}x{vw["h"]}', '',
          '## 그림', '- `ref-x8.png` — **기준차**(modern-city-atlas 경찰차, 8배). ' + s['reference']['note'],
          '- `old-x8.png` — 지금 쓰던 차(8배). 이 시점 규칙을 못 지켜 폐기 대상. 나빠지면 안 되는 비율·디테일은 여기서 가져와도 된다.' if old else '- (이 시점은 지금 것이 없다)']
    for a in an: md.append(f'- `anchor-x8-{a}` — 사용자가 고른 같은 탈것의 다른 시점. 화풍·색 기준.')
    md += ['', '## 계약'] + ['- ' + c for c in s['contract']] + ['', '## 팔레트 글자 (이 밖의 글자·색 금지)', PAL.legend(), '- `~` = 바닥 그림자(반투명, `@layer shadow` 에)']
    if rej: md += ['', '## 하지 말 것 (사용자가 버린 후보와 이유)'] + [f'- {r["why"]}' for r in rej]
    if note: md += ['', '## 사용자 메모', note]
    open(os.path.join(b, 'brief.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    return b


def worker_prompt(st, letter, redraw=''):
    s = seed(); v = s['vehicles'][st['vehicle']]; vw = v['views'][st['view']]
    t = open(os.path.join(HERE, 'prompt.md'), encoding='utf-8').read()
    folder = os.path.relpath(rdir(st['id']), ROOT)
    rep = dict(ROOT=ROOT, TITLE=v['title'], DESC=v['desc'], VIEW=st['view'], VIEWDESC=vw['desc'], W=vw['w'], H=vw['h'], BRIEF=os.path.join(rdir(st['id']), 'brief'),
               LETTER=letter, DIRECTION=DIRECTIONS[letter], FOLDER=folder, OUT=letter, REDRAW=redraw,
               PAL=os.path.relpath(os.path.join(DATA, 'vehicles.pal'), rdir(st['id'])))
    for k, val in rep.items(): t = t.replace('{' + k + '}', str(val))
    return t


def run_claude(prompt, log, effort, images=()):
    """VEH_HARNESS_BACKEND=codex 이면 codex exec 로, 아니면 claude -p 로 작업자를 띄운다."""
    if os.environ.get('VEH_HARNESS_BACKEND') == 'codex':
        cmd = ['codex', 'exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '-C', ROOT,
               '-c', f'model_reasoning_effort="{os.environ.get("VEH_CODEX_EFFORT", "high")}"']
        if os.environ.get('VEH_CODEX_MODEL'): cmd += ['-m', os.environ['VEH_CODEX_MODEL']]
        for im in images: cmd += ['-i', im]
        cmd += ['-']   # 프롬프트는 stdin
        stdin_data = prompt
    else:
        env0 = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=MODEL, PH_EFFORT=effort)
        cmd = ['bash', '-lc', 'exec "$PH_CLAUDE" -p "$PH_PROMPT" --model "$PH_MODEL" --effort "$PH_EFFORT" --dangerously-skip-permissions --output-format text']
        stdin_data = None
    env = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=MODEL, PH_EFFORT=effort)
    with open(log, 'w') as f:
        p = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=f, stderr=subprocess.STDOUT,
                             stdin=subprocess.PIPE if stdin_data else subprocess.DEVNULL, start_new_session=True, text=True)
        if stdin_data:
            p.stdin.write(stdin_data); p.stdin.close()
        try: return p.wait(timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, 15); return 'timeout'


def check(st, letter):
    vw = seed()['vehicles'][st['vehicle']]['views'][st['view']]
    base = os.path.join(rdir(st['id']), letter)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'check.py'), base + '.pxg', '--w', str(vw['w']), '--h', str(vw['h']), '--view', st['view']], cwd=ROOT, capture_output=True, text=True)
    try: return json.load(open(base + '.check.json'))
    except Exception: return {'ok': False, 'hard': [(r.stdout + r.stderr)[-400:]], 'soft': {}}


def review_pack(st, letter, att):
    pack = os.path.join(rdir(st['id']), 'brief', 'review', f'{letter}-a{att}'); os.makedirs(pack, exist_ok=True)
    cand = Image.open(os.path.join(rdir(st['id']), letter + '.png')).convert('RGBA')
    ref = reference_img(); old = old_img(st['vehicle'], st['view'])
    parts = [up8(ref)] + ([up8(old)] if old else []) + [up8(cand)]
    W = sum(p.width for p in parts) + 24 * (len(parts) - 1); H = max(p.height for p in parts)
    pair = Image.new('RGBA', (W, H), (150, 154, 160, 255)); x = 0
    for p in parts: pair.alpha_composite(p, (x, H - p.height)); x += p.width + 24
    pair.save(os.path.join(pack, 'pair-x8.png')); up8(cand).save(os.path.join(pack, 'cand-x8.png'))
    row = [ref] + ([old] if old else []) + [cand]; k = 3
    W = sum(i.width * k for i in row) + 30 * (len(row) + 1); H = max(i.height * k for i in row) + 60
    st_ = Image.new('RGBA', (W, H), (150, 154, 160, 255)); x = 30
    for i in row:
        st_.alpha_composite(i.resize((i.width * k, i.height * k), Image.NEAREST), (x, H - 30 - i.height * k)); x += i.width * k + 30
    st_.save(os.path.join(pack, 'street-x3.png'))
    return pack


def review_prompt(st, letter, att, prev):
    pack = review_pack(st, letter, att)
    t = open(os.path.join(HERE, 'review.md'), encoding='utf-8').read()
    an = anchors(st['vehicle'], st['view'])
    rep = dict(ROOT=ROOT, TITLE=seed()['vehicles'][st['vehicle']]['title'], VIEW=st['view'], CAND=os.path.join(rdir(st['id']), letter + '.png'), ATTEMPT=att, MAX=MAX_ATTEMPTS,
               LETTER=letter, DIRECTION=DIRECTIONS[letter], PACK=pack,
               ANCHORS=('5. 사용자가 고른 같은 탈것의 다른 시점(화풍 기준): ' + ', '.join(an)) if an else '',
               PREV=('## 지난 시도의 지적 (이번에 고쳐졌나 확인)\n' + prev) if prev else '')
    for k, val in rep.items(): t = t.replace('{' + k + '}', str(val))
    return t, pack


def do_candidate(rid, letter):
    st = load_state(rid); out = os.path.join(rdir(rid), letter); prev = ''; hist = []
    for att in range(1, MAX_ATTEMPTS + 1):
        upd(rid, letter, status='drawing', attempt=att)
        redraw = ''
        if att > 1:
            for ext in ('.pxg', '.png', '-x4.png', '.note'):
                if os.path.exists(out + ext): shutil.copyfile(out + ext, f'{out}.a{att-1}{ext}')
            redraw = (f'\n**다시 그리기 ({att}/{MAX_ATTEMPTS})**: `{os.path.relpath(out, ROOT)}.pxg` 가 지난 시도다. 복사하지 말고 그 파일을 고쳐 다시 굽는다. 지난 시도의 지적:\n{prev}\n')
        bd = os.path.join(rdir(rid), 'brief'); imgs = [p for p in (os.path.join(bd, 'ref-x8.png'), os.path.join(bd, 'old-x8.png'), out + '-x4.png' if att > 1 else '') if p and os.path.exists(p)]
        code = run_claude(worker_prompt(st, letter, redraw), os.path.join(rdir(rid), 'logs', f'{letter}.a{att}.log'), EFFORT, imgs)
        if not os.path.exists(out + '.pxg'):
            upd(rid, letter, status='failed', error=f'후보 파일 없음({code})'); return
        ck = check(st, letter)
        if not ck['ok']:
            prev = '기계 검사 불합격: ' + '; '.join(ck['hard']); hist.append(dict(stage='hard', attempt=att, hard=ck['hard']))
            upd(rid, letter, history=hist, check=ck)
            if att == MAX_ATTEMPTS: upd(rid, letter, status='done', ok=False, review=dict(verdict='HARD', reasons=prev)); return
            continue
        upd(rid, letter, status='reviewing', check=ck)
        rp, pack = review_prompt(st, letter, att, prev)
        vfile = os.path.join(pack, 'verdict.json')
        for _ in range(2):
            run_claude(rp, os.path.join(rdir(rid), 'logs', f'{letter}.a{att}.review.log'), EFFORT, [os.path.join(pack, n) for n in ('pair-x8.png', 'street-x3.png')])
            if os.path.exists(vfile): break
        try: v = json.load(open(vfile, encoding='utf-8')); v['verdict'] = str(v.get('verdict', '')).upper()
        except Exception: v = dict(verdict='ERROR', reasons='검수자가 결과를 못 냈다')
        v['attempt'] = att; hist.append(dict(stage='review', attempt=att, review=v)); upd(rid, letter, history=hist, review=v)
        if v['verdict'] == 'PASS' or v['verdict'] == 'ERROR' or att == MAX_ATTEMPTS:
            upd(rid, letter, status='done', ok=v['verdict'] == 'PASS'); return
        prev = f'검수 불합격 {v.get("codes")}: {v.get("reasons")}\n고칠 것: {v.get("fix")}'
    upd(rid, letter, status='done', ok=False)


def cmd_draw(a):
    s = seed()
    if a.backend: os.environ['VEH_HARNESS_BACKEND'] = a.backend
    if a.vehicle not in s['vehicles'] or a.view not in s['vehicles'][a.vehicle]['views']: sys.exit('모르는 탈것/시점: ' + a.vehicle + ' ' + a.view)
    rid = 'v' + datetime.datetime.now().strftime('%m%d-%H%M%S'); os.makedirs(os.path.join(rdir(rid), 'logs'), exist_ok=True)
    PAL.write_pal(os.path.join(DATA, 'vehicles.pal'))
    make_brief(rid, a.vehicle, a.view, a.note)
    letters = LETTERS[:a.n]
    json.dump(dict(id=rid, vehicle=a.vehicle, view=a.view, note=a.note, backend=os.environ.get('VEH_HARNESS_BACKEND', 'claude'), created=now(), cands={l: dict(status='queued') for l in letters}), open(state_path(rid), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if a.fg: return run_round(rid)
    subprocess.Popen([sys.executable, os.path.abspath(__file__), '_run', rid], cwd=ROOT, start_new_session=True,
                     stdout=open(os.path.join(rdir(rid), 'logs', 'round.log'), 'w'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    print(rid)


def run_round(rid):
    st = load_state(rid)
    with cf.ThreadPoolExecutor(max_workers=len(st['cands'])) as ex:
        list(ex.map(lambda l: do_candidate(rid, l), list(st['cands'])))
    upd(rid, ended=now()); cmd_sheet(argparse.Namespace(round=rid))


def cmd_review(a):
    st = load_state(a.round)
    def one(l):
        att = (st['cands'][l].get('attempt') or 1); rp, pack = review_prompt(st, l, att, '')
        run_claude(rp, os.path.join(rdir(a.round), 'logs', f'{l}.a{att}.rereview.log'), EFFORT)
        try: v = json.load(open(os.path.join(pack, 'verdict.json'), encoding='utf-8')); upd(a.round, l, review=v, ok=str(v.get('verdict')).upper() == 'PASS')
        except Exception: pass
    with cf.ThreadPoolExecutor(max_workers=len(st['cands'])) as ex: list(ex.map(one, list(st['cands'])))
    cmd_sheet(a)


def cmd_status(a):
    rounds = [a.round] if a.round else sorted(os.listdir(RUNS)) if os.path.isdir(RUNS) else []
    for rid in rounds:
        try: st = load_state(rid)
        except Exception: continue
        print(f'{rid} {st["vehicle"]}/{st["view"]} {"끝" if st.get("ended") else "진행"}')
        for l, c in st['cands'].items():
            v = c.get('review') or {}
            print(f'  {l} {c.get("status")} 시도{c.get("attempt","-")} {"✓" if c.get("ok") else "✗" if c.get("ok") is False else " "} {v.get("verdict","")} {v.get("codes","") or ""}')


def b64(path): return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def cmd_sheet(a):
    st = load_state(a.round); rid = a.round; os.makedirs(VIZ, exist_ok=True)
    ref = reference_img(); old = old_img(st['vehicle'], st['view'])
    def img(im, k=6):
        buf = io.BytesIO(); im.resize((im.width * k, im.height * k), Image.NEAREST).save(buf, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    cards = [('기준: modern-city-atlas 경찰차', img(ref), '')] + ([('지금 것(폐기 대상)', img(old), '')] if old else [])
    for l, c in st['cands'].items():
        p = os.path.join(rdir(rid), l + '.png')
        if not os.path.exists(p): continue
        v = c.get('review') or {}
        tag = ('✓ 검수 통과' if c.get('ok') else '✗ ' + (v.get('verdict', '미통과')) + ' ' + ','.join(v.get('codes') or []))
        why = (v.get('surfaces') or '') + (' · ' + v.get('reasons', '') if not c.get('ok') else '')
        note = open(os.path.join(rdir(rid), l + '.note'), encoding='utf-8').read().strip() if os.path.exists(os.path.join(rdir(rid), l + '.note')) else ''
        cards.append((f'{l}  {DIRECTIONS[l].split(" — ")[0]}  [{tag}]', img(Image.open(p).convert('RGBA')), (note + '\n' + why).strip()))
    html = ['<!doctype html><meta charset=utf-8><title>탈것 후보 ' + rid + '</title><style>body{background:#2a2d31;color:#eee;font:14px sans-serif;margin:16px}'
            '.r{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end;background:#969aa0;padding:14px;border-radius:6px}figure{margin:0;max-width:560px}figcaption{color:#111;font-size:13px;margin:4px 0}'
            'img{image-rendering:pixelated;display:block}small{color:#222;display:block;max-width:520px}</style>',
            f'<h3>{st["vehicle"]} · {st["view"]} · 판 {rid}</h3><div class=r>']
    for cap, src, sm in cards: html.append(f'<figure><figcaption>{cap}</figcaption><img src="{src}"><small>{sm}</small></figure>')
    html.append('</div><p>고르면: <code>harness.py pick ' + rid + ' &lt;글자&gt;</code> — 버리면 <code>reject ' + rid + ' &lt;글자&gt; --why …</code></p>')
    open(os.path.join(VIZ, f'veh-{rid}.html'), 'w', encoding='utf-8').write('\n'.join(html))
    print(f'http://mdc-server:18301/veh-{rid}.html')


def cmd_pick(a):
    st = load_state(a.round); os.makedirs(os.path.join(DATA, 'picked'), exist_ok=True)
    for ext in ('.pxg', '.png'):
        shutil.copyfile(os.path.join(rdir(a.round), a.letter + ext), os.path.join(DATA, 'picked', f'{st["vehicle"]}-{st["view"]}{ext}'))
    L = ledger(); L['picks'].append(dict(round=a.round, letter=a.letter, vehicle=st['vehicle'], view=st['view'], note=a.note, at=now(), by='user')); save_ledger(L)
    print('기록: harness-data/modern-chipset/picked/' + f'{st["vehicle"]}-{st["view"]}.pxg')


def cmd_reject(a):
    st = load_state(a.round); L = ledger()
    L['rejects'].append(dict(round=a.round, letter=a.letter, vehicle=st['vehicle'], view=st['view'], why=a.why, at=now())); save_ledger(L); print('기록')


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('palette')
    d = sub.add_parser('draw'); d.add_argument('vehicle'); d.add_argument('view'); d.add_argument('--n', type=int, default=5); d.add_argument('--note', default=''); d.add_argument('--fg', action='store_true'); d.add_argument('--backend', choices=['claude', 'codex'], default=None)
    r = sub.add_parser('_run'); r.add_argument('round')
    s = sub.add_parser('status'); s.add_argument('round', nargs='?')
    for n in ('sheet', 'review'): x = sub.add_parser(n); x.add_argument('round')
    p = sub.add_parser('pick'); p.add_argument('round'); p.add_argument('letter'); p.add_argument('--note', default='')
    j = sub.add_parser('reject'); j.add_argument('round'); j.add_argument('letter'); j.add_argument('--why', required=True)
    a = ap.parse_args()
    {'palette': lambda: PAL.write_pal(os.path.join(DATA, 'vehicles.pal')), 'draw': lambda: cmd_draw(a), '_run': lambda: run_round(a.round), 'status': lambda: cmd_status(a),
     'sheet': lambda: cmd_sheet(a), 'review': lambda: cmd_review(a), 'pick': lambda: cmd_pick(a), 'reject': lambda: cmd_reject(a)}[a.cmd]()


if __name__ == '__main__': main()
