# 녹청 지붕 크림 석조 저택가 (european-quarter-verdigris) — 장소 팩 전용(공용 시트에 굽지 않는다). 다시 돌리면 같은 그림.
#   python3 make_european_quarter_verdigris.py
# 산출: parts/*.png · partmeta.json · parts.md · render-1x/2x.png · grid.json · check-autotile.png
# (전투 배경은 make_battle_bg.py, 비교 시트는 compare_ref.py)
# 그리기: 버들항 파이프라인(city_v6) 칩셋 결(슬레이트 지붕 쌍·자갈·흙·잔디)을 밝기 순위대로 녹청·크림 램프로 옮기고 나머지는 손 도트.
# 장르 규격: tiledata/beodeul-kits/genres/european-streets.md
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import vq_kit as KT
import vq_auto as AU
from vq_base import pad16
from vq_layout import build

GROUPS = {'floor': '맨 바탕 표본', 'autotile': '16변형 오토타일', 'object': '건물·물체', 'tree': '나무', 'decal': '바닥 덧그림(걷기)'}

def export_parts():
    os.makedirs(HERE + '/parts', exist_ok=True)
    for f in os.listdir(HERE + '/parts'):
        if f.endswith('.png') and f[:-4] not in KT.K: os.remove(HERE + '/parts/' + f)
    meta = {}
    lines = ['# 녹청 지붕 저택가 (european-quarter-verdigris) 조각 — 장소 팩 전용', '',
             '버들항 칸 규약(16px, 왼쪽 아래 기준, 3/4 시점). 바닥 표본 3x3(48x48), 오토타일 4x4(칸 번호 = 위 1 + 오른 2 + 아래 4 + 왼 8).',
             '층 규격(유럽풍 장르 공통): 층 높이 32, 창 유리 층 위 기준 y 3..13, 창턱 14..15, 문은 층 위 6 부터 바닥까지.', '']
    for kind, title in GROUPS.items():
        lines += [f'## {title}', '']
        for name, (fn, m) in KT.K.items():
            if m['kind'] != kind: continue
            im = KT.img(name)
            if kind not in ('floor', 'autotile'): im = pad16(im)
            im.save(f'{HERE}/parts/{name}.png')
            meta[name] = m
            lines.append(f"- `parts/{name}.png` ({im.width}x{im.height} px) — {m['ko']}: {m['desc']} / {im.width // 16}x{im.height // 16}칸")
        lines.append('')
    json.dump(meta, open(HERE + '/partmeta.json', 'w'), ensure_ascii=False, indent=1)
    cnt = {k: sum(1 for m in meta.values() if m['kind'] == k) for k in GROUPS}
    lines.append('합계: ' + ' · '.join(f'{GROUPS[k]} {v}' for k, v in cnt.items()) + f' = {len(meta)}종')
    open(HERE + '/parts.md', 'w').write('\n'.join(lines) + '\n')
    return meta

def main():
    meta = export_parts()
    AU.check_sheet(HERE + '/check-autotile.png')
    M = build(); M.render()
    start = M.marks['plaza_west']
    reach = M.bfs(start)
    marks_ok = {k: tuple(v) in reach for k, v in M.marks.items()}
    (emax, ewin), eall = M.emptiness()
    (emax2, ewin2), eall2 = M.emptiness(autos_full=True)
    extra = {'reach_from_plaza_west': marks_ok,
             'empty_floor': {'max_20x15_without_patches': round(float(emax), 3), 'window': list(ewin), 'overall': round(float(eall), 3),
                             'max_20x15_patches_as_empty': round(float(emax2), 3), 'window2': list(ewin2)},
             'paint_order': ['ground-* (맨 바탕 표본)', 'autotile-cobblepath/moss/puddle/slush/hedge (오토타일 덩이)',
                             'objects (건물·소품)', 'autotile-ironrail (위층 난간)', 'decals']}
    M.save(HERE, extra)
    print(len(meta), 'parts;', marks_ok, 'empty', round(float(emax), 3), ewin, round(float(emax2), 3), ewin2)

if __name__ == '__main__':
    main()
