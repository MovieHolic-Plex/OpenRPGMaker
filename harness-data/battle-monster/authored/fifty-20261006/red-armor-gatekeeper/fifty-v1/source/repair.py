"""Review correction: only literal coordinate strings, no pose transforms.
Run after author.py, or on current grids. Idempotent named pixel replacements.
All coordinates are zero-based native pixels. Original grids: repair-baseline/.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parent
EDITS = {
'idle_b': [
 (48,83,'oshssdo'), (48,84,'oshssdo'),
 (68,83,'odsssdo'), (68,84,'ossssdo'), (68,85,'odsssdo'),
],
'idle_c': [
 (48,83,'odshsdo'), (48,84,'oshssdo'),
 (68,83,'odsssdo'), (68,84,'ossssdo'), (68,85,'odsssdo'),
],
# Back elbow contracts behind the body; bronze cuff and actual teal fingers
# are separately chosen. The chest badge to the right remains intact.
'move': [
 (36,65,'......oshhsssddo...VHHVVVVVVVVV'),
 (36,66,'......oshhsssddoHHHHVVVVVVVVVVV'),
 (36,67,'.....oshhsssddoHHHVVVVVVVVVVVVV'),
 (36,68,'....oshhsssddoHHVVVVVVVVVVVVVVV'),
 (36,69,'...oshhsssddoHHHVVVVVVVVVVVVVVV'),
 (36,70,'..oshhsssddoHHHVVVVVVVVVVVVVVVV'),
 (36,71,'.oshhsssddoHHVVVVVVVVVVVVVVVVV'),
 (36,72,'oshhhssssddoHVVVVVVVVVVVVVVVVV'),
 (36,73,'oshhhssssddoobgggggggggggggggg'),
 (36,74,'.oshhhsssddoobgggggggggggggggg'),
 (36,75,'..ocbbbbbbbbccobbbbbbbbbbbbbbb'),
 (36,76,'...obgwwggggbcoddddddddddddddd'),
 (36,77,'....obggggggbcoooooooobggggggg'),
 (36,78,'.....ocbbbbcco.o......obgVVVVV'),
 (36,79,'.......oUUTTto.o.....obgVVVVVV'),
 (36,80,'........oUTTTto.....obgVVVVVVV'),
 (36,81,'........oTTkkTto....obgVVVVVVV'),
 (36,82,'.........oTTTTto...obgVVVVVVVV'),
# Left skirt plate behind the contracted hand; no isolated old rim tip.
 (38,77,'ob'), (38,78,'obg'), (37,79,'obgwwg'),
 (36,80,'obgwVHVV'), (35,81,'obgVHVVVV'), (34,82,'obgVVVVRR'),
# Front upper arm has one visible elbow, folding back into its cuff.
 (74,65,'oshssddo...................'),
 (74,66,'.oshssddo..................'),
 (74,67,'.oshhssddo.................'),
 (74,68,'..oshhssddo................'),
 (74,69,'..oshhssddo................'),
 (74,70,'..oshhssddo................'),
 (74,71,'.oshhsssddo................'),
 (74,72,'oshhsssddo.................'),
 (74,73,'oshhssddo..................'),
 (74,74,'ocbbbbbbcco................'),
 (74,75,'obgwwgggbco................'),
 (74,76,'obggggggbco................'),
 (74,77,'.ocbbbbcco.................'),
 (74,78,'..oUUTTTto.................'),
 (74,79,'..oUTTTTto.................'),
 (74,80,'..oTTkkTto.................'),
 (74,81,'..oTTTTTto.................'),
 (74,82,'...oTTTto..................'),
# A long, unbranched haft. Old tip pixels are explicitly erased on each row.
 (102,79,'...................'), (102,80,'...................'),
 (102,81,'...................'), (101,82,'....................'),
 (94,79,'oooo'), (92,80,'oobggbco'),
 (90,81,'oobgwwggbco'), (88,82,'oobgwwwgggbbco'),
 (5,83,'.oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooobggwwwggggbbbco...................'),
 (5,84,'obgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggbbbbco..................'),
 (5,85,'ocbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbcco....................'),
 (5,86,'.oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooocbbbbbbbccoo........................'),
 (88,87,'oocbbbcoo........................'),
 (90,88,'oocco............................'),
# Fingers cross the haft, leaving the bronze handle visible on both sides.
 (43,82,'oTTkkTto'), (43,83,'oTTTTTto'),
 (44,84,'oTTTtto'), (45,85,'ooooo'),
 (76,82,'oTTkkTto'), (76,83,'oTTTTTto'),
 (77,84,'oTTTtto'), (78,85,'ooooo'),
],
# Contact: the thigh slopes forward from the original hip, the broad knee
# compresses into a load-bearing shin and larger boot at the same y124.
'attack': [
 (66,88,'ooooooosssddooooooooooooo.............................'),
 (66,89,'........oshhsssddo...................................'),
 (66,90,'..........oshhsssddo.................................'),
 (66,91,'............oshhsssddo...............................'),
 (66,92,'..............oshhsssddo.............................'),
 (66,93,'................oshhsssddo...........................'),
 (66,94,'.................obggggggbco.........................'),
 (66,95,'..................obgwwggggbco.......................'),
 (66,96,'..................obgwVHHVVgbco......................'),
 (66,97,'..................obgVHHVVVRgbco.....................'),
 (66,98,'..................obgVHVVVVRgbco.....................'),
 (66,99,'..................obgVVVVVRRgbco.....................'),
 (66,100,'..................ocbbbbbbbbcco......................'),
 (66,101,'...................oshhsssdddo.......................'),
 (66,102,'...................oshhsssdddo.......................'),
 (66,103,'...................oshhsssdddo.......................'),
 (66,104,'...................oshhsssdddo.......................'),
 (66,105,'...................oshhsssdddo.......................'),
 (66,106,'..................oobgggggggbco......................'),
 (66,107,'..................obgwwggggggbco.....................'),
 (66,108,'..................obgwVHHVVVVgbco....................'),
 (66,109,'..................obgVHHVVVVVRgbco...................'),
 (66,110,'..................obgVHVVVVVVRgbco...................'),
 (66,111,'..................obgVVVVVVVVRgbco...................'),
 (66,112,'..................obgVVVVVVVVRgbco...................'),
 (66,113,'..................obgVVVVVVVVRgbco...................'),
 (66,114,'..................obgVVVVVVVVRgbco...................'),
 (66,115,'..................obgVVVVVVVVRRgbco..................'),
 (66,116,'..................obgVVVVVVVVRRRgbco.................'),
 (66,117,'..................obgVVVVVVVVRRRggbco................'),
 (66,118,'..................obgVVVVVVVVRRRRgggbco..............'),
 (66,119,'.................obggVVVVVVVVRRRRggggbco.............'),
 (66,120,'.................obggVVVVVVVVRRRRggggggbco...........'),
 (66,121,'.................obggVVVVVVVVRRRRgggggggbco..........'),
 (66,122,'.................ocbbbbbbbbbbbbbbbbbbbbbbbbcco.......'),
 (66,123,'.................odddddddddddddddddddddddddddo.......'),
 (66,124,'..................ooooooooooooooooooooooooooo........'),
],
# Fallen near knee / silver ankle / broad toe are separate from the cuirass.
# The other folded leg has a darker overlapping kneecap and ground sole.
'dead': [
 (29,105,'..oooooo'),
 (29,106,'.obggggbco'),
 (29,107,'obgwwVVggbco'),
 (29,108,'obgwVHVVgbco'),
 (29,109,'obgVVVVRgbco'),
 (29,110,'.ocbbbbbcco'),
 (28,111,'osshhsssddo'),
 (26,112,'osshhsssddo'),
 (24,113,'osshhsssddo'),
 (23,114,'ocbbbbbbcco'),
 (22,115,'obgwwgggbco'),
 (21,116,'obggVVVRgbco'),
 (41,109,'ocbbcco'),
 (41,110,'obgRRgbco'),
 (41,111,'obgVRRgbco'),
 (42,112,'obgRRRgbco'),
 (42,113,'ocbbbbbbco'),
 (43,114,'osssdddo'),
 (43,115,'osssdddo'),
 (43,116,'ocbbbbcco'),
 (40,121,'oocbbccossssddo'),
 (40,122,'oodddddoddddddo'),
 (40,123,'ooooooooooooooo'),
 (40,124,'oooooooooooooo'),
],
# Existing gold-white center retained, bronze one-pixel edge on the ray.
'skill_a': [
 (112,62,'b'), (111,63,'bgb'), (110,64,'bgwgb'),
 (109,65,'bgwwgb'), (109,66,'bgwwgb'),
 (108,67,'bgwwwgb'), (108,68,'bgwwwgb'),
 (107,69,'bgwwwwgb'), (107,70,'bgwwwggb'),
 (106,71,'bgwwwggb'), (106,72,'bgwwwggb'),
 (105,73,'bgwwwggb'), (105,74,'bgwwwggb'),
 (104,75,'bgwwwggb'), (104,76,'bgwwwggb'),
 (103,77,'bgwwwggb'), (103,78,'bgwwwggb'),
 (102,79,'bgwwwggb'), (102,80,'bgwwwggb'),
 (101,81,'bgwwwggb'), (101,82,'bgwwwggb'),
 (100,83,'bgwwwgggggb'), (100,84,'bgwwwwwwwggb'),
 (101,85,'bggggwwwwggb'), (107,86,'ggwwwgb'),
 (108,87,'gwwgb'), (109,88,'ggb'),
],
'stun_b': [(79,102,'.')],
}

def apply():
 for name,edits in EDITS.items():
  folder='poses' if (ROOT/'poses'/(name+'.pxgrid')).exists() else 'actions'
  path=ROOT/folder/(name+'.pxgrid')
  rows=[list(r) for r in path.read_text().splitlines()]
  for x,y,pixels in edits:
   if not (0<=x and x+len(pixels)<=128 and 0<=y<128):
    raise ValueError((name,x,y,len(pixels)))
   rows[y][x:x+len(pixels)] = pixels
  path.write_text('\n'.join(''.join(r) for r in rows)+'\n')
 print('Applied literal review edits to',len(EDITS),'native source grids')

if __name__=='__main__': apply()
