"""building-kit 덩어리 모형 → 실제 건물 (`massing`, 2026-10-25).

사용자(2026-10-25): bk-massing-100(중세 건물 덩어리 모형 100종 + 성 3채 + 도시)으로 실제 건물을 다양하게 만들어 머지까지.

한 건물 = `harness-data/building-kit/massing/art/<id>.txt`(글자 하나 = 화소 하나, `.` 투명, 글자 → 잠긴 팔레트 색) +
`art/<id>.json`(이름·덩어리 모형 번호·칸 통행 walk). 그림은 손 도트 데이터다(난수·생성 이미지 없음). 그리는 쪽은 tile-artist
(Opus) 이고, 판정은 object-gate(kind structure) + 독립 검수자(argon · klb-sonnet-5-5)가 한다 — 이 파일은 판정하지 않는다.

단계:
  palette            버들항 기준 건물 실화소에서 잠긴 팔레트(palette.json)를 만든다(판타지 왕국 팔레트 51색 + 버들항 건물 군집 색).
  check [id…]        기계 검사(크기·팔레트·투명·walk 칸 일치·문 하나·바닥 닿음·먹 윤곽). FAIL = 종료코드 1.
  render [id…]       qa-runs/…/massing/preview/<id>-{1x,4x,cmp}.png — 덩어리 모형 | 1배·3배 | 버들항 기준 3배.
  boards [id…]       검수판(1배·4배, 버들항 기준 옆) — 검수자에게 준다.
  publish            check 통과 건물을 beodeul-building-review 프로필 `building-kit-massing` 의 seed 후보·sources PNG 로 낸다.
  decide             증거(object-gate 영수증 + 검수자 둘의 원문 PASS)가 지금 그림 해시와 맞는 건물만 위임 허용을 decisions.json 에 적는다.
  status             건물마다 해시·검사·관문·검수·허용 상태.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dot  # noqa: E402

REPO = dot.REPO
DATA = os.path.join(dot.DATA, 'massing')
ART = os.path.join(DATA, 'art')
REFS = os.path.join(DATA, 'refs')
REVIEWS = os.path.join(DATA, 'reviews')
RUNS = os.path.join(dot.RUNS, 'massing')
SHEET = os.path.join(REPO, 'public', 'assets', 'beodeul-city', 'beodeul-city-chipset.png')
T = 16
CHARS = ('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=?<>^/|:;,_-'
         'αβγδεζηθικλμνξπρστφχψωΓΔΘΛΞΠΣΦΨΩ')
WALK = set('XD*.')
# 팔레트 군집을 뽑는 버들항 기준 건물(공용 시트 키트) — 품질 기준과 같은 묶음
PALETTE_KITS = ['bd-house-inn', 'bd-house-smithy_town', 'bd-house-h101_0', 'bd-house-h104_1', 'bd-house-h124_0',
                'bd-house-cathedral', 'bd-house-mill1', 'bd-house-ware0', 'bd-house-manor', 'bd-wall-tower',
                'bd-mpart-tower', 'bd-house-barracks', 'bd-house-cstable', 'bd-house-lodge', 'bd-manor-tower',
                'bd-house-cafe', 'bd-house-h122_0', 'bd-house-smithy']
EXTRA = 64
DARK_OUTLINE = 0.12
GRASS = (110, 153, 67, 255)


def sha_png(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


# ---------------------------------------------------------------- palette
def _hue_name(rgb):
    import colorsys
    r, g, b = [c / 255 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    h *= 360
    if s < 0.13:
        return 'grey'
    if 200 <= h < 290:
        return 'blue'
    if 290 <= h or h < 12:
        return 'brick' if s < 0.45 else 'red'
    if h < 40:
        return 'terracotta' if s > 0.45 else 'plaster'
    if h < 65:
        return 'wood' if v < 0.75 else 'gold'
    if h < 170:
        return 'green'
    return 'teal'


def build_palette():
    sys.path.insert(0, HERE)
    import beodeul
    fk = json.load(open(os.path.join(dot.DATA, 'fantasy-kingdom', 'palette.json'), encoding='utf-8'))
    base = [dot.hx(c) for c in fk['allowed']]
    px = []
    for kid in PALETTE_KITS:
        a = beodeul.kit(kid).a.reshape(-1, 4)
        px.append(a[a[:, 3] == 255][:, :3])
    px = np.concatenate(px).astype(np.float64)
    used = np.unique(px.astype(np.uint8), axis=0)
    # 결정적 k-평균(시작점 = 밝기 정렬 등간격), 중심은 실제 화소 색으로 맞춘다
    order = np.argsort(px @ np.array([0.299, 0.587, 0.114]))
    cent = px[order[np.linspace(0, len(px) - 1, EXTRA).astype(int)]].copy()
    for _ in range(25):
        d = ((px[:, None, :] - cent[None, :, :]) ** 2).sum(-1) if len(px) < 40000 else None
        if d is None:
            lab = np.empty(len(px), int)
            for i in range(0, len(px), 20000):
                lab[i:i + 20000] = ((px[i:i + 20000, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
        else:
            lab = d.argmin(1)
        for k in range(EXTRA):
            sel = px[lab == k]
            if len(sel):
                cent[k] = sel.mean(0)
    snapped = []
    for c in cent:
        u = used[((used.astype(float) - c) ** 2).sum(1).argmin()]
        snapped.append(tuple(int(v) for v in u))
    sheet = np.array(Image.open(SHEET).convert('RGBA')).reshape(-1, 4)
    sheet_set = {tuple(int(v) for v in p[:3]) for p in sheet[sheet[:, 3] == 255]}
    colors = []
    for c in base + snapped:
        if c not in colors:
            assert c in sheet_set, f'{c} 가 공용 시트에 없다'
            colors.append(c)
    groups = {}
    for c in colors:
        groups.setdefault(_hue_name(c), []).append(c)
    ordered = []
    for g in sorted(groups):
        for c in sorted(groups[g], key=dot.lum):
            ordered.append((g, c))
    assert len(ordered) <= len(CHARS), len(ordered)
    legend = {}
    ramps = {}
    for ch, (g, c) in zip(CHARS, ordered):
        hexc = '#%02x%02x%02x' % c
        legend[ch] = hexc
        ramps.setdefault(g, []).append(ch)
    out = {'note': '자동 생성 — massing.py palette. 손으로 고치지 말 것. 글자 하나 = 색 하나, 램프 안은 어두운 → 밝은 순. '
                   '색은 모두 공용 버들항 시트(beodeul-city-chipset.png)에 있는 실제 화소다.',
           'sources': {'fantasyKingdom': len(base), 'beodeulKits': PALETTE_KITS, 'clusters': EXTRA},
           'legend': legend, 'ramps': ramps, 'transparent': '.'}
    os.makedirs(DATA, exist_ok=True)
    json.dump(out, open(os.path.join(DATA, 'palette.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 견본
    rows = list(ramps.items())
    im = Image.new('RGBA', (16 * 24 + 90, 18 * len(rows)), (40, 40, 44, 255))
    d = ImageDraw.Draw(im)
    for j, (g, chs) in enumerate(rows):
        d.text((2, j * 18 + 3), g, fill=(230, 230, 230, 255))
        for i, ch in enumerate(chs):
            x = 90 + i * 16
            d.rectangle((x, j * 18, x + 14, j * 18 + 14), fill=dot.hx(legend[ch]) + (255,))
            d.text((x + 3, j * 18 + 2), ch if dot.lum(dot.hx(legend[ch])) < 140 else ch,
                   fill=(255, 255, 255, 255) if dot.lum(dot.hx(legend[ch])) < 120 else (0, 0, 0, 255))
    im.save(os.path.join(DATA, 'palette.png'))
    print(f'팔레트 {len(legend)}색 → {os.path.relpath(os.path.join(DATA, "palette.json"), REPO)}')
    return 0


def palette():
    p = json.load(open(os.path.join(DATA, 'palette.json'), encoding='utf-8'))
    return {ch: dot.hx(h) for ch, h in p['legend'].items()}


# ---------------------------------------------------------------- art
def ids():
    return sorted(f[:-4] for f in os.listdir(ART) if f.endswith('.txt')) if os.path.isdir(ART) else []


def load(bid):
    rows = open(os.path.join(ART, f'{bid}.txt'), encoding='utf-8').read().rstrip('\n').split('\n')
    meta = json.load(open(os.path.join(ART, f'{bid}.json'), encoding='utf-8'))
    return rows, meta


def image(rows, pal=None):
    pal = pal or palette()
    h, w = len(rows), max(len(r) for r in rows)
    a = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            if ch not in pal:
                raise KeyError(f'팔레트에 없는 글자 {ch!r} (행 {y} 열 {x})')
            a[y, x, :3] = pal[ch]
            a[y, x, 3] = 255
    return Image.fromarray(a, 'RGBA')


def entrance(meta):
    cells = [(x, y) for y, r in enumerate(meta['walk']) for x, ch in enumerate(r) if ch == 'D']
    xs = sorted({x for x, _ in cells})
    ys = sorted({y for _, y in cells})
    return dict(x=xs[0] * T, y=ys[0] * T, w=len(xs) * T, h=len(ys) * T)


def check(bid, quiet=False):
    """기계 검사 — 깨짐만 거른다(통과는 합격이 아니다)."""
    fails, warns = [], []
    try:
        rows, meta = load(bid)
    except Exception as e:  # noqa: BLE001
        return [f'읽기 실패: {e}'], []
    pal = palette()
    w = len(rows[0]) if rows else 0
    if any(len(r) != w for r in rows):
        fails.append('행 길이가 다르다')
        return fails, warns
    h = len(rows)
    if w % T or h % T:
        fails.append(f'크기 {w}×{h} 가 16 의 배수가 아니다')
        return fails, warns
    bad = sorted({ch for r in rows for ch in r if ch != '.' and ch not in pal})
    if bad:
        fails.append(f'팔레트 밖 글자 {bad[:10]}')
        return fails, warns
    for k in ('id', 'name', 'massing', 'walk', 'material'):
        if k not in meta:
            fails.append(f'json 에 {k} 가 없다')
    if fails:
        return fails, warns
    if meta['id'] != bid:
        fails.append('json id ≠ 파일 이름')
    cw, chh = w // T, h // T
    walk = meta['walk']
    if len(walk) != chh or any(len(r) != cw for r in walk) or any(ch not in WALK for r in walk for ch in r):
        fails.append(f'walk 는 {cw}×{chh} 칸, 글자 X D * . 만')
        return fails, warns
    a = np.array(image(rows, pal))
    alpha = a[..., 3] > 0
    for cy in range(chh):
        for cx in range(cw):
            op = alpha[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T].any()
            ch = walk[cy][cx]
            if op and ch == '.':
                fails.append(f'칸 ({cx},{cy}) 에 그림이 있는데 walk 가 .')
            if not op and ch != '.':
                fails.append(f'칸 ({cx},{cy}) 이 비었는데 walk 가 {ch}')
    doors = [(x, y) for y, r in enumerate(walk) for x, ch in enumerate(r) if ch == 'D']
    if not doors:
        fails.append('문 칸 D 가 없다')
    else:
        xs = {x for x, _ in doors}
        ys = sorted({y for _, y in doors})
        if len(xs) != 1 or len(doors) != len(ys) or ys != list(range(ys[0], ys[-1] + 1)) or len(ys) > 2:
            fails.append(f'문은 한 열에 세로로 1~2칸 하나뿐이어야 한다: {doors}')
        elif ys[-1] != chh - 1:
            fails.append('문 아랫칸이 그림 맨 아래 칸 줄이 아니다(문 앞 칸이 키트 밖 땅이어야 한다)')
    passages = set(tuple(p) for p in meta.get('passages', []))
    for cx in range(cw):
        ys = [cy for cy in range(chh) if walk[cy][cx] != '.']
        if ys and walk[max(ys)][cx] not in 'XD' and (cx, max(ys)) not in passages:
            fails.append(f'열 {cx} 의 땅 닿는 칸 ({cx},{max(ys)}) 이 막힘이 아니다(통로면 passages 에 적는다)')
    if not alpha[h - 1].any():
        fails.append('맨 아래 화소 줄이 비었다 — 건물이 칸 경계에 닿아야 한다')
    for cx in range(cw):
        col = alpha[:, cx * T:(cx + 1) * T]
        if col.any():
            last = np.where(col.any(1))[0].max()
            if walk[chh - 1][cx] != '.' and last != h - 1:
                fails.append(f'열 {cx}: 땅 칸이 있는데 그림이 맨 아래 줄까지 안 닿는다')
    # 먹 윤곽: 투명과 맞닿은 테두리 화소 중 밝기 ≤ 0.12 인 비율
    lum = (a[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])) / 255
    edge = alpha & ~(np.pad(alpha, 1)[2:, 1:-1] & np.pad(alpha, 1)[:-2, 1:-1] & np.pad(alpha, 1)[1:-1, 2:] & np.pad(alpha, 1)[1:-1, :-2])
    if edge.sum():
        dark = (edge & (lum <= DARK_OUTLINE)).sum() / edge.sum()
        if dark > 0.15:
            fails.append(f'먹 윤곽 {dark:.0%} — 바깥 테두리는 재질의 어두운 단으로')
        elif dark > 0.05:
            warns.append(f'어두운 테두리 {dark:.0%}')
    # 한 색 넓은 면(평평한 채움) 경고
    vals, cnt = np.unique(a[alpha][:, :3], axis=0, return_counts=True)
    top = cnt.max() / alpha.sum()
    if top > 0.22:
        warns.append(f'한 색이 {top:.0%} — 면이 평평할 수 있다')
    if len(vals) < 18:
        warns.append(f'색 {len(vals)}개뿐')
    if not quiet:
        print(f'  {"FAIL" if fails else "ok  "} {bid:22} {cw}×{chh}칸 색 {len(vals)}' + ''.join(f'\n      ✗ {f}' for f in fails) + ''.join(f'\n      ! {x}' for x in warns))
    return fails, warns


def png_path(bid):
    return os.path.join(RUNS, 'png', f'{bid}.png')


def write_png(bid):
    rows, _ = load(bid)
    os.makedirs(os.path.dirname(png_path(bid)), exist_ok=True)
    image(rows).save(png_path(bid))
    return sha_png(png_path(bid))


def pixel_sha(bid):
    rows, _ = load(bid)
    a = np.array(image(rows))
    return hashlib.sha256(a.tobytes()).hexdigest()


# ---------------------------------------------------------------- previews
def _on_grass(im, pad=8):
    bg = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), GRASS)
    bg.alpha_composite(im, (pad, pad))
    return bg


def _label(im, text):
    out = Image.new('RGBA', (max(im.width, 8 * len(text)), im.height + 14), (28, 28, 32, 255))
    out.alpha_composite(im, (0, 14))
    ImageDraw.Draw(out).text((2, 1), text, fill=(240, 230, 120, 255))
    return out


def _row(ims, gap=12):
    w = sum(i.width for i in ims) + gap * (len(ims) - 1)
    h = max(i.height for i in ims)
    out = Image.new('RGBA', (w, h), (28, 28, 32, 255))
    x = 0
    for i in ims:
        out.alpha_composite(i, (x, h - i.height))
        x += i.width + gap
    return out


def beodeul_ref(kid):
    import beodeul
    return beodeul.kit(kid).img()


def refs_for(meta):
    return meta.get('refs') or ['bd-house-inn', 'bd-house-h124_0']


def render(bid):
    rows, meta = load(bid)
    im = image(rows)
    os.makedirs(os.path.join(RUNS, 'preview'), exist_ok=True)
    base = os.path.join(RUNS, 'preview', bid)
    im.save(base + '-1x.png')
    big = _on_grass(im.resize((im.width * 4, im.height * 4), Image.NEAREST), 16)
    big.save(base + '-4x.png')
    parts = []
    mref = os.path.join(REFS, f'{meta["massing"]}.png')
    if os.path.exists(mref):
        m = Image.open(mref).convert('RGBA')
        s = (im.height * 3) / m.height
        parts.append(_label(m.resize((max(1, int(m.width * s)), im.height * 3), Image.NEAREST), f'massing {meta["massing"]}'))
    parts.append(_label(_on_grass(im.resize((im.width * 3, im.height * 3), Image.NEAREST)), f'new {bid} 3x'))
    for k in refs_for(meta)[:2]:
        r = beodeul_ref(k)
        parts.append(_label(_on_grass(r.resize((r.width * 3, r.height * 3), Image.NEAREST)), f'beodeul {k} 3x'))
    _row(parts).save(base + '-cmp.png')
    one = [_label(_on_grass(im), '1x new')] + [_label(_on_grass(beodeul_ref(k)), '1x ' + k) for k in refs_for(meta)[:2]]
    _row(one).save(base + '-1x-cmp.png')
    return base


def board(bid):
    """검수판: 1배(잔디 위) + 4배 + 같은 4배 버들항 기준 둘. 덩어리 모형은 넣지 않는다(검수는 그림만 본다)."""
    rows, meta = load(bid)
    im = image(rows)
    os.makedirs(os.path.join(RUNS, 'boards'), exist_ok=True)
    one = _row([_label(_on_grass(im), 'candidate 1x')] + [_label(_on_grass(beodeul_ref(k)), f'Beodeul reference 1x ({k})') for k in refs_for(meta)[:2]])
    four = _row([_label(_on_grass(im.resize((im.width * 4, im.height * 4), Image.NEAREST)), 'candidate 4x')] +
                [_label(_on_grass(beodeul_ref(k).resize((beodeul_ref(k).width * 4, beodeul_ref(k).height * 4), Image.NEAREST)), f'Beodeul 4x ({k})') for k in refs_for(meta)[:1]])
    p1 = os.path.join(RUNS, 'boards', f'{bid}-1x.png')
    p4 = os.path.join(RUNS, 'boards', f'{bid}-4x.png')
    one.save(p1)
    four.save(p4)
    return p1, p4


# ---------------------------------------------------------------- reviews / decisions
VERDICT = re.compile(r'^\s*VERDICT:\s*(PASS|FAIL)\b', re.M)


def review_state(bid, sha):
    """reviews/<id>/<sha12>-<검수자>.md 의 원문에서 VERDICT 줄을 읽는다(감독이 쓰지 않는다 — 검수자 원문 그대로 저장)."""
    out = {}
    d = os.path.join(REVIEWS, bid)
    if not os.path.isdir(d):
        return out
    for f in sorted(os.listdir(d)):
        if not f.startswith(sha[:12] + '-') or not f.endswith('.md'):
            continue
        who = f[len(sha[:12]) + 1:-3]
        m = VERDICT.findall(open(os.path.join(d, f), encoding='utf-8').read())
        out[who] = (m[-1] if m else 'NONE', os.path.relpath(os.path.join(d, f), REPO))
    return out


REVIEWERS = ('argon', 'klb-sonnet-5-5')


def gate_state(png):
    """object-gate 영수증(kind structure) — 판정 결과를 읽기만 한다."""
    sys.path.insert(0, os.path.join(REPO, 'src', 'harnesses', '_core'))
    import object_gate as og
    try:
        st = og.status(png, kind='structure') if hasattr(og, 'status') else None
    except Exception as e:  # noqa: BLE001
        st = f'err {e}'
    return st


def status():
    rows = []
    for bid in ids():
        f, w = check(bid, quiet=True)
        sha = pixel_sha(bid) if not f else '-'
        rv = review_state(bid, sha) if not f else {}
        rows.append((bid, 'FAIL' if f else 'ok', sha[:12], {k: v[0] for k, v in rv.items()}))
    for r in rows:
        print(f'  {r[0]:22} {r[1]:4} {r[2]:12} {r[3]}')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog='building-kit massing')
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('palette')
    for c in ('check', 'render', 'boards'):
        p = sub.add_parser(c)
        p.add_argument('ids', nargs='*')
    sub.add_parser('status')
    a = ap.parse_args(argv)
    if a.cmd == 'palette':
        return build_palette()
    if a.cmd == 'status':
        return status()
    todo = a.ids or ids()
    bad = 0
    for bid in todo:
        if a.cmd == 'check':
            f, _ = check(bid)
            bad += bool(f)
        elif a.cmd == 'render':
            print(render(bid) + '-cmp.png')
        elif a.cmd == 'boards':
            print(*board(bid))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
