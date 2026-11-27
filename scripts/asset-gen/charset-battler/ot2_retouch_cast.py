"""Elemental cast-sheet direct pixel retouching pipeline for charset-battlers (OT2 upgrade).

Replaces the procedural rubber-hose noodle arms and floating back-glued weapons on
Actor1~4 (+ actor1-0, actor1-0-spear, fs-valen) across all 7 elemental cast rows:
  fire, ice, thunder, heal, dark, arcane, support  (each 3 steps: charge, raise, release).

Preserves every character's own face, hair, hat, armor, tunic, shield, boots, and weapon
identity, and leaves HEROES6, people1~5, and silver-swordswoman untouched.

Usage:
  python3 scripts/asset-gen/charset-battler/ot2_retouch_cast.py [--dry-run] [--base-rev <rev>] [id1 ...]
"""
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cb_lib import CAST_TYPES, SRC_DIR, validate
from ot2_retouch_all import (
    C_OUT,
    C_WOUT,
    DEFAULT_BASE_REV,
    HEROES6,
    NO_STAMP_KINDS,
    ROLE_META,
    add_outline,
    clean_stray_dots,
    detect_weapon_tip_left,
    draw_sparkle,
    erase_region,
    load_orig_git,
    px_set,
    recolor_layer_aura,
    safe_stamp_weapon,
    sample_char_colors,
    verify_base_rev,
)

SRC = Path(SRC_DIR)

# Elemental aura palettes: (core white, bright light, mid tone, deep tone)
CAST_AURA = {
    "fire":    ((255,255,244,255), (255,222,112,255), (255,112,38,255),  (178,34,18,255)),
    "ice":     ((255,255,255,255), (206,246,255,255), (96,204,255,255),  (38,112,216,255)),
    "thunder": ((255,255,255,255), (255,248,144,255), (255,204,44,255),  (196,120,16,255)),
    "heal":    ((255,255,246,255), (206,255,220,255), (92,232,148,255),  (34,148,84,255)),
    "dark":    ((252,234,255,255), (212,150,255,255), (144,64,228,255),  (66,22,126,255)),
    "arcane":  ((255,255,255,255), (214,242,255,255), (110,192,255,255), (44,116,232,255)),
    "support": ((255,255,242,255), (192,252,232,255), (86,214,182,255),  (32,132,112,255)),
}

SKIP_CAST = {"silver-swordswoman"} | HEROES6


def is_cast_target(cid: str) -> bool:
    return cid not in SKIP_CAST and not cid.startswith("people")


def _draw_element_fx_step1(im, ct, aura):
    C_W, C_L, C_M, C_D = aura
    if ct == "fire":
        # Low ember flame cluster
        for dx, dy, c in [(0,0,C_W),(-1,0,C_L),(1,0,C_L),(0,-1,C_L),(0,-2,C_M),(-1,-1,C_M),(1,-1,C_M),(0,-3,C_D),(0,1,C_M)]:
            px_set(im, 14 + dx, 31 + dy, c)
        px_set(im, 11, 27, C_M); px_set(im, 18, 26, C_L)
    elif ct == "ice":
        # Crisp diamond crystal
        for dx, dy, c in [(0,0,C_W),(0,-2,C_L),(0,-1,C_W),(0,1,C_W),(0,2,C_L),(-1,0,C_W),(1,0,C_W),(-2,0,C_M),(2,0,C_M),(-1,-1,C_L),(1,-1,C_L),(-1,1,C_M),(1,1,C_M)]:
            px_set(im, 13 + dx, 28 + dy, c)
    elif ct == "thunder":
        # Crackling jagged mini-bolts
        for x, y, c in [(11,26,C_W),(12,27,C_L),(11,28,C_W),(12,29,C_M),(13,30,C_L),(18,24,C_L),(19,25,C_W),(18,26,C_M)]:
            px_set(im, x, y, c)
    elif ct == "heal":
        # Soft emerald/gold healing cross
        draw_sparkle(im, 14, 29, C_W, C_L, big=True)
        for x, y, c in [(10,33,C_M),(18,33,C_M),(12,24,C_L),(17,25,C_M)]:
            px_set(im, x, y, c)
    elif ct == "dark":
        # Swirling shadow orb
        for dx, dy, c in [(0,0,C_D),(-1,0,C_M),(1,0,C_M),(0,-1,C_M),(0,1,C_M),(-2,-1,C_L),(2,1,C_L),(-1,2,C_D),(1,-2,C_L)]:
            px_set(im, 14 + dx, 29 + dy, c)
    elif ct == "arcane":
        # Starlight rune diamond
        draw_sparkle(im, 14, 28, C_W, C_L, big=True)
        for x, y, c in [(10,28,C_M),(18,28,C_M),(14,24,C_M),(14,32,C_D)]:
            px_set(im, x, y, c)
    elif ct == "support":
        # Gentle swirling wind/buff motes
        for x, y, c in [(10,31,C_M),(11,30,C_L),(12,29,C_W),(14,28,C_L),(16,28,C_M),(18,29,C_D),(12,33,C_M),(15,34,C_L)]:
            px_set(im, x, y, c)


