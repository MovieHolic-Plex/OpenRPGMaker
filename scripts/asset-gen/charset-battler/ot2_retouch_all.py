"""Weapon-aware direct pixel retouching pipeline for charset-battlers (OT2 upgrade).

Preserves every character's own face, hair, hat, armor, tunic, cape, shield, boots,
and weapon identity while fixing the systemic procedural defects:
  - Narrow upright idle -> grounded battle stance (using own windup legs)
  - Upright walk_a/walk_c -> forward-leaning combat dash
  - Static attack_windup -> coiled back-weight crouch + weapon-tip charge glint
  - Vertical-stick attack_strike -> own lunge body + class-colored razor air-split smear
  - Weak 3-dot attack -> clean speed streaks + tip impact glint
  - Awkward '/' stick attack_follow -> swept-through low-back-right own weapon + Zanshin settle
  - Idle-cloned defend / sparkless guard_hit -> vertical guard + braced parry sparks
  - Rubber-hose noodle arms in cast_charge/cast_raise/cast_release & 3-arm item -> clean own-palette arms + glowing own weapon / emerald potion
  - Sideways pipe-arm victory & flagpole front -> front-facing triumph & natural outward grip
  - Dot-sprinkled skill -> blazing heroic weapon aura + rising ground sparks

Usage:
  python3 scripts/asset-gen/charset-battler/ot2_retouch_all.py [--dry-run] [id1 id2 ...]
"""
import io, math, subprocess, sys
from collections import Counter
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cb_lib import POSES, SRC_DIR, validate
from weapons import stamp as stamp_weapon, fitting_hand

ROOT = Path(__file__).resolve().parents[3]
SRC = Path(SRC_DIR)

# Bespoke characters: leave silver-swordswoman completely untouched; actor1-0 is already hand-retouched!
SKIP_ALL = {"actor1-0", "silver-swordswoman"}
# HEROES6 already have custom hand-authored unique silhouettes (samurai/ninja/monk/bard/druid/witch)
HEROES6 = {"actor3-0-samurai", "actor3-2", "actor3-5", "actor3-6", "actor3-4", "actor4-7"}

# Authoritative weapon & aura theme per Actor ID (matches art4/art5/repaint_weapons.py!)
# theme: "cyan" (steel/blade), "gold" (holy/heavy/paladin), "violet" (arcane/dark/witch), "emerald" (nature/ranger/alchemist)
ROLE_META = {
    "actor1-0-spear": ("spear", "cyan"),
    "actor1-1": ("spear", "gold"),       # valkyrie
    "actor1-2": ("sword", "gold"),       # paladin
    "actor1-3": ("sword", "violet"),     # red_mage (rapier)
    "actor1-4": ("greatsword", "violet"),# dark_knight
    "actor1-5": ("staff", "violet"),     # mage
    "actor1-6": ("staff", "cyan"),       # chronomancer
    "actor1-7": ("staff", "gold"),       # cleric
    "actor2-0": ("sword", "cyan"),       # guardian
    "actor2-1": ("dagger", "cyan"),      # thief
    "actor2-2": ("staff", "emerald"),    # beast_tamer
    "actor2-3": ("bow", "emerald"),      # ranger
    "actor2-4": ("sword", "cyan"),       # pirate (cutlass)
    "actor2-5": ("witch_staff", "violet"),# sorceress
    "actor2-6": ("bow", "emerald"),      # elf_archer
    "actor2-7": ("bow", "gold"),         # hunter (crossbow)
    "actor3-0": ("staff", "violet"),     # classic mage
    "actor3-0-samurai": ("katana", "cyan"),
    "actor3-1": ("fist", "gold"),        # brawler
    "actor3-2": ("kunai", "cyan"),       # ninja
    "actor3-3": ("fist", "gold"),        # martial_artist
    "actor3-4": ("druid_staff", "emerald"),# druid
    "actor3-5": ("fist", "gold"),        # monk
    "actor3-6": ("lute", "gold"),        # bard
    "actor3-7": ("greatsword", "gold"),  # general
    "actor4-0": ("dagger", "cyan"),      # scout
    "actor4-1": ("sword", "gold"),       # prince (royal_rapier)
    "actor4-2": ("axe", "gold"),         # berserker
    "actor4-3": ("gun", "gold"),         # gunner
    "actor4-4": ("fan", "violet"),       # dancer
    "actor4-5": ("staff", "emerald"),    # alchemist
    "actor4-6": ("staff", "violet"),     # summoner
    "actor4-7": ("witch_staff", "violet"),# witch
    "fs-valen": ("staff", "violet"),     # inquisitor valen
}

