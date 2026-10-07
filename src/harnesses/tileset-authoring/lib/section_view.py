"""시트의 절(section)을 확대해 PNG 로 — 감독·작업자 눈 검사용. 사용: section_view.py <run 폴더> <out.png> <절 제목 일부>... [--scale 4]"""
import json, sys
from pathlib import Path
from PIL import Image
args = sys.argv[1:]
sc = 4
if "--scale" in args:
    i = args.index("--scale"); sc = int(args[i + 1]); del args[i:i + 2]
run, out, keys = Path(args[0]), args[1], args[2:]
t = json.loads((run / "tiles.json").read_text())
sheet = Image.open(run / "candidate.png").convert("RGBA")
cols = t["cols"]; T = 16
parts = []
for title, a, b in t["sections"]:
    if keys and not any(k in title for k in keys):
        continue
    r0, r1 = a // cols, (b + cols - 1) // cols
    parts.append(sheet.crop((0, r0 * T, cols * T, r1 * T)))
H = sum(p.height for p in parts) + 4 * len(parts)
im = Image.new("RGBA", (cols * T, H), (40, 40, 48, 255))
y = 0
for p in parts:
    bg = Image.new("RGBA", p.size, (200, 200, 210, 255)); bg.alpha_composite(p); im.paste(bg, (0, y)); y += p.height + 4
im.resize((im.width * sc, im.height * sc), 0).save(out)
print(out, im.size)
