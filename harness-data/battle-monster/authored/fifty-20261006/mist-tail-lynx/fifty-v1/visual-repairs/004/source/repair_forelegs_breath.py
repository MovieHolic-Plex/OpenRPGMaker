"""Apply explicitly chosen native row clusters; no inferred artwork.

The four resting poses share this lower foreleg anatomy. Only these local
clusters are replaced; neither the canvas nor any entire pose is transformed.
"""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent

# x=38..54. Near elbow descends to its planted paw; the farther leg
# descends beside it. x=45..46 stays open down the shins; x=46
# remains open between the independently planted, widened paws.
FORELEGS = [
    (47, 38, "BBBBBMMSSSBMSO..."),
    (48, 38, "BBBBBMSSSSBMSO..."),
    (49, 38, "BBBBBMSSSBMSO...."),
    (50, 38, "BBLLBMSOSBMSO...."),
    (51, 38, "BBLLMSO..OBMSO..."),
    (52, 38, "BBLLMSO..OBMSO..."),
    (53, 38, "OBBLMSO...OMSO..."),
    (54, 38, "OBBLMSO...OMSO..."),
    (55, 38, "OBBLMSO...OMSO..."),
    (56, 38, ".OBBMSO...OMSO..."),
    (57, 38, ".OBBMSO...OMSO..."),
    (58, 38, ".OBBMSO..OBMMSO.."),
    (59, 38, ".OBLLBBO.OBBMSO.."),
    (60, 38, ".OOWOOWO.OOWOWO.."),
]

# Inhalation: a new 1px back crest and a fuller shoulder contour.
# The upper highlight/spot mass follows that contour; head and folded paws
# retain their coordinates. Every replacement is a literal chosen cluster.
BREATH = [
    (40, 20, "OOOO"),
    (41, 17, "OOLLBBOOOO"),
    (42, 14, "OOLLHHLLBBBOOOOOOOBBO"),
    (43, 13, "OLLHHHLLLBBBBBBBBBBBBBO"),
    (44, 13, "LHHHHHHLLLBBBBBBBBBBBBBO"),
    (45, 13, "HHHHHHLLLBBMMBBBBBBBBBBBLBB"),
    (46, 13, "HHHHHLLBBBMSSMBBBBBBBBBBBLB"),
    (47, 13, "BLHHHLLLBBBBMMBBBLLLLBBBBBL"),
    (48, 13, "BBLLLLLLBBMBBBBBLLLLLLBBBBL"),
    (49, 13, "BBBLLLLLBBSMBMBBLLLLLLBBBLL"),
    (50, 13, "BBBBLMMBBBBMSSMBBLLLLLLLBLL"),
]

def main():
    changes = {f"poses/{n}.pxgrid": FORELEGS
               for n in ("idle_a", "idle_b", "idle_c", "recover")}
    changes["actions/sleep_b.pxgrid"] = BREATH
    snapshot = ROOT / "revisions" / "forelegs-breath-before"
    if snapshot.exists():
        raise RuntimeError("Original snapshot already exists; do not overwrite it.")
    before = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
              for folder in ("poses", "actions") for p in (ROOT / folder).glob("*.pxgrid")}
    before["palette.json"] = hashlib.sha256((ROOT / "palette.json").read_bytes()).hexdigest()
    report = {}
    log = ["", "# Local foreleg separation and sleep inhalation repair; 0-based coordinates."]
    for rel, clusters in changes.items():
        p = ROOT / rel
        dst = snapshot / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, dst)
        rows = p.read_text().splitlines()
        log.append("@ " + p.stem)
        edits = []
        for y, x, row in clusters:
            old = rows[y][x:x+len(row)]
            for dx, (a, b) in enumerate(zip(old, row)):
                if a != b:
                    edits.append({"x": x+dx, "y": y, "before": a, "after": b})
            rows[y] = rows[y][:x] + row + rows[y][x+len(row):]
            log.append(f"{y} {x} {row}")
        p.write_text("\n".join(rows) + "\n")
        report[rel] = {"changed_pixels": len(edits), "edits": edits}
    with (ROOT / "author_corrections.txt").open("a") as out:
        out.write("\n".join(log) + "\n")
    (snapshot / "hashes.json").write_text(json.dumps(before, indent=2) + "\n")
    (ROOT / "forelegs-breath-diagnostics.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({name: r["changed_pixels"] for name, r in report.items()}, indent=2))

if __name__ == "__main__":
    main()
