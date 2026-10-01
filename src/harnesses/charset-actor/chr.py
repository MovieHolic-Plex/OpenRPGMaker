"""캐릭터 칩 격자(.chr.txt) 읽기·쓰기, PNG 굽기, 기계 검수, 검수용 그림·GIF.

형식 — 사람·모델이 글자로 직접 찍는다(생성 이미지 없음):

    # 아무 주석
    palette
    . transparent
    k #18101c
    s #f0c8a0   피부 밝은 쪽     ← 색 뒤 설명은 자유
    frame up 0
    ........................   ← 24글자 × 32줄, 한 글자 = 한 픽셀
    ...
    frame up 1
    ...

프레임은 12장: 방향 up·right·down·left × 걸음 0·1·2. 1 이 서 있는 자세, 0·2 가 발을 내디딘 자세다
(RPG Maker 2000 CharSet, 걸음 순서 0-1-2-1). 한 명 = 72×128.
"""
from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw

FW, FH = 24, 32
DIRS = ('up', 'right', 'down', 'left')
DIR_KO = {'up': '위', 'right': '오른쪽', 'down': '아래', 'left': '왼쪽'}
KEY = (0, 147, 146)          # Actor1 배경 키 색. 칩 안에서는 쓰지 못한다.
TRANSPARENT = '.'


class GridError(ValueError):
    pass


# ─────────────────────────────── 읽기·쓰기 ───────────────────────────────
def parse(text: str):
    """→ (palette{ch: (r,g,b) | None}, notes{ch: str}, frames{(dir,f): [32 strings]})"""
    pal, notes, frames = {}, {}, {}
    mode, cur = None, None
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip('\n')
        s = line.strip()
        if mode != 'frame' and (not s or s.startswith('#')):
            continue
        if s == 'palette':
            mode = 'pal'
            continue
        m = re.fullmatch(r'frame\s+(up|right|down|left)\s+([012])', s)
        if m:
            mode, cur = 'frame', (m.group(1), int(m.group(2)))
            if cur in frames:
                raise GridError(f'{n}줄: frame {cur[0]} {cur[1]} 이 두 번 나온다')
            frames[cur] = []
            continue
        if mode == 'pal':
            m = re.fullmatch(r'(\S)\s+(transparent|#[0-9a-fA-F]{6})(?:\s+(.*))?', s)
            if not m:
                raise GridError(f'{n}줄: 색 줄은 "<글자> #rrggbb [설명]" 이어야 한다: {s!r}')
            ch, v, note = m.group(1), m.group(2), m.group(3) or ''
            if ch in pal:
                raise GridError(f'{n}줄: 색 글자 {ch!r} 가 두 번 나온다')
            if v == 'transparent':
                if ch != TRANSPARENT:
                    raise GridError(f'{n}줄: 투명은 "." 하나뿐이다')
                pal[ch] = None
            else:
                if ch == TRANSPARENT:
                    raise GridError(f'{n}줄: "." 는 투명 전용이다')
                pal[ch] = tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))
            notes[ch] = note
        elif mode == 'frame':
            if not s:
                continue
            if s.startswith('#'):
                continue
            frames[cur].append(s)
        else:
            raise GridError(f'{n}줄: palette / frame 머리 앞에 내용이 있다: {s!r}')
    pal.setdefault(TRANSPARENT, None)
    return pal, notes, frames


def dump(pal, notes, frames, header='') -> str:
    out = []
    if header:
        out += ['# ' + h for h in header.splitlines()]
    out.append('palette')
    for ch, rgb in pal.items():
        v = 'transparent' if rgb is None else '#%02x%02x%02x' % rgb
        out.append(f'{ch} {v}' + (f'   {notes.get(ch)}' if notes.get(ch) else ''))
    for d in DIRS:
        for f in range(3):
            out.append(f'frame {d} {f}')
            out += frames[(d, f)]
    return '\n'.join(out) + '\n'


def load(path):
    return parse(Path(path).read_text(encoding='utf-8'))


