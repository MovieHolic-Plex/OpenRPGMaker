#!/usr/bin/env python3
"""모델 호출 없는 Scarloxy People 칩 변형기(2026-10-16, Argon 쿼터 소진 대용·재현 가능한 스크립트 경로).

뼈대 = Scarloxy MPWSP01 People1~2 의 10명(CC BY 4.0). 두 가지 연산만 쓴다 — 둘 다 원작 그림의 화소를 옮기거나 색을 바꿀 뿐 새로 그리지 않는다:

  1) 머리 이식(head donor → body donor): 한 베이스의 머리(모자·머리카락·얼굴, 목 위 줄들)를 다른 베이스의 몸(옷·팔·다리) 위에 얹는다.
     머리는 목 줄을 몸의 목 줄에 맞춰 12프레임 모두 따로 옮기고(걸음 출렁임 보존), 몸의 맨살 색은 머리 주인의 피부 계열로 옮긴다.
     왼쪽 방향은 오른쪽 방향의 좌우 거울이다(Scarloxy 원본이 그렇다).  → 실루엣(모자·머리 모양)이 바뀐다.
  2) 부위 색 바꾸기(H 머리·모자 / T 상의 / B 하의 / S 신발): 색상 범위로 고른 색을 목표 색상으로 옮긴다(맨살·무채색은 건드리지 않는다).

  python3 scarloxy_compose.py roundtrip                  머리·몸 같은 베이스로 이식하면 원본과 화소 동일인지 확인(0 이면 통과)
  python3 scarloxy_compose.py build RECIPES.json --out DIR [--only key,key]   명세 → DIR/<key>/{chip.chr.txt,chip.png,meta.json}
  python3 scarloxy_compose.py sheet DIR --out ~/claude-viz/x.html           후보 시트(8배 4방향 + 1배)

명세(RECIPES.json)의 한 항목: {"key", "name", "head": "Scarloxy1:2", "body": "Scarloxy1:0", "recolor": [{"region": "H|T|B|S", "hue": [lo, hi], "to": {"hue": 215, "s": 1.0, "v": 1.0}}], ...}
검증은 하네스 규칙(chr.structural_errors · chr.gate ctff6 필터)에 한 몸 연결·팔레트 한도를 더한다. 사람 칩이라 3/4 관문(object-gate) 대상이 아니다.
"""
import argparse
import colorsys
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
import partedit as P  # noqa: E402
from PIL import Image  # noqa: E402

FW, FH, DIRS, T = C.FW, C.FH, C.DIRS, C.TRANSPARENT
# Scarloxy 칩은 윤곽이 검정이 아니라 색 있는 짙은 선이다. 머리를 다른 몸에 이식하면 머리·어깨 경계의 윤곽 구성이 달라져 「윤곽 어둠」 비율이 15%p 이상 흔들린다 — 30%p 로 넓히고 눈으로 확인한다.
C.LIMITS['dark_edge_drop'] = 0.30

# 피부 계열(밝음→어둠). 몸의 맨살은 머리 주인의 계열로 순서대로 옮긴다.
SKIN = {
    'fair': ['#fef7d7', '#feddb1', '#e29f7f', '#b56d5d'],
    'medium': ['#f5cca3', '#e4b387', '#c38365', '#a15d4a'],
    'tan': ['#f6cf98', '#eba06e', '#d9916c', '#c8885c', '#a2654a'],
}
SKIN_OF_BASE = {'Scarloxy1:0': 'fair', 'Scarloxy1:1': 'fair', 'Scarloxy1:2': 'tan', 'Scarloxy1:3': 'medium', 'Scarloxy1:4': 'medium',
                'Scarloxy1:5': 'fair', 'Scarloxy1:6': 'tan', 'Scarloxy1:7': 'medium', 'Scarloxy2:0': 'tan', 'Scarloxy2:1': 'fair'}
