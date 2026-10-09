"""묶음 p3 이펙트 16장(직업마다 대표기 1장 + 필살기 화면 1장). 나머지 층은 기존 시트를 재사용한다(reuse).
    python3 scripts/asset-gen/pixel-fx/r2w3_p3.py [key ...]        # p3 새 시트 전부 + 직업별 검토판
재사용 키의 anchor·frame·frames 는 계약 파일(retroClassSkills.ts·retroMonsterSkills.ts)에서 읽는다(첫 등장값)."""
import math, re, sys
from lib_r2w3 import *

# ── 재사용 등록 ─────────────────────────────────────────────────────────────────
_T = (ROOT / 'src/assets/retroClassSkills.ts').read_text(encoding='utf8') + (ROOT / 'src/assets/retroMonsterSkills.ts').read_text(encoding='utf8')
KNOWN = {}
for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', _T):
    KNOWN.setdefault(m.group(1), (m.group(2), int(m.group(3)), int(m.group(4))))
for m in re.finditer(r'L\("(\w+)", "(\w+)", (\d+), (\d+)\)', _T):
    KNOWN.setdefault(m.group(1), (m.group(2), int(m.group(3)), int(m.group(4))))
REUSED = ['cleric_heal', 'bard_hymn', 'mage_missile_orb', 'mage_missile_hit', 'guard_bash', 'cleric_purify', 'cleric_blessing',
          'cleric_revive', 'cleric_mass_heal', 'mage_fireball_orb', 'mage_fire_burst', 'ranger_frost_arrow', 'mon_frost_burst',
          'mage_chain_bolt', 'mage_mana_shield', 'scout_shadow_puff', 'mage_meteor_rock', 'mage_meteor_blast', 'mage_star_hit',
          'guard_taunt', 'guard_barrier', 'guard_charge', 'hero_dust', 'guard_counter', 'guard_quake', 'guard_quake_ring',
          'guard_fortress_slam', 'mon_cleave_arc', 'hero_warcry', 'ranger_power_hit', 'hero_whirl', 'scout_afterimage',
          'hero_meteor_impact', 'scout_flurry', 'mon_quake_crack', 'hero_pierce', 'ninja_fire_breath', 'ranger_arrow',
          'mon_spear_pierce', 'hero_flame_aura', 'hero_meteor_trail', 'hero_brave_burst', 'mon_rock_burst', 'monk_meditate',
          'monk_fist_flurry', 'bard_notes_red', 'ranger_arrow_hit', 'druid_roots', 'mon_howl_ring', 'druid_claw', 'samurai_wind_hit',
          'druid_tree_hit', 'druid_moonbeam', 'mage_gravity', 'bard_notes_blue', 'monk_rising_kick', 'mage_snow']
for _k in REUSED:
    reuse(_k, *KNOWN[_k])

add_glyphs(
    tiara=['..k...k...k..', '.kdk.kdk.kdk.', '.kdkkkdkkkdk.', 'kddcdrdcdrddk', 'kcccccccccccck'[:13], '.kkkkkkkkkkk.'],
    mace=['...k...', '..kdk..', '.kkckk.', 'kdcccdk', '.kcdck.', 'kdcccdk', '.kkckk.', '..kdk..', '...k...', '...b...', '...b...', '...b...', '...b...', '..kgk..'],
    tower=['.kkkkkkk.', 'kdddddddk', 'kdcccccak', 'kdccgccak', 'kdcgggcak', 'kdccgccak', 'kdccgccak', 'kdcccccak', '.kdcccak.', '..kkkkk..'],
    folk=['..kkk..', '.kdddk.', '.kdddk.', '..kkk..', '.kcccck', 'kccccck', 'kcckcck', '.kcckk.', '.kk.kk.'],
    totem=['.kkkkk.', 'kdcdcdk', 'kgkdkgk', 'kdddddk', 'kdkkkdk', '.kdddk.', 'kkkkkkk', 'kcdcdck', 'kdgdgdk', 'kcdddck', 'kdkkkdk', '.kcccк.'.replace('к', 'k'), 'kkkkkkk'],
)


def meteor(c, x, y, ln, cols, dx=-1.0, dy=.6, r=2):
    """오른쪽 위 → 왼쪽 아래로 떨어지는 운석(머리 + 꼬리)."""
    n = math.hypot(dx, dy); ux, uy = dx / n, dy / n
    for i, col in enumerate(cols[:-1]):
        t0 = ln * (1 - i / len(cols))
        c.line([(x - ux * t0, y - uy * t0), (x, y)], col, max(1, r - 1 + (i > 0)))
    c.disc(x, y, r, cols[-1])


