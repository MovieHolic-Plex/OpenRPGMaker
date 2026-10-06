"""Explicit native cluster edits chosen after viewing PNGs. Never fills/repairs automatically.
Coordinates are zero based; dots in chosen strings explicitly erase old pixels.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
EDITS={
'idle_a':[
(1,25,'.K..............'),
(1,26,'.KMK............'),
(1,27,'.KLMBK..........'),
(1,28,'.KLLLMBK........'),
(1,29,'.KMLHLLMBK......'),
(1,30,'.KMLLLMMMBBK....'),
(1,31,'..KMLLMMBBBSSK..'),
(1,32,'..KMLMMBBBSSSK..'),
(1,33,'...KMMBBBSSSSK..'),
(1,34,'....KBBSSSSSK'),
],
'idle_b':[
# Full chosen lower rows maintain baseline y60 without frame translation.
(0,30,'.....KMLLLMMMBBK..KKKKKKKKKKKKKKKMLLMMBBBRRRCWrK'),
(0,31,'....KMLLMMBBBSSKKMLLLLLLMMMMMMMMMLLLMMBBBRROCCrK'),
(0,32,'....KMLMMBBBSSSKMLLHLLLMMMMMMMMMLLLMMBBRRROCCCrK'),
(0,33,'.....KMMBBBSSSKMLLLLMMMMBBBBBMMMLLMMBBRRROCCRrK'),
(0,34,'.....KBBSSSSSKMLLMMMMBBBBBBBBBMMLMMBBRRRCCCRrK'),
(0,35,'......KSSSSSKMLMMMBBBBBBBBBBBBBMMBBRRRRCCRrrK'),
(0,36,'......KBSSSKMLMMBBBBBBBMMMMBBBBMBBRRRCCCRrSK'),
(0,37,'......KBSSKMLMMBBBBBBBMLLMMBBBBBBRRRCCCRrSSK'),
(0,38,'.......KSSKMLMBBBBBBBMLLMMBBBBBBBRRCCCRrSSSK'),
(0,39,'.......KSSKMMBBBBBBBMLMMBBBBBBBBSRRCRrSSSSK'),
(0,40,'........KSKMBBBBBBBMMLMBBBBBBBBSSRRrSSSSSK'),
(0,41,'.........KKBBBBBBBMMLMBBBBBBBSSSSrSSSSSSK'),
(0,42,'..........KBBBBBBMMLMBBBBBBSSSSSSSSSSSSK'),
(0,43,'..........KBBBBBMMLMBBBBBSSSSSSSSSSSSSK'),
(0,44,'...........KBBBBMLMBBSSSSSSSSSSSSBBBSSK'),
(0,45,'............KBBMLMBBSSSSSKKKKSSSBBBBSSK'),
(0,46,'............KBBMLBBSSSKSSK..KSSSBBBBSSK'),
(0,47,'.............KBMLBBSSKSSSK..KSSSBBMBSSK'),
(0,48,'.............KBMBBSSK.KSSK..KSSSBMMBSSK'),
(0,49,'..............KBMBSK..KSSBK..KSSBBMBSSK'),
(0,50,'..............KBMBSK...KSSBK.KSSBKKBBSK'),
(0,51,'.............KBBMBSK...KSSBK.KSSK..KBMSK'),
(0,52,'.............KBBMBSK....KSBK.KSSK..KBMSK'),
(0,53,'............KBBMBSK.....KSBKKSSK..KBMSK'),
(0,54,'............KBBMBSK.....KSBKKSSK..KBMSK'),
(0,55,'............KBBMBSK.....KSBKKSSK..KBMSK'),
(0,56,'...........KBBMBSK......KSBKKSSK..KBMSK'),
(0,57,'...........KBMMBSK.....KSSBBKSSK..KBMMSK'),
(0,58,'..........KBLMMBSKK....KSSBWKSSK..KBLMBSKK'),
(0,59,'.........KBLHMMBSSWK....KKKKSSWWK.KBLHMBSWWK'),
(0,60,'.........KBLHMMBSSWK....KKKKSSWWK.KBLHMBSWWK'),
# Independently chosen leaning plume.
(1,24,'..K............'),
(1,25,'..KMK..........'),
(1,26,'..KLMK.........'),
(1,27,'.KLLMBK........'),
(1,28,'.KMLHLLBK......'),
(1,29,'.KMLLLMMBBK....'),
],
'idle_c':[
(1,27,'.K..............'),
(1,28,'.KMK............'),
(1,29,'.KLMBK..........'),
(1,30,'.KLLLMBK........'),
(1,31,'.KMLHLLMBK......'),
(1,32,'.KMLLLMMMBBK....'),
(1,33,'..KMLLMMBBBSSK..'),
(1,34,'..KMLMMBBBSSSK'),
(1,35,'...KMMBBBSSSK'),
(1,36,'....KBBSSSSK'),
],
'windup':[
(23,47,'KSSK'),(24,48,'KSSBK'),(25,49,'KSSBK'),(26,50,'KSSBK'),
(26,51,'KSSBK'),(25,52,'KSSBK'),(24,53,'KSSBK'),(23,54,'KSSBK'),
(22,55,'KSSBK'),(21,56,'KSSBK'),(20,57,'KSSBKK'),
(19,58,'KSSBBBWK'),(20,59,'KKKKKKK'),
(38,48,'KSSK'),(39,49,'KSSBK'),(40,50,'KSSBK'),(41,51,'KSSBK'),
(41,52,'KSSBK'),(40,53,'KSSBK'),(39,54,'KSSBK'),(38,55,'KSSBK'),
(37,56,'KSSBK'),(36,57,'KSSBKK'),(35,58,'KSSBBBWK'),(36,59,'KKKKKKK'),
],
'move':[
(21,44,'SSBK'),(21,45,'KSSBK'),(22,46,'KSSBK'),(23,47,'KSSBK'),
(24,48,'KSSBK'),(24,49,'KSSBK'),(23,50,'KSSBK'),(22,51,'KSSBKK'),
(21,52,'KSSBBBWK'),(22,53,'KKKKKK'),
(40,46,'KSBK'),(41,47,'KSBBK'),(42,48,'KSSBBK'),(43,49,'KSSBMMBK'),
(43,50,'KSSBLMBWK'),(44,51,'KKKKKKKK'),
# Broad wind-stretched tail has two native fur points.
(1,31,'..KKKKKKKKKKKKK'),(1,32,'.KMLHLLLLLLMMMM'),
(1,33,'KMLLLLMMMMMMMBB'),(1,34,'KMLLMMMBBBBBBBB'),
(1,35,'.KMMMMBBBBBBSSB'),(1,36,'..KBBBBBBSSSSSB'),
(1,37,'...KSSSSSSSSSK'),(1,38,'....KKSSSSSK'),
],
'attack':[
(21,44,'SSBK'),(21,45,'KSSBK'),(22,46,'KSSBK'),(23,47,'KSSBK'),
(24,48,'KSSBK'),(24,49,'KSSBK'),(23,50,'KSSBK'),(22,51,'KSSBKK'),
(21,52,'KSSBBBWK'),(22,53,'KKKKKK'),
],
'hit':[
# Far planted foreleg has an independent root beneath the chest, behind raised limb.
(27,46,'SSBK'),(27,47,'SSBK'),(28,48,'SSBK'),(28,49,'SSBK'),
(29,50,'SSBK'),(29,51,'SSBK'),(30,52,'SSBK'),(30,53,'SSBK'),
(30,54,'SSBK'),(31,55,'SSBK'),
],
'dead':[
# Second folded ear and cheek plane. Ear root meets skull at y44.
(31,39,'KK'),(31,40,'KMBK'),(32,41,'KMRK'),(33,42,'KBRK'),
(34,43,'BRrK'),(34,44,'MRrK'),
],
'sleep_a':[
# Far ear rests behind the nearer ear; remains attached to the cheek.
(34,34,'KK'),(34,35,'KMBK'),(35,36,'KMRK'),(36,37,'KBRK'),
(36,38,'MRrK'),
],
'sleep_b':[
(34,34,'KK'),(34,35,'KMBK'),(35,36,'KMRK'),(36,37,'KBRK'),
(36,38,'MRrK'),
],
}
# Final directly chosen planted rows; identical contact coordinates across idle frames.
EDITS['idle_b'].extend([
(0,45,'...........KBBBBMLMBBSSSSSSSSSSSSBBBSSK'),
(0,46,'............KBBMLMBBSSSSSKKKKSSSBBBBSSK'),
(0,47,'............KBBMLBBSSSKSSK..KSSSBBBBSSK'),
(0,48,'.............KBMLBBSSKSSSK..KSSSBBMBSSK'),
(0,49,'.............KBMBBSSK.KSSK..KSSSBMMBSSK'),
(0,50,'..............KBMBSK..KSSBK..KSSBBMBSSK'),
(0,51,'..............KBMBSK...KSSBK.KSSBKKBBSK'),
(0,52,'.............KBBMBSK...KSSBK.KSSK..KBMSK'),
(0,53,'.............KBBMBSK....KSBK.KSSK..KBMSK'),
(0,54,'............KBBMBSK.....KSBKKSSK..KBMSK'),
(0,55,'............KBBMBSK.....KSBKKSSK..KBMSK'),
(0,56,'............KBBMBSK.....KSBKKSSK..KBMSK'),
(0,57,'...........KBBMBSK......KSBKKSSK..KBMSK'),
(0,58,'...........KBMMBSK.....KSSBBKSSK..KBMMSK'),
(0,59,'..........KBLMMBSKK....KSSBWKSSK..KBLMBSKK'),
(0,60,'.........KBLHMMBSSWK....KKKKSSWWK.KBLHMBSWWK'),
])
TAIL_EDITS={
'windup':[
(1,25,'.K..............'),(1,26,'.KMK............'),
(1,27,'.KLMBK..........'),(1,28,'.KLLLMBK........'),
(1,29,'.KMLHLLMBK......'),(1,30,'.KMLLLMMMBBK....'),
(1,31,'..KMLLMMBBBSSK..'),(1,32,'..KMLMMBBBSSSK..'),
(1,33,'...KMMBBBSSSSK..'),(1,34,'....KBBSSSSSK'),
],
'recover':[
(1,27,'.K..............'),(1,28,'.KMK............'),
(1,29,'.KLMBK..........'),(1,30,'.KLLLMBK........'),
(1,31,'.KMLHLLMBK......'),(1,32,'.KMLLLMMMBBK....'),
(1,33,'..KMLLMMBBBSSK..'),(1,34,'..KMLMMBBBSSSK..'),
(1,35,'...KMMBBBSSSSK..'),(1,36,'....KBBSSSSSK'),
],
'hit':[
(1,26,'.K..............'),(1,27,'.KMK............'),
(1,28,'.KLMBK..........'),(1,29,'.KLLLMBK........'),
(1,30,'.KMLHLLMBK......'),(1,31,'.KMLLLMMMBBK....'),
(1,32,'..KMLLMMBBBSSK..'),(1,33,'..KMLMMBBBSSSK..'),
(1,34,'...KMMBBBSSSSK..'),(1,35,'....KBBSSSSSK'),
],
'skill_a':[
(1,25,'.K..............'),(1,26,'.KMK............'),
(1,27,'.KLMBK..........'),(1,28,'.KLLLMBK........'),
(1,29,'.KMLHLLMBK......'),(1,30,'.KMLLLMMMBBK....'),
(1,31,'..KMLLMMBBBSSK..'),(1,32,'..KMLMMBBBSSSK..'),
(1,33,'...KMMBBBSSSSK..'),(1,34,'....KBBSSSSSK'),
],
'skill_b':[
(1,25,'.K..............'),(1,26,'.KMK............'),
(1,27,'.KLMBK..........'),(1,28,'.KLLLMBK........'),
(1,29,'.KMLHLLMBK......'),(1,30,'.KMLLLMMMBBK....'),
(1,31,'..KMLLMMBBBSSK..'),(1,32,'..KMLMMBBBSSSK..'),
(1,33,'...KMMBBBSSSSK..'),(1,34,'....KBBSSSSSK'),
],
'skill_c':[
(1,27,'.K..............'),(1,28,'.KMK............'),
(1,29,'.KLMBK..........'),(1,30,'.KLLLMBK........'),
(1,31,'.KMLHLLMBK......'),(1,32,'.KMLLLMMMBBK....'),
(1,33,'..KMLLMMBBBSSK..'),(1,34,'..KMLMMBBBSSSK..'),
(1,35,'...KMMBBBSSSSK..'),(1,36,'....KBBSSSSSK'),
],
'poison_a':[
(1,31,'.K..............'),(1,32,'.KMK............'),
(1,33,'.KLMBK..........'),(1,34,'.KLLLMBK........'),
(1,35,'.KMLHLLMBK......'),(1,36,'.KMLLLMMMBBK....'),
(1,37,'..KMLLMMBBBSSK..'),(1,38,'..KMLMMBBBSSSK..'),
(1,39,'...KMMBBBSSSSK..'),(1,40,'....KBBSSSSSK'),
],
'poison_b':[
(1,32,'.K..............'),(1,33,'.KMK............'),
(1,34,'.KLMBK..........'),(1,35,'.KLLLMBK........'),
(1,36,'.KMLHLLMBK......'),(1,37,'.KMLLLMMMBBK....'),
(1,38,'..KMLLMMBBBSSK..'),(1,39,'..KMLMMBBBSSSK..'),
(1,40,'...KMMBBBSSSSK..'),(1,41,'....KBBSSSSSK'),
],
'stun_a':[
(1,30,'.K..............'),(1,31,'.KMK............'),
(1,32,'.KLMBK..........'),(1,33,'.KLLLMBK........'),
(1,34,'.KMLHLLMBK......'),(1,35,'.KMLLLMMMBBK....'),
(1,36,'..KMLLMMBBBSSK..'),(1,37,'..KMLMMBBBSSSK..'),
(1,38,'...KMMBBBSSSSK..'),(1,39,'....KBBSSSSSK'),
],
'stun_b':[
(1,30,'.K..............'),(1,31,'.KMK............'),
(1,32,'.KLMBK..........'),(1,33,'.KLLLMBK........'),
(1,34,'.KMLHLLMBK......'),(1,35,'.KMLLLMMMBBK....'),
(1,36,'..KMLLMMBBBSSK..'),(1,37,'..KMLMMBBBSSSK..'),
(1,38,'...KMMBBBSSSSK..'),(1,39,'....KBBSSSSSK'),
],
}
for frame,chosen in TAIL_EDITS.items():
    EDITS.setdefault(frame,[]).extend(chosen)

# Keep sleeping muzzle/closed eyelid/paws still; inhale is in upper back/ribs.
SLEEP_B_RIGHT={
34:'BBBBBBKKBKK',35:'BBBBBBKMBKBK....K',36:'BBBBBBBKMRKBK..KMK',
37:'BBBBBBBBKBRKKKMLRK',38:'BBBBBBBBMRrKBMLrK',39:'BBBBBBBMLLLMBMRrK',
40:'BBBBBBMLLHLLMBBRrK',41:'BBBBBBMLLLMMMBBBSK',42:'BBBBBMMLMMBKKKBBSK',
43:'BBBBBBMMBBMBKBBBSSK',44:'SBBBBMMBBBBBBMMMBBKKKK',45:'SSBBMMBBBBBBMLLLMMBSSK',
46:'SBBMMBBBBBRrMMMLMMBSSK',47:'BBMMBBBBRRRCrKKKKKKKKK',48:'BMMBBBBRRRCCCrK',
49:'MMBBBBRRROCCCrK',50:'MBBBBBRRRCCCRrK',51:'BBBBBBRRCCrrSK',52:'BBBBMRRrrSSSK',
53:'BBMMBBBBSSSSK',54:'BMMBBBSSSSSK',55:'MMBBBSSSSSK',56:'MBBBSSSSSK',
57:'BBBSSSSKK',58:'BSSSSKSSKKKKK',59:'SSSSSBBMLMBSWK',60:'KKKKKKKKKKKKKK',
}
EDITS['sleep_b'].extend((28,y,chosen.ljust(36,'.')) for y,chosen in SLEEP_B_RIGHT.items())

def apply():
    for name,patches in EDITS.items():
        path=ROOT/('poses' if (ROOT/'poses'/(name+'.pxgrid')).exists() else 'actions')/(name+'.pxgrid')
        a=[list(row) for row in path.read_text().splitlines()]
        for x,y,text in patches:
            if x==0: a[y]=list(text.ljust(64,'.'))
            else: a[y][x:x+len(text)]=text
        path.write_text('\n'.join(''.join(row) for row in a)+'\n')
if __name__=='__main__':apply()
