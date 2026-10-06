"""Expand explicitly authored horizontal ASCII pixel runs; no geometry or pose transforms."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
PALETTE={'O':'#10212C','s':'#174642','t':'#267066','j':'#3E9D87','l':'#70C1A1','h':'#B5DEC0','b':'#192D50','c':'#2E5278','d':'#518CA2','g':'#79582C','k':'#BC8C3E','v':'#E8C56B','w':'#FFF1BA','n':'#202D3B','r':'#576675','e':'#FFAF51','p':'#785483','q':'#C39EB7'}
def main():
    frame=None
    grids={}
    lines=(ROOT/'authored-rows.txt').read_text().splitlines()
    repair=ROOT/'repairs.txt'
    if repair.exists(): lines+=['# REPAIRS']+repair.read_text().splitlines()
    repairing=False
    for line in lines:
        if line=='# REPAIRS': repairing=True
        line=line.strip()
        if not line or line.startswith('#'): continue
        if line.startswith('@'):
            frame=line[1:]
            if frame in grids and not repairing: raise ValueError('duplicate frame')
            if not repairing: grids[frame]=[['.']*128 for _ in range(128)]
            elif frame not in grids: raise ValueError('unknown repair frame')
            continue
        y,x,run=line.split()
        y,x=int(y),int(x)
        if not 0<=y<128 or not 0<=x or x+len(run)>128: raise ValueError((frame,y,x,len(run)))
        if set(run)-set(PALETTE)-{'.'}: raise ValueError((frame,y,set(run)-set(PALETTE)-{'.'}))
        grids[frame][y][x:x+len(run)]=run
    (ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    poses={'idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'}
    for name,grid in grids.items():
        out=ROOT/('poses' if name in poses else 'actions')
        out.mkdir(exist_ok=True)
        (out/(name+'.pxgrid')).write_text('\n'.join(''.join(row) for row in grid)+'\n')
    print('Expanded literal rows:', ', '.join(grids))
if __name__=='__main__': main()