# ── 공주 ───────────────────────────────────────────────────────────────────────
PR = Pal(RS=['#5a1438', '#c83c7c', '#ff86b4', '#ffd0e4'], GD=['#9a6a14', '#f0c040', '#fff2a0'], W=['#ffffff'], GR=['#1e6a3c', '#4cc070'])
ROSE = dict(k=PR.RS[0], d=PR.RS[3], c=PR.RS[2], b=PR.RS[1], a=PR.RS[0], r=PR.RS[1], g=PR.GD[1])
TIARA = dict(k=PR.GD[0], d=PR.GD[2], c=PR.GD[1], r=PR.RS[2], b=PR.GD[1])


@sheet('princess_rose_barrier', 'allAllies', 64, 10, PR, peak=[3, 5, 7])
def princess_rose_barrier(c, f):
    """장미 결계: 발밑에 덩굴과 장미가 피고 꽃잎이 돔을 그리며 아군을 감싼다."""
    cx = CX
    u = ph(f, 0, 4)
    for k in range(7):                                  # 덩굴이 땅을 따라 뻗는다
        x = cx - 21 + k * 7
        h = 4 + 6 * ease(ph(f, k * .3, 3 + k * .3))
        c.line([(x, GY), (x + 2, GY - h)], PR.GR[0], 1); c.px(x + 3, GY - h + 1, PR.GR[1])
        if f >= 2 + k % 3: stamp(c, 'flower', x + 2, GY - h - 2, ROSE)
    if f >= 3:
        v = ph(f, 3, 9)
        r = 12 + 10 * ease(v)
        c.arc(cx, GY - 2, r, 180, 360, PR.RS[2], 1, r * 1.35)
        c.arc(cx, GY - 2, r - 2, 200, 340, PR.RS[3], 1, (r - 2) * 1.35)
    orbit_glyphs(c, 'petal', cx, 36, 18, 6, f / 10, dict(k=PR.RS[0], d=PR.RS[3], c=PR.RS[2], b=PR.RS[1]), ry=8, speed=.8, rot_self=1)
    motes(c, 'prb', 10, cx, GY, 20, 42, f / 9, [PR.W[0], PR.RS[3], PR.GD[2]], seed=1)


@sheet('princess_hymn_sky', 'screen', 128, 12, PR, peak=[4, 7, 10])
def princess_hymn_sky(c, f):
    """축복의 대합창(필살기): 하늘 창에서 빛살이 내리고 티아라가 강림, 분홍·금빛 꽃비가 아군 전체를 치유한다."""
    cx, cy = 64, 60
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, PR.RS[0])
    for k in range(7):                                  # 성당 창 빛살
        x = 20 + k * 15
        w = 1 + (k % 2)
        if u > k / 9 and f < 11:
            c.dither(lambda cc, x=x, w=w, k=k: cc.poly([(x - w, 6), (x + w, 6), (x + w * 2.5, 100 * u + 6), (x - w * 2.5, 100 * u + 6)], PR.GD[1] if k % 2 else PR.RS[3]), f + k)
            c.line([(x, 6), (x, 100 * u + 6)], PR.GD[2] if k % 2 else PR.RS[3])
    if f >= 3:
        y = lerp(-10, 34, ease(ph(f, 3, 7)))
        stamp(c, 'tiara', cx, y, TIARA, scale=4)
        rays(c, cx, y, 12, 26, 34 + 6 * math.sin(f), PR.GD[2], rot=f * .12, alt=30)
    if f >= 6:
        drift_glyphs(c, 'phs', 'petal', 18, (8, 20, 120, 112), ph(f, 6, 11), dict(k=PR.RS[0], d=PR.RS[3], c=PR.RS[2], b=PR.RS[1]), rot_speed=1.2, seed=2)
        drift_glyphs(c, 'phn', 'note', 8, (14, 30, 114, 110), ph(f, 6, 11), dict(k=PR.GD[0], d=PR.GD[2], c=PR.GD[1]), fall=False, seed=3)
    if f >= 9: flash(c, cx, 40, [18, 12, 6][f - 9], [PR.RS[2], PR.GD[2], PR.W[0]])


# ── 대마법사 ───────────────────────────────────────────────────────────────────
AM = Pal(F=['#7a1c0c', '#f0501c', '#ffb050'], I=['#1c4c9c', '#58b4ff', '#c8f0ff'], T=['#b08a10', '#ffe040'], E=['#1e7a3c', '#6ce08a'],
         V=['#2a1a4a', '#7a5ad8'], W=['#ffffff'])