SKIN_MAP = {
    ('fair', 'medium'): {'#fef7d7': '#f5cca3', '#feddb1': '#f5cca3', '#e29f7f': '#e4b387', '#b56d5d': '#c38365'},
    ('fair', 'tan'): {'#fef7d7': '#eba06e', '#feddb1': '#eba06e', '#e29f7f': '#c8885c', '#b56d5d': '#a2654a'},
    ('medium', 'fair'): {'#f5cca3': '#feddb1', '#e4b387': '#e29f7f', '#c38365': '#e29f7f', '#a15d4a': '#b56d5d'},
    ('medium', 'tan'): {'#f5cca3': '#eba06e', '#e4b387': '#eba06e', '#c38365': '#c8885c', '#a15d4a': '#a2654a'},
    ('tan', 'fair'): {'#eba06e': '#feddb1', '#d9916c': '#e29f7f', '#c8885c': '#e29f7f', '#a2654a': '#b56d5d'},
    ('tan', 'medium'): {'#eba06e': '#f5cca3', '#d9916c': '#e4b387', '#c8885c': '#c38365', '#a2654a': '#a15d4a'},
}
ALL_SKIN = {c for tones in SKIN.values() for c in tones}
# 머리 이식 후보에서 빠지는 베이스: 머리카락이 목 아래까지 내려오는 긴 머리(#3 보라 소녀, #7 물 도장 보스)는 몸에서 잘리지 않게 몸 쪽에서만 쓴다.
LONG_HAIR = {'Scarloxy1:3', 'Scarloxy1:7'}


def hexc(rgb):
    return '#%02x%02x%02x' % tuple(rgb)


def grid_of(key):
    pal, fr = H.base_of(key)
    return {k: [[hexc(pal[c]) if c != T else None for c in row] for row in rows] for k, rows in fr.items()}


def cut_of(key):
    return P.SPECS[key]['t_start']


def bbox_x(g, y0, y1):
    xs = [x for y in range(max(0, y0), min(FH, y1)) for x in range(FW) if g[y][x]]
    return (min(xs), max(xs)) if xs else None


def compose_frame(hg, hcut, bg, bcut, hbob, bbob):
    """머리 프레임(hg, 머리=위 hcut+hbob 줄 미만), 몸 프레임(bg) → 합성 프레임·머리 화소 집합."""
    hrow = hcut + hbob
    brow = bcut + bbob
    out = [[bg[y][x] if y >= brow else None for x in range(FW)] for y in range(FH)]
    headpix = set()
    dy = brow - hrow
    hb = bbox_x(hg, 0, hrow)
    hbody = bbox_x(hg, hrow, FH)
    bb = bbox_x(bg, brow, FH)
    hc = (hb[0] + hb[1]) / 2 - (hbody[0] + hbody[1]) / 2
    bc = (bb[0] + bb[1]) / 2
    # 머리 중심 = 몸 중심 + (머리 주인에게서 잰 머리-몸 어긋남)
    dx = round((bc + hc) - (hb[0] + hb[1]) / 2)
    dx = max(min(1, hb[0]) - hb[0], min(max(22, hb[1]) - hb[1], dx))
    for y in range(hrow):
        for x in range(FW):
            c = hg[y][x]
            if not c:
                continue
            ny, nx = y + dy, x + dx
            if 0 <= ny < FH and 0 <= nx < FW:
                out[ny][nx] = c
                headpix.add((nx, ny))
            else:
                raise ValueError(f'머리 화소가 칸 밖으로 나간다({nx},{ny})')
    return out, headpix, (dx, dy)


def bob(g, d, f):
    rows = [''.join('x' if c else '.' for c in row) for row in g[(d, f)]]
    std = [''.join('x' if c else '.' for c in row) for row in g[(d, 1)]]
    return C.bob_of(std, rows)


def mirror(g):
    return [list(reversed(row)) for row in g]


