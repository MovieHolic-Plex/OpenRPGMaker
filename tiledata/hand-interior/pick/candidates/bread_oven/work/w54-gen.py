import re
v5=[l.rstrip('\n') for l in open('v5.pxg')]
i=v5.index('@block 0 0')
V=v5[i+1:i+33]
L={}
for r in range(0,5):L[r]="."*16
L[4]="...........AAAAA"
L[5]=".........AAKDDDD"
L[6]=".......AKDDDDBEE"
L[7]="......ADDDDDBEEE"
L[8]=".....AKDDDDDDDDD"
L[9]="....ADDDDDDBBBBB"
L[10]="...ADDDDDBBCCDCC"
L[11]="..ADDDDDBCCBCCCC"
L[12]=".ADDDDDBCCBBBBBB"
L[13]="ADDDDDBCCBBDKDDD"
L[14]="ADDDDBCCBBDCCCCC"
L[15]="ADDDDBCCCBDCmmmm"
L[16]="ADDDBCCCBDCmmmmm"
L[17]="ADDDBCCBDCmmmmmm"
for r in range(18,27):
    ring3 = 'BB' if r in (20,23) else 'DD'
    ring2 = 'BB' if r in (19,22,25) else 'CC'
    rim = 'BB' if r in (21,24) else 'DC'
    L[r]="A"+ring3+"B"+ring2+"B"+rim+"mmmmmmm"
    if r in (20,23): L[r]="A"+ring3+"B"+ring2+"B"+rim+"mmmmmmm"
L[27]="ADDBCRRRRRRRRRRR"
L[28]="ADDBCRRRRRRRRRRR"
L[29]="ACDBCRRRRRRRRRRR"
L[30]="ATTTTSSSSSSSSSSS"
L[31]="A"*16
mp={'D':'C','C':'T','K':'D','B':'B'}
out=[]
for r in range(32):
    l=L[r]; assert len(l)==16,(r,len(l))
    rt=''.join(mp.get(c,c) for c in l[::-1])
    row=list(l+rt)
    # right-hand ring fixes: nothing
    for c in range(32):
        if row[c]=='m': row[c]=V[r][c]
    out.append(''.join(row))
import sys
hdr=['// w54-A bread oven 3/4: 동심 아치 줄·윗면 렌즈+연기 구멍·두꺼운 화구 테·돌 받침단. 불 자리 v5 그대로','@size 32 32','@cell 16','@palette palette.pal','@block 0 0']
open(sys.argv[1],'w').write('\n'.join(hdr+out)+'\n')