@sheet('archmage_prism', 'target', 64, 10, AM, peak=[3, 5, 7])
def archmage_prism(c, f):
    """원소 프리즘: 적 위에 수정 프리즘이 떠 네 원소 광선으로 갈라져 내리꽂힌다."""
    cx, cy = CX, 40
    py = 10
    rot = f * .3
    pts = [(cx + math.cos(rot + k * math.tau / 3) * 7, py + 4 + math.sin(rot + k * math.tau / 3) * 3) for k in range(3)]
    c.poly([(cx, py - 6)] + pts[:2], AM.I[2]); c.poly([(cx, py - 6)] + pts[1:], AM.I[1]); c.px(cx, py - 4, AM.W[0])
    if f >= 2:
        cols = [(AM.F[1], AM.F[2]), (AM.I[1], AM.I[2]), (AM.T[0], AM.T[1]), (AM.E[0], AM.E[1])]
        for k, (a, b) in enumerate(cols):
            tx = cx - 12 + k * 8
            d = ph(f, 2 + k * .4, 4 + k * .4)
            ey = lerp(py + 4, cy + 6, d)
            beam(c, cx, py + 4, lerp(cx, tx, d), ey, 3, [a, b])
            if d >= 1 and f < 9: c.disc(tx, cy + 6, 3 - (f > 6), b)
    if f >= 5:
        v = ph(f, 5, 9)
        flash(c, cx, cy + 4, [12, 9, 6, 3, 1][min(4, f - 5)], [AM.V[1], AM.I[2], AM.W[0]])
        sparks(c, 'amp', 16, cx, cy + 4, 3, 26, v, [AM.W[0], AM.T[1], AM.F[2], AM.E[1], AM.I[1]], seed=1)


@sheet('archmage_elements_sky', 'screen', 128, 12, AM, peak=[4, 7, 10])
def archmage_elements_sky(c, f):
    """원소 대융합(필살기): 네 원소 구가 거대한 마법진을 돌다 한가운데로 모여 백색 폭발을 일으킨다."""
    cx, cy = 64, 58
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, AM.V[0])
    sigil(c, cx, cy, 44 * ease(u), AM.V[1], ry=30 * ease(u), rot=f * .15, spokes=5, inner=.62)
    sigil(c, cx, cy, 30 * ease(u), AM.I[1], ry=20 * ease(u), rot=-f * .2, spokes=6)
    cols = [(AM.F[0], AM.F[1], AM.F[2]), (AM.I[0], AM.I[1], AM.I[2]), (AM.T[0], AM.T[1], AM.W[0]), (AM.E[0], AM.E[1], AM.W[0])]
    shrink = 1 - ease(ph(f, 6, 9))
    for k, ramp in enumerate(cols):
        a = f * .45 + k * math.tau / 4
        x, y = orbit(cx, cy, 40 * shrink + 2, a, 26 * shrink + 1)
        if f < 10: glow(c, x, y, 7 if f < 8 else 5, list(ramp))
    if f >= 8:
        v = ph(f, 8, 11)
        flash(c, cx, cy, [14, 30, 24, 14][f - 8], [AM.V[1], AM.I[2], AM.T[1], AM.W[0]])
        rays(c, cx, cy, 16, 16 + v * 10, 30 + v * 30, AM.W[0], rot=f * .1, alt=24 + v * 20)
    motes(c, 'aes', 18, cx, 112, 50, 100, f / 11, [AM.I[2], AM.T[1], AM.F[2], AM.E[1]], seed=2)


# ── 중갑병 ────────────────────────────────────────────────────────────────────
HK = Pal(ST=['#2a3044', '#667090', '#a8b4d0', '#e6ecff'], BL=['#1c2c7a', '#3c64d8'], GD=['#b08420', '#ffe070'], DU=['#5a4a3a', '#a08a6a'], W=['#ffffff'])
MACE = dict(k=HK.ST[0], d=HK.ST[3], c=HK.ST[2], b=HK.DU[0], g=HK.GD[1])
TOWER = dict(k=HK.ST[0], d=HK.ST[2], c=HK.BL[1], g=HK.GD[1])


