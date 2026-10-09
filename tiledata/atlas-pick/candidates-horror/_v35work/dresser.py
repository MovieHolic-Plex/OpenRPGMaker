import sys; sys.path.insert(0,'_v35work')
from mk import *
rows=[]
def R(m,t): rows.append((m,t))
A='a'*16
R('.'+'a'*14+'.','.'+'1'*14+'.')
R(A,'0555555555555520')
R(A,'0555555555555520')
R(A,'0666666666666660')
R(A,'0000000000000000')
for k in range(3):
    R(A,'0'+'5'+'4'*12+'2'+'0')
    R(A,'0'+'5'+'3'*12+'2'+'0')
    R('aaaaaabbbbaaaaaa','0'+'4'+'3333'+'5555'+'3333'+'2'+'0')
    R(A,'0000000000000000')
R(A,'0322222222222220')
for k in range(2): R('.aa..........aa.','.34..........32.')
R('.aa..........aa.','.00..........00.')
assert len(rows)==21,len(rows)
pad=[('.'*16,'.'*16)]*11
allr=pad+rows
write('dresser',16,32,{'a':'mahog','b':'tarn'},[a for a,b in allr],[b for a,b in allr],name='16x32 F16 T5')