AURA = {
    "cyan":    ((255,255,255,255), (218,246,255,255), (118,200,255,255), (46,124,238,255)),
    "gold":    ((255,255,255,255), (255,244,174,255), (255,196,70,255),  (214,116,24,255)),
    "violet":  ((255,255,255,255), (234,212,255,255), (176,118,248,255), (96,46,184,255)),
    "emerald": ((255,255,255,255), (206,255,220,255), (96,230,148,255),  (32,144,82,255)),
}

C_OUT   = (24, 24, 34, 255)
C_WOUT  = (41, 14, 10, 255)
C_SPARK_W = (255, 255, 255, 255)
C_SPARK_Y = (255, 238, 154, 255)
C_SPARK_O = (255, 174, 52, 255)
C_POT_W = (236, 255, 246, 255)
C_POT_L = (118, 246, 168, 255)
C_POT_M = (38, 192, 108, 255)
C_POT_D = (20, 116, 68, 255)
C_CORK  = (186, 122, 68, 255)
C_BLL   = (206, 224, 236, 255)
C_BLM   = (138, 160, 180, 255)

# Pre-retouch immutable baseline commit so rerunning stays 100% repeatable after commits.
DEFAULT_BASE_REV = "7a24d7159e18d51ecd258cc628c5314812ba3b47"
STAMPABLE_WEAPONS = (
    "sword", "greatsword", "dagger", "staff", "mace", "spear",
    "axe", "bow", "katana", "kunai", "lute", "druid_staff", "witch_staff",
)
NO_STAMP_KINDS = ("bow", "gun", "fist", "fan", "lute")

def load_orig_git(cid, pose, base_rev=DEFAULT_BASE_REV):
    """Read from the fixed pre-retouch git revision so regeneration is always idempotent."""
    try:
        b = subprocess.check_output(
            ["git", "show", f"{base_rev}:tiledata/charset-battlers/{cid}/{pose}.png"],
            cwd=str(ROOT), stderr=subprocess.DEVNULL
        )
        return Image.open(io.BytesIO(b)).convert("RGBA")
    except Exception:
        return Image.open(SRC / cid / f"{pose}.png").convert("RGBA")

def px_set(im, x, y, rgba):
    if 0 <= x < 48 and 0 <= y < 48:
        im.putpixel((x, y), rgba)

def erase_region(im, x0, y0, x1, y1):
    px = im.load()
    for y in range(max(0, y0), min(48, y1)):
        for x in range(max(0, x0), min(48, x1)):
            px[x, y] = (0, 0, 0, 0)

def add_outline(layer, col=C_OUT):
    px = layer.load()
    out = layer.copy()
    opx = out.load()
    for y in range(1, 47):
        for x in range(1, 47):
            if px[x, y][3] == 0:
                if any(px[x + dx, y + dy][3] > 0 for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]):
                    opx[x, y] = col
    return out

def draw_sparkle(im, cx, cy, c_core, c_arm, big=False):
    px_set(im, cx, cy, c_core)
    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
        px_set(im, cx + dx, cy + dy, c_core if big else c_arm)
    if big:
        for dx, dy in [(-2,0),(2,0),(0,-2),(0,2)]:
            px_set(im, cx + dx, cy + dy, c_arm)

def safe_stamp_weapon(layer, kind, angle, hand):
    """Stamp genuine hand-pixelled equipment from weapons.py with safe fitting (no silent fallback)."""
    if kind not in STAMPABLE_WEAPONS:
        raise ValueError(f"Unsupported stamp weapon kind: {kind!r}")
    fh = fitting_hand(kind, angle, hand)
    stamp_weapon(layer, kind, angle, fh)

def sample_char_colors(idle_im, front_im):
    """Sample this character's OWN dominant sleeve/tunic colors and skin tone!"""
    # Torso region (x=19..28, y=32..38) on front_im or idle_im
    tunic_cols = []
    px = front_im.load()
    for y in range(32, 39):
        for x in range(19, 29):
            r, g, b, a = px[x, y]
            if a == 255 and (r + g + b) > 75:
                tunic_cols.append((r, g, b, 255))
    skin_cols = []
    for y in range(26, 33):
        for x in range(20, 28):
            r, g, b, a = px[x, y]
            if a == 255 and r > 170 and g > 110 and b > 70 and r >= g >= b:
                skin_cols.append((r, g, b, 255))
    if tunic_cols:
        top = [c for c, _ in Counter(tunic_cols).most_common(3)]
        t_mid = top[0]
        t_dark = tuple(max(18, int(v * 0.72)) for v in t_mid[:3]) + (255,)
        t_light = tuple(min(255, int(v * 1.25) + 12) for v in t_mid[:3]) + (255,)
    else:
        t_dark, t_mid, t_light = (42, 54, 120, 255), (68, 92, 178, 255), (108, 138, 224, 255)
    if skin_cols:
        s_mid = Counter(skin_cols).most_common(1)[0][0]
        s_light = tuple(min(255, v + 18) for v in s_mid[:3]) + (255,)
    else:
        s_mid, s_light = (238, 168, 132, 255), (252, 206, 174, 255)
    return t_dark, t_mid, t_light, s_mid, s_light