@sheet('heavy_knight_mace_crush', 'target', 64, 10, HK, peak=[3, 5, 8])
def heavy_knight_mace_crush(c, f):
    """철퇴 분쇄: 거대한 철퇴가 위에서 내려꽂혀 땅이 갈라지고 파편이 튄다."""
    cx, cy = CX, 40
    if f <= 3:
        y = lerp(0, 28, ease(ph(f, 0, 3)))
        stamp(c, 'mace', cx, y, MACE, rot=.25 - f * .08, scale=3)
        for k in range(3): c.line([(cx - 8 + k * 8, max(0, y - 24)), (cx - 8 + k * 8, y - 14)], HK.ST[2])
        return
    u = ph(f, 3, 9)
    stamp(c, 'mace', cx, 30 + (f == 4), MACE, rot=.02, scale=3 if f < 7 else 2)
    flash(c, cx, 48, [14, 10, 6, 3, 2, 1][min(5, f - 4)], [HK.DU[1], HK.GD[1], HK.W[0]])
    for k in range(6):                                  # 땅 균열
        a = math.pi + k * math.pi / 5
        c.line([(cx, 52), (cx + math.cos(a) * (6 + u * 20), 52 - math.sin(a) * (2 + u * 5))], HK.ST[0], 1)
    ring(c, cx, 52, 6 + u * 24, HK.DU[1], 2 if u < .4 else 1, 3 + u * 6)
    sparks(c, 'hkm', 14, cx, 46, 3, 24, u, [HK.ST[3], HK.DU[1], HK.DU[0], HK.ST[1]], size=2, gravity=1.2, seed=1)


@sheet('heavy_knight_bulwark_sky', 'screen', 128, 12, HK, peak=[4, 7, 10])
def heavy_knight_bulwark_sky(c, f):
    """철갑 진격(필살기): 거대한 탑방패 다섯이 솟아 벽을 이루고 적진으로(왼쪽) 밀고 나간다."""
    cx, cy = 64, 60
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, HK.ST[0])
    push = ease(ph(f, 6, 10)) * 30
    for k in range(5):
        x = 30 + k * 18 - push
        y = lerp(120, 70 - (k % 2) * 4, ease(ph(f, k * .35, 3 + k * .35)))
        stamp(c, 'tower', x, y, TOWER, scale=4)
    if f >= 6:
        for k in range(8):                              # 밀어붙이는 흙먼지
            y = 88 + k * 3
            c.line([(18 - push + k * 3, y), (8 - push * 1.4 + k, y)], HK.DU[1] if k % 2 else HK.DU[0], 2)
    if f >= 9:
        flash(c, 22, 72, [16, 11, 6][f - 9], [HK.BL[1], HK.GD[1], HK.W[0]])
    rays(c, cx, 30, 10, 20, 26 + u * 10, HK.GD[1], rot=f * .08) if 3 <= f < 7 else None


# ── 용병 ───────────────────────────────────────────────────────────────────────
MC = Pal(ST=['#2c2c38', '#7a7c8c', '#c8ccd8', '#ffffff'], WD=['#4a2a14', '#8c5a2c'], RD=['#4a0c10', '#a8182c', '#f04c4c'], GD=['#e0a02c'])
AXE = dict(k=MC.ST[0], d=MC.ST[3], c=MC.ST[2], b=MC.WD[1], a=MC.ST[1])


def war_axe(c, x, y, ang, s):
    """자루 + 도끼날. ang 은 자루 방향(라디안, 날은 끝에). s 는 크기 배율."""
    ux, uy = math.cos(ang), math.sin(ang); nx, ny = -uy, ux
    hx, hy = x + ux * 9 * s, y + uy * 9 * s
    c.line([(x - ux * 5 * s, y - uy * 5 * s), (hx, hy)], MC.WD[0], max(1, round(1.4 * s)))
    c.line([(x - ux * 5 * s, y - uy * 5 * s), (hx, hy)], MC.WD[1], max(1, round(.6 * s)))
    blade = [(hx + nx * 1 * s, hy + ny * 1 * s), (hx + nx * 5 * s + ux * 2 * s, hy + ny * 5 * s + uy * 2 * s),
             (hx + nx * 6 * s - ux * 1 * s, hy + ny * 6 * s - uy * 1 * s), (hx + nx * 4 * s - ux * 4 * s, hy + ny * 4 * s - uy * 4 * s),
             (hx - ux * 1 * s, hy - uy * 1 * s)]
    c.poly(blade, MC.ST[1])
    c.line([blade[1], blade[2], blade[3]], MC.ST[3], max(1, round(.7 * s)))


@sheet('mercenary_axe_spin', 'projectile', 32, 4, MC)
def mercenary_axe_spin(c, f):
    """도끼 던지기: 도끼가 빙글빙글 돌며 왼쪽(적)으로 난다. 뒤(오른쪽)에 회전 궤적."""
    a = math.pi + f * math.pi / 2
    war_axe(c, 12 - math.cos(a) * 3, 16 - math.sin(a) * 3, a, 1.0)
    c.arc(12, 16, 12, 300 - f * 90, 360 - f * 90, MC.ST[2], 1)
    for i in range(3): c.px(24 + i * 3, 15 + (i + f) % 3, [MC.ST[2], MC.ST[1], MC.GD[0]][i])


