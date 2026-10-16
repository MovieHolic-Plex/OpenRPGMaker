#!/usr/bin/env python3
"""전투 화면 before/after 나란히 시트 (자체완결 HTML). scripts/qa/runtime/monster-design-battle.capture.mjs 의 산출(<dir>/before, <dir>/after)을 읽는다.

  python3 battle_sheet.py <captureDir> <out.html>

각 쌍마다: 원본 해상도(960x720) 전체 화면 before/after + 몬스터 상자 크롭(2배).
"""
import base64, io, json, sys
from pathlib import Path
from PIL import Image

root, out = Path(sys.argv[1]), sys.argv[2]


def uri(im, fmt="PNG"):
    b = io.BytesIO(); im.save(b, fmt)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(b.getvalue()).decode()


def load(kind):
    rep = json.loads((root / kind / "report.json").read_text())
    return {s["file"]: s for s in rep["shots"]}


before, after = load("before"), load("after")
rows = []
for f in before:
    if f not in after: continue
    b_img = Image.open(root / "before" / f).convert("RGB"); a_img = Image.open(root / "after" / f).convert("RGB")
    crops = []
    for kind, img, shot in (("before", b_img, before[f]), ("after", a_img, after[f])):
        for box in shot["boxes"]:
            x, y, w, h = [int(round(v)) for v in (box["x"], box["y"], box["w"], box["h"])]
            c = img.crop((max(0, x), max(0, y), min(960, x + w), min(720, y + h))).resize((w * 2, h * 2), Image.NEAREST)
            crops.append((kind, box["species"], box["side"], c))
    cells = "".join(f'<figure><img src="{uri(c)}"><figcaption>{kind} · {sp} {side}</figcaption></figure>' for kind, sp, side, c in crops)
    rows.append(f'<section><h2>{f[:-4].replace("-vs-", " (내 몬스터, 뒷모습) vs ")} (상대, 앞모습)</h2><div class="crops">{cells}</div>'
                f'<div class="full"><figure><img src="{uri(b_img)}"><figcaption>before 원본 960x720</figcaption></figure>'
                f'<figure><img src="{uri(a_img)}"><figcaption>after 원본 960x720</figcaption></figure></div></section>')
css = """body{margin:0;background:#14161c;color:#e4e7ee;font:14px/1.5 system-ui,'Noto Sans KR',sans-serif;padding:16px 20px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:26px 0 6px}
p{color:#9aa3b5;max-width:1000px}img{image-rendering:pixelated;display:block}figure{margin:0}figcaption{color:#9aa3b5;font-size:12px;margin:2px 0 8px}
.crops{display:flex;flex-wrap:wrap;gap:10px}.crops img{background:#d6e4cd}.full{display:flex;gap:12px;flex-wrap:nowrap;overflow-x:auto}.full img{width:960px;height:720px}"""
html = f"""<!doctype html><meta charset="utf-8"><title>몬스터 디자인 전투 before/after</title><style>{css}</style>
<h1>전투 화면 before / after (출하 플레이어, 포켓몬 전투 스킨, 960x720)</h1>
<p>before = origin/main 의 112 캔버스 그림, after = 디자인 v2 + 64 캔버스 격자. 15종이 한 번씩 내 몬스터(뒷모습)와 상대(앞모습)로 나온다.
크롭은 몬스터 상자(256px)를 2배로 키운 것. 전투 표시 128 논리 = 64 캔버스 정확히 2배(after), 112 캔버스는 1.14배(before).</p>{''.join(rows)}"""
Path(out).write_text(html)
print("wrote", out, len(rows), "rows", Path(out).stat().st_size // 1024, "KB")
