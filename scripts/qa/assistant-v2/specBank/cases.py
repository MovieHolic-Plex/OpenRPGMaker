"""남은 결함 사례 쪽: 은행 결과 폴더(main 으로 재생한 것)에서 entrance-off-art 출하 차단과 길 밖·폭 부족 출구를 판·맵·칸·검사 글·1배 자른 그림으로 낸다.
usage: cases.py <결과 폴더> <out.html> <라벨> [게임,게임…]"""
import base64, glob, html, io, json, os, re, sys
from PIL import Image, ImageDraw

res, out, label = sys.argv[1], sys.argv[2], sys.argv[3]
only = sys.argv[4].split(',') if len(sys.argv) > 4 else None
key = lambda name: re.sub(r'[^\w]+', '_', name, flags=re.U)

def picture(game, mapname):
    for f in glob.glob(os.path.join(res, game, 'maps', '*.png')):
        if re.sub(r'^\d+-', '', os.path.basename(f))[:-4] == key(mapname): return f
    return None

def crop(game, mapname, cells, marks):
    f = picture(game, mapname)
    if not f: return None
    im = Image.open(f).convert('RGB')
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    cx, cy = (min(xs) + max(xs)) // 2, (min(ys) + max(ys)) // 2
    x0 = max(0, min(im.width - 272, cx * 16 - 128)); y0 = max(0, min(im.height - 208, cy * 16 - 96))
    d = ImageDraw.Draw(im)
    for (x, y, w, h, color) in marks: d.rectangle([x * 16, y * 16, (x + w) * 16 - 1, (y + h) * 16 - 1], outline=color)
    part = im.crop((x0, y0, min(im.width, x0 + 272), min(im.height, y0 + 208)))
    buf = io.BytesIO(); part.save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

rows = []
for f in sorted(glob.glob(os.path.join(res, '*', 'metrics.json'))):
    m = json.load(open(f)); game = m['id']
    if only and game not in only: continue
    for line in m['lines'].get('shipBlockers', []):
        if not line.startswith('entrance-off-art'): continue
        ev = re.search(r'\[(\S+) (\S+) \((\d+),(\d+)\) door \((\d+),(\d+)\)\]', line)
        name = re.search(r'「([^」]+)」', line)
        if not ev or not name: rows.append((game, '?', '?', 'entrance-off-art', line, None)); continue
        x, y, dx, dy = map(int, ev.groups()[2:])
        img = crop(game, name.group(1), [(x, y), (dx, dy)], [(x, y, 1, 1, (255, 0, 0)), (dx, dy, 1, 1, (0, 255, 255))])
        rows.append((game, name.group(1), f'이벤트 ({x},{y}) · 그림 ({dx},{dy})', 'entrance-off-art', line.split(' — ', 1)[1].split(' [')[0] + f' (이벤트 {ev.group(2)})', img))
    ex = os.path.join(res, game, 'exits.json')
    roadless = {r['map'] for r in json.load(open(ex))['rows'] if r.get('roadless')} if os.path.exists(ex) else set()
    for line in m['lines'].get('exits', []):
        # "<맵> →<목적지> x,y×n [길아님] [폭부족] 도착 …" — 나가는 쪽 흠만(도착 쪽 낱말은 '도착' 뒤에 온다)
        mm = re.match(r'^(.*) →(.*?) (\d+),(\d+)×(\d+)(.*?) 도착 (.*)$', line)
        if not mm: continue
        mapname, dest, x, y, n, flaws, arrive = mm.groups(); x, y, n = int(x), int(y), int(n)
        bad = [w for w in ('길아님', '폭부족') if w in flaws]
        arr = [w for w in ('길아님', '가장자리줄', '방향없음') if w in arrive]
        if not bad and not arr: continue
        im = picture(game, mapname)
        vertical = False
        if im:
            w, h = Image.open(im).size; vertical = x in (0, w // 16 - 1)
        marks = [(x, y, 1, n, (255, 0, 0))] if vertical else [(x, y, n, 1, (255, 0, 0))]
        img = crop(game, mapname, [(x, y)], marks)
        what = ' · '.join((['나가는 칸: ' + '·'.join(bad)] if bad else []) + (['도착 칸(' + arrive.split(' ')[0] + ' — 「' + dest + '」 쪽): ' + '·'.join(arr)] if arr else []))
        rows.append((game, mapname, f'({x},{y}) 에서 {n}칸 → 「{dest}」', '출구(exitProbe)' + (' · 이 맵에는 길이 없다' if mapname in roadless else ''), what + ' — 원문: ' + line, img))

css = 'body{font:14px/1.55 system-ui,"Noto Sans KR",sans-serif;margin:0;background:#f6f5f1;color:#1c1b19}main{max-width:1180px;margin:0 auto;padding:24px 20px 60px}h1{font-size:22px;margin:0 0 6px}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #d9d6cc;padding:6px 8px;text-align:left;vertical-align:top;font-size:13px}th{background:#ebe8de}img{image-rendering:pixelated;width:544px;height:auto;display:block}.note{background:#fff8dc;border:1px solid #e3d48a;border-radius:6px;padding:8px 12px;margin:10px 0}'
body = ''.join(f'<tr><td>{html.escape(g)}</td><td>{html.escape(mp)}</td><td>{html.escape(cell)}</td><td>{html.escape(kind)}</td><td>{html.escape(what)}</td><td>{f"<img src={chr(34)}{img}{chr(34)} alt={chr(34)}{html.escape(g)} {html.escape(mp)}{chr(34)}>" if img else "(그림 없음)"}</td></tr>' for g, mp, cell, kind, what, img in rows)
open(out, 'w').write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>명세 은행 — 남은 사례</title><style>{css}</style></head><body><main><h1>명세 은행 — 남은 사례 ({html.escape(label)})</h1><div class="note">모델 없이 은행의 명세를 이 빌더로 다시 지은 게임에서 검사가 짚은 것이다. 그림은 맵 1배 그림을 자른 것(화면에는 2배로 보인다) — 빨간 테두리 = 이벤트·출구 칸, 하늘색 테두리 = 검사가 말한 입구 그림 칸, 파란 칸 = 맵 사이 이동 이벤트.</div><table><thead><tr><th>판</th><th>맵</th><th>칸</th><th>검사</th><th>검사가 하는 말</th><th>그림</th></tr></thead><tbody>{body}</tbody></table></main></body></html>')
print(len(rows), 'cases →', out)
for g, mp, cell, kind, what, img in rows: print(' ', g, '|', mp, '|', cell, '|', kind, '|', what[:150])
