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
    """베이스 → (pal, frames, labels{(d,f): [[region char]]}, zones{(d,f): {'h','t','g'} → set}, info).
    분할은 베이스마다 사람이 눈으로 정한 SPECS(얼굴 상자·상의 시작·허리·신발 줄·맨살 글자)에서 나온다."""
    nk = H.norm_base(key)
    pal, frames = H.base_of(nk)
    sp = dict(SPECS[nk])
    sp.update(overrides or {})
    boxes = sp['face']                      # {dir: (x0,y0,x1,y1) | None}
    t_start, waist, shoe_top = sp['t_start'], sp['waist'], sp['shoe_top']
    skin = set(sp.get('skin', ''))
    foot = bbox(frames[('down', 1)])[3]
    info = dict(spec=nk, t_start=t_start, waist=waist, shoe_top=shoe_top, skin=''.join(sorted(skin)), foot=foot, robot=bool(sp.get('robot')))
    labels, zones = {}, {}
    for d in DIRS:
        for f in range(3):
            rows = frames[(d, f)]
            off = C.bob_of(frames[(d, 1)], rows) if f != 1 else 0
            x0, y0, x1, y1 = bbox(rows)
            bx = boxes.get(d)
            lab = [[T] * FW for _ in range(FH)]
            for y in range(FH):
                for x in range(FW):
                    c = rows[y][x]
                    if c == T:
                        continue
                    if bx and bx[0] <= x <= bx[2] and bx[1] + off <= y <= bx[3] + off:
                        lab[y][x] = 'F'
                    elif y < t_start + off:
                        lab[y][x] = 'H'
                    elif y < waist:
                        lab[y][x] = 'F' if c in skin else 'T'
                    elif y < shoe_top:
                        lab[y][x] = 'F' if c in skin else 'B'
                    else:
                        lab[y][x] = 'F' if c in skin else 'S'
            labels[(d, f)] = lab
            op = {(x, y) for y in range(FH) for x in range(FW) if rows[y][x] != T}
            zh, zt, zg = set(), set(), set()
            face_y0 = (bx[1] if bx else t_start - 4) + off
            hx = [x for y in range(y0, t_start + off) for x in range(FW) if rows[y][x] != T]
            hx0, hx1 = (min(hx), max(hx)) if hx else (x0, x1)
            for y in range(max(1, y0 - 3), face_y0):
                for x in range(max(1, hx0 - 1), min(FW - 1, hx1 + 2)):
                    if (x, y) not in op:
                        zh.add((x, y))
            for y in range(t_start + off, waist):
                for x in range(1, FW - 1):
                    if (x, y) not in op and any((x + dx, y) in op and lab[y][x + dx] == 'T' for dx in (-2, -1, 1, 2)):
                        zt.add((x, y))
            for y in range(max(1, y0 - 3), foot + 1):
                for x in list(range(max(1, x0 - 4), x0)) + list(range(x1 + 1, min(FW - 1, x1 + 5))):
                    if (x, y) not in op:
                        zg.add((x, y))
            zones[(d, f)] = dict(h=zh, t=zt, g=zg)
    return pal, frames, labels, zones, info


