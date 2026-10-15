#!/usr/bin/env python3
"""부위 마스크 안에서만 고치는 칩 변형(2026-10-15, CT·FF6 원형 하네스 3·4차) — 분할·편집 연산·불변 검증.

베이스 칩(RTP 한 칸) 12프레임을 부위로 나눈다:
  H 머리(머리카락+이마 띠)   편집 가능: 리컬러 · 행 교체 · 머리 장식 구역(Zh)
  F 얼굴·맨살·눈·손          고정(픽셀 불변)
  T 상의(소매 포함)          편집 가능: 리컬러 · 행 교체 · 어깨 구역(Zt, 몸통 옆 2칸)
  B 하의(바지·치마)          리컬러만
  S 신발                     리컬러만
  장비 구역(Zg)              몸 옆 4칸 띠 — 장비 스프라이트를 올릴 수 있다(방향마다 따로, 거울 복사 없음)
걷기 프레임(0·2)과 왼쪽 방향은 서 있는 그림의 같은 연산을 마스크 대응으로 옮겨 만든다.
다리·걷기 포즈·프레임 간 출렁임은 베이스 그대로라 건드릴 수 없다(검증기가 12프레임 전부 픽셀 대조).

  python3 partedit.py masks BASE [BASE ...] --out masks.html     분할 확인용 마스크 시트
  python3 partedit.py apply WORKDIR                              편집(edit.json)을 적용·검증하고 preview.png 를 쓴다(모델도 쓴다)
"""
import colorsys
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
from PIL import Image  # noqa: E402

FW, FH = C.FW, C.FH
DIRS = C.DIRS
T = '.'
REG_COLOR = {'H': (230, 150, 40), 'F': (40, 200, 220), 'T': (70, 110, 240), 'B': (170, 80, 220), 'S': (150, 100, 50),
             'h': (255, 220, 120), 't': (140, 170, 255), 'g': (120, 230, 120)}
EDITABLE = 'HTBS'


# ─────────────────────────────── 분할 ───────────────────────────────
def skin_like(rgb):
    r, g, b = rgb
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.015 <= h <= 0.11 and 0.12 <= s <= 0.58 and v >= 0.74 and r > g > b


def opaque_rows(rows):
    return [y for y, r in enumerate(rows) if any(c != T for c in r)]


def bbox(rows):
    ys = opaque_rows(rows)
    xs = [x for r in rows for x, c in enumerate(r) if c != T]
    return min(xs), min(ys), max(xs), max(ys)


def head_skin(pal, rows, top, skin_letters=None):
    """머리 구역(top..top+13)·중앙 열의 맨살 픽셀 → (x0, y0, x1, y1) 또는 None."""
    pts = []
    for y in range(top, min(FH, top + 14)):
        for x in range(4, 20):
            c = rows[y][x]
            if c == T:
                continue
            if (skin_letters is not None and c in skin_letters) or (skin_letters is None and skin_like(pal[c])):
                pts.append((x, y))
    if len(pts) < 4:
        return None
    ys = sorted(p[1] for p in pts)
    # 맨 아래 줄이 하나뿐이면(목) 턱 줄에서 뺀다
    cnt = {}
    for _, y in pts:
        cnt[y] = cnt.get(y, 0) + 1
    ys_ok = [y for y in cnt if cnt[y] >= 3]
    if not ys_ok:
        return None
    y0, y1 = min(ys_ok), max(ys_ok)
    xs = [x for x, y in pts if y0 <= y <= y1]
    return min(xs), y0, max(xs), y1


