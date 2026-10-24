"""Wildflowers, hand-placed rows. Each colour has its own blossom form and stem layout."""
BASE = {"a": "#0a201c", "g": "#123624", "G": "#1e522a", "M": "#347430", "L": "#5c983a", "s": "s"}
def K(**kw):
    d = dict(BASE); d.update(kw); return d

# buttercups: 2x2 cups facing up-left, darker cup side, on a low leaf clump
YELLOW = [
"................",
"................",
"................",
"................",
"................",
".....yY.........",
".....oy....yY...",
"......M....oyy..",
"..yY..M.....M...",
"..oy..MG...GM...",
"...MLLMGLMLGG...",
"..LMMGGMMGGMg...",
"...GMgGgGMgg....",
"....gGg.ggg.....",
"......ssss......",
"................",
]
# bellflowers: drooping bells hanging from one arched stem, leaves at its foot
BLUE = [
"................",
"................",
"................",
"................",
"................",
".......MM.......",
"......M..M......",
".....bB...MM....",
".....db.....M...",
"......b....Bb...",
"..M.......Mdb...",
"..MG..LM..M.b...",
"...GLMMGG.MG....",
"...gGMGgGMGg....",
"....ggaGgga.....",
"......ssss......",
]
# daisies: open 4-wide flat flowers with yellow eye, seen from above-front, tall stems
WHITE = [
"................",
"................",
"................",
"................",
"................",
"..........ww....",
".........wcCw...",
"..ww......wW....",
".wcCw......M....",
"..wW...ww..M....",
"...M..wcCw.MG...",
"..LM...wWM.GM...",
"..MGLM..MMLGg...",
"...gGMMGGMGg....",
"....ggaGgaa.....",
".....sssss......",
]
# pink clover heads: round 3x3 clustered heads with a darker underside, on a broad trefoil leaf base
PINK = [
"................",
"................",
"................",
"................",
"................",
"................",
"................",
".......pp.......",
"..pp..pPpc......",
".pPpc.cpc...pp..",
".cpc...M...pPpc.",
"..ML.LMMGL.cpcM.",
".LMMGLMGGMLLMGG.",
"..GgMMGgMMGGMg..",
"...ggaGggGgga...",
"....ssssssss....",
]
ART = {
 "flowers-yellow": (YELLOW, K(y="#eac24d", Y="#fbc10d", o="#9b753d")),
 "flowers-blue":   (BLUE,   K(b="#8bb9dc", B="#a6bcdc", d="#071528")),
 "flowers-white":  (WHITE,  K(w="#dee0dd", W="#d5e0bd", c="#eac24d", C="#9b753d")),
 "flowers-pink":   (PINK,   K(p="#e8a8b9", P="#ecd6c6", c="#8f6b61")),
}
# overlapping clump: low leaf mass with mixed blossoms at different heights and depths
PATCH = [
"................................",
"................................",
"................................",
"................................",
"..............ww................",
".............wEFw...............",
"......yY......wW.....pp.........",
"......oy......M.....pPpc........",
"..bB...M...pp.M..yY..cpc..ww....",
"..db...MG.pPpcMG.oy...M..wEFw...",
"....MLLMG.cpcLMMLMMLMLM...wW....",
"..LMMGLMMLMMGGMMGGMGMMGGLMM.....",
"...GMMGgGMGgMMGgGMgGMGgGGMg.....",
"....gGgaGgggGgaGggGgagGgg.......",
"......gg..aggg..ggga..gg........",
".......sssssssssssssssss........",
]
ART["flowers-patch"] = (PATCH, K(y="#eac24d", Y="#fbc10d", o="#9b753d", b="#8bb9dc", B="#a6bcdc", d="#071528",
                                 w="#dee0dd", W="#d5e0bd", E="#eac24d", F="#9b753d", c="#8f6b61", C="#9b753d", p="#e8a8b9", P="#ecd6c6"))