@sheet('mercenary_warlord_sky', 'screen', 128, 12, MC, peak=[4, 7, 10])
def mercenary_warlord_sky(c, f):
    """전장의 군주(필살기): 찢긴 전기가 펄럭이고 거대한 쌍도끼가 X 자로 화면을 가른다."""
    cx, cy = 64, 60
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, MC.RD[0])
    for k in range(4):                                  # 찢긴 전기
        x = 18 + k * 30; h = 36 * ease(u)
        c.line([(x, 10), (x, 16 + h)], MC.WD[0], 1)
        for i in range(10):
            yy = 12 + i * h / 10
            c.line([(x + 1, yy), (x + 12 + math.sin(f + i * .7) * 2 - (i % 3 == 2) * 4, yy)], MC.RD[1] if i % 4 else MC.RD[0])
    if f >= 3:
        s = ease(ph(f, 3, 6))
        war_axe(c, cx - 30 + s * 12, 88, -math.pi / 2 + .5 - s * .3, 3.2)
        war_axe(c, cx + 30 - s * 12, 88, -math.pi / 2 - .5 + s * .3, 3.2)
    if f >= 6:
        p = ph(f, 6, 8)
        slash(c, cx, cy, 58, 215, 325, 10, [MC.RD[1], MC.RD[2], MC.ST[3]], prog=p, ry=.8)
        slash(c, cx, cy + 4, 58, 35, 145, 10, [MC.RD[1], MC.RD[2], MC.ST[3]], prog=ph(f, 7, 9), ry=.8)
    if f >= 9:
        flash(c, cx, cy, [20, 13, 7][f - 9], [MC.RD[1], MC.GD[0], MC.ST[3]])
        sparks(c, 'mws', 24, cx, cy, 6, 56, ph(f, 9, 11), [MC.ST[3], MC.GD[0], MC.RD[2], MC.RD[1]], size=2, seed=1)


# ── 용기사 ───────────────────────────────────────────────────────────────────
DG = Pal(BL=['#0c1c4a', '#1c4ca8', '#4c9cf0', '#b0e0ff'], ST=['#5a6478', '#d8e0f0'], RD=['#b01c2c'], GD=['#e8b830', '#fff0a0'], W=['#ffffff'], DU=['#6a5a48'])
SPEAR = dict(k=DG.BL[0], d=DG.W[0], c=DG.ST[1], b=DG.RD[0])


@sheet('dragoon_dive', 'target', 64, 10, DG, peak=[3, 5, 8])
def dragoon_dive(c, f):
    """점프: 하늘 높이 사라졌던 용기사의 창이 수직으로 내리꽂혀 푸른 용 날개 모양 충격파를 연다."""
    cx, cy = CX, 40
    if f <= 3:
        for k in range(4): c.line([(cx - 6 + k * 4, 0), (cx - 6 + k * 4, 6 + f * 7)], DG.BL[2] if k % 2 else DG.BL[3])
        y = lerp(-6, 30, ease(ph(f, 0, 3)))
        stamp(c, 'spear', cx, y, SPEAR, rot=math.pi, scale=3)
        return
    u = ph(f, 4, 9)
    stamp(c, 'spear', cx, 36, SPEAR, rot=math.pi, scale=3 if f < 7 else 2)
    flash(c, cx, 50, [14, 10, 6, 3, 2, 1][min(5, f - 4)], [DG.BL[2], DG.BL[3], DG.W[0]])
    for s in (-1, 1):                                   # 용 날개 충격파
        wing(c, cx + s * 3, 48, s, .4 + u * .6, [DG.BL[1], DG.BL[2], DG.BL[3]], span=10 + u * 16)
    ring(c, cx, 54, 6 + u * 22, DG.BL[3], 1, 3 + u * 5)
    sparks(c, 'dgd', 12, cx, 50, 3, 22, u, [DG.W[0], DG.BL[3], DG.DU[0]], gravity=1, seed=1)


