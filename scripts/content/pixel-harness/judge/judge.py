#!/usr/bin/env python3
"""도트 품질 하네스 — 블라인드 눈 심판 판 만들기·집계.

그리는 쪽과 분리된 심판(새 서브에이전트)에게 줄 판 이미지를 만들고, 심판이 돌려준 JSON 을 비밀 열쇠와 맞춰 집계한다.
REFMAP 그림·크롭은 작업 폴더(기본 ~/.local/share/oprn/pixel-harness/judge)에만 쓴다. 저장소에는 좌표·코드만.

하위 명령 (저장소 루트에서):
  sources   우리 그림(new32·v5)과 REFMAP 크롭(원본·32px 축소 대조군)을 작업 폴더에 뽑는다
  pairs     sources 목록에서 식별 판용 짝 목록(JSON)을 만든다
  identify  질문 A 판: 좌우 무작위로 우리 것 | REFMAP, 같은 화면 크기(same-screen) 또는 같은 배율(same-factor)
  defects   질문 B 판: 우리 그림 확대 + 원본 화소 좌표 눈금
  prefer    취향 교정 판: 두 그림 중 어느 쪽이 나은가 (정답 = 사용자 판정)
  aggregate 판 열쇠 + 심판 결과 → 식별률·일치율·결함 목록

자세한 입력·출력 계약: tiledata/pixel-harness/judge.md
"""
import argparse, json, os, random, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
WORK = os.path.expanduser('~/.local/share/oprn/pixel-harness/judge')
BG = (58, 54, 60, 255)          # 판 속 바탕(두 쪽 같게)
PLATE_BG = (24, 24, 28, 255)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
DEFECT_TYPES = ['banding', 'pillow_shading', 'orphan_pixel', 'jaggy_line', 'perspective', 'proportion', 'material_texture', 'color', 'other']


def font(n):
    try: return ImageFont.truetype(FONT, n)
    except OSError: return ImageFont.load_default()


def load_kinds():
    return json.load(open(os.path.join(HERE, 'kinds.json')))


def on_bg(im, bg=BG):
    b = Image.new('RGBA', im.size, bg); b.alpha_composite(im.convert('RGBA')); return b


def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)


