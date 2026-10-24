"""Wildflowers as loose sprigs (no shared base), after Beodeul wild-b: light stems with a dark
edge, leaves as 2-3px clumps, blossoms of different size/direction/height."""
BASE = {"a": "#0a201c", "g": "#123624", "G": "#1e522a", "M": "#347430", "L": "#5c983a", "H": "#96c254", "s": "s"}
def K(**kw):
    d = dict(BASE); d.update(kw); return d

# buttercups: one tall leaning sprig with a cup + bud, a short sprig and a low leaf tuft
YELLOW = [
"................",
"................",
"................",
"................",
"........yY......",
".......yYo......",
"........Hg......",
"........H...yo..",
"...Yy..HLa..Hg..",
"...oy..Hg...H...",
"....H.HMa..LHg..",
"....HgH....HMa..",
"...LHMa...a.g...",
"..gHMgLLHMa.....",
"...gaG.gGga.....",
"................",
]
# bellflowers: one arching stem with three hanging bells pointing down-right, leaves at the foot
BLUE = [
"................",
"................",
"................",
"................",
"................",
"..........Hg....",
".........Hg.....",
".....bBa.H......",
".....db..Hg.....",
"......H..H..bB..",
"......Hg.Hg.dbH.",
"..Bb...H..H..Hg.",
"..bd..LH.LHg.H..",
"...HgLHMMHMaLHg.",
"...gMLHgGMa.gMa.",
"....ga.ga.......",
]
# daisies: two open flowers at different heights facing different ways, one side-on
WHITE = [
"................",
"................",
"................",
"................",
"................",
"...........w....",
"..........wcw...",
".wwW.......Wg...",
"wcCww......H....",
".wWw....wW.Hg...",
"..Hg...wcC.H....",
"..H.....HWHg....",
"..HgL...Hga.....",
".gMHMaLLHMMa....",
"..gaGa.gGga.....",
"................",
]
# pink clover: low heads close to the ground on a spread of trefoil leaves
PINK = [
"................",
"................",
"................",
"................",
"................",
"..........pP....",
".........pppc...",
"..........ccH...",
"....Pp.....Hg...",
"...pppc....H....",
"...cc.H...LHg...",
"....H.Hg.LHMa.pP",
".LH.HgHa.HMa.ppc",
".HMaHMa.pP..LHcH",
"..gaga.pppcLHMga",
"........cc..ga..",
]
ART = {
 "flowers-yellow": (YELLOW, K(y="#eac24d", Y="#fbc10d", o="#9b753d")),
 "flowers-blue":   (BLUE,   K(b="#8bb9dc", B="#a6bcdc", d="#071528")),
 "flowers-white":  (WHITE,  K(w="#dee0dd", W="#d5e0bd", c="#eac24d", C="#9b753d")),
 "flowers-pink":   (PINK,   K(p="#e8a8b9", P="#ecd6c6", c="#8f6b61")),
}
# irregular patch: back row taller and offset, front row low; gaps of grass between
PATCH = [
"................................",
"................................",
"................................",
"................................",
"................................",
".............w..................",
"............wEw.....Pp..........",
"..........bB.WH....pppc.........",
"..........dbHgH....cc.H.........",
"...........HLHg..pP..LHg........",
".......yY..HMa..pppcLHMa.bB.....",
"......yYo.LHg.bB.ccHMa.H.db.....",
".......HgLHMa.dbLHMaHgLHgH......",
"......LHMaHgLHMaHgLHMaHMa.......",
".......ga.ga.ga.ga..gaga........",
"................................",
]
ART["flowers-patch"] = (PATCH, K(y="#eac24d", Y="#fbc10d", o="#9b753d", b="#8bb9dc", B="#a6bcdc", d="#071528",
                                 w="#dee0dd", W="#d5e0bd", E="#eac24d", c="#8f6b61", C="#9b753d", p="#e8a8b9", P="#ecd6c6"))

# lift blue and pink 1px so the bottom row stays empty
for _k in ("flowers-blue", "flowers-pink"):
    _r, _keys = ART[_k]
    ART[_k] = (_r[1:] + ["." * 16], _keys)
