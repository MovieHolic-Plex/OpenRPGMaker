import sys
from PIL import Image
H='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/'
# usage: hf5_sheet.py out.png slug:X ...   (ctx 이미지를 세로로 쌓는다, 절반 폭으로 자르기 없음)
out=sys.argv[1]; ims=[Image.open(f'{H}{a.split(":")[0]}/hf5-{a.split(":")[1]}.ctx.png').convert('RGB') for a in sys.argv[2:]]
W=max(i.width for i in ims); Ht=sum(i.height+8 for i in ims)
s=Image.new('RGB',(W,Ht),(80,0,80)); y=0
for i in ims: s.paste(i,(0,y)); y+=i.height+8
s.save(out); print(s.size)
