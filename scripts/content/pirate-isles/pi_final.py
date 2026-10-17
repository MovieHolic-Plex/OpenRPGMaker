"""최종 검수 페이지 ~/claude-viz/pirate-isles.html — 적대 검수 전/후 장면(결함 상자)·실내 예제·조수 실행 결과·조각 시트.
    python3 pi_final.py [--qa /tmp/pi-qa] [--assist /tmp/ai-pirate/assist.json]
assist.json: [{"prompt":..,"model":..,"score":..,"note":..,"png":path}, ...]  (없으면 그 절을 건너뛴다)
"""
import argparse, html, json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pi_page as PG

ap = argparse.ArgumentParser(); ap.add_argument('--qa', default='/tmp/pi-qa'); ap.add_argument('--assist', default='/tmp/ai-pirate/assist.json'); a = ap.parse_args()
SCENES = [('harbor-3', '해적 항구 마을'), ('beach-5', '열대 섬 해변 마을'), ('fort-2', '해안 요새'), ('wreck-4', '난파선·보물 동굴 섬'), ('ship-2', '배 안')]
defects = json.load(open(os.path.join(a.qa, 'defects-status.json'), encoding='utf-8'))
esc = html.escape
parts = []
n_fix = sum(1 for d in defects if d['status'] == 'fixed'); n_part = sum(1 for d in defects if d['status'] == 'partial'); n_no = len(defects) - n_fix - n_part
parts.append(f"<h1>pirate_isles — 열대 군도·해적 항구 칩셋</h1><p class=note>16px 코드 손 도트 · 3/4 탑뷰 · 계열 oprn-pirate. "
             f"그림은 모두 원본 해상도(1칸 16px)를 2배로 보여 준다(화소 그대로). 적대 검수 결함 {len(defects)}건 → 고침 {n_fix} · 일부 {n_part} · 못 고침 {n_no} (한 바퀴만).</p>")
COL = dict(fixed='#4caf50', partial='#e0a030', **{'not fixed': '#e04040'})


def boxed(path, items):
    im = Image.open(path).convert('RGBA'); d = ImageDraw.Draw(im)
    for k, x in items:
        b = x['box']; x0, y0, x1, y1 = b[0] * 16, b[1] * 16, (b[2] + 1) * 16 - 1, (b[3] + 1) * 16 - 1
        d.rectangle([x0, y0, x1, y1], outline=COL[x['status']], width=2)
        d.rectangle([x0, y0, x0 + 14, y0 + 9], fill=(0, 0, 0, 200)); d.text((x0 + 1, y0 - 1), str(k), fill=(255, 255, 255, 255))
    return im


parts.append("<h2>적대 검수 한 바퀴 — 전(결함 상자) / 후</h2><p class=note>상자 색: 초록 고침 · 주황 일부 · 빨강 못 고침. 번호는 아래 표의 번호. 같은 씨앗으로 다시 그린 그림이 오른쪽.</p>")
for sid, ko in SCENES:
    items = [(i, x) for i, x in enumerate(defects) if x['scene'] == sid]
    before = boxed(os.path.join(a.qa, sid + '.png'), items)
    after = Image.open(os.path.join(a.qa, 'after', sid + '.png')).convert('RGBA')
    parts.append(f"<h3>{esc(ko)} ({sid}) — 결함 {len(items)}</h3><div class=row><figure><img src='{PG.uri(before)}' style='width:{before.width * 2}px'><figcaption>전</figcaption></figure>"
                 f"<figure><img src='{PG.uri(after)}' style='width:{after.width * 2}px'><figcaption>후</figcaption></figure></div>")
    rows = ''.join(f"<tr><td>{i}</td><td>{esc(x['severity'])}</td><td>{x['box']}</td><td>{esc(x.get('defect') or x.get('what', ''))}</td><td>{esc(x['cause'])}</td><td style='color:{COL[x['status']]}'>{x['status']}</td></tr>" for i, x in items)
    parts.append(f"<table><tr><th>#</th><th>심각</th><th>상자(칸)</th><th>결함</th><th>원인</th><th>상태</th></tr>{rows}</table>")

parts.append("<h2>실내 예제(같은 구성기)</h2>")
for sid, ko in (('tavern-1', '해적 술집 안'), ('cave-1', '보물 동굴 안'), ('hut-1', '섬 오두막 안')):
    p = os.path.join(a.qa, 'after', sid + '.png')
    if os.path.exists(p):
        im = Image.open(p).convert('RGBA'); parts.append(f"<h3>{esc(ko)}</h3><img src='{PG.uri(im)}' style='width:{im.width * 2}px'>")

if os.path.exists(a.assist):
    runs = json.load(open(a.assist, encoding='utf-8'))
    parts.append("<h2>실제 조수 실행(입력창 경로)</h2><p class=note>깨끗한 기본 프로젝트에서 실제 편집기 입력창으로 보낸 결과 맵을 원본 해상도로 그렸다. 점수는 정직한 0~10.</p>")
    for r in runs:
        parts.append(f"<h3>「{esc(r['prompt'])}」 — {esc(r['model'])} · {esc(str(r['score']))}/10</h3><p class=note>{esc(r['note'])}</p>")
        for p in r.get('pngs', []):
            if os.path.exists(p):
                im = Image.open(p).convert('RGBA'); w = im.width * (2 if im.width < 1000 else 1)
                parts.append(f"<div class=scene><img src='{PG.uri(im)}' style='width:{w}px'></div><p class=note>{esc(os.path.basename(p))}</p>")

body = '\n'.join(parts)
tmp = PG.page('pirate-isles', 'pirate_isles 최종', note='')            # 조각 시트 절만 빌려 쓴다
sheets = open(tmp, encoding='utf-8').read().split('</p>', 1)[1]
css = ("body{background:#1c1d22;color:#ddd;font-family:sans-serif;margin:20px}h1{font-size:22px}h2{font-size:18px;margin-top:34px}h3{font-size:15px;margin-top:22px}"
       ".note{color:#aaa;font-size:13px;max-width:1200px}img{image-rendering:pixelated;display:block}.row{display:flex;gap:16px;overflow:auto}figure{margin:0}"
       "figcaption{font-size:12px;color:#aaa}table{border-collapse:collapse;font-size:12px;margin:8px 0;max-width:1400px}td,th{border:1px solid #444;padding:3px 6px;vertical-align:top}.scene{overflow:auto}")
out = os.path.expanduser('~/claude-viz/pirate-isles.html')
open(out, 'w', encoding='utf-8').write(f"<!doctype html><meta charset=utf-8><title>pirate_isles</title><style>{css}</style>{body}<h2>조각 시트(관문 상태)</h2>{sheets}")
print(out, os.path.getsize(out))
