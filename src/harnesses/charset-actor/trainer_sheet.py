#!/usr/bin/env python3
"""몬스터 트레이너 칩 결과 시트(자체완결 HTML) — 합격한 칩만, 수정 전(베이스)/후, 8배·1배 12프레임 줄, 실크기 걷기 GIF.

  python3 trainer_sheet.py --chips ../../../harness-data/charset-actor/monster-trainer-chips --install ../../../harness-data/charset-actor/monster-trainer-install.json \
      --out ~/claude-viz/monster-trainer-chips-1.html [--rejected rejected.json]

고르는 단계가 없다: 시트는 감독이 기준(12프레임 동일성·손에 쥔 장비·8배 눈 검수)으로 거른 결과와 불합격 사유를 보여 줄 뿐이다.
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

BG = (92, 140, 70, 255)


def b64png(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()


def gif_b64(pal, frames, scale):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'w.gif'
        C.gif_walk(pal, frames, out, scale=scale, lawn=None, ms=170)
        return base64.b64encode(out.read_bytes()).decode()


def row12(pal, frames, scale):
    """12프레임을 한 줄로: 위·오른쪽·아래·왼쪽 × 걸음 0·1·2 (같은 배율, 흰 틈)."""
    gap = 2
    im = Image.new('RGBA', (12 * (24 + gap), 32 + 2), BG)
    for di, d in enumerate(C.DIRS):
        for f in range(3):
            im.alpha_composite(C.frame_rgba(pal, frames[(d, f)]), ((di * 3 + f) * (24 + gap), 1))
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert('RGB')


def grid(pal, frames, scale):
    gap = 2
    im = Image.new('RGBA', (3 * (24 + gap), 4 * (32 + gap)), BG)
    for di, d in enumerate(C.DIRS):
        for f in range(3):
            im.alpha_composite(C.frame_rgba(pal, frames[(d, f)]), (f * (24 + gap), di * (32 + gap)))
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chips', required=True)
    ap.add_argument('--install', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--rejected')
    ap.add_argument('--title', default='몬스터 수집 게임 사람 걷기 칩 — 트레이너·NPC')
    a = ap.parse_args()
    chips = Path(a.chips)
    spec = json.loads(Path(a.install).read_text(encoding='utf-8'))
    cards = []
    base_cache = {}
    for ch in spec['characters']:
        cd = chips / ch['key']
        meta = json.loads((cd / 'meta.json').read_text())
        pal, _, frames = C.load(cd / 'chip.chr.txt')
        bk = meta['base'].split('@')[0]
        bp, bf = H.base_of(bk)
        cards.append(
            f'<div class="card" id="{html.escape(ch["id"])}"><div class="id">{html.escape(ch["name"])} <small>{html.escape(ch["id"])} · {html.escape(ch["role"])} · '
            f'베이스 {html.escape(H.base_label(bk))}(RTP, CC BY 4.0) · Argon {html.escape(meta["effort"])} · 시도 {len(meta["attempts"])}회</small></div>'
            f'<p class="var">{html.escape(ch["desc"])}</p>'
            f'<div class="cmp"><figure><img src="data:image/png;base64,{b64png(grid(bp, bf, 5))}"><figcaption>수정 전(베이스) 5× — 위·오른쪽·아래·왼쪽 × 걸음 0·1·2</figcaption></figure>'
            f'<figure><img src="data:image/png;base64,{b64png(grid(pal, frames, 5))}"><figcaption>수정 후 5×</figcaption></figure>'
            f'<figure><img src="data:image/gif;base64,{gif_b64(bp, bf, 2)}"><figcaption>베이스 실크기 2× 걷기</figcaption></figure>'
            f'<figure><img src="data:image/gif;base64,{gif_b64(pal, frames, 2)}"><figcaption>수정 후 실크기 2× 걷기</figcaption></figure></div>'
            f'<div class="cap">수정 후 12프레임 8× (위 0 1 2 · 오른쪽 0 1 2 · 아래 0 1 2 · 왼쪽 0 1 2)</div>'
            f'<img class="big" src="data:image/png;base64,{b64png(row12(pal, frames, 8))}">'
            f'<div class="cap">수정 후 12프레임 1× (실제 픽셀 크기)</div>'
            f'<img src="data:image/png;base64,{b64png(row12(pal, frames, 1))}">'
            f'<div class="cap">수정 후 걷기 8× GIF</div><img class="big" src="data:image/gif;base64,{gif_b64(pal, frames, 8)}"></div>')
    rej = ''
    if a.rejected:
        items = json.loads(Path(a.rejected).read_text(encoding='utf-8'))
        rej = '<h2>불합격·보류</h2><ul>' + ''.join(f'<li><b>{html.escape(r["key"])}</b> — {html.escape(r["why"])}</li>' for r in items) + '</ul>'
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>{html.escape(a.title)}</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}h1{{margin:0 0 6px}}h2{{margin:28px 0 6px}}small{{color:#8fa0aa;font-weight:400;font-size:13px}}
.how{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:14px 18px;margin:12px 0 18px;max-width:1160px}}.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:12px;margin-bottom:22px;width:1160px;max-width:100%}}
.id{{font:600 16px system-ui;color:#ffd479;margin-bottom:2px}}.var{{color:#9fb0ba;margin:2px 0 8px;font-size:13px}}.cmp{{display:flex;gap:16px;margin-bottom:8px;align-items:flex-end;flex-wrap:wrap}}figure{{margin:0}}figcaption,.cap{{color:#8fa0aa;font-size:12px;margin:6px 0 2px}}img{{image-rendering:pixelated}}.big{{display:block;max-width:100%}}</style>
<h1>{html.escape(a.title)}</h1>
<div class="how">베이스 칩(EasyRPG RTP, CC BY 4.0)의 <b>머리·상의·하의·신발·장비</b>만 부위 마스크 안에서 Argon(gemini-4-argon-high)이 고친 칩입니다. 얼굴(눈·입)·맨살·몸 비율·다리·걷기 포즈는 하네스가 12프레임 전부 픽셀 대조로 불변을 검증했고,
감독이 8배·1배 12프레임 줄을 직접 보고 손에 쥔 장비·튀어나온 픽셀·네 방향이 같은 사람인지 확인해 <b>합격한 칩만</b> 싣습니다. 고르는 단계는 없습니다. 닌텐도 원작·파생 그림은 쓰지 않았습니다. 합격 {len(cards)}종.</div>
{"".join(cards)}{rej}</html>'''
    out = Path(a.out).expanduser()
    out.write_text(page, encoding='utf-8')
    print(out, len(cards), '종', len(page), 'bytes')


if __name__ == '__main__':
    main()
