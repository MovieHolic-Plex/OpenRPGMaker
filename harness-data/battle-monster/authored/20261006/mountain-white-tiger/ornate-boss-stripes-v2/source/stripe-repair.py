"""Bounded manual fur repair. Each frame has its own literal coordinate list.

Do not run author.py to rebuild these repaired grids: it is the preserved original.
This helper only applies the selected short runs and decodes native previews.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image

ROOT = Path(__file__).parent
# Coordinates are zero based (x, y, literal palette symbols).
# These are separate inspected lists, not a shared pattern or propagated mask.
RUNS = {
 'poses/idle_a': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(96,114,'ddd'),(97,115,'dd')],
 'poses/idle_b': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(96,114,'ddd'),(97,115,'dd')],
 'poses/idle_c': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(96,114,'ddd'),(97,115,'dd')],
 'poses/windup': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(67,68,'ddssd'),(67,69,'ddssd'),(67,70,'ddssd'),(67,71,'ddssd'),
  (75,60,'h'),(75,61,'h'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(86,112,'dd'),(87,113,'d')],
 'poses/move': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(67,68,'ddssd'),(67,69,'ddssd'),(67,70,'ddssd'),(67,71,'ddssd'),
  (75,60,'h'),(75,61,'h'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),
  (39,103,'ddd'),(40,104,'dd'),(97,105,'ddd'),(98,106,'dd')],
 'poses/attack': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(67,68,'ddssd'),(67,69,'ddssd'),(67,70,'ddssd'),(67,71,'ddssd'),
  (75,60,'h'),(75,61,'h'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),
  (39,103,'ddd'),(40,104,'dd'),(104,100,'ddd'),(105,101,'dd'),(106,102,'d')],
 'poses/recover': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(67,68,'ddssd'),(67,69,'ddssd'),(67,70,'ddssd'),(67,71,'ddssd'),
  (75,60,'h'),(75,61,'h'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(94,112,'ddd'),(95,113,'dd')],
 'poses/hit': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (39,113,'ddd'),(38,114,'dd'),(101,112,'dd'),(100,113,'dd')],
 'poses/dead': [
  (43,100,'ddd'),(44,101,'ddsd'),(45,102,'ddssd'),(46,103,'ddsd'),(47,104,'ddd'),(48,105,'dd'),(49,106,'d'),
  (53,104,'ddd'),(54,105,'ddsd'),(55,106,'ddssd'),(56,107,'ddsd'),(57,108,'ddd'),(58,109,'dd'),(59,110,'d'),
  (27,105,'ddd'),(28,106,'dd'),(29,107,'d'),
  (36,113,'d'),(35,114,'dd'),(36,116,'dsddd'),(38,117,'dd'),(39,118,'d'),
  (41,119,'ddd'),(42,120,'dd')],
 'actions/skill_a': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(96,114,'ddd'),(97,115,'dd')],
 'actions/skill_b': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(96,114,'ddd'),(97,115,'dd')],
 'actions/skill_c': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(96,114,'ddd'),(97,115,'dd')],
 'actions/poison_a': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(101,112,'dd'),(100,113,'dd')],
 'actions/poison_b': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(101,112,'dd'),(100,113,'dd')],
 'actions/stun_a': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(101,112,'dd'),(100,113,'dd')],
 'actions/stun_b': [
  (53,60,'ddd'),(52,61,'ddssd'),(51,62,'ddssd'),(50,63,'ddssdd'),
  (49,64,'ddssd'),(48,65,'ddssd'),(47,66,'ddssd'),(47,67,'ddssd'),(48,68,'ddssdd'),(48,78,'dd'),(49,79,'d'),
  (65,63,'ddd'),(65,64,'ddsd'),(65,65,'ddssd'),(66,66,'ddssd'),(67,67,'ddssd'),(68,68,'ddssd'),(69,69,'ddsd'),(69,70,'ddsd'),(68,71,'ddssd'),
  (36,75,'ddd'),(36,76,'ddsd'),(37,77,'ddsd'),(38,78,'ddd'),(39,79,'dd'),(40,80,'d'),
  (37,86,'dd'),(36,87,'ddsd'),(35,88,'ddssd'),(34,89,'ddssd'),(35,98,'dd'),(36,99,'d'),
  (36,113,'ddd'),(36,114,'dd'),(101,112,'dd'),(100,113,'dd')],
 'actions/sleep_a': [
  (25,99,'dd'),(26,100,'ddsd'),(27,101,'ddsd'),(30,102,'dd'),(31,103,'d'),
  (41,93,'ddsd'),(42,94,'ddssd'),(43,95,'ddssd'),(44,96,'ddssd'),(45,97,'ddsd'),(46,98,'ddsd'),(47,99,'ddd'),(48,100,'dd'),(49,101,'d'),
  (52,97,'ddsd'),(53,98,'ddssd'),(54,99,'ddssd'),(55,100,'ddsd'),(55,101,'ddd'),(54,102,'dd'),(53,103,'d'),
  (41,110,'d'),(40,111,'dd'),(40,112,'dd'),(43,113,'dd'),(43,114,'ddd'),(43,115,'dd'),(44,116,'dd'),(44,117,'d'),
  (90,119,'ddd'),(91,120,'dd')],
 'actions/sleep_b': [
  (25,99,'dd'),(26,100,'ddsd'),(27,101,'ddsd'),(30,102,'dd'),(31,103,'d'),
  (41,93,'ddsd'),(42,94,'ddssd'),(43,95,'ddssd'),(44,96,'ddssd'),(45,97,'ddsd'),(46,98,'ddsd'),(47,99,'ddd'),(48,100,'dd'),(49,101,'d'),
  (52,97,'ddsd'),(53,98,'ddssd'),(54,99,'ddssd'),(55,100,'ddsd'),(55,101,'ddd'),(54,102,'dd'),(53,103,'d'),
  (41,110,'d'),(40,111,'dd'),(40,112,'dd'),(43,113,'dd'),(43,114,'ddd'),(43,115,'dd'),(44,116,'dd'),(44,117,'d'),
  (90,119,'ddd'),(91,120,'dd')],
}

def main():
    if (ROOT/'STRIPE-REPAIR.md').exists():
        raise RuntimeError('Repair already recorded; keep the original before/after inventory. Do not reapply.')
    palette_bytes = (ROOT/'palette.json').read_bytes()
    palette = json.loads(palette_bytes)
    # Guard every chosen run before starting any file writes.
    for name,runs in RUNS.items():
        rows = (ROOT/(name+'.pxgrid')).read_text().splitlines()
        for x,y,pixels in runs:
            old = rows[y][x:x+len(pixels)]
            if any(c not in 'hwgds' for c in old):
                raise ValueError(('selected run touches protected ink',name,x,y,old,pixels))
    log = ['# Mountain white tiger — bounded stripe repair', '',
      'AI repair candidate; no human decision or independent review is asserted.', '',
      'Inspected the attached native original and real 18-pose parent sheet before selecting these runs.',
      'All coordinates below are zero based. Each row records only pixels actually changed, with the exact old and new ASCII runs.', '',
      '## Marking choices', '',
      'Standing/crouched frames: join the upper rear-back spot to its lower flank mark; join the middle back spot to the lower shoulder mark. Their paths bend in opposite directions across the long torso. Extend the rear diagonal flank mark with a narrow hook and the thigh mark with a taper. Retain the original upper scapular hook where visible: five principal body/thigh bands, four in the low-neck motion frames. Remove the two isolated cropped flecks at (75,60–61) in windup/move/attack/recover.',
      'Sleeping/dead bodies have separately selected shorter, rounder bands fitting their compressed flank. Short lower-leg bands follow the actual bent or extended limb in each frame. Existing tail bands stay untouched.',
      'Dark d/s runs retain the established ink colours. Long connected paths, unequal bends, and narrowing ends replace the separated spot reading. Broad ivory spaces remain between them; no evenly repeated stripe wallpaper was added.', '',
      '## Preservation and remaining problems', '',
      'Palette bytes, transparency, outline pixels, facial/head pixels, collar/jade/red knots, contacts, and effects are outside the selected edits. Existing grey planes remain; the sleeping thigh has a tiny marking continuation on its grey fur, without reshaping the plane. Every original posture and frame duration is retained.',
      'This addresses the species-marking defect only. Weak torso propulsion, some straight foreleg shading, and similar poison/stun weight distribution remain. Fixed facial marks can still look spot-like. The original author.py and progress/ images remain archival; stripe-repair/ holds the repaired native previews. The harness must perform current checks, independent review and GIF publication; a human still chooses Allow/Modify/Deny.', '',
      'Palette SHA-256: `'+hashlib.sha256(palette_bytes).hexdigest()+'`.', '']
    output = ROOT/'stripe-repair'
    output.mkdir(exist_ok=True)
    sheet = Image.new('RGBA', (384,768), (112,112,112,255))
    for index,(name,runs) in enumerate(RUNS.items()):
        path = ROOT/(name+'.pxgrid')
        original_bytes = path.read_bytes()
        original = original_bytes.decode('ascii').splitlines()
        grid = [list(row) for row in original]
        for x,y,pixels in runs:
            old = ''.join(grid[y][x:x+len(pixels)])
            # A write guard, not a replacement for harness pixel checks.
            if any(c not in 'hwgds' for c in old):
                raise ValueError(('selected run touches protected ink',name,x,y,old,pixels))
            grid[y][x:x+len(pixels)] = pixels
        final = [''.join(row) for row in grid]
        log += ['## '+name, '',
          'Original SHA-256: `'+hashlib.sha256(original_bytes).hexdigest()+'`.', '',
          '| x | y | original | repaired |', '|---:|---:|---|---|']
        count = 0
        for y,(old,new) in enumerate(zip(original,final)):
            x = 0
            while x < 128:
                if old[x] == new[x]:
                    x += 1
                    continue
                start = x
                while x < 128 and old[x] != new[x]:
                    x += 1
                count += x-start
                log.append(f'| {start} | {y} | `{old[start:x]}` | `{new[start:x]}` |')
        log += ['', f'{count} changed pixels of 16,384 canvas pixels.', '']
        path.write_text('\n'.join(final)+'\n', encoding='ascii')
        im = Image.new('RGBA',(128,128))
        im.putdata([(0,0,0,0) if c=='.' else tuple(bytes.fromhex(palette[c][1:]))+(255,) for row in final for c in row])
        im.save(output/(path.stem+'.png'))
        sheet.alpha_composite(im,((index%3)*128,(index//3)*128))
        print(name, count)
    sheet.save(output/'native-suite.png')
    (ROOT/'STRIPE-REPAIR.md').write_text('\n'.join(log)+'\n')

if __name__ == '__main__':
    main()
