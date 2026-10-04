"""j5 손그림 도우미: 격자에 사각형·점·글자 비트맵을 손으로 얹고 .pic → .pxg 변환·검사까지. 색은 (램프, 단) 짝. 보간·노이즈 없음."""
import subprocess, os, sys
ROOT='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick'
WORK=ROOT+'/tiledata/atlas-pick/candidates-jp/ac_unit/work'
POOL='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
T='0123456789abcde'
class C:
    def __init__(s,w,h): s.w=w; s.h=h; s.g=[[None]*w for _ in range(h)]
    def put(s,x,y,c):
        if 0<=x<s.w and 0<=y<s.h: s.g[y][x]=c
    def rect(s,x,y,w,h,c):
        for j in range(y,y+h):
            for i in range(x,x+w): s.put(i,j,c)
    def hl(s,x,y,n,c): s.rect(x,y,n,1,c)
    def vl(s,x,y,n,c): s.rect(x,y,1,n,c)
    def blit(s,x,y,rows,leg):
        for j,r in enumerate(rows):
            for i,ch in enumerate(r):
                if ch in '. ': continue
                s.put(x+i,y+j,leg[ch])
    def erase(s,x,y,w,h): s.rect(x,y,w,h,None)
    def save(s,slug,X):
        used={}; rows=[]
        for r in s.g:
            line=''
            for c in r:
                if c is None: line+='.'
                elif isinstance(c,str): line+=c
                else:
                    if c not in used: used[c]=POOL[len(used)]
                    line+=used[c]
            rows.append(line)
        p=f'{ROOT}/tiledata/atlas-pick/candidates-jp/{slug}'
        os.makedirs(p+'/work',exist_ok=True)
        with open(f'{p}/work/j5-{X}.pic','w') as f:
            f.write(f'size {s.w} {s.h}\n')
            for c,ch in used.items(): f.write(f'L {ch} {c[0]} {T[c[1]]}\n')
            f.write('---\n'+'\n'.join(rows)+'\n')
        subprocess.check_call(['python3',WORK+'/j5-pic2pxg.py',f'{p}/work/j5-{X}.pic',f'{p}/j5-{X}.pxg'])
        return p
def finish(c,slug,X,note):
    p=c.save(slug,X)
    open(f'{p}/j5-{X}.note','w').write(note+'\n')
    r=subprocess.run(['python3',ROOT+'/scripts/content/atlas-pick/check_candidate.py',f'{p}/j5-{X}.pxg'],capture_output=True,text=True,cwd=ROOT)
    print((r.stdout+r.stderr).strip().splitlines()[0:6])
def sheet(slug,z=8):
    subprocess.check_call(['python3',WORK+'/j5-sheet.py',slug,str(z)],cwd=ROOT)
