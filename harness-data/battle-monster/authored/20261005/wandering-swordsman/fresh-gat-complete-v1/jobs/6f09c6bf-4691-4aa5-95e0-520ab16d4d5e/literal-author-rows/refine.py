"""Individually chosen short pixel runs after visual review; no frame transforms."""
from pathlib import Path
S=Path(__file__).resolve().parents[1]

def ink(path, edits):
    p=S/path
    rows=p.read_text().splitlines()
    for y,x,pixels in edits:
        rows[y]=pixels if x==0 and len(pixels)==64 else rows[y][:x]+pixels+rows[y][x+len(pixels):]
    p.write_text('\n'.join(rows)+'\n',encoding='ascii')

# The second blade face ends before the transparent right edge.
ink('poses/attack.pxgrid', [
    (36,0,'...............ocllccssijiiddiiccllcccpuuuehmmmmmmmmmmmmmmmmvv..'),
])
# A short section of steel is drawn out at the preparatory hand.
ink('poses/windup.pxgrid', [
    (37,43,'wm'), (38,42,'wmmv'), (39,41,'wmmv'),
    (40,40,'hvm'), (41,40,'hh'),
])
# The stepping arm now carries the newly drawn blade above the short sheath.
ink('poses/move.pxgrid', [
    (33,52,'w'), (34,51,'wv'), (35,49,'wmv'),
    (36,47,'wmv'), (37,45,'wmmv'), (38,43,'wmv'),
    (39,42,'h'), (40,42,'hj'),
])
# Uneven gathering light curls up from the rearward blade edge.
ink('actions/skill_a.pxgrid', [
    (48,9,'m'), (49,8,'mwm'), (50,7,'vm'),
    (51,5,'mm'), (52,3,'vm'),
])
# Two differently angled shoes on the fallen body's independently bent legs.
ink('poses/dead.pxgrid', [
    (47,51,'ohhhkko'),
    (48,43,'oscllccoohhkkkko'),
    (49,43,'oscllccssohkkkko'),
    (50,46,'cllccssoooooooo'),
    (57,49,'ohhhkko'), (58,48,'ohhkkkko'), (59,47,'ooooooooo'),
])
# Flattened crown and oblique broad brim make the dropped gat less conical.
ink('poses/dead.pxgrid', [
    (47,0,'......ooooooo......'),
    (48,0,'......ohhhkkko.....'),
    (49,0,'.....ohhkkkkko.....'),
    (50,0,'.....ohkkkkkkko....'),
    (51,0,'....ohkkkkkkkkko...'),
    (52,0,'....okkkkkkkkkko...'),
    (53,0,'...ohhkkkkkkkkkko..'),
    (54,0,'..ohhkkkkkkkkkkkkoo'),
    (55,0,'..okkkkkkkkkkkkkkkkko...'),
    (56,0,'...ookkkkkkkkkkkkkkkkkko..'),
    (57,0,'.....oohhhhhkkkkkkkkoooo....'),
    (58,0,'.......ooooooooooooooo....'),
])
# Shorter bent forearm, explicit fist and a longer exposed horizontal blade.
# These are new row strings, not a translation of the earlier arm or weapon.
p=S/'poses/attack.pxgrid'
rows=p.read_text().splitlines()
rows[34]='................osclllccijidillccco......wwwwwwwwwwwwwwwwwwwwww.'
rows[35]='...............oscllccsijjiddicccpuupohwwwwwmmmmmmmmmmmmmmmmmmv.'
rows[36]='...............ocllccssijiiddiiccpuuuehmmmmmmmmmmmmmmmmmmmmmmvv.'
rows[37]='................ocllcssijidddiiccpuuutkhvvvvvvvvvvvvvvvvvvvvvvv.'
rows[38]='.................occcssiiddddicclccssotppoho'
rows[38]=rows[38].ljust(64,'.')
# Serialize the explicitly chosen row strings with transparent suffixes.
for y in [34,35,36,37]: rows[y]=rows[y].ljust(64,'.')
p.write_text('\n'.join(rows)+'\n',encoding='ascii')