def structural_errors(pal, frames):
    errs = []
    for d in DIRS:
        for f in range(3):
            rows = frames.get((d, f))
            if rows is None:
                errs.append(f'frame {d} {f} 없음')
                continue
            if len(rows) != FH:
                errs.append(f'frame {d} {f}: {len(rows)}줄 (32줄이어야 함)')
            for i, r in enumerate(rows):
                if len(r) != FW:
                    errs.append(f'frame {d} {f} {i}번째 줄: {len(r)}글자 (24글자여야 함)')
                bad = sorted({c for c in r if c not in pal})
                if bad:
                    errs.append(f'frame {d} {f} {i}번째 줄: 팔레트에 없는 글자 {"".join(bad)!r}')
    for ch, rgb in pal.items():
        if rgb == KEY:
            errs.append(f'색 {ch!r} 가 배경 키 색 #009392 와 같다')
    return errs


# ─────────────────────────────── 그림 ───────────────────────────────
def frame_rgba(pal, rows) -> Image.Image:
    im = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    p = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            rgb = pal.get(ch)
            if rgb is not None:
                p[x, y] = rgb + (255,)
    return im


def sheet_rgba(pal, frames) -> Image.Image:
    im = Image.new('RGBA', (FW * 3, FH * 4), (0, 0, 0, 0))
    for di, d in enumerate(DIRS):
        for f in range(3):
            im.paste(frame_rgba(pal, frames[(d, f)]), (f * FW, di * FH))
    return im


def sheet_keyed(pal, frames) -> Image.Image:
    """RM2000 CharSet 블록(72×128, 배경 키 색)."""
    bg = Image.new('RGBA', (FW * 3, FH * 4), KEY + (255,))
    bg.alpha_composite(sheet_rgba(pal, frames))
    return bg.convert('RGB')


def from_actor(png, index):
    """CharSet PNG 의 index 번째 캐릭터(0..7) → (pal, notes, frames). 색 글자는 밝기 순."""
    a = Image.open(png).convert('RGB')
    key = a.getpixel((0, 0))
    bx, by = (index % 4) * 72, (index // 4) * 128
    blk = a.crop((bx, by, bx + 72, by + 128))
    cols = sorted({c for c in blk.getdata() if c != key}, key=lambda c: (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]))
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    if len(cols) > len(letters):
        raise GridError('색이 너무 많다')
    ch = {c: letters[i] for i, c in enumerate(cols)}
    pal = {TRANSPARENT: None}
    pal.update({v: k for k, v in ch.items()})
    frames = {}
    for di, d in enumerate(DIRS):
        for f in range(3):
            fr = blk.crop((f * FW, di * FH, f * FW + FW, di * FH + FH))
            frames[(d, f)] = [''.join(TRANSPARENT if fr.getpixel((x, y)) == key else ch[fr.getpixel((x, y))]
                                      for x in range(FW)) for y in range(FH)]
    return pal, {}, frames