def face_fixed(head_key, d, f, bob):
    """머리 주인의 고정 칸(원래 좌표) → {(x,y): 색 hex}. 얼굴 상자 안에서 ① 맨살 글자 ② 머리카락에 안 쓰인 글자(눈·눈동자·볼터치) ③ 상자 가운데 열(눈썹·눈 둘레)을 고정한다.
    상자 양끝 2열의 머리카락 글자(옆머리)만 머리 색 바꾸기를 받는다. 2026-10-16 2차(스크립트 칩 12프레임 고정 검사)에서 추가 — 기존 21종은 이 규칙 이전 판이라 다시 굽지 않는다."""
    pal, fr, lab, _, info = P.segment(head_key)
    boxes = P.SPECS[head_key]['face'].get(d)
    boxes = [] if not boxes else (list(boxes) if isinstance(boxes[0], (tuple, list)) else [boxes])
    skin = set(P.SPECS[head_key].get('skin', ''))
    rows = fr[(d, f)]
    top = min((b[1] for b in boxes), default=0) + bob
    hair = {rows[y][x] for y in range(0, top) for x in range(FW) if rows[y][x] != T} - skin
    out = {}
    for (x0, y0, x1, y1) in boxes:
        for y in range(y0 + bob, y1 + bob + 1):
            for x in range(x0, x1 + 1):
                if not (0 <= y < FH) or rows[y][x] == T:
                    continue
                c = rows[y][x]
                interior = x0 + 2 <= x <= x1 - 2
                if c in skin or c not in hair or interior:
                    out[(x, y)] = hexc(pal[c])
    return out


def compose(head_key, body_key):
    hg, bg = grid_of(head_key), grid_of(body_key)
    hcut, bcut = cut_of(head_key), cut_of(body_key)
    hs, bs = SKIN_OF_BASE[head_key], SKIN_OF_BASE[body_key]
    smap = SKIN_MAP.get((bs, hs), {}) if bs != hs else {}
    frames, heads, fixed = {}, {}, {}
    sil = lambda g, k: [''.join('x' if c else '.' for c in row) for row in g[k]]
    bspec = P.SPECS[body_key]
    _, bfr, blab, _, _ = P.segment(body_key)
    bpal = H.base_of(body_key)[0]
    for d in DIRS:   # 왼쪽도 베이스 자기 프레임을 쓴다(원본이 거울에서 1px 어긋나는 칩이 있다)
        for f in range(3):
            body = bg[(d, f)]
            if smap:
                body = [[smap.get(c, c) if c else None for c in row] for row in body]
            bb = C.bob_of(sil(bg, (d, 1)), sil(bg, (d, f))) if f != 1 else 0
            hb = C.bob_of(sil(hg, (d, 1)), sil(hg, (d, f))) if f != 1 else 0
            out, hp, (dx, dy) = compose_frame(hg[(d, f)], hcut, body, bcut, hb, bb)
            frames[(d, f)], heads[(d, f)] = out, hp
            fx = {(x + dx, y + dy): c for (x, y), c in face_fixed(head_key, d, f, hb).items() if y < hcut + hb}
            for y in range(bcut + bb, FH):          # 몸 주인의 맨살·손(F) 칸: 피부 계열 변환값으로 고정
                for x in range(FW):
                    if blab[(d, f)][y][x] == 'F' and bfr[(d, f)][y][x] != T:
                        fx[(x, y)] = body[y][x]
            fixed[(d, f)] = fx
    return frames, heads, fixed


def labels(body_key, frames, heads, fixed=None):
    sp = P.SPECS[body_key]
    waist, shoe = sp['waist'], sp['shoe_top']
    lab = {}
    for k, g in frames.items():
        rows = []
        for y in range(FH):
            r = []
            for x in range(FW):
                c = g[y][x]
                if not c:
                    r.append(None)
                elif fixed is not None and (x, y) in fixed[k]:
                    r.append('F')
                elif (x, y) in heads[k]:
                    r.append('H')
                elif y < waist:
                    r.append('T')
                elif y < shoe:
                    r.append('B')
                else:
                    r.append('S')
            rows.append(r)
        lab[k] = rows
    return lab


def hsv(c):
    r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return h * 360, s, v


def from_hsv(h, s, v):
    r, g, b = colorsys.hsv_to_rgb((h % 360) / 360, min(1, max(0, s)), min(1, max(0, v)))
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


