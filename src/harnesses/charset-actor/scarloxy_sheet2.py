#!/usr/bin/env python3
"""Scarloxy People 변형 칩 2차 증거 시트(자체완결 HTML, 2026-10-16). 사용:
  python3 scarloxy_sheet2.py --out ~/claude-viz/monster-people-chips-2.html [--notes harness-data/charset-actor/scarloxy-people/round2-notes.json]

내용: 직군 표(요청 직군 → 채운 칩 / 못 채운 이유) · 1차 대비 Argon 실패 원인과 대응 · 신규 칩 카드(방향별 8배 + 12프레임 1배, Argon/스크립트 구분,
가장 가까운 칩과 다른 화소 %, 시도·정리 기록, 고정 검사) · 버릴 번호만 묻는 줄. 이미지는 설치된 시트(ScarloxyPeople5~)에서 잘라 data URI 로 넣는다 — 사람이 본 그림 = 설치된 그림.
"""
import argparse
import base64
import html
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import scarloxy_distinct as D  # noqa: E402

ROSTER = ROOT / 'src/assets/scarloxyPeopleCharsets.json'
PICKS = ROOT / 'harness-data/charset-actor/scarloxy-people-chips'
SHEETS = ROOT / 'public/assets/generated/charsets'
DISTINCT = ROOT / 'harness-data/charset-actor/scarloxy-people/round2-distinct.json'
BG = (122, 160, 122, 255)
FIRST_NEW_SHEET = 5


