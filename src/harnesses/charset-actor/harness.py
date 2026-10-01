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

ACTOR1 = ROOT / 'public' / 'assets' / 'easyrpg' / 'charset' / 'Actor1.png'
HDATA = ROOT / 'harness-data' / 'charset-actor'
LAWN = HDATA / 'lawn16.png'
DATA = Path(os.environ.get('CHR_HARNESS_DATA', os.path.expanduser('~/.local/share/oprn/charset-actor-harness')))
VIZ = Path(os.path.expanduser('~/claude-viz'))
ENGINES = {
    'sonnet': dict(label='Claude Sonnet 5.5 · medium', model='claude-sonnet-5-5', effort='medium'),
    'gpt': dict(label='GPT 6.1 sol · medium', model='gpt-6.1-sol', effort='medium'),
}
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
    r = C.gate(pal, frames, base)
    (out / 'gate.json').write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding='utf-8')
    return r


def cmd_views(a):
    r = make_views(a.file, a.out, a.base)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print('그림:', ', '.join(sorted(p.name for p in Path(a.out).iterdir())))


def run_dir(run):
    return DATA / 'runs' / run


def cmd_draw(a):
    b = briefs()[a.brief]
    eng = ENGINES[a.engine]
    run = a.run or datetime.now().strftime('%Y%m%d-%H%M')
    w = run_dir(run) / f'{a.brief}__{a.engine}'
    if w.exists() and any(w.iterdir()) and not a.force:
        sys.exit(f'이미 있다: {w} (--force 로 덮기)')
    w.mkdir(parents=True, exist_ok=True)
    base_txt = w / 'base.chr.txt'
    pal, notes, frames = C.from_actor(ACTOR1, b['base'])
    base_txt.write_text(C.dump(pal, notes, frames, header=f'Actor1 {b["base"]}번 캐릭터 (뼈대) — 고치지 말 것, 복사해서 쓴다'),
                        encoding='utf-8')
    make_views(base_txt, w / 'base-views')
    tool = f'python3 {HERE / "harness.py"}'
    t = (HERE / 'worker.md').read_text(encoding='utf-8')
    rep = {'{TOOL}': tool, '{DIR}': str(w), '{BASE_N}': str(b['base']), '{NAME}': b['name'], '{BRIEF}': b['brief'],
           '{KEEP}': b.get('keep', ''), '{ACTOR1}': str(ACTOR1)}
    for k, v in rep.items():
        t = t.replace(k, v)
    (w / 'prompt.md').write_text(t, encoding='utf-8')
    log = open(w / 'worker.log', 'w')
    if a.engine == 'sonnet':
        cmd = [shutil.which('claude') or 'claude', '-p', '--model', eng['model'], '--effort', eng['effort'],
               '--dangerously-skip-permissions', '--add-dir', str(HERE), '--output-format', 'text']
    else:
        cmd = [shutil.which('codex') or os.path.expanduser('~/.local/bin/codex'), 'exec', '-m', eng['model'],
               '-c', f'model_reasoning_effort="{eng["effort"]}"', '--skip-git-repo-check', '-s', 'workspace-write',
               '--add-dir', str(HERE), '-C', str(w), '-']
    env = dict(os.environ)
    p = subprocess.Popen(['timeout', str(TIMEOUT_S)] + cmd, cwd=w, stdin=open(w / 'prompt.md', 'rb'), stdout=log,
                         stderr=subprocess.STDOUT, start_new_session=True, env=env)
    meta = dict(run=run, brief=a.brief, engine=a.engine, label=eng['label'], model=eng['model'], effort=eng['effort'],
                pid=p.pid, started=now(), dir=str(w), base=b['base'])
    (w / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(meta, ensure_ascii=False))


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
    for w in sorted(rd.glob('*__*')):
        m = json.loads((w / 'meta.json').read_text())
        if m['base'] not in base_done:
            base_done.add(m['base'])
            bv = w / 'base-views'
            cards.append(dict(title=f'뼈대 — Actor1 {m["base"]}번 (원본)', views=bv, gate=None, notes='', base=True))
        out = w / 'out.chr.txt'
        if not out.exists():
            cards.append(dict(title=m['label'], views=None, gate=None, notes='(아직 결과 없음)', base=False))
            continue
        v = w / 'views'
        r = make_views(out, v, m['base'])
        notes = (w / 'notes.md').read_text(encoding='utf-8') if (w / 'notes.md').exists() else ''
        cards.append(dict(title=m['label'], views=v, gate=r, notes=notes, base=False))
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
        parts.append(f'''<section class="card{' base' if c['base'] else ''}"><h2>{html.escape(c['title'])}</h2>
<div class=row><figure><img src="{_data_uri(v / 'walk.gif')}"><figcaption>걷기 4방향 (4배)</figcaption></figure>
<figure><img src="{_data_uri(v / 'turn.gif')}"><figcaption>돌기 (4배)</figcaption></figure>
<figure><img src="{_data_uri(v / 'stroll.gif')}"><figcaption>칸 위를 걷기 (3배)</figcaption></figure>
<figure><img class=one src="{_data_uri(v / 'sheet.png')}"><figcaption>1배 (게임 크기)</figcaption></figure></div>
<details><summary>8배 시트 · 필름 띠(검수자가 보는 그림)</summary><div class=row>
<img src="{_data_uri(v / 'sheet_x8.png')}"><img src="{_data_uri(v / 'strip.png')}"></div></details>
{gate_html}{'<details><summary>작업자 메모</summary><pre>' + html.escape(c['notes']) + '</pre></details>' if c['notes'] else ''}
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
    p.set_defaults(fn=cmd_draw)
    p = sp.add_parser('status')
    p.add_argument('--run')
    p.set_defaults(fn=cmd_status)
    p = sp.add_parser('page')
    p.add_argument('--run', required=True)
    p.set_defaults(fn=cmd_page)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