SPECS = {
    # 얼굴 상자 = 눈~턱을 가로 전부 담은 직사각형(그 안 픽셀은 한 칸도 못 바꾼다). 방향마다 따로(오른쪽·왼쪽은 칩이 거울이 아님).
    'People1:0': dict(face={'down': (6, 16, 17, 19), 'right': (9, 16, 17, 19), 'left': (6, 16, 14, 19), 'up': None},
                      t_start=20, waist=27, shoe_top=29, skin='yzwv',
                      hands={'down': {'vl': [(6, 25), (7, 25)], 'vr': [(16, 25), (17, 25)]},
                             'up': {'vl': [(6, 25), (7, 25)], 'vr': [(16, 25), (17, 25)]},
                             'right': {'near': [(9, 25), (10, 25)]}, 'left': {'near': [(13, 25), (14, 25)]}}),
    'Actor3:0': dict(face={'down': (8, 14, 15, 17), 'right': (12, 14, 16, 17), 'left': (7, 14, 11, 17), 'up': None},
                     t_start=18, waist=25, shoe_top=29, skin='',
                     hands={'down': {'vl': [(4, 22), (5, 22), (4, 23), (5, 23), (4, 24), (5, 24)], 'vr': [(18, 22), (19, 22), (18, 23), (19, 23), (18, 24), (19, 24)]},
                            'up': {'vl': [(4, 22), (5, 22), (4, 23), (5, 23), (4, 24), (5, 24)], 'vr': [(18, 22), (19, 22), (18, 23), (19, 23), (18, 24), (19, 24)]},
                            'right': {'near': [(13, 23), (14, 23), (13, 24), (14, 24)]}, 'left': {'near': [(8, 23), (9, 23), (8, 24), (9, 24)]}}),
    # 로봇은 사람 얼굴 규칙의 예외: 눈 상자만 고정하고 나머지 머리(살색 포함)는 금속으로 칠할 수 있다(원형 설명 「눈은 한 줄 유리창).
    'People4:4': dict(face={'down': (8, 14, 15, 16), 'right': (11, 14, 17, 16), 'left': (6, 14, 12, 16), 'up': None},
                      t_start=18, waist=28, shoe_top=30, skin='', robot=True,
                      hands={'down': {'vl': [(5, 22), (6, 22), (5, 23), (6, 23), (5, 24), (6, 24)], 'vr': [(17, 22), (18, 22), (17, 23), (18, 23), (17, 24), (18, 24)]},
                             'up': {'vl': [(5, 22), (6, 22), (5, 23), (6, 23), (5, 24), (6, 24)], 'vr': [(17, 22), (18, 22), (17, 23), (18, 23), (17, 24), (18, 24)]},
                             'right': {'near': [(8, 22), (9, 22), (8, 23), (9, 23), (8, 24), (9, 24)]}, 'left': {'near': [(14, 22), (15, 22), (14, 23), (15, 23), (14, 24), (15, 24)]}}),
}


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


