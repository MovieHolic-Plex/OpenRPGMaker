"""Generate 21 crisp 16x16 RM2000 interior tiles for modern_pcbang (100% locked palette)."""
from __future__ import annotations

from palette import (
    Canvas, TILES_DIR,
    R, O, A, Y, G, J, C, K, B, I, P, S, DW, WT,
)


def make_floor_lobby_slate() -> Canvas:
    """Calm cool-slate porcelain tile for POS lobby & entrance."""
    c = Canvas(16, 16, S[5])
    # Clean single-step subtle grout along right & bottom edge (spike ratio = 0.0646 <= 0.08)
    c.hline(0, 15, 15, S[4])
    c.vline(15, 0, 15, S[4])
    return c


def make_floor_lobby_slate_alt() -> Canvas:
    """Ultra-calm companion porcelain slab for sleek modern lobby floor."""
    c = Canvas(16, 16, S[5])
    c.hline(0, 15, 15, S[4])
    c.vline(15, 0, 15, S[4])
    # Very subtle corner glint (only 2px -> keeps spike ratio <= 0.072)
    c.p(1, 1, S[6])
    return c


def make_floor_cafe_oak() -> Canvas:
    """Warm oak wooden planks for the NW Ramen Cafe — calm, clean, zero noise."""
    c = Canvas(16, 16, WT[2])
    # Two horizontal planks: top plank y=0..7, bottom plank y=8..15
    # Slight tone difference between planks (WT[2] #a77950 vs WT[3] #b77246 -> very smooth!)
    c.fill_rect(0, 8, 16, 7, WT[3])
    # Subtle plank grain accents (very close tone)
    c.hline(2, 6, 3, WT[3])
    c.hline(9, 13, 11, WT[2])
    # Clean hairline horizontal plank seam at y=7 and y=15 (1 step darker: DW[6] #86472c)
    # Wait: keep diff super calm! WT[2]=(167,121,80), DW[6]=(134,71,44) -> dist=70;
    # Use 1 single plank seam at y=15 + subtle mid seam in WT[0] or only 1 seam?
    # Let's check: 16 pixels on 1 row = 16/480 = 3.3% (2 rows = 32/480 = 6.6%, safely <= 0.08!)
    # Even better: top seam at y=15 only, and subtle light bevel at y=0, plus mid-plank tone step at y=8!
    c.hline(0, 15, 15, DW[6])
    c.vline(7, 0, 7, DW[6])   # subtle staggered plank joint (8px -> 8/480 = 1.6%)
    # Total high-diff edges: 16 + 8 = 24 out of 480 = 5.0% -> ultra-calm & crisp planks!
    return c


def make_floor_pc_carpet() -> Canvas:
    """Dark navy acoustic carpet tile for Main PC Gaming Arena."""
    c = Canvas(16, 16, B[1])
    # Calm subtle modular carpet tile border in B[2] (RGB dist from B[1] = 36 -> calm!)
    c.hline(0, 15, 0, B[2])
    c.vline(0, 0, 15, B[2])
    # Subtle dark seam at bottom-right in B[0] (RGB dist from B[1] = 38 -> super smooth!)
    c.hline(0, 15, 15, B[0])
    c.vline(15, 0, 15, B[0])
    return c


def make_floor_pc_carpet_trim() -> Canvas:
    """PC Arena corridor carpet with calm seamless lane tone."""
    c = Canvas(16, 16, B[1])
    c.hline(0, 15, 15, B[0])
    c.vline(15, 0, 15, B[0])
    c.hline(0, 14, 0, B[2])
    c.p(2, 2, B[2])
    return c


def make_floor_arcade_teal() -> Canvas:
    """Crisp cool teal/slate tile for SE Retro Arcade."""
    c = Canvas(16, 16, K[1])
    # Clean top-left subtle sheen in K[2] (dist = 41)
    c.hline(0, 14, 0, K[2])
    c.vline(0, 0, 14, K[2])
    # Subtle dark grout on right & bottom in K[0] (dist = 43)
    c.hline(0, 15, 15, K[0])
    c.vline(15, 0, 15, K[0])
    # Subtle inner corner mark
    c.p(2, 2, K[2])
    return c


