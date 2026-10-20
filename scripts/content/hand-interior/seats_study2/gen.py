# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys, os, re, subprocess, shutil, json
W='/home/main/z-project/rpg-zzu-interior-seats-34'
CAND=W+'/tiledata/hand-interior/pick/candidates'
sys.path.insert(0,W+'/scripts/content/interior-plus'); import iplib
R=iplib.RAMPS
def hx(c): return '#%02x%02x%02x'%c
LET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
def build(slug, rows, keymap, note, name='w135-A'):
    """rows: 16 strings; keymap: char -> (ramp,tone); '.' transparent."""
    assert all(len(r)==16 for r in rows), [ (i,len(r)) for i,r in enumerate(rows) if len(r)!=16]
    used=sorted({ch for r in rows for ch in r if ch!='.'})
    m={}; pal=['// '+slug+' '+name+' palette (ramp colours only)','~ #1c1418 110','- #1c1418 58','# #e040c0','']
    for i,ch in enumerate(used):
        L=LET[i]; rp,t=keymap[ch]; m[ch]=L; pal.append(f'{L} {hx(R[rp][t])}   // = {rp}:{t}')
    d=CAND+'/'+slug
    open(f'{d}/{name}.pal','w').write('\n'.join(pal)+'\n')
    g=[f'// {name}: 2026-10-20 seats study2 (atlas worker)','@size 16 16','@cell 16',f'@palette {name}.pal','@block 0 0']+[''.join(m.get(ch,'.') for ch in r) for r in rows]
    open(f'{d}/{name}.pxg','w').write('\n'.join(g)+'\n')
    open(f'{d}/{name}.note','w').write(note+'\n')
    r=subprocess.run(['python3','scripts/content/hand-interior-pick/check_candidate.py',f'{d}/{name}.pxg'],cwd=W,capture_output=True,text=True)
    print(r.stdout.strip()[-600:], r.stderr.strip()[-300:])
    return f'{d}/{name}.png'
WOOD={str(i):('wood',i) for i in range(9)}
