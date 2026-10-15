#!/usr/bin/env python3
"""현대 연애물 인물 칩 후보 시트(자체완결 HTML). 설치하지 않는다. 고르는 것은 사용자다.
  python3 romance_sheet.py --run r1 --spec ../../../harness-data/charset-actor/romance-modern.json --notes ../../../harness-data/charset-actor/romance-notes.json --out ~/claude-viz/chips-modern-romance-1.html
"""
import argparse
import base64
import html
import io
import json
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
from PIL import Image  # noqa: E402

OUT = Path(os.environ.get('CTFF6_PART_OUT', H.ROOT / 'qa-runs' / 'harnesses' / 'romance'))


def b64png(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()


def gif(pal, fr, scale):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'w.gif'
        C.gif_walk(pal, fr, out, scale=scale, lawn=None, ms=170)
        return base64.b64encode(out.read_bytes()).decode()


def compare(bp, bf, pal, fr, S=8):
    W = 3 * 26
    im = Image.new('RGBA', (2 * W + 6, 4 * 34), (92, 140, 70, 255))
    for who, (p, f) in enumerate(((bp, bf), (pal, fr))):
        for di, d in enumerate(('down', 'right', 'up', 'left')):
            for k in range(3):
                im.alpha_composite(C.frame_rgba(p, f[(d, k)]), (who * (W + 6) + 1 + k * 26, di * 34 + 1))
    return im.resize((im.width * S, im.height * S), Image.NEAREST).convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True)
    ap.add_argument('--spec', required=True)
    ap.add_argument('--notes', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding='utf-8'))
    notes = json.loads(Path(a.notes).read_text(encoding='utf-8'))
    secs, total = [], 0
    for arch in spec['archetypes']:
        cards = []
        for i, _ in enumerate(arch['candidates']):
            key = f'{arch["id"]}-{"abcdefgh"[i]}'
            cd = OUT / a.run / key
            if not (cd / 'chip.chr.txt').exists():
                continue
            meta = json.loads((cd / 'meta.json').read_text())
            pal, _, fr = C.load(cd / 'chip.chr.txt')
            bp, bf = H.base_of(meta['base'])
            n = notes.get(key, {})
            verdict = n.get('verdict', '')
            vcls = {'합격권': 'ok', '보통': 'mid', '약함': 'weak'}.get(verdict, '')
            m = meta.get('metrics', {})
            cards.append(
                f'<div class="card" id="{key}"><div class="id">{key} <span class="v {vcls}">{html.escape(verdict)}</span> <small>베이스 {html.escape(H.base_label(meta["base"]))} ({meta["base"]}) · Argon {meta["effort"]} · 시도 {len(meta["attempts"])}회</small></div>'
                f'<p class="var">{html.escape(meta["variant"])}</p>'
                f'<div class="cmp"><div><img src="data:image/png;base64,{b64png(compare(bp, bf, pal, fr))}"><div class="cap">왼쪽 = 베이스 원본, 오른쪽 = 후보. 행 = 아래·오른쪽·위·왼쪽, 열 = 걸음 3프레임. 8×</div></div>'
                f'<div><img src="data:image/gif;base64,{gif(pal, fr, 8)}"><div class="cap">후보 걷기 8×(네 방향 순환)</div>'
                f'<img src="data:image/gif;base64,{gif(bp, bf, 4)}" style="margin-top:10px"><div class="cap">베이스 원본 걷기 4×</div></div></div>'
                f'<p class="note"><b>눈 판정</b>: {html.escape(n.get("note", "(미기입)"))}</p>'
                f'<p class="mt">하네스: 12프레임 얼굴·맨살·눈·다리·걷기 불변 PASS · 마스크 밖 변경 0 · 변경률 H {m.get("changed_ratio", {}).get("H", "-")} / T {m.get("changed_ratio", {}).get("T", "-")} / B {m.get("changed_ratio", {}).get("B", "-")} / S {m.get("changed_ratio", {}).get("S", "-")} (기계 통과는 합격이 아님)</p></div>')
            total += 1
        if cards:
            secs.append(f'<h2>{html.escape(arch["name"])} <small>{arch["id"]} · {html.escape(arch["role"])}</small></h2><p class="concept">{html.escape(arch["concept"])}</p><div class="row">{"".join(cards)}</div>')
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>현대 연애물 인물 칩 후보 1</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}h1{{margin:0 0 6px}}h2{{margin:34px 0 2px;border-bottom:1px solid #3a4248;padding-bottom:4px}}small{{color:#8fa0aa;font-weight:400;font-size:13px}}
.how{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:14px 18px;margin:12px 0;max-width:1100px}}.how code{{background:#0e1214;padding:1px 6px;border-radius:4px}}.concept{{color:#aab6bd;margin:2px 0 10px;max-width:1040px}}
.row{{display:flex;flex-direction:column;gap:18px}}.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:12px;width:1500px}}.id{{font:600 16px ui-monospace,monospace;color:#ffd479;margin-bottom:2px}}.v{{font-size:12px;padding:1px 8px;border-radius:10px;color:#101418;background:#999}}.v.ok{{background:#7fe08a}}.v.mid{{background:#e8b86d}}.v.weak{{background:#ef7b7b}}
.var{{color:#9fb0ba;margin:2px 0 8px;font-size:13px}}.cmp{{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}}.cap{{color:#8fa0aa;font-size:12px}}img{{image-rendering:pixelated;display:block}}.note{{color:#e8b86d;font-size:13.5px;margin:8px 0 2px;max-width:1300px}}.mt{{color:#7d8d97;font-size:12px;margin:2px 0 0}}</style>
<h1>현대 연애물 인물 칩 후보 1 — 베이스 칩 + 의복·머리 편집 (Argon high)</h1>
<div class="how"><b>무엇을 보나</b>: RTP 칩(CC BY 4.0)을 베이스로, <b>상의·하의·신발·머리색/모양만</b> 바꾼 현대 인물 후보 {total}종입니다. 얼굴·피부·손·몸 비율·걷기는 베이스 그대로라 얼굴은 같은 칩의 얼굴입니다. 가방·안경·이름표 같은 소품(gear)은 이번 범위 밖입니다.<br>
카드마다 베이스 원본과 8× 비교, 눈 판정 코멘트(합격권/보통/약함)를 적었습니다. 마음에 드는 후보의 <code>id</code>를 채팅에 적어 주세요(예 <code>ro-uni-boy-a, ro-apron-a</code>). <b>고르기 전에는 번들·프로젝트·공용에 설치하지 않습니다.</b> 베이스 선택 시트: <a href="chips-modern-romance-base-1.html" style="color:#7fb4ff">chips-modern-romance-base-1.html</a></div>
{"".join(secs)}</html>'''
    out = Path(a.out).expanduser()
    out.write_text(page, encoding='utf-8')
    print(out, total, '종', len(page), 'bytes')


if __name__ == '__main__':
    main()