def recolor_rule(c, rule):
    """색 하나가 규칙에 걸리면 새 색, 아니면 None. 맨살(ALL_SKIN)은 규칙이 hex 목록을 직접 주지 않는 한 건드리지 않는다."""
    if 'map' in rule:
        return rule['map'].get(c)
    if c in ALL_SKIN:
        return None
    h, s, v = hsv(c)
    lo, hi = rule.get('hue', (0, 360))
    inside = (lo <= h <= hi) if lo <= hi else (h >= lo or h <= hi)           # lo>hi 는 0도를 가로지르는 범위
    if s < rule.get('smin', 0.18) and not rule.get('gray'):
        return None
    if rule.get('gray'):                                                      # 무채색(흰·회색)만 고른다
        if s >= 0.18 or not (rule['gray'][0] <= v <= rule['gray'][1]):
            return None
    elif not inside:
        return None
    if not (rule.get('vmin', 0) <= v <= rule.get('vmax', 1)) or s > rule.get('smax', 1.0):
        return None
    to = rule['to']
    nh = to['hue'] if to.get('hue') is not None else h
    ns = to['sat'] if to.get('sat') is not None else s * to.get('s', 1.0)
    nv = (to['vlin'][0] + to['vlin'][1] * v) if to.get('vlin') else v * to.get('v', 1.0)
    return from_hsv(nh, ns, nv)


def recolor(frames, lab, rules):
    out = {k: [row[:] for row in g] for k, g in frames.items()}
    cache = {}
    for k, g in out.items():
        for y in range(FH):
            for x in range(FW):
                c = g[y][x]
                if not c:
                    continue
                region = lab[k][y][x]
                key = (region, c)
                if key not in cache:
                    new = None
                    for rule in rules:
                        if region == 'F' or rule['region'] not in ('*', region):
                            continue
                        new = recolor_rule(c, rule)
                        if new:
                            break
                    cache[key] = new or c
                g[y][x] = cache[key]
    return out


def to_chr(frames):
    colors = sorted({c for g in frames.values() for row in g for c in row if c},
                    key=lambda c: (0.299 * int(c[1:3], 16) + 0.587 * int(c[3:5], 16) + 0.114 * int(c[5:7], 16), c))
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    if len(colors) > len(letters):
        raise ValueError(f'색 {len(colors)}개')
    ch = {c: letters[i] for i, c in enumerate(colors)}
    pal = {T: None, **{letters[i]: (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)) for i, c in enumerate(colors)}}
    rows = {k: [''.join(ch[c] if c else T for c in row) for row in g] for k, g in frames.items()}
    return pal, rows


def components(rows):
    cells = {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != T}
    seen, n = set(), []
    for c in cells:
        if c in seen:
            continue
        st, comp = [c], 0
        seen.add(c)
        while st:
            x, y = st.pop()
            comp += 1
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q in cells and q not in seen:
                        seen.add(q)
                        st.append(q)
        n.append(comp)
    return sorted(n, reverse=True)


def check(pal, rows, body_key, head_key=None, waive=()):
    """→ (errors, warnings). 하네스 구조·gate(ctff6 필터) + 한 몸 연결."""
    errs, warns = [], []
    errs += C.structural_errors(pal, rows)
    if errs:
        return errs, warns
    for k, r in rows.items():
        comps = components(r)
        if len(comps) > 1 and comps[1] > 2:
            errs.append(f'{k[0]} {k[1]}: 떨어진 덩어리 {comps[:4]} — 머리와 몸이 이어지지 않는다')
        elif len(comps) > 1:
            warns.append(f'{k[0]} {k[1]}: 떨어진 점 {comps[1:]}')
    used = {c for r in rows.values() for row in r for c in row if c != T}
    if len(used) > 48:
        errs.append(f'쓰인 색 {len(used)}개 > 48')
    # 머리·몸이 다른 베이스에서 오므로 뼈대 대비 검사(윤곽 어둠·경계 픽셀·내부 결손)는 두 뼈대 중 하나라도 통과하면 통과로 본다.
    def gate_errors(base_key):
        bpal, bframes = H.base_of(base_key)
        g = C.gate(pal, rows, (bpal, bframes), strength='ctff6')
        found = []
        for t in g.get('fails', []):
            if '튀어나온' in t or '뼈대 실루엣' in t or '새 캐릭터' in t or '모양을 다시' in t or ('실루엣' in t and '범위' not in t):
                continue
            found.append(t)
        return found, g.get('warns', [])
    bodies = [body_key] + ([head_key] if head_key and head_key != body_key else [])
    results = [gate_errors(k) for k in bodies]
    best = min(results, key=lambda r: len(r[0]))
    # waive: 레시피가 사유와 함께 적은 항목만 면제한다(눈으로 확인한 뒤). edge = 머리 주인 칩의 땋은 머리가 프레임 끝(x=0·23)에 닿아 몸 뼈대 기준으로는 「새 경계 픽셀·내부 결손」으로 보이는 경우,
    # outline = 머리·몸 주인의 윤곽 색 톤이 달라(갈색 vs 짙은 남색) 「윤곽 어둠」 비율이 흔들리는 경우.
    marks = {'edge': ('경계에 새 픽셀', '몸체 내부 투명 결손'), 'outline': ('윤곽 픽셀 중 어두운 것',)}
    skip = tuple(m for w in waive for m in marks[w])
    errs += [e for e in best[0] if not any(m in e for m in skip)]
    warns += best[1] + [f'면제: {w}' for w in waive]
    return errs, warns