def draw_razor_smear(im, cx, cy, r_outer, a_start, a_end, aura):
    C_W, C_L, C_M, C_D = aura
    px = im.load()
    for y in range(2, 45):
        for x in range(0, 46):
            vx, vy = x - cx, y - cy
            r = math.hypot(vx * 0.92, vy * 1.06)
            if r > r_outer or r < 10.5: continue
            a = math.degrees(math.atan2(vy, vx)) % 360
            s, e = a_start % 360, a_end % 360
            diff = (s - a) % 360
            span = (s - e) % 360
            if diff > span: continue
            t = diff / max(span, 1)
            band_w = 1.2 + 5.8 * (t ** 1.25)
            d_out = r_outer - r
            if d_out > band_w: continue
            if d_out < 1.6 and t > 0.22: col = C_W
            elif d_out < 3.0 and t > 0.35:
                if 2.1 < d_out < 2.6 and t < 0.72: continue
                col = C_L
            elif d_out < 4.7 and t > 0.48:
                if 3.4 < d_out < 4.2: continue
                col = C_M
            elif t > 0.58 and (x + y) % 2 == 0: col = C_D
            elif d_out < 1.3 and t > 0.08: col = C_M if t > 0.14 else C_D
            else: continue
            px[x, y] = col

def draw_pierce_smear(im, tip_x, tip_y, aura):
    """Supersonic piercing thrust smear for spears & lances!"""
    C_W, C_L, C_M, C_D = aura
    # Sharp tapered thrust cone shooting straight left!
    for dx in range(0, 18):
        x = tip_x + dx
        if x >= 44: break
        px_set(im, x, tip_y, C_W if dx < 12 else C_L)
        if dx < 14:
            px_set(im, x, tip_y - 1, C_W if dx < 8 else C_L)
            px_set(im, x, tip_y + 1, C_L if dx < 8 else C_M)
        if 2 <= dx <= 11:
            px_set(im, x, tip_y - 2, C_M if dx < 8 else C_D)
            px_set(im, x, tip_y + 2, C_M if dx < 8 else C_D)
    # Supersonic shock ring around shaft
    rx = min(14, tip_x + 7)
    for dy in range(-6, 7):
        col = C_W if abs(dy) <= 2 else (C_L if abs(dy) <= 4 else C_M)
        px_set(im, rx + (1 if abs(dy) >= 4 else 0), tip_y + dy, col)

def detect_weapon_tip_left(im):
    """Find leftmost opaque pixel in middle-band (y=20..40) = weapon tip in attack pose."""
    px = im.load()
    for x in range(0, 26):
        ys = [y for y in range(20, 41) if px[x, y][3] == 255]
        if ys:
            return x, sum(ys) // len(ys)
    return 4, 34

def detect_top_right_tip(im):
    """Find highest/rightmost weapon tip in attack_windup."""
    px = im.load()
    best = None
    for y in range(6, 32):
        for x in range(28, 47):
            if px[x, y][3] == 255:
                if best is None or (x - y) > (best[0] - best[1]):
                    best = (x, y)
    return best

def has_vertical_strike(strike_im, attack_im):
    """Detect if attack_strike has the procedural vertical weapon sticking straight up above head."""
    sb = strike_im.getbbox()
    ab = attack_im.getbbox()
    if not sb or not ab: return False
    # Vertical stick goes at least 5px higher than attack's head!
    return sb[1] <= ab[1] - 5

def has_low_left_slash_stick(follow_im, attack_im):
    """Detect awkward '/' weapon stick reaching down-left (x < 12, y >= 40) in attack_follow."""
    px = follow_im.load()
    apx = attack_im.load()
    low_left_follow = sum(1 for y in range(40, 45) for x in range(0, 12) if px[x, y][3] == 255)
    low_left_attack = sum(1 for y in range(40, 45) for x in range(0, 12) if apx[x, y][3] == 255)
    return low_left_follow >= 4 and low_left_follow > low_left_attack + 2

def has_front_flagpole(front_im):
    """Detect detached vertical weapon pasted on screen-right (x >= 30, y <= 31) of front pose."""
    px = front_im.load()
    right_high = sum(1 for y in range(20, 32) for x in range(31, 38) if px[x, y][3] == 255)
    left_high = sum(1 for y in range(20, 32) for x in range(10, 17) if px[x, y][3] == 255)
    return right_high >= 6 and right_high > left_high + 4