@sheet('dragoon_dragon_sky', 'screen', 128, 12, DG, peak=[4, 7, 10])
def dragoon_dragon_sky(c, f):
    """용기사의 비상(필살기): 달을 가리는 푸른 용의 날개 아래 빛의 창이 적진에 떨어진다."""
    cx, cy = 64, 58
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, DG.BL[0])
    c.disc(98, 24, 11, DG.GD[1]); c.disc(101, 22, 9, DG.BL[0])      # 초승달
    for k in range(4):                                  # 날개깃 바람줄(칸마다 흐른다)
        y = 20 + ((k * 23 + f * 9) % 80)
        c.line([(14 + k * 4, y), (30 + k * 4, y - 3)], DG.BL[3])
    for s in (-1, 1):                                   # 거대한 용 날개
        wing(c, cx + s * 4, 50, s, ease(u), [DG.BL[0], DG.BL[1], DG.BL[2]], span=54)
    c.disc(cx, 52, 6, DG.BL[1]); c.poly([(cx - 5, 46), (cx, 36), (cx + 5, 46)], DG.BL[2])
    c.px(cx - 2, 44, DG.RD[0]); c.px(cx + 2, 44, DG.RD[0])
    if f >= 4:
        v = ph(f, 4, 9)
        y = lerp(10, 88, ease(v))
        beam(c, cx - 30, y - 50, cx - 30, y, 5, [DG.BL[2], DG.BL[3], DG.W[0]])
        stamp(c, 'spear', cx - 30, y, SPEAR, rot=math.pi, scale=4)
    if f >= 9:
        flash(c, cx - 30, 92, [22, 15, 8][f - 9], [DG.BL[2], DG.BL[3], DG.W[0]])
        rays(c, cx - 30, 92, 12, 12, 30 + (f - 9) * 10, DG.BL[3], ry=.6, alt=20)
    for k in range(14): c.px(8 + (k * 29 + f * 3) % 112, 8 + (k * 13) % 50, DG.W[0] if k % 3 else DG.BL[3])


# ── 마을 청년 ─────────────────────────────────────────────────────────────────
VL = Pal(ST=['#3a3430', '#7a7068', '#b8aca0', '#ece2d4'], DU=['#6a5438', '#a88c62'], FI=['#a8280c', '#f07820', '#ffd060'], WD=['#5a3418', '#9a6a38'], W=['#ffffff'])
STONE = dict(k=VL.ST[0], d=VL.ST[3], c=VL.ST[2], b=VL.ST[1])
FOLK = dict(k=VL.ST[0], d=VL.DU[1], c=VL.WD[1])


@sheet('villager_pebbles', 'allTargets', 64, 10, VL, peak=[3, 5, 7])
def villager_pebbles(c, f):
    """돌팔매 세례: 오른쪽 위에서 돌멩이가 포물선을 그리며 쏟아져 흙먼지를 올린다."""
    cx = CX
    R_ = rng('vlp', 1)
    if f == 0:                                          # 첫 칸: 오른쪽 위 하늘에 돌 무리가 막 들어온다
        for k in range(4): stamp(c, 'stone', 48 + k * 3, 6 + (k % 2) * 4, STONE)
    for k in range(7):
        t0 = R_.uniform(.05, .5); tx = cx + R_.uniform(-14, 14)
        d = clamp((f / 9 - t0) * 2.2)
        if 0 < d < 1:
            x = lerp(tx + 30, tx, d); y = lerp(-4, 46, d) - math.sin(d * math.pi) * 10
            stamp(c, 'stone', x, y, STONE, scale=1 + (k % 3 == 0))
        elif d >= 1 and (f / 9 - t0) * 2.2 < 1.8:
            e = (f / 9 - t0) * 2.2 - 1
            puff(c, tx, 50 - e * 4, 2 + e * 5, [VL.DU[0], VL.DU[1]])
            c.px(tx - 3 - e * 6, 46 - e * 6, VL.ST[2]); c.px(tx + 3 + e * 6, 47 - e * 5, VL.ST[1])
    ground_ring(c, cx, 54, 8 + f * 2, VL.DU[1], 1) if f >= 4 else None