def make_floor_vip_carpet() -> Canvas:
    """Plush dark indigo-navy carpet for SE VIP Lounge Alcove."""
    c = Canvas(16, 16, I[1])
    c.hline(0, 15, 15, I[0])
    c.vline(15, 0, 15, I[0])
    # Subtle woven diamond hint in I[2] (only 4 pixels -> ultra calm)
    c.hline(6, 9, 7, I[2])
    c.hline(6, 9, 8, I[2])
    return c


def make_floor_entrance_mat() -> Canvas:
    """PC Bang automatic door entrance mat (dark rubber rim + crimson ribbed center)."""
    c = Canvas(16, 16, S[1])
    c.rect(0, 0, 16, 16, S[0])
    c.fill_rect(2, 2, 12, 12, R[2])
    for y in (4, 7, 10):
        c.hline(3, 12, y, R[3])
    c.hline(2, 13, 2, R[3])
    c.hline(2, 13, 13, R[1])
    return c


def make_wall_cap_dark() -> Canvas:
    """RM2000 continuous interior wall top cap (clean dark architectural cut)."""
    c = Canvas(16, 16, S[1])
    # Subtle unified matte ceiling cut — no harsh boxy grid seams
    c.hline(0, 15, 0, S[1])
    c.hline(0, 15, 15, S[1])
    c.p(1, 1, S[2])
    return c


def make_wall_cap_edge_s() -> Canvas:
    """RM2000 north wall top cap with crisp south overhang lip."""
    c = Canvas(16, 16, S[1])
    c.hline(0, 15, 0, S[0])
    c.hline(0, 15, 13, S[2])
    c.hline(0, 15, 14, S[3])
    c.hline(0, 15, 15, S[0])
    return c


def make_wall_face_upper() -> Canvas:
    """Clean modern cool-slate upper interior wall panel."""
    c = Canvas(16, 16, S[4])
    # Top shadow cast by wall cap
    c.hline(0, 15, 0, S[2])
    c.hline(0, 15, 1, S[3])
    # Subtle vertical architectural panel seam
    c.vline(15, 2, 15, S[3])
    c.vline(0, 2, 15, S[5])
    # Subtle upper accent molding line
    c.hline(1, 14, 14, S[5])
    c.hline(0, 15, 15, S[3])
    return c


def make_wall_face_lower() -> Canvas:
    """Clean modern cool-slate lower interior wall with dark steel baseboard."""
    c = Canvas(16, 16, S[4])
    c.vline(15, 0, 11, S[3])
    c.vline(0, 0, 11, S[5])
    # Chair rail / mid molding at y=0
    c.hline(0, 15, 0, S[5])
    # Modern dark steel baseboard y=11..15
    c.hline(0, 15, 11, S[3])
    c.hline(0, 15, 12, S[2])
    c.fill_rect(0, 13, 16, 2, S[1])
    c.hline(0, 15, 15, S[0])
    return c


def make_wall_cafe_wood_upper() -> Canvas:
    """Warm Korean ramen cafe vertical oak slatted upper wall."""
    c = Canvas(16, 16, WT[2])
    c.hline(0, 15, 0, DW[2])
    c.hline(0, 15, 1, DW[6])
    # Clean vertical wooden slats (4px pitch)
    for sx in (0, 4, 8, 12):
        c.vline(sx, 2, 15, WT[5])
        c.vline(sx + 1, 2, 15, WT[3])
        c.vline(sx + 2, 2, 15, WT[2])
        c.vline(sx + 3, 2, 15, DW[6])
    c.hline(0, 15, 15, DW[3])
    return c


