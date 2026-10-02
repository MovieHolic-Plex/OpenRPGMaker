#!/usr/bin/env python3
"""캐릭터 칩 하네스 — Actor1 을 뼈대로, AI 가 픽셀을 직접 찍어 RM2000 캐릭터(72×128, 3프레임×4방향)를 만든다.

  python3 src/harnesses/charset-actor/harness.py calibrate              # 기계 검수가 Actor1 8명을 전부 통과시키는지
  python3 src/harnesses/charset-actor/harness.py base 0 out.chr.txt      # Actor1 n번째 캐릭터를 격자 글자로
  python3 src/harnesses/charset-actor/harness.py check F.chr.txt [--base 0]         # 기계 검수(JSON)
  python3 src/harnesses/charset-actor/harness.py views F.chr.txt OUTDIR [--base 0]  # 8배 시트·필름 띠·GIF 3종
  python3 src/harnesses/charset-actor/harness.py draw <brief> --engine sonnet|gpt [--run R]   # 작업자 띄우기(백그라운드)
  python3 src/harnesses/charset-actor/harness.py status [--run R]
  python3 src/harnesses/charset-actor/harness.py page --run R            # 비교 화면 → ~/claude-viz/charset-actor-<R>.html

생성 이미지 금지: 작업자는 격자 글자(.chr.txt)를 직접 고친다. 그림 생성 모델·외부 그림 변환은 쓰지 않는다.
감독은 고르지 않는다 — 후보를 나란히 보여 주고 사용자가 판정한다.
"""
import argparse
import base64
import html
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
from PIL import Image  # noqa: E402

ACTOR1 = ROOT / 'public' / 'assets' / 'easyrpg' / 'charset' / 'Actor1.png'
ACTOR1_FACE = ROOT / 'public' / 'assets' / 'easyrpg' / 'faceset' / 'Actor1.png'   # 칩 n번 ↔ 얼굴 n번 (sharedCharacterGraphics.json)
HDATA = ROOT / 'harness-data' / 'charset-actor'
LAWN = HDATA / 'lawn16.png'
DATA = Path(os.environ.get('CHR_HARNESS_DATA', os.path.expanduser('~/.local/share/oprn/charset-actor-harness')))
VIZ = Path(os.path.expanduser('~/claude-viz'))
ENGINES = {
    'sonnet': dict(label='Claude Sonnet 5.5 · medium', model='claude-sonnet-5-5', effort='medium'),
    'gpt': dict(label='GPT 6.1 sol · medium', model='gpt-6.1-sol', effort='medium'),
    'opus': dict(label='Claude Opus 5.5 · high', model='claude-opus-5-5', effort='high'),
}
CLAUDE_ENGINES = ('sonnet', 'opus')
DEFAULT_KEEP = ('몸 비율·머리 크기·팔다리 위치·걸음 동작(다리 모양과 1px 출렁임)은 뼈대 그대로 둔다. 바꾸는 것은 머리 모양, 옷, 색, '
                '소지품이다. 지시한 옷·머리가 뼈대보다 크거나 길면(망토·긴 치마·큰 짐) 그 부분의 실루엣은 바뀌어도 된다.')
TIMEOUT_S = int(os.environ.get('CHR_HARNESS_TIMEOUT', str(60 * 60)))


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def briefs():
    return json.loads((HDATA / 'briefs.json').read_text(encoding='utf-8'))


def base_of(n):
    pal, _, frames = C.from_actor(ACTOR1, int(n))
    return pal, frames


# ─────────────────────────────── 명령 ───────────────────────────────
def cmd_calibrate(_):
    bad = 0
    for i in range(8):
        pal, _, frames = C.from_actor(ACTOR1, i)
        r = C.gate(pal, frames)
        print(i, 'OK' if r['ok'] else 'FAIL', r['fails'], r['metrics'].get('colors'), r['metrics'].get('dark_edge_min'))
        bad += not r['ok']
    sys.exit(1 if bad else 0)


def cmd_base(a):
    pal, notes, frames = C.from_actor(ACTOR1, a.n)
    Path(a.out).write_text(C.dump(pal, notes, frames, header=f'Actor1 {a.n}번 캐릭터 (뼈대). 색 글자는 어두운 것부터 a,b,c…'),
                           encoding='utf-8')
    print(a.out)


def cmd_check(a):
    pal, _, frames = C.load(a.file)
    r = C.gate(pal, frames, base_of(a.base) if a.base is not None else None)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    sys.exit(0 if r['ok'] else 1)


