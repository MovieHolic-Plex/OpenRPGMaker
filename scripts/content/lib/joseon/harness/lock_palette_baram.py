"""조선 칩셋 팔레트 잠금 — 바람의나라 기준 (2026-10-02, 사용자 요청: 「색상 팔레트를 바람의나라랑 맞춰봐라」).

바람의나라 스크린샷(~/third-party-assets/baram/{gate,village,thatch,thatch2}.png)의 소재별 영역을
k-means(k=6~7)로 뽑은 군집 색을 기준으로 소재 램프를 만든다(어두움 → 밝음 7톤, thatch8 만 8톤).
  - 기와: 푸른 기가 도는 짙은 회청(#1c2523 … #7a7e7e), 문루 지붕은 청록(#012e27 … #016c5d)
  - 땅·잔디: 채도 낮은 올리브 갈색(#36260d … #7e6e4e) / 올리브 노랑(#3e4914 … #939756)
  - 기둥·벽: 칙칙한 적색(#5c130a … #d4443a), 분홍기 도는 흰 회벽(#e8e4e0), 돌은 따뜻한 회색(#3c3b3a … #a09a98)
  - 초가: 주황 갈색(#653819 … #df9050), 처마·초롱: 금빛 주황(#e39a3b)
원본은 JPEG 노이즈가 섞여 있어 군집 중심을 그대로 쓰되 램프 단조성만 손으로 맞췄다.
허용 색 = 이 램프들의 합집합. 옛 버들항 잠금은 palette_beodeul.json 에 보존(되돌리기용).

    python3 harness/lock_palette_baram.py    # palette.json 을 쓴다
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

RAMPS = {
    'giwa':      ['#0c1110', '#1c2523', '#2c3433', '#3f4744', '#556061', '#7a7e7e', '#a2a4a6'],
    'dgreen':    ['#041512', '#012e27', '#014137', '#005647', '#016c5d', '#2f8878', '#6fb0a0'],
    'dblue':     ['#0a1030', '#14204a', '#1f2f66', '#2d4061', '#3f4682', '#6a72b0', '#a8b0e0'],
    'red':       ['#2a0a08', '#5c130a', '#781a14', '#9e1e1a', '#b82a22', '#d4443a', '#e8806a'],
    'wood':      ['#1a0e06', '#41210f', '#5a3016', '#764729', '#874c29', '#a9683e', '#c6875e'],
    'earth':     ['#241a0a', '#36260d', '#4c3a20', '#6c5f3d', '#7e6e4e', '#9a8a68', '#c4b490'],
    'plaster':   ['#2e2220', '#6b5040', '#9a8a80', '#baaea5', '#d3d0cc', '#e8e4e0', '#f6f3ef'],
    'stone':     ['#171716', '#3c3b3a', '#565352', '#6f6c6a', '#878381', '#a09a98', '#c4bfbd'],
    'straw':     ['#312017', '#653819', '#974f22', '#af632e', '#c6773b', '#df9050', '#e5cfb6'],
    'persimmon': ['#391d04', '#7a2e12', '#a56714', '#c8741a', '#e39a3b', '#f0c070', '#f8e0a8'],
    'leaf':      ['#141c03', '#1c2904', '#3e4914', '#576128', '#75793b', '#939756', '#b8bc7a'],
    'pine':      ['#0e1602', '#16200a', '#223210', '#33461a', '#465a24', '#5f7335', '#7a8c4a'],
    'water':     ['#0b1a20', '#103039', '#1f4650', '#2d5a63', '#3e7078', '#6d9aa0', '#a0c4c8'],
    'thatch8':   ['#4a2108', '#653819', '#7d3711', '#974f22', '#af632e', '#c6773b', '#df9050', '#eba86a'],
}
SHADOW = '#0c1110'
# 밝은 판(2026-10-02, 사용자: 「밝은 색 맵이 더 나은 것 같다」): 땅·잎·물·돌만 버들항의 밝은 램프로, 건물 소재(기와·단청·나무·초가)는 바람의나라 그대로.
BRIGHT = {
    'leaf':  ['#071528', '#143a27', '#205030', '#4b8232', '#58a035', '#73b83e', '#8fd24a'],
    'pine':  ['#0c231a', '#133120', '#183f1a', '#285725', '#2f6e24', '#3b6a2d', '#4b8232'],
    'water': ['#071528', '#143a27', '#1c4a44', '#21584e', '#3fa2ae', '#7d98a2', '#a7d4db'],
    'earth': ['#2a1a0f', '#452a17', '#5e4c38', '#816a56', '#947c5c', '#c89a66', '#dcb680'],
    'stone': ['#1c2626', '#2b3934', '#3e403d', '#595b58', '#929491', '#c4c6c3', '#dee0dd'],
}


def main():
    import sys
    if '--bright' in sys.argv:
        RAMPS.update(BRIGHT)
    allowed = sorted({c for v in RAMPS.values() for c in v} | {SHADOW})
    out = {
        'source': '바람의나라 스크린샷(gate·village·thatch·thatch2) k-means 군집 → 소재 램프',
        'rule': '허용 = 아래 램프 색의 합집합. 램프 밖 색 금지. 옛 버들항 잠금은 palette_beodeul.json.',
        'allowed': allowed,
        'ramps': RAMPS,
        'shadow': SHADOW,
    }
    json.dump(out, open(os.path.join(HERE, 'palette.json'), 'w'), indent=1)
    print(f'허용 {len(allowed)}색, 램프 {len(RAMPS)}개')


if __name__ == '__main__':
    main()
