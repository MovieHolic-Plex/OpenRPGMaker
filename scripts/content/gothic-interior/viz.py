"""gate 상태가 붙은 시트 -> ~/claude-viz/gothic-interior.html (현재 그림 화소 해시의 영수증만 본다)."""
import json, base64, glob, os, sys
from PIL import Image
sys.path.insert(0, 'src/harnesses/_core')
from object_gate import pixel_sha256
rec = {}
for f in glob.glob('harness-data/object-gate/receipts/*/*.json'):
    r = json.load(open(f)); rec.setdefault(r['pixelSha256'], []).append(r)
def verdict(p):
    im = Image.open(p).convert('RGBA')
    rs = rec.get(pixel_sha256(im)) or []
    return rs[-1]['verdict'] if rs else 'none'
def uri(p): return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
D = 'tiledata/gothic-interior'; rows = [json.loads(l) for l in open(f'{D}/batch.jsonl')]
cards = ''; npass = 0
for r in rows:
    v = verdict(r['png']); npass += v == 'pass'; n = r['label'].split('/')[1]; w, h = Image.open(r['png']).size; sc = max(2, min(8, 192 // max(w, h)))
    cards += f'<div class=c><img style="width:{w*sc}px;image-rendering:pixelated" src="{uri(r["png"])}"><b>{n}</b><i>{r["kind"]}</i><span class={v}>{v.upper()}</span></div>'
anim = ''
for n in ('candelabra', 'wall_sconce', 'night_window', 'fog'):
    p = f'{D}/pieces/anim/{n}_strip.png'; w, h = Image.open(p).size
    fv = [verdict(f'{D}/pieces/anim/{n}_f{i}.png') for i in range(3)]
    anim += f'<div class=c><img style="width:{w*4}px;image-rendering:pixelated" src="{uri(p)}"><b>{n} strip</b><i>frames {fv}</i></div>'
open(os.path.expanduser('~/claude-viz/gothic-interior.html'), 'w').write(f'''<!doctype html><meta charset=utf-8><title>gothic_manor interior</title><style>body{{background:#2a2c36;color:#ddd;font:13px sans-serif;margin:14px}}.c{{display:inline-flex;flex-direction:column;align-items:center;gap:3px;margin:6px;padding:8px;background:#3a3d4b;border-radius:6px;vertical-align:bottom}}i{{color:#99a}}.pass{{color:#6c6;font-weight:bold}}.fail,.none{{color:#f66}}</style>
<h2>gothic_manor 실내 기물 {npass}/{len(rows)} PASS (object-gate, gemini x4 다수결)</h2>{cards}<h2>애니메이션 스트립(프레임별 판정)</h2>{anim}
<p>탈락: rope_post(4판 미통과), chandelier 흔들림·불꽃 프레임(f1·f2 4판 미통과) — 정적 샹들리에만 통과.</p>''')
print(npass, len(rows))
