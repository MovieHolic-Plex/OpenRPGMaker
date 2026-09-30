#!/usr/bin/env python3
"""확장 시트 v2 — 원본 아이콘 모듈을 잘라 늘려 만든 성·마을. 출력 world-plus-ext.png / .json.
색은 원본 픽셀 그대로(새 색 없음) 뒤에 world-plus 와 같은 팔레트 눌림(mute)을 통과시킨다."""
import json
from wm_ext2_lib import *
import ext2_castle as C
import ext2_small as S

COLS, ROWS = 30, 12
ICONS = [
    # name, tier, (w,h) cells, col, row, builder, desc
    ('castle_dark', 3, (3, 3), 0, 0, C.castle3_final, '어둠의 성 — 원본 어두운 성(2x2)의 둥근 탑·성벽 모듈을 키운 3x3'),
    ('castle_dark_grand', 4, (5, 5), 3, 0, lambda: C.castle5_final(2, 2, 2, 1, 58), '대성 — 바깥 성벽과 문·모서리 탑 둘 뒤로 안쪽 성이 솟는 5x5'),
    ('town_bell', 3, (3, 3), 8, 0, S.town_bell, '마을 — 둥근 탑을 가운데 세우고 집 넷·덤불 (3x3)'),
    ('town_red', 3, (3, 3), 11, 0, S.town, '큰 마을 — 원본 붉은 지붕·목조 집 여섯 채·덤불 (3x3)'),
    ('town_snow', 3, (3, 3), 14, 0, S.town_snow, '설원 큰 마을 — 눈 덮인 집 여섯 채 (3x3)'),
    ('village_wood', 2, (2, 2), 17, 0, S.village, '촌락 — 목조 집 세 채·덤불 (2x2)'),
    ('village_snow', 2, (2, 2), 19, 0, lambda: S.village(S.SNOW_WOOD, True), '설원 촌락 — 눈 덮인 집 세 채 (2x2)'),
]


def main():
    sheet = blank(COLS * 16, ROWS * 16)
    meta = []
    for name, tier, (w, h), col, row, fn, desc in ICONS:
        img = fn()
        assert img.shape[:2] == (h * 16, w * 16), (name, img.shape)
        paste(sheet, img, col * 16, row * 16)
        meta.append(dict(name=name, tier=tier, cells=[w, h], col=col, row=row, firstCell=row * COLS + col, desc=desc))
    sheet = mute(sheet)
    save(sheet, HERE / 'world-plus-ext.png')
    tiers = {'2': '2x2 촌락', '3': '3x3 마을·성', '4': '5x5 대성'}
    json.dump(dict(cols=COLS, rows=ROWS, key=[255, 103, 139], tiers=tiers, icons=meta), open(HERE / 'world-plus-ext.json', 'w'), ensure_ascii=False, indent=1)
    print(len(meta), 'icons')


if __name__ == '__main__':
    main()
