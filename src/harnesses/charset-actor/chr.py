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
GATE_VERSION = 3
ALPHA_POLICY_VERSION = 2  # 검사 정책만 갱신한다. 같은 픽셀의 렌더/사용자 선택 binding은 유지한다.
ALPHA_PREVIEW_VERSION = 1
KEY_TOLERANCE = 8  # 편집기의 투명색 판정과 동일하다.


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
# 처음 기준은 Actor1 8명에서 쟀다(출렁임 정확히 1px, 어두운 윤곽 83~96 %, 색 22~32 …). 2026-10-02 Actor2~4·People1~5 원본
# 64명에 대 보니 44명이 원본인데도 불합격했다(색 있는 윤곽선, 47색, 2px 출렁임, 아이 몸 182px).
# → 절대 기준은 「RTP 원본 72명이 모두 통과하는 넓은 울타리」만 남기고, 나머지는 **뼈대 원본 대비**로 잰다.
#   `harness.py calibrate` 가 72명 전원 통과(뼈대 = 자기 자신)를 확인한다.
# 걸음 동작량(walk_motion)은 2026-10-02 첫 실행에서 Sonnet 이 몸을 1px 내리고 발끝만 바꾼 걸음(16~26px)을 내서 넣었다.
LIMITS = dict(max_colors=48, area_min=120, area_max=480, bbox_w_max=24, bbox_h_max=31, top_jitter_max=2,
              walk_motion_min=50, leg_diff_min=6, dark_luma=70,
              # 뼈대 대비
              area_vs_base=(0.7, 1.5), dark_edge_drop=0.15, walk_motion_vs_base=0.6, changed_min=0.20,
              # 2026-10-02 사용자 판정 34개: 받은 11개 중앙값 47px(8개 ≤86), 버린 23개 중 19개 >140(무기·모자·날개·지팡이를 더한 것).
              # 「무기나 모자 추가는 별로」 → 실루엣은 뼈대 그대로가 원칙. 12프레임 합 150px 초과는 불합격.
              silhouette_max=150,
              # 그 뒤 「너무 비슷하다, 약간 더 바꾸되」 → 실루엣 변화 총량 대신 **뼈대 실루엣+2px 밖으로 튀어나온 픽셀**로 소지품을 잡는다.
              # 판정 55개: 받은 21개는 프레임당 최대 ≤9·합 ≤48, 소지품을 더해 버린 것은 11~42. 머리 볼륨·옷깃은 허용된다.
              protrude_margin=2, protrude_frame_max=10, protrude_sum_max=60)


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def stats(pal, frames):
    """방향·걸음마다 실루엣 크기·윤곽 어두움·머리 높이, 방향마다 걸음 동작량."""
    st = dict(area={}, dark={}, top={}, bottom={}, bbox={}, motion={}, leg={}, jitter={})
    for d in DIRS:
        for f in range(3):
            rows = frames[(d, f)]
            op = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != TRANSPARENT]
            k = (d, f)
            if not op:
                continue
            xs, ys = [p[0] for p in op], [p[1] for p in op]
            st['area'][k] = len(op)
            st['top'][k], st['bottom'][k] = min(ys), max(ys)
            st['bbox'][k] = (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)
            S = set(op)
            edge = [(x, y) for x, y in op if any((x + dx, y + dy) not in S for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
            st['dark'][k] = sum(_lum(pal[rows[y][x]]) < LIMITS['dark_luma'] for x, y in edge) / len(edge)
        a, b = frames[(d, 0)], frames[(d, 2)]
        st['motion'][d] = sum(a[y][x] != b[y][x] for y in range(FH) for x in range(FW))
        st['leg'][d] = sum(a[y][x] != b[y][x] for y in range(FH - 10, FH) for x in range(FW))
        tops = [st['top'][(d, f)] for f in range(3) if (d, f) in st['top']]
        st['jitter'][d] = max(tops) - min(tops) if len(tops) == 3 else 0
    return st


# 수정 강도(2026-10-03 사용자: 그림을 넣으면 「약함·보통·강함」으로 얼마나 고칠지 정한다).
# 약함 = 색만(실루엣 그대로), 보통 = 머리 모양·옷 무늬까지(소지품 금지), 강함 = 머리·옷 실루엣과 작은 장신구까지(큰 무기·날개 금지).
STRENGTH = {
    'free': dict(label='자유 저작'),
    'weak': dict(label='약함', protrude_frame_max=0, protrude_sum_max=0, silhouette_max=30, changed_min=0.15, redrawn_min=0),
    'normal': dict(label='보통', protrude_frame_max=10, protrude_sum_max=60, silhouette_max=None, changed_min=0.20, redrawn_min=0.15),
    'strong': dict(label='강함', protrude_frame_max=20, protrude_sum_max=160, silhouette_max=None, changed_min=0.30, redrawn_min=0.25),
}
# redrawn = 「색 바꾸기로 설명되지 않는 픽셀」 비율: 뼈대 글자마다 가장 많이 바뀐 새 글자 하나로 옮겼다고 보고 남는 픽셀.
# 2026-10-03 「보통」 조선 병사가 색만 바꾸고(0.02) 끝냈다. 판정 자료: 색 바꾸기(c-*) 0~0.09, 받은 v-* 0.14~0.51.


def redrawn(bframes, frames):
    from collections import Counter, defaultdict
    m, tot = defaultdict(Counter), 0
    for k in frames:
        for y in range(FH):
            for x in range(FW):
                b, c = bframes[k][y][x], frames[k][y][x]
                if b == TRANSPARENT and c == TRANSPARENT:
                    continue
                tot += 1
                m[b][c] += 1
    return 1 - sum(cn.most_common(1)[0][1] for cn in m.values()) / max(tot, 1)


def _opaque(rows):
    return {(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c != TRANSPARENT}


def _canonical_colors(pal, frames):
    """같은 RGB의 서로 다른 글자로 걷기/재저작 수치를 부풀리지 못한다."""
    first, chars = {}, {}
    for c, rgb in pal.items():
        chars[c] = first.setdefault(rgb, c)
    return ({c: rgb for rgb, c in first.items()},
            {k: [''.join(chars[c] for c in row) for row in rows] for k, rows in frames.items()})


def _enclosed(op):
    """4방향 배경 flood fill. 다리/팔 사이의 열린 배경은 구멍이 아니다."""
    from collections import deque
    bg = {(x, y) for y in range(FH) for x in range(FW)} - op
    outside = {p for p in bg if p[0] in (0, FW - 1) or p[1] in (0, FH - 1)}
    queue = deque(outside)
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p in bg and p not in outside:
                outside.add(p)
                queue.append(p)
    return bg - outside


def _head_core(op):
    """몸 비율 유지 계약: 원본 상반부의 가장 큰 채워진 직사각형 안쪽.

    머리 위 상투/옆 포니테일 같은 돌출부 대신 두개골의 면을 찾는다.
    사람형 원본에 대한 보수적 결손 검사이며 머리의 의미/화풍은 시각 검수가 맡는다.
    """
    if not op:
        return set()
    top, bottom = min(y for _, y in op), max(y for _, y in op)
    end = min(FH, top + (bottom - top + 1) // 2 + 1)
    best = (0, 0, 0, 0, 0)
    for y in range(top, end):
        for x in range(FW):
            width = FW - x
            for yy in range(y, end):
                w = 0
                while w < width and (x + w, yy) in op:
                    w += 1
                width = min(width, w)
                height = yy - y + 1
                if width < 6:
                    break
                if height >= 6 and width * height > best[0]:
                    best = (width * height, x, y, width, height)
    _, x, y, w, h = best
    return {(xx, yy) for yy in range(y + 1, y + h - 1) for xx in range(x + 1, x + w - 1)}


def opacity_defects(pal, frames, base=None):
    """서 있는 자세뿐 아니라 12장 모두의 복구 불가 결손을 기록한다."""
    defects = []
    used = {c for rows in frames.values() for row in rows for c in row if c != TRANSPARENT}
    unsafe = sorted(c for c in used if all(abs(pal[c][i] - KEY[i]) <= KEY_TOLERANCE for i in range(3)))
    if unsafe:
        defects.append(dict(code='transparent_color', colors=unsafe,
                            what=f'편집기 투명색 ±{KEY_TOLERANCE} 범위의 몸체 색: {"".join(unsafe)}'))
    for k, rows in frames.items():
        op = _opaque(rows)
        reference = _opaque(base[1][k]) if base else None
        holes = _enclosed(op)
        # 새 옷 밖의 원본 배경도 이제 옷 안이면 구멍이다. 원본의 이미 닫힌 공간만 보존한다.
        missing = ((holes & reference) | (holes - _enclosed(reference))) if reference is not None else holes
        if missing:
            defects.append(dict(code='internal_transparency', frame=f'{k[0]} {k[1]}',
                                pixels=sorted(missing), what=f'{DIR_KO[k[0]]} {k[1]}: 몸체 내부 투명 결손 {len(missing)}px'))
        border = {p for p in op if p[0] in (0, FW - 1) or p[1] == 0}
        if reference is not None:
            border -= reference
        if border:
            defects.append(dict(code='frame_clipping', frame=f'{k[0]} {k[1]}', pixels=sorted(border),
                                what=f'{DIR_KO[k[0]]} {k[1]}: 위/옆 프레임 경계에 새 픽셀 — 잘림 위험'))
        if reference is not None:
            core = _head_core(reference)
            lost = core - op
            # 바깥으로 열린 좁은 틈은 flood fill에서 사라진다. 원본 머리 면에서
            # 윤곽 여유를 한 번 더 제외한 깊은 면은 1px도 투명하게 지우지 않는다.
            deep_core = {(x, y) for x, y in core if all((x + dx, y + dy) in core
                                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
            slit = (lost - holes) & deep_core
            if slit:
                defects.append(dict(code='open_head_transparency', frame=f'{k[0]} {k[1]}', pixels=sorted(slit),
                                    what=f'{DIR_KO[k[0]]} {k[1]}: 머리 내부로 열린 투명 틈 {len(slit)}px'))
            # 1px 윤곽 조절을 허용하되 깊은 머리 면의 20% 이상 삭제는 폐기한다.
            if len(lost) >= max(4, (len(core) + 4) // 5):
                defects.append(dict(code='head_core_loss', frame=f'{k[0]} {k[1]}', pixels=sorted(lost),
                                    what=f'{DIR_KO[k[0]]} {k[1]}: 원본 머리 내부 {len(lost)}/{len(core)}px 삭제'))
    return defects


def gate(pal, frames, base=None, check_changed=True, strength='normal'):
    """→ dict(ok, fails[], warns[], metrics{}). base=(pal, frames) 가 있으면 뼈대 대비 기준과 「새 캐릭터인가」도 잰다.
    strength(weak·normal·strong)가 돌출·실루엣·변화량 기준을 정한다."""
    L = dict(LIMITS)
    L.update({k: v for k, v in STRENGTH.get(strength or 'normal', STRENGTH['normal']).items() if k != 'label'})
    fails, warns, m = [], [], {}
    se = structural_errors(pal, frames)
    if se:
        return dict(version=GATE_VERSION, alphaPolicy=ALPHA_POLICY_VERSION, ok=False, discard=True, fatal=[dict(code='structure', what=s) for s in se[:20]],
                    fails=se[:20], warns=[], metrics={})
    pal, frames = _canonical_colors(pal, frames)
    if base is not None:
        base = _canonical_colors(*base)
    fatal = opacity_defects(pal, frames, base)
    fails.extend(it['what'] for it in fatal)
    m['opacity_defects'] = len(fatal)
    if strength == 'free':
        # 자유 저작에서는 미감/원본 변화율/소품 크기를 숫자로 심사하지 않는다.
        # 손상된 파일·색 키·머리/몸체 결손·빈 프레임만 자동 차단한다.
        for k, rows in frames.items():
            if not _opaque(rows):
                fatal.append(dict(code='empty_frame', frame=f'{k[0]} {k[1]}', what=f'{k}: 빈 프레임'))
        return dict(version=GATE_VERSION, alphaPolicy=ALPHA_POLICY_VERSION, ok=not fatal, discard=bool(fatal), fatal=fatal,
                    fails=[it['what'] for it in fatal], warns=[], metrics=m)
    used = {}
    for k, rows in frames.items():
        for r in rows:
            for c in r:
                if c != TRANSPARENT:
                    used.setdefault(c, set()).add(k)
    m['colors'] = len(used)
    if base is not None:
        # 올린 그림(RTP 밖)은 울타리를 넘을 수 있다(조선 병사 55색·깃털이 칸 끝까지) — 뼈대가 이미 넘은 만큼은 허용한다.
        bused = {c for rows in base[1].values() for r in rows for c in r if c != TRANSPARENT}
        if len(bused) > L['max_colors']:
            L['max_colors'] = len(bused) + 4   # 새 색 몇 개는 넣을 수 있게
    if len(used) > L['max_colors']:
        fails.append(f'색 {len(used)}개 > {L["max_colors"]} (RTP 원본 최대 47)')
    once = sorted(c for c, ks in used.items() if len(ks) == 1)
    if once:
        warns.append(f'한 프레임에만 나오는 색 {"".join(once)} — 걸을 때 깜빡일 수 있다')
    unused = sorted(c for c in pal if c != TRANSPARENT and c not in used)
    if unused:
        warns.append(f'팔레트에 있지만 안 쓴 색 {"".join(unused)}')
    st = stats(pal, frames)
    bs = stats(*base) if base is not None else None
    for d in DIRS:
        for f in range(3):
            k = (d, f)
            if k not in st['area']:
                fails.append(f'{DIR_KO[d]} {f}: 빈 프레임')
                continue
            ar = st['area'][k]
            amin = min(L['area_min'], bs['area'].get(k, L['area_min'])) if bs else L['area_min']
            amax = max(L['area_max'], bs['area'].get(k, 0)) if bs else L['area_max']
            if not (amin <= ar <= amax):
                fails.append(f'{DIR_KO[d]} {f}: 실루엣 {ar}px — 범위({amin}~{amax}) 밖')
            w, h = st['bbox'][k]
            bw, bh = bs['bbox'].get(k, (0, 0)) if bs else (0, 0)
            wmax, hmax = max(L['bbox_w_max'], bw), max(L['bbox_h_max'], bh)
            if w > wmax or h > hmax:
                fails.append(f'{DIR_KO[d]} {f}: 크기 {w}×{h} — 칸 가장자리까지 찼다(≤{wmax}×{hmax})')
            if bs and k in bs['area']:
                lo, hi = L['area_vs_base']
                if not (lo * bs['area'][k] <= ar <= hi * bs['area'][k]):
                    fails.append(f'{DIR_KO[d]} {f}: 실루엣 {ar}px — 뼈대({bs["area"][k]}px)의 {ar / bs["area"][k]:.0%} (허용 {lo:.0%}~{hi:.0%})')
                if st['dark'][k] < bs['dark'][k] - L['dark_edge_drop']:
                    fails.append(f'{DIR_KO[d]} {f}: 윤곽 픽셀 중 어두운 것 {st["dark"][k]:.0%} — 뼈대({bs["dark"][k]:.0%})보다 '
                                 f'{L["dark_edge_drop"]:.0%}p 넘게 밝다(윤곽선이 끊겼다)')
        j = st['jitter'][d]
        m[f'top_jitter_{d}'] = j
        jmax = max(1, bs['jitter'][d]) if bs else L['top_jitter_max']
        if j > jmax:
            fails.append(f'{DIR_KO[d]}: 걸음 프레임 사이 머리 높이 {j}px 출렁임 (뼈대 {bs["jitter"][d] if bs else "-"}px)')
        m[f'leg_diff_{d}'] = st['leg'][d]
        if st['leg'][d] < L['leg_diff_min']:
            fails.append(f'{DIR_KO[d]}: 걸음 0·2 의 다리가 거의 같다({st["leg"][d]}px) — 걷는 것처럼 안 보인다')
        mo = st['motion'][d]
        m[f'walk_motion_{d}'] = mo
        motion_min = min(L['walk_motion_min'], bs['motion'][d]) if bs else L['walk_motion_min']
        if mo < motion_min:
            fails.append(f'{DIR_KO[d]}: 걸음 0↔2 에서 바뀐 픽셀 {mo} < {motion_min} — 팔·다리가 거의 안 움직인다')
        if bs and mo < bs['motion'][d] * L['walk_motion_vs_base']:
            fails.append(f'{DIR_KO[d]}: 걸음 동작이 뼈대의 {mo / bs["motion"][d]:.0%} 뿐이다(뼈대 {bs["motion"][d]}px) — 뼈대의 걸음을 따르지 않았다')
        a, b, idle = frames[(d, 0)], frames[(d, 2)], frames[(d, 1)]
        if a == idle or b == idle:
            fails.append(f'{DIR_KO[d]}: 걸음 프레임이 서 있는 자세와 똑같다')
    if len(set(st['bottom'].values())) > 2:
        warns.append(f'발끝 줄이 프레임마다 다르다 {sorted(set(st["bottom"].values()))} — 땅에서 뜰 수 있다')
    m['area'] = [min(st['area'].values(), default=0), max(st['area'].values(), default=0)]
    m['dark_edge_min'] = round(min(st['dark'].values(), default=0), 3)
    r1, l1 = frames[('right', 1)], frames[('left', 1)]
    m['left_vs_mirror_right_px'] = sum(l1[y][x] != r1[y][FW - 1 - x] for y in range(FH) for x in range(FW))

    if base is not None and check_changed:
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
        rd = redrawn(bframes, frames)
        m['redrawn_vs_base'] = round(rd, 3)
        if rd < L['redrawn_min']:
            fails.append(f'모양을 다시 찍은 픽셀이 {rd:.0%} 뿐이다(≥{L["redrawn_min"]:.0%}) — 색만 바꿨다. 이 강도에서는 머리 모양·옷 모양을 바꿔야 한다')
        if L.get('silhouette_max') is not None and sil > L['silhouette_max']:
            fails.append(f'실루엣이 뼈대와 {sil}px 다르다(≤{L["silhouette_max"]}, 강도 약함 = 색만 바꾼다)')
        pr = protrusion(bframes, frames, L['protrude_margin'])
        m['protrusion_max'], m['protrusion_sum'] = max(pr.values()), sum(pr.values())
        if m['protrusion_max'] > L['protrude_frame_max'] or m['protrusion_sum'] > L['protrude_sum_max']:
            worst = max(pr, key=pr.get)
            fails.append(f'뼈대 실루엣 밖(+{L["protrude_margin"]}px)으로 튀어나온 픽셀 프레임당 최대 {m["protrusion_max"]}'
                         f'({DIR_KO[worst[0]]} {worst[1]})·합 {m["protrusion_sum"]} (≤{L["protrude_frame_max"]}·≤{L["protrude_sum_max"]})'
                         ' — 이 강도에서 허용하는 것보다 몸 밖으로 많이 튀어나왔다(소지품·모자·날개)')
    return dict(version=GATE_VERSION, alphaPolicy=ALPHA_POLICY_VERSION, ok=not fails, discard=bool(fatal), fatal=fatal, fails=fails, warns=warns, metrics=m)


# ─────────────────────────────── 검수용 그림 ───────────────────────────────
def _bg(w, h, lawn, background='lawn'):
    if background in ('white', 'black'):
        return Image.new('RGBA', (w, h), background)
    if background == 'checker':
        im = Image.new('RGBA', (w, h), (45, 48, 57, 255))
        draw = ImageDraw.Draw(im)
        for y in range(0, h, 4):
            for x in range(0, w, 4):
                if (x // 4 + y // 4) % 2:
                    draw.rectangle((x, y, x + 3, y + 3), fill=(225, 65, 210, 255))
        return im
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


def gif_walk(pal, frames, out, scale=4, lawn=None, ms=170, background='lawn'):
    """네 방향을 나란히, 걸음 0-1-2-1. 동일 RGBA를 선택한 배경 위에 합성한다."""
    seq = (0, 1, 2, 1)
    W, H = FW * 4 + 8 * 3, FH + 8
    imgs = []
    for f in seq:
        bg = _bg(W, H, lawn, background)
        for di, d in enumerate(DIRS):
            bg.alpha_composite(frame_rgba(pal, frames[(d, f)]), (di * (FW + 8), 4))
        imgs.append(up(bg.convert('RGB'), scale))
    _save_gif(imgs, out, ms)


def alpha_views(pal, frames, out):
    """키 색 PNG/GIF와 별도로 실제 alpha와 고대비 12프레임을 드러낸다."""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    sheet = sheet_rgba(pal, frames)
    sheet.save(out / 'sheet_rgba.png')
    sheet.getchannel('A').save(out / 'alpha.png')
    bg = _bg(sheet.width, sheet.height, None, 'checker')
    bg.alpha_composite(sheet)
    up(bg.convert('RGB'), 6).save(out / 'alpha_sheet.png')
    for background in ('checker', 'white', 'black'):
        gif_walk(pal, frames, out / f'walk_{background}.gif', background=background)


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
    """게임 속 크기 감각: 잔디 위에 뼈대 칩셋의 캐릭터 몇 명(서 있는 자세, 아래 방향)과 새 캐릭터 네 방향을 같은 배율로."""
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


# ─────────────────────────────── 얼굴 (RM2000 FaceSet 48×48) ───────────────────────────────
# 형식은 칩과 같고 프레임이 하나뿐이다:  palette … / frame face 0 / 48글자 × 48줄.
# Actor1 얼굴은 한 장에 125색이라 글자 하나로 못 적는다 → 뼈대로 꺼낼 때 64색으로 줄인다(눈으로는 차이 없음).
FACE = 48
FACE_CHARS = ''.join(c for c in map(chr, range(33, 127)) if c not in '.#')  # 92글자
FACE_MAX_COLORS = 90


def parse_face(text):
    pal, notes, frames = {}, {}, {}
    rows, mode = None, None
    for n, raw in enumerate(text.splitlines(), 1):
        s = raw.strip()
        if mode != 'face' and (not s or s.startswith('# ')):
            continue
        if s == 'palette':
            mode = 'pal'
            continue
        if s == 'frame face 0':
            mode, rows = 'face', []
            continue
        if mode == 'pal':
            m = re.fullmatch(r'(\S)\s+(transparent|#[0-9a-fA-F]{6})(?:\s+(.*))?', s)
            if not m:
                raise GridError(f'{n}줄: 색 줄은 "<글자> #rrggbb [설명]" 이어야 한다: {s!r}')
            ch, v = m.group(1), m.group(2)
            pal[ch] = None if v == 'transparent' else tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))
            notes[ch] = m.group(3) or ''
        elif mode == 'face':
            if s:
                rows.append(s)
    pal.setdefault(TRANSPARENT, None)
    return pal, notes, rows or []


def dump_face(pal, notes, rows, header=''):
    out = ['# ' + h for h in header.splitlines()] if header else []
    out.append('palette')
    for ch, rgb in pal.items():
        v = 'transparent' if rgb is None else '#%02x%02x%02x' % rgb
        out.append(f'{ch} {v}' + (f'   {notes.get(ch)}' if notes.get(ch) else ''))
    out.append('frame face 0')
    out += rows
    return '\n'.join(out) + '\n'


def from_faceset(png, index, colors=64):
    """FaceSet(192×192, 4×4) 의 index 번째 얼굴 → (pal, notes, rows). 색은 colors 개로 줄이고 어두운 것부터 글자를 준다."""
    a = Image.open(png).convert('RGB')
    x, y = (index % 4) * FACE, (index // 4) * FACE
    f = a.crop((x, y, x + FACE, y + FACE)).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pl = f.getpalette()[:colors * 3]
    used = sorted(set(f.getdata()))
    cols = {i: tuple(pl[i * 3:i * 3 + 3]) for i in used}
    order = sorted(used, key=lambda i: _lum(cols[i]))
    ch = {i: FACE_CHARS[k] for k, i in enumerate(order)}
    pal = {TRANSPARENT: None}
    pal.update({ch[i]: cols[i] for i in order})
    rows = [''.join(ch[f.getpixel((xx, yy))] for xx in range(FACE)) for yy in range(FACE)]
    return pal, {}, rows


def face_rgba(pal, rows):
    im = Image.new('RGBA', (FACE, FACE), (0, 0, 0, 0))
    p = im.load()
    for yy, r in enumerate(rows):
        for xx, c in enumerate(r):
            if pal.get(c) is not None:
                p[xx, yy] = pal[c] + (255,)
    return im


def face_gate(pal, rows, base=None):
    fails, warns, m = [], [], {}
    if len(rows) != FACE or any(len(r) != FACE for r in rows):
        fails.append(f'얼굴은 48글자 × 48줄이어야 한다 (지금 {len(rows)}줄, 길이 {sorted({len(r) for r in rows})})')
        return dict(ok=False, fails=fails, warns=warns, metrics=m)
    bad = sorted({c for r in rows for c in r if c not in pal})
    if bad:
        fails.append(f'팔레트에 없는 글자 {"".join(bad)!r}')
        return dict(ok=False, fails=fails, warns=warns, metrics=m)
    used = {c for r in rows for c in r if c != TRANSPARENT}
    m['colors'] = len(used)
    if len(used) > FACE_MAX_COLORS:
        fails.append(f'색 {len(used)}개 > {FACE_MAX_COLORS}')
    holes = sum(c == TRANSPARENT for r in rows for c in r)
    if holes:
        warns.append(f'투명 픽셀 {holes}개 — RM2000 얼굴은 네모 칸을 꽉 채운다')
    if base is not None:
        bp, brows = base
        chg = sum(pal.get(rows[yy][xx]) != bp.get(brows[yy][xx]) for yy in range(FACE) for xx in range(FACE))
        m['changed_vs_base'] = round(chg / FACE / FACE, 3)
        if chg / FACE / FACE < 0.15:
            fails.append(f'뼈대 얼굴과 {chg / FACE / FACE:.0%} 만 다르다 — 새 캐릭터의 얼굴이 아니다(≥15%)')
    return dict(ok=not fails, fails=fails, warns=warns, metrics=m)


# ─────────────────────────────── 걸음 전파 ───────────────────────────────
# 2026-10-02 사용자: 「너무 비슷하다, 약간 더 바꾸되 걷는 게 어색하지 않아야」. 작업자가 걸음 프레임까지 손으로 고치면
# 바뀐 부위(머리 모양·옷 무늬)가 프레임마다 어긋나 깜빡인다 → 작업자는 서 있는 자세(frame * 1)만 고치고,
# 걸음 0·2 는 하네스가 뼈대의 움직임을 그대로 따라 만든다.
#   뼈대 걸음 프레임의 픽셀 p 마다, 뼈대 서 있는 자세에서 그 픽셀이 온 자리 q 를 3×3 무늬 대조로 찾는다(±3px, 출렁임 우선).
#   새 걸음 프레임[p] = 새 서 있는 자세[q]. 뼈대에 없던 새 픽셀(머리 볼륨 등)은 출렁임만큼 내려서 옮긴다.
def _shift_rows(rows, dy):
    return [rows[y - dy] if 0 <= y - dy < FH else TRANSPARENT * FW for y in range(FH)]


def bob_of(b1, bf):
    """뼈대 걸음 프레임이 서 있는 자세보다 몇 px 내려갔나(같은 픽셀이 가장 많은 dy)."""
    best = None
    for dy in (-2, -1, 0, 1, 2):
        s = _shift_rows(b1, dy)
        same = sum(bf[y][x] == s[y][x] and bf[y][x] != TRANSPARENT for y in range(FH) for x in range(FW))
        if best is None or same > best[1]:
            best = (dy, same)
    return best[0]


def correspondence(b1, bf, R=3):
    """뼈대 걸음 프레임 bf 의 불투명 픽셀 → 서 있는 자세 b1 의 출발 자리. {(x,y): (qx,qy)}"""
    bob = bob_of(b1, bf)

    # 칩에 따라 칼·창이 한 걸음 사이에 3px보다 멀리 움직인다. 근처에서 못 찾으면
    # 같은 방향의 서 있는 자세 전체에서 찾는다 — 색만 복사하면 지운 소지품이 되살아난다.
    positions = {}
    for qy, row in enumerate(b1):
        for qx, c in enumerate(row):
            if c != TRANSPARENT:
                positions.setdefault(c, []).append((qx, qy))

    def at(rows, x, y):
        return rows[y][x] if 0 <= x < FW and 0 <= y < FH else TRANSPARENT
    corr = {}
    for y in range(FH):
        for x in range(FW):
            c = bf[y][x]
            if c == TRANSPARENT:
                continue
            # 몸통의 같은 픽셀은 출렁임만 따라야 한다. 주변 무늬 점수를 먼저
            # 비교하면 원본의 주름 때문에 새 옷의 깃/띠를 옆 칸에서 가져온다.
            # 실제로 원본 색이 바뀐 자리만 움직임 대응을 찾는다.
            if at(b1, x, y - bob) == c:
                corr[(x, y)] = (x, y - bob)
                continue
            best = None
            for dy in range(-R, R + 1):
                for dx in range(-R, R + 1):
                    qx, qy = x + dx, y - bob + dy
                    if at(b1, qx, qy) != c:
                        continue
                    sc = sum(at(bf, x + i, y + j) == at(b1, qx + i, qy + j) for i in (-1, 0, 1) for j in (-1, 0, 1))
                    key = (sc, -(abs(dx) + abs(dy)))
                    if best is None or key > best[0]:
                        best = (key, (qx, qy))
            if best is None:
                for qx, qy in positions.get(c, ()):
                    sc = sum(at(bf, x + i, y + j) == at(b1, qx + i, qy + j) for i in (-1, 0, 1) for j in (-1, 0, 1))
                    key = (sc, -(abs(qx - x) + abs(qy - (y - bob))))
                    if best is None or key > best[0]:
                        best = (key, (qx, qy))
            corr[(x, y)] = best[1] if best else None   # None = 서 있는 자세에 없는 색(걸음에만 있는 그림자 등) → 색 대응표로
    return corr, bob


def color_map(base_frames, new_frames):
    """뼈대 색 → 새 색: 서 있는 자세 4장에서 같은 자리끼리 가장 많이 겹친 색."""
    from collections import Counter
    cnt = {}
    for d in DIRS:
        b1, n1 = base_frames[(d, 1)], new_frames[(d, 1)]
        for y in range(FH):
            for x in range(FW):
                if b1[y][x] != TRANSPARENT:
                    cnt.setdefault(b1[y][x], Counter())[n1[y][x]] += 1
    return {c: k.most_common(1)[0][0] for c, k in cnt.items()}




def propagate(base_frames, new_frames, base_pal=None, new_pal=None):
    """new_frames 의 서 있는 자세(* 1)에서 걸음 0·2 를 다시 만든다 → 새 frames dict.
    팔레트를 주면 색 대응표가 새 팔레트에 없는 글자를 내지 않게 가장 가까운 새 색으로 바꾼다."""
    out = dict(new_frames)
    cmap = color_map(base_frames, new_frames)
    if base_pal and new_pal:
        cols = [(c, v) for c, v in new_pal.items() if v is not None]
        for bc in {c for rows in base_frames.values() for r in rows for c in r} - {TRANSPARENT}:
            if cmap.get(bc) == TRANSPARENT:
                continue   # 서 있는 자세에서 지운 픽셀은 걸음에서도 지운다.
            if cmap.get(bc) not in new_pal:
                bv = base_pal[bc]
                cmap[bc] = min(cols, key=lambda cv: sum((a - b) ** 2 for a, b in zip(cv[1], bv)))[0]
    for d in DIRS:
        b1, n1 = base_frames[(d, 1)], new_frames[(d, 1)]
        for f in (0, 2):
            bf = base_frames[(d, f)]
            corr, bob = correspondence(b1, bf)
            rows = [[TRANSPARENT] * FW for _ in range(FH)]
            for (x, y), q in corr.items():
                if q is None:
                    rows[y][x] = cmap.get(bf[y][x], bf[y][x])
                elif 0 <= q[0] < FW and 0 <= q[1] < FH:
                    rows[y][x] = n1[q[1]][q[0]]
            # 뼈대에 없던 새 픽셀(서 있는 자세에서 뼈대는 투명, 새 그림은 불투명) → 출렁임만큼 내려 옮긴다
            for y in range(FH):
                for x in range(FW):
                    sy = y - bob
                    if 0 <= sy < FH and b1[sy][x] == TRANSPARENT and n1[sy][x] != TRANSPARENT and rows[y][x] == TRANSPARENT \
                            and bf[y][x] == TRANSPARENT:
                        rows[y][x] = n1[sy][x]
            _tidy(rows, bf)
            out[(d, f)] = [''.join(r) for r in rows]
    return out


def _tidy(rows, bf):
    """전파 뒤 정리 — 뼈대 걸음 프레임 bf 에는 없던 결함만 고친다(원본의 의도된 점·틈은 둔다):
    상하좌우에 불투명 이웃이 없는 외톨이 점(뼈대 그 자리는 외톨이가 아니었다)은 지우고,
    상하좌우가 모두 불투명인 1px 구멍(뼈대 그 자리는 불투명)은 이웃 중 가장 많은 색으로 메운다."""
    from collections import Counter
    nb = ((1, 0), (-1, 0), (0, 1), (0, -1))

    def around(rs, x, y):
        return [rs[y + j][x + i] if 0 <= x + i < FW and 0 <= y + j < FH else TRANSPARENT for i, j in nb]
    for y in range(FH):
        for x in range(FW):
            opaque = [c for c in around(rows, x, y) if c != TRANSPARENT]
            if rows[y][x] != TRANSPARENT and not opaque:
                if bf[y][x] == TRANSPARENT or any(c != TRANSPARENT for c in around(bf, x, y)):
                    rows[y][x] = TRANSPARENT
            elif rows[y][x] == TRANSPARENT and len(opaque) == 4 and bf[y][x] != TRANSPARENT:
                rows[y][x] = Counter(opaque).most_common(1)[0][0]


def protrusion(base_frames, frames, margin=2):
    """뼈대 실루엣을 margin px 넓힌 밖으로 튀어나온 픽셀 수(프레임별). 무기·모자·날개를 잡는다."""
    res = {}
    for k, rows in frames.items():
        b = base_frames[k]
        inside = set()
        for y in range(FH):
            for x in range(FW):
                if b[y][x] != TRANSPARENT:
                    for j in range(-margin, margin + 1):
                        for i in range(-margin, margin + 1):
                            inside.add((x + i, y + j))
        res[k] = sum(rows[y][x] != TRANSPARENT and (x, y) not in inside for y in range(FH) for x in range(FW))
    return res
