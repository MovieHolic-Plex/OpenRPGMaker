"""Apply hand-chosen local ASCII runs. No frame transforms or inferred pixels.

0-based coordinates; the final full 64x64 rows remain the canonical artwork.
The archive and measured diff describe this repair, not reviewer approval.
"""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent

# x=32..56: lower head/neck, low chest, backward elbow and forward wrist.
# Feet finish at y=60; the separate far paw has a narrower ankle.
REST = [
    (19,32,"........................."),
    (20,32,"........................."),
    (21,32,"........................."),
    (22,32,"..........K........K....."),
    (23,32,".........KK.......KK....."),
    (24,32,".........OKO.....OKKO...."),
    (25,32,"........OBCO....OBSO....."),
    (26,32,"........OBHCO..OLBSO....."),
    (27,32,".......OBLHCOOBLBMSO....."),
    (28,32,".......OBLHHCLLBBMSO....."),
    (29,32,"......OBLHHHLLBBBMMSO...."),
    (30,32,"......OBLHHLLLLBBBMSO...."),
    (31,32,"......OBLHLLLBBLBBMSO...."),
    (32,32,"......OBLHLLMBBLLBBMSO..."),
    (33,32,"......OBLBMMBBLMMBBBSO..."),
    (34,32,".......OBBGYNBLBYNBBMSO.."),
    (35,31,"O.......OBBCBBLLBCBBBCCSO."),
    (36,32,"OOOOBBBCCLLLCCBBBCCCSO..."),
    (37,32,"BLLLBBBCCCLCCCCCCCNNNO..."),
    (38,32,"BLLBBBBBCCCCCCCCCCCNNNO.."),
    (39,32,"BBLLBBBLLCCCCCCCCCCNNO..."),
    (40,32,"BBLLBBLLLCCCCCCCCCCSO...."),
    (41,32,"BBBLLLLLLLCCCCCCCBSO....."),
    (42,32,"BBLLLLLLLLCCCCBBMSO......"),
    (43,32,"BLLLLLLLLLCCBBBMSO......."),
    (44,32,"LLLLLLLLLBBBBBMMSO......."),
    (45,32,"LLLLLLLLBBBBBBMMSO......."),
    (46,32,"LLLLLLLBBBBBBBMMSSO......"),
    (47,32,"BLLLLLLBBBBBBMMSSSO......"),
    (48,32,"BBBBLLLBBBBBBMMSMSO......"),
    (49,32,"MBBBLLBBBBBBMMSBBMSO....."),
    (50,32,"MBBLLLBBBBBMSSBBMSO......"),
    (51,32,"OBBLLLBBBMSSSBBMSO......."),
    (52,32,"OOOOOBLLBMSSO.BBMSO......"),
    (53,32,".....OBLLBMSO.OBMSO......"),
    (54,32,".....OBLLMSO...OBMSO....."),
    (55,32,"......OBLLMSO..OBMSO....."),
    (56,32,".......OBLBMSO..OBMSO...."),
    (57,32,"........OBBMSO..OBMSO...."),
    (58,32,".........OBLMSO.OBMMSO..."),
    (59,32,".........OBLLBBO.OBBMSO.."),
    (60,32,".........OOWOOWO.OOWOWO.."),
]

