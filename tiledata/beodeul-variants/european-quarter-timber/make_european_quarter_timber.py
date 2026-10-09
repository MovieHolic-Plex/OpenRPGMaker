# 유럽 목골 구시가(european-quarter-timber) — 장소 팩 전용(공용 시트에 굽지 않는다). 다시 돌리면 같은 그림.   python3 make_european_quarter_timber.py
# 산출: parts/*.png · partmeta.json · parts.md · render-1x/2x.png · grid.json · check-autotile.png (전투 배경은 make_battle_bg.py, 비교는 compare_ref.py)
# 그리기: 버들항 파이프라인(city_v6: 칩셋 지붕·벽 칸, 박공·가파른 지붕, 소품 함수)을 그대로 부르고 갈색 기와·붉은 벽돌·적갈 목골 램프로 옮긴 뒤 장소 등급(grade)을 씌운다.
# 장르 규격: tiledata/beodeul-kits/genres/european-streets.md (2번 목골 구시가)
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from eq_base import pad16
import eq_kit as KT
import eq_auto as AU
from eq_layout import build

def export_parts():
    os.makedirs(HERE + '/parts', exist_ok=True)
    for f in os.listdir(HERE + '/parts'):
        if f.endswith('.png') and f[:-4] not in KT.K: os.remove(HERE + '/parts/' + f)
    meta = {}; lines = ['# 유럽 목골 구시가 (european-quarter-timber) 조각 — 장소 팩 전용', '',
                        '버들항 칸 규약(16px, 왼쪽 아래 기준, 3/4 시점). 바닥 표본 3x3, 오토타일 4x4(칸 번호 = 위 1 + 오른 2 + 아래 4 + 왼 8).', '']
    groups = {'floor': '맨 바탕 표본', 'autotile': '16변형 오토타일', 'object': '건물·물체', 'tree': '나무'}
    for kind, title in groups.items():
        lines += [f'## {title}', '']
        for name, (fn, m) in KT.K.items():
            if m['kind'] != kind: continue
            im = pad16(KT.img(name)); im.save(f'{HERE}/parts/{name}.png')
            meta[name] = m
            lines.append(f"- `parts/{name}.png` ({im.width}x{im.height} px) — {m['ko']}: {m['desc']} / {im.width // 16}x{im.height // 16}칸")
        lines.append('')
    json.dump(meta, open(HERE + '/partmeta.json', 'w'), ensure_ascii=False, indent=1)
    cnt = {k: sum(1 for m in meta.values() if m['kind'] == k) for k in groups}
    nb = sum(1 for m in meta.values() if m.get('role') == 'building')
    lines.append('합계: ' + ' · '.join(f'{groups[k]} {v}' for k, v in cnt.items()) + f' = {len(meta)}종 (그중 큰 건물 {nb})')
    open(HERE + '/parts.md', 'w').write('\n'.join(lines) + '\n')
    return meta

def main():
    meta = export_parts()
    AU.check_sheet(HERE + '/check-autotile.png')
    M = build(); M.render()
    reach = M.bfs(M.marks['south_lane'])
    marks_ok = {k: tuple(v) in reach for k, v in M.marks.items()}
    (emax, ewin), eall = M.emptiness(road_names=('ground-dirt',))
    extra = {'reach_from_south_lane': marks_ok,
             'empty_floor': {'max_20x15': round(float(emax), 3), 'window': list(ewin), 'overall': round(float(eall), 3),
                             'note': '빈 바닥 = 물체 덮임 < 0.25 이고 벽돌 거리·흙 골목이 아니고 오토타일 덩이도 아닌 칸(자갈 보도·광장 포석은 빈 바닥으로 센다)'},
             'paint_order': ['ground-* (맨 바탕 표본)', 'autotile-brickstreet/mossy/puddle/leaves/flowerbed (오토타일 덩이)', 'objects (건물·소품)', 'wall overlays (wall-sign-*, downpipe)']}
    M.save(HERE, extra)
    print(len(meta), 'parts;', marks_ok, 'empty', round(float(emax), 3), ewin, round(float(eall), 3))

if __name__ == '__main__':
    main()