def lock_check(pal, rows, fixed):
    """얼굴·피부·손 12프레임 화소 고정 검사(스크립트 칩). 고정 칸마다 결과 색이 원본(피부 계열 변환 뒤)과 같아야 한다 → (errors, 요약)."""
    errs, n = [], 0
    for (d, f), fx in fixed.items():
        grid = rows[(d, f)]
        for (x, y), want in fx.items():
            n += 1
            c = grid[y][x]
            got = hexc(pal[c]) if c != T else None
            if got != want:
                errs.append(f'{d} {f} ({x},{y}): 고정 칸(얼굴·피부·손)이 {want} → {got} 로 바뀌었다')
    return errs[:6], f'고정 검사: 12프레임 {n}칸(얼굴·눈·피부·손) 화소 동일 — ' + ('통과' if not errs else f'실패 {len(errs)}+')


def build_one(rec):
    frames, heads, fixed = compose(rec['head'], rec['body'])
    lab = labels(rec['body'], frames, heads, fixed if rec.get('lock') else None)
    if rec.get('recolor'):
        frames = recolor(frames, lab, rec['recolor'])
    pal, rows = to_chr(frames)
    errs, warns = check(pal, rows, rec['body'], rec['head'], rec.get('waive', ()))
    if rec.get('lock'):
        lerrs, lsum = lock_check(pal, rows, fixed)
        errs, warns = errs + lerrs, warns + [lsum]
    return pal, rows, errs, warns


def cmd_roundtrip(a):
    bad = 0
    for key in [f'Scarloxy1:{i}' for i in range(8)] + ['Scarloxy2:0', 'Scarloxy2:1']:
        if key in LONG_HAIR:
            continue
        frames, heads, _ = compose(key, key)
        base = grid_of(key)
        diff = sum(1 for d in ('up', 'right', 'down') for f in range(3) for y in range(FH) for x in range(FW) if frames[(d, f)][y][x] != base[(d, f)][y][x])
        print(key, 'identical' if diff == 0 else f'{diff} px differ')
        bad += diff != 0
    sys.exit(1 if bad else 0)


def chip_png(pal, rows):
    return C.sheet_rgba(pal, rows)


def cmd_build(a):
    recipes = json.loads(Path(a.recipes).read_text(encoding='utf-8'))
    out = Path(a.out)
    only = set(a.only.split(',')) if a.only else None
    fail = 0
    for rec in recipes['chips']:
        if only and rec['key'] not in only:
            continue
        pal, rows, errs, warns = build_one(rec)
        d = out / rec['key']
        d.mkdir(parents=True, exist_ok=True)
        meta = dict(key=rec['key'], name=rec.get('name'), head=rec['head'], body=rec['body'], recolor=rec.get('recolor', []), ok=not errs,
                    errors=errs, warnings=warns[:3], model='script-compose(no model call)')
        (d / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
        if not errs:
            (d / 'chip.chr.txt').write_text(C.dump(pal, {}, rows, header=f'{rec["key"]} — script-compose head={rec["head"]} body={rec["body"]}'), encoding='utf-8')
            chip_png(pal, rows).save(d / 'chip.png')
        else:
            fail += 1
        print(rec['key'], 'OK' if not errs else 'FAIL ' + '; '.join(errs[:3]))
    sys.exit(1 if fail else 0)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('roundtrip')
    b = sub.add_parser('build')
    b.add_argument('recipes')
    b.add_argument('--out', required=True)
    b.add_argument('--only')
    a = ap.parse_args()
    {'roundtrip': cmd_roundtrip, 'build': cmd_build}[a.cmd](a)


if __name__ == '__main__':
    main()