def make_wall_cafe_wood_lower() -> Canvas:
    """Warm ramen cafe lower wood wainscot + dark slate baseboard."""
    c = Canvas(16, 16, DW[6])
    c.hline(0, 15, 0, WT[6])
    c.hline(0, 15, 1, WT[2])
    c.fill_rect(0, 2, 16, 9, DW[6])
    # Recessed wainscot frame
    c.rect(2, 3, 12, 7, DW[3])
    c.hline(3, 12, 4, WT[2])
    c.vline(3, 4, 8, WT[2])
    # Dark slate baseboard
    c.hline(0, 15, 11, S[2])
    c.fill_rect(0, 12, 16, 3, S[1])
    c.hline(0, 15, 15, S[0])
    return c


def make_wall_glass_divider() -> Canvas:
    """Modern PC Bang steel-framed tempered glass partition wall."""
    c = Canvas(16, 16, K[3])
    # Top steel rail
    c.hline(0, 15, 0, S[0])
    c.hline(0, 15, 1, S[4])
    c.hline(0, 15, 2, S[2])
    # Glass pane y=3..11
    c.fill_rect(1, 3, 14, 9, K[4])
    c.fill_rect(1, 3, 14, 2, K[5])
    # Crisp diagonal glass reflection streak
    for i in range(6):
        c.p(3 + i, 9 - i, K[6])
        c.p(4 + i, 9 - i, S[7] if i < 2 else K[6])
    c.p(11, 8, K[5])
    c.p(12, 7, K[6])
    # Vertical steel mullions
    c.vline(0, 1, 14, S[1])
    c.vline(15, 1, 14, S[1])
    # Lower steel kick bar
    c.hline(0, 15, 12, S[3])
    c.fill_rect(0, 13, 16, 2, S[1])
    c.hline(0, 15, 15, S[0])
    return c


def make_wall_glass_divider_v() -> Canvas:
    """Vertical steel-framed tempered glass partition wall (continuous north-south)."""
    c = Canvas(16, 16, S[5])
    # Clean transparent-feel lobby/arena steel column + vertical glass rail centered at x=4..11
    c.fill_rect(0, 0, 16, 16, S[1])
    c.vline(0, 0, 15, S[0])
    c.vline(15, 0, 15, S[0])
    c.vline(1, 0, 15, S[3])
    c.vline(2, 0, 15, S[2])
    c.vline(13, 0, 15, S[2])
    c.vline(14, 0, 15, S[1])
    # Continuous cyan-blue glass core x=3..12
    c.fill_rect(3, 0, 10, 16, K[4])
    c.vline(3, 0, 15, K[5])
    c.vline(4, 0, 15, K[6])
    c.vline(12, 0, 15, K[2])
    # Subtle horizontal aluminum transom bar once per tile
    c.hline(2, 13, 0, S[2])
    c.hline(3, 12, 1, K[5])
    # Crisp glass reflection glint
    c.p(5, 5, S[7])
    c.p(6, 4, K[6])
    c.p(9, 11, K[5])
    return c


def make_wall_door_top_left() -> Canvas:
    """Automatic sliding glass entrance door — upper left leaf + header transom."""
    c = Canvas(16, 16, K[3])
    c.fill_rect(0, 0, 3, 16, S[2])
    c.vline(0, 0, 15, S[0])
    c.vline(1, 0, 15, S[4])
    c.vline(2, 0, 15, S[1])
    # Automatic door sensor header
    c.fill_rect(3, 0, 13, 4, S[2])
    c.hline(3, 15, 0, S[0])
    c.hline(3, 15, 1, S[4])
    c.hline(3, 15, 3, S[0])
    c.fill_rect(12, 1, 3, 2, S[0])
    c.p(13, 2, G[5])  # motion sensor LED
    # Upper glass leaf
    c.fill_rect(3, 4, 12, 12, K[4])
    c.fill_rect(3, 4, 12, 2, K[5])
    c.p(5, 8, S[7])
    c.p(6, 7, K[6])
    c.p(7, 6, K[6])
    c.vline(15, 4, 15, S[1])
    c.vline(14, 4, 15, S[4])
    return c


