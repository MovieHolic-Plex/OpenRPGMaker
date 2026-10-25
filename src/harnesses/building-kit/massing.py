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


def _og():
    sys.path.insert(0, os.path.join(REPO, 'src', 'harnesses', '_core'))
    import object_gate
    return object_gate


def pixel_sha(bid):
    """object-gate 와 같은 화소 해시(영수증·위임 허용·검수 원문이 모두 이 해시에 묶인다)."""
    rows, _ = load(bid)
    return _og().pixel_sha256(image(rows))


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


def state(bid):
    f, w = check(bid, quiet=True)
    if f:
        return {'id': bid, 'check': 'FAIL', 'fails': f}
    rows, meta = load(bid)
    img = image(rows)
    og = _og()
    sha = og.pixel_sha256(img)
    rc = og.read_receipt(sha)
    held = og.read_hold_decision(sha)
    rv = review_state(bid, sha)
    return {'id': bid, 'check': 'ok', 'warns': w, 'sha': sha, 'size': [img.width // T, img.height // T],
            'gate': (rc or {}).get('verdict'), 'gateKind': (rc or {}).get('kind'), 'gateReasons': (rc or {}).get('reasons'),
            'gateProfile': (rc or {}).get('profileHash'),
            'held': og.human_decision(held, rc) if rc else None,
            'exit': og.refusal(img, kind='structure', context='bundle'),
            'reviews': {k: v[0] for k, v in rv.items()}, 'reviewFiles': {k: v[1] for k, v in rv.items()},
            'massing': meta['massing'], 'name': meta['name']}


def status(as_json=False):
    out = [state(b) for b in ids()]
    if as_json:
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return 0
    for r in out:
        if r['check'] != 'ok':
            print(f"  {r['id']:22} check FAIL {r['fails'][:2]}")
            continue
        print(f"  {r['id']:22} {r['sha'][:12]} gate={r['gate']} held={r['held']} reviews={r['reviews']} exit={'통과' if not r['exit'] else '막힘'}")
    return 0


def gate_batch(path, only=None):
    """object-gate review --batch 입력(줄마다 {png,kind,name,label}) — 지금 그림을 PNG 로 쓰고 목록을 만든다."""
    lines = []
    for bid in (only or ids()):
        f, _ = check(bid, quiet=True)
        if f:
            continue
        write_png(bid)
        _, meta = load(bid)
        lines.append(json.dumps({'png': png_path(bid), 'kind': 'structure', 'name': meta['name'],
                                 'label': f'building-kit/massing/{bid}', 'chipset': 'beodeul_city'}, ensure_ascii=False))
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(f'{len(lines)}채 → {path}')
    return 0


def _blocked(meta):
    return [[x, y] for y, r in enumerate(meta['walk']) for x, ch in enumerate(r) if ch in 'XD']


def publish():
    """check 통과 건물을 설치 입력으로 낸다: seed.json candidates + tiledata/beodeul-massing/sources/<id>.png.
    설치(install.py --profile building-kit-massing)는 decisions.json 의 허용만 넣는다 — publish 는 허용이 아니다."""
    seed = json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))
    src = os.path.join(REPO, 'tiledata', 'beodeul-massing', 'sources')
    os.makedirs(src, exist_ok=True)
    cands = []
    for bid in ids():
        f, _ = check(bid, quiet=True)
        if f:
            print(f'  건너뜀 {bid}: check FAIL')
            continue
        rows, meta = load(bid)
        img = image(rows)
        img.save(os.path.join(src, f'{bid}.png'))
        cands.append({'id': bid, 'name': meta['name'], 'role': meta.get('role', meta['name']), 'width': img.width, 'height': img.height,
                      'entrance': entrance(meta), 'material': 'log' if meta['material'] == 'log' else meta['material'],
                      'blocked': _blocked(meta), 'passages': meta.get('passages', []), 'round': 1,
                      'source': f'building-kit/massing (bk-massing-100 {meta["massing"]})', 'massing': meta['massing'],
                      'perspective': '3/4 탑뷰 · 지붕 윗면과 남쪽 정면', 'lighting': '왼쪽 위'})
    seed['candidates'] = cands
    json.dump(seed, open(os.path.join(DATA, 'seed.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'후보 {len(cands)}채 → seed.json candidates · {os.path.relpath(src, REPO)}/')
    return 0


DELEGATED_BY = 'user 2026-10-25 (bk-massing-100 → 실제 건물, 머지까지 위임)'


def decide():
    """위임 허용: 지금 그림 해시에 (1) object-gate 영수증 kind structure 가 pass 이고 (2) 서명된 허용 기록이 있고
    (3) 검수자 둘(REVIEWERS)의 원문이 VERDICT: PASS 일 때만 decisions.json 에 allow 를 덧붙인다. 아니면 적지 않는다.
    감독이 판정을 쓰지 않는다 — 여기 들어가는 근거는 모두 다른 판정자의 원문 파일이다."""
    path = os.path.join(DATA, 'decisions.json')
    log = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {'schema': 'oprn-building-decisions/1', 'log': []}
    last = {}
    for r in log['log']:
        last[(r['item'], r['sha'])] = r
    seq = max([r['seq'] for r in log['log']], default=0)
    src = os.path.join(REPO, 'tiledata', 'beodeul-massing', 'sources')
    added = 0
    for bid in ids():
        st = state(bid)
        if st['check'] != 'ok':
            continue
        why = []
        if st['gate'] != 'pass' and st['held'] != 'allow':
            why.append(f'object-gate {st["gate"]}')
        if st['exit']:
            why.append('object-gate 출구 막힘')
        for who in REVIEWERS:
            if st['reviews'].get(who) != 'PASS':
                why.append(f'{who} {st["reviews"].get(who, "없음")}')
        if why:
            print(f'  보류 {bid:22} {", ".join(why)}')
            continue
        png = os.path.join(src, f'{bid}.png')
        if not os.path.exists(png) or _og().pixel_sha256(Image.open(png)) != st['sha']:
            print(f'  보류 {bid:22} publish 를 먼저(소스 PNG 가 지금 그림과 다르다)')
            continue
        fsha = sha_png(png)
        if (bid, fsha) in last and last[(bid, fsha)]['decision'] == 'allow':
            continue
        seq += 1
        rc_path = os.path.relpath(os.path.join(str(_og().GATE_DATA), 'receipts', st['sha'][:2], st['sha'] + '.json'), REPO)
        log['log'].append({'seq': seq, 'item': bid, 'sha': fsha, 'pixelSha256': st['sha'], 'decision': 'allow', 'by': 'delegated',
                           'delegatedBy': DELEGATED_BY, 'evidence': [rc_path] + [st['reviewFiles'][w] for w in REVIEWERS],
                           'note': 'object-gate pass/허용 + 독립 검수 둘 PASS(원문 파일)', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')})
        added += 1
        print(f'  허용 {bid}')
    log['exportedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    log['counts'] = {'allow': sum(1 for r in log['log'] if r['decision'] == 'allow')}
    json.dump(log, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'위임 허용 {added}채 덧붙임 → {os.path.relpath(path, REPO)}')
    return 0


def evidence():
    """object-gate 영수증 pass + 검수자 둘 PASS 인 그림마다 근거 묶음 파일을 쓰고, 위임 허용에 넘길 목록을 찍는다.
    허용 자체는 18323 검토 서버(/api/decide, delegatedBy + evidence)가 서명해 기록한다 — 이 함수는 기록하지 않는다."""
    out = []
    for bid in ids():
        st = state(bid)
        if st['check'] != 'ok' or st['gate'] != 'pass' or any(st['reviews'].get(w) != 'PASS' for w in REVIEWERS):
            continue
        og = _og()
        ev = {'schema': 'oprn-building-kit-massing-evidence/1', 'id': bid, 'pixelSha256': st['sha'], 'kind': 'structure',
              'objectGate': {'receipt': os.path.join(str(og.GATE_DATA), 'receipts', st['sha'][:2], st['sha'] + '.json'),
                             'verdict': st['gate'], 'profile': st['gateProfile'], 'profileCalibrated': False},
              'reviews': {w: {'verdict': st['reviews'][w], 'file': st['reviewFiles'][w]} for w in REVIEWERS},
              'delegatedBy': DELEGATED_BY}
        path = os.path.join(REVIEWS, bid, f'{st["sha"][:12]}-evidence.json')
        json.dump(ev, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        out.append({'id': bid, 'sha': st['sha'], 'kind': 'structure', 'evidence': path, 'held': st['held']})
    print(json.dumps(out, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------- independent review packs
REVIEW_PROMPT = """You are an adversarial visual QA reviewer for 16px pixel-art RPG buildings. You did not draw these and you are not on the
artist's side: your job is to find reasons each candidate must be REJECTED. Never pass something you are unsure about.

Each candidate has two boards (open both with Read):
  <code>-1x.png  candidate at 1x on grass, next to two shipped "Beodeul port" reference buildings at 1x (same game, the quality bar)
  <code>-4x.png  candidate at 4x next to one Beodeul reference at 4x

Judge each candidate on:
 A. 3/4 top-down view (required): the roof's upper surface is visible as a real surface (not a thin strip = flat front elevation);
    only the south facade is visible — no isometric side faces, no sideways perspective; cylinders show a curved front + a cone/parapet
    seen from above; parapets/crenellations show their walkable top; wings/towers read as ONE building with no ground between parts.
 B. Structural integrity: no transparent gaps/holes through the building, no floating or cut-off parts, the building stands on the
    ground (bottom edge meets the ground), exactly one door, nothing garbled/unreadable.
 C. Style match with the Beodeul references at the same scale: material shading in several steps, outline in the material's dark tone
    (not black ink), textured surfaces (roof tiles varying, plaster stipple, stone courses), no large flat single-colour fills, no
    obvious 16px stamp repetition, colours harmonise with the references. It should look like it belongs in the same game.

For EACH candidate write a file <OUT_DIR>/<code>.md containing: a few lines of observations for A, B, C, a list "MAJOR:" of blocking
defects (or "MAJOR: none"), and as the LAST line exactly "VERDICT: PASS" or "VERDICT: FAIL". FAIL if any MAJOR defect exists.
Write the files yourself with the Write tool; do not edit any other file. Finally reply with one line per code: "<code> PASS|FAIL".
"""


def _decoy(img):
    """숨긴 함정: 건물을 가로로 3px 투명 띠로 끊는다(B 결함). 판정자가 이것을 통과시키면 그 묶음은 무효다."""
    a = np.array(img)
    ys = np.where(a[..., 3].any(1))[0]
    mid = int(ys.min() + (ys.max() - ys.min()) * 0.48)
    a[mid:mid + 3, :, 3] = 0
    a[mid:mid + 3, :, :3] = 0
    return Image.fromarray(a, 'RGBA')


def review_pack(batch, bids, decoy_from=None):
    import random as _r  # 묶음 안 순서 섞기용(그림이 아니다)
    root = os.path.join(RUNS, 'review', batch)
    os.makedirs(os.path.join(root, 'boards'), exist_ok=True)
    os.makedirs(os.path.join(root, 'out'), exist_ok=True)
    entries = []
    for bid in bids:
        f, _ = check(bid, quiet=True)
        if f:
            raise SystemExit(f'{bid}: check FAIL — 검수에 내지 않는다')
        entries.append(('real', bid))
    entries.append(('decoy', decoy_from or bids[0]))
    rng = _r.Random(hashlib.sha256(batch.encode()).hexdigest())
    rng.shuffle(entries)
    key = {}
    for n, (kind, bid) in enumerate(entries, 1):
        code = f'c{n:02d}'
        rows, meta = load(bid)
        img = image(rows)
        sha = _og().pixel_sha256(img)
        if kind == 'decoy':
            img = _decoy(img)
        one = _row([_label(_on_grass(img), 'candidate 1x')] + [_label(_on_grass(beodeul_ref(k)), f'Beodeul 1x') for k in refs_for(meta)[:2]])
        r0 = beodeul_ref(refs_for(meta)[0])
        four = _row([_label(_on_grass(img.resize((img.width * 4, img.height * 4), Image.NEAREST)), 'candidate 4x'),
                     _label(_on_grass(r0.resize((r0.width * 4, r0.height * 4), Image.NEAREST)), 'Beodeul 4x')])
        one.save(os.path.join(root, 'boards', f'{code}-1x.png'))
        four.save(os.path.join(root, 'boards', f'{code}-4x.png'))
        key[code] = {'kind': kind, 'id': bid, 'sha': sha}
    json.dump(key, open(os.path.join(root, 'key.json'), 'w'), indent=1)
    codes = sorted(key)
    prompt = (REVIEW_PROMPT.replace('<OUT_DIR>', os.path.join(root, 'out', '<REVIEWER>'))
              + f"\nBoards folder: {os.path.join(root, 'boards')}\nCandidates: {', '.join(codes)}\n")
    open(os.path.join(root, 'PROMPT.txt'), 'w').write(prompt)
    print(f'묶음 {batch}: {len(codes)}장(함정 1) → {root}/PROMPT.txt')
    return root


def review_collect(batch, reviewer):
    root = os.path.join(RUNS, 'review', batch)
    key = json.load(open(os.path.join(root, 'key.json')))
    out = os.path.join(root, 'out', reviewer)
    got = {}
    for code, k in key.items():
        p = os.path.join(out, f'{code}.md')
        if not os.path.exists(p):
            got[code] = None
            continue
        m = VERDICT.findall(open(p, encoding='utf-8').read())
        got[code] = m[-1] if m else None
    decoys = [c for c, k in key.items() if k['kind'] == 'decoy']
    if any(got[c] != 'FAIL' for c in decoys):
        print(f'{batch}/{reviewer}: 함정 {decoys} 를 FAIL 로 잡지 못했다({[got[c] for c in decoys]}) — 이 묶음 판정은 무효(기록하지 않음)')
        return 1
    n = 0
    for code, k in key.items():
        if k['kind'] != 'real' or got[code] is None:
            if k['kind'] == 'real':
                print(f'  {code} {k["id"]}: {reviewer} 원문 없음')
            continue
        dst = os.path.join(REVIEWS, k['id'])
        os.makedirs(dst, exist_ok=True)
        raw = open(os.path.join(out, f'{code}.md'), encoding='utf-8').read()
        head = (f'<!-- 검수자 {reviewer} 원문 그대로. 묶음 {batch}, 판 코드 {code}, 그림 화소 해시 {k["sha"]}. '
                f'함정 {decoys} 를 FAIL 로 잡은 유효 회차. 감독은 아래 본문을 고치지 않았다. -->\n')
        open(os.path.join(dst, f'{k["sha"][:12]}-{reviewer}.md'), 'w', encoding='utf-8').write(head + raw)
        n += 1
        print(f'  {k["id"]:22} {reviewer} {got[code]}')
    print(f'{batch}/{reviewer}: 유효 — {n}건 기록')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog='building-kit massing')
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('palette')
    for c in ('check', 'render', 'boards'):
        p = sub.add_parser(c)
        p.add_argument('ids', nargs='*')
    st = sub.add_parser('status')
    st.add_argument('--json', action='store_true')
    gb = sub.add_parser('gate-batch')
    gb.add_argument('out')
    gb.add_argument('ids', nargs='*')
    sub.add_parser('publish')
    sub.add_parser('decide')
    sub.add_parser('evidence')
    rp = sub.add_parser('review-pack')
    rp.add_argument('batch')
    rp.add_argument('ids', nargs='+')
    rp.add_argument('--decoy')
    rc = sub.add_parser('review-collect')
    rc.add_argument('batch')
    rc.add_argument('reviewer')
    a = ap.parse_args(argv)
    if a.cmd == 'review-pack':
        review_pack(a.batch, a.ids, a.decoy)
        return 0
    if a.cmd == 'review-collect':
        return review_collect(a.batch, a.reviewer)
    if a.cmd == 'palette':
        return build_palette()
    if a.cmd == 'status':
        return status(a.json)
    if a.cmd == 'gate-batch':
        return gate_batch(a.out, a.ids)
    if a.cmd == 'publish':
        return publish()
    if a.cmd == 'decide':
        return decide()
    if a.cmd == 'evidence':
        return evidence()
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