# ─────────────────────────────── 기계 검수 ───────────────────────────────
# 기준은 Actor1 8명에서 쟀다(`harness.py calibrate` 가 8명 전원 통과를 확인한다).
#   머리 높이 출렁임 = 방향마다 정확히 1px, 윤곽 픽셀 중 어두운 것 83~96 %, 색 22~32 개, 실루엣 217~390 px,
#   걸음 0↔2 프레임 전체에서 다른 픽셀 79~279 (팔·다리·옷자락이 다 움직인다). 2026-10-02 첫 실행에서 Sonnet 이
#   몸을 1px 내리고 발끝만 바꾼 걸음(16~26px)을 냈는데 옛 검수를 통과했다 — 그래서 walk_motion 을 넣었다.
LIMITS = dict(max_colors=32, top_jitter_max=1, area_min=190, area_max=420, bbox_w_max=23, bbox_h_max=30,
              dark_edge_min=0.75, dark_luma=70, leg_diff_min=6, walk_motion_min=70, walk_motion_vs_base=0.6,
              changed_min=0.20)


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def gate(pal, frames, base=None):
    """→ dict(ok, fails[], warns[], metrics{}). base 가 있으면 「뼈대만 남기고 새 캐릭터인가」도 잰다."""
    L = LIMITS
    fails, warns, m = [], [], {}
    se = structural_errors(pal, frames)
    if se:
        return dict(ok=False, fails=se[:20], warns=[], metrics={})
    used = {}
    for k, rows in frames.items():
        for r in rows:
            for c in r:
                if c != TRANSPARENT:
                    used.setdefault(c, set()).add(k)
    m['colors'] = len(used)
    if len(used) > L['max_colors']:
        fails.append(f'색 {len(used)}개 > {L["max_colors"]} (Actor1 은 22~32)')
    once = sorted(c for c, ks in used.items() if len(ks) == 1)
    if once:
        warns.append(f'한 프레임에만 나오는 색 {"".join(once)} — 걸을 때 깜빡일 수 있다')
    unused = sorted(c for c in pal if c != TRANSPARENT and c not in used)
    if unused:
        warns.append(f'팔레트에 있지만 안 쓴 색 {"".join(unused)}')

    def ops(rows):
        return [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != TRANSPARENT]

    areas, darks, bottoms = {}, {}, {}
    for d in DIRS:
        tops = []
        for f in range(3):
            rows = frames[(d, f)]
            op = ops(rows)
            k = f'{d}{f}'
            if not op:
                fails.append(f'{DIR_KO[d]} {f}: 빈 프레임')
                continue
            xs, ys = [p[0] for p in op], [p[1] for p in op]
            tops.append(min(ys))
            bottoms[k] = max(ys)
            areas[k] = len(op)
            w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            if not (L['area_min'] <= len(op) <= L['area_max']):
                fails.append(f'{DIR_KO[d]} {f}: 실루엣 {len(op)}px — Actor1 범위({L["area_min"]}~{L["area_max"]}) 밖')
            if w > L['bbox_w_max'] or h > L['bbox_h_max']:
                fails.append(f'{DIR_KO[d]} {f}: 크기 {w}×{h} — 칸 가장자리까지 찼다(≤{L["bbox_w_max"]}×{L["bbox_h_max"]})')
            S = set(op)
            edge = [(x, y) for x, y in op if any((x + dx, y + dy) not in S for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
            dk = sum(_lum(pal[rows[y][x]]) < L['dark_luma'] for x, y in edge) / len(edge)
            darks[k] = round(dk, 3)
            if dk < L['dark_edge_min']:
                fails.append(f'{DIR_KO[d]} {f}: 윤곽 픽셀 중 어두운 것 {dk:.0%} < {L["dark_edge_min"]:.0%} (윤곽선이 끊겼다)')
        if len(tops) == 3:
            j = max(tops) - min(tops)
            m[f'top_jitter_{d}'] = j
            if j > L['top_jitter_max']:
                fails.append(f'{DIR_KO[d]}: 걸음 프레임 사이 머리 높이 {j}px 출렁임 (Actor1 은 정확히 1px)')
        # 다리가 실제로 움직이는가: 아래 10줄에서 0 과 2 가 달라야 한다
        a, b = frames[(d, 0)], frames[(d, 2)]
        leg = sum(a[y][x] != b[y][x] for y in range(FH - 10, FH) for x in range(FW))
        m[f'leg_diff_{d}'] = leg
        if leg < L['leg_diff_min']:
            fails.append(f'{DIR_KO[d]}: 걸음 0·2 의 다리가 거의 같다({leg}px) — 걷는 것처럼 안 보인다')
        motion = sum(a[y][x] != b[y][x] for y in range(FH) for x in range(FW))
        m[f'walk_motion_{d}'] = motion
        if motion < L['walk_motion_min']:
            fails.append(f'{DIR_KO[d]}: 걸음 0↔2 에서 바뀐 픽셀 {motion} < {L["walk_motion_min"]} (Actor1 최소 79) — 팔·다리가 거의 안 움직인다')
        if base is not None:
            bf = base[1]
            bm = sum(bf[(d, 0)][y][x] != bf[(d, 2)][y][x] for y in range(FH) for x in range(FW))
            if motion < bm * L['walk_motion_vs_base']:
                fails.append(f'{DIR_KO[d]}: 걸음 동작이 뼈대의 {motion / bm:.0%} 뿐이다(뼈대 {bm}px) — 뼈대의 걸음을 따르지 않았다')
        idle = frames[(d, 1)]
        if a == idle or b == idle:
            fails.append(f'{DIR_KO[d]}: 걸음 프레임이 서 있는 자세와 똑같다')
    if len(set(bottoms.values())) > 2:
        warns.append(f'발끝 줄이 프레임마다 다르다 {sorted(set(bottoms.values()))} — 땅에서 뜰 수 있다')
    m['area'] = [min(areas.values(), default=0), max(areas.values(), default=0)]
    m['dark_edge_min'] = min(darks.values(), default=0)
    # 왼쪽 가운데 프레임 vs 오른쪽 가운데 거울
    r1, l1 = frames[('right', 1)], frames[('left', 1)]
    m['left_vs_mirror_right_px'] = sum(l1[y][x] != r1[y][FW - 1 - x] for y in range(FH) for x in range(FW))

    if base is not None:
        bpal, bframes = base
        tot = chg = sil = 0
        for k in frames:
            for y in range(FH):
                for x in range(FW):
                    c, bc = frames[k][y][x], bframes[k][y][x]
                    cv, bv = pal.get(c), bpal.get(bc)
                    if cv is not None or bv is not None:
                        tot += 1
                        if cv != bv:
                            chg += 1
                        if (cv is None) != (bv is None):
                            sil += 1
        m['changed_vs_base'] = round(chg / max(tot, 1), 3)
        m['silhouette_changed_px'] = sil
        if chg / max(tot, 1) < L['changed_min']:
            fails.append(f'뼈대 원본과 {chg / max(tot, 1):.0%} 만 다르다 — 새 캐릭터가 아니라 복사에 가깝다(≥{L["changed_min"]:.0%})')
        if sil == 0:
            warns.append('실루엣이 원본과 한 픽셀도 다르지 않다 — 색만 바꾼 것')
    return dict(ok=not fails, fails=fails, warns=warns, metrics=m)


# ─────────────────────────────── 검수용 그림 ───────────────────────────────
def _bg(w, h, lawn):
    if lawn and Path(lawn).exists():
        t = Image.open(lawn).convert('RGBA')
        im = Image.new('RGBA', (w, h))
        for y in range(0, h, t.height):
            for x in range(0, w, t.width):
                im.paste(t, (x, y))
        return im
    return Image.new('RGBA', (w, h), (92, 140, 70, 255))


def up(im, s):
    return im.resize((im.width * s, im.height * s), Image.NEAREST)


def gif_walk(pal, frames, out, scale=4, lawn=None, ms=170):
    """네 방향을 나란히, 걸음 0-1-2-1. 잔디 위."""
    seq = (0, 1, 2, 1)
    W, H = FW * 4 + 8 * 3, FH + 8
    imgs = []
    for f in seq:
        bg = _bg(W, H, lawn)
        for di, d in enumerate(DIRS):
            bg.alpha_composite(frame_rgba(pal, frames[(d, f)]), (di * (FW + 8), 4))
        imgs.append(up(bg.convert('RGB'), scale))
    _save_gif(imgs, out, ms)


def gif_turn(pal, frames, out, scale=4, lawn=None, ms=420):
    """서 있는 자세로 아래→왼→위→오른쪽 돌기."""
    imgs = []
    for d in ('down', 'left', 'up', 'right'):
        bg = _bg(FW + 8, FH + 8, lawn)
        bg.alpha_composite(frame_rgba(pal, frames[(d, 1)]), (4, 4))
        imgs.append(up(bg.convert('RGB'), scale))
    _save_gif(imgs, out, ms)


def gif_stroll(pal, frames, out, scale=3, lawn=None):
    """칸 위를 실제로 걸어 다니는 모습(1칸 16px, 프레임당 4px 이동) — 게임 속 크기 감각."""
    W, H = 16 * 7, 16 * 5
    path = []
    x, y = 16, 16 * 2
    for d, dx, dy, n in (('right', 1, 0, 4), ('down', 0, 1, 2), ('left', -1, 0, 4), ('up', 0, -1, 2)):
        for step in range(n * 4):
            x += dx * 4
            y += dy * 4
            path.append((d, (0, 1, 2, 1)[step % 4], x, y))
    imgs = []
    for d, f, px, py in path:
        bg = _bg(W, H, lawn)
        bg.alpha_composite(frame_rgba(pal, frames[(d, f)]), (px - 4 - 16, py - 16 - 8))
        imgs.append(up(bg.convert('RGB'), scale))
    _save_gif(imgs, out, 110)


def _save_gif(imgs, out, ms):
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=ms, loop=0, disposal=2, optimize=False)


def strip(pal, frames, scale=6, base=None):
    """AI 검수용(모델은 GIF 첫 장만 본다): 방향마다 0·1·2·1 을 펼치고, 옆에 0↔2 차이(빨강)를 그린다.
    base 가 있으면 맨 왼쪽에 원본(Actor1) 서 있는 자세를 둔다."""
    cols = 4 + 1 + (1 if base else 0)
    gap = 4
    W = cols * (FW + gap)
    H = 4 * (FH + gap)
    im = Image.new('RGBA', (W, H), KEY + (255,))
    for di, d in enumerate(DIRS):
        yy = di * (FH + gap)
        c0 = 0
        if base:
            im.alpha_composite(frame_rgba(base[0], base[1][(d, 1)]), (0, yy))
            c0 = 1
        for i, f in enumerate((0, 1, 2, 1)):
            im.alpha_composite(frame_rgba(pal, frames[(d, f)]), ((c0 + i) * (FW + gap), yy))
        a, b = frames[(d, 0)], frames[(d, 2)]
        diff = Image.new('RGBA', (FW, FH), (40, 40, 40, 255))
        dp = diff.load()
        idle = frame_rgba(pal, frames[(d, 1)]).load()
        for y in range(FH):
            for x in range(FW):
                if idle[x, y][3]:
                    dp[x, y] = (110, 110, 110, 255)
                if a[y][x] != b[y][x]:
                    dp[x, y] = (230, 40, 40, 255)
        im.alpha_composite(diff, ((c0 + 4) * (FW + gap), yy))
    im = up(im.convert('RGB'), scale)
    dr = ImageDraw.Draw(im)
    for di in range(4):
        dr.text((2, di * (FH + gap) * scale + 2), DIRS[di], fill=(255, 255, 255))
    return im


def sheet_big(pal, frames, scale=8):
    """격자선이 있는 8배 시트(픽셀 단위 지적용). 4px 마다 옅은 선, 프레임 경계 굵은 선."""
    im = up(sheet_keyed(pal, frames), scale)
    dr = ImageDraw.Draw(im)
    for x in range(0, FW * 3 + 1, 4):
        dr.line([(x * scale, 0), (x * scale, im.height)], fill=(0, 110, 110) if x % FW else (255, 255, 255), width=1)
    for y in range(0, FH * 4 + 1, 4):
        dr.line([(0, y * scale), (im.width, y * scale)], fill=(0, 110, 110) if y % FH else (255, 255, 255), width=1)
    return im


def context(pal, frames, actor_png, scale=3, lawn=None, others=(0, 1, 3, 6)):
    """게임 속 크기 감각: 잔디 위에 Actor1 캐릭터 몇 명(서 있는 자세, 아래 방향)과 새 캐릭터 네 방향을 같은 배율로."""
    n = len(others)
    W, H = (n + 4) * (FW + 4) + 12, FH + 8
    bg = _bg(W, H, lawn)
    for i, k in enumerate(others):
        p2, _, f2 = from_actor(actor_png, k)
        bg.alpha_composite(frame_rgba(p2, f2[('down', 1)]), (4 + i * (FW + 4), 4))
    x0 = 4 + n * (FW + 4) + 8
    for i, d in enumerate(('down', 'left', 'up', 'right')):
        bg.alpha_composite(frame_rgba(pal, frames[(d, 1)]), (x0 + i * (FW + 4), 4))
    return up(bg.convert('RGB'), scale)
