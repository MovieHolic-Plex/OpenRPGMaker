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
ALL = {**INK, **GROUND, **STRUCTURE, **ACCENT}
ROLE_OF = {**{k: 'INK' for k in INK}, **{k: 'GROUND' for k in GROUND}, **{k: 'STRUCTURE' for k in STRUCTURE}, **{k: 'ACCENT' for k in ACCENT}}
NOTE = {'ink': 'darkest outline / deepest shadow / screen background', 'g_deck': 'station floor metal', 'g_tile': 'white ceramic floor tile', 'g_road': 'asphalt (tones 0-1) and concrete (tones 2-3)',
        'g_dust': 'moon regolith dust and rock', 's_hull': 'blue-grey station metal', 's_white': 'white ceramic panels', 's_dark': 'black equipment, rubber, dark frames',
        's_night': 'dark blue tower walls of the night street', 's_glass': 'dark blue glass', 's_rust': 'copper pipes, rust, soil, orange-brown containers',
        'a_cyan': 'screens, light strips, coolant', 'a_orange': 'hazard marks, warm lamps', 'a_yellow': 'hazard stripes, lit windows', 'a_magenta': 'neon', 'a_violet': 'neon',
        'a_green': 'terminal bars, leaves', 'a_glow': 'white core of a lamp, 1-3 px'}


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
    uniq = {c for r in ALL.values() for c in r}
    print('colours', len(uniq))
    for n, r in ALL.items():
        L, C = LC(np.array([rgb(c) for c in r]))
        print(f'{ROLE_OF[n]:9} {n:10}', ' '.join(f'{c} {l:.2f}/{cc:.3f}' for c, l, cc in zip(r, L, C)))
