"""한 실행의 완성 후보를 한 장의 자체완결 HTML 선택 시트로 만든다(데이터 URI, 외부 참조 없음).

각 후보를 뼈대 원본(Actor1~4·People1~5)과 같은 배율(2×/8×)로 4방향 걷기 GIF 로 나란히 보인다.
고르는 것은 사람이다. 이 스크립트는 남기기/폐기·팩·설치를 하지 않는다.

  python3 pick_sheet.py RUN --out ~/claude-viz/chips-ct-ff6-pick-1.html [--exclude KEY ...] [--seed ../../../harness-data/charset-actor/ct-ff6-concepts.json]
"""
import argparse
import base64
import html
import io
import json
import sys
import tempfile
from pathlib import Path

import chr as C
import harness as H

LAWN = H.HDATA / 'lawn16.png'


def gif_b64(pal, frames, scale):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'w.gif'
        C.gif_walk(pal, frames, out, scale=scale, lawn=None, ms=170)
        return base64.b64encode(out.read_bytes()).decode()


def collect(run, exclude=()):
    root = H.run_dir(run)
    manifest = json.loads((root / 'manifest.json').read_text())
    rows = {r['key']: r for r in manifest['characters']}
    items = []
    for key, row in rows.items():
        w = root / f'{key}__gpt-r1'
        if key in exclude or not (w / 'out.chr.txt').is_file() or not (w / 'published.json').is_file():
            continue
        gate = H.current_gate(w)
        if not H.human_ready(w, gate):
            continue
        desc = json.loads((w / 'desc.json').read_text()) if (w / 'desc.json').is_file() else {}
        items.append(dict(key=key, row=row, dir=w, desc=desc, gate=gate))
    return manifest, items


