#!/usr/bin/env python3
"""1차 스크립트 칩 12종 재제작(3차) 증거 시트(자체완결 HTML, 2026-10-16). 사용:
  python3 scarloxy_sheet3.py --out ~/claude-viz/monster-people-chips-3.html

입력: harness-data/charset-actor/scarloxy-people/redo.json  {chips:[{key,run,rkey,desc,verdict}], kept:[{key,reason,tried}], judge:{...}}
      설치 명단(scarloxy-people-install.json) · scarloxy-people-chips/<key>/chip.v1.chr.txt(옛 격자) · 설치된 시트(교체 뒤 화소)
내용: 요약(교체·유지) · 12종 카드(전 8배 / 후 8배 · 후 12프레임 1배 · 독립 판정 점수·말 · 고정 검사 전후 · 하네스 기록) · 유지한 칩 이유.
이미지는 data URI. 「전」은 보존한 옛 격자, 「후」는 설치된 시트에서 자른 그림(사람이 본 그림 = 설치된 그림).
"""
import argparse
import html
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import scarloxy_compose as SC  # noqa: E402
import scarloxy_lock as L  # noqa: E402
import scarloxy_sheet2 as S2  # noqa: E402
from PIL import Image  # noqa: E402

PICKS = ROOT / 'harness-data/charset-actor/scarloxy-people-chips'
INSTALL = ROOT / 'harness-data/charset-actor/scarloxy-people-install.json'
REDO = ROOT / 'harness-data/charset-actor/scarloxy-people/redo.json'
SHEETS = ROOT / 'public/assets/generated/charsets'
BG = S2.BG


def old_lock(key):
    """옛(1차 스크립트) 칩이 새 12프레임 고정 검사를 통과하는가 → (칸, 어긋난 칸)."""
    d = PICKS / key
    meta = json.loads((d / 'meta.v1.json').read_text(encoding='utf-8'))
    pal, _, frames = C.load(d / 'chip.v1.chr.txt')
    _, _, fixed = SC.compose(meta['head'], meta['body'])
    total = bad = 0
    for fk, fx in fixed.items():
        for (x, y), want in fx.items():
            total += 1
            if L.hexof(pal, frames[fk][y][x]) != want:
                bad += 1
    return total, bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    redo = json.loads(REDO.read_text(encoding='utf-8'))
    install = json.loads(INSTALL.read_text(encoding='utf-8'))
    rows = {c['key']: (s['n'], i, c) for s in install['sheets'] for i, c in enumerate(s['characters'])}
    sheets = {n: Image.open(SHEETS / f'ScarloxyPeople{n}.png').convert('RGBA') for n in {r[0] for r in rows.values()}}
    esc = html.escape
    cards = []
    for e in redo['chips']:
        n, idx, c = rows[e['key']]
        after = S2.cell(sheets[n], idx)
        pal, _, frames = C.load(PICKS / e['key'] / 'chip.v1.chr.txt')
        before = C.sheet_rgba(pal, frames)
        meta = json.loads((PICKS / e['key'] / 'meta.json').read_text(encoding='utf-8'))
        lk = L.check(e['key'])
        ot, ob = old_lock(e['key'])
        v = e.get('verdict') or {}
        info = meta.get('repairs') or {}
        dist = meta.get('distinct') or {}
        cards.append(f'''<div class="card"><h3>{esc(c["name"])} <small>ScarloxyPeople{n}#{idx} · {esc(c["id"])}</small></h3>
<div class="pair"><div><b>전(1차 스크립트)</b><img src="{S2.b64(S2.four(before, 8))}"></div><div><b>후(Argon 재제작, 설치된 그림)</b><img src="{S2.b64(S2.four(after, 8))}"></div>
<div><b>후 12프레임 1배</b><img src="{S2.b64(S2.frames1x(after))}" style="image-rendering:pixelated"></div></div>
<p class="d">{esc(c["desc"])}</p>
<table><tr><th>고정 검사(눈·피부·손 12프레임)</th><td>전: {ob}/{ot}칸 어긋남 → 후: {lk["bad"]}/{lk["cells"]}칸 어긋남 ({"통과" if lk["ok"] else "실패"})</td></tr>
<tr><th>독립 판정(tile-artist)</th><td><b>{esc(str(v.get("score", "")))}</b>/10 · {esc(v.get("pass", ""))} — {esc(v.get("text", ""))}</td></tr>
<tr><th>시도 기록</th><td>이 직군 Argon 주문 {e.get("tried", {}).get("orders", "?")}건 중 하네스 통과 {e.get("tried", {}).get("machine_ok", "?")}건 → 독립 판정으로 이 칩 채택</td></tr>
<tr><th>저작</th><td>{esc(meta["model"])} · 뼈대 {esc(meta["base"])} · 시도 {meta["attempts"]}회 · 가장 가까운 칩과 다른 화소 {round((dist.get("score") or 0) * 100)}% · 하네스 정리: 삐죽 점 {info.get("dropped_stray_px", 0)}칸 제거 · 구멍 {info.get("hole_filled_px", 0)}칸 메움</td></tr></table></div>''')
    kept = []
    for k in redo.get('kept', []):
        n, idx, c = rows[k['key']]
        img = S2.cell(sheets[n], idx)
        kept.append(f'''<div class="card keep"><h3>{esc(c["name"])} <small>ScarloxyPeople{n}#{idx} — 유지(교체 안 함)</small></h3>
<div class="pair"><div><b>현재 칩(그대로)</b><img src="{S2.b64(S2.four(img, 8))}"></div></div><p>{esc(k["reason"])}</p><p>이 직군 Argon 주문 {k.get("tried", {}).get("orders", "?")}건, 하네스 통과 {k.get("tried", {}).get("machine_ok", "?")}건, 판정 8점 이상 0건.</p></div>''')
    head = f'''<!doctype html><meta charset="utf-8"><title>몬스터 세계 사람 칩 3차 — 1차 스크립트 12종 재제작</title>
<style>body{{font:14px/1.5 system-ui,sans-serif;background:#1b1f24;color:#e8e8e8;margin:0;padding:20px 28px;max-width:1500px}}
h1{{font-size:21px}}h3{{margin:0 0 6px;font-size:16px}}small{{color:#9ab;font-weight:400}}.card{{background:#252b33;border-radius:8px;padding:12px 14px;margin:14px 0}}
.card.keep{{border-left:4px solid #c93}}.pair{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}}.pair img{{display:block;margin-top:4px;image-rendering:pixelated}}
table{{border-collapse:collapse;margin-top:6px}}th,td{{border:1px solid #3a424d;padding:4px 8px;text-align:left;vertical-align:top}}th{{background:#2d343e;white-space:nowrap}}
.d{{color:#cfd8dc;margin:6px 0}}.sum td,.sum th{{font-size:13px}}</style>'''
    summary = redo.get('summary_html', '')
    body = f'''<h1>몬스터 세계 사람 칩 3차 — 1차 스크립트 칩 12종 재제작 (Argon 부분 편집)</h1>{summary}
<h2>교체한 칩 {len(cards)}종</h2>{"".join(cards)}
<h2>유지한 칩 {len(kept)}종</h2>{"".join(kept) if kept else "<p>없음 — 12종 모두 교체했다.</p>"}'''
    Path(a.out).expanduser().write_text(head + body, encoding='utf-8')
    print('wrote', a.out, len(cards), 'replaced', len(kept), 'kept')


if __name__ == '__main__':
    main()