def jdump(obj, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    json.dump(obj, open(path, 'w'), ensure_ascii=False, indent=1)


# ------------------------------------------------------------------ sources
def refmap_crop(K, kind):
    spec = K['kinds'][kind]['refmap']
    path = os.path.join(os.path.expanduser(K['refmapRoot']), K['sheets'][spec['sheet']])
    im = Image.open(path).convert('RGBA').crop(tuple(spec['box']))
    if 'tile' in spec:                                   # 바닥 한 칸을 가로 n × 세로 m 로 깐다
        tx, ty = spec['tile']; t = Image.new('RGBA', (im.width * tx, im.height * ty))
        for j in range(ty):
            for i in range(tx): t.paste(im, (i * im.width, j * im.height))
        im = t
    return im


def ours_new32(K):
    sys.path.insert(0, os.path.join(ROOT, 'tiledata/hand-interior/refmap-study'))
    import propsr, roomr
    P = propsr.all_props(); base = roomr.render(); out = {}
    for kind, spec in K['kinds'].items():
        s = spec['ours'].get('new32')
        if not s: continue
        if 'prop' in s: out[kind] = P[s['prop']].im
        else:
            x0, y0, x1, y1 = s['room']; out[kind] = base.crop((x0 * 32, y0 * 32, x1 * 32, y1 * 32))
    return out, base


def ours_v5(K):
    sys.path.insert(0, os.path.join(ROOT, 'tiledata/hand-interior/refmap-study'))
    import roomr
    R0 = roomr._paths(); cwd = os.getcwd(); os.chdir(R0)
    try:
        from rooms4 import o, T
        import room4
        base = room4.compose(dict(key='judge', plan=roomr.PLAN, floor='plank', wall='plaster', items=[],
                                  zones=[(roomr.KITCHEN[0], 0, roomr.KITCHEN[1], len(roomr.PLAN) - 2, 'flag', 'stone')]), 0)
        out = {}
        for kind, spec in K['kinds'].items():
            s = spec['ours'].get('v5')
            if not s: continue
            if 'obj' in s: out[kind] = (T('dining', 2, 2) if s['obj'] == 'dining 2x2' else o(s['obj'])).im
            else:
                x0, y0, x1, y1 = s['room']; out[kind] = base.crop((x0 * 16, y0 * 16, x1 * 16, y1 * 16))
        return out, base
    finally: os.chdir(cwd)


def put_on_floor(obj, floor_im, ref_size, tile):
    """REFMAP 맵 크롭과 같은 칸 비율의 바닥 캔버스에 우리 물체를 가운데·아래 여백 약간으로 얹는다."""
    w = round(ref_size[0] * tile / 48); h = round(ref_size[1] * tile / 48)
    c = Image.new('RGBA', (w, h))
    for y in range(0, h, floor_im.height):
        for x in range(0, w, floor_im.width): c.paste(floor_im, (x, y))
    c.alpha_composite(obj, ((w - obj.width) // 2, max(0, (h - obj.height) // 2)))
    return c


def cmd_sources(a):
    K = load_kinds(); W = a.work; idx = {}
    n32, _ = ours_new32(K); v5, _ = ours_v5(K)
    for kind, spec in K['kinds'].items():
        ref = refmap_crop(K, kind)
        d = idx.setdefault(kind, {'ko': spec['ko']})
        p = f'{W}/src/refmap/{kind}.png'; os.makedirs(os.path.dirname(p), exist_ok=True); ref.save(p); d['refmap'] = dict(png=p, tile=48)
        small = ref.resize((round(ref.width * 32 / 48), round(ref.height * 32 / 48)), Image.LANCZOS)
        p = f'{W}/src/refmap32/{kind}.png'; os.makedirs(os.path.dirname(p), exist_ok=True); small.save(p); d['refmap32'] = dict(png=p, tile=32)
        for name, src, tile in (('new32', n32, 32), ('v5', v5, 16)):
            if kind not in src: continue
            im = src[kind].convert('RGBA'); fl = spec['ours'][name].get('onFloor')
            if fl: im = put_on_floor(im, src[fl], ref.size, tile)
            p = f'{W}/src/{name}/{kind}.png'; os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p)
            d[name] = dict(png=p, tile=tile)
    jdump(idx, f'{W}/src/index.json'); print(f'{W}/src/index.json', len(idx), 'kinds')


def cmd_pairs(a):
    K = load_kinds(); idx = json.load(open(f'{a.work}/src/index.json'))
    kinds = K['core'] if a.kinds == 'core' else K['extra'] if a.kinds == 'extra' else K['core'] + K['extra'] if a.kinds == 'all' else a.kinds.split(',')
    tag = '' if a.ref == 'refmap' else f'@{a.ref}'
    if a.ours_dir:                                        # 새 그림 폴더: <dir>/<kind>.png (예: 48px 새 판). 없는 종류는 건너뛴다
        for k in kinds:
            p = os.path.join(a.ours_dir, f'{k}.png')
            if os.path.exists(p): idx[k][a.variant] = dict(png=os.path.abspath(p), tile=a.tile)
    out = [dict(id=f'{k}:{a.variant}{tag}', kind=k, variant=a.variant + tag, ours=idx[k][a.variant], ref=idx[k][a.ref]) for k in kinds if a.variant in idx[k]]
    jdump(out, a.out); print(a.out, len(out))


# ------------------------------------------------------------------ plates
def side_by_side(A, B, labels=('A', 'B'), gap=56, margin=28):
    """두 판을 같은 크기 틀에 아래 맞춤으로 놓고 위에 A/B 글자."""
    fw = max(A.width, B.width); fh = max(A.height, B.height); lab = 44
    P = Image.new('RGBA', (margin * 2 + fw * 2 + gap, margin * 2 + lab + fh), PLATE_BG)
    d = ImageDraw.Draw(P); f = font(30)
    for i, (im, L) in enumerate(((A, labels[0]), (B, labels[1]))):
        x0 = margin + i * (fw + gap); y0 = margin + lab
        d.rectangle([x0, y0, x0 + fw - 1, y0 + fh - 1], fill=BG)
        P.alpha_composite(im, (x0 + (fw - im.width) // 2, y0 + fh - im.height))
        d.text((x0 + fw // 2 - 10, margin), L, font=f, fill=(235, 235, 235, 255))
    return P


def scale_for(tile, mode, cell, factor):
    if mode == 'same-screen': return max(1, cell // tile)
    return factor


def cmd_identify(a):
    pairs = json.load(open(a.pairs)); rng = random.Random(a.seed)
    flip = json.load(open(a.flip_from)) if a.flip_from else None
    os.makedirs(a.out, exist_ok=True); key = dict(kind='identify', mode=a.mode, cell=a.cell, factor=a.factor, seed=a.seed, plates={})
    order = list(range(len(pairs))); rng.shuffle(order)
    for n, i in enumerate(order, 1):
        pr = pairs[i]; name = f'p{n:02d}'
        so = scale_for(pr['ours']['tile'], a.mode, a.cell, a.factor); sr = scale_for(pr['ref']['tile'], a.mode, a.cell, a.factor)
        O = up(on_bg(Image.open(pr['ours']['png'])), so); R = up(on_bg(Image.open(pr['ref']['png'])), sr)
        if flip: ours_side = 'B' if flip['byId'][pr['id']] == 'A' else 'A'
        else: ours_side = rng.choice('AB')
        P = side_by_side(*((O, R) if ours_side == 'A' else (R, O)))
        P.convert('RGB').save(f'{a.out}/{name}.png')
        key['plates'][name] = dict(id=pr['id'], kind=pr.get('kind'), variant=pr.get('variant'), ours=ours_side, scaleOurs=so, scaleRef=sr)
    key['byId'] = {v['id']: v['ours'] for v in key['plates'].values()}
    jdump(key, a.out.rstrip('/') + '.key.json')
    print(a.out, len(pairs), 'plates; key →', a.out.rstrip('/') + '.key.json')


def grid_panel(im, z, step=8, minor=4):
    """확대 그림 + 원본 화소 좌표 눈금(위·왼쪽 숫자, step 마다 선)."""
    big = up(on_bg(im), z); pad = 34
    P = Image.new('RGBA', (big.width + pad + 6, big.height + pad + 6), PLATE_BG)
    P.alpha_composite(big, (pad, pad)); d = ImageDraw.Draw(P); f = font(11)
    for x in range(0, im.width + 1, minor):
        X = pad + x * z; strong = x % step == 0
        d.line([(X, pad - (8 if strong else 4)), (X, pad + big.height)], fill=(255, 255, 255, 70 if strong else 28))
        if strong: d.text((X - 6, 4), str(x), font=f, fill=(250, 220, 90, 255))
    for y in range(0, im.height + 1, minor):
        Y = pad + y * z; strong = y % step == 0
        d.line([(pad - (8 if strong else 4), Y), (pad + big.width, Y)], fill=(255, 255, 255, 70 if strong else 28))
        if strong: d.text((2, Y - 6), str(y), font=f, fill=(250, 220, 90, 255))
    return P


def cmd_defects(a):
    items = json.load(open(a.items)); rng = random.Random(a.seed)
    os.makedirs(a.out, exist_ok=True); key = dict(kind='defects', seed=a.seed, plates={})
    order = list(range(len(items))); rng.shuffle(order)
    for n, i in enumerate(order, 1):
        it = items[i]; name = f'd{n:02d}'; im = Image.open(it['png']).convert('RGBA')
        z = a.zoom or max(2, 256 // it['tile'])
        clean = up(on_bg(im), z); g = grid_panel(im, z)
        W = clean.width + g.width + 60; H = max(clean.height + 34, g.height) + 40
        P = Image.new('RGBA', (W, H), PLATE_BG); d = ImageDraw.Draw(P); f = font(14)
        d.text((20, 8), f'{im.width}x{im.height} px, x{z}', font=f, fill=(200, 200, 200, 255))
        P.alpha_composite(clean, (20, 40 + 34)); P.alpha_composite(g, (clean.width + 40, 40))
        P.convert('RGB').save(f'{a.out}/{name}.png')
        key['plates'][name] = dict(id=it['id'], kind=it.get('kind'), variant=it.get('variant'), png=it['png'], size=[im.width, im.height], zoom=z)
    jdump(key, a.out.rstrip('/') + '.key.json'); print(a.out, len(items), 'defect plates')


def cmd_prefer(a):
    pairs = json.load(open(a.pairs)); rng = random.Random(a.seed)
    flip = json.load(open(a.flip_from)) if a.flip_from else None
    os.makedirs(a.out, exist_ok=True); key = dict(kind='prefer', seed=a.seed, plates={})
    order = list(range(len(pairs))); rng.shuffle(order)
    for n, i in enumerate(order, 1):
        pr = pairs[i]; name = f'c{n:02d}'
        ims = []
        for s in ('x', 'y'):
            im = Image.open(pr[s]['png']).convert('RGBA')
            if pr[s].get('box'): im = im.crop(tuple(pr[s]['box']))
            ims.append(up(on_bg(im), pr[s].get('scale', a.scale)))
        if flip: x_side = 'B' if flip['plates_by_id'][pr['id']] == 'A' else 'A'
        else: x_side = rng.choice('AB')
        P = side_by_side(*(ims if x_side == 'A' else ims[::-1]))
        P.convert('RGB').save(f'{a.out}/{name}.png')
        truth = pr['better']                                  # 'x' | 'y' : 사용자 판정에서 나은 쪽
        key['plates'][name] = dict(id=pr['id'], group=pr.get('group'), x=pr['x'].get('label'), y=pr['y'].get('label'), xSide=x_side,
                                   truthSide=x_side if truth == 'x' else ('B' if x_side == 'A' else 'A'), truthNote=pr.get('note'))
    key['plates_by_id'] = {v['id']: v['xSide'] for v in key['plates'].values()}
    jdump(key, a.out.rstrip('/') + '.key.json'); print(a.out, len(pairs), 'prefer plates')


# ------------------------------------------------------------------ aggregate
def load_run(run):
    key = json.load(open(run.rstrip('/') + '.key.json')); res = json.load(open(run.rstrip('/') + '.result.json'))
    ans = {x['plate']: x for x in res['answers']}
    missing = [p for p in key['plates'] if p not in ans]
    if missing: print('WARN', run, 'missing answers', missing, file=sys.stderr)
    return key, ans


def cmd_aggregate(a):
    rows = {}; out = dict(runs=a.run, kind=None, items={})
    for run in a.run:
        key, ans = load_run(run); out['kind'] = key['kind']
        for p, k in key['plates'].items():
            if p not in ans: continue
            r = ans[p]; it = out['items'].setdefault(k['id'], dict(id=k['id'], kind=k.get('kind'), variant=k.get('variant'), group=k.get('group'), votes=[]))
            if key['kind'] == 'identify':
                picked_ref = r['commercial'] != k['ours']      # 우리 것이 아닌 쪽을 상용이라 고르면 = 우리 그림이 골라내짐
                it['votes'].append(dict(run=os.path.basename(run), mode=key['mode'], oursSide=k['ours'], identified=picked_ref,
                                        confidence=r.get('confidence'), cues=r.get('cues', [])))
            elif key['kind'] == 'prefer':
                it['votes'].append(dict(run=os.path.basename(run), agree=r['better'] == k['truthSide'], confidence=r.get('confidence'),
                                        reason=r.get('reason', ''), x=k['x'], y=k['y'], truthNote=k.get('truthNote')))
            elif key['kind'] == 'defects':
                it['votes'].append(dict(run=os.path.basename(run), size=k['size'], defects=r.get('defects', []), overall=r.get('overall')))
    for it in out['items'].values():
        v = it['votes']
        if out['kind'] == 'identify':
            it['n'] = len(v); it['identRate'] = round(sum(x['identified'] for x in v) / len(v), 3) if v else None
            it['meanConf'] = round(sum(x['confidence'] or 0 for x in v) / len(v), 3) if v else None
            # 확신 점수: 맞히면 +확신, 틀리면 -확신. +1 = 늘 확신 있게 골라냄, 0 = 우연, -1 = 늘 우리 것을 상용으로 착각
            it['confScore'] = round(sum((x['confidence'] or 0.5) * (1 if x['identified'] else -1) for x in v) / len(v), 3) if v else None
            it['leftBias'] = sum((x['identified'] and x['oursSide'] == 'B') or (not x['identified'] and x['oursSide'] == 'A') for x in v)
        elif out['kind'] == 'prefer':
            it['n'] = len(v); it['agreeRate'] = round(sum(x['agree'] for x in v) / len(v), 3) if v else None
        elif out['kind'] == 'defects':
            it['n'] = len(v); it['defectCount'] = [len(x['defects']) for x in v]
            types = {}
            for x in v:
                for dft in x['defects']: types[dft.get('type')] = types.get(dft.get('type'), 0) + 1
            it['types'] = types
    if out['kind'] == 'identify':
        V = [x for it in out['items'].values() for x in it['votes']]
        out['overall'] = dict(n=len(V), identRate=round(sum(x['identified'] for x in V) / max(1, len(V)), 3),
                              pickedA=sum((x['identified'] and x['oursSide'] == 'B') or (not x['identified'] and x['oursSide'] == 'A') for x in V))
    if out['kind'] == 'prefer':
        V = [x for it in out['items'].values() for x in it['votes']]
        out['overall'] = dict(n=len(V), agreeRate=round(sum(x['agree'] for x in V) / max(1, len(V)), 3))
    jdump(out, a.out); print(a.out)
    for it in out['items'].values():
        print(it['id'], {k: it[k] for k in it if k not in ('votes', 'id')})
    if 'overall' in out: print('overall', out['overall'])


def cmd_prompt(a):
    """판 폴더 → 심판 프롬프트 글. 판 목록·결과 경로만 넣는다(열쇠 경로·변형 이름은 넣지 않는다)."""
    key = json.load(open(a.run.rstrip('/') + '.key.json'))
    tname = a.template or {'identify': 'identify.md', 'defects': 'defects.md', 'prefer': 'prefer.md'}[key['kind']]
    tpl = open(os.path.join(HERE, 'prompts', tname)).read()
    plates = '\n'.join(f'- {os.path.join(os.path.abspath(a.run), p)}.png' for p in sorted(key['plates']))
    txt = tpl.replace('{{PLATES}}', plates).replace('{{RESULT}}', os.path.abspath(a.run).rstrip('/') + '.result.json').replace('{{JUDGE}}', a.judge or os.path.basename(a.run.rstrip('/')))
    if a.out: open(a.out, 'w').write(txt)
    print(txt)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    s = sp.add_parser('sources'); s.add_argument('--work', default=WORK); s.set_defaults(f=cmd_sources)
    s = sp.add_parser('pairs'); s.add_argument('--work', default=WORK); s.add_argument('--variant', required=True, help='new32 | v5 | refmap32(대조군)')
    s.add_argument('--kinds', default='core', help='core | extra | all | 쉼표 목록'); s.add_argument('--out', required=True)
    s.add_argument('--ref', default='refmap', help='refmap(원본 48px) | refmap32(같은 32px 격자로 줄인 REFMAP)')
    s.add_argument('--ours-dir', help='우리 그림 폴더(<kind>.png). 주면 --variant 는 이름표로만 쓴다'); s.add_argument('--tile', type=int, default=48, help='--ours-dir 그림의 칸 크기')
    s.set_defaults(f=cmd_pairs)
    s = sp.add_parser('identify'); s.add_argument('--pairs', required=True); s.add_argument('--mode', choices=['same-screen', 'same-factor'], required=True)
    s.add_argument('--cell', type=int, default=192, help='same-screen: 한 칸이 화면에서 차지할 px (32px→×6, 48px→×4, 16px→×12)')
    s.add_argument('--factor', type=int, default=4, help='same-factor: 모두 이 배율'); s.add_argument('--seed', type=int, default=1)
    s.add_argument('--flip-from', help='이 열쇠의 좌우를 모두 뒤집은 판(같은 순서 씨앗은 --seed 로 따로)'); s.add_argument('--out', required=True); s.set_defaults(f=cmd_identify)
    s = sp.add_parser('defects'); s.add_argument('--items', required=True, help='[{id,png,tile,kind?,variant?}]'); s.add_argument('--zoom', type=int, default=0, help='0 = 256/tile (32px→×8, 16px→×16). ×4 는 비전 모델에게 너무 작다')
    s.add_argument('--seed', type=int, default=1); s.add_argument('--out', required=True); s.set_defaults(f=cmd_defects)
    s = sp.add_parser('prefer'); s.add_argument('--pairs', required=True, help='[{id,group,x:{png,box?,scale?,label},y:{...},better:x|y,note}]')
    s.add_argument('--scale', type=int, default=3); s.add_argument('--seed', type=int, default=1); s.add_argument('--flip-from'); s.add_argument('--out', required=True); s.set_defaults(f=cmd_prefer)
    s = sp.add_parser('aggregate'); s.add_argument('--run', action='append', required=True, help='판 폴더(옆에 .key.json · .result.json)'); s.add_argument('--out', required=True); s.set_defaults(f=cmd_aggregate)
    s = sp.add_parser('prompt'); s.add_argument('--run', required=True); s.add_argument('--judge'); s.add_argument('--out')
    s.add_argument('--template', help='prompts/ 안 파일 이름 (예: prefer-v2.md, defects-v2.md)'); s.set_defaults(f=cmd_prompt)
    a = ap.parse_args(); a.f(a)


if __name__ == '__main__':
    main()
