"""Explicit hit-only native row replacement, after viewing the supplied draft.

The row strings below are authored pixels, not transformed source frames.
Only the hit grid is written when this record is run. The complete pre-repair
grid is preserved in revisions/hit-before-recoil/.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Zero-based x=24, y=17. New backward head tilt, closed impact eyes, connected
# neck, raised rear shoulder and arched jacket. Rows 58..95 retain their pixels.
HIT_ROWS = """
.............OHHHO
...........OHhhHHHO
..........OHhhhHHHO
.........OHhhhHHRPPO
........OHhhHHHRPPYYRO
.......OHhhhHHHHHHHHHHO
......OHhhhhHHHaaabbbbaHO
......OHhhhHHHaaabbbbbbaHO
.....OHhhHHHHAaabbbbbbbbaO
.....OHHHHHHAaAabbbbAAabaO
.....OHHHHHHAaaAAbbAAabbaO
.....OHHHHHHAaAAbbbAAaabO
......OHHHHHHAaaabbbbbaabO
......OHHHHHHAAaabbbbaaO
.......OHHHHHHAaaAAaaAO
.......OHHHHHHAAaOAAaO
........OHHHHHHAAaaaAO
.....pF..OHHHHHHAaaaAO
....pFFp..OHHHHHHOAAAO
.....Yp....OB.OHHHHOAaaAO
..OB.BO...OB..OHHHOAabAO
...OBBO..OB....OHHOCAabACO
....OBBOOB.......OCaabACCO
.....OBBO......OCWWCaabACccCO
.......OBBO..OCWWWcCAACcWcccCO
........OBBOCWWWccWCCWWccccccCO
........OCWWWcccWWWWccccccccccCO
.......OCWWcccWWWWccccccccccccCO
......OCWWccccWWWWccccccccccccCO
.....OCWWWcccWWWWccccCCCCcccccCO
.....OCWWWWWccWWcccCC...CccccCO
......OCWWWWWccccCCO....CccccCO
.......OCWWWWcccCCCO....CccccCO
........OCWWcccCCCO.....CccccCO
.........OCWWccCCCO.....CccccCO
..........OCWcccCCCO....CccccCO
...........OCccWWCCCO...CccccCO
............OCcWWWCCCO..CcccccCO
.............ORrrrrrRRO....CccCO
.............ORPPPrrrRRO...CccCO
.............ORPrRRRrrRRO..CAaAO
""".strip("\n").splitlines()


def apply_hit_repair(grid):
    for y, row in enumerate(HIT_ROWS, 17):
        # Transparent padding replaces only the explicitly authored row band.
        grid[y] = list("." * 24 + row + "." * (96 - 24 - len(row)))
    return grid


if __name__ == "__main__":
    path = ROOT / "poses/hit.pxgrid"
    grid = [list(row) for row in path.read_text().splitlines()]
    apply_hit_repair(grid)
    path.write_text("\n".join("".join(row) for row in grid) + "\n")