def _draw_element_fx_step2(im, ct, aura):
    C_W, C_L, C_M, C_D = aura
    if ct == "fire":
        # Blazing twin flame wisps rising from overhead tip
        draw_sparkle(im, 15, 13, C_W, C_L, big=True)
        for x, y, c in [(12,18,C_L),(11,16,C_M),(12,14,C_D),(18,17,C_L),(19,15,C_M),(18,13,C_D),(10,27,C_M),(32,26,C_M)]:
            px_set(im, x, y, c)
    elif ct == "ice":
        # Twin floating frost shards + halo sparkle
        draw_sparkle(im, 15, 12, C_W, C_L, big=True)
        for ox, oy in [(9, 19), (21, 17)]:
            px_set(im, ox, oy-1, C_L); px_set(im, ox, oy, C_W); px_set(im, ox, oy+1, C_M)
            px_set(im, ox-1, oy, C_M); px_set(im, ox+1, oy, C_L)
    elif ct == "thunder":
        # Jagged pixel lightning bolt striking down onto the raised weapon!
        bolt = [(17,5,C_M),(16,6,C_L),(15,7,C_W),(16,8,C_W),(17,9,C_L),(16,10,C_W),(15,11,C_W),(14,12,C_W),(15,13,C_L)]
        for x, y, c in bolt:
            px_set(im, x, y, c)
            px_set(im, x + 1, y, C_M if c == C_W else C_D)
        draw_sparkle(im, 15, 13, C_W, C_L, big=False)
        for x, y, c in [(10,22,C_L),(11,23,C_W),(20,20,C_L),(21,21,C_M)]:
            px_set(im, x, y, c)
    elif ct == "heal":
        # Radiant holy cross & rising light motes around character
        draw_sparkle(im, 15, 12, C_W, C_L, big=True)
        draw_sparkle(im, 10, 21, C_W, C_M, big=False)
        draw_sparkle(im, 32, 23, C_W, C_M, big=False)
        for x, y, c in [(12,38,C_L),(12,35,C_M),(32,37,C_L),(32,34,C_M)]:
            px_set(im, x, y, c)
    elif ct == "dark":
        # Dark void crescents & shadowy sparks
        for x, y, c in [(11,13,C_L),(10,14,C_W),(10,15,C_M),(11,16,C_D),(19,13,C_L),(20,14,C_W),(20,15,C_M),(19,16,C_D)]:
            px_set(im, x, y, c)
        draw_sparkle(im, 15, 14, C_L, C_M, big=False)
        for x, y, c in [(11,36,C_D),(12,34,C_M),(33,35,C_D),(32,33,C_M)]:
            px_set(im, x, y, c)
    elif ct == "arcane":
        # Starlight diamond ring overhead
        draw_sparkle(im, 15, 12, C_W, C_L, big=True)
        for x, y, c in [(10,17,C_L),(20,17,C_L),(11,23,C_M),(19,23,C_M),(13,38,C_M),(31,38,C_M)]:
            px_set(im, x, y, c)
    elif ct == "support":
        # Swirling horizontal mist/buff ribbon
        draw_sparkle(im, 15, 14, C_W, C_L, big=False)
        for x, y, c in [(9,21,C_D),(11,20,C_M),(13,19,C_L),(16,19,C_W),(19,20,C_L),(21,21,C_M),
                        (10,36,C_M),(13,37,C_L),(31,36,C_L),(34,35,C_M)]:
            px_set(im, x, y, c)