def has_back_weapon_in_cast(cast_im):
    """Detect vertical weapon glued to back in cast_charge/item (Actor1~4 procedural artifact)."""
    px = cast_im.load()
    col_hits = sum(1 for y in range(22, 36) for x in range(30, 34) if px[x, y][3] == 255)
    return col_hits >= 14

def clean_stray_dots(im):
    """Remove isolated 1-2px grey motion dots floating above horizontal blade (x=5..16, y=26..32)."""
    px = im.load()
    to_clear = []
    for y in range(25, 32):
        for x in range(4, 16):
            if px[x, y][3] == 255:
                nbrs = sum(1 for dy in (-1,0,1) for dx in (-1,0,1)
                           if (dx or dy) and 0 <= x+dx < 48 and 0 <= y+dy < 48 and px[x+dx, y+dy][3] == 255)
                if nbrs <= 1:
                    to_clear.append((x, y))
    for x, y in to_clear:
        px[x, y] = (0, 0, 0, 0)

def recolor_layer_aura(layer, aura):
    """Tint steel/weapon highlights cleanly with magic/skill aura while keeping outline crisp."""
    C_W, C_L, C_M, C_D = aura
    px = layer.load()
    for y in range(48):
        for x in range(48):
            r, g, b, a = px[x, y]
            if a == 0: continue
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            if lum < 55: px[x, y] = C_D
            elif lum < 135: px[x, y] = C_M
            elif lum < 210: px[x, y] = C_L
            else: px[x, y] = C_W

