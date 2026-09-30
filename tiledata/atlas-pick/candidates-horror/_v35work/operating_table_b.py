import sys; sys.path.insert(0,'_v35work')
from mk import *
from pic import conv
W,H=32,16
LEG={**{c:('i',int(c)) for c in '0123456'},'v':('h',2),'w':('h',3),'x':('h',4),'y':('h',5),'z':('h',6),'r':('a',2),'s':('a',3),'t':('a',4)}
P=[
'.5'+'6'*28+'4.',                                                    # 뒤 테두리 (밝은 윗면 가장자리)
'5543'+'zzzzzz3zzzzyyyyyy3yyyyyy'+'4432',                             # 시트 + 결박띠 둘
'5543'+'yyyyyy3ytsrrstxxx3xxxxxx'+'4432',                             # 시트 + 얼룩
'.'+'6'*30+'.',                                                      # 앞 테두리
]
def blank(): return ['.']*W
def setc(r,x,c): r[x]=c
F=[]
for y in range(12): F.append(blank())
def hrun(r,x0,x1,c):
    for x in range(x0,x1+1): r[x]=c
# 앞면 F : 옆 판 3줄 (y4..6)
hrun(F[0],0,31,'4'); F[0][0]='5'; F[0][31]='3'
hrun(F[1],0,31,'3'); F[1][0]='4'; F[1][31]='2'
hrun(F[2],0,31,'1'); F[2][0]='2'
# 다리 (x3-4, x27-28), 가로대 y7(F[7]) , 바퀴
for y in range(3,11):
    for x,c in ((3,'4'),(4,'2'),(27,'4'),(28,'2')): F[y][x]=c
hrun(F[8],5,26,'3'); hrun(F[9],5,26,'1')
for x,c in ((2,'2'),(3,'3'),(4,'1'),(5,'0'),(26,'2'),(27,'3'),(28,'1'),(29,'0')): F[11][x]=c
for x,c in ((3,'2'),(4,'0'),(27,'2'),(28,'0')): F[10][x]=c
# 피: 앞 판에서 흘러내림
for x,y,c in ((14,0,'s'),(15,0,'r'),(15,1,'s'),(15,2,'r'),(15,3,'s'),(15,4,'r'),(15,5,'s'),(15,6,'r'),(15,7,'t')): F[y][x]=c
for x,c in zip(range(12,19),'..rsrr.'): 
    if c!='.': F[11][x]=c
P+=[''.join(r) for r in F]
assert len(P)==H and all(len(r)==W for r in P),[len(r) for r in P]
M,T=conv(P,LEG)
S=['.'*W for _ in range(H)]
S[15]='....~~~~~~~~~~~~~~~~~~~~~~~~....'
S[15]=''.join(('.' if M[15][x]!='.' else S[15][x]) for x in range(W))
write('operating_table',W,H,{'a':'blood','h':'sheet','i':'tin'},M,T,shadow=S,name='32x16 F12 T4',tag='v35-B')
