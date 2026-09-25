# Blob ground autotiles for tiledata/atlas-biomes: 47 canonical 8-neighbour masks + 2 body variants per ground, drawn
# from the 3×3 neighbourhood with rounded corners and a wobbling rim (climate-terrain.py blob_field), textures periodic
# in 16 px so any two neighbours meet. Each tile is opaque: the sheet's own lawn (240) outside the blob.
# Grounds: leaf litter, mud, glow moss, crystal veins, cracked red earth, red gravel wash, dry dust, snow drift,
# permafrost polygons, snow patch, blight veins, poison pool, flower meadow, white sand, and the neighbour biome's lawn.
import importlib.util, math, pathlib, random
import numpy as np

_ct = importlib.util.spec_from_file_location("climate_terrain", pathlib.Path(__file__).resolve().parents[1] / "climate-terrain.py")
CT = importlib.util.module_from_spec(_ct); _ct.loader.exec_module(CT)
canon, CANON, blob_field, periodic_noise, voronoi_seams, dither = CT.canon, CT.CANON, CT.blob_field, CT.periodic_noise, CT.voronoi_seams, CT.dither

def C(s): return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32)

def h01(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF

def ph(x, y, s):
    """Periodic hash (16 px torus)."""
    return h01(x % 16, y % 16, s)

# ── textures: fn(x, y, variant) -> colour, periodic in 16 ──
def tex_litter(pal):
    base, dark, leaf1, leaf2, twig = pal
    def f(x, y, v):
        n = ph(x // 2, y // 2, 11 + v * 7)
        c = base if n > 0.28 else dark
        k = ph(x, y, 31 + v)
        if k < 0.08: c = leaf1
        elif k < 0.13: c = leaf2
        elif k < 0.15: c = twig
        return c
    return f

def tex_mud(pal, puddles=True):
    base, dark, light, wet, shine = pal
    noise = periodic_noise(41, octaves=((2, 1.0), (4, 0.6)))
    def f(x, y, v):
        n = noise[(y + v * 5) % 16, (x + v * 3) % 16]
        if puddles and n > 0.55: return shine if (x + y) % 5 == 0 and n > 0.72 else wet
        c = light if n > 0.2 else base if n > -0.45 else dark
        return c
    return f

def tex_dots(base, dark, dots, rate=0.06, seed=5):
    noise = periodic_noise(seed, octaves=((2, 1.0), (4, 0.5)))
    def f(x, y, v):
        c = base if noise[y % 16, x % 16] > -0.35 else dark
        k = ph(x, y, seed * 13 + v * 29)
        if k < rate: return dots[int(k / rate * len(dots)) % len(dots)]
        return c
    return f

def tex_seams(base, light, seam, glow=None, n=5, seed=7, width=0.9):
    cache = {}
    def f(x, y, v):
        if v not in cache: cache[v] = voronoi_seams(seed + v * 3, n)
        s, cid = cache[v]
        d = s[y % 16, x % 16]
        if d < width: return glow if glow is not None and ph(x // 3, y // 3, seed + v) < 0.25 else seam
        if d < width + 0.9: return light if (x + y) % 2 else base
        return base if cid[y % 16, x % 16] % 2 else base * 0.96 + light * 0.04
    return f

def tex_ripple(base, light, shade, rows=(3, 11)):
    def f(x, y, v):
        for r in rows:
            yl = r + 1.5 * math.sin(2 * math.pi * (x + v * 4) / 16)
            d = (y % 16) - yl
            if -0.5 <= d < 0.5: return light
            if 0.5 <= d < 1.5: return shade
        return base
    return f

def tex_snow(base, shade, light):
    noise = periodic_noise(61, octaves=((2, 1.0), (4, 0.4)))
    def f(x, y, v):
        n = noise[(y + v * 6) % 16, (x + v * 2) % 16]
        return light if n > 0.5 else shade if n < -0.45 else base
    return f

def tex_image(tile):
    """The neighbour's lawn tile (16×16×4) as the inside texture."""
    def f(x, y, v): return tile[y % 16, x % 16, :3]
    return f

def tex_meadow(base, dark, flowers):
    noise = periodic_noise(77, octaves=((2, 1.0), (4, 0.5)))
    def f(x, y, v):
        c = base if noise[y % 16, x % 16] > -0.3 else dark
        k = ph(x, y, 91 + v * 3)
        if k < 0.11:
            col = flowers[int(k / 0.11 * len(flowers)) % len(flowers)]
            return col
        return c
    return f

def tex_liquid(deep, mid, light, glint):
    noise = periodic_noise(83, octaves=((2, 1.0), (4, 0.6)))
    def f(x, y, v):
        n = noise[(y + v * 4) % 16, (x + v * 7) % 16]
        if n > 0.7 and (x + y) % 3 == 0: return glint
        return light if n > 0.35 else mid if n > -0.3 else deep
    return f

# ── painting one blob tile ──
def blob_tile(ground, m, tex, variant=0, rim=None, rim2=None, soft=True, r_open=5.0, r_close=4.0, amp=1.6, inset=2.2, wob_seed=13, raised=False):
    """ground: 16×16×4 lawn tile (outside). tex(x,y,variant) colours the inside. rim: colour of the 1px boundary band
    (None = dithered soft edge onto the ground). raised: a lit top-left / dark bottom-right rim (pools, drifts)."""
    wob = periodic_noise(wob_seed, octaves=((2, 1.0), (4, 0.6)))
    D, gx, gy = blob_field(m if variant == 0 else 255, r_open, r_close, wob, amp, inset)
    out = ground.copy()
    for y in range(16):
        for x in range(16):
            d = D[y, x]
            if d < -1.0: continue
            if d < 0:
                if soft and rim is None and dither(x, y, 0.35 * (d + 1.0)): out[y, x, :3] = tex(x, y, variant)
                continue
            if rim is not None and d < 1.0:
                lit = -(gx[y, x] + gy[y, x])
                out[y, x, :3] = (rim2 if (raised and lit < -0.1 and rim2 is not None) else rim)
                continue
            out[y, x, :3] = tex(x, y, variant)
    out[..., 3] = 255
    return out

def blob_set(ground, tex, **kw):
    """[(mask or 'b1'/'b2', tile array)] for the 47 canonical masks and the two body variants."""
    out = [(m, blob_tile(ground, m, tex, 0, **kw)) for m in CANON]
    out += [("b1", blob_tile(ground, 255, tex, 1, **kw)), ("b2", blob_tile(ground, 255, tex, 2, **kw))]
    return out

# ── the grounds of each biome ──
def grounds(biome, lawn, neighbour_lawn=None):
    """{id: (kind 'ground'|'pool', name, blob_set kwargs + tex)} for this biome; lawn is the sheet's 240 tile."""
    G = {}
    if biome == "jungle":
        G["leaf-litter"] = ("ground", "낙엽 깔린 숲바닥", dict(tex=tex_litter((C("3a4a1e"), C("2a3814"), C("6a7a2a"), C("8a5a2a"), C("4a3018")))))
    if biome == "swamp":
        G["mud"] = ("ground", "질척한 진흙", dict(tex=tex_mud((C("4a3e28"), C("342a1a"), C("5e5034"), C("3a4632"), C("8aa088"))), rim=C("2e2616")))
    if biome == "mushroom":
        G["glow-moss"] = ("ground", "빛 이끼", dict(tex=tex_dots(C("3e4a86"), C("323c70"), [C("7af0e0"), C("b8fff4"), C("c89af0")], 0.07, 5)))
    if biome == "crystal":
        G["crystal-vein"] = ("ground", "수정 맥이 드러난 바닥", dict(tex=tex_seams(C("9a96b6"), C("b8b4d0"), C("6a66a0"), C("9ef0ff"), 4, 9, 0.8)))
    if biome == "badlands":
        G["cracked-red"] = ("ground", "갈라진 붉은 땅", dict(tex=tex_seams(C("b8683e"), C("cc8052"), C("7a3a1e"), None, 5, 17, 0.7)))
        G["red-gravel"] = ("ground", "붉은 자갈 마른 개울", dict(tex=tex_dots(C("a45a36"), C("8e4c2c"), [C("d8a07a"), C("6e3420"), C("c07a50")], 0.16, 23), rim=C("7a3e22")))
    if biome == "savanna":
        G["dry-dust"] = ("ground", "메마른 흙바닥", dict(tex=tex_dots(C("b8945a"), C("a8844c"), [C("8a6a3a"), C("d0b078"), C("7a8a3a")], 0.08, 29)))
    if biome == "taiga":
        G["snowdrift"] = ("ground", "눈 더미", dict(tex=tex_snow(C("e8f0f6"), C("c4d4e2"), C("ffffff")), rim=C("aabccc")))
    if biome == "tundra":
        G["permafrost"] = ("ground", "얼어 갈라진 동토", dict(tex=tex_seams(C("8a8e84"), C("a4a89c"), C("5e625a"), None, 4, 33, 0.75)))
        G["snow-patch"] = ("ground", "잔설", dict(tex=tex_snow(C("dce4ea"), C("b8c6d2"), C("f0f4f8")), rim=C("98a8b6")))
    if biome == "blight":
        G["blight-veins"] = ("ground", "오염 맥이 번진 땅", dict(tex=tex_seams(C("3a2e44"), C("4a3c56"), C("22182a"), C("c060ff"), 5, 41, 0.8)))
        G["poison-pool"] = ("pool", "독 웅덩이", dict(tex=tex_liquid(C("3a0e52"), C("6a1e8a"), C("9a3ec0"), C("f0b0ff")), rim=C("1e0e26"), rim2=C("2a1834"), raised=True, r_open=6.0, inset=2.6))
    if biome == "skyisle":
        G["meadow"] = ("ground", "구름 들꽃밭", dict(tex=tex_meadow(C("6ab84e"), C("5aa644"), [C("ffffff"), C("ffe070"), C("a8c8ff"), C("ffb0d0")])))
    if biome == "tropical":
        G["white-sand"] = ("ground", "흰 모래", dict(tex=tex_ripple(C("f0e2b8"), C("fff4d4"), C("dccb98")), rim=C("cdb888")))
    if neighbour_lawn is not None:
        G["neighbour"] = ("ground", "이웃 바이옴 땅", dict(tex=tex_image(neighbour_lawn)))
    return G
