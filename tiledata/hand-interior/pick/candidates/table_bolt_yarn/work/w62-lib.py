import re,os,sys
C=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
def pal(slug):
    m={}
    for l in open(f'{C}/{slug}/palette.pal'):
        mm=re.match(r'\s*(\S)\s+#([0-9a-fA-F]{6,8})\s*//\s*=\s*(\w+):(\d)',l)
        if mm: m[mm.group(1)]=(mm.group(3),int(mm.group(4)))
    return m
def grid(slug,fn='v5.pxg'):
    rows=[];on=False
    for l in open(f'{C}/{slug}/{fn}'):
        l=l.rstrip('\n')
        if l.startswith('@block'): on=True;continue
        if l.startswith('@') or l.startswith('//'): 
            if on and l.startswith('@'): break
            continue
        if on and l: rows.append(l)
    return rows