@sheet('villager_mob_sky', 'screen', 128, 12, VL, peak=[4, 7, 10])
def villager_mob_sky(c, f):
    """마을 총출동(필살기): 횃불을 든 마을 사람들이 몰려나와 돌·냄비·쇠스랑을 적진에 퍼붓는다."""
    cx, cy = 64, 60
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, VL.ST[0])
    for k in range(9):                                  # 몰려오는 실루엣(오른쪽 → 왼쪽)
        x = 118 - k * 11 - ease(ph(f, 2, 10)) * 10
        y = lerp(132, 98 + (k % 2) * 5, ease(ph(f, k * .2, 3 + k * .2)))
        stamp(c, 'folk', x, y, FOLK, scale=3)
        if k % 3 == 0:
            c.line([(x - 5, y - 10), (x - 5, y - 22)], VL.WD[1]); LM.flame(c, x - 5, y - 23, 7 + (f + k) % 3, 3, [VL.FI[0], VL.FI[1], VL.FI[2]])
        elif k % 3 == 1:
            c.line([(x + 4, y - 8), (x + 4, y - 24)], VL.WD[1]); c.line([(x + 2, y - 24), (x + 2, y - 28)], VL.ST[2]); c.line([(x + 6, y - 24), (x + 6, y - 28)], VL.ST[2])
    if f >= 5:
        R_ = rng('vms', 1)
        for k in range(12):                             # 날아가는 돌·냄비
            t0 = R_.uniform(0, .6); d = clamp((ph(f, 5, 11) - t0) * 2)
            if 0 < d < 1:
                x = lerp(100, 14 + R_.uniform(0, 30), d); y = lerp(80, 70 + R_.uniform(0, 30), d) - math.sin(d * math.pi) * 30
                stamp(c, 'stone' if k % 2 else 'rock', x, y, STONE, rot=d * 6, scale=2)
    if f >= 9: flash(c, 30, 80, [16, 10, 5][f - 9], [VL.FI[0], VL.FI[2], VL.W[0]])


# ── 부족 전사 ─────────────────────────────────────────────────────────────────
TB = Pal(WD=['#3a1c0c', '#8a4c1c', '#d08a3c', '#f8c878'], RD=['#b02818'], GR=['#1c5a2c', '#3cb05a', '#a8f0a0'], SP=['#1c6a7a', '#5ce0e8'], W=['#ffffff'], GD=['#ffd040'])
BOOM = dict(k=TB.WD[0], d=TB.WD[3], c=TB.WD[2], b=TB.WD[1])
TOTEM = dict(k=TB.WD[0], d=TB.WD[2], c=TB.WD[1], g=TB.RD[0])


@sheet('tribal_boomerang', 'projectile', 32, 4, TB)
def tribal_boomerang(c, f):
    """부메랑: 붉은 줄무늬 부메랑이 회전하며 왼쪽(적)으로 난다."""
    a = -f * math.pi / 2
    for s in (-1, 1):
        ex, ey = 11 + math.cos(a + s * .9) * 8, 16 + math.sin(a + s * .9) * 8
        c.line([(11, 16), (ex, ey)], TB.WD[1], 3); c.line([(11, 16), (ex, ey)], TB.WD[3], 1)
        c.px((11 + ex) / 2, (16 + ey) / 2, TB.RD[0])
    c.arc(11, 16, 10, 20 - f * 90, 100 - f * 90, TB.WD[2], 1)
    for i in range(3): c.px(24 + i * 3, 16 + (i + f) % 3 - 1, [TB.WD[3], TB.WD[2], TB.GR[1]][i])


@sheet('tribal_spirit_sky', 'screen', 128, 12, TB, peak=[4, 7, 10])
def tribal_spirit_sky(c, f):
    """조상신의 부름(필살기): 토템이 솟고 독수리 정령이 날개를 펴 푸른 불꽃으로 적진을 휩쓴다."""
    cx, cy = 64, 60
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, TB.WD[0])
    y = lerp(150, 78, ease(u))
    stamp(c, 'totem', cx, y, TOTEM, scale=4)
    if f >= 3:
        v = ph(f, 3, 7)
        for s in (-1, 1): wing(c, cx + s * 6, 42, s, ease(v), [TB.SP[0], TB.SP[1], TB.W[0]], span=50)
        c.poly([(cx - 6, 36), (cx + 6, 36), (cx, 48)], TB.GD[0]); c.px(cx - 3, 38, TB.WD[0]); c.px(cx + 3, 38, TB.WD[0])
    if f >= 6:
        R_ = rng('tbs', f)
        for k in range(8):                              # 정령 불꽃이 왼쪽으로 휩쓴다
            x = lerp(96, 10, ph(f, 6, 10)) + R_.uniform(-10, 10); yy = 70 + k * 5
            LM.flame(c, x, yy, 8 + k % 3, 3, [TB.SP[0], TB.SP[1], TB.W[0]], lean=-.6)
    if f >= 9: flash(c, 28, 80, [18, 12, 6][f - 9], [TB.GR[1], TB.SP[1], TB.W[0]])
    motes(c, 'tbm', 16, cx, 116, 50, 90, f / 11, [TB.GR[2], TB.SP[1], TB.GD[0]], seed=2)