def _draw_element_fx_step3(im, ct, aura, tx, ty):
    C_W, C_L, C_M, C_D = aura
    bx = max(3, tx + 1)
    by = max(16, min(40, ty))
    draw_sparkle(im, bx, by, C_W, C_L, big=True)
    if ct == "fire":
        # Blazing fireball burst shooting left
        for dx, dy, c in [(-2,0,C_W),(-1,-1,C_W),(-1,1,C_W),(1,-2,C_L),(2,-3,C_M),(1,2,C_L),(2,3,C_M),(3,-1,C_M),(3,1,C_M),(4,-2,C_D),(4,2,C_D)]:
            px_set(im, max(0, bx + dx), max(12, min(43, by + dy)), c)
    elif ct == "ice":
        # Sharp horizontal ice lance rays
        for dx in range(-2, 6):
            px_set(im, max(0, bx + dx), by, C_W if dx < 2 else C_L)
        for dx, dy, c in [(0,-3,C_L),(1,-2,C_W),(0,3,C_L),(1,2,C_W),(3,-3,C_M),(3,3,C_M)]:
            px_set(im, max(0, bx + dx), max(12, min(43, by + dy)), c)
    elif ct == "thunder":
        # Jagged electric discharge fork
        for dx, dy, c in [(-2,-2,C_W),(-1,-1,C_L),(1,-3,C_W),(2,-4,C_L),(-2,2,C_W),(-1,1,C_L),(1,3,C_W),(2,4,C_M),(4,-2,C_M),(4,2,C_M)]:
            px_set(im, max(0, bx + dx), max(12, min(43, by + dy)), c)
    elif ct == "heal":
        # Warm rising healing motes & soft bloom
        draw_sparkle(im, max(2, bx - 1), max(14, by - 5), C_W, C_L, big=False)
        draw_sparkle(im, min(45, bx + 4), max(14, by - 3), C_W, C_M, big=False)
        for dx, dy, c in [(2,-4,C_L),(3,3,C_L),(1,4,C_M),(-1,-3,C_M)]:
            px_set(im, max(0, bx + dx), max(12, min(43, by + dy)), c)
    elif ct == "dark":
        # Dark void claw streaks
        for dx in range(-2, 5):
            px_set(im, max(0, bx + dx), max(12, by - 3 + (dx % 2)), C_L if dx < 2 else C_D)
            px_set(im, max(0, bx + dx), min(43, by + 3 - (dx % 2)), C_M if dx < 2 else C_D)
    elif ct == "arcane":
        # Focused starlight rays
        for dx, dy, c in [(3,-4,C_L),(4,-3,C_M),(5,-2,C_D),(3,4,C_L),(4,3,C_M),(5,2,C_D),(-2,0,C_W),(-1,-3,C_M),(-1,3,C_M)]:
            px_set(im, max(0, bx + dx), max(12, min(43, by + dy)), c)
    elif ct == "support":
        # Drifting buff/mist ribbon wave
        for dx, dy, c in [(-2,-1,C_W),(-1,-2,C_L),(1,-3,C_M),(3,-2,C_L),(5,-1,C_D),(-1,2,C_L),(1,3,C_M),(3,2,C_D)]:
            px_set(im, max(0, bx + dx), max(12, min(43, by + dy)), c)


