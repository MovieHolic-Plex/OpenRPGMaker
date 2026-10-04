import sys; sys.path.insert(0,'_v35work')
from mk import *
W,H=16,32
rows=[]
def L(mm,tt,x0=3):
    w=len(mm); assert len(tt)==w
    rows.append(('.'*x0+mm+'.'*(W-x0-w),'.'*x0+tt+'.'*(W-x0-w)))
def plate(body_m,body_t): L('i'+body_m+'i','5'+body_t+'4')
L('i'*10,'1'*10)                       # 뒤 모서리
plate('i'*8,'6'*8)                      # 머리 받침 (tin)
plate('i'*8,'55555555')
plate('hhhhhhhh','55665555') if False else None
plate('ihhhhhhi','55665555')            # 머리 (천 아래 윤곽)
plate('hhhhhhhh','55666555')
plate('hhhhhhhh','55655555')
plate('hhhhhhhh','55555555')
plate('hhhhhhhh','55545555')
plate('hhhhhhhh','54555545')            # 어깨
plate('hhhaahhh','55510155')            # 가슴 얼룩
plate('hhaaaahh','55011055')
plate('hhhaahhh','55521555')
plate('hhhhhhhh','55555555')
plate('hhhhhhhh','54555555')
plate('hhhhhhhh','55555545')
plate('hhhhhhhh','55455555')
plate('hhihhihh','54545545')            # 발끝
plate('iiiiiiii','55555555')
plate('iiiiiiii','44444444')
L('i'*10,'5'+'6'*8+'5')                 # 앞 모서리 하이라이트
assert len(rows)==20,len(rows)
# F 12줄 — 가운데 받침 대신 다리 둘 + 가로대 (탁자로 읽히게)
L('i'*10,'4'*10)                        # 앞 옆 테두리
L('i'*10,'3'*10)
L('i'*10,'1'*10)                        # 상판 아래 그늘
for k in range(3): L('ii......ii','43......32',x0=3)
L('iiiiiiiiii','4333333332',x0=3)      # 가로대
for k in range(3): L('ii......ii','43......32',x0=3)
L('ii......ii','55......55',x0=3)       # 바퀴
L('ii......ii','11......11',x0=3)
assert len(rows)==32,len(rows)
write('operating_table',W,H,{'a':'blood','h':'sheet','i':'tin'},[a for a,b in rows],[b for a,b in rows],name='16x32 F12 T20')
