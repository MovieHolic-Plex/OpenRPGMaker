# 3/4 재작도(v34-redo.json) 비교 페이지: 항목마다 「지금 | 새 후보들 | 방 안」 을 4배로, 움직이는 기물은 12프레임 GIF 로.
#   python3 scripts/content/hand-interior-pick/v34_compare.py <out.html> [verdicts.json] [w51,w52,…(이 작업자 몫만)]
# verdicts.json = {"<slug>": "감독 판정 한 줄"} (선택). 그림은 data URI 로 넣어 파일 하나로 열린다.
import base64, glob, io, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CAND, PICK, PXGRID, objects_by_id, v5_atlas  # noqa: E402
from PIL import Image  # noqa: E402
import numpy as np  # noqa: E402

S = 4


def uri(im, fmt='PNG', **kw):
    b = io.BytesIO(); im.save(b, fmt, **kw)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(b.getvalue()).decode()


def up(im):
    return im.resize((im.width * S, im.height * S), Image.NEAREST)


def render(pxg):
    png = pxg[:-4] + '.png'
    if not os.path.exists(png) or os.path.getmtime(png) < os.path.getmtime(pxg):
        if PXGRID not in sys.path: sys.path.insert(0, PXGRID)
        import pxgrid
        pxgrid.render(pxg, png)
    return Image.open(png).convert('RGBA')


def v5_frames(o):
    a = o['atlas']; A = v5_atlas()
    return [A.crop((a['x'] + k * a['w'], a['y'], a['x'] + (k + 1) * a['w'], a['y'] + a['h'])) for k in range(a['frames'])]


def gif(frames, ms):
    big = [up(f) for f in frames]
    bg = (58, 58, 66, 255)
    flat = []
    for f in big:
        c = Image.new('RGBA', f.size, bg); c.alpha_composite(f); flat.append(c.convert('P', palette=Image.ADAPTIVE))
    b = io.BytesIO()
    flat[0].save(b, 'GIF', save_all=True, append_images=flat[1:], duration=ms, loop=0, disposal=2)
    return "data:image/gif;base64," + base64.b64encode(b.getvalue()).decode()


def animate(v5f, body):
    A = np.stack([np.array(f) for f in v5f]); diff = (A != A[0]).any(axis=(0, 3)); B = np.array(body)
    if B.shape != A[0].shape: return None
    out = []
    for t in range(len(v5f)):
        fr = B.copy(); fr[diff] = A[t][diff]; out.append(Image.fromarray(fr))
    return out


def main(out, verdicts=None, only=None):
    plan = json.load(open(os.path.join(PICK, 'v34-redo.json'), encoding='utf-8'))
    V = json.load(open(verdicts, encoding='utf-8')) if verdicts else {}
    by = objects_by_id()
    cards = []
    if only: plan['workers'] = {w: v for w, v in plan['workers'].items() if w in only}
    nums = sorted({int(w[1:]) for w in plan['workers']})
    for w, items in plan['workers'].items():
        for it in items:
            s = it['slug']; d = os.path.join(CAND, s); o = by[it['id']]
            cur = render(os.path.join(d, it['current']))
            cands = []
            for p in sorted(glob.glob(os.path.join(d, 'w*-[A-Z].pxg'))):
                m = re.match(r'w(\d+)-([A-Z])\.pxg$', os.path.basename(p))
                if not m or not (min(nums) <= int(m.group(1)) < 90): continue   # 이번 판 작업자(w40~)만. w90·w91 은 9월 1판
                name = os.path.basename(p)[:-4]
                note = open(p[:-4] + '.note', encoding='utf-8').read().strip() if os.path.exists(p[:-4] + '.note') else ''
                im = render(p)
                ctx = p[:-4] + '.ctx.png'
                cands.append(dict(name=name, im=im, note=note, ctx=Image.open(ctx) if os.path.exists(ctx) else None))
            anim = it.get('animated')
            ms = (o.get('animation') or {}).get('ms', 100)
            def cell(label, im, extra=''):
                src = uri(up(im))
                if anim:
                    fr = animate(v5_frames(o), im)
                    if fr: src = gif(fr, ms)
                return f'<figure><img src="{src}"><figcaption>{label}{extra}</figcaption></figure>'
            html = [cell('지금 · ' + it['current'][:-4], cur)]
            for c in cands:
                html.append(cell('새 ' + c['name'], c['im'], f'<small>{c["note"]}</small>'))
            ctx = next((c['ctx'] for c in reversed(cands) if c['ctx'] is not None), None)
            if ctx is not None: html.append(f'<figure class="ctx"><img src="{uri(ctx)}"><figcaption>방 안 ({cands[-1]["name"] if cands else ""})</figcaption></figure>')
            v = V.get(s, '')
            cls = 'redo' if v.startswith('재작업') else ('weak' if v.startswith('약함') else '')
            cards.append(f'<section class="{cls}"><h3>{o["name_ko"]} <code>{it["id"]}</code></h3>'
                         f'<p class="why">위반: {it["violation"]}{" · 움직임 12프레임" if anim else ""}</p>'
                         + (f'<p class="v">감독 판정: {v}</p>' if v else '') + '<div class="row">' + ''.join(html) + '</div></section>')
    page = f'''<!doctype html><meta charset="utf-8"><title>실내 가구 3/4 재작도 비교</title>
<style>body{{background:#2b2b31;color:#ddd;font:14px system-ui,sans-serif;margin:20px}}h1{{font-size:20px}}
section{{border-top:1px solid #444;padding:10px 0}}section.redo{{border-left:4px solid #e0a040;padding-left:10px}}section.weak{{border-left:4px solid #888;padding-left:10px}}
h3{{margin:0 0 4px;font-size:15px}}code{{color:#9ab}}.why{{margin:0;color:#aaa}}.v{{margin:2px 0;color:#e6c27a}}
.row{{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-top:6px}}figure{{margin:0;max-width:300px}}img{{image-rendering:pixelated;background:#3a3a42;display:block}}
figcaption{{font-size:12px;color:#ccc;margin-top:3px}}small{{display:block;color:#999}}.ctx img{{max-width:300px}}</style>
<h1>실내 가구 3/4 재작도 — 지금 vs 새 후보 ({len(cards)}종)</h1>
<p>「지금」은 지금 시트에 들어간 그림(v5 또는 고른 후보). 「새 wNN」이 이번 3/4 후보. 움직이는 기물은 12프레임 GIF. 주황 띠 = 1차 불합격 → 2차 재작업한 항목.</p>
''' + '\n'.join(cards)
    open(out, 'w', encoding='utf-8').write(page)
    print(out, len(cards), 'items', round(len(page) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None, sys.argv[3].split(',') if len(sys.argv) > 3 else None)
