"""조선 칩셋 게이트.  python3 harness/gate.py [--sheets]

FAIL(통과 못 하면 시트·지도 굽기 금지):
  P  팔레트: 불투명 화소가 잠긴 허용 색(palette.json) 밖
  E  외곽선: 가장자리/안쪽 밝기비가 버들항 p5 미만(어두운 바깥 링)
  T  가는 줄: 폭 1px 화소 비율이 버들항 p95 의 2배+0.02 초과(thin_ok 조각 제외)
  L  빛: 왼쪽 반이 오른쪽 반보다 어두움(버들항 p5 미만), front_only 제외
  S  그림자: 반투명 그림자 무게중심이 본체보다 위
  A  적대 리뷰: 독립 리뷰어 두 렌즈(culture 조선다움·view 3/4)가 현재 해시에 둘 다 keep 이어야 함(ADVERSARIAL.md)
  K  조립: built 조각은 blocks.house 블록 조립(pieces_meta 의 kit)이어야 함
  V  판정: harness/verdicts.json 에 이 조각의 현재 그림에 대한 3/4 판정 줄이 없음(그림이 바뀌면 다시 써야 함)
WARN: 결(grain) 부족, built 조각의 좌우 비대칭(0.08 초과, sym:true).
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import tk
from metrics import metrics
import catalog
import adversarial

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
CAL = json.load(open(os.path.join(HERE, 'calibration.json')))['band']
META = json.load(open(os.path.join(HERE, 'pieces_meta.json')))
VERD_PATH = os.path.join(HERE, 'verdicts.json')
OBJ = os.path.join(ROOT, 'tiledata/beodeul-city/render/objects')
OUTDIR = os.path.join(ROOT, 'tiledata/joseon-demo/review')


def piece_hash(cv):
    return hashlib.sha1(cv.a.tobytes()).hexdigest()[:12]


def palette_report(arr):
    op = arr[arr[:, :, 3] == 255][:, :3]
    bad = {}
    for c, k in zip(*np.unique(op.reshape(-1, 3), axis=0, return_counts=True)):
        t = tuple(int(v) for v in c)
        if t not in tk.ALLOWED:
            bad[t] = int(k)
    return bad


def run(skip_a=False):
    tk.VIOLATIONS.clear()
    objs = catalog.objects()
    terr = catalog.terrain()
    try:
        verd = json.load(open(VERD_PATH))
    except FileNotFoundError:
        verd = {}
    rows, fails, warns = [], 0, 0
    # 지형: 팔레트만
    for name, tl in terr.items():
        bad = {}
        for c in tl:
            for k, v in palette_report(c.a).items():
                bad[k] = bad.get(k, 0) + v
        status = 'FAIL P' if bad else 'ok'
        if bad: fails += 1
        rows.append((name, 'terrain', status, f'{sum(bad.values())}px/{len(bad)}색 밖' if bad else ''))
    for name, cv in objs.items():
        m = metrics(cv.a)
        meta = META.get(name, {})
        why = []
        w = []
        bad = palette_report(cv.a)
        if bad: why.append(f'P {len(bad)}색 {sum(bad.values())}px 밖')
        if m:
            if m['edge_ratio'] < CAL['edge_ratio']['p5']:
                why.append(f"E 외곽선 밝기비 {m['edge_ratio']:.2f} < {CAL['edge_ratio']['p5']:.2f}")
            lim = CAL['thin_ratio']['p95'] * 2 + 0.02
            if m['thin_ratio'] > lim and not meta.get('thin_ok'):
                why.append(f"T 가는줄 {m['thin_ratio']:.3f} > {lim:.3f}")
            if not meta.get('front_only') and m['light_lr'] < CAL['light_lr']['p5']:
                why.append(f"L 빛 {m['light_lr']:+.2f} < {CAL['light_lr']['p5']:+.2f}")
            if m['shadow_dy'] is not None and m['shadow_dy'] < 0:
                why.append(f"S 그림자 위쪽 {m['shadow_dy']:+.1f}")
            if m['grain'] is not None and m['grain'] < CAL['grain']['p5']:
                w.append(f"결 {m['grain']:.1f} < {CAL['grain']['p5']:.1f}")
            if meta.get('sym') and m['asym'] > 0.08:
                w.append(f"비대칭 {m['asym']:.2f}")
        if not skip_a:
            _ok, _why = adversarial.check(name, cv)
            if not _ok: why.append(_why)
        if meta.get('cls') == 'built' and not meta.get('kit'):
            why.append('K 건물은 블록 조립(blocks.house)이어야 함 — 통그림 금지')
        h = piece_hash(cv)
        v = verd.get(name)
        if not v or v.get('hash') != h:
            why.append('V 판정 없음' if not v else 'V 그림이 바뀜(판정 다시)')
        elif v.get('status') == 'redo':
            why.append('V 판정=다시: ' + v.get('line', ''))
        elif v.get('status') == 'user':
            w.append('사용자 판정 대기(윗면 안 보이는 정면 소품)')
        status = 'FAIL ' + '; '.join(why) if why else ('WARN ' + '; '.join(w) if w else 'ok')
        if why: fails += 1
        elif w: warns += 1
        rows.append((name, meta.get('cls', '?'), status, '' if not m else
                     f"edge {m['edge_ratio']:.2f} lr {m['light_lr']:+.2f} thin {m['thin_ratio']:.3f} grain {m['grain'] if m['grain'] is None else round(m['grain'],1)} asym {m['asym']:.2f}"))
    return rows, fails, warns, objs


def ref_image(name, idx=0):
    items = json.load(open(os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_objects.json')))
    hs, seen = [], set()
    for it in sorted([i for i in items if i['name'] == name], key=lambda i: -(i['w'] * i['h'])):
        if it['hash'] not in seen:
            seen.add(it['hash']); hs.append(it['hash'])
    if not hs:
        return None
    return Image.open(os.path.join(OBJ, hs[min(idx, len(hs) - 1)] + '.png')).convert('RGBA')


def sheets(objs):
    """조각마다 [내 조각 | 버들항 기준 조각 ×3] 을 같은 배율(3배)로. 한 장씩 만들어 눈으로 본다."""
    os.makedirs(OUTDIR, exist_ok=True)
    out = []
    for name, cv in objs.items():
        refs = META[name]['refs']
        ims = [('JOSEON ' + name, cv.img())]
        used = {}
        for r in refs:
            k = used.get(r, 0); used[r] = k + 1
            im = ref_image(r, k)
            if im: ims.append((r, im))
        sc = 3
        H = max(i.height for _, i in ims) * sc + 18
        W = sum(i.width * sc + 12 for _, i in ims) + 12
        sheet = Image.new('RGBA', (W, H), (88, 160, 53, 255))
        d = ImageDraw.Draw(sheet)
        x = 12
        for label, im in ims:
            big = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
            sheet.alpha_composite(big, (x, H - big.height))
            d.text((x, 2), label, fill=(255, 255, 255, 255))
            x += big.width + 12
        p = os.path.join(OUTDIR, name + '.png')
        sheet.convert('RGB').save(p)
        out.append(p)
    return out


if __name__ == '__main__':
    rows, fails, warns, objs = run()
    w = max(len(r[0]) for r in rows)
    for n, c, st, info in rows:
        print(f'{n:{w}s} {c:8s} {st}' + (f'   [{info}]' if info else ''))
    print(f'\nFAIL {fails} / WARN {warns} / 전체 {len(rows)}')
    if '--sheets' in sys.argv:
        print('\n'.join(sheets(objs)))
    sys.exit(1 if fails else 0)
