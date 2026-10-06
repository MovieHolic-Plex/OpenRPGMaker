"""Explicit, individually chosen pixel strings for the two reviewer corrections.

No shape generation, frame transforms, palette changes or automatic fill.
Coordinates are zero based. Existing good anatomy is retained.
"""
from pathlib import Path
import shutil
import json

ROOT = Path(__file__).resolve().parent

# x46..61, y19..46. Each literal row replaces only the old cast effect.
# The upper bulb curls back into a narrow S tail; the lower bulb bends down.
FLAME_ROWS = {
    19: '............t...',
    20: '..........ttT...',
    21: '........TtvvT...',
    22: '.......TtvvvvT..',
    23: '.......TtvvvvT..',
    24: '......TtvvvttT..',
    25: '......TtvvttT...',
    26: '......TtvtT.....',
    27: '.....Ttvt.......',
    28: '......Tvt.......',
    29: '......Tvt.......',
    30: '.....Tvt........',
    31: '...Ttvt.........',
    32: '.Ttvt...........',
    33: 'ttT.............',
    34: 'ttT.............',
    35: '.Ttvt...........',
    36: '...Ttvt.........',
    37: '.....Ttvt.......',
    38: '.......Tvt......',
    39: '......TtvvvtT...',
    40: '......TtvvvvtT..',
    41: '......TtvvvvtT..',
    42: '.......TtvvttT..',
    43: '........TttTT...',
    44: '.......TttT.....',
    45: '......TtT.......',
    46: '.....tT.........',
}

# Each pose's knot and hanging thread are explicitly placed at that pose's
# actual handle/rim. No coordinate propagation from one pose to another.
# R = dark red boundary, r = crimson, C = the lit knot.
CORD_RUNS = {
    'idle_a': [(19,44,'RrC'), (18,45,'Rr'), (17,46,'Rr'), (16,47,'R')],
    'idle_b': [(19,44,'RrC'), (18,45,'Rr'), (17,46,'Rr'), (17,47,'R')],
    'idle_c': [(19,45,'RrC'), (18,46,'Rr'), (17,47,'Rr'), (16,48,'R')],
    'windup': [(26,36,'RrC'), (25,37,'Rr'), (25,38,'R'), (24,39,'R')],
    'move': [(27,37,'RrC'), (26,38,'Rr'), (26,39,'R'), (25,40,'R')],
    'attack': [(27,37,'RrC'), (26,38,'Rr'), (26,39,'R'), (26,40,'R')],
    'recover': [(20,45,'RrC'), (19,46,'Rr'), (18,47,'Rr'), (17,48,'R')],
    'hit': [(21,44,'RrC'), (21,45,'Rr'), (20,46,'Rr'), (19,47,'R')],
    'dead': [(10,56,'RrC'), (9,57,'Rr'), (8,58,'Rr'), (8,59,'R')],
    'skill_a': [(22,42,'RrC'), (22,43,'Rr'), (21,44,'Rr'), (21,45,'R')],
    'skill_b': [(24,42,'RrC'), (24,43,'Rr'), (23,44,'Rr'), (23,45,'R')],
    'skill_c': [(23,42,'rC'), (22,43,'Rr'), (21,44,'Rr'), (21,45,'R')],
    'poison_a': [(19,49,'RrC'), (18,50,'Rr'), (17,51,'Rr'), (16,52,'R')],
    'poison_b': [(18,49,'RrC'), (17,50,'Rr'), (16,51,'Rr'), (16,52,'R')],
    'stun_a': [(18,50,'RrC'), (17,51,'Rr'), (16,52,'Rr'), (15,53,'R')],
    'stun_b': [(18,50,'RrC'), (18,51,'Rr'), (17,52,'Rr'), (16,53,'R')],
    'sleep_a': [(16,56,'RrC'), (14,57,'Rr'), (13,58,'Rr'), (13,59,'R')],
    'sleep_b': [(16,56,'RrC'), (14,57,'Rr'), (14,58,'Rr'), (13,59,'R')],
}

def apply_repairs():
    history = ROOT / 'history' / 'before-flames-and-cord'
    for name, runs in CORD_RUNS.items():
        group = 'poses' if name in ('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead') else 'actions'
        path = ROOT / group / (name + '.pxgrid')
        original = history / group / path.name
        if not original.exists():
            original.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, original)
        rows = path.read_text().splitlines()
        if name == 'skill_b':
            for y, pixels in FLAME_ROWS.items():
                if len(pixels) != 16:
                    raise ValueError(('literal effect row length', y, len(pixels)))
                rows[y] = rows[y][:46] + pixels + rows[y][62:]
        for x, y, pixels in runs:
            rows[y] = rows[y][:x] + pixels + rows[y][x+len(pixels):]
        path.write_text('\n'.join(rows) + '\n')
    # Record observed differences against the preserved draft, without filling
    # or changing any further pixel in response to diagnostics.
    differences = []
    for group in ('poses','actions'):
        for path in sorted((ROOT / group).glob('*.pxgrid')):
            before = (history / group / path.name).read_text().splitlines()
            after = path.read_text().splitlines()
            edits = [{'x':x, 'y':y, 'before':a, 'after':b}
                     for y,(ar,br) in enumerate(zip(before,after))
                     for x,(a,b) in enumerate(zip(ar,br)) if a != b]
            differences.append({'pose':path.stem, 'changed_pixels':len(edits), 'edits':edits})
    (ROOT / 'repair-diff.json').write_text(json.dumps(differences,indent=2)+'\n')

if __name__ == '__main__':
    apply_repairs()
