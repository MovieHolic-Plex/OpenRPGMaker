"""Explicit native row repairs, applied only inside this source directory.

Every replacement cluster below is literal. No body transforms, tracing,
generated geometry, inferred shading, or automatic boundary repair.
The complete pxgrid files remain the delivery source.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def apply_rows(path, runs):
    rows = [list(r) for r in path.read_text().splitlines()]
    for x, y, pixels in runs:
        if x < 0 or x + len(pixels) > 128:
            raise ValueError((path.name, x, y, pixels))
        rows[y][x:x+len(pixels)] = pixels
    path.write_text('\n'.join(''.join(r) for r in rows)+'\n')

def apply():
    # The shin's inner outline is contained; the actual y=124 foot is untouched.
    apply_rows(ROOT/'poses/windup.pxgrid', [
        (39,114,'OBLLBBBSSDDDO.......'),
        (37,119,'OBLBBSSDDDDDO.......'),
    ])

    # Clear the old arm with individually specified complete region rows.
    # Retain/redraw the right vessel flank and a wider load-bearing mount.
    # These rows are x=87..124. Torso, rim, tassel and planted feet outside
    # this region remain the original authored pixels.
    apply_rows(ROOT/'poses/attack.pxgrid', [
        (87,47,'......................................'),
        (87,48,'......................................'),
        (87,49,'......................................'),
        (87,50,'......................................'),
        (87,51,'......................................'),
        (87,52,'......................................'),
        (87,53,'......................................'),
        (87,54,'......................................'),
        (87,55,'SSBBSSDDO.............................'),
        (87,56,'SBBLBBSSDO............................'),
        (87,57,'BBLLBBSSDO............................'),
        (87,58,'BBLBBSSDDO............................'),
        (87,59,'SBBSSDDDO.............................'),
        (87,60,'SSSDDDDO..............................'),
        (87,61,'SSDDDDO...............................'),
        (87,62,'DDDDDO................................'),
        (87,63,'DDDDDO................................'),
        (87,64,'DDDDDO................................'),
        (87,65,'YgSSO.................................'),
        (87,66,'gSSDO.................................'),
        (87,67,'gSSDDO................................'),
        (87,68,'gSSDDO................................'),
        (87,69,'gSSDDO................................'),
        (87,70,'gSSDDO................................'),
        (87,71,'SSDDDO................................'),
        (87,72,'SSDDDO................................'),
        (87,73,'DDDDDO................................'),
        (87,74,'DDDDDO................................'),
        (87,75,'DDDDDO................................'),
        (87,76,'DDDDO.................................'),
        (87,77,'DDDDO.................................'),
        (87,78,'DDDDDO................................'),
        # Broad upper handle extends outward above the open handle interior.
        (93,51,'OOOOOOOOOOOOOOOOOO'),
        (92,52,'OgYYYYYYYYYYYYYYYgGOOO'),
        (91,53,'OgYWWWWWWWWYYYYYYYYggGDOO'),
        (91,54,'OgYWWYYYYYggggggggGGDDDO'),
        (92,55,'OgYWWYYggGDDDDDDDO'),
        (92,56,'OgYWWYgGDDOOOOOOOO'),
        (92,57,'OgYYgGDDO'),
        (92,58,'OgYgGDDO'),
        (92,59,'OgGDDDO'),
        (92,60,'ODDDDO'),
        # Compressed wrist and forward knuckles, visible green palm volume.
        (111,53,'OOOOBBBSSDOO'),
        (109,54,'OBLLHHLLBBSSDOO'),
        (108,55,'OBLHTTHHLLBBSSDO'),
        (108,56,'OBLHTHHLLBODSDDO'),
        (108,57,'OBLHHHLLBBODSDDO'),
        (108,58,'OBLHHLLBBBODSDDO'),
        (107,59,'OBLLLLLBBBODBSDDO'),
        (107,60,'OBLLLLLBBBODBSDDO'),
        (106,61,'OBLLLBBBBBODDBSDDO'),
        (106,62,'OBLLBBBBBBODBSDDO'),
        (106,63,'OBBBBSSSSSSDDDDO'),
        (105,64,'OGgBBSSSSSSDDDO'),
        # Lower handle is a separate sloping forearm returning to the mount.
        (100,65,'OgYgGDBBBBSSDDO'),
        (98,66,'OgYYgGDDDDDDDOO'),
        (97,67,'OgYWWYgGDDDOOO'),
        (96,68,'OgYWWYYgGDDO'),
        (95,69,'OgYWWYgGDDO'),
        (94,70,'OgYWWYgGDDO'),
        (93,71,'OgYWWYgGDDO'),
        (92,72,'OgYYgGDDDO'),
        (91,73,'OgYYgGDDDO'),
        (91,74,'OgYgGDDDO'),
        (91,75,'OgGDDDDO'),
        (91,76,'ODDDDDO'),
        (92,77,'OOOOOO'),
    ])

    # Restore the folded lid/cavity and exterior gold underneath two flames.
    # Literal native background rows, not pixel extraction from a PNG.
    apply_rows(ROOT/'actions/skill_c.pxgrid', [
        (60,27,'...........................'),
        (60,28,'...........................'),
        (60,29,'...........................'),
        (60,30,'...........................'),
        (60,31,'...........................'),
        (60,32,'OOOOOOOOO..................'),
        (60,33,'SSDDOOOOOOO................'),
        (60,34,'DDDOOYYYYggOOO.............'),
        (60,35,'DOgYYYYYYYYYYggOO..........'),
        (60,36,'OOGGggYYYYYYYYYYgOO........'),
        (60,37,'DDDOOGGggYYYYYYYYgOO.......'),
        (60,38,'SSDDDDOOGggYYYYYYYgO.......'),
        (60,39,'SSSSSDDDDOGggYYYYYYgO......'),
        (60,40,'SSSSSSDDDOGggYYYYYYgO......'),
        (60,41,'SSSSSSSDDDOGgYYYYYYYgO.....'),
        (60,42,'SSSSSSSSDDOGgYYYYYYYgO.....'),
        (60,43,'SSSSSSSSDDOGgYYYYYYYgO.....'),
        (60,44,'SSSSSSSSDDOGgYYYYYYYgO.....'),
        # Central cooling tongue curls left; its narrow root leaves a gap.
        (65,27,'F'),
        (64,28,'FAF'),
        (64,29,'FACF'),
        (63,30,'FACCF'),
        (62,31,'FACWCF'),
        (62,32,'FACWWCF'),
        (61,33,'FACWWCF'),
        (60,34,'FACWWCF'),
        (60,35,'FACWCCF'),
        (60,36,'FACWCCF'),
        (60,37,'FACCFF'),
        (60,38,'FACCF'),
        (60,39,'FACCF'),
        (60,40,'FACF'),
        (60,41,'FAF'),
        (60,42,'FF'),
        # Right tongue curls toward its dark inner-cavity root at (68,43).
        (75,31,'F'),
        (74,32,'FAF'),
        (73,33,'FACF'),
        (72,34,'FACCF'),
        (71,35,'FACCF'),
        (70,36,'FACCF'),
        (69,37,'FACWCF'),
        (68,38,'FACWCF'),
        (68,39,'FACCF'),
        (68,40,'FACF'),
        (68,41,'FAF'),
        (68,42,'FAF'),
        (68,43,'FF'),
    ])

if __name__ == '__main__':
    apply()