def segment(key, overrides=None):
    """베이스 → (pal, frames, labels{(d,f): [[region char]]}, zones{(d,f): {'h','t','g'} → set}, info)."""
    pal, frames = H.base_of(H.norm_base(key))
    ov = dict((OVERRIDES.get(H.norm_base(key)) or {}), **(overrides or {}))
    skin_letters = set(ov['skin']) if 'skin' in ov else None
    # 방향별 기준(서 있는 자세)
    down = frames[('down', 1)]
    top1 = bbox(down)[1]
    sk = head_skin(pal, down, top1, skin_letters)
    chin_off = (sk[3] - top1) if sk else 9
    forehead_off = (sk[1] - top1) if sk else 3
    foot = bbox(down)[3]
    # 칸 비율 기본값: 발 바닥 2줄 = 신발, 그 위 4줄 = 하의, 그 위 = 상의. 틀린 베이스는 OVERRIDES 로 보정한다.
    legs_top = None
    waist = ov.get('waist', foot - 6)
    shoe_top = ov.get('shoe_top', foot - 1)
    info = dict(top=top1, chin_off=chin_off, forehead_off=forehead_off, foot=foot, legs_top=legs_top, waist=waist, shoe_top=shoe_top,
                face=bool(sk), skin_letters=''.join(sorted(skin_letters)) if skin_letters else None)
    labels, zones = {}, {}
    for d in DIRS:
        for f in range(3):
            rows = frames[(d, f)]
            x0, y0, x1, y1 = bbox(rows)
            sk_f = head_skin(pal, rows, y0, skin_letters) if (d != 'up') else None
            chin = y0 + chin_off
            lab = [[T] * FW for _ in range(FH)]
            for y in range(FH):
                for x in range(FW):
                    c = rows[y][x]
                    if c == T:
                        continue
                    skin = (skin_letters is not None and c in skin_letters) or (skin_letters is None and skin_like(pal[c]))
                    if y <= chin + 1 and y >= y0 and y < y0 + 14 and y <= chin:
                        # 머리 구역
                        if sk_f is not None and y >= sk_f[1] + 2 and sk_f[0] - 1 <= x <= sk_f[2] + 1:
                            lab[y][x] = 'F'          # 눈~턱, 얼굴 폭 ±1
                        elif skin and sk_f is not None and y >= sk_f[1] + 2:
                            lab[y][x] = 'F'          # 귀·옆 맨살
                        else:
                            lab[y][x] = 'H'
                    elif y <= chin + 1:
                        lab[y][x] = 'F' if skin else 'H'   # 턱 아래 한 줄(목)
                    elif y < waist:
                        lab[y][x] = 'F' if skin else 'T'
                    elif y < shoe_top:
                        lab[y][x] = 'F' if skin else 'B'
                    else:
                        lab[y][x] = 'F' if skin else 'S'
            labels[(d, f)] = lab
            op = {(x, y) for y in range(FH) for x in range(FW) if rows[y][x] != T}
            zh, zt, zg = set(), set(), set()
            hx0, hx1 = x0, x1
            heads = [x for y in range(y0, chin + 1) for x in range(FW) if rows[y][x] != T]
            if heads:
                hx0, hx1 = min(heads), max(heads)
            for y in range(max(1, y0 - 3), chin + 1):
                for x in range(max(1, hx0 - 1), min(FW - 1, hx1 + 2)):
                    if (x, y) not in op and (y < y0 + forehead_off + 2):
                        zh.add((x, y))
            for y in range(chin + 2, waist):
                for x in range(1, FW - 1):
                    if (x, y) not in op and any((x + dx, y) in op and lab[y][x + dx] == 'T' for dx in (-2, -1, 1, 2)):
                        zt.add((x, y))
            for y in range(max(1, y0 - 3), foot + 1):
                for x in list(range(max(1, x0 - 4), x0)) + list(range(x1 + 1, min(FW - 1, x1 + 5))):
                    if (x, y) not in op:
                        zg.add((x, y))
            zones[(d, f)] = dict(h=zh, t=zt, g=zg)
    return pal, frames, labels, zones, info


# 분할이 틀린 베이스는 여기서 보정한다(마스크 시트를 눈으로 본 뒤 적는다). 키 = 'Actor3:0' 꼴.
OVERRIDES = {}