def retouch_cast_character(cid: str, dry_run: bool = False, base_rev: str = DEFAULT_BASE_REV):
    kind, _ = ROLE_META.get(cid, ("sword", "cyan"))
    # Read idle & front from base_rev, OR for actor1-0 read its hand-retouched idle/attack from disk
    # (actor1-0's idle/attack are already our bespoke base in tiledata).
    if cid == "actor1-0":
        idle_base = Image.open(SRC / cid / "idle.png").convert("RGBA")
        attack_base = Image.open(SRC / cid / "attack.png").convert("RGBA")
        front_base = Image.open(SRC / cid / "front.png").convert("RGBA")
    else:
        # Use our already-retouched widened idle & clean attack on disk (or baseline if dry_run)
        idle_base = Image.open(SRC / cid / "idle.png").convert("RGBA")
        attack_base = load_orig_git(cid, "attack", base_rev=base_rev)
        front_base = load_orig_git(cid, "front", base_rev=base_rev)

    t_dark, t_mid, t_light, s_mid, s_light = sample_char_colors(idle_base, front_base)
    clean_idle = idle_base.copy()
    if kind not in NO_STAMP_KINDS:
        erase_region(clean_idle, 0, 18, 17, 37)

    # Crouched variant of clean_idle (1px lower upper body, legs fixed at y=44) for dramatic fire/thunder/dark step 1!
    crouch_idle = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    crouch_idle.alpha_composite(clean_idle.crop((0, 38, 48, 45)), (0, 38))
    crouch_idle.alpha_composite(clean_idle.crop((0, 0, 48, 39)), (0, 1))

    out = {}
    for ct, _ in CAST_TYPES:
        aura = CAST_AURA[ct]

        # ── Step 1 (charge/prepare) ──
        if kind == "fan":
            s1 = load_orig_git(cid, f"cast_{ct}_1", base_rev=base_rev)
            _draw_element_fx_step1(s1, ct, aura)
        else:
            s1 = (crouch_idle if ct in ("fire", "thunder", "dark") else clean_idle).copy()
            if kind not in NO_STAMP_KINDS:
                sw1 = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
                ang1 = 45 if ct in ("ice", "support") else 90
                hand1 = (16, 36) if ct in ("fire", "thunder", "dark") else (16, 35)
                safe_stamp_weapon(sw1, kind, ang1, hand1)
                recolor_layer_aura(sw1, aura)
                erase_region(sw1, 0, 44, 48, 48)
                s1.alpha_composite(sw1)
            _draw_element_fx_step1(s1, ct, aura)
        k1 = f"cast_{ct}_1"
        if not validate(cid, k1, s1):
            out[k1] = s1

        # ── Step 2 (raise/channel) ──
        if kind == "fan":
            s2 = load_orig_git(cid, f"cast_{ct}_2", base_rev=base_rev)
            _draw_element_fx_step2(s2, ct, aura)
        else:
            s2 = clean_idle.copy()
            arm = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
            for x, y, c in [
                (17, 33, t_mid), (18, 33, t_dark), (16, 32, t_mid), (17, 32, t_light),
                (15, 31, t_mid), (16, 31, t_light), (15, 30, s_mid), (16, 30, s_light),
            ]:
                px_set(arm, x, y, c)
            if kind not in NO_STAMP_KINDS:
                sw2 = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
                ang2 = 45 if ct in ("ice", "support") else 90
                safe_stamp_weapon(sw2, kind, ang2, (15, 28))
                recolor_layer_aura(sw2, aura)
                erase_region(sw2, 0, 44, 48, 48)
                s2.alpha_composite(sw2)
            s2.alpha_composite(add_outline(arm, C_WOUT))
            _draw_element_fx_step2(s2, ct, aura)
        k2 = f"cast_{ct}_2"
        if not validate(cid, k2, s2):
            out[k2] = s2

        # ── Step 3 (release) ──
        s3 = attack_base.copy()
        clean_stray_dots(s3)
        tx, ty = detect_weapon_tip_left(s3)
        _draw_element_fx_step3(s3, ct, aura, tx, ty)
        k3 = f"cast_{ct}_3"
        if not validate(cid, k3, s3):
            out[k3] = s3

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
        tok = raw[i]
        if tok == "--dry-run":
            dry = True
        elif tok == "--base-rev":
            if i + 1 >= len(raw) or raw[i + 1].startswith("-"):
                sys.stderr.write("Error: --base-rev requires a non-option revision value.\n")
                sys.exit(2)
            base_rev = raw[i + 1]
            i += 1
        elif tok.startswith("-"):
            sys.stderr.write(f"Error: unknown option {tok!r}\n")
            sys.exit(2)
        else:
            args.append(tok)
        i += 1
    verify_base_rev(base_rev)
    targets = [cid for cid in (args or sorted(d.name for d in SRC.iterdir() if d.is_dir() and is_cast_target(d.name))) if is_cast_target(cid)]
    # Pre-verify required baseline sprites exist before modifying any outputs.
    for cid in targets:
        if cid != "actor1-0":
            load_orig_git(cid, "attack", base_rev=base_rev)
            load_orig_git(cid, "front", base_rev=base_rev)
            if ROLE_META.get(cid, ("sword", "cyan"))[0] == "fan":
                for ct, _ in CAST_TYPES:
                    for step in (1, 2):
                        load_orig_git(cid, f"cast_{ct}_{step}", base_rev=base_rev)
    total = 0
    for cid in targets:
        updated = retouch_cast_character(cid, dry_run=dry, base_rev=base_rev)
        total += len(updated)
        print(f"{cid:18s}: {len(updated):2d} cast poses")
    print(f"\nDone! Retouched {len(targets)} cast characters, {total} cast poses (dry_run={dry}, base_rev={base_rev[:10]}).")


if __name__ == "__main__":
    main()
