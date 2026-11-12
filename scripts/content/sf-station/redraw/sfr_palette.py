"""sf_station redraw 팔레트 v3 — 역할별 잠금(CONTRACT §6). 48색 이하. 값은 옛 sf_core 램프 값을 우선 쓰고(이미 승인된 Fable 기물 4장과 한 계열), 버들항 띠 밖의 값만 새로 정했다.
GROUND: 버들항 땅 화소 OKLab L 10–90% = 0.37–0.82, C ≤ 0.126(중앙 0.06) 안, 재질마다 가까운 4단.  STRUCTURE: L 0.33–0.86, C ≤ 0.124.  ACCENT: 불빛·화면·표지·네온만.  INK: 버들항 최암(#071528) + SF 최암."""
INK = {'ink': ['#071528', '#1c2230']}
GROUND = {
 'g_deck': ['#3b475e', '#4f5f7a', '#5b6c88', '#667896'],      # station floor metal (blue-grey)
 'g_tile': ['#7c8693', '#909aa6', '#a0a9b4', '#b4bcc6'],      # white ceramic floor tile
 'g_road': ['#44444f', '#565662', '#6a6a78', '#80808f'],      # asphalt (0-1) and concrete (2-3)
 'g_dust': ['#5a5a64', '#70707c', '#888894', '#a2a2ae'],      # moon regolith
}
STRUCTURE = {
 's_hull': ['#2e384c', '#3b475e', '#4f5f7a', '#667896', '#8396b2', '#a3b4cb'],   # blue-grey metal
 's_white': ['#59626f', '#7c8693', '#a0a9b4', '#c3cad2'],                        # white ceramic panels
 's_dark': ['#363644', '#44444f'],                                               # black equipment, rubber
 's_night': ['#31416c', '#405484', '#51689d'],                                   # dark blue tower walls
 's_glass': ['#264268', '#365c88', '#4c7aa8'],                                   # dark blue glass
 's_rust': ['#66301a', '#8a4626', '#b0603a'],                                    # copper, rust, soil, containers
}
ACCENT = {
 'a_cyan': ['#12687e', '#2cb0cc', '#a0ecf6'],
 'a_orange': ['#b85a1c', '#f09a40'],
 'a_yellow': ['#d9bc2c', '#ffee86'],
 'a_magenta': ['#861a76', '#d63cbe', '#ff9eea'],
 'a_violet': ['#5a3cb4', '#9c84f0'],
 'a_green': ['#1e6c32', '#44b45c'],
 'a_glow': ['#ffffff'],
}
ALL = {**INK, **GROUND, **STRUCTURE, **ACCENT}      # 그릴 때 프롬프트에 준 팔레트(v3)

# ───────── 구운 팔레트(v4, CONTRACT §9 — 버들항 띠는 낮의 마른 땅에만. 밤 거리·승무원 선실은 옛 시트의 밝기 범위가 목표) ─────────
# 그린 그림을 코드가 옮긴다(모델 호출 없음). 48색 그대로: 낮 콘크리트 3단(565662 6a6a78 80808f) → 달 먼지 램프로, 밝은 남색 3단(31416c 405484 51689d) → 유리 램프로 합치고,
# 그 자리에 밤 아스팔트 3단(옛 conc -3…-1)과 밤 남색 3단(옛 navy -2…0)을 넣었다.
F_GROUND = {
 'g_deck': GROUND['g_deck'], 'g_tile': ['#a0a9b4', '#b4bcc6', '#c3cad2'],   # lab floor, one step lighter (toward the old white lab)
 'g_road': ['#1a1a22', '#26262f', '#34343f', '#44444f'],      # night asphalt (0-2), dark concrete joint (3)
 'g_dust': GROUND['g_dust'],                                    # moon regolith; also light concrete (sidewalk slabs, landing plates)
 'g_carpet': ['#131a30', '#1b2542', '#253256', '#264268'],     # navy crew-quarters carpet
}
F_STRUCTURE = {
 's_hull': STRUCTURE['s_hull'], 's_white': STRUCTURE['s_white'],
 's_dark': ['#26262f', '#34343f', '#44444f'],
 's_night': ['#131a30', '#1b2542', '#253256'],                 # night tower walls
 's_violet': ['#1c1040', '#2c1a66', '#40288c'],                # night tower walls, purple variant (the old towers' own wall colours)
 's_glass': STRUCTURE['s_glass'], 's_rust': ['#66301a', '#8a4626', '#b85a1c'],
}
FINAL = {**INK, **F_GROUND, **F_STRUCTURE, **ACCENT}
# 조각 종류별 색 옮김(그린 색 → 구운 색)
MAP_ASPHALT = {'#44444f': '#26262f', '#565662': '#1a1a22', '#6a6a78': '#34343f', '#80808f': '#44444f'}
MAP_PUDDLE = {'#44444f': '#1a1a22', '#565662': '#34343f', '#6a6a78': '#44444f'}
MAP_SIDEWALK = {'#44444f': '#34343f', '#565662': '#44444f', '#6a6a78': '#5a5a64', '#80808f': '#70707c'}
MAP_CREW = {'#3b475e': '#1b2542', '#4f5f7a': '#253256', '#5b6c88': '#264268', '#667896': '#264268'}
MAP_STREET_BUILDING = {'#31416c': '#131a30', '#405484': '#1b2542', '#51689d': '#253256',
                       '#2e384c': '#1c2230', '#3b475e': '#2e384c', '#4f5f7a': '#3b475e', '#667896': '#4f5f7a', '#8396b2': '#667896', '#a3b4cb': '#8396b2',
                       '#363644': '#26262f', '#44444f': '#34343f', '#365c88': '#264268', '#4c7aa8': '#365c88'}