# ─────────────────────────────── 그림 ───────────────────────────────
def mask_image(key, scale=5):
    pal, frames, labels, zones, info = segment(key)
    gap = 4
    W, Hh = 3 * (FW + gap), 4 * (FH + gap)
    base = Image.new('RGBA', (W, Hh), (92, 140, 70, 255))
    mk = Image.new('RGBA', (W, Hh), (30, 30, 30, 255))
    for di, d in enumerate(DIRS):
        for f in range(3):
            ox, oy = f * (FW + gap), di * (FH + gap)
            fr = C.frame_rgba(pal, frames[(d, f)])
            base.alpha_composite(fr, (ox, oy))
            zs = zones[(d, f)]
            for y in range(FH):
                for x in range(FW):
                    z = labels[(d, f)][y][x]
                    if z != T:
                        mk.putpixel((ox + x, oy + y), REG_COLOR[z] + (255,))
                    elif (x, y) in zs['h']:
                        mk.putpixel((ox + x, oy + y), (100, 90, 40, 255))
                    elif (x, y) in zs['t']:
                        mk.putpixel((ox + x, oy + y), (50, 60, 100, 255))
                    elif (x, y) in zs['g']:
                        mk.putpixel((ox + x, oy + y), (40, 80, 40, 255))
    out = Image.new('RGB', (W * 2 + 8, Hh), (20, 20, 20))
    out.paste(base.convert('RGB'), (0, 0))
    out.paste(mk.convert('RGB'), (W + 8, 0))
    return out.resize((out.width * scale, out.height * scale), Image.NEAREST), info


def mask_grid(labels, zones, d, f):
    """모델에게 주는 마스크 글자 격자: 부위 글자 H F T B S, 구역 h(머리 장식) t(어깨) g(장비 띠, 소문자), '.' 은 건드릴 수 없는 빈 칸."""
    lab, zs = labels[(d, f)], zones[(d, f)]
    rows = []
    for y in range(FH):
        r = []
        for x in range(FW):
            c = lab[y][x]
            if c == T:
                c = 'h' if (x, y) in zs['h'] else 't' if (x, y) in zs['t'] else 'g' if (x, y) in zs['g'] else T
            r.append(c)
        rows.append(''.join(r))
    return rows


# ─────────────────────────────── 편집 적용 ───────────────────────────────
class EditError(Exception):
    pass


def hex_rgb(v):
    v = v.strip().lstrip('#')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def bob_for(frames, d, f):
    return C.bob_of(frames[(d, 1)], frames[(d, f)]) if f != 1 else 0