def make_views(file, out, base_n=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    pal, _, frames = C.load(file)
    se = C.structural_errors(pal, frames)
    if se:
        raise C.GridError('; '.join(se[:5]))
    base = base_of(base_n) if base_n is not None else None
    C.sheet_keyed(pal, frames).save(out / 'sheet.png')
    C.sheet_big(pal, frames, 8).save(out / 'sheet_x8.png')
    C.strip(pal, frames, 6, base).save(out / 'strip.png')
    C.gif_walk(pal, frames, out / 'walk.gif', 4, LAWN)
    C.gif_turn(pal, frames, out / 'turn.gif', 4, LAWN)
    C.gif_stroll(pal, frames, out / 'stroll.gif', 3, LAWN)
    C.context(pal, frames, ACTOR1, 3, LAWN).save(out / 'context.png')
    r = C.gate(pal, frames, base)
    (out / 'gate.json').write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding='utf-8')
    return r


def cmd_views(a):
    r = make_views(a.file, a.out, a.base)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print('그림:', ', '.join(sorted(p.name for p in Path(a.out).iterdir())))


def run_dir(run):
    return DATA / 'runs' / run


def start_draw(brief, engine, run, w, src=None, fix_text=None):
    """작업자 하나를 백그라운드로 띄운다 → Popen. src 가 있으면 그 결과(out.chr.txt)에서 시작해 fix_text 를 고친다."""
    b = briefs()[brief]
    eng = ENGINES[engine]
    w.mkdir(parents=True, exist_ok=True)
    base_txt = w / 'base.chr.txt'
    pal, notes, frames = C.from_actor(ACTOR1, b['base'])
    base_txt.write_text(C.dump(pal, notes, frames, header=f'Actor1 {b["base"]}번 캐릭터 (뼈대) — 고치지 말 것, 복사해서 쓴다'),
                        encoding='utf-8')
    make_views(base_txt, w / 'base-views')
    tool = f'python3 {HERE / "harness.py"}'
    t = (HERE / 'worker.md').read_text(encoding='utf-8')
    rep = {'{TOOL}': tool, '{DIR}': str(w), '{BASE_N}': str(b['base']), '{NAME}': b['name'], '{BRIEF}': b['brief'],
           '{KEEP}': b.get('keep', DEFAULT_KEEP), '{ACTOR1}': str(ACTOR1)}
    for k, v in rep.items():
        t = t.replace(k, v)
    if src:
        # 수정 작업: 다른 작업자(또는 이전 판)의 결과에서 시작한다. 지적은 감독·검수자가 쓴 글을 그대로 붙인다.
        shutil.copy(src / 'out.chr.txt', w / 'start.chr.txt')
        make_views(w / 'start.chr.txt', w / 'start-views', b['base'])
        t += (HERE / 'fixer.md').read_text(encoding='utf-8').replace('{FIX}', fix_text or '(지적 없음 — 스스로 찾아 고친다)') \
            .replace('{SRC}', str(src))
    (w / 'prompt.md').write_text(t, encoding='utf-8')
    p = _spawn(engine, w, w / 'prompt.md', w / 'worker.log')
    meta = dict(run=run, brief=brief, engine=engine, label=eng['label'], model=eng['model'], effort=eng['effort'],
                pid=p.pid, started=now(), dir=str(w), base=b['base'], src=str(src) if src else None)
    if src:
        meta['label'] += f' — {json.loads((src / "meta.json").read_text())["label"]} 결과를 수정'
    (w / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    return p, meta


def _spawn(engine, cwd, prompt, log):
    eng = ENGINES[engine]
    if engine in CLAUDE_ENGINES:
        cmd = [shutil.which('claude') or 'claude', '-p', '--model', eng['model'], '--effort', eng['effort'],
               '--dangerously-skip-permissions', '--add-dir', str(HERE), '--output-format', 'text']
    else:
        cmd = [shutil.which('codex') or os.path.expanduser('~/.local/bin/codex'), 'exec', '-m', eng['model'],
               '-c', f'model_reasoning_effort="{eng["effort"]}"', '--skip-git-repo-check', '-s', 'workspace-write',
               '--add-dir', str(HERE), '-C', str(cwd), '-']
    return subprocess.Popen(['timeout', str(TIMEOUT_S)] + cmd, cwd=cwd, stdin=open(prompt, 'rb'), stdout=open(log, 'w'),
                            stderr=subprocess.STDOUT, start_new_session=True)


def cmd_draw(a):
    run = a.run or datetime.now().strftime('%Y%m%d-%H%M')
    src = Path(a.src).expanduser() if a.src else None
    tag = a.engine + (f'-fix-{a.tag or src.name.split("__")[-1]}' if src else '')
    w = run_dir(run) / f'{a.brief}__{tag}'
    if w.exists() and any(w.iterdir()) and not a.force:
        sys.exit(f'이미 있다: {w} (--force 로 덮기)')
    fix = Path(a.fix_notes).read_text(encoding='utf-8') if a.fix_notes else None
    _, meta = start_draw(a.brief, a.engine, run, w, src, fix)
    print(json.dumps(meta, ensure_ascii=False))


# ─────────────────────────────── 검수자 ───────────────────────────────
def start_review(w, engine='sonnet'):
    """독립 검수자 — 작업자의 메모는 주지 않고 그림·기계 검수·지시만 준다. 결과는 w/review/verdict.json."""
    meta = json.loads((w / 'meta.json').read_text())
    b = briefs()[meta['brief']]
    rv = w / 'review'
    if rv.exists():
        shutil.rmtree(rv)
    rv.mkdir()
    v = w / 'views'
    make_views(w / 'out.chr.txt', v, b['base'])
    for n in ('strip.png', 'sheet_x8.png', 'context.png', 'gate.json'):
        shutil.copy(v / n, rv / n)
    shutil.copy(w / 'base-views' / 'strip.png', rv / 'base_strip.png')
    t = (HERE / 'reviewer.md').read_text(encoding='utf-8')
    for k, val in {'{NAME}': b['name'], '{BRIEF}': b['brief'], '{KEEP}': b.get('keep', DEFAULT_KEEP), '{DIR}': str(rv),
                   '{BASE_N}': str(b['base'])}.items():
        t = t.replace(k, val)
    (rv / 'prompt.md').write_text(t, encoding='utf-8')
    return _spawn(engine, rv, rv / 'prompt.md', rv / 'review.log')


def read_verdict(w):
    f = w / 'review' / 'verdict.json'
    try:
        v = json.loads(f.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    gate = json.loads((w / 'views' / 'gate.json').read_text())
    v['verdict'] = str(v.get('verdict', '')).upper()
    if not gate['ok']:
        # 기계 검수가 막으면 검수자 판정과 상관없이 불합격
        v['verdict'] = 'FAIL'
        v.setdefault('issues', []).insert(0, dict(severity='high', where='기계 검수', what='; '.join(gate['fails']),
                                                   fix='기계 검수를 통과시켜라'))
    return v


def fix_text_from(v):
    lines = []
    for it in v.get('issues', []):
        lines.append(f"- [{it.get('severity', '?')}] {it.get('where', '')}: {it.get('what', '')} → 고칠 것: {it.get('fix', '')}")
    if v.get('good'):
        lines.append('\n검수자가 잘 됐다고 본 것(살릴 것): ' + ' / '.join(v['good']))
    return '\n'.join(lines) or '(검수자 지적 없음)'


def _wait(p):
    p.wait()


def run_loop(brief, run, drawer, reviewer, rounds, log, face=None):
    prev = None
    for r in range(1, rounds + 1):
        w = run_dir(run) / f'{brief}__{drawer}-r{r}'
        if w.exists():
            shutil.rmtree(w)
        fix = fix_text_from(read_verdict(prev)) if prev else None
        p, _ = start_draw(brief, drawer, run, w, prev, fix)
        log(f'{brief} r{r}: {drawer} 그리기 시작 pid={p.pid}')
        _wait(p)
        if not (w / 'out.chr.txt').exists():
            log(f'{brief} r{r}: 결과 없음 — 멈춤')
            return
        make_views(w / 'out.chr.txt', w / 'views', briefs()[brief]['base'])
        rp = start_review(w, reviewer)
        log(f'{brief} r{r}: {reviewer} 검수 시작 pid={rp.pid}')
        _wait(rp)
        v = read_verdict(w)
        if v is None:
            log(f'{brief} r{r}: 검수 결과 없음 — 멈춤')
            return
        log(f'{brief} r{r}: {v["verdict"]} 점수 {v.get("score")} 지적 {len(v.get("issues", []))}개')
        if v['verdict'] == 'PASS' or r == rounds:
            if face:
                fp = start_face(w, face)
                log(f'{brief} r{r}: {face} 얼굴 시작 pid={fp.pid}')
                fp.wait()
                fr = finish_face(w)
                log(f'{brief} r{r}: 얼굴 {"통과" if fr and fr["ok"] else "불통과/없음"}')
            return
        prev = w


def cmd_loop(a):
    import threading
    run = a.run or datetime.now().strftime('%Y%m%d-%H%M')
    run_dir(run).mkdir(parents=True, exist_ok=True)
    lf = open(run_dir(run) / 'loop.log', 'a')
    lock = threading.Lock()

    def log(msg):
        with lock:
            line = f'{datetime.now().strftime("%H:%M:%S")} {msg}'
            print(line, flush=True)
            lf.write(line + '\n')
            lf.flush()
    from concurrent.futures import ThreadPoolExecutor
    names = list(briefs()) if a.briefs == ['all'] else a.briefs
    with ThreadPoolExecutor(max_workers=a.par) as ex:  # codex 동시 실행 수 제한
        for f in [ex.submit(run_loop, b, run, a.drawer, a.reviewer, a.rounds, log, a.face or None) for b in names]:
            try:
                f.result()
            except Exception as e:  # noqa: BLE001 — 한 캐릭터가 죽어도 나머지는 계속
                log(f'오류: {e!r}')
    log('끝')


def _alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def cmd_status(a):
    runs = [run_dir(a.run)] if a.run else sorted((DATA / 'runs').glob('*'))
    for r in runs:
        for w in sorted(r.glob('*__*')):
            m = json.loads((w / 'meta.json').read_text())
            out = w / 'out.chr.txt'
            st = 'running' if _alive(m['pid']) else ('done' if out.exists() else 'no-output')
            print(r.name, w.name, st, m['started'], (w / 'worker.log').stat().st_size, 'B log')


def _data_uri(p):
    mime = 'image/gif' if str(p).endswith('.gif') else 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(Path(p).read_bytes()).decode()


def cmd_page(a):
    rd = run_dir(a.run)
    cards = []
    base_done = set()
    ws = sorted(rd.glob('*__*'), key=lambda w: ('-fix-' in w.name, w.name))  # 처음부터 그린 것 먼저, 수정본은 뒤에
    for w in ws:
        m = json.loads((w / 'meta.json').read_text())
        if m['base'] not in base_done:
            base_done.add(m['base'])
            bv = w / 'base-views'
            cards.append(dict(title=f'뼈대 — Actor1 {m["base"]}번 (원본)', views=bv, gate=None, notes='', base=True))
        out = w / 'out.chr.txt'
        if not out.exists():
            cards.append(dict(title=m['label'] + ' · ' + w.name.split('__')[-1], views=None, gate=None, notes='(아직 그리는 중)', base=False))
            continue
        v = w / 'views'
        r = make_views(out, v, m['base'])
        notes = (w / 'notes.md').read_text(encoding='utf-8') if (w / 'notes.md').exists() else ''
        rv = read_verdict(w)
        title = m['label'] + (f' · {w.name.rsplit("-", 1)[-1]}' if w.name.split('__')[-1].count('-r') else '')
        cards.append(dict(title=title, views=v, gate=r, notes=notes, base=False, review=rv))
    b = briefs()
    brief_txt = '<br>'.join(html.escape(f'{v["name"]}: {v["brief"]}') for v in b.values())
    parts = []
    for c in cards:
        if c['views'] is None:
            parts.append(f'<section class=card><h2>{html.escape(c["title"])}</h2><p>{html.escape(c["notes"])}</p></section>')
            continue
        v = c['views']
        g = c['gate']
        gate_html = ''
        if g is not None:
            mm = g['metrics']
            gate_html = (f'<div class="gate {"ok" if g["ok"] else "bad"}">기계 검수 {"통과" if g["ok"] else "불통과"}'
                         + ''.join(f'<div class=f>✗ {html.escape(x)}</div>' for x in g['fails'])
                         + ''.join(f'<div class=w>△ {html.escape(x)}</div>' for x in g['warns'])
                         + f'<div class=m>색 {mm.get("colors")} · 원본과 다른 픽셀 {mm.get("changed_vs_base", 0):.0%}'
                         + f' · 실루엣 바뀐 픽셀 {mm.get("silhouette_changed_px")} · 윤곽 어두움 최저 {mm.get("dark_edge_min", 0):.0%}</div></div>')
        rv = c.get('review')
        rv_html = ''
        if rv:
            rv_html = (f'<div class="gate {"ok" if rv["verdict"] == "PASS" else "bad"}">검수자(Sonnet 5.5 medium) '
                       f'<b>{html.escape(rv["verdict"])}</b> · 점수 {html.escape(str(rv.get("score")))}'
                       + ''.join(f'<div class={"f" if i.get("severity") in ("high", "mid") else "w"}>[{html.escape(str(i.get("severity")))}] '
                                 f'{html.escape(str(i.get("where", "")))} — {html.escape(str(i.get("what", "")))}'
                                 f'<div class=m>고칠 것: {html.escape(str(i.get("fix", "")))}</div></div>' for i in rv.get('issues', []))
                       + (f'<div class=m>잘 된 점: {html.escape(" / ".join(map(str, rv.get("good", []))))}</div>' if rv.get('good') else '')
                       + '</div>')
        parts.append(f'''<section class="card{' base' if c['base'] else ''}"><h2>{html.escape(c['title'])}</h2>
<div class=row><figure><img src="{_data_uri(v / 'walk.gif')}"><figcaption>걷기 4방향 (4배)</figcaption></figure>
<figure><img src="{_data_uri(v / 'turn.gif')}"><figcaption>돌기 (4배)</figcaption></figure>
<figure><img src="{_data_uri(v / 'stroll.gif')}"><figcaption>칸 위를 걷기 (3배)</figcaption></figure>
<figure><img class=one src="{_data_uri(v / 'sheet.png')}"><figcaption>1배 (게임 크기)</figcaption></figure></div>
<details><summary>8배 시트 · 필름 띠 · Actor1 옆에 세운 그림(검수자가 보는 그림)</summary><div class=row>
<img src="{_data_uri(v / 'sheet_x8.png')}"><img src="{_data_uri(v / 'strip.png')}"><img src="{_data_uri(v / 'context.png')}"></div></details>
{gate_html}{rv_html}{'<details><summary>작업자 메모</summary><pre>' + html.escape(c['notes']) + '</pre></details>' if c['notes'] else ''}
</section>''')
    page = f'''<!doctype html><meta charset=utf-8><title>캐릭터 칩 하네스 {a.run}</title>
<style>body{{background:#1d1f24;color:#e6e6e6;font:14px/1.5 system-ui,sans-serif;margin:20px}}
h1{{font-size:18px}} .card{{background:#2a2d34;border-radius:8px;padding:12px 16px;margin:14px 0}} .card.base{{opacity:.9;border:1px dashed #666}}
h2{{font-size:16px;margin:4px 0 10px}} .row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}}
figure{{margin:0}} figcaption{{font-size:12px;color:#aaa}} img{{image-rendering:pixelated;display:block}} img.one{{zoom:1}}
.gate{{margin-top:10px;padding:8px;border-radius:6px}} .gate.ok{{background:#21402a}} .gate.bad{{background:#4a2323}}
.f{{color:#ff9a9a}} .w{{color:#e8d27a}} .m{{color:#bbb;font-size:12px}} pre{{white-space:pre-wrap;font-size:12px}}
summary{{cursor:pointer;color:#9cc;margin-top:8px}}</style>
<h1>캐릭터 칩 하네스 — 실행 {html.escape(a.run)}</h1><p>{brief_txt}</p>
<p style="color:#aaa">두 작업자가 같은 뼈대(Actor1)와 같은 지시로 픽셀을 직접 찍었다(생성 이미지 없음). 고르는 건 사용자.</p>
{''.join(parts)}'''
    VIZ.mkdir(exist_ok=True)
    out = VIZ / f'charset-actor-{a.run}.html'
    out.write_text(page, encoding='utf-8')
    print(out, f'http://mdc-server:18301/{out.name}')


# ─────────────────────────────── 얼굴 ───────────────────────────────
def base_face(n):
    pal, _, rows = C.from_faceset(ACTOR1_FACE, int(n))
    return pal, rows


def make_face_views(file, out, base_n, chip_dir=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    pal, _, rows = C.parse_face(Path(file).read_text(encoding='utf-8'))
    r = C.face_gate(pal, rows, base_face(base_n))
    if not r['fails'] or len(rows) == C.FACE:
        try:
            im = C.face_rgba(pal, rows)
            im.save(out / 'face.png')
            C.up(im, 4).save(out / 'face_x4.png')
            bp, brows = base_face(base_n)
            parts = [C.up(C.face_rgba(bp, brows), 4), C.up(im, 4)]
            if chip_dir and (Path(chip_dir) / 'out.chr.txt').exists():
                cp, _, cf = C.load(Path(chip_dir) / 'out.chr.txt')
                parts.append(C.up(C.frame_rgba(cp, cf[('down', 1)]), 6))
            W = sum(p.width for p in parts) + 16 * (len(parts) - 1)
            cmp_ = Image.new('RGBA', (W, max(p.height for p in parts)), C.KEY + (255,))
            x = 0
            for p in parts:
                cmp_.alpha_composite(p, (x, 0))
                x += p.width + 16
            cmp_.convert('RGB').save(out / 'compare.png')
        except (IndexError, KeyError, TypeError):
            pass
    (out / 'gate.json').write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding='utf-8')
    return r


def cmd_face_check(a):
    pal, _, rows = C.parse_face(Path(a.file).read_text(encoding='utf-8'))
    r = C.face_gate(pal, rows, base_face(a.base))
    print(json.dumps(r, ensure_ascii=False, indent=1))
    sys.exit(0 if r['ok'] else 1)


def cmd_face_views(a):
    chip = Path(a.file).resolve().parent.parent  # <작업 폴더>/face/out.face.txt → 칩은 <작업 폴더>/out.chr.txt
    r = make_face_views(a.file, a.out, a.base, chip)
    print(json.dumps(r, ensure_ascii=False, indent=1))


def start_face(w, engine='sonnet'):
    """완성된 칩(w/out.chr.txt)의 짝 얼굴을 뼈대 얼굴에서 고쳐 만든다 → Popen. 결과 w/face/out.face.txt."""
    meta = json.loads((w / 'meta.json').read_text())
    b = briefs()[meta['brief']]
    fd = w / 'face'
    fd.mkdir(exist_ok=True)
    ref = fd / 'ref'
    ref.mkdir(exist_ok=True)
    make_views(w / 'out.chr.txt', w / 'views', b['base'])
    shutil.copy(w / 'views' / 'strip.png', ref / 'chip_strip.png')
    shutil.copy(w / 'views' / 'sheet_x8.png', ref / 'chip_x8.png')
    bp, brows = base_face(b['base'])
    C.up(C.face_rgba(bp, brows), 4).save(ref / 'base_face_x4.png')
    (fd / 'base.face.txt').write_text(C.dump_face(bp, {}, brows, header=f'Actor1 얼굴 {b["base"]}번 (뼈대, 64색으로 줄임) — 고치지 말 것'),
                                      encoding='utf-8')
    t = (HERE / 'face.md').read_text(encoding='utf-8')
    for k, v in {'{NAME}': b['name'], '{BRIEF}': b['brief'], '{BASE_N}': str(b['base']), '{DIR}': str(fd),
                 '{TOOL}': f'python3 {HERE / "harness.py"}'}.items():
        t = t.replace(k, v)
    (fd / 'prompt.md').write_text(t, encoding='utf-8')
    p = _spawn(engine, fd, fd / 'prompt.md', fd / 'worker.log')
    (fd / 'meta.json').write_text(json.dumps(dict(engine=engine, label=ENGINES[engine]['label'], pid=p.pid, started=now()),
                                             ensure_ascii=False), encoding='utf-8')
    return p


def finish_face(w):
    fd = w / 'face'
    if (fd / 'out.face.txt').exists():
        b = json.loads((w / 'meta.json').read_text())['base']
        return make_face_views(fd / 'out.face.txt', fd / 'views', b, w)
    return None


def cmd_faces(a):
    """완성된 칩 중 얼굴이 없는 것에 얼굴 작업자를 붙인다(동시 a.par)."""
    from concurrent.futures import ThreadPoolExecutor
    ws = [w for w in sorted(run_dir(a.run).glob('*__*')) if (w / 'out.chr.txt').exists()
          and (a.redo or not (w / 'face' / 'out.face.txt').exists())]

    def one(w):
        p = start_face(w, a.engine)
        print(f'{datetime.now():%H:%M:%S} {w.name} 얼굴 시작 pid={p.pid}', flush=True)
        p.wait()
        r = finish_face(w)
        print(f'{datetime.now():%H:%M:%S} {w.name} 얼굴 끝 {"통과" if r and r["ok"] else r and r["fails"]}', flush=True)
    with ThreadPoolExecutor(max_workers=a.par) as ex:
        list(ex.map(one, ws))
    print('끝', flush=True)


# ─────────────────────────────── 받기/버리기 화면 ───────────────────────────────
REASONS = ['Actor1 과 화풍 다름', '지시와 다름', '1배에서 안 읽힘', '방향마다 다른 사람', '걸음 어색', '형태 뭉개짐', '색이 탁함', '잡티']
DECISIONS = DATA / 'decisions.jsonl'          # 정본(추가만). 저장소 사본은 export_decisions 가 쓴다.
EXPORT = HDATA / 'decisions.json'
ACCEPTED = HDATA / 'accepted'


def _items():
    out = []
    for rd in sorted((p for p in (DATA / 'runs').glob('*') if p.name != 'reviewtest'), reverse=True):
        for w in sorted(rd.glob('*__*')):
            try:
                m = json.loads((w / 'meta.json').read_text())
            except (OSError, ValueError):
                continue
            b = briefs().get(m['brief'], {})
            has = (w / 'out.chr.txt').exists() and (w / 'views' / 'walk.gif').exists()
            gate = None
            if has and (w / 'views' / 'gate.json').exists():
                gate = json.loads((w / 'views' / 'gate.json').read_text())
            out.append(dict(id=f'{rd.name}/{w.name}', run=rd.name, dir=w.name, brief=m['brief'], name=b.get('name', m['brief']),
                            gender=b.get('gender', ''), brief_text=b.get('brief', ''), base=m['base'], label=m['label'],
                            status='running' if _alive(m['pid']) else ('done' if has else 'failed'),  # 작업자도 views 를 만들므로 살아 있으면 아직 그리는 중
                            gate=gate, review=read_verdict(w) if has else None,
                            face=_face_state(w)))
    return out


def _face_state(w):
    fd = w / 'face'
    if not (fd / 'meta.json').exists():
        return None
    try:
        if _alive(json.loads((fd / 'meta.json').read_text())['pid']):
            return 'running'   # 작업자도 views 를 만들므로 살아 있는 동안은 그리는 중
    except (OSError, ValueError, KeyError):
        pass
    return 'done' if (fd / 'views' / 'face_x4.png').exists() else 'failed'


def _decisions():
    cur = {}
    if DECISIONS.exists():
        for line in DECISIONS.read_text(encoding='utf-8').splitlines():
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d['decision'] == 'clear':
                cur.pop(d['id'], None)
            else:
                cur[d['id']] = d
    return cur


def export_decisions():
    cur = _decisions()
    EXPORT.write_text(json.dumps(dict(updated=now(), decisions=list(cur.values())), ensure_ascii=False, indent=1) + '\n',
                      encoding='utf-8')
    # 받은 것은 격자·1배 시트를 저장소로 옮긴다(작은 글자 파일 — 다음 단계 번들 등록의 원본)
    ACCEPTED.mkdir(parents=True, exist_ok=True)
    keep = set()
    for d in cur.values():
        if d['decision'] != 'accept':
            continue
        run, dname = d['id'].split('/', 1)
        w = run_dir(run) / dname
        stem = f'{dname}__{run}'
        keep.add(stem)
        if (w / 'out.chr.txt').exists():
            shutil.copy(w / 'out.chr.txt', ACCEPTED / f'{stem}.chr.txt')
            shutil.copy(w / 'views' / 'sheet.png', ACCEPTED / f'{stem}.png')
    for f in ACCEPTED.glob('*'):
        if f.name.rsplit('.', 1)[0].removesuffix('.chr') not in keep:
            f.unlink()


def cmd_serve(a):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import unquote
    web = HERE / 'web' / 'index.html'
    root = (DATA / 'runs').resolve()

    class H(BaseHTTPRequestHandler):
        def log_message(self, *x):
            pass

        def _send(self, code, body, ctype='application/json; charset=utf-8'):
            if isinstance(body, str):
                body = body.encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = unquote(self.path.split('?', 1)[0])
            if path in ('/', '/index.html'):
                return self._send(200, web.read_bytes(), 'text/html; charset=utf-8')
            if path == '/api/state':
                dec = _decisions()
                items = _items()
                for it in items:
                    it['decision'] = dec.get(it['id'])
                return self._send(200, json.dumps(dict(items=items, reasons=REASONS), ensure_ascii=False))
            if path.startswith('/f/'):
                f = (root / path[3:]).resolve()
                if root not in f.parents or not f.is_file():
                    return self._send(404, 'not found', 'text/plain')
                ct = {'.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json'}.get(f.suffix, 'text/plain; charset=utf-8')
                return self._send(200, f.read_bytes(), ct)
            return self._send(404, 'not found', 'text/plain')

        def do_POST(self):
            if self.path != '/api/decide':
                return self._send(404, '{}')
            n = int(self.headers.get('Content-Length') or 0)
            d = json.loads(self.rfile.read(n) or b'{}')
            if d.get('decision') not in ('accept', 'reject', 'clear') or '/' not in str(d.get('id', '')):
                return self._send(400, '{"error":"bad"}')
            rec = dict(id=d['id'], decision=d['decision'], reasons=d.get('reasons') or [], note=d.get('note') or '',
                       client='web', at=now())
            DATA.mkdir(parents=True, exist_ok=True)
            with open(DECISIONS, 'a', encoding='utf-8') as fh:
                fh.write(json.dumps(rec, ensure_ascii=False) + '\n')
            export_decisions()
            return self._send(200, json.dumps(rec, ensure_ascii=False))

    print(f'http://mdc-server:{a.port}/', flush=True)
    ThreadingHTTPServer(('0.0.0.0', a.port), H).serve_forever()


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('calibrate').set_defaults(fn=cmd_calibrate)
    p = sp.add_parser('base')
    p.add_argument('n', type=int)
    p.add_argument('out')
    p.set_defaults(fn=cmd_base)
    p = sp.add_parser('check')
    p.add_argument('file')
    p.add_argument('--base', type=int)
    p.set_defaults(fn=cmd_check)
    p = sp.add_parser('views')
    p.add_argument('file')
    p.add_argument('out')
    p.add_argument('--base', type=int)
    p.set_defaults(fn=cmd_views)
    p = sp.add_parser('draw')
    p.add_argument('brief')
    p.add_argument('--engine', choices=list(ENGINES), required=True)
    p.add_argument('--run')
    p.add_argument('--force', action='store_true')
    p.add_argument('--src', help='수정 작업: 다른 작업자의 작업 폴더(out.chr.txt 가 있는 곳)')
    p.add_argument('--tag', help='수정 작업 폴더 이름 꼬리(기본: 원본 엔진 이름)')
    p.add_argument('--fix-notes', help='수정 작업: 감독의 지적 파일')
    p.set_defaults(fn=cmd_draw)
    p = sp.add_parser('status')
    p.add_argument('--run')
    p.set_defaults(fn=cmd_status)
    p = sp.add_parser('page')
    p.add_argument('--run', required=True)
    p.set_defaults(fn=cmd_page)
    p = sp.add_parser('loop', help='그리기 → 검수 → 지적대로 고치기 반복(검수 PASS 또는 rounds 까지)')
    p.add_argument('briefs', nargs='+')
    p.add_argument('--run')
    p.add_argument('--drawer', default='gpt', choices=list(ENGINES))
    p.add_argument('--reviewer', default='sonnet', choices=list(ENGINES))
    p.add_argument('--par', type=int, default=6)
    p.add_argument('--rounds', type=int, default=1)
    p.add_argument('--face', default='sonnet', help='칩이 끝나면 짝 얼굴을 붙일 엔진(빈 문자열이면 안 붙임)')  # 2026-10-02 사용자 판단: 원샷이 제일 낫다 — 반복 고치기는 명시할 때만
    p.set_defaults(fn=cmd_loop)
    p = sp.add_parser('serve', help='받기/버리기 화면')
    p.add_argument('--port', type=int, default=18314)
    p.set_defaults(fn=cmd_serve)
    p = sp.add_parser('face-check')
    p.add_argument('file')
    p.add_argument('--base', type=int, required=True)
    p.set_defaults(fn=cmd_face_check)
    p = sp.add_parser('face-views')
    p.add_argument('file')
    p.add_argument('out')
    p.add_argument('--base', type=int, required=True)
    p.set_defaults(fn=cmd_face_views)
    p = sp.add_parser('faces', help='완성된 칩에 짝 얼굴(48×48)을 붙인다')
    p.add_argument('--run', required=True)
    p.add_argument('--engine', default='sonnet', choices=list(ENGINES))
    p.add_argument('--par', type=int, default=6)
    p.add_argument('--redo', action='store_true')
    p.set_defaults(fn=cmd_faces)
    sp.add_parser('export', help='결정을 harness-data/charset-actor/decisions.json·accepted/ 로').set_defaults(
        fn=lambda a: export_decisions())
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
