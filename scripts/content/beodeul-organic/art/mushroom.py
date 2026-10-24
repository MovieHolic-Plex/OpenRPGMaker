"""beodeul_organic mushrooms: walk-over clusters, hand-stamped caps."""
from art.wood import canvas, stamp, put, done

def cap(c, x, y, size, pal, spots=False):
    o, d, m, l, h, st, sd = pal
    if size == 3:
        rows = [f" {o}{o}{o} ", f"{o}{h}{l}{m}{o}", f"{o}{d}{d}{d}{o}", f" {o}{st}{o} ", f"  {sd}  "]
    elif size == 4:
        rows = [f"  {o}{o}{o}  ", f" {o}{h}{l}{m}{o} ", f"{o}{l}{h}{m}{m}{d}{o}", f"{o}{o}{d}{d}{d}{o}{o}", f"  {o}{st}{sd}{o}  ", f"   {o}{o}   "]
    elif size == 5:
        rows = [f"  {o}{o}{o}{o}  ", f" {o}{h}{h}{l}{m}{o} ", f"{o}{h}{l}{l}{m}{m}{d}{o}", f"{o}{m}{m}{m}{d}{d}{d}{o}", f" {o}{o}{d}{d}{o}{o} ", f"   {st}{sd}   ", f"   {st}{sd}   ", f"  {o}{o}{o}{o}  "]
    else:
        rows = [f"{o}{o}", f"{h}{d}", f"{st}{o}"]
    stamp(c, x, y, [r.replace(" ", " ") for r in rows])
    if spots:
        for dx, dy in {3: [(2, 1)], 4: [(2, 1), (4, 2)], 5: [(2, 1), (5, 2), (3, 3)]}.get(size, []):
            put(c, x + dx, y + dy, "R")

K = {"o": "#2a1916", "1": "#61160d", "2": "#9e2514", "3": "#dd2912", "4": "#e0482a", "R": "#d9d2be",
     "q": "#bcaaa0", "Q": "#9e8d83", "5": "#3a261c", "6": "#633712", "7": "#885a26", "8": "#b77541", "9": "#cf9558",
     "w": "#ffffff", "x": "#dee0dd", "z": "#c4c6c3", "c": "#929491", "u": "#595b58", "O": "#1e150a", "U": "#262729",
     "S": "S", "s": "s", "G": "#1e522a", "g": "#123624", "V": "#347430"}
RED = ("o", "1", "2", "3", "4", "R", "Q")
BRN = ("O", "5", "6", "7", "8", "q", "Q")
PAL = ("U", "c", "z", "x", "w", "x", "c")

def shadow(c, x0, x1, y):
    for x in range(x0, x1): put(c, x, y, "S")

def red():
    c = canvas(16, 16)
    shadow(c, 3, 14, 14)
    cap(c, 1, 9, 4, RED, True); cap(c, 7, 6, 5, RED, True); cap(c, 12, 10, 3, RED, True)
    stamp(c, 5, 13, ["GV", " g"])
    return done(c), K

def brown():
    c = canvas(16, 16)
    shadow(c, 2, 14, 14)
    # tall slim caps, leaning; mature + two buttons
    cap(c, 2, 7, 5, BRN); cap(c, 9, 9, 4, BRN)
    stamp(c, 13, 11, ["O7O", "O6O", " q "])
    stamp(c, 1, 13, ["8O"])
    stamp(c, 0, 13, ["g"]); stamp(c, 8, 13, ["V", "g"])
    return done(c), K

def pale():
    c = canvas(16, 16)
    shadow(c, 3, 15, 14)
    # parasol-ish flat caps, many small in a clump
    stamp(c, 3, 8, [" UUUUU ", "UwwxxzU", "UcccccU", " UUzUU ", "   zc  ", "   zc  "])
    stamp(c, 10, 9, [" UUU ", "UwxzU", "UcccU", " UzU ", "  c  "])
    stamp(c, 0, 11, ["UUU", "wzU", "zU "])
    stamp(c, 8, 12, ["UU", "xc", "z."])
    stamp(c, 13, 13, ["Vg"])
    return done(c), K

def ring():
    c = canvas(32, 32)
    pts = [(14, 5, 3, RED), (19, 8, 3, BRN), (24, 10, 3, RED), (26, 15, 1, RED), (24, 19, 3, RED),
           (19, 22, 3, RED), (13, 23, 4, RED), (8, 20, 1, RED), (4, 15, 3, RED), (5, 10, 3, BRN), (9, 7, 3, RED)]
    for x, y, s, p in pts:
        w = {3: 5, 4: 7, 1: 2}[s]
        shadow(c, x + 1, x + w + 1, y + (5 if s >= 3 else 3))
        cap(c, x, y, s, p, s >= 3)
    for x, y in ((12, 13), (17, 16), (11, 17)):  # darker grass in the ring centre
        stamp(c, x, y, ["G", "g"])
    return done(c), K

ART = {"shroom-red": red(), "shroom-brown": brown(), "shroom-pale": pale(), "shroom-ring": ring()}