def apply_edits(key, edit, overrides=None):
    """edit(JSON dict)을 베이스에 적용 → (pal, new_frames, report). 규칙을 어기면 EditError(사유 목록)."""
    bpal, bframes, labels, zones, info = segment(key, overrides)
    errs = []
    pal = dict(bpal)
    for k, v in (edit.get('palette') or {}).items():
        if len(k) != 1 or k in ('.', ' '):
            errs.append(f'palette 글자 {k!r} 는 한 글자(.제외)여야 한다')
            continue
        try:
            pal[k] = hex_rgb(v)
        except Exception:
            errs.append(f'palette {k}: 색 {v!r} 읽기 실패')
    new = {k: [list(r) for r in rows] for k, rows in bframes.items()}
    changed = {k: set() for k in new}   # 연산이 건드린 칸(부위별 변경률용)
    kind = {k: {} for k in new}         # 칸 → 'recolor' | 'paint' | 'gear'

    def setpx(fk, x, y, ch, how):
        if 0 <= x < FW and 0 <= y < FH:
            new[fk][y][x] = ch
            changed[fk].add((x, y))
            kind[fk][(x, y)] = how

    def ok_letter(ch, where):
        if ch != T and ch not in pal:
            errs.append(f'{where}: 팔레트에 없는 글자 {ch!r}')
            return False
        return True

    # 1) 리컬러: 모든 프레임에서 그 부위 마스크 안의 옛 글자 → 새 글자(부위 지정 필수)
    for i, rc in enumerate(edit.get('recolor') or []):
        reg = rc.get('region')
        if reg not in EDITABLE:
            errs.append(f'recolor[{i}]: region {reg!r} 은 H T B S 중 하나여야 한다(F 얼굴·맨살은 고정)')
            continue
        for old, nw in (rc.get('map') or {}).items():
            if not ok_letter(nw, f'recolor[{i}]'):
                continue
            for fk in new:
                for y in range(FH):
                    for x in range(FW):
                        if labels[fk][y][x] == reg and bframes[fk][y][x] == old:
                            setpx(fk, x, y, nw, 'recolor')
    # 2) 행 교체: 서 있는 그림(f=1)의 부위(또는 구역) 칸만. 걷기 프레임은 출렁임만큼 내려 옮긴다.
    paints = {}
    for i, p in enumerate(edit.get('paint') or []):
        d, reg = p.get('dir'), p.get('region')
        if d not in DIRS:
            errs.append(f'paint[{i}]: dir {d!r} 은 up/right/down/left')
            continue
        if reg not in ('H', 'T'):
            errs.append(f'paint[{i}]: region {reg!r} 은 H(머리·머리 장식) 또는 T(상의·어깨)만 행 교체가 된다. B·S 는 recolor 만')
            continue
        zk = 'h' if reg == 'H' else 't'
        for ys, text in (p.get('rows') or {}).items():
            try:
                y = int(ys)
            except Exception:
                errs.append(f'paint[{i}]: 줄 번호 {ys!r}')
                continue
            if not (0 <= y < FH) or len(text) != FW:
                errs.append(f'paint[{i}] {d} 줄 {ys}: 24글자 한 줄이어야 한다({len(text)}글자)')
                continue
            for x, ch in enumerate(text):
                lab = labels[(d, 1)][y][x]
                zone = (x, y) in zones[(d, 1)][zk]
                cur = bframes[(d, 1)][y][x]
                if ch == cur and not zone:
                    continue                      # 그대로 둔 칸
                if ch == '.' and cur == T:
                    continue
                if lab == reg or zone:
                    if ok_letter(ch, f'paint[{i}]') and ch != T:
                        paints.setdefault((d, 1), {})[(x, y)] = (ch, reg)
                    elif ch == T:
                        errs.append(f'paint[{i}] {d} ({x},{y}): 몸 칸을 투명으로 지울 수 없다(실루엣 보존)')
                else:
                    errs.append(f'paint[{i}] {d} ({x},{y}): 마스크 밖 칸을 바꿨다(그 칸은 {lab if lab != T else "빈 칸"}, 허용 부위 {reg})')
    for (d, _), cells in paints.items():
        for (x, y), (ch, reg) in cells.items():
            setpx((d, 1), x, y, ch, 'paint')
        for f in (0, 2):
            bob = bob_for(bframes, d, f)
            for (x, y), (ch, reg) in cells.items():
                ty = y + bob
                if not (0 <= ty < FH):
                    continue
                if labels[(d, f)][ty][x] == reg or (x, ty) in zones[(d, f)]['h' if reg == 'H' else 't']:
                    setpx((d, f), x, ty, ch, 'paint')
    # 3) 장비: 방향마다 따로 올린다(거울 복사 없음). 놓을 수 있는 칸 = 장비 띠(g) 또는 머리 장식 구역(h)의 빈 칸
    gear_cells = {}
    for i, g in enumerate(edit.get('gear') or []):
        d = g.get('dir')
        if d not in DIRS:
            errs.append(f'gear[{i}]: dir {d!r}')
            continue
        sp = g.get('sprite') or []
        gx, gy = int(g.get('x', 0)), int(g.get('y', 0))
        name = g.get('name', f'gear{i}')
        for dy, row in enumerate(sp):
            for dx, ch in enumerate(row):
                if ch in ('.', ' '):
                    continue
                if not ok_letter(ch, f'gear[{i}]'):
                    continue
                x, y = gx + dx, gy + dy
                if not (0 <= x < FW and 0 <= y < FH):
                    errs.append(f'gear[{i}] {d}: 칸 밖 ({x},{y})')
                    continue
                zs = zones[(d, 1)]
                if bframes[(d, 1)][y][x] != T:
                    errs.append(f'gear[{i}] {d} ({x},{y}): 몸 칸 위에는 장비를 올릴 수 없다(몸 위 장식은 paint 로)')
                elif (x, y) in zs['g'] or (x, y) in zs['h']:
                    gear_cells.setdefault((d, name), {})[(x, y)] = ch
                else:
                    errs.append(f'gear[{i}] {d} ({x},{y}): 장비 띠·머리 장식 구역 밖이다')
    for (d, name), cells in gear_cells.items():
        for (x, y), ch in cells.items():
            setpx((d, 1), x, y, ch, 'gear')
            for f in (0, 2):
                bob = bob_for(bframes, d, f)
                ty = y + bob
                zs = zones[(d, f)]
                if 0 <= ty < FH and bframes[(d, f)][ty][x] == T and ((x, ty) in zs['g'] or (x, ty) in zs['h']):
                    setpx((d, f), x, ty, ch, 'gear')
    out = {k: [''.join(r) for r in rows] for k, rows in new.items()}
    report = dict(info=info, errors=errs)
    return pal, out, bframes, bpal, labels, zones, changed, kind, report


