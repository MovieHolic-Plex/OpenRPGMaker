"""검수 페이지: ~/claude-viz/<name>.html (자체완결, 그림은 data URI). 묶음별 조각 시트(3배) + 장면(원본 해상도·2배) + 관문 상태."""
import base64, io, os, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pi_all  # noqa: F401
import pi_core as C
from pi_sheet import sheet
from PIL import Image

GROUP_KO = dict(terrain='바닥·물·해안·벽', nature='자연', buildings='건물', props='소품', boats='배', interior='실내 가구', anim='움직임')


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def page(name, title, scenes=(), groups=None, z=3, note=''):
    parts = [f"<h1>{html.escape(title)}</h1><p class=note>{note}</p>"]
    for (stitle, im, desc) in scenes:
        parts.append(f"<h2>{html.escape(stitle)}</h2><p class=note>{html.escape(desc)}</p><div class=scene><img src='{uri(im)}' style='width:{im.width * 2}px'></div>")
    stat = {}
    for p in C.PIECES.values():
        try: stat[p['id']] = C.status_of(p)
        except Exception: stat[p['id']] = '?'
    for g in (groups or GROUP_KO):
        ps = C.pieces_of(g)
        if not ps: continue
        bg = 'water' if g == 'boats' else 'sand' if g in ('buildings', 'nature', 'props') else 'none'
        if g == 'interior': bg = 'none'
        items = [(f"{p['id']} [{stat[p['id']]}]", Image.fromarray(C.render(p), 'RGBA')) for p in ps]
        S = sheet(items, '/tmp/pi-page-%s.png' % g, z=z, W=1800, bg=bg)
        npass = sum(1 for p in ps if stat[p['id']] == 'pass')
        parts.append(f"<h2>{GROUP_KO[g]} ({len(ps)}조각 · 관문 통과 {npass})</h2><img src='{uri(S)}' style='max-width:100%'>")
    css = "body{background:#1c1d22;color:#ddd;font-family:sans-serif;margin:20px}h1{font-size:22px}h2{font-size:17px;margin-top:28px}.note{color:#aaa;font-size:13px;max-width:1100px}img{image-rendering:pixelated;display:block}.scene{overflow:auto}"
    out = os.path.expanduser(f'~/claude-viz/{name}.html')
    open(out, 'w').write(f"<!doctype html><meta charset=utf-8><title>{html.escape(title)}</title><style>{css}</style>" + '\n'.join(parts))
    return out


if __name__ == '__main__':
    print(page(sys.argv[1] if len(sys.argv) > 1 else 'pirate-isles-wip', 'pirate_isles 중간 시트'))
