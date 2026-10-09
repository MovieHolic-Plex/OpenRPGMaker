# 석조 유럽 시가지 (european-quarter-stone) — 장소 팩 전용(공용 시트에 굽지 않는다). 다시 돌리면 같은 그림.
#   python3 make_european_quarter_stone.py
# 산출: parts/*.png · partmeta.json · parts.md · render-1x/2x.png · grid.json · check-autotile.png
# (전투 배경은 make_battle_bg.py, 비교 시트는 compare_ref.py)
# 그리기: 버들항 파이프라인(city_v6: 칩셋 결·px2 셰이딩·슬레이트·자갈)을 이 장소 램프(eq_base)로 옮겨 정면 문법(eq_facade)으로 조립.
# 장르 규격: tiledata/beodeul-kits/genres/european-streets.md (1 — 회색 석조 대형 건물가)
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import eq_kit as KT
import eq_ground as GR
from eq_layout import build

def export_parts():
    os.makedirs(HERE + '/parts', exist_ok=True)
    for f in os.listdir(HERE + '/parts'):
        if f.endswith('.png') and f[:-4] not in KT.K: os.remove(HERE + '/parts/' + f)
    meta = {}; lines = ['# 석조 유럽 시가지 (european-quarter-stone) 조각 — 장소 팩 전용', '',
                        '버들항 칸 규약(16px, 왼쪽 아래 기준, 3/4 시점). 바닥 표본 3x3, 오토타일 4x4(칸 번호 = 위 1 + 오른 2 + 아래 4 + 왼 8).',
                        '건물 층 높이: 1층 40px, 위층 32px, 코니스 6px, 맨사르드 38px(윗지붕 8 + 가파른 면 30) — 같은 층수 건물은 처마선이 같다.', '']
    groups = {'floor': '맨 바탕 표본', 'autotile': '16변형 오토타일', 'object': '건물·물체', 'tree': '나무', 'decal': '바닥 덧그림(걷기)'}
    for kind, title in groups.items():
        lines += [f'## {title}', '']
        for name, (fn, m) in KT.K.items():
            if m['kind'] != kind: continue
            im = KT.img(name); im.save(f'{HERE}/parts/{name}.png')
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
    GR.check_sheet(HERE + '/check-autotile.png')
    M = build(); M.render()
    reach = M.bfs(M.marks['west_entry'])
    marks_ok = {k: tuple(v) in reach for k, v in M.marks.items()}
    (emax, ewin), eall = M.emptiness()
    extra = {'reach_from_west_entry': marks_ok,
             'empty_floor': {'max_20x15': round(float(emax), 3), 'window': list(ewin), 'overall': round(float(eall), 3)},
             'paint_order': ['ground-* (맨 바탕 표본)', 'autotile-sidewalk (보도 연석)', 'autotile-puddle/slush/leaves (덩이)',
                             'objects (건물·소품)', 'autotile-ironrail (위층 난간)', 'decals']}
    M.save(HERE, extra)
    print(len(meta), 'parts;', marks_ok, 'empty', round(float(emax), 3), ewin)

if __name__ == '__main__':
    main()
