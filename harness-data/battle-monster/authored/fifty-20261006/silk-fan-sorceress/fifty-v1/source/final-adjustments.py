"""Frame-specific hand, face and fan-core adjustments chosen after PNG review.
Coordinates below are literal decisions; no automatic cross-frame copying.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PATCHES={
 'idle_a': [(17,27,'sol'),(19,28,'o')],
 'idle_b': [(17,27,'sol'),(19,28,'o')],
 'idle_c': [(17,27,'sol'),(19,28,'o')],
 'windup': [(17,26,'sol'),(19,27,'o')],
 'move': [(19,29,'sol'),(21,30,'o')],
 'attack': [(19,32,'sol'),(21,33,'o')],
 'recover': [(17,28,'sol'),(19,29,'o')],
 'hit': [(20,24,'sl'),(22,24,'so')],
 'dead': [(44,24,'ss')],
 'skill_a': [(17,27,'sol'),(19,28,'o'),
             (26,44,'yy'),(27,43,'yywy'),(28,43,'ywwy'),
             (29,43,'yyyy'),(30,44,'yy')],
 'skill_b': [(17,28,'sol'),(19,29,'o'),(29,43,'yww'),(30,43,'ywwy')],
 'skill_c': [(17,28,'sol'),(19,29,'o')],
 'poison_a': [(21,27,'ssl'),(23,28,'o')],
 'poison_b': [(22,27,'ssl'),(24,28,'o')],
 'stun_a': [(24,25,'ssl'),(26,26,'o')],
 'stun_b': [(24,25,'ssl'),(26,26,'o')],
 'sleep_a': [(33,29,'ss')],
 'sleep_b': [(34,29,'ss')]
}
FULL_ROWS={
 'hit':{
  37:'................ommmmpwlkkmmmppmmnnmmo..........................',
  38:'.................ommmpwlkksppppmmmnnwoso........................',
  39:'..................ommmwssopppgymmwwlkso.........................',
  40:'...................ommpppppyyyymwwwkkkgo........................',
  41:'....................ompwskkyygmmpwossgyo........................',
  42:'....................obwwkkkgggmpwo..ogyrro......................'
 },
 'poison_a':{44:'...................oihhobbcssoyygco...ogyrro....................'},
 'poison_b':{45:'...................oihhobbccssoyygco..ogyrro....................'}
}

def main():
    frames={}
    for section in (ROOT/'authored-rows.txt').read_text().split('@')[1:]:
        lines=section.strip('\n').splitlines();name,start=lines[0].split()
        frames[name]=lines[1:]
    # Only explicit transparent right padding, no sprite transformations.
    for name,rows in FULL_ROWS.items():
        for y,row in rows.items():
            frames[name][y]=row
    for name,changes in PATCHES.items():
        for y,x,pixels in changes:
            row=frames[name][y]
            frames[name][y]=row[:x]+pixels+row[x+len(pixels):]
    (ROOT/'final-adjustments.json').write_text(json.dumps({'rows':FULL_ROWS,'clusters':PATCHES},indent=2)+'\n')
    (ROOT/'authored-rows.txt').write_text(''.join('@'+name+' 0\n'+'\n'.join(rows)+'\n' for name,rows in frames.items()))
if __name__=='__main__': main()
