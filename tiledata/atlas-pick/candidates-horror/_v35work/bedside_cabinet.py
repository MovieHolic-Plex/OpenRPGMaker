import sys; sys.path.insert(0,'_v35work')
from mk import *
W=32
def row(m,t,x0=7,w=18):
    assert len(t)==w
    return ('.'*x0+m*w+'.'*(W-x0-w), '.'*x0+t+'.'*(W-x0-w))
rows=[]
rows.append(row('s','1'*18))
rows.append(row('s','1'+'5'*16+'1'))
rows.append(row('s','1'+'5'*7+'66'+'5'*7+'1'))
rows.append(row('s','1'+'6'*16+'1'))
rows.append(row('s','0'*18))
for k in range(2):
    rows.append(row('s','1'+'4'*16+'0'))
    rows.append((('.'*7+'s'*(1+7)+'tt'+'s'*(7+1)+'.'*7),('.'*7+'1'+'4'*7+'22'+'4'*7+'0'+'.'*7)))
    rows.append(row('s','1'+'3'*16+'0'))
    rows.append(row('s','1'+'0'*16+'0'))
# 4 + 8 = 12 -> add base
def leg(t1,t2):
    m='.'*W; 
    t=['.']*W
    for x in (8,9,22,23): t[x]=t1 if x in (8,22) else t2
    return ''.join('t' if c!='.' else '.' for c in t),''.join(t)
rows.append(leg('1','0'))
rows.append(leg('1','0'))
rows.append(leg('0','0'))
assert len(rows)==16,len(rows)
write('bedside_cabinet',32,16,{'s':'sheet','t':'tin'},[a for a,b in rows],[b for a,b in rows],name='32x16 F12 T4')
