# 안개 낀 고딕 마을 (gothic-village) — 장소 팩 전용(공용 시트에 굽지 않는다). 다시 돌리면 같은 그림.   python3 make_gothic_village.py
# 산출: parts/*.png · partmeta.json · parts.md · render-1x/2x.png · grid.json · check-autotile.png (전투 배경은 make_battle_bg.py, 비교는 compare_ref.py)
# 그리기: 버들항 파이프라인(city_v6)과 폐허 마을·비 폐허 도시 동결 사본(vendor/)의 함수로 낮 재료를 그리고 고딕 등급(gv_base.gloom)으로 옮긴다.
# 장르 규격: tiledata/beodeul-kits/genres/gothic.md
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gv_kit as KT
import gv_auto as AU
from gv_layout import build

def export_parts():
    os.makedirs(HERE + '/parts', exist_ok=True)
    for f in os.listdir(HERE + '/parts'):
        if f.endswith('.png') and f[:-4] not in KT.K: os.remove(HERE + '/parts/' + f)
    meta = {}; lines = ['# 고딕 마을 (gothic-village) 조각 — 장소 팩 전용', '',
                        '버들항 칸 규약(16px, 왼쪽 아래 기준, 3/4 시점). 바닥 표본 3x3, 오토타일 4x4(칸 번호 = 위 1 + 오른 2 + 아래 4 + 왼 8).', '']
    groups = {'floor': '맨 바탕 표본', 'autotile': '16변형 오토타일', 'object': '건물·물체', 'tree': '나무', 'decal': '바닥 덧그림(걷기)'}
    for kind, title in groups.items():
        lines += [f'## {title}', '']
        for name, (fn, m) in KT.K.items():
            if m['kind'] != kind: continue
            im = KT.pad16(KT.img(name)); im.save(f'{HERE}/parts/{name}.png')
            meta[name] = m
            lines.append(f"- `parts/{name}.png` ({im.width}x{im.height} px) — {m['ko']}: {m['desc']} / {im.width // 16}x{im.height // 16}칸")
        lines.append('')
    json.dump(meta, open(HERE + '/partmeta.json', 'w'), ensure_ascii=False, indent=1)
    cnt = {k: sum(1 for m in meta.values() if m['kind'] == k) for k in groups}
    lines.append('합계: ' + ' · '.join(f'{groups[k]} {v}' for k, v in cnt.items()) + f' = {len(meta)}종')
    open(HERE + '/parts.md', 'w').write('\n'.join(lines) + '\n')
    return meta

def main():
    meta = export_parts()
    AU.check_sheet(HERE + '/check-autotile.png')
    M = build(); M.render()
    reach = M.bfs(M.marks['south_gate'])
    marks_ok = {k: tuple(v) in reach for k, v in M.marks.items()}
    (emax, ewin), eall = M.emptiness()
    (emax2, ewin2), eall2 = M.emptiness(autos_full=True)
    extra = {'reach_from_south_gate': marks_ok,
             'empty_floor': {'max_20x15_without_patches': round(float(emax), 3), 'window': list(ewin), 'overall': round(float(eall), 3),
                             'max_20x15_patches_as_empty': round(float(emax2), 3), 'window2': list(ewin2)},
             'paint_order': ['ground-* (맨 바탕 표본)', 'autotile-mudpatch/mudlane/mire/leafbone/dewgrass (오토타일 덩이)', 'objects (건물·소품)', 'autotile-ironfence (위층 울타리)', 'decals']}
    M.save(HERE, extra)
    print(len(meta), 'parts;', marks_ok, 'empty', round(float(emax), 3), ewin, round(float(emax2), 3), ewin2)

if __name__ == '__main__':
    main()