# ─────────────────────────────── 검증 ───────────────────────────────
def components(cells):
    cells = set(cells)
    seen, comps = set(), []
    for c in cells:
        if c in seen:
            continue
        st, comp = [c], []
        seen.add(c)
        while st:
            x, y = st.pop()
            comp.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in cells and n not in seen:
                    seen.add(n)
                    st.append(n)
        comps.append(comp)
    return comps


def verify(key, pal, new, bframes, bpal, labels, zones, changed, kind, overrides=None):
    """12프레임 전부 대조. → (errors, warnings, metrics)."""
    errs, warns, m = [], [], {}
    # 불변: F 칸은 색까지 같아야 한다. 몸 밖 칸은 구역이 아니면 투명 그대로.
    for fk in new:
        d, f = fk
        for y in range(FH):
            for x in range(FW):
                b, n = bframes[fk][y][x], new[fk][y][x]
                bc = bpal.get(b) if b != T else None
                nc = pal.get(n) if n != T else None
                lab = labels[fk][y][x]
                if lab == 'F' and bc != nc:
                    errs.append(f'{d} {f} ({x},{y}): 고정 부위(얼굴·맨살·눈) 픽셀이 바뀌었다')
                elif lab == T:
                    zs = zones[fk]
                    if nc is not None and not ((x, y) in zs['h'] or (x, y) in zs['t'] or (x, y) in zs['g']):
                        errs.append(f'{d} {f} ({x},{y}): 구역 밖 빈 칸에 픽셀이 생겼다')
                elif lab in EDITABLE and nc is None:
                    errs.append(f'{d} {f} ({x},{y}): 몸 칸이 투명이 되었다')
    if len(errs) > 24:
        errs = errs[:24] + [f'… 외 {len(errs) - 24}건']
    # 튀어나온 한 칸: 새로 생긴 칸의 덩어리가 3칸 미만이면 거절
    for fk in new:
        added = {(x, y) for y in range(FH) for x in range(FW) if bframes[fk][y][x] == T and new[fk][y][x] != T}
        for comp in components(added):
            if len(comp) < 3:
                errs.append(f'{fk[0]} {fk[1]}: 새 픽셀 덩어리가 {len(comp)}칸뿐이다 {sorted(comp)} — 튀어나온 한 칸(삐죽 픽셀)은 허용하지 않는다')
        if len(added) > 110:
            errs.append(f'{fk[0]} {fk[1]}: 실루엣 밖에 새 픽셀 {len(added)}칸(최대 110)')
        m[f'added_{fk[0]}{fk[1]}'] = len(added)
    # 부위별 변경률
    tot, chg = {}, {}
    for fk in new:
        for y in range(FH):
            for x in range(FW):
                lab = labels[fk][y][x]
                if lab in EDITABLE:
                    tot[lab] = tot.get(lab, 0) + 1
                    if new[fk][y][x] != bframes[fk][y][x] or (pal.get(new[fk][y][x]) != bpal.get(bframes[fk][y][x])):
                        chg[lab] = chg.get(lab, 0) + 1
    ratio = {r: chg.get(r, 0) / tot[r] for r in tot}
    m['changed_ratio'] = {r: round(v, 3) for r, v in ratio.items()}
    pcnt = {}
    for fk in new:
        for c, how in kind[fk].items():
            if how == 'paint':
                lab = labels[fk][c[1]][c[0]]
                pcnt[lab] = pcnt.get(lab, 0) + 1
    for r in ('H', 'T'):
        if tot.get(r) and pcnt.get(r, 0) / tot[r] > 0.55:
            errs.append(f'{r} 부위의 행 교체(모양 바꾸기)가 {pcnt.get(r, 0) / tot[r]:.0%}다(최대 55%) — 베이스의 모양을 더 남겨라')
    for r in ('B', 'S'):
        if kind and any(h == 'paint' for k in kind for h in kind[k].values()) and pcnt.get(r):
            errs.append(f'{r} 부위에는 행 교체를 쓸 수 없다')
    # 눈에 띄는 변화: 머리·상의 중 하나는 바뀌어야 한다
    if ratio.get('H', 0) + ratio.get('T', 0) < 0.25:
        errs.append(f'머리·상의 변경률이 합 {ratio.get("H", 0) + ratio.get("T", 0):.0%}뿐이다(최소 25%) — 새 캐릭터로 보이게 의복·머리를 더 바꿔라')
    # 방향 간 색 일관: 같은 부위의 쓰인 색이 방향마다 겹쳐야 같은 사람
    for reg in ('H', 'T'):
        sets = {}
        for d in DIRS:
            s = {pal[new[(d, f)][y][x]] for f in range(3) for y in range(FH) for x in range(FW)
                 if labels[(d, f)][y][x] == reg and new[(d, f)][y][x] != T}
            sets[d] = s
        for a_ in ('up', 'right', 'left'):
            if sets['down'] and sets[a_]:
                share = len(sets['down'] & sets[a_]) / max(1, min(len(sets['down']), len(sets[a_])))
                if share < 0.5:
                    errs.append(f'{reg} 부위의 아래·{a_} 방향 공통 색이 {share:.0%}뿐이다 — 방향마다 다른 사람(리컬러는 모든 방향에 적용된다)')
    # 디더·외톨이: 뼈대 기준
    import argon_chip as AC
    bc = sum(AC.cross_count(bframes[k]) for k in new)
    nc = sum(AC.cross_count(new[k]) for k in new)
    bl = sum(AC.lone_pixels(bframes[k]) for k in new)
    nl = sum(AC.lone_pixels(new[k]) for k in new)
    m.update(cross=nc, cross_base=bc, lone=nl, lone_base=bl)
    if nc > bc * 1.5 + 12:
        errs.append(f'디더/체스판 잡티가 {nc}곳이다(뼈대 {bc}곳, 허용 {int(bc * 1.5 + 12)})')
    if nl > bl * 1.5 + 16:
        errs.append(f'외톨이 점이 {nl}개다(뼈대 {bl}개, 허용 {int(bl * 1.5 + 16)})')
    # 팔레트 크기
    used = {c for rows in new.values() for r in rows for c in r if c != T}
    if len(used) > 48:
        errs.append(f'쓰인 색 {len(used)}개 > 48')
    # 기존 결손 검사(chr.gate, 소지품·변경률 제한은 풀고 결손·걷기·윤곽만)
    npal = dict(pal)
    npal['.'] = None
    g = C.gate(npal, new, (bpal, bframes), strength='ctff6')
    for t in g.get('fails', []):
        if '튀어나온' in t or '뼈대 실루엣' in t or '새 캐릭터' in t or '모양을 다시' in t or '실루엣' in t and '범위' not in t:
            continue   # 소지품 한도는 구역·덩어리 검사가 맡는다
        errs.append(t)
    warns += g.get('warns', [])
    # 장비 손 일관: 같은 이름의 장비가 아래·위에서 몸 중심의 반대편인지는 눈 검수 몫(경고)
    return errs, warns, m


