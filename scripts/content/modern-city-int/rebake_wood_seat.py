#!/usr/bin/env python3
"""나무 바닥 A안(2026-10-20) — 같은 칸 번호에 제자리로 다시 굽는다(번호·통행·사양 불변, 저장 맵은 새 그림을 그대로 받는다).

  python3 scripts/content/modern-city-int/rebake_wood_seat.py export [--seats]   # 관문에 낼 그림 + items.jsonl (tiledata/modern-city/interior/_gate_r15/)
  python3 scripts/content/modern-city-int/rebake_wood_seat.py --check [--seats]  # 바뀔 칸 수만(시트·pins 그대로)
  python3 scripts/content/modern-city-int/rebake_wood_seat.py [--seats]          # 관문 영수증 확인 → 시트 덮어쓰기 → pins/baked 키 갈아 끼우기

bake_interior.py 는 칸 번호를 «그림 내용 해시»로 정하므로 다시 칠한 칸을 끝에 덧붙인다(옛 맵은 옛 그림으로 남고, 시트가 이미 4096px 를 넘어
그 assert 에서 멈춘다). 그래서 r10/rebake_inplace.py 처럼 사양(modernCityRoomSpec.json)에 적힌 칸 번호에 그대로 붙여 넣고,
tiledata/modern-city/pins.json · interior/baked.json 의 옛 내용 해시 키를 새 키로 바꿔 적어 다음 굽기가 같은 번호를 다시 찾게 한다.

3/4 관문: 그림마다 object-gate 영수증(화소 해시)을 읽는다 — 바닥 주기 그림 kind terrain, 앉는 기물 kind seat.
pass 만 굽는다. 판정 프로필이 보정 전이면 «임시통과(provisional)» 로 세어 보고한다(bake_interior.gate 와 같은 규칙). 없거나 불합격이면 멈춘다.

--seats: 앉는 기물 다시 그림(art_seat.py, 같은 칸)도 함께. 2026-10-20 관문 2회차에서 11장 중 통과 0(보류 2) — 옆·뒤를 보는 의자는
규칙상 자동 통과가 없어(rules.ts HUMAN_DEFINED_SEAT_FACINGS) 이 길은 사람 승인 경로가 생길 때까지 막힌다. 기본 굽기는 바닥만이다."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
import numpy as np                     # noqa: E402
from PIL import Image                  # noqa: E402
import pieces                          # noqa: E402
import art_seat as A                   # noqa: E402
from mkit import PALETTE               # noqa: E402
from mpx import C                      # noqa: E402

PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
SPEC = os.path.join(ROOT, 'src/assets/modernCityRoomSpec.json')
PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
OWN = os.path.join(ROOT, 'tiledata/modern-city/interior/baked.json')
GATE_OUT = os.path.join(ROOT, 'tiledata/modern-city/interior/_gate_r15')
TPR = 48

FLOORS = ('mci-wood-oak', 'mci-wood-dark')
# 앉는 기물(--seats): id → 그림 함수. 등록 조각(pieces.R)은 예전 그림 그대로다 — 굽힌 적 없는 다시 그림.
SEATS = {
    'mci-chair-wood-s': A.chair_wood_s, 'mci-chair-wood-n': A.chair_wood_n, 'mci-chair-wood-e': A.chair_wood_e, 'mci-chair-wood-w': A.chair_wood_w,
    'mci-chair-office-s': A.chair_office_s, 'mci-chair-office-n': A.chair_office_n, 'mci-chair-office-e': A.chair_office_e, 'mci-chair-office-w': A.chair_office_w,
    'mci-cafe-chair-e': A.cafe_chair_e, 'mci-cafe-chair-w': A.cafe_chair_w, 'mci-bench-metal': A.bench_metal,
}
WITH_SEATS = '--seats' in sys.argv


def seat_image(spec, id_):
    """사양 칸 범위만 한 캔버스(가로 = 칸 수, 세로 = 위로 솟는 줄 + 발밑 줄) → (RGBA 배열, 맨 위 줄 dy)."""
    cells = spec['objects'][id_]['cells']
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    c = C((max(xs) + 1) * 16, (max(ys) - min(ys) + 1) * 16)
    SEATS[id_](c)
    return c.rgba(), min(ys)


def tiles(spec):
    """[(칸 번호, 16×16 RGBA, 이름)] — 이번에 다시 그리는 칸 전부."""
    R = pieces.R; out = []
    for fid in FLOORS:
        fd = spec['floors'][fid]; i = 0
        for y in range(fd['rows']):
            for x in range(fd['cols']):
                for sh in range(4):
                    out.append((fd['tiles'][i], R.floor_cell(fid, x, y, sh), '%s.%d.%d.%d' % (fid, x, y, sh))); i += 1
    for id_ in (SEATS if WITH_SEATS else ()):
        a, y0 = seat_image(spec, id_)
        for dx, dy, t, _layer in spec['objects'][id_]['cells']:
            out.append((t, a[(dy - y0) * 16:(dy - y0) * 16 + 16, dx * 16:dx * 16 + 16], '%s(%d,%d)' % (id_, dx, dy)))
    return out


def gate_images(spec):
    """[(그림 RGBA, kind, 이름, 표식)] — 바닥은 주기 그림 하나(gate_export 와 같음), 기물은 칸 범위 그림 하나."""
    R = pieces.R
    out = [(R.floor_period(f), 'terrain', R.floors[f]['ko'], 'modern_city/interior/' + f) for f in FLOORS]
    for id_ in (SEATS if WITH_SEATS else ()):
        out.append((seat_image(spec, id_)[0], 'seat', spec['objects'][id_].get('ko', id_), 'modern_city/interior/' + id_))
    return out


def export(spec):
    os.makedirs(GATE_OUT, exist_ok=True)
    for f in os.listdir(GATE_OUT):
        if f.endswith('.png'): os.remove(os.path.join(GATE_OUT, f))
    rows = []
    for a, kind, name, label in gate_images(spec):
        p = os.path.join(GATE_OUT, label.split('/')[-1] + '.png'); Image.fromarray(a, 'RGBA').save(p)
        rows.append(dict(png=os.path.basename(p), kind=kind, name=name, label=label))   # judge 는 batch 파일 자리 기준으로 읽는다
    with open(os.path.join(GATE_OUT, 'items.jsonl'), 'w') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('export', len(rows), os.path.relpath(GATE_OUT, ROOT))


def gate(spec):
    import object_gate as OG
    rep = {}; blocked = []
    for a, kind, _name, label in gate_images(spec):
        img = Image.fromarray(a, 'RGBA')
        r = OG.read_receipt(OG.pixel_sha256(img))
        if not r: s = '영수증 없음'
        elif r.get('kind') != kind: s = '영수증 종류 %s != %s' % (r.get('kind'), kind)
        elif r.get('verdict') != 'pass': s = '불합격 ' + ' · '.join(r.get('reasons') or [])
        else:
            why = OG.refusal(img, kind=kind, context='bundle')
            s = 'pass' if why is None else 'prov' if '보정되지 않았다' in why else why
        rep[s if s in ('pass', 'prov') else 'blocked'] = rep.get(s if s in ('pass', 'prov') else 'blocked', 0) + 1
        if s not in ('pass', 'prov'): blocked.append((label, s))
    return rep, blocked


def main():
    import bake_lib as BL
    spec = json.load(open(SPEC, encoding='utf-8'))
    if 'export' in sys.argv: return export(spec)
    check = '--check' in sys.argv
    work = tiles(spec)
    off = sorted({tuple(p) for _t, a, _n in work for p in a[a[:, :, 3] == 255][:, :3].tolist() if tuple(p) not in PALETTE})
    assert not off, ('팔레트 밖 색', off[:8])
    assert len({t for t, _a, _n in work}) == len(work), '같은 칸을 두 번 그린다'
    if not check:
        rep, blocked = gate(spec)
        print('관문', rep, '(prov = 미보정 프로필 임시통과)')
        if blocked: sys.exit('3/4 관문 미통과 %d:\n' % len(blocked) + '\n'.join('  %s: %s' % b for b in blocked))
    sheet = Image.open(PNG).convert('RGBA')
    pins = json.load(open(PINS, encoding='utf-8')); own = json.load(open(OWN, encoding='utf-8'))
    by_tid = {}
    for k, v in pins['cells'].items(): by_tid.setdefault(v, []).append(k)
    blank = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    changed = rekeyed = 0
    for t, a, _n in work:
        xy = ((t % TPR) * 16, (t // TPR) * 16)
        old = BL.norm(sheet.crop((*xy, xy[0] + 16, xy[1] + 16))); new = BL.norm(Image.fromarray(np.ascontiguousarray(a), 'RGBA'))
        if old.tobytes() == new.tobytes(): continue
        changed += 1
        for k in by_tid.get(t, []):
            pc = next((p for p in BL.PC if BL.Sheet.key_of(old, p) == k), None)
            if pc is None: continue                    # 이 칸 내용으로 만든 키가 아니다(옛 그림의 키) — 손대지 않는다
            nk = BL.Sheet.key_of(new, pc)
            assert nk not in pins['cells'] or pins['cells'][nk] == t, ('새 그림이 다른 칸과 같다', _n)
            del pins['cells'][k]; pins['cells'][nk] = t
            if k in own['cells']: del own['cells'][k]; own['cells'][nk] = t
            rekeyed += 1
        sheet.paste(blank, xy); sheet.paste(new, xy)
    if not check:
        sheet.save(PNG, optimize=True)
        open(PINS, 'w', encoding='utf-8').write(json.dumps(pins, ensure_ascii=False, separators=(',', ':')) + '\n')
        own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
        open(OWN, 'w', encoding='utf-8').write(json.dumps(own, ensure_ascii=False, indent=0) + '\n')
    print(('would change' if check else 'changed'), changed, 'tiles ·', rekeyed, 'pin keys')


if __name__ == '__main__':
    main()