# Recovery remains a distinct face/shoulder arrangement, with a slightly
# lower and rightward head. These are literal local rows, not a shifted frame.
RECOVER = [
    (22,32,"........................."),
    (23,32,"...........K........K...."),
    (24,32,"..........KK.......KK...."),
    (25,32,"..........OKO.....OKKO..."),
    (26,32,".........OBCO....OBSO...."),
    (27,32,".........OBHCO..OLBSO...."),
    (28,32,"........OBLHCOOBLBMSO...."),
    (29,32,"........OBLHHCLLBBMSO...."),
    (30,32,".......OBLHHHLLBBBMMSO..."),
    (31,32,".......OBLHHLLLLBBBMSO..."),
    (32,32,".......OBLHLLLBBLBBMSO..."),
    (33,32,".......OBLHLLMBBLLBBMSO.."),
    (34,32,".......OBLBMMBBLMMBBBSO.."),
    (35,31,"O........OBBGYNBLBYNBBMSO."),
    (36,32,"OOOOBLLBBBBCBBLLBCBBBCCSO"),
    (37,32,"BLLLLLLBBBCCLLLCCBBBCCCSO"),
    (38,32,"BLLLBBBBBCCCLCCCCCCCNNNO."),
    (39,32,"BBLLBBBBBCCCCCCCCCCCNNNO."),
    (40,32,"BBLLBBBLLCCCCCCCCCCNNO..."),
    (41,32,"BBBLLBLLLCCCCCCCCCCSO...."),
    (42,32,"BBLLLLLLLLCCCCCCCBSO....."),
    (43,32,"BLLLLLLLLLCCCCBBMSO......"),
    (44,32,"LLLLLLLLLLCCBBBMSO......."),
    (45,32,"LLLLLLLLLBBBBBMMSO......."),
    (46,32,"LLLLLLLLBBBBBBMMSSO......"),
    (47,32,"BLLLLLLLBBBBBMMSSSO......"),
    (48,32,"BBBBLLLLBBBBBMMSMSO......"),
]

# Crouch: compress the top of the shoulder and the neck together, carry
# their lit planes lower, and fold the two forelegs under the low chest.
# Original rear hip/hock/support pixels left of x=32 are retained.
WINDUP = [
    (26,32,"........................."),
    (27,32,"........................."),
    (28,32,"..........KK.......K....."),
    (29,32,".........OKK.....OKKO...."),
    (30,32,"........OBCO....OBSO....."),
    (31,32,"........OBHCO..OLBMSO...."),
    (32,32,".......OBLHCOOBLBBMSO...."),
    (33,32,"......OBLHHCLLLBBMMSO...."),
    (34,32,"......OBLHHHLLLBBBMSO...."),
    (35,32,"......OBLHLLLLBBBMSO....."),
    (36,32,"OOOOOOBLHLLMBBLBBMSO...."),
    (37,32,"BBLLLLBBBBMMBBLMMBMSO...."),
    (38,32,"BLLLLLBBBBGYNBLBYNBMSO..."),
    (39,32,"BLLLLBBBBBCBBLLBCBBBCCSO."),
    (40,32,"BBLLBBBBBCCLLLCCBBBCCCSO."),
    (41,32,"BBBLLLLBCCCLCCCCCCCNNNO.."),
    (42,32,"BBLLLLBBCCCCCCCCCCCNNNO.."),
    (43,32,"BLLLLLBLLCCCCCCCCCCNNO..."),
    (44,32,"LLLLLBBLLLCCCCCCCCCCSO..."),
    (45,32,"LLLLBBBBLLLCCCCCCCBSO...."),
    (46,32,"LLLBBBBBLLLLCCCCBBMSO...."),
    (47,32,"LLBBBBBBLLLLCCBBBMSO....."),
    (48,32,"BBBBBBBLLLLBBBBMMSO....."),
    (49,32,"BBBBBBLLLLBBBBMSSSO....."),
    (50,32,"MBBBBLLLBBBBBMMSSSO....."),
    (51,32,"MBBLLLLBBBBBMMSSSSO....."),
    (52,32,"OBBLLLBBBBBMMSSSSSO....."),
    (53,32,".OBBLLBBBBMMSSBMSO......"),
    (54,32,"..OBBLLBBMSSSBBMSO......"),
    (55,32,"...OBBLBBMSSSBBMSO......"),
    (56,32,"....OBBLBBMSSBBMSO......"),
    (57,32,".....OBLLBMSOBMSO......."),
    (58,32,"......OBLLMSO.OBMSO....."),
    (59,32,"......OBLLBBO.OBBMSO...."),
    (60,32,"......OOWOOWO.OOWOWO...."),
]

