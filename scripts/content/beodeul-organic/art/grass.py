"""Grass tufts and seed-head grass, hand-written rows. 2px blade bundles curving outward,
dark shadow-side tone (#123624/#0a201c) on the right of each bundle so the tuft holds against the lawn at 1x."""
K = {"5":"#96c254","4":"#5c983a","3":"#347430","2":"#1e522a","1":"#123624","o":"#0a201c","s":"s","S":"S",
     "a":"#cf9558","b":"#9b753d","c":"#856234","d":"#4c3620"}
E = "."*16
TA = [E]*7 + [
 "................",
 "........54......",
 "...54...431.....",
 "....431.431.54..",
 ".54.4314321431..",
 "..4314314314o1..",
 "...43143143o1...",
 "....3o21o2o1....",
 ".....1o1oo1S....",
]
TB_OLD = [E]*3 + [
 ".......54.......",
 ".......431......",
 "...54..431..54..",
 "...431.4314431..",
 "....431.43431...",
 ".54.43143.431...",
 "..4314314321o...",
 "...431431431..54",
 ".54.4314314o1431",
 "..4314314314o1o.",
 "...43143143o1o..",
 "....3o21o21o1...",
 ".....1o1oo1oS...",
]
RD = [E]*1 + [
 "......ab........",
 "...ab.acd...ab..",
 "...acdacd...acd.",
 "...acdbcd..acd..",
 "....bd.cd..bd...",
 "....41.41..41...",
 "....41.431.41...",
 ".ab.431.41431...",
 ".acd.41.4141....",
 "..bd.431431..54.",
 "...41.4314314o1.",
 "...4314314o1o...",
 "....43143o1o....",
 ".....3o21o1S....",
 "......1oo1S.....",
]

# grass-tuft-b: tall tuft, 2px blade bundles of different length and lean, like grass-tuft-a (frozen)
TB = [E]*2 + [
 "........54......",
 "........431.....",
 "..54....431.....",
 "...431..431..54.",
 "...431..4431431.",
 "....431.4431431.",
 ".54..4314431o1..",
 "..431.43431o1...",
 "...4314343o1..54",
 "54..43143o1.4431",
 ".4314314o1o431o.",
 "..43143o1o431o..",
 "...3o21o21o1o...",
 "....1o1oo1oS....",
]
# reeds: three stems of different height and lean; seed heads 2-3px wide, lit left / dark right, tapering
RD = [E] + [
 ".......a........",
 "......abc.......",
 "..a...abd.......",
 ".abc..bcd...a...",
 ".abd..bd...abc..",
 "..bd...4..abcd..",
 "..cd...41..bd...",
 "...4...41..cd...",
 "...41..41..4....",
 "....41.41.41....",
 "....41.43141.54.",
 ".54..4143141431.",
 "..431431431o1o..",
 "...43143o1o1....",
 "....3o21o1oS....",
]
ART = {"grass-tuft-a": (TA, K), "grass-tuft-b": (TB, K), "grass-reeds": (RD, K)}

# walk-over decor must not touch the cell's bottom row: shift up 1px (pixels unchanged)
def _up(rows): return rows[1:] + ["." * len(rows[0])]
# grass-reeds already fills row 0..; shifting it up would clip its top seed head, so it stays (see report)
ART = {k: ((_up(r) if k != "grass-reeds" else r), kk) for k, (r, kk) in ART.items()}

# ---- r6 reeds: fits rows 1-14, shorter tapered seed heads (2x2 + tip), stems of different height and lean
RD6 = [E, E,
 ".......a........",
 "......abc...a...",
 "..a...bcd..abc..",
 ".abc...d...bcd..",
 ".bcd...4....d...",
 "..d....41..41...",
 "..4....41..41...",
 "..41..431.41....",
 "...41.41.431.54.",
 ".54.4141431.431.",
 "..431431431o1o..",
 "...4314314o1....",
 "....3o21o1o1S...",
 ".....SSSSSSs....",
]
ART["grass-reeds"] = (RD6, K)