ROLE_OF = {**{k: 'INK' for k in INK}, **{k: 'GROUND' for k in GROUND}, **{k: 'STRUCTURE' for k in STRUCTURE}, **{k: 'ACCENT' for k in ACCENT}}
NOTE = {'ink': 'darkest outline / deepest shadow / screen background', 'g_deck': 'station floor metal', 'g_tile': 'white ceramic floor tile', 'g_road': 'asphalt (tones 0-1) and concrete (tones 2-3)',
        'g_dust': 'moon regolith dust and rock', 's_hull': 'blue-grey station metal', 's_white': 'white ceramic panels', 's_dark': 'black equipment, rubber, dark frames',
        's_night': 'dark blue tower walls of the night street', 's_glass': 'dark blue glass', 's_rust': 'copper pipes, rust, soil, orange-brown containers',
        'a_cyan': 'screens, light strips, coolant', 'a_orange': 'hazard marks, warm lamps', 'a_yellow': 'hazard stripes, lit windows', 'a_magenta': 'neon', 'a_violet': 'neon',
        'a_green': 'terminal bars, leaves', 'a_glow': 'white core of a lamp, 1-3 px'}

F_NOTE = dict(NOTE, g_road='night asphalt (0-2), dark concrete joints (3)', g_dust='moon regolith; light concrete (sidewalk slabs, landing plates)', g_carpet='navy crew-quarters carpet', g_tile='white lab floor tile',
              s_dark='black equipment, dark roofs', s_night='night tower walls', s_violet='night tower walls, purple variant', s_rust='copper, rust, soil, containers (light tone shared with a_orange)')

def rgb(h): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def ramps_for(role, extra=()):
    """role 'ground' → INK+GROUND(+extra accent ramps), 'structure' → INK+STRUCTURE+ACCENT(+extra ground ramps)."""
    names = list(INK) + (list(GROUND) if role == 'ground' else list(STRUCTURE) + list(ACCENT))
    for e in extra:
        if e not in names: names.append(e)
    return names


if __name__ == '__main__':
    import numpy as np, sys
    sys.argv = sys.argv[:1]
    from sfr_measure_fn import LC
    uniq = {c for r in FINAL.values() for c in r}
    print('colours', len(uniq))
    ROLE_OF.update(g_carpet='GROUND', s_violet='STRUCTURE')
    for n, r in FINAL.items():
        L, C = LC(np.array([rgb(c) for c in r]))
        print(f'{ROLE_OF[n]:9} {n:10}', ' '.join(f'{c} {l:.2f}/{cc:.3f}' for c, l, cc in zip(r, L, C)))

# 셋째 판(감독 지시, 코드만): 달 땅 한 단 내림 · 실험실 바닥 한 단 올림 · 거리의 색 양(탈것·노점 차양·보라 벽 타워·주황 창)
MAP_MOON = {'#a2a2ae': '#888894', '#888894': '#70707c', '#70707c': '#5a5a64', '#5a5a64': '#44444f'}
MAP_LAB = {'#7c8693': '#a0a9b4', '#909aa6': '#a0a9b4', '#a0a9b4': '#b4bcc6', '#b4bcc6': '#c3cad2'}
MAP_PURPLE_WALL = {'#131a30': '#1c1040', '#1b2542': '#2c1a66', '#253256': '#40288c'}
PURPLE_BUILDINGS = ('street-tower-m', 'street-club', 'street-arcade')
ORANGE_WINDOW_BUILDINGS = ('street-tower-s', 'street-tower-m', 'street-tower-l', 'street-apartment', 'street-capsule-hotel')
MAP_VEHICLE = {   # 차체 램프 → ACCENT (유리·밑면·윤곽은 그대로)
 'pod-car': {'#c3cad2': '#ff9eea', '#a0a9b4': '#d63cbe', '#7c8693': '#861a76', '#59626f': '#861a76'},
 'street-pod-car-cyan': {'#a3b4cb': '#a0ecf6', '#8396b2': '#2cb0cc', '#667896': '#2cb0cc', '#4f5f7a': '#12687e'},
 'street-pod-taxi': {'#a3b4cb': '#ffee86', '#8396b2': '#d9bc2c', '#667896': '#d9bc2c', '#4f5f7a': '#b85a1c'},
 'street-hover-bike': {'#a3b4cb': '#9c84f0', '#8396b2': '#9c84f0', '#667896': '#5a3cb4', '#4f5f7a': '#5a3cb4'},
}
MAP_REGION = {    # (조각, 줄 범위[y0, y1)) → 색 옮김: 차양·간판 판만
 'street-market-stall-a': ((0, 15), {'#b0603a': '#d63cbe', '#8a4626': '#861a76', '#66301a': '#861a76'}),
 'street-market-stall-b': ((0, 15), {'#365c88': '#2cb0cc', '#264268': '#12687e', '#4c7aa8': '#a0ecf6', '#405484': '#2cb0cc', '#31416c': '#12687e', '#51689d': '#a0ecf6'}),
 'street-kiosk': ((0, 14), {'#a3b4cb': '#f09a40', '#8396b2': '#f09a40', '#667896': '#b85a1c'}),
}
