#!/usr/bin/env python3
"""CT·FF6 변형 하네스 1단계: 베이스 칩 전수 목록 + 원형별 후보 베이스 선택 시트(자체완결 HTML).

  python3 base_sheet.py --out ~/claude-viz/base-pick-1.html

고르는 것은 사용자다(★ 는 추천 표시일 뿐). 이 스크립트는 아무것도 설치하지 않는다.
"""
import argparse
import base64
import html
import io
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
from PIL import Image  # noqa: E402

POOL = H.HDATA / 'ct-ff6-base-pool.json'
SEED = H.HDATA / 'ct-ff6-concepts.json'
S = 3
BG = (92, 140, 70, 255)


def b64png(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()


def gif(pal, frames, scale):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'w.gif'
        C.gif_walk(pal, frames, out, scale=scale, lawn=None, ms=170)
        return base64.b64encode(out.read_bytes()).decode()


def idle4(pal, frames, scale=S):
    """아래·오른쪽·위·왼쪽 서 있는 그림 네 장(같은 배율)."""
    im = Image.new('RGBA', (4 * 26, 34), BG)
    for i, d in enumerate(('down', 'right', 'up', 'left')):
        im.alpha_composite(C.frame_rgba(pal, frames[(d, 1)]), (1 + i * 26, 1))
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    pool = json.loads(POOL.read_text(encoding='utf-8'))
    seed = {x['id']: x for x in json.loads(SEED.read_text(encoding='utf-8'))['archetypes']}
    chips = pool['chips']
    cat = []
    for sheet in H.BASE_SHEETS:
        cells = []
        for i in range(8):
            k = f'{sheet}:{i}'
            pal, fr = H.base_of(k)
            c = chips[k]
            cells.append(f'<div class="cell"><div class="k">{k}<span class="g"> {c["g"]}</span></div>'
                         f'<img src="data:image/png;base64,{b64png(idle4(pal, fr))}"><div class="d"><b>체형</b> {html.escape(c["body"])}<br><b>머리</b> {html.escape(c["hair"])}<br><b>옷</b> {html.escape(c["outfit"])}'
                         + (f'<br><i>{html.escape(c["note"])}</i>' if c['note'] else '') + '</div></div>')
        cat.append(f'<h3>{sheet}</h3><div class="grid">{"".join(cells)}</div>')
    arch = []
    for aid, picks in pool['picks'].items():
        s = seed[aid]
        cards = []
        for n, p in enumerate(picks):
            pal, fr = H.base_of(p['base'])
            c = chips[p['base']]
            cards.append(f'<div class="card"><div class="k">{"ABC"[n]} · {p["base"]}{" <span class=star>★ 추천</span>" if p.get("star") else ""} <span class="g">{c["g"]}</span></div>'
                         f'<div class="two"><div><img src="data:image/png;base64,{b64png(idle4(pal, fr, 4))}"><div class="cap">4방향 서 있는 그림 4×</div></div>'
                         f'<div><img src="data:image/gif;base64,{gif(pal, fr, 4)}"><div class="cap">걷기 4×</div></div></div>'
                         f'<p class="why">{html.escape(p["why"])}</p><div class="d">{html.escape(c["hair"])} · {html.escape(c["outfit"])}</div></div>')
        arch.append(f'<h2 id="{aid}">{html.escape(s["name"])} <small>{aid} · {html.escape(s["genre"])} · {html.escape(s["role"])}</small></h2>'
                    f'<p class="concept">{html.escape(s["concept"])}</p><div class="row">{"".join(cards)}</div>')
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>CT·FF6 베이스 칩 선택 시트 1</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}h1{{margin:0 0 6px}}h2{{margin:40px 0 2px;border-bottom:1px solid #3a4248;padding-bottom:4px}}h3{{margin:26px 0 6px;color:#ffd479}}
small{{color:#8fa0aa;font-weight:400;font-size:13px}}.how{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:14px 18px;margin:12px 0;max-width:1100px}}.how code{{background:#0e1214;padding:1px 6px;border-radius:4px}}
.concept{{color:#aab6bd;max-width:1100px;margin:2px 0 10px}}.row{{display:flex;gap:16px;flex-wrap:wrap}}.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:10px;width:940px}}
.k{{font:600 15px ui-monospace,monospace;color:#ffd479;margin-bottom:4px}}.g{{color:#8fa0aa;font-weight:400}}.star{{color:#7fe08a}}.two{{display:flex;gap:14px;align-items:flex-end}}.cap{{color:#8fa0aa;font-size:12px}}
img{{image-rendering:pixelated;display:block}}.why{{margin:8px 0 2px}}.d{{color:#9fb0ba;font-size:12.5px;margin-top:4px}}.grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}}.cell{{background:#1d2328;border:1px solid #333c43;border-radius:6px;padding:8px}}.cell img{{width:100%;max-width:312px}}</style>
<h1>CT·FF6 변형 하네스 — 베이스 칩 선택 시트 1</h1>
<div class="how"><b>고르는 법</b><br>원형마다 후보 베이스 A·B·C 가 있습니다. 베이스는 <b>사용자가 고릅니다</b>(★ 는 제 추천일 뿐). 채팅에 <code>tt-hero-boy=A</code> 처럼 적어 주세요(원형당 둘도 가능, 마음에 드는 칩 번호를 직접 적어도 됩니다 — 예 <code>iw-legion-soldier=People3:7</code>).<br>
선택한 베이스에서는 <b>의복·머리·장비만</b> 바꿉니다. 얼굴 눈·입, 몸 비율, 다리·걷기 포즈, 프레임 간 출렁임은 그대로 둡니다. 그래서 베이스의 얼굴·체형·자세가 곧 결과의 얼굴·체형·자세입니다.<br>
모든 그림은 같은 배율(서 있는 그림 3×·후보 4×)로 놓았고 배경은 같은 잔디색입니다. 풀은 EasyRPG RTP(Actor1~4·People1~5, CC BY 4.0) 72칩이며 소유·라이선스가 불명한 칩은 넣지 않았습니다.<br>
<a href="#catalog" style="color:#7fb4ff">아래 맨 끝에 72칩 전수 목록(성별·체형·머리·옷)</a>이 있습니다. 후보 밖의 칩을 쓰고 싶으면 번호를 알려 주세요.</div>
{"".join(arch)}
<h2 id="catalog">베이스 풀 전수 목록 (72칩 · 아래·오른쪽·위·왼쪽 서 있는 그림 3×)</h2>{"".join(cat)}</html>'''
    out = Path(a.out).expanduser()
    out.write_text(page, encoding='utf-8')
    print(out, len(page), 'bytes')


if __name__ == '__main__':
    main()
