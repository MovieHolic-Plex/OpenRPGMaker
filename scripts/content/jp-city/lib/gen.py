"""건물 레시피 생성기 — 기존 띠(band)만으로 폭·층수가 다른 건물을 만든다. 새 칸 0개."""
import random

WALLS = ('kinari', 'shiro', 'conc', 'hodo')
FLOOR_V = {'slide': [0, 1, 2, 3, 4, 5, 6, 7], 'veranda': [0, 1, 2, 3, 4, 5, 6, 7], 'koushi': [0, 1, 2, 3], 'pairs': [0, 1, 2, 3], 'ribbon': [0, 1], 'curtain': [0, 1],
           'balcony': [0, 1, 3, 7, 11, 15], 'tile': [0, 1], 'blank': [0]}
NOWALL = ('tile', 'curtain')
def F(kind, wall='kinari', vs=(0,)): return {'kind': kind, 'wall': wall, 'vs': list(vs)}

def lint_specs(kit, name, spec):
    """창 위에 얹히는 부착물 검사(build.lint_decos 와 같은 규칙, 카탈로그만 사용)."""
    bad = []; n = spec['n']
    for d in spec.get('decos', []):
        fl = d['floor']
        if not isinstance(fl, int): continue
        dn = d['deco']
        if dn.split('.')[0] not in ('sign_h', 'plate', 'sunshade', 'ac', 'laundry', 'wallad', 'mushiko'): continue
        f = spec['floors'][fl]; kind = f['kind']; vs = f.get('vs', [0])
        mw = kit.bands[f"fl.{kind}.{f.get('wall') or 'kinari'}"]['modw']
        D = kit.decos[kit.deco_name(d, fl, len(spec['floors']))]; st = spec.get('setback'); off = (st['ins'] if st and fl < st['upper'] else 0)
        for cc in range(D['w']):
            col = d['col'] + cc - off - 1
            if col < 0 or col >= (n - 2 * off) - 3: continue
            v = vs[(col // mw) % len(vs)]
            if kind == 'blank' or (kind == 'pairs' and (v & 2)): continue
            bad.append((name, fl, dn, d['col'] + cc)); break
    return bad

def _floor(rng, kinds, walls):
    k = rng.choice(kinds); w = rng.choice(walls)
    n_v = rng.randint(1, 4)
    pool = FLOOR_V[k]
    vs = [rng.choice(pool) for _ in range(n_v)]
    if k == 'pairs': vs = [v if rng.random() < .8 else 2 for v in vs]
    return F(k, w if k not in NOWALL else 'kinari', vs)

FAM = {
  'retail':  dict(floors=['curtain', 'ribbon', 'pairs', 'ribbon'], walls=['shiro', 'conc', 'hodo'], grounds=['gr.glass.sora', 'gr.glass.aka', 'gr.glass.kii', 'gr.konbini.0', 'gr.konbini.1'], roofs=['roof.ac.plain', 'roof.ac.tank', 'roof.plain.tank'], head=.55, kvs=['vstack', 'mark']),
  'office':  dict(floors=['ribbon', 'pairs', 'slide', 'ribbon'], walls=['conc', 'shiro', 'hodo'], grounds=['gr.shutter.sora', 'gr.shutter.kii', 'gr.glass.sora', 'gr.glass.kii'], roofs=['roof.plain.tank', 'roof.ac.cyl', 'roof.plain.cyl', 'roof.ac.tank'], head=.15, kvs=['pipe']),
  'mansion': dict(floors=['balcony', 'veranda'], walls=['shiro', 'conc', 'kinari', 'hodo'], grounds=['gr.garage'], roofs=['roof.stair.cyl', 'roof.plain.plain', 'roof.stair.tank', 'roof.plain.tank'], head=0, kvs=['pipe', 'vstack']),
  'izakaya': dict(floors=['balcony', 'pairs', 'tile'], walls=['kinari', 'shiro'], grounds=['gr.izakaya'], roofs=['roof.ac.plain', 'roof.ac.tank', 'roof.plain.tank'], head=.6, kvs=['fe']),
  'bar':     dict(floors=['pairs', 'tile', 'ribbon'], walls=['kinari', 'hodo'], grounds=['gr.izakaya', 'gr.shutter.aka'], roofs=['roof.ac.plain', 'roof.plain.plain'], head=.5, kvs=['fe', 'mark']),
}
HEADS = ['roofsign.aka', 'roofsign.sora', 'roofsign.kii']
MARKS = ['aka', 'sora', 'kii', 'midori']

def gen(kit, fam, n, nf, seed):
    rng = random.Random(seed); F_ = FAM[fam]
    floors = [_floor(rng, F_['floors'], F_['walls']) for _ in range(nf)]
    # 같은 종류가 같은 벽을 연이어 쓰면 읽기 편하므로 벽은 절반 확률로 이전과 같게
    for i in range(1, nf):
        if floors[i]['kind'] not in NOWALL and floors[i - 1]['kind'] not in NOWALL and rng.random() < .6: floors[i]['wall'] = floors[i - 1]['wall']
    ground = rng.choice(F_['grounds'])
    head = rng.choice(HEADS) if (n >= 5 and rng.random() < F_['head']) else None
    spec = dict(n=n, head=head, roof=rng.choice(F_['roofs']), floors=floors, ground=ground)
    dd = kit.cat['doorDefault'][ground]
    wd = kit.decos[f'door.{dd}']['w']
    spec['door'] = (dd, rng.choice([0, n - wd]) if n >= 4 else 0)
    decos = []
    pipe_col = n - 1 if spec['door'][1] != n - wd else 0         # 문 반대편 가장자리 열
    for kv in F_['kvs']:
        for i in range(nf):
            if kv == 'fe' and n >= 5: decos.append(dict(deco='fe', col=min(3, n - 3), floor=i))
            elif kv == 'pipe' and n >= 4: decos.append(dict(deco='pipe', col=pipe_col, floor=i))
    # 소수의 표식(간판 1개 규칙: 글자 간판 없이 색 표식만)
    if 'mark' in F_['kvs'] and nf >= 2 and n >= 5 and rng.random() < .8:
        fl = rng.randrange(nf)
        decos.append(dict(deco=f'plate.mark.{rng.choice(MARKS)}', col=1, floor=fl))
    if 'vstack' in F_['kvs'] and n >= 5:
        c = n - 1; cols = rng.sample(['kii', 'aka', 'sora', 'midori'], 2)
        for i in range(nf):
            if i % 2 == 0: decos.append(dict(deco='vstack.{c}', cols=cols, col=c, floor=i))
    spec['decos'] = decos
    bad = lint_specs(kit, 'g', spec)
    if bad:
        spec['decos'] = [d for d in decos if not any(d['floor'] == b[1] and d['deco'] == b[2] for b in bad)]
    return spec

def machiya(kit, n, seed, two=True, lattice=True):
    """마치야(町家)/나가야 레시피: 기와 지붕 + 처마 + 격자창 + 마치야 1층. n>=5 권장."""
    rng = random.Random(seed)
    nm = max(1, n - 3)
    def ks(): return [rng.choice([0, 0, 1, 2]) for _ in range(nm)]
    floors = [F('koushi', rng.choice(['kinari', 'shiro']), ks())] if two else []
    if two and rng.random() < .4: floors = [F('pairs', 'shiro', [rng.choice([0, 1, 1]) for _ in range(nm)])]
    gv = [rng.choice([4, 5]) for _ in range(max(1, n - 2))]; gv[0] = 0 if n > 4 else 4
    dd = rng.choice(['machiya', 'noren']) if n >= 4 else 'house'
    wd = kit.decos[f'door.{dd}']['w']
    spec = dict(n=n, head=None, roof=rng.choice(['roof.hip.slate', 'roof.hip']), eave='eave.slate', floors=floors, ground='gr.machiya', ground_vs=gv,
                door=(dd, rng.randint(0, max(0, n - wd))), decos=[])
    if rng.random() < .6: spec['decos'].append(dict(deco='inuyarai', col=0 if spec['door'][1] > 0 else n - 1, floor='ground', row=2))
    if two and rng.random() < .5 and n >= 5: spec['decos'].append(dict(deco='mushiko', col=2, floor=0)) if floors[0]['kind'] == 'pairs' and False else None
    return spec

def lowrise(kit, fam, n, seed, nf=None):
    rng = random.Random(seed)
    return gen(kit, fam, n, nf or rng.choice([2, 3, 3, 4]), seed)