def anchor_image(key, scale=6):
    """서 있는 그림 4방향에 앵커 칸을 표시: 초록=held R, 하늘=held L, 노랑=hip R, 분홍=back (칸 테두리 한 칸)."""
    nk = H.norm_base(key)
    pal, bframes = H.base_of(nk)
    spec = SPECS[nk]
    im = Image.new('RGBA', (4 * 28, 34), (92, 140, 70, 255))
    cols = {('held', 'R'): (60, 255, 90, 255), ('held', 'L'): (60, 220, 255, 255), ('hip', 'R'): (255, 235, 60, 255), ('back', 'R'): (255, 80, 200, 255)}
    for i, d in enumerate(('down', 'up', 'right', 'left')):
        im.alpha_composite(C.frame_rgba(pal, bframes[(d, 1)]), (2 + i * 28, 1))
        for (kind, side), col in cols.items():
            (x, y), mode, cells = anchor_for(nk, bframes, spec, kind, side, d, 1)
            if kind == 'held':
                for cx, cy in cells:
                    im.putpixel((2 + i * 28 + cx, 1 + cy), tuple(v // 2 for v in col[:3]) + (255,)) if False else None
            im.putpixel((2 + i * 28 + x, 1 + y), col)
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert('RGB')


def mask_grid(labels, zones, d, f):
    """모델에게 주는 마스크 글자 격자: 부위 글자 H F T B S, 구역 h(머리 장식) t(어깨) g(장비 띠, 소문자), '.' 은 건드릴 수 없는 빈 칸."""
    lab, zs = labels[(d, f)], zones[(d, f)]
    rows = []
    for y in range(FH):
        r = []
        for x in range(FW):
            c = lab[y][x]
            if c == T:
                c = 'h' if (x, y) in zs['h'] else 't' if (x, y) in zs['t'] else T
            r.append(c)
        rows.append(''.join(r))
    return rows


# ─────────────────────────────── 손·허리·등 앵커 ───────────────────────────────
KINDS = ('held', 'hip', 'back')


def side_slot(d, side):
    """캐릭터의 오른손(R)/왼손(L) → 그 방향에서 어느 손인가: 'vl'/'vr'(위·아래, 보는 사람 기준) 또는 'near'/'far'(옆)."""
    if d == 'down':
        return 'vl' if side == 'R' else 'vr'
    if d == 'up':
        return 'vr' if side == 'R' else 'vl'
    if d == 'right':
        return 'near' if side == 'R' else 'far'
    return 'near' if side == 'L' else 'far'


def row_extent(rows, y):
    xs = [x for x, c in enumerate(rows[y]) if c != T] if 0 <= y < FH else []
    return (min(xs), max(xs)) if xs else None


def hand_cells(key, bframes, d, f, slot, spec):
    """베이스의 손 칸(서 있는 그림에서 사람이 정한 칸)을 걷기 프레임마다 픽셀 대응으로 따라간다. → set((x,y))"""
    std = set(map(tuple, spec['hands'][d][slot])) if slot in spec['hands'][d] else set()
    if f == 1 or not std:
        return std
    corr, bob = C.correspondence(bframes[(d, 1)], bframes[(d, f)])
    got = {p for p, q in corr.items() if q in std}
    if not got:
        got = {(x, y + bob) for x, y in std}
    return got


def anchor_for(key, bframes, spec, kind, side, d, f):
    """→ (grip 칸 (x,y), 모드 'front'|'behind', 앵커 칸 집합). front = 몸·옷 위에 그린다(손·얼굴은 위에 남는다), behind = 몸 뒤(몸 밖 빈 칸에만)."""
    rows = bframes[(d, f)]
    off = C.bob_of(bframes[(d, 1)], rows) if f != 1 else 0
    slot = side_slot(d, side)
    if kind == 'held':
        std_slot = slot if slot in ('vl', 'vr') else 'near'
        # 먼 손(옆모습에서 보이지 않는 손)은 가까운 손의 줄에서 몸 뒤쪽 가장자리를 앵커로 쓴다
        near = hand_cells(key, bframes, d, f, std_slot, spec) if slot != 'far' else hand_cells(key, bframes, d, f, 'near', spec)
        if slot == 'far':
            y = sorted(c[1] for c in near)[len(near) // 2]
            ext = row_extent(rows, y)
            x = ext[0] if d == 'right' else ext[1]       # 오른쪽을 보면 몸 뒤 = 왼쪽 끝
            return (x, y), 'behind', {(x, y)}
        xs = [c[0] for c in near]
        if slot == 'vl' or (slot == 'near' and d == 'left'):
            gx = min(xs)
        else:
            gx = max(xs)
        ys = sorted(c[1] for c in near if c[0] == gx)
        return (gx, ys[len(ys) // 2]), 'front', near
    if kind == 'hip':
        y = spec.get('hip_row', spec['waist'] - 1) + off
        ext = row_extent(rows, y) or row_extent(rows, y - 1)
        if slot == 'near' and d in ('right', 'left'):
            cx = (ext[0] + ext[1]) // 2
            return (cx, y), 'front', {(cx, y)}
        if slot == 'far':
            x = ext[0] if d == 'right' else ext[1]
            return (x, y), 'behind', {(x, y)}
        x = ext[0] if slot == 'vl' else ext[1]
        return (x, y), 'front', {(x, y)}
    # back: 어깨 뒤 중앙(위에서는 등 위에 그려지고, 다른 방향에서는 몸 뒤로 위쪽에 삐져나온다)
    y = spec['t_start'] + 1 + off
    ext = row_extent(rows, y)
    if d in ('down', 'up'):
        x = (ext[0] + ext[1]) // 2
    else:
        x = ext[0] if d == 'right' else ext[1]
    return (x, y), ('front' if d == 'up' else 'behind'), {(x, y)}


def anchor_table(key):
    nk = H.norm_base(key)
    pal, bframes = H.base_of(nk)
    spec = SPECS[nk]
    lines = ['종류별 앵커(서 있는 그림 기준 grip 칸 좌표 x,y 와 모드). 스프라이트의 grip 칸이 이 칸에 겹친다. 걷기 프레임은 앵커가 손·몸과 함께 움직인다.']
    for kind, sides in (('held', 'RL'), ('hip', 'RL'), ('back', 'R')):
        for side in sides:
            row = []
            for d in ('down', 'up', 'right', 'left'):
                (x, y), mode, cells = anchor_for(nk, bframes, spec, kind, side, d, 1)
                row.append(f'{d}=({x},{y}) {mode}')
            lines.append(f'  kind={kind}{"" if kind == "back" else " side=" + side}: ' + ' · '.join(row))
    return '\n'.join(lines), spec, bframes


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
        if k in bpal:
            errs.append(f'palette {k!r}: 베이스에 이미 있는 글자의 색을 바꿀 수 없다(바꾸려면 recolor 로 새 글자에 옮겨라). 쓰이지 않은 새 글자를 써라')
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
        b1 = bframes[(d, 1)]
        for f in (0, 2):
            bf = bframes[(d, f)]
            corr, bob = C.correspondence(b1, bf)
            for (x, y), q in corr.items():
                if q is not None and q in cells and labels[(d, f)][y][x] in EDITABLE and labels[(d, f)][y][x] == cells[q][1]:
                    setpx((d, f), x, y, cells[q][0], 'paint')
            for (x, y), (ch, reg) in cells.items():     # 몸 밖 구역에 새로 그린 칸은 출렁임만큼 내려 옮긴다
                if b1[y][x] == T:
                    ty = y + bob
                    zk = 'h' if reg == 'H' else 't'
                    if 0 <= ty < FH and bf[ty][x] == T and (x, ty) in zones[(d, f)][zk]:
                        setpx((d, f), x, ty, ch, 'paint')
    # 3) 장비: 종류(held 손에 든 것 · hip 허리 · back 등)별 앵커에 스프라이트의 grip 칸을 겹쳐 방향·프레임마다 따라가게 한다
    spec = SPECS[H.norm_base(key)]
    gear_info = {}
    for i, g in enumerate(edit.get('gear') or []):
        gkind, side, name = g.get('kind'), g.get('side', 'R'), g.get('name', f'gear{i}')
        if gkind not in KINDS or side not in ('R', 'L'):
            errs.append(f'gear[{i}]: kind {gkind!r} 은 held|hip|back, side 는 R|L')
            continue
        for d in DIRS:
            sp = (g.get('sprites') or {}).get(d)
            if not sp:
                errs.append(f'gear[{i}] {name}: {d} 방향 스프라이트가 없다(네 방향 모두 필요)')
                continue
            rows_ = sp.get('rows') or []
            gx, gy = (sp.get('grip') or [None, None])[:2]
            if gx is None or not (0 <= gy < len(rows_)) or not (0 <= gx < max(len(r) for r in rows_)) or rows_[gy][gx] in ('.', ' '):
                errs.append(f'gear[{i}] {name} {d}: grip 칸 {sp.get("grip")} 이 스프라이트 안의 불투명 칸이어야 한다')
                continue
            npx = sum(1 for r in rows_ for c in r if c not in ('.', ' '))
            if npx > 120 or len(rows_) > 26 or max(len(r) for r in rows_) > 12:
                errs.append(f'gear[{i}] {name} {d}: 스프라이트가 너무 크다(120칸·12×26 이하, 지금 {npx}칸)')
                continue
            for f in range(3):
                (ax, ay), mode, acells = anchor_for(key, bframes, spec, gkind, side, d, f)
                vis = set()
                for dy, row in enumerate(rows_):
                    for dx, ch in enumerate(row):
                        if ch in ('.', ' '):
                            continue
                        if not ok_letter(ch, f'gear[{i}]'):
                            continue
                        x, y = ax + dx - gx, ay + dy - gy
                        if not (1 <= x < FW - 1 and 1 <= y < FH - 1):
                            continue
                        if (x, y) in acells and gkind == 'held' and mode == 'front':
                            continue                       # 손은 무기 위에 그려진다(손 칸은 베이스 그대로)
                        lab = labels[(d, f)][y][x]
                        if lab == 'F':
                            continue                       # 얼굴·맨살은 어떤 장비도 덮지 못한다
                        if bframes[(d, f)][y][x] != T and mode == 'behind':
                            continue                       # 몸 뒤: 몸 밖 빈 칸에만 보인다
                        setpx((d, f), x, y, ch, 'gear')
                        vis.add((x, y))
                gear_info.setdefault(name, {})[(d, f)] = dict(anchor=(ax, ay), mode=mode, cells=acells, vis=vis, kind=gkind)
    out = {k: [''.join(r) for r in rows] for k, rows in new.items()}
    report = dict(info=info, errors=errs, gear=gear_info)
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


def verify(key, pal, new, bframes, bpal, labels, zones, changed, kind, overrides=None, gear_report=None):
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
                    if nc is not None and kind[fk].get((x, y)) != 'gear' and not ((x, y) in zs['h'] or (x, y) in zs['t'] or (x, y) in zs['g']):
                        errs.append(f'{d} {f} ({x},{y}): 구역 밖 빈 칸에 픽셀이 생겼다')
                elif lab in EDITABLE and nc is None:
                    errs.append(f'{d} {f} ({x},{y}): 몸 칸이 투명이 되었다')
    if len(errs) > 24:
        errs = errs[:24] + [f'… 외 {len(errs) - 24}건']
    # 튀어나온 한 칸: 새로 생긴 칸의 덩어리가 3칸 미만이면 거절
    for fk in new:
        added = {(x, y) for y in range(FH) for x in range(FW) if bframes[fk][y][x] == T and new[fk][y][x] != T}
        glued = added | {c for c, how in kind[fk].items() if how == 'gear'}   # 장비가 몸 위에 겹친 칸까지 이어 붙여 덩어리를 센다
        for comp in components(glued):
            if len(set(comp) & added) and len(comp) < 3:
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
    # 장비: 손·허리·등 앵커에 붙어 있는가(닿거나 겹침), 프레임마다 앵커 대비 위치가 같은가, 보이는 픽셀이 있는가
    for name, per in (gear_report or {}).items():
        for (d, f), gi in per.items():
            ax, ay = gi['anchor']
            vis = gi['vis']
            if gi['mode'] == 'behind' and d in ('right', 'left'):
                continue                       # 옆모습의 먼 손·먼 허리: 몸에 가려지는 쪽이라 보임·닿음을 요구하지 않는다
            if len(vis) < 3:
                errs.append(f'장비 {name!r} {d} {f}: 보이는 픽셀이 {len(vis)}칸뿐이다 — 이 방향·모드({gi["mode"]})에서 몸에 가려 안 보인다(grip {gi["anchor"]})')
                continue
            near = any(max(abs(x - cx), abs(y - cy)) <= 1 for (x, y) in vis for (cx, cy) in gi['cells'])
            if not near:
                errs.append(f'장비 {name!r} {d} {f}: 보이는 픽셀이 앵커 칸 {sorted(gi["cells"])[:2]} 에 닿거나 겹치지 않는다 — 손에 쥐어지지 않고 따로 논다')
        # 프레임 간 앵커 상대 위치 편차(몸 윗줄 기준)
        for d in DIRS:
            ys = []
            for f in range(3):
                if (d, f) in per:
                    top = min(y for y, r in enumerate(bframes[(d, f)]) if any(c != T for c in r))
                    ys.append(per[(d, f)]['anchor'][1] - top)
            if ys and max(ys) - min(ys) > 2:
                errs.append(f'장비 {name!r} {d}: 걷기 프레임마다 앵커-몸 위치가 {ys} 로 흔들린다(손 추적 실패, 편차 2줄 이하)')
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
    errs2, warns, m = verify(key, pal, new, bframes, bpal, labels, zones, changed, kind, gear_report=rep.get('gear'))
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
