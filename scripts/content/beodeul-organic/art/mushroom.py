"""beodeul_organic mushrooms: hand-written cells modelled on the Beodeul toadstools
(no outline on cap tops, dark only at the cap rim/underside, violet gills, grey-violet stems)."""
from art.wood import canvas, stamp, put, done
K = {"a": "#8a2c1c", "b": "#ecd6c6", "c": "#89190c", "d": "#61160d", "e": "#e0482a", "f": "#dd2912", "g": "#9e2514",
     "h": "#35192f", "i": "#562945", "j": "#51283d", "k": "#1a132a", "l": "#bcaaa0", "m": "#650000", "n": "#a40100",
     "o": "#321829", "p": "#928487", "q": "#615759", "r": "#74696d",
     "B": "#3d220c", "C": "#543719", "D": "#6f4725", "E": "#885a26", "F": "#b77541", "G": "#cf9558", "H": "#452a17",
     "W": "#d9d2be", "X": "#8f6b61", "Y": "#9e8d83", "~": "s", "S": "S"}

RED = [
    "................",
    "................",
    "................",
    "................",
    ".......aefg.....",
    "......cefbffd...",
    "......efbffgd...",
    ".......dgngd....",
    "...aeb..jhi.....",
    "..cefffbij..aed.",
    "..mgnngd.pq.efd.",
    "....hik..pr.gh..",
    ".....pq..SSqrS..",
    ".....prSSS.SS...",
    "................",
    "................",
]
BROWN = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "....EFFE........",
    "..DEFGGFED......",
    ".DEFFEEEEDC.....",
    ".CDDEEDDDCB.....",
    "..BHiiiHB...EF..",
    "....YlYX...DEFED",
    "....lWlX...CDDCB",
    "....YlYX....HiH.",
    "...SYlYXSS..YlX.",
    ".....SSSSS..SSS.",
    "................",
]
PALE = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "....lbbbl.......",
    "...lbWWWWlX.....",
    "...XlWllllXj....",
    "....jiiiiij.....",
    "......lYj...bl..",
    "......WYj..bWlX.",
    "..bl..lYj..XiiX.",
    ".bWlX.lYjS..Yj..",
    ".XiiXSSSSS..YjS.",
    "...YS........S..",
    "................",
]
BIG = ["  aefg ", " cefbffd", " efbffgd", "  dgngd ", "   jhi  ", "   pqS  ", "  SSSS  "]
MID = [" aef ", "cefbd", "dgngd", " jhi ", " pqS", " SSS"]
SML = ["aed", "dgdd", " hi", " pq", "SSS"]
TNY = ["aef", "dgd", " pq", "SSS"]
LEANL = [" aef", "efbfd", "mgnd", " ji", "pq", "SSS"]

def ring():
    c = canvas(32, 32)
    # 3 soft dark-grass clumps inside the arc (no single specks)
    stamp(c, 12, 15, ["TTT", "TTT"])
    stamp(c, 15, 18, ["TT", "TTT"])
    stamp(c, 11, 19, ["TT", "TT"])
    # continuous arc from north-west down to south: cluster A (3), lone cap, cluster B (2)
    stamp(c, 6, 8, SML)
    stamp(c, 8, 10, MID)
    stamp(c, 4, 12, BIG)
    stamp(c, 6, 19, TNY)
    stamp(c, 10, 22, LEANL)
    stamp(c, 14, 24, SML)
    return done(c)

K.update({"T": "#2e5022", "U": "#264d2c"})
RING = ring()
ART = {"shroom-red": (RED, K), "shroom-brown": (BROWN, K), "shroom-pale": (PALE, K), "shroom-ring": (RING, K)}
