"""조선 실내 조각의 메타·통행 보정을 pieces_meta.json·piece-walk-overrides.json 에 멱등으로 합친다(맨 끝에 덧붙임, 다른 키는 건드리지 않는다).

    python3 in_register.py          # 실제로 쓴다
    python3 in_register.py --check  # 달라질 것이 있으면 종료 코드 1
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import in_meta
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
META = os.path.join(HERE, 'harness', 'pieces_meta.json')
OVR = os.path.join(ROOT, 'tiledata', 'joseon-village', 'piece-walk-overrides.json')


def merge():
    meta, walk = in_meta.meta_and_walk()
    pm = json.load(open(META))
    ov = json.load(open(OVR))
    ch = 0
    for k, v in meta.items():
        if pm.get(k) != v:
            pm[k] = v; ch += 1
    for k, v in walk.items():
        if ov['pieces'].get(k) != v:
            ov['pieces'][k] = v; ch += 1
    for k, v in in_meta.TERRAIN.items():
        if ov['terrain'].get(k) != v:
            ov['terrain'][k] = v; ch += 1
    import palace                                     # 궁 내부 키트(pal_) — 같은 방식으로 합친다
    pmeta, pwalk, pter = palace.meta_and_walk()
    for k, v in pmeta.items():
        if pm.get(k) != v:
            pm[k] = v; ch += 1
    for k, v in pwalk.items():
        if ov['pieces'].get(k) != v:
            ov['pieces'][k] = v; ch += 1
    for k, v in pter.items():
        if ov['terrain'].get(k) != v:
            ov['terrain'][k] = v; ch += 1
    return pm, ov, ch


if __name__ == '__main__':
    pm, ov, ch = merge()
    print('변경', ch)
    if '--check' in sys.argv:
        sys.exit(1 if ch else 0)
    json.dump(pm, open(META, 'w'), ensure_ascii=False, indent=1)
    json.dump(ov, open(OVR, 'w'), ensure_ascii=False, indent=1)
