#!/usr/bin/env python3
"""w61: 선반 16종 — 몸통 = shelf:coins w10-C 의 선반판(밝은 윗턱 wood7 / 앞면 wood4 / 밑면 wood2 / 오른쪽 마구리 wood3 / 양끝 턱 / wood1 못),
담긴 물건 = 각 형제 v5.pxg 의 화소 그대로. 윗칸은 판이 한 줄 위(행 5~7)로 올라가므로 물건도 한 줄 올린다. 아랫칸 판은 행 13~15 그대로."""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # candidates/
SLUGS = ["shelf_potion_potionb_potiong","shelf_herb","shelf_vial_flask","shelf_jar_jarb_jarg","shelf_mushroom","shelf_flower",
 "shelf_book_bookb_bookg","shelf_scroll","shelf_gem_gemr","shelf_yarn_yarnb_yarny","shelf_bolt_boltg_boltr","shelf_bottle_bottler_bottley",
 "shelf_candle","shelf_ingot_ingotg","shelf_toy","shelf_skull_crystal"]
def load(slug):
    rows=[];inb=False
    for ln in open(f"{ROOT}/{slug}/v5.pxg"):
        ln=ln.rstrip("\n")
        if ln.startswith("@block"): inb=True; continue
        if inb and ln and not ln.startswith(("@","//")): rows.append(ln)
    assert len(rows)==16 and all(len(r)==16 for r in rows),slug
    pal={}
    for ln in open(f"{ROOT}/{slug}/palette.pal"):
        m=re.match(r"^(\S) (#[0-9a-fA-F]{6})\s",ln)
        if m: pal[m.group(1)]=m.group(2).lower()
    return rows,pal
WOOD={'#000000','#411e05','#63310b','#6d3b15','#9a5435','#9e684b','#b77246','#d59147','#ffebd7'}
def groups(block,cols=range(16)):
    """block: {(r,x):ch}. 빈 열로 갈라진 덩이들."""
    xs=sorted({x for (_,x) in block}); gs=[]
    for x in xs:
        if gs and x==gs[-1][-1]+1: gs[-1].append(x)
        else: gs.append([x])
    return gs
def compress(block,xs,hi,notes,tag):
    """덩이(열 xs)의 행 범위를 한 줄 줄인다: 같은 행이 겹치는 곳을 지우고 윗부분을 내린다. 없으면 끝에서 둘째 행을 지운다."""
    rows=sorted({r for (r,x) in block if x in xs}); lo=rows[0]
    row=lambda r:"".join(block.get((r,x),'.') for x in xs)
    dup=[r for r in rows[1:-1] if row(r)==row(r+1)]
    cut=dup[-1] if dup else rows[-2]
    notes.append(f"{tag} x{xs[0]}-{xs[-1]}: 행{cut} 한 줄 줄임({'겹친 줄' if dup else '끝에서 둘째'})")
    nb={}
    for (r,x),ch in block.items():
        if x not in xs: nb[(r,x)]=ch; continue
        if r==cut: continue
        nb[(r+1 if r<cut else r,x)]=ch
    return nb
def build(slug):
    v,pal=load(slug); notes=[]
    plankc={v[6][5],v[7][5],v[8][1],v[13][5],v[14][5],v[15][5]}
    up={};lo={}
    for r in range(0,6):
        for x in range(16):
            if v[r][x]!='.': up[(r,x)]=v[r][x]
    for r in range(7,13):
        for x in range(16):
            ch=v[r][x]
            if ch=='.' or (ch in plankc and r==8 and x in (1,14)): continue
            if r==9 and x in (2,13) and pal.get(ch) in WOOD: notes.append(f"못 화소({x},9) {ch} 는 판 못으로 대체"); continue
            lo[(r,x)]=ch
    for (r,x),ch in list(lo.items()):
        if r==8 and ch in plankc: del lo[(r,x)]; notes.append(f"r8 x{x} {ch}=옛 판 앞면 버림")
    # 윗칸: 판이 한 줄 올라가므로 물건 한 줄 올림. 맨 윗줄이 0이면 한 줄 줄임
    for xs in groups(up):
        if min(r for (r,x) in up if x in xs)==0: up=compress(up,xs,5,notes,"윗칸")
    up={(r-1,x):ch for (r,x),ch in up.items()}
    for xs in groups(lo):
        if min(r for (r,x) in lo if x in xs)<8: lo=compress(lo,xs,12,notes,"아랫칸")
    assert all(0<=r<=4 for (r,x) in up),(slug,up)
    assert all(8<=r<=12 for (r,x) in lo),(slug,lo)
    items=[['.']*16 for _ in range(16)]
    for d in (up,lo):
        for (r,x),ch in d.items(): items[r][x]=ch
    return items,notes
def emit(slug,items):
    m=[['.']*16 for _ in range(16)]
    for top in (5,13):
        for x in range(1,14): m[top][x]='T'; m[top+1][x]='X'
        m[top][14]='Y'; m[top+1][14]='Y'
        for x in range(1,15): m[top+2][x]='Z'
        m[top-1][1]='V'; m[top-1][14]='Y'
    for x in (2,13): m[8][x]='W'
    for r in range(16):
        for x in range(16):
            if items[r][x]!='.': m[r][x]='.'
    L=["// w61 w61-A  — w10-C 선반판 + 이 기물의 v5 물건 (work/w61-shelf.py)","@size 16 16","@cell 16","@palette palette.pal",
       "@mat T wood 7","@mat V wood 5","@mat W wood 1","@mat X wood 4","@mat Y wood 3","@mat Z wood 2","@block 0 0"]
    L+=["".join(r) for r in items]
    L+=["@mblock 0 0"]+["".join(r) for r in m]
    return "\n".join(L)+"\n"
if __name__=="__main__":
    for s in SLUGS:
        items,notes=build(s)
        open(f"{ROOT}/{s}/w61-A.pxg","w").write(emit(s,items))
        open(f"{ROOT}/{s}/w61-A.notes.tmp","w").write("\n".join(notes))
        print(s,notes)