def make_wall_door_top_right() -> Canvas:
    """Automatic sliding glass entrance door — upper right leaf + header transom."""
    c = Canvas(16, 16, K[3])
    c.fill_rect(13, 0, 3, 16, S[2])
    c.vline(15, 0, 15, S[0])
    c.vline(14, 0, 15, S[3])
    c.vline(13, 0, 15, S[1])
    c.fill_rect(0, 0, 13, 4, S[2])
    c.hline(0, 12, 0, S[0])
    c.hline(0, 12, 1, S[4])
    c.hline(0, 12, 3, S[0])
    c.fill_rect(0, 1, 3, 2, S[0])
    # Upper glass leaf
    c.fill_rect(1, 4, 12, 12, K[4])
    c.fill_rect(1, 4, 12, 2, K[5])
    c.p(4, 9, K[6])
    c.p(5, 8, K[6])
    c.vline(0, 4, 15, S[1])
    c.vline(1, 4, 15, S[4])
    return c


def make_wall_door_arch_left() -> Canvas:
    """Automatic sliding glass entrance door — lower left leaf."""
    c = Canvas(16, 16, K[3])
    # Left heavy steel jamb
    c.fill_rect(0, 0, 3, 16, S[2])
    c.vline(0, 0, 15, S[0])
    c.vline(1, 0, 15, S[4])
    c.vline(2, 0, 15, S[1])
    # Continuous glass door leaf
    c.fill_rect(3, 0, 12, 13, K[4])
    # Frosted safety stripe + silver handle bar
    c.hline(3, 14, 3, S[6])
    c.hline(3, 14, 4, K[6])
    c.vline(12, 1, 7, S[6])
    c.vline(13, 1, 7, S[2])
    # Center meeting stile
    c.vline(15, 0, 14, S[1])
    c.vline(14, 0, 13, S[4])
    # Bottom aluminum kick rail & threshold
    c.fill_rect(3, 13, 12, 2, S[2])
    c.hline(3, 14, 13, S[4])
    c.hline(0, 15, 15, S[0])
    return c


def make_wall_door_arch_right() -> Canvas:
    """Automatic sliding glass entrance door — lower right leaf."""
    c = Canvas(16, 16, K[3])
    # Right heavy steel jamb
    c.fill_rect(13, 0, 3, 16, S[2])
    c.vline(15, 0, 15, S[0])
    c.vline(14, 0, 15, S[3])
    c.vline(13, 0, 15, S[1])
    # Continuous glass door leaf
    c.fill_rect(1, 0, 12, 13, K[4])
    # Frosted safety stripe + silver handle bar
    c.hline(1, 12, 3, S[6])
    c.hline(1, 12, 4, K[6])
    c.vline(3, 1, 7, S[6])
    c.vline(2, 1, 7, S[2])
    # Center meeting stile
    c.vline(0, 0, 14, S[1])
    c.vline(1, 0, 13, S[4])
    # Bottom aluminum kick rail & threshold
    c.fill_rect(1, 13, 12, 2, S[2])
    c.hline(1, 12, 13, S[4])
    c.hline(0, 15, 15, S[0])
    return c


def make_wall_neon_sign() -> Canvas:
    """Wall-mounted PC Bang cyan/cobalt LED light bar sign on upper wall."""
    c = make_wall_face_upper()
    # Dark aluminum sign backing
    c.box(1, 4, 14, 8, B[0], S[0])
    c.box(2, 5, 12, 6, B[1], B[2])
    # Glowing cyan neon bar + icon motif
    c.hline(3, 12, 7, C[5])
    c.hline(4, 11, 8, C[6])
    c.p(4, 7, S[7])
    c.p(5, 7, S[7])
    c.p(11, 7, R[5])  # red accent dot
    return c


def make_wall_game_poster() -> Canvas:
    """Wall-mounted framed esports/arcade game poster on upper wall."""
    c = make_wall_face_upper()
    # Dark frame
    c.box(2, 2, 12, 12, B[1], S[0])
    # Dramatic diagonal color-block poster art (no unreadable text!)
    c.fill_rect(3, 3, 10, 5, R[4])
    c.fill_rect(3, 8, 10, 5, B[3])
    # Hero silhouette / star burst
    c.fill_rect(6, 5, 4, 5, Y[5])
    c.fill_rect(7, 4, 2, 3, Y[6])
    c.hline(4, 11, 11, C[5])
    # Frame top-left specular
    c.p(3, 3, S[7])
    return c