# ── 점성술사 ──────────────────────────────────────────────────────────────────
FT = Pal(NV=['#0c0c2a', '#2a2a6a', '#5a5ab8'], PU=['#6a2c9a', '#c070f0'], GD=['#b08420', '#ffd84a', '#fff6c0'], FI=['#c83c14', '#ff9a3c'], W=['#ffffff'], CY=['#7ae0ff'])
STAR = dict(k=FT.GD[0], d=FT.GD[2], c=FT.GD[1], b=FT.GD[1], a=FT.GD[0])


@sheet('fortune_teller_zodiac', 'allAllies', 64, 10, FT, peak=[3, 5, 7])
def fortune_teller_zodiac(c, f):
    """별점: 아군 머리 위에 황도 12궁 고리가 돌고 별자리 선이 이어지며 행운의 별이 내려앉는다."""
    cx, cy = CX, 20
    u = ph(f, 0, 3)
    r = 18 * ease(u)
    c.ring(cx, cy, r, FT.PU[1], 1, r * .42); c.ring(cx, cy, r * .75, FT.NV[2], 1, r * .32)
    pts = []
    for k in range(12):
        a = f * .18 + k * math.tau / 12
        x, y = orbit(cx, cy, r, a, r * .42)
        c.px(x, y, FT.GD[2] if k % 3 == 0 else FT.GD[1]); pts.append((x, y))
    if f >= 3:
        n = min(6, f - 2)
        c.line([pts[i * 2] for i in range(n)], FT.CY[0], 1)
    if f >= 4:
        v = ph(f, 4, 9)
        for k in range(3):
            stamp(c, 'star4', cx - 14 + k * 14, lerp(cy, 44, ease(clamp(v * 1.4 - k * .2))), STAR, scale=1)
        ground_ring(c, cx, GY, 6 + v * 16, FT.GD[1], 1)
    motes(c, 'ftz', 10, cx, GY, 20, 44, f / 9, [FT.GD[2], FT.PU[1], FT.W[0]], seed=1)


@sheet('fortune_teller_meteor_sky', 'screen', 128, 12, FT, peak=[4, 7, 10])
def fortune_teller_meteor_sky(c, f):
    """천궁 붕괴(필살기): 밤하늘에 별자리가 그려진 뒤 별똥별 비가 적진(왼쪽 아래)으로 쏟아진다."""
    cx, cy = 64, 58
    u = ph(f, 0, 4)
    shade(c, cx, cy, 58, 48, FT.NV[0])
    R0 = rng('ftc', 0)
    stars = [(R0.uniform(14, 114), R0.uniform(10, 60)) for _ in range(14)]
    c.ring(cx, 40, 20 + f * 5, FT.PU[1], 1, (20 + f * 5) * .45) if f < 6 else None   # 퍼지는 천구 고리
    for i, (x, y) in enumerate(stars):
        if i / 14 < u + .2: c.spark(x, y, 1 + ((i + f) % 4 == 0), FT.GD[2] if (i + f) % 2 else FT.W[0])
    if f >= 2:
        n = min(len(stars) - 1, (f - 1) * 2)
        for i in range(n):
            if i % 4 != 3: c.line([stars[i], stars[i + 1]], FT.NV[2], 1)
    if f >= 5:
        R_ = rng('ftm', 1)
        for k in range(12):
            t0 = R_.uniform(0, .6); d = clamp((ph(f, 5, 11) - t0) * 1.8)
            if 0 < d < 1:
                x = lerp(124, 10 + R_.uniform(0, 40), d); y = lerp(-4, 80 + R_.uniform(0, 30), d)
                meteor(c, x, y, 16, [FT.FI[0], FT.FI[1], FT.GD[1], FT.W[0]], dx=-1.1, dy=1, r=2 + (k % 3 == 0))
            elif d >= 1:
                c.disc(10 + R_.uniform(0, 40), 80 + R_.uniform(0, 30), 3, FT.FI[1]) if f < 11 else None
    if f >= 9: flash(c, 34, 94, [20, 14, 8][f - 9], [FT.PU[1], FT.GD[1], FT.W[0]])


import lib_mage as LM  # noqa: E402  (flame)

KEYS = [k for k in REG if k.split('_')[0] in ('princess', 'archmage', 'heavy', 'mercenary', 'dragoon', 'villager', 'tribal', 'fortune')]

if __name__ == '__main__':
    sys.modules['r2w3_p3'] = sys.modules[__name__]
    import r2w3_skills
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    for cl in r2w3_skills.CLASSES:
        if cl['batch'] != 'p3': continue
        own = [k for sk in cl['skills'] for k in sk['layers'] if k in REG]
        if only and not set(only) & set(own): continue
        r2w3_skills.build_class(cl['classId'], sys.argv[1:])
