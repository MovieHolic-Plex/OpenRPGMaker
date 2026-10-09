#!/usr/bin/env python3
"""w61: display apple/bread — 몸통 = display potion w7-B 의 나무 진열 상자(행 9~14 + 오른쪽 그림자), 물건 = 각 v5.pxg 의 사과/빵 화소(옛 상자 테두리·줄무늬 제외)를 한 줄 내려 상자 윗면에 앉힘."""
import os,re,sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))+"/.."
ROOT=os.path.normpath(ROOT)
ITEM={"display_apple":set("ABDEHI"),"display_bread":set("ACF")}
SHIFT=int(sys.argv[1]) if len(sys.argv)>1 else 1
def v5rows(slug):
    L=open(f"{ROOT}/{slug}/v5.pxg").read().split("\n"); i=L.index("@block 0 0") if "@block 0 0" in L else [k for k,l in enumerate(L) if l.startswith("@block")][0]
    return L[i+1:i+17]
ref=open(f"{ROOT}/display_potion/w7-B.pxg").read().split("\n")
def sec(name):
    i=ref.index(name); return ref[i+1:i+17]
mb=sec("@mblock 0 0"); tb=sec("@tblock 0 0"); sh=sec("@block 0 0")
for slug,keep in ITEM.items():
    v=v5rows(slug); items=[list(r) for r in sh]
    for r in range(16):
        for x in range(16):
            ch=v[r][x]
            if ch in keep and r<9:
                assert r+SHIFT<=8,(slug,r,x)
                items[r+SHIFT][x]=ch
    m=[list(r) for r in mb]
    for r in range(16):
        for x in range(16):
            if items[r][x] not in ".-~": m[r][x]='.'
    # 몸통 칸은 상자 뒤쪽을 이미 비운 병 자리 — 병 화소가 있던 mblock 은 쓰지 않는다
    for r in range(0,9):
        m[r]=list('.'*16)
    hdr=["// w61 w61-A — w7-B 나무 진열 상자 몸통 + 이 기물 v5 물건 (work/w61-display.py)","@size 16 16","@cell 16","@palette palette.pal","@mat a wood","@block 0 0"]
    out=hdr+["".join(r) for r in items]+["@mblock 0 0"]+["".join(r) for r in m]+["@tblock 0 0"]+["".join(("." if m[r][x]=='.' else tb[r][x]) for x in range(16)) for r in range(16)]
    open(f"{ROOT}/{slug}/w61-A.pxg","w").write("\n".join(out)+"\n"); print(slug,"ok")