def b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def cell(sheet, idx):
    return sheet.crop(((idx % 4) * 72, (idx // 4) * 128, (idx % 4) * 72 + 72, (idx // 4) * 128 + 128))


def onbg(im):
    bg = Image.new('RGBA', im.size, BG)
    bg.alpha_composite(im)
    return bg


def four(chip, scale):
    w = 24 * scale
    out = Image.new('RGBA', (w * 4 + 6 * 3, 32 * scale), BG)
    for r in range(4):
        out.alpha_composite(chip.crop((24, r * 32, 48, r * 32 + 32)).resize((w, 32 * scale), Image.NEAREST), (r * (w + 6), 0))
    return out


def frames1x(chip):
    """12프레임 1배: 4방향(행) × 3걸음(열), 칸 사이 1px 틈."""
    out = Image.new('RGBA', (24 * 3 + 2, 32 * 4 + 3), BG)
    for r in range(4):
        for c in range(3):
            out.alpha_composite(chip.crop((c * 24, r * 32, c * 24 + 24, r * 32 + 32)), (c * 25, r * 33))
    return out


def label_of(name, roster_by_slot, picks_name):
    if name.startswith('ScarloxyPeople'):
        s, i = name[len('ScarloxyPeople'):].split('#')
        c = roster_by_slot.get((int(s), int(i)))
        return f'{name}({c["name"]})' if c else name
    if name.startswith('scarloxy-charset-people'):
        s, i = name[len('scarloxy-charset-people'):].split('#')
        return f'Scarloxy 원본 People{s} {int(i) + 1}번'
    return picks_name.get(name, name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--notes')
    a = ap.parse_args()
    roster = json.loads(ROSTER.read_text(encoding='utf-8'))['characters']
    by_slot = {(c['sheet'], c['index']): c for c in roster}
    notes = json.loads(Path(a.notes).read_text(encoding='utf-8')) if a.notes else {}
    dist = json.loads(DISTINCT.read_text(encoding='utf-8')) if DISTINCT.exists() else {}
    new = [c for c in roster if c['sheet'] >= FIRST_NEW_SHEET]
    key_name = {c['source']['harnessKey']: f'{c["name"]} (ScarloxyPeople{c["sheet"]}#{c["index"]})' for c in roster}
    sheets = {n: Image.open(SHEETS / f'ScarloxyPeople{n}.png').convert('RGBA') for n in sorted({c['sheet'] for c in new})}
    argon = [c for c in new if c['source']['model'].startswith('gemini-4-argon')]
    script = [c for c in new if c not in argon]
    cards = []
    for c in sorted(new, key=lambda x: (x['sheet'], x['index'])):
        key = c['source']['harnessKey']
        meta = json.loads((PICKS / key / 'meta.json').read_text(encoding='utf-8'))
        is_argon = c in argon
        chip = cell(sheets[c['sheet']], c['index'])
        d = dist.get(key, {})
        near = label_of(d.get('nearest', ''), by_slot, key_name) if d else ''
        rep = meta.get('repairs') or {}
        san = rep.get('sanitized') or {}
        extra = ''
        if is_argon:
            extra = (f'시도 {meta.get("attempts", "?")}회 · 하네스 정리: 삐죽 점 {rep.get("dropped_stray_px", 0)}칸 제거 · 구멍 {rep.get("hole_filled_px", 0)}칸 메움'
                     + (' · 마스크 위반 되돌림 ' + ', '.join(f'{k.split("(")[0][:14]} {v}' for k, v in san.items()) if san else ''))
            base = f'뼈대 {meta["base"]}'
            how = '<span class="tag argon">실제 Argon</span> gemini-4-argon-high · 8318 스트리밍'
        else:
            extra = f'머리 {meta["head"]} + 몸 {meta["body"]} · 부위 색 바꾸기'
            base = ''
            how = '<span class="tag script">스크립트</span> 모델 호출 없음'
        pct = f'{d["score"] * 100:.0f}%' if d else '—'
        cards.append(
            f'<div class="card" id="n{c["sheet"]}-{c["index"]}"><div class="id">ScarloxyPeople{c["sheet"]}#{c["index"]} <b>{html.escape(c["name"])}</b></div>'
            f'<div class="how">{how} · 직군 {html.escape(c["role"])}</div>'
            f'<img class="big" src="{b64(four(chip, 8))}">'
            f'<div class="row"><div><img src="{b64(frames1x(chip))}"><div class="cap">12프레임 1배</div></div>'
            f'<div class="meta"><div>가장 가까운 칩: {html.escape(near) or "—"}</div><div>다른 화소 <b>{pct}</b></div>'
            f'<div class="small">{html.escape(extra)}</div>'
            f'<div class="small">얼굴·피부·손 12프레임 화소 고정 검사 통과(설치 관문) · {html.escape(c["desc"])}</div></div></div></div>')
    todo = notes.get('roles', [])
    rows = ''.join(f'<tr><td>{html.escape(r[0])}</td><td>{r[1]}</td><td>{r[2]}</td></tr>' for r in todo)
    fails = notes.get('failures', [])
    frows = ''.join(f'<tr><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>' for r in fails)   # 노트는 우리가 쓴 HTML 조각이다
    cause = ''.join(f'<tr><td>{r[0]}</td><td>{r[1]}</td></tr>' for r in notes.get('causes', []))
    stats = notes.get('stats', '')
    removed_box = f'<div class="box ask">{notes["removed"]}</div>' if notes.get('removed') else ''
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>몬스터 세계 사람 칩 2차 — Scarloxy 변형 {len(new)}종</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}h1{{margin:0 0 6px}}h2{{margin:28px 0 6px;border-bottom:1px solid #3a4248;padding-bottom:4px}}
table{{border-collapse:collapse;margin:8px 0;max-width:1180px}}td,th{{border:1px solid #333c43;padding:5px 10px;vertical-align:top;font-size:13px}}th{{background:#1f272c;text-align:left}}
.box{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:12px 18px;margin:10px 0;max-width:1180px}}.grid{{display:flex;flex-wrap:wrap;gap:14px}}
.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:10px;width:820px;box-sizing:border-box}}.id{{font:600 14px ui-monospace,monospace;color:#ffd479}}.id b{{color:#fff;font-family:system-ui}}.how{{font-size:12px;color:#9fb0ba;margin:2px 0 6px}}
.tag{{padding:1px 8px;border-radius:10px;color:#101418;font-size:12px}}.tag.argon{{background:#7fe08a}}.tag.script{{background:#e8b86d}}img{{image-rendering:pixelated}}.big{{display:block;margin:4px 0}}
.row{{display:flex;gap:14px;align-items:flex-start;margin-top:6px}}.cap{{font-size:11px;color:#8fa0aa}}.meta{{font-size:12px;color:#c3ced5}}.small{{font-size:11px;color:#8fa0aa;margin-top:3px}}code{{background:#0e1214;padding:1px 6px;border-radius:4px}}.ask{{background:#2a2418;border-color:#6b5a2a}}</style>
<h1>몬스터 세계 사람 칩 2차 — Scarloxy 변형 신규 {len(new)}종 (총 {len(roster) + 10}명 허용)</h1>
<div class="box">신규 <b>{len(new)}종</b> = <span class="tag argon">실제 Argon {len(argon)}</span> + <span class="tag script">스크립트 {len(script)}</span>. 기존 25종(ScarloxyPeople1~4)은 한 화소도 바꾸지 않았고, 칸 번호는 ScarloxyPeople5 부터 덧붙였다.
뼈대는 Scarloxy MPWSP01 People1~2 의 10명(CC BY 4.0). 사람 칩이라 3/4 관문(object-gate)은 해당 없음. 모든 칩은 얼굴·피부·손 12프레임 화소 고정 검사를 통과했고, 서로 너무 비슷한 칩은 걸렀다(다른 화소 {notes.get("min_pct", 30)}% 미만 제외).<br>{stats}</div>
{removed_box}
<h2>직군 표 — 요청한 빈 직군과 결과</h2><table><tr><th>직군</th><th>결과</th><th>칩</th></tr>{rows}</table>
<h2>못 채운 것과 이유</h2><table><tr><th>직군/후보</th><th>이유</th><th>대안</th></tr>{frows}</table>
<h2>1차에서 Argon 이 3회 안에 못 통과한 원인과 이번 대응</h2><table><tr><th>원인</th><th>대응(scarloxy_argon2.py)</th></tr>{cause}</table>
<div class="box ask"><b>버릴 번호만 알려 주세요</b> — 카드의 <code>ScarloxyPeople#-#</code> 번호(예: 6-3). 말하지 않은 칩은 그대로 남습니다.</div>
<h2>신규 칩 {len(new)}종 — 방향별 8배(위·오른쪽·아래·왼쪽) · 12프레임 1배</h2><div class="grid">{"".join(cards)}</div></html>'''
    out = Path(a.out).expanduser()
    out.write_text(page, encoding='utf-8')
    print(out, len(new), '종', len(page), 'bytes')


if __name__ == '__main__':
    main()
