"""조선 궁 조각 보기: python3 pal_show.py <출력.png> [배율] [이름접두 ...] [--ref in_b_이름,v5:id ...]
pal_ 조각(과 접두가 맞는 terrain 첫 변형)을 같은 배율로 늘어놓고, --ref 로 후보 B 조각·v5 기준을 오른쪽에 붙인다."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import inb_preview as PV
import tk


def all_objs():
    import inb_kit as IK, inb_props as IP, inb_props2 as IP2, inb_props3 as IP3, pal_kit as PK
    d = {}
    for m in (IK, IP, IP2, IP3, PK):
        d.update(m.objects())
    import pal_props as PP, pal_props2 as PP2
    for m in (PP, PP2):
        d.update(m.objects())
    return d


if __name__ == '__main__':
    out = sys.argv[1]
    sc = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    rest = sys.argv[3:]
    refs = []
    if '--ref' in rest:
        i = rest.index('--ref'); refs = rest[i + 1].split(','); rest = rest[:i]
    pre = rest or ['pal_']
    objs = all_objs()
    items = [(k, v.img()) for k, v in objs.items() if any(k.startswith(p) for p in pre)]
    import pal_kit as PK
    for k, v in PK.terrain().items():
        if any(k.startswith(p) for p in pre):
            items.append((k + '[0]', v[0].img()))
    for r in refs:
        if r.startswith('v5:'):
            im = PV.v5(r[3:])
            if im is not None: items.append((r, im))
        elif r in objs:
            items.append((r, objs[r].img()))
    PV.sheet(items, out, scale=sc)
    print(len(items), 'pieces; palette violations:', tk.VIOLATIONS)