def build(run, out, exclude=(), seed=None, notes=None, cull=()):
    runs = run.split(',')
    items, manifest, pending = [], None, []
    for index, r in enumerate(runs):
        m, got = collect(r, exclude)
        items += got
        manifest = manifest or m
        if index == len(runs) - 1:  # 마지막(최신) 실행의 미완성 주문만 「생성 중/실패」로 표시
            done = {it['key'] for it in got}
            pending = [row for row in m['characters'] if row['key'] not in done and row['key'] not in exclude]
    notes = notes or {}
    seed = json.loads(Path(seed).read_text(encoding='utf-8')) if seed else {'archetypes': []}
    order = [a['id'] for a in seed['archetypes']]
    names = {a['id']: a for a in seed['archetypes']}
    groups = {}
    for it in items:
        arch = it['key'].rsplit('-', 1)[0]
        groups.setdefault(arch, []).append(it)
    base_gifs = {}
    cards = []
    for arch in sorted(groups, key=lambda a: order.index(a) if a in order else 99):
        a = names.get(arch, {})
        cards.append(f'<h2>{html.escape(a.get("name", arch))} <small>{html.escape(arch)} · {html.escape(a.get("genre", ""))}</small></h2>'
                     f'<p class="concept">{html.escape(a.get("concept", ""))}</p><div class="row">')
        culled_cards = []
        for it in sorted(groups[arch], key=lambda x: (x['key'] in cull, x['key'])):
            w, row = it['dir'], it['row']
            pal, notes, frames = C.load(w / 'out.chr.txt')
            bkey = row['base']
            if bkey not in base_gifs:
                bpal, bframes = H.base_of(bkey)
                base_gifs[bkey] = (gif_b64(bpal, bframes, 2), gif_b64(bpal, bframes, 8))
            g2, g8 = gif_b64(pal, frames, 2), gif_b64(pal, frames, 8)
            d = it['desc']
            target = culled_cards if it['key'] in cull else cards
            target.append(
                f'<div class="card" id="{html.escape(it["key"])}"><div class="id">{html.escape(it["key"])}</div>'
                f'<div class="cmp"><figure><img src="data:image/gif;base64,{base_gifs[bkey][0]}"><figcaption>원본 {html.escape(H.base_label(bkey))} 2×</figcaption></figure>'
                f'<figure><img src="data:image/gif;base64,{g2}"><figcaption>후보 2×</figcaption></figure></div>'
                f'<img class="big" src="data:image/gif;base64,{g8}"><div class="cap">후보 8× (위·오른쪽·아래·왼쪽 걷기)</div>'
                f'<details><summary>원본 8×</summary><img class="big" src="data:image/gif;base64,{base_gifs[bkey][1]}"></details>'
                f'<p class="desc">{html.escape(str(d.get("appearance", "")))}</p>'
                + (f'<p class="note">눈 검수 소견: {html.escape(notes[it["key"]])}</p>' if it['key'] in notes else '') + '</div>')
        cards.append('</div>')
        if culled_cards:
            cards.append('<details class="cull"><summary>눈 검수에서 걸러 낸 후보 ' + str(len(culled_cards)) + '종 (결손은 없으나 얼굴·직업 표식이 약함 — 보고 싶으면 펼치기, 고르는 건 사용자)</summary><div class="row">' + ''.join(culled_cards) + '</div></details>')
    wait_html = ''
    if pending:
        wait_html = ('<div class="how"><b>생성 중 / 아직 성공하지 못한 주문 ' + str(len(pending)) + '종</b> (제공자 용량 오류로 재시도 중이며 선택은 위 후보만 가능)<br>'
                     + ' '.join(f'<code>{html.escape(r["key"])}</code>' for r in pending) + '</div>')
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>{html.escape(manifest.get("title", "걷기 칩 후보"))}</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}
h1{{margin:0 0 6px}}h2{{margin:36px 0 2px;border-bottom:1px solid #3a4248;padding-bottom:4px}}small{{color:#8fa0aa;font-weight:400;font-size:13px}}
.how{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:14px 18px;margin:12px 0 8px;max-width:980px}}
.how code{{background:#0e1214;padding:1px 6px;border-radius:4px}}.concept{{color:#aab6bd;margin:2px 0 10px;max-width:1000px}}
.row{{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}}.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:12px;width:980px}}
.id{{font:600 16px ui-monospace,monospace;color:#ffd479;margin-bottom:6px}}.cmp{{display:flex;gap:16px;margin-bottom:8px}}figure{{margin:0}}
figcaption,.cap{{color:#8fa0aa;font-size:12px}}img{{image-rendering:pixelated}}.big{{display:block;max-width:100%}}details{{margin-top:8px}}.desc{{color:#9fb0ba;font-size:13px;margin:8px 0 0}}details.cull{{margin:14px 0}}details.cull>summary{{cursor:pointer;color:#e8b86d}}.note{{color:#e8b86d;font-size:13px;margin:4px 0 0}}</style>
<h1>{html.escape(manifest.get("title", "걷기 칩 후보"))}</h1>
<div class="how"><b>고르는 방법</b><br>마음에 드는 후보의 <code>id</code>(노란 글씨, 예: <code>tt-scrap-robot-b</code>)를 채팅에 적어 주세요. 여러 개·원형당 하나·전부 폐기도 같은 방식입니다.<br>
전체 목록과 남기기(<code>A</code>)/폐기(<code>R</code>) 화면: <code>http://mdc-server:18314/?run={html.escape(runs[-1])}&amp;view=grid&amp;show=all</code> (서버가 켜져 있을 때).<br>
<b>고르기 전에는 팩·번들·프로젝트에 설치하지 않습니다.</b> 원본 칩(RTP)과 같은 배율로 나란히 놓았습니다. 후보 {len(items)}종 · 실행 <code>{html.escape(run)}</code></div>
{wait_html}{''.join(cards)}</html>'''
    out = Path(out).expanduser()
    out.write_text(page, encoding='utf-8')
    return len(items), len(page)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('run')
    ap.add_argument('--out', required=True)
    ap.add_argument('--exclude', nargs='*', default=[])
    ap.add_argument('--cull', nargs='*', default=[], help='눈 검수 탈락 key(접어서 표시)')
    ap.add_argument('--note', action='append', default=[], help='KEY=눈 검수 소견')
    ap.add_argument('--seed', default=str(H.HDATA / 'ct-ff6-concepts.json'))
    a = ap.parse_args()
    print(build(a.run, a.out, a.exclude, a.seed, dict(n.split('=', 1) for n in a.note), set(a.cull)))