# Three silver hooks: each apex turns in short stair steps and each has
# its own open concave side. Keep the existing paw root at x=43..47.
CLAWS = [
    (28,53,".........."),
    (29,53,".........."),
    (30,53,".........."),
    (31,53,".........."),
    (32,53,"...I......"),
    (33,53,"...WI....."),
    (34,53,"....IWI..."),
    (35,53,".....IWI.."),
    (36,53,".....VWI.."),
    (37,53,"....IWI..."),
    (38,53,"..IIWI..I."),
    (39,53,".IWI..IWI."),
    (40,49,"O...IWI...IWI."),
    (41,49,"..IWI....IWI.."),
    (42,48,"IIVWI....IWI..."),
    (43,48,"IVWI...IVWI...."),
    (44,48,"IWIIIVWWI......"),
    (45,48,"VI.....VWI....."),
    (46,48,".IWI..........."),
    (47,48,"..IWWI.....I..."),
    (48,48,"....IWWI...WI.."),
    (49,48,"......IWWIVWI.."),
    (50,48,".......IVWWI..."),
    (51,48,"........VII...."),
    (52,48,"..............."),
    (53,48,"..............."),
    (54,48,"..............."),
    (55,48,"..............."),
    (56,48,"..............."),
]

CHANGES = {
    'poses/idle_a.pxgrid': REST,
    'poses/idle_b.pxgrid': REST + [
        (37,32,"BLLLLBBCCCLCCCCCCCNNNO..."),
        (41,32,"BBLLLLLLLLCCCCCCCBSO....."),
        (44,32,"LLLLLLLLLLBBBBMMSO......."),
        (47,32,"BLLLLLLLBBBBBMMSSSO......"),
    ],
    'poses/idle_c.pxgrid': REST + [
        (34,32,".......OBBGKNBLBKNBBMSO.."),
    ],
    'poses/recover.pxgrid': REST + RECOVER,
    'poses/windup.pxgrid': WINDUP,
    'actions/skill_b.pxgrid': CLAWS,
}


def main():
    archive = ROOT / 'revisions' / 'low-stance-claws-before'
    if (archive/'hashes.json').exists():
        raise RuntimeError('Archive exists; preserve the original snapshot.')
    # An interrupted write may have copied some originals already. Read
    # those preserved originals and never overwrite them during resume.
    hashes = {str(p.relative_to(ROOT)): hashlib.sha256(
                  (archive/p.relative_to(ROOT)).read_bytes()
                  if (archive/p.relative_to(ROOT)).exists() else p.read_bytes()).hexdigest()
              for folder in ('poses','actions') for p in (ROOT/folder).glob('*.pxgrid')}
    hashes['palette.json'] = hashlib.sha256((ROOT/'palette.json').read_bytes()).hexdigest()
    report = {}
    log = ['','# Low stance, compressed windup and three claw hooks; 0-based coordinates.']
    palette = json.loads((ROOT/'palette.json').read_text())
    for rel,runs in CHANGES.items():
        for y,x,pixels in runs:
            if x+len(pixels)>63 or not set(pixels) <= set(palette)|{'.'}:
                raise ValueError((rel,y,x,pixels))
    for rel, runs in CHANGES.items():
        path = ROOT/rel
        saved = archive/rel
        saved.parent.mkdir(parents=True,exist_ok=True)
        if not saved.exists():
            shutil.copyfile(path,saved)
        original = saved.read_text().splitlines()
        rows = original.copy()
        log.append('@ '+path.stem)
        for y,x,pixels in runs:
            if x+len(pixels)>63 or not set(pixels) <= set(palette)|{'.'}:
                raise ValueError((rel,y,x,pixels))
            rows[y] = rows[y][:x]+pixels+rows[y][x+len(pixels):]
            log.append(f'{y} {x} {pixels}')
        edits = [{'x':x,'y':y,'before':a,'after':b}
                 for y,(old,new) in enumerate(zip(original,rows))
                 for x,(a,b) in enumerate(zip(old,new)) if a!=b]
        path.write_text('\n'.join(rows)+'\n')
        report[rel]={'changed_pixels':len(edits),'edits':edits}
    (archive/'hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
    (ROOT/'low-stance-claws-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
    with (ROOT/'author_corrections.txt').open('a') as out:
        out.write('\n'.join(log)+'\n')
    print(json.dumps({k:v['changed_pixels'] for k,v in report.items()},indent=2))


if __name__=='__main__':
    main()