def render_preview(pal, new, path, scale=6):
    npal = dict(pal)
    npal['.'] = None
    im = C.sheet_big(npal, new, scale=scale)
    im.save(path)


def load_edit(workdir):
    p = Path(workdir) / 'edit.json'
    try:
        return json.loads(p.read_text(encoding='utf-8')), None
    except Exception as e:
        return None, f'edit.json 읽기 실패: {e}'


def run_apply(workdir, key=None, write=True):
    wd = Path(workdir)
    meta = json.loads((wd / 'base.json').read_text())
    key = key or meta['base']
    edit, err = load_edit(wd)
    if err:
        return None, [err], [], {}
    try:
        pal, new, bframes, bpal, labels, zones, changed, kind, rep = apply_edits(key, edit)
    except Exception as e:  # noqa: BLE001
        return None, [f'편집 적용 실패: {e!r}'], [], {}
    errs = list(rep['errors'])
    errs2, warns, m = verify(key, pal, new, bframes, bpal, labels, zones, changed, kind)
    errs += errs2
    if write:
        render_preview(pal, new, wd / 'preview.png')
    return (dict(pal=pal, frames=new) if not errs else None), errs, warns, m


def main():
    import argparse
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    mk = sub.add_parser('masks')
    mk.add_argument('bases', nargs='+')
    mk.add_argument('--out', required=True)
    ap_ = sub.add_parser('apply')
    ap_.add_argument('workdir')
    a = ap.parse_args()
    if a.cmd == 'masks':
        import base64
        import io
        cards = []
        for b in a.bases:
            im, info = mask_image(b, 4)
            bio = io.BytesIO()
            im.save(bio, 'PNG')
            cards.append(f'<div class="c"><h3>{b}</h3><pre>{info}</pre><img src="data:image/png;base64,{base64.b64encode(bio.getvalue()).decode()}"></div>')
        Path(a.out).expanduser().write_text('<!doctype html><meta charset="utf-8"><style>body{background:#161a1d;color:#ddd;font:14px sans-serif;margin:16px}img{image-rendering:pixelated}pre{color:#8fa0aa;font-size:11px;white-space:pre-wrap}</style>'
                                            '<p>왼쪽=베이스, 오른쪽=부위 마스크. 주황=H 머리 · 하늘=F 고정 · 파랑=T 상의 · 보라=B 하의 · 갈색=S 신발 · 어두운 노랑/남/초록=구역(머리 장식·어깨·장비 띠)</p>' + ''.join(cards), encoding='utf-8')
        print(a.out)
    else:
        res, errs, warns, m = run_apply(a.workdir)
        print(json.dumps(dict(ok=res is not None, errors=errs, warnings=warns, metrics=m), ensure_ascii=False, indent=1))
        print('preview.png 를 열어 눈으로 확인하라.' if res else '위 오류를 고쳐 edit.json 을 다시 쓴 뒤 다시 실행하라.')


if __name__ == '__main__':
    main()
