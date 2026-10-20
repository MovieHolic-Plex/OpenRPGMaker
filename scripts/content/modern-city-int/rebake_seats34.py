#!/usr/bin/env python3
"""앉는 기물 3/4·품질 다시 그림(seats34.py, 2026-10-20) — 사양에 적힌 칸 번호에 제자리로 굽는다(번호·통행·사양 불변).

  python3 scripts/content/modern-city-int/rebake_seats34.py --check [id ...]   # 관문 영수증 상태 + 바뀔 칸 수만(시트·pins 그대로)
  python3 scripts/content/modern-city-int/rebake_seats34.py [id ...]           # 관문 pass 인 것만 시트에 덮어쓰고 pins/baked 키를 갈아 끼운다

id 를 주지 않으면 seats34.DRAW 전부를 보되, PENDING(동·서·북향 — 관문 규칙상 사람 승인 전 자동 통과 없음)은 늘 뺀다.
관문: 그림마다 object-gate 영수증(kind seat, 화소 해시)을 읽어 verdict pass 이고 refusal(context bundle) 이 없는 것만 굽는다 —
refer/fail/영수증 없음은 건너뛰고 이유를 적는다(기준을 낮추지 않는다).
bake_interior.py 는 칸 번호를 내용 해시로 정해 끝에 덧붙이고 4096px assert 에서 멈추므로 쓰지 않는다(rebake_wood_seat.py 와 같은 길)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
import numpy as np                     # noqa: E402
from PIL import Image                  # noqa: E402
import seats34 as S                    # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
SPEC = os.path.join(ROOT, 'src/assets/modernCityRoomSpec.json')
PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
OWN = os.path.join(ROOT, 'tiledata/modern-city/interior/baked.json')
TPR = 48


def image(spec, id_):
    """사양 칸 범위 캔버스 그림(RGBA) · 맨 위 줄 dy. 칸 밖에 칠한 화소가 있으면 멈춘다(잃어버릴 화소)."""
    cells = spec['objects'][id_]['cells']
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; y0 = min(ys)
    w, h = (max(xs) + 1) * 16, (max(ys) - y0 + 1) * 16
    a = S.DRAW[id_](w, h)
    m = np.zeros((h, w), bool)
    for dx, dy, _t, _l in cells: m[(dy - y0) * 16:(dy - y0) * 16 + 16, dx * 16:dx * 16 + 16] = True
    assert not ((a[:, :, 3] > 0) & ~m).any(), (id_, '등록 안 된 칸에 칠함')
    return a, y0


def gate_state(a):
    import object_gate as OG
    img = Image.fromarray(a, 'RGBA')
    r = OG.read_receipt(OG.pixel_sha256(img))
    if not r: return '영수증 없음'
    if r.get('kind') != 'seat': return '영수증 종류 %s' % r.get('kind')
    if r.get('verdict') != 'pass': return '%s: %s' % (r.get('verdict'), ' · '.join(r.get('reasons') or [])[:160])
    why = OG.refusal(img, kind='seat', context='bundle')
    return 'pass' if why is None else '거절: ' + why


def main():
    import bake_lib as BL
    from mkit import PALETTE
    spec = json.load(open(SPEC, encoding='utf-8'))
    check = '--check' in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or list(S.DRAW)
    work = []
    for id_ in ids:
        if id_ in S.PENDING: print('  %-22s 보류(동·서·북향 — 사람 승인 전 굽지 않음)' % id_); continue
        a, y0 = image(spec, id_)
        if getattr(S.DRAW[id_], 'mpx', False):
            off = {tuple(p) for p in a[a[:, :, 3] == 255][:, :3].tolist()} - set(PALETTE)
            assert not off, (id_, '팔레트 밖 색', sorted(off)[:6])
        st = gate_state(a)
        print('  %-22s 관문 %s' % (id_, st))
        if st != 'pass': continue
        for dx, dy, t, _l in spec['objects'][id_]['cells']:
            work.append((t, a[(dy - y0) * 16:(dy - y0) * 16 + 16, dx * 16:dx * 16 + 16], '%s(%d,%d)' % (id_, dx, dy)))
    assert len({t for t, _a, _n in work}) == len(work), '같은 칸을 두 번 그린다'
    sheet = Image.open(PNG).convert('RGBA')
    pins = json.load(open(PINS, encoding='utf-8')); own = json.load(open(OWN, encoding='utf-8'))
    by_tid = {}
    for k, v in pins['cells'].items(): by_tid.setdefault(v, []).append(k)
    blank = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    changed = rekeyed = 0
    for t, a, n in work:
        xy = ((t % TPR) * 16, (t // TPR) * 16)
        old = BL.norm(sheet.crop((*xy, xy[0] + 16, xy[1] + 16))); new = BL.norm(Image.fromarray(np.ascontiguousarray(a), 'RGBA'))
        if old.tobytes() == new.tobytes(): continue
        changed += 1
        for k in by_tid.get(t, []):
            pc = next((p for p in BL.PC if BL.Sheet.key_of(old, p) == k), None)
            if pc is None: continue
            nk = BL.Sheet.key_of(new, pc)
            assert nk not in pins['cells'] or pins['cells'][nk] == t, ('새 그림이 다른 칸과 같다', n)
            del pins['cells'][k]; pins['cells'][nk] = t
            if k in own['cells']: del own['cells'][k]; own['cells'][nk] = t
            rekeyed += 1
        sheet.paste(blank, xy); sheet.paste(new, xy)
    if not check and changed:
        sheet.save(PNG, optimize=True)
        open(PINS, 'w', encoding='utf-8').write(json.dumps(pins, ensure_ascii=False, separators=(',', ':')) + '\n')
        own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
        open(OWN, 'w', encoding='utf-8').write(json.dumps(own, ensure_ascii=False, indent=0) + '\n')
    print(('would change' if check else 'changed'), changed, 'tiles ·', rekeyed, 'pin keys')


if __name__ == '__main__':
    main()
