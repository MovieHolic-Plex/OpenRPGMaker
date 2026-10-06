"""Explicit, frame-specific cluster corrections after viewing native PNGs.
Run once against the original manuscript. No inferred/propagated repairs.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
# (row, column, literal replacement); coordinates are independently chosen.
EDITS={
'idle_a': [(36,40,'kkywy'),(37,40,'osgo.'),(38,40,'ogo.')],
'idle_b': [(35,40,'kkywy'),(36,41,'sgo..'),(37,40,'ogo.')],
'idle_c': [(36,40,'kkyyw'),(37,40,'osgo.'),(38,40,'ogo.')],
'windup': [(34,35,'gygm'),(35,35,'lkkm'),(36,34,'lkks')],
'move': [(35,39,'kkgyrwy'),(36,39,'osgywo'),(37,39,'ogyo.')],
'attack': [(34,43,'kkgywy'),(35,43,'osgywo'),(36,43,'ogyo.')],
'recover': [(36,40,'kksgo'),(37,40,'ksgyo'),(38,39,'ogyrr')],
'hit': [(37,40,'kkgo'),(38,40,'ssgyo'),(39,40,'gyo')],
'dead': [(54,45,'kgygo'),(55,44,'sogyrro')],
'skill_a': [(35,40,'kkyyww'),(36,41,'sgo..'),(37,40,'ogo.')],
'skill_b': [(33,39,'kkgyrwy'),(34,39,'osgywo'),(35,39,'ogyo.')],
'skill_c': [(36,40,'kksgo'),(37,40,'ksgyo'),(38,39,'ogyr')],
'poison_a': [(29,32,'lkso'),(30,31,'llkso'),(31,31,'lkso'),
             (32,31,'kkso'),(33,29,'wwkso'),(34,27,'nwwso'),
             (35,26,'nnmpm'),(36,27,'mppw'),
             (42,39,'kkgo'),(43,39,'ssgyo'),(44,39,'gyo')],
'poison_b': [(38,26,'nmpp'),(39,26,'mppw'),(40,26,'mpww'),
             (41,26,'mpwwl'),(42,26,'mwlkks'),(43,27,'wlkkso'),
             (44,28,'ssog'),(43,39,'kkgo'),(44,39,'ssgyo'),(45,39,'gyo')],
'stun_a': [(28,19,'oihhskkllllkkkkkso'),(29,19,'oihhhsskkllllkkkso'),
           (30,19,'oihhhhskkllkkkkso'),(31,19,'oihhhhhsskkkkkso'),
           (32,19,'oihhhhhhossskkso'),(33,19,'oihhhhhosskkso'),
           (34,19,'oihhhomwsskkkmo'),
           (40,23,'nnpp'),(41,23,'nnmpp'),(42,23,'mnmpp'),
           (43,23,'mnwwp'),(44,23,'mwwlko'),(45,23,'mwlkkso'),
           (46,23,'bwskkso'),(47,23,'bcosso'),
           (45,38,'kgo'),(46,37,'sgyo'),(47,36,'ogyro')],
'stun_b': [(28,19,'oihhskkllllkkkkkso'),(29,19,'oihhhsskkllllkkkso'),
           (30,19,'oihhhhskkllkkkkso'),(31,19,'oihhhhhsskkkkkkso'),
           (32,19,'oihhhhhhossskkkso'),(33,19,'oihhhhhosskkkso'),
           (34,19,'oihhhomwsskkkmo'),
           (40,23,'nnpp'),(41,23,'nnmpp'),(42,23,'mnmpp'),
           (43,23,'mnmpp'),(44,23,'mnwwp'),(45,23,'mwwlko'),
           (46,23,'bwlkkso'),(47,23,'bcskso'),(48,25,'osso'),
           (45,38,'kgo'),(46,37,'sgyo'),(47,36,'ogyro')],
'sleep_a': [(48,40,'ksgo'),(49,40,'ssyro')],
'sleep_b': [(43,34,'mpo..'),(44,35,'mpmmo'),(45,36,'mnmmmo'),
            (47,40,'ksgo'),(48,40,'ssyro')]
}

def main():
    sections={}
    for section in (ROOT/'authored-rows.txt').read_text().split('@')[1:]:
        lines=section.strip('\n').splitlines(); name,start=lines[0].split()
        canvas=['.'*64 for _ in range(64)]
        for y,row in enumerate(lines[1:],int(start)):
            canvas[y]=row.ljust(64,'.')
        sections[name]=canvas
    for name,changes in EDITS.items():
        for y,x,pixels in changes:
            row=sections[name][y]
            sections[name][y]=row[:x]+pixels+row[x+len(pixels):]
    (ROOT/'cluster-edits.json').write_text(json.dumps(EDITS,indent=2)+'\n')
    (ROOT/'authored-rows.txt').write_text(''.join('@'+name+' 0\n'+'\n'.join(rows)+'\n' for name,rows in sections.items()))
if __name__=='__main__': main()