def make_wall_ac_unit() -> Canvas:
    """Korean wall-mounted split air conditioner unit on upper wall."""
    c = make_wall_face_upper()
    # Sleek modern white/silver AC chassis
    c.box(1, 3, 14, 8, S[6], S[0])
    c.hline(2, 13, 4, S[7])      # top highlight
    c.hline(2, 13, 8, S[4])      # lower bevel
    # Air vent louver slot
    c.hline(2, 13, 9, S[1])
    c.hline(3, 12, 10, S[2])
    # Green power LED on right
    c.p(12, 6, G[5])
    c.p(11, 6, C[5])
    # Subtle underside wall shadow
    c.hline(2, 13, 11, S[3])
    return c


def make_wall_window_night() -> Canvas:
    """Modern street-facing night window showing dark city sky & distant neon."""
    c = make_wall_face_upper()
    # Steel window frame
    c.box(1, 2, 14, 12, B[0], S[0])
    c.rect(2, 3, 12, 10, S[2])
    # Night sky gradient
    c.fill_rect(3, 4, 10, 4, B[0])
    c.fill_rect(3, 8, 10, 4, B[1])
    # Distant city skyline blocks + bokeh lights
    c.fill_rect(3, 9, 3, 3, S[1])
    c.fill_rect(7, 8, 4, 4, S[1])
    c.p(4, 10, Y[5])
    c.p(8, 9, C[5])
    c.p(9, 10, A[5])
    c.p(11, 9, R[5])
    # Diagonal glass reflection
    c.p(4, 5, K[5])
    c.p(5, 4, K[6])
    c.p(10, 5, K[5])
    # Bottom sill highlight
    c.hline(1, 14, 13, S[5])
    return c


ALL_TILES = {
    "floor_lobby_slate": make_floor_lobby_slate,
    "floor_lobby_slate_alt": make_floor_lobby_slate_alt,
    "floor_cafe_oak": make_floor_cafe_oak,
    "floor_pc_carpet": make_floor_pc_carpet,
    "floor_pc_carpet_trim": make_floor_pc_carpet_trim,
    "floor_arcade_teal": make_floor_arcade_teal,
    "floor_vip_carpet": make_floor_vip_carpet,
    "floor_entrance_mat": make_floor_entrance_mat,
    "wall_cap_dark": make_wall_cap_dark,
    "wall_cap_edge_s": make_wall_cap_edge_s,
    "wall_face_upper": make_wall_face_upper,
    "wall_face_lower": make_wall_face_lower,
    "wall_cafe_wood_upper": make_wall_cafe_wood_upper,
    "wall_cafe_wood_lower": make_wall_cafe_wood_lower,
    "wall_glass_divider": make_wall_glass_divider,
    "wall_glass_divider_v": make_wall_glass_divider_v,
    "wall_door_top_left": make_wall_door_top_left,
    "wall_door_top_right": make_wall_door_top_right,
    "wall_door_arch_left": make_wall_door_arch_left,
    "wall_door_arch_right": make_wall_door_arch_right,
    "wall_neon_sign": make_wall_neon_sign,
    "wall_game_poster": make_wall_game_poster,
    "wall_ac_unit": make_wall_ac_unit,
    "wall_window_night": make_wall_window_night,
}


def build_tiles() -> dict[str, Canvas]:
    TILES_DIR.mkdir(parents=True, exist_ok=True)
    built = {}
    for name, fn in ALL_TILES.items():
        canvas = fn()
        canvas.save(TILES_DIR / f"{name}.png")
        built[name] = canvas
    return built


if __name__ == "__main__":
    tiles = build_tiles()
    print(f"Built {len(tiles)} tiles in {TILES_DIR}")
