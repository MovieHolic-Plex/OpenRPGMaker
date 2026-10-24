"""Beodeul mossy stones: rock shading + ground-decor moss greens on tops and crevices."""
from art._rockkit import shade, shadow, rows, KEYS
from art.rock import pad

MB = pad([
"........#########.............",
"......#############...........",
"....#################.###.....",
"...#######################....",
"..#########################...",
".###########################..",
".############################.",
"#############################.",
"##############################",
"##############################",
"######-#######################",
".#####-#######################",
".######-#####################.",
"..######-###################..",
"...#######################....",
"......#####...#########.......",
], 32, 32, 12)

def moss(mask, blobs):
    H = len(mask); W = len(mask[0])
    m = [["."]*W for _ in range(H)]
    for (y, x0, s) in blobs:
        for i, c in enumerate(s):
            if c != ".": m[y][x0+i] = c
    return ["".join(r) for r in m]

MB_MOSS = moss(MB, [
 (12,9,"..ACCB"), (13,7,".ACDDCCB..AB"), (14,5,"ACDEEDDCCBCCB.B"), (15,4,"ACDEFFEEDDCDDCBAC"),
 (16,4,"ADEEFEEDDDCDCCB.AB"), (17,4,"ACDEEDDCCDCB..ACCB"), (18,5,"ACDCCB.AB......ACDCB"),
 (19,4,"A.ACB...........ADDCB"), (20,3,"..AB.............ACB"),
 (22,6,"AC"), (23,7,"CB"), (24,7,"DC"), (25,8,"C"),
])

MS = pad([
"....#####.....",
"..#########...",
".###########..",
"#############.",
"##############",
"##############",
".######-#####.",
"..##########..",
], 16, 16, 5)
MS_MOSS = moss(MS, [(5,5,"ACB"),(6,3,"ACDDCB"),(7,2,"ADEFDB"),(8,2,"CDEC..B"),(9,3,"AB...AC"),(11,8,"C")])

def flat():
    W = H = 16
    g = [["."]*W for _ in range(H)]
    def put(x, y, pat):
        for dy, r in enumerate(pat):
            for dx, c in enumerate(r):
                if c != ".": g[y+dy][x+dx] = c
    put(1, 7, ["..oooo..", ".oCDEDoo", "oDEFEDCo", "ommnCdmo", ".oooooo."])
    put(9, 10, [".ooooo", "oCEDlo", "odmCdo", ".oooo."])
    put(4, 12, ["oooo", "oCdo", ".oo."])
    for x, y in ((2,12),(3,12),(7,12),(10,14),(11,14),(14,13)):
        if g[y][x] == ".": g[y][x] = "s"
    return ["".join(r) for r in g]

ART = {
    "moss-boulder": (rows(shadow(shade(MB, 21, 0.45, moss=MB_MOSS), 2, 3)), KEYS),
    "moss-stone": (rows(shadow(shade(MS, 23, 0.45, moss=MS_MOSS))), KEYS),
    "moss-stones-flat": (flat(), KEYS),
}