def retouch_character(cid, dry_run=False, base_rev=DEFAULT_BASE_REV):
    is_people = cid.startswith("people")
    is_hero6 = cid in HEROES6
    kind, theme = ROLE_META.get(cid, ("sword", "cyan"))
    aura = AURA[theme]
    C_W, C_L, C_M, C_D = aura

    # Load clean pre-retouch baseline poses
    orig = {p[0]: load_orig_git(cid, p[0], base_rev=base_rev) for p in POSES}
    t_dark, t_mid, t_light, s_mid, s_light = sample_char_colors(orig["idle"], orig["front"])
    out = {}

    # ── 1) IDLE: Widen narrow upright stance on Actor1~4 using own windup legs! ──
    idle_cur = orig["idle"].copy()
    if not is_people and not is_hero6:
        # Compare bottom leg span of idle vs attack_windup
        ib = [x for y in range(40, 45) for x in range(48) if idle_cur.getpixel((x, y))[3] == 255]
        wb = [x for y in range(40, 45) for x in range(48) if orig["attack_windup"].getpixel((x, y))[3] == 255]
        if ib and wb and (max(wb) - min(wb)) >= (max(ib) - min(ib)) + 4:
            im = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
            legs = orig["attack_windup"].crop((12, 38, 37, 45))
            im.alpha_composite(legs, (11, 38))
            upper = idle_cur.crop((0, 0, 46, 39))
            im.alpha_composite(upper, (0, 0))
            if not validate(cid, "idle", im):
                idle_cur = im
                out["idle"] = im

    # ── 2) WALK_A & WALK_C: Forward-leaning combat dash! ──
    for wk_name, stride in [("walk_a", 0), ("walk_c", 1)]:
        src_w = orig[wk_name]
        im = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        im.alpha_composite(src_w.crop((8, 38, 38, 45)), (8 + stride, 38))
        # Lean full upper body (from y=0 so tall hats/plumes are never clipped) 1px forward-left & 1px down!
        im.alpha_composite(src_w.crop((2, 0, 46, 39)), (1, 1))
        if not validate(cid, wk_name, im):
            out[wk_name] = im

    # ── 3) ATTACK_WINDUP: Coiled back-right crouch + weapon-tip charge glint! ──
    wu = orig["attack_windup"]
    im_wu = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    im_wu.alpha_composite(wu.crop((8, 39, 40, 45)), (8, 39))
    # Shift full upper body (from y=0) +1px right & +1px down for real back-weight coil!
    ub = wu.crop((0, 0, 46, 40))
    im_wu.alpha_composite(ub, (1, 1))
    tip = detect_top_right_tip(im_wu)
    if tip and tip[0] < 46 and tip[1] > 2:
        draw_sparkle(im_wu, min(46, tip[0] + 1), max(2, tip[1] - 1), C_SPARK_W, C_SPARK_Y, big=False)
    if not validate(cid, "attack_windup", im_wu):
        out["attack_windup"] = im_wu

    # ── 4) ATTACK_STRIKE: Replace awkward vertical-up stick with razor air-split smear! ──
    if kind in ("bow", "gun"):
        # Ranged: keep bow/gun strike pose, add crisp draw/muzzle flash!
        st = orig["attack_strike"].copy()
        tx, ty = detect_weapon_tip_left(st)
        draw_sparkle(st, max(2, tx), ty, C_W, C_L, big=True)
        if not validate(cid, "attack_strike", st):
            out["attack_strike"] = st
    elif kind == "fist" or is_hero6:
        # Custom martial/samurai/ninja/bard/druid/witch: keep bespoke pose, add crisp flash accent!
        st = orig["attack_strike"].copy()
        tx, ty = detect_weapon_tip_left(st)
        for dx in range(0, 6):
            px_set(st, max(0, tx - 1) + dx, ty - 2, C_L if dx < 3 else C_M)
            px_set(st, max(0, tx - 1) + dx, ty + 2, C_M if dx < 3 else C_D)
        if not validate(cid, "attack_strike", st):
            out["attack_strike"] = st
    elif (not is_people and not is_hero6 and kind in ("sword","greatsword","dagger","staff","witch_staff","druid_staff","mace","spear","axe")) or has_vertical_strike(orig["attack_strike"], orig["attack"]):
        # Vertical stick -> own attack lunge body + weapon-matched razor smear!
        st = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        body = orig["attack"].copy()
        clean_stray_dots(body)
        tx, ty = detect_weapon_tip_left(body)
        if kind == "spear":
            st.alpha_composite(body, (-1, 0))
            draw_pierce_smear(st, max(0, tx - 1), ty, aura)
        else:
            draw_razor_smear(st, cx=22, cy=30, r_outer=21.0, a_start=-52, a_end=154, aura=aura)
            st.alpha_composite(body, (-1, 0))
            for x in range(max(0, tx - 1), min(16, tx + 11)):
                px_set(st, x, ty, C_W if x < tx + 8 else C_L)
                px_set(st, x, ty - 1, C_L if x < tx + 6 else C_M)
        if not validate(cid, "attack_strike", st):
            out["attack_strike"] = st

    # ── 5) ATTACK: Clean stray dots + crisp weapon-matched speed streaks & tip glint! ──
    att = orig["attack"].copy()
    clean_stray_dots(att)
    tx, ty = detect_weapon_tip_left(att)
    for x in range(max(1, tx), min(15, tx + 11)):
        if x % 3 != 0 or x < tx + 5:
            px_set(att, x, max(20, ty - 3), C_L if x < tx + 5 else C_M)
    for x in range(max(2, tx + 1), min(14, tx + 10)):
        px_set(att, x, min(42, ty + 3), C_M if x < tx + 6 else C_D)
    for sx, sy, c in [
        (max(0, tx - 1), ty, C_W), (tx, ty, C_W),
        (max(0, tx), max(18, ty - 4), C_L), (tx + 1, max(19, ty - 3), C_W),
        (max(0, tx), min(43, ty + 4), C_M), (tx + 1, min(42, ty + 3), C_L),
    ]:
        px_set(att, sx, sy, c)
    if not validate(cid, "attack", att):
        out["attack"] = att

    # ── 6) ATTACK_FOLLOW: Remove awkward '/' floor stick -> swept-through own weapon + Zanshin! ──
    af = orig["attack_follow"].copy()
    is_melee_actor = (
        not is_people and not is_hero6
        and (
            kind in ("sword", "greatsword", "dagger", "staff", "witch_staff", "druid_staff", "mace", "axe")
            or (kind == "spear" and has_low_left_slash_stick(af, orig["attack"]))
        )
    )
    is_melee_people = (
        is_people
        and sum(1 for y in range(40, 45) for x in range(0, 12) if af.getpixel((x, y))[3] == 255) >= 12
        and has_low_left_slash_stick(af, orig["attack"])
    )
    if is_melee_actor or is_melee_people:
        # Erase ONLY the awkward '/' stick left of the front leg/boot!
        erase_region(af, 0, 32, 14, 38)
        erase_region(af, 0, 38, 12, 41)
        erase_region(af, 0, 41, 10, 45)
        sw = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        if is_people:
            # Mirror this character's OWN horizontal weapon from orig["attack"] so clubs/staves/axes stay 100% authentic!
            att_src = orig["attack"].copy()
            clean_stray_dots(att_src)
            w_crop = att_src.crop((0, 24, 17, 43))
            w_bb = w_crop.getbbox()
            if w_bb:
                w_trim = w_crop.crop(w_bb).transpose(Image.FLIP_LEFT_RIGHT)
                # Anchor grip (left side of flipped weapon) at hand (27, 36)
                hy = 36 - w_trim.height // 2
                hx = min(27, 47 - w_trim.width)
                sw.alpha_composite(w_trim, (max(24, hx), max(22, hy)))
        else:
            # Stamp character's OWN weapon swept cleanly low-back-right (angle 180 = straight right trailing from hip)!
            safe_stamp_weapon(sw, kind, 180, (27, 36))
        erase_region(sw, 0, 44, 48, 48)
        af.alpha_composite(sw)
        # Clean gloved hand gripping swept hilt
        hand = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        for dx, dy, c in [(26, 35, t_mid), (27, 35, s_mid), (26, 36, t_dark), (27, 36, s_light)]:
            px_set(hand, dx, dy, c)
        af.alpha_composite(add_outline(hand, C_WOUT))
        # Subtle fading wind wisp on left showing full 270-deg whip-through
        for x, y, c in [(3, 35, C_D), (4, 36, C_M), (5, 37, C_L), (6, 37, C_M), (7, 37, C_D), (5, 39, C_D), (6, 39, C_M)]:
            px_set(af, x, y, c)
    # Zanshin 1px lower settle on full upper body (from y=0 so tall hats/weapons are never clipped; keeps legs on y=44!)
    af_z = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    af_z.alpha_composite(af.crop((0, 38, 48, 45)), (0, 38))
    af_z.alpha_composite(af.crop((0, 0, 48, 39)), (0, 1))
    if not validate(cid, "attack_follow", af_z):
        out["attack_follow"] = af_z

    # ── 7) DEFEND & GUARD_HIT: Vertical guard weapon + braced parry sparks! ──
    def_im = orig["defend"].copy()
    if not is_people and not is_hero6 and kind not in NO_STAMP_KINDS:
        # Build vertical guard from clean idle (keeping any shield on right untouched!)
        base_def = idle_cur.copy()
        erase_region(base_def, 0, 18, 17, 37)
        sw_v = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        safe_stamp_weapon(sw_v, kind, 90, (16, 35))
        erase_region(sw_v, 0, 44, 48, 48)
        base_def.alpha_composite(sw_v)
        if not validate(cid, "defend", base_def):
            def_im = base_def
            out["defend"] = def_im
    # GUARD_HIT for ALL 74 characters: shift +2px right brace + bright golden parry sparks!
    gh = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    gh.alpha_composite(def_im.crop((0, 0, 46, 48)), (2, 0))
    gx, gy = detect_weapon_tip_left(gh)
    sx = max(4, min(16, gx - 2))
    sy = max(20, min(33, gy))
    for dx, dy, c in [
        (0, 0, C_SPARK_W), (-1, 0, C_SPARK_W), (1, 0, C_SPARK_W), (0, -1, C_SPARK_W), (0, 1, C_SPARK_W),
        (-2, -2, C_SPARK_Y), (-3, -3, C_SPARK_O), (-2, 2, C_SPARK_Y), (-3, 3, C_SPARK_O),
        (0, -3, C_SPARK_Y), (0, 3, C_SPARK_Y), (-4, 0, C_SPARK_Y), (2, -2, C_SPARK_Y), (2, 2, C_SPARK_O),
    ]:
        px_set(gh, sx + dx, sy + dy, c)
    if not validate(cid, "guard_hit", gh):
        out["guard_hit"] = gh

    # ── 8) CAST_CHARGE / CAST_RAISE / CAST_RELEASE (fix Actor1~4 rubber-hose noodle arms!) ──
    if not is_people and not is_hero6:
        if kind == "fan":
            # Preserve dancer's fan poses (weapons.py has no fan stamp); add magic sparkles only.
            cc = orig["cast_charge"].copy()
            draw_sparkle(cc, 15, 28, C_W, C_L, big=True)
            if not validate(cid, "cast_charge", cc):
                out["cast_charge"] = cc
            cr = orig["cast_raise"].copy()
            draw_sparkle(cr, 15, 13, C_W, C_L, big=True)
            if not validate(cid, "cast_raise", cr):
                out["cast_raise"] = cr
        else:
            # Base without left weapon
            clean_idle = idle_cur.copy()
            if kind not in NO_STAMP_KINDS:
                erase_region(clean_idle, 0, 18, 17, 37)
            # cast_charge: upright glowing own weapon in front + mana orb
            cc = clean_idle.copy()
            if kind not in NO_STAMP_KINDS:
                sw_c = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
                safe_stamp_weapon(sw_c, kind, 90, (16, 35))
                recolor_layer_aura(sw_c, aura)
                erase_region(sw_c, 0, 44, 48, 48)
                cc.alpha_composite(sw_c)
            draw_sparkle(cc, 15, 28, C_W, C_L, big=True)
            for x, y, c in [(12, 31, C_M), (12, 25, C_L), (19, 24, C_M), (11, 34, C_D)]:
                px_set(cc, x, y, c)
            if not validate(cid, "cast_charge", cc):
                out["cast_charge"] = cc

            # cast_raise: clean own-palette raised forearm + glowing weapon overhead (NO head noodle!)
            cr = clean_idle.copy()
            arm = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
            for x, y, c in [
                (17, 33, t_mid), (18, 33, t_dark), (16, 32, t_mid), (17, 32, t_light),
                (15, 31, t_mid), (16, 31, t_light), (15, 30, s_mid), (16, 30, s_light),
            ]:
                px_set(arm, x, y, c)
            if kind not in NO_STAMP_KINDS:
                sw_r = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
                safe_stamp_weapon(sw_r, kind, 90, (15, 28))
                recolor_layer_aura(sw_r, aura)
                erase_region(sw_r, 0, 44, 48, 48)
                cr.alpha_composite(sw_r)
            cr.alpha_composite(add_outline(arm, C_WOUT))
            draw_sparkle(cr, 15, 13, C_W, C_L, big=True)
            for x, y, c in [(11, 19, C_L), (19, 17, C_L), (10, 25, C_M), (20, 22, C_M), (13, 38, C_M), (31, 38, C_M)]:
                px_set(cr, x, y, c)
            if not validate(cid, "cast_raise", cr):
                out["cast_raise"] = cr

        # cast_release: own attack lunge body + blazing magic release flare from weapon tip!
        crel = orig["attack"].copy()
        clean_stray_dots(crel)
        tx, ty = detect_weapon_tip_left(crel)
        draw_sparkle(crel, max(2, tx + 1), ty, C_W, C_L, big=True)
        for dx, dy, c in [(3,-4,C_L),(4,-3,C_M),(5,-2,C_D),(3,4,C_L),(4,3,C_M),(5,2,C_D),(-1,-3,C_M),(-1,3,C_M)]:
            px_set(crel, max(0, tx + 1 + dx), max(14, min(42, ty + dy)), c)
        if not validate(cid, "cast_release", crel):
            out["cast_release"] = crel

    # ── 9) ITEM (fix Actor1~4 infamous 3-arm noodle + back-sword!) ──
    if not is_people and not is_hero6:
        it = idle_cur.copy()
        if kind not in ("fist",):
            erase_region(it, 0, 18, 17, 37)
        arm = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        for x, y, c in [
            (17, 34, t_mid), (18, 34, t_dark), (16, 33, t_mid), (17, 33, t_light),
            (15, 32, t_mid), (16, 32, t_dark), (14, 31, s_light), (15, 31, s_mid),
        ]:
            px_set(arm, x, y, c)
        it.alpha_composite(add_outline(arm, C_WOUT))
        pot = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        px_set(pot, 13, 24, C_CORK); px_set(pot, 14, 24, C_CORK)
        px_set(pot, 13, 25, C_BLL);  px_set(pot, 14, 25, C_BLM)
        for y, row in [
            (26, [(12, C_POT_W), (13, C_POT_L), (14, C_POT_M), (15, C_POT_M)]),
            (27, [(11, C_POT_W), (12, C_POT_W), (13, C_POT_L), (14, C_POT_M), (15, C_POT_D)]),
            (28, [(11, C_POT_L), (12, C_POT_L), (13, C_POT_M), (14, C_POT_M), (15, C_POT_D)]),
            (29, [(12, C_POT_M), (13, C_POT_M), (14, C_POT_D), (15, C_POT_D)]),
        ]:
            for x, c in row: px_set(pot, x, y, c)
        it.alpha_composite(add_outline(pot, C_OUT))
        draw_sparkle(it, 10, 22, C_POT_W, C_POT_L, big=False)
        draw_sparkle(it, 17, 23, C_POT_W, C_POT_L, big=False)
        if not validate(cid, "item", it):
            out["item"] = it

    # ── 10) SKILL: Heroic golden/class battle aura & blazing tip flare! ──
    if not is_hero6:
        sk = orig["skill"].copy()
        tx, ty = detect_weapon_tip_left(sk)
        # Golden/theme aura flare on weapon tip + rising ground flames around boots
        S_W, S_L, S_M, S_D = AURA["gold"] if theme == "cyan" else aura
        draw_sparkle(sk, max(2, tx), max(12, ty), S_W, S_L, big=True)
        for x, y, c in [
            (max(2, tx + 3), max(14, ty + 2), S_L), (max(2, tx + 5), max(16, ty + 4), S_M),
            (11, 41, S_M), (11, 39, S_L), (10, 37, S_D),
            (34, 40, S_M), (34, 38, S_L), (35, 36, S_D),
        ]:
            px_set(sk, x, y, c)
        if not validate(cid, "skill", sk):
            out["skill"] = sk

    # ── 11) FRONT: Fix detached vertical flagpole weapon on screen-right! ──
    fr_clean = orig["front"].copy()
    if not is_people and not is_hero6 and has_front_flagpole(orig["front"]):
        erase_region(fr_clean, 30, 18, 38, 41)
        arm = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        for x, y, c in [
            (29, 34, t_mid), (30, 34, t_light), (30, 35, t_mid), (31, 35, t_light),
            (31, 36, t_dark), (32, 36, s_mid), (32, 35, s_light),
        ]:
            px_set(arm, x, y, c)
        if kind not in NO_STAMP_KINDS:
            sw_f = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
            safe_stamp_weapon(sw_f, kind, 135, (33, 35))
            erase_region(sw_f, 0, 44, 48, 48)
            fr_clean.alpha_composite(sw_f)
        fr_clean.alpha_composite(add_outline(arm, C_WOUT))
        px_set(fr_clean, 32, 35, s_light); px_set(fr_clean, 33, 35, s_mid)
        if not validate(cid, "front", fr_clean):
            out["front"] = fr_clean

    # ── 12) VICTORY & VICTORY_B: Clean front-facing triumph (Actor1~4) + sparkle hop (ALL)! ──
    if not is_people and not is_hero6 and has_front_flagpole(orig["front"]):
        vbase = orig["front"].copy()
        erase_region(vbase, 30, 18, 38, 41)
        erase_region(vbase, 13, 33, 18, 40)
        l_arm = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        for x, y, c in [
            (17, 34, t_light), (16, 34, t_mid), (15, 33, t_mid), (16, 33, t_light),
            (14, 32, t_dark), (15, 32, s_mid), (14, 31, s_light), (15, 31, s_mid),
        ]:
            px_set(l_arm, x, y, c)
        vbase.alpha_composite(add_outline(l_arm, C_WOUT))
        r_arm = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        for x, y, c in [
            (29, 34, t_dark), (30, 34, t_mid), (30, 33, t_mid), (31, 33, t_light),
            (30, 32, t_mid), (31, 32, t_light), (31, 31, t_mid), (32, 31, t_light),
            (31, 30, s_mid), (32, 30, s_light), (31, 29, s_light), (32, 29, s_mid),
        ]:
            px_set(r_arm, x, y, c)
        if kind not in NO_STAMP_KINDS:
            sw_v = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
            safe_stamp_weapon(sw_v, kind, 90, (31, 28))
            vbase.alpha_composite(sw_v)
        vbase.alpha_composite(add_outline(r_arm, C_WOUT))
        px_set(vbase, 31, 28, s_light); px_set(vbase, 32, 28, s_mid)
        v1 = vbase.copy()
        vbb = v1.getbbox()
        if vbb: draw_sparkle(v1, 31, max(3, vbb[1]), C_SPARK_W, C_SPARK_Y, big=False)
        v2 = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        v2.alpha_composite(vbase, (0, -2))
        v2bb = v2.getbbox()
        if v2bb: draw_sparkle(v2, 31, max(3, v2bb[1]), C_SPARK_W, C_SPARK_Y, big=True)
        if not validate(cid, "victory", v1): out["victory"] = v1
        if not validate(cid, "victory_b", v2): out["victory_b"] = v2
    else:
        # Preserve bespoke victory (people*, HEROES6, etc.) and add crisp 1px hop + tip star sparkle to victory_b!
        vbase = orig["victory"]
        v2 = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        v2.alpha_composite(vbase, (0, -1))
        bb = v2.getbbox()
        if bb:
            # Find highest opaque pixel for star glint
            px = v2.load()
            top_xs = [x for x in range(48) if px[x, bb[1]][3] == 255]
            tx = top_xs[len(top_xs) // 2] if top_xs else 24
            draw_sparkle(v2, tx, max(2, bb[1]), C_SPARK_W, C_SPARK_Y, big=True)
        if not validate(cid, "victory_b", v2):
            out["victory_b"] = v2

    if not dry_run:
        for pose_name, im in out.items():
            im.save(SRC / cid / f"{pose_name}.png", optimize=True)
    return list(out.keys())

def main():
    raw = sys.argv[1:]
    dry = False
    base_rev = DEFAULT_BASE_REV
    args = []
    i = 0
    while i < len(raw):
        if raw[i] == "--dry-run":
            dry = True
        elif raw[i] == "--base-rev" and i + 1 < len(raw):
            base_rev = raw[i + 1]
            i += 1
        elif not raw[i].startswith("--"):
            args.append(raw[i])
        i += 1
    targets = args or sorted(d.name for d in SRC.iterdir() if d.is_dir() and d.name not in SKIP_ALL)
    total_poses = 0
    for cid in targets:
        if cid in SKIP_ALL: continue
        updated = retouch_character(cid, dry_run=dry, base_rev=base_rev)
        total_poses += len(updated)
        print(f"{cid:18s}: {len(updated):2d} poses ({', '.join(updated)})")
    print(f"\nDone! Retouched {len(targets)} characters, {total_poses} pose files total (dry_run={dry}, base_rev={base_rev[:10]}).")

if __name__ == "__main__":
    main()
