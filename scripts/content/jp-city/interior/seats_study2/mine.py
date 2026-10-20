# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
"""my batch: jp chair-type seats and stools from draw2 templates."""
import sys, json
sys.path.insert(0,'/tmp/seats34/study2')
from draw2 import T, mat, img
X={
'officeE':["................","...OOOO.........","...OEcO.........","...OecO.........","...OecO.........","...OecO.........","...OCnO.........","...OnnOOOOOO....","...OnnEEEEEeO...","...OnnEEEEEeO...","...OCneeeeecO...","...OOCCCCCCCO...","......OMtO......","......OMtO......","..OMMMMMtTTTTO..","..OO...OO...OO.."],
'officeW':["................",".........OOOO...",".........OEcO...",".........OecO...",".........OecO...",".........OecO...",".........OEnO...","....OOOOOOEnO...","...OEEEEEeEnO...","...OEEEEEeEnO...","...OeeeeecEnO...","...OCCCCCCCOO...","......OMtO......","......OMtO......","..OMMMMMtTTTTO..","..OO...OO...OO.."],
'pstool':["................","................","................","................","................","................",".....OOOOOO.....","....OEEEEEeO....","...OEEEEEEEeO...","...OeeeeeeecO...","....OCCCCCCO....",".....OOOOOO.....","......OMtO......","....OOOMtOOO....","....OMMMtTTO....","....OOOOOOOO...."],
'bstool':["................","................","................","................","................","................","................","................","................",".....OOOOOO.....","....OEEEEEeO....","...OEEEEEEEeO...","...OccccccccO...","...OCOOOOOOCO...","...OcO....OCO...","...OOO....OOO..."],
}
T.update(X)
for k,v in X.items(): assert len(v)==16 and all(len(r)==16 for r in v),k
T.update({
'plastS':["................","................","....OOOOOOOO....","...OEEEEEEEeO...","...OeeeeeeecO...","...OccccccccO...","...OccccccccO...","...OCCCCCCCCO...","....OCCCCCCO....","...OCCCCCCCCO...","...OEEEEEEEeO...","...OeeeeeeecO...","...OCCCCCCCCO...","...OlO....OdO...","...OlO....OdO...","...OOO....OOO..."],
'plastN':["................","................","................","....OOOOOOOO....","...OEEEEEEEeO...","...OccccccccO...","...OCcccccCCO...","...OCcccccCCO...","...OCCCCCCCCO...","...OeCCCCCCcO...","...OCCCCCCCCO...","...OlO....OdO...","...OlO....OdO...","...OlO....OdO...","...OOO....OOO...","................"],
'plastE':["................","................","...OOOO.........","...OEeO.........","...OecO.........","...OecO.........","...OecO.........","...OcCO.........","...OcCO.........","...OcCEEEEEeO...","...OcCeeeeecO...","...OCCCCCCCCO...","...OlO....OdO...","...OlO....OdO...","...OlO....OdO...","...OOO....OOO..."],
'plastW':["................","................",".........OOOO...",".........OEeO...",".........OecO...",".........OecO...",".........OecO...",".........OcCO...",".........OcCO...","...OEEEEEecCO...","...OeeeeeccCO...","...OCCCCCCCCO...","...OlO....OdO...","...OlO....OdO...","...OlO....OdO...","...OOO....OOO..."],
})
T.update({'officeE': ['................', '...OOOO.........', '...OEcO.........', '...OecO.........', '...OecO.........', '...OecO.........', '...OCnO.........', '...OnnOOOOOO....', '...OnEEEEEEeO...', '...OnEEEEEEeO...', '...OnCCCCCCCO...', '...OOOOMtOOOO...', '......OMtO......', '..OOOOOMtOOOOO..', '..OMMMMMtTTTTO..', '..OO...OO...OO..'], 'officeW': ['................', '.........OOOO...', '.........OEcO...', '.........OecO...', '.........OecO...', '.........OecO...', '.........OEnO...', '....OOOOOOEnO...', '...OEEEEEEeEO...', '...OEEEEEEeEO...', '...OCCCCCCCEO...', '...OOOOMtOOOO...', '......OMtO......', '..OOOOOMtOOOOO..', '..OMMMMMtTTTTO..', '..OO...OO...OO..'], 'pstoolT': ['................', '................', '.....OOOOOO.....', '....OEEEEEeO....', '...OEEEEEEEeO...', '...OeeeeeeecO...', '....OCCCCCCO....', '.....OOOOOO.....', '......OMtO......', '......OMtO......', '....OOOMtOOO....', '....OMMMtTTO....', '....OOOMtOOO....', '......OMtO......', '..OOOOOMtOOOOO..', '..OMMMMMtTTTTO..'], 'wstoolT': ['................', '................', '.....OOOOOO.....', '....OEEEEEeO....', '...OEEEEEEEeO...', '...OeeeeeeecO...', '....OCCCCCCO....', '...OlO....OdO...', '...OlO....OdO...', '...OlO....OdO...', '...OlOmmmmOdO...', '...OlOOOOOOdO...', '..OlO......OdO..', '..OlO......OdO..', '..OlO......OdO..', '..OOO......OOO..'], 'plastS': ['................', '................', '....OOOOOOOO....', '...OEEEEEEEeO...', '...OeeeeeeecO...', '...OccccccccO...', '....OOOOOOOO....', '....Ol....dO....', '....Ol....dO....', '...OOOOOOOOOO...', '...OEEEEEEEeO...', '...OeeeeeeecO...', '...OCCCCCCCCO...', '...OlOOOOOOdO...', '...OlO....OdO...', '...OOO....OOO...'], 'plastN': ['................', '................', '................', '................', '....OOOOOOOO....', '...OEEEEEEEeO...', '...OCCCCCCCnO...', '...OCCCCCCCnO...', '....OOOOOOOO....', '....Ol....dO....', '...OleeeeeedO...', '...OCCCCCCCCO...', '...OlOOOOOOdO...', '...OlO....OdO...', '...OlO....OdO...', '...OOO....OOO...']})
exec(open('/tmp/seats34/study2/r8.py').read()); T.update(R8)
B=[('fd-chair-s','chairS',mat('ita','aka'),32),('fd-chair-n','chairN',mat('ita','aka'),32),('fd-chair-e','chairE',mat('ita','aka'),32),('fd-chair-w','chairW',mat('ita','aka'),32),
('chair-dining-s','chairS',mat('ki'),32),('chair-dining-n','chairN',mat('ki'),32),('chair-dining-e','chairE',mat('ki'),32),('chair-dining-w','chairW',mat('ki'),32),
('desk-chair-s','chairS',mat('ita','yuka'),16),('desk-chair-n','chairN',mat('ita','yuka'),16),('desk-chair-e','chairE',mat('ita','yuka'),16),('desk-chair-w','chairW',mat('ita','yuka'),16),
('gy-kid-chair-s','plastS',mat('tekko','kii'),32),('gy-kid-chair-n','plastN',mat('tekko','kii'),16),('gy-kid-chair-e','plastE',mat('tekko','kii'),32),('gy-kid-chair-w','plastW',mat('tekko','kii'),32),
('sc-chair-s','chairS',mat('yuka','kinari'),16),('sc-music-chair-n','chairN',mat('yuka','kinari'),16),('as-music-chair-n','chairN',mat('soil','hodo'),16),
('sc-staff-chair-s','officeS',mat('kon'),16),('sc-staff-chair-n','officeN',mat('kon'),16),
('of-desk-chair-s','officeS',mat('kon'),32),('of-desk-chair-n','officeN',mat('kon'),32),('of-desk-chair-e','officeE',mat('kon'),32),('of-desk-chair-w','officeW',mat('kon'),32),
('pb-office-chair-s','officeS',mat('kon'),32),('pb-office-chair-n','officeN',mat('kon'),32),
('am-arcade-stool','pstool',mat('aka'),16),('am-pachinko-stool','pstool',mat('kon'),16),('fd-stool','pstool',mat('aka','aka'),16),('hs-exam-stool','pstoolT',mat('kon'),32),
('of-stool','pstool',mat('midori'),16),('ox-bar-stool','pstoolT',mat('kon','kon'),16),
('fr-counter-stool','stool',mat('soil'),16),('sc-lab-stool','wstoolT',mat('yuka'),16),('bath-stool','bstool',mat('sora'),16)]
O='/tmp/seats34/study2/out/batch/'
for pid,t,M,h in B: img(T[t],M,h).save(O+pid+'.png')
json.dump([b[0] for b in B],open('/tmp/seats34/study2/mine.json','w'))
print(len(B))
