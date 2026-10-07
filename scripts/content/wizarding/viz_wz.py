"""사용자 확인 페이지 — 굽힌 wizarding_world(검수 통과분)를 공간별로 한 장에. ~/claude-viz/wizarding-world.html (자체완결, data URI)
  python3 scripts/content/wizarding/viz_wz.py
채택된 키트(원본 2배), 완성 예제, 인물·생물 걷기(GIF), 움직이는 칸(GIF), 거절된 조각과 이유를 보여 준다."""
import base64, html, io, json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import wzlib  # noqa: E402
import bake_lib as BL  # noqa: E402

ROOT = wzlib.ROOT
DATA = json.load(open(os.path.join(ROOT, 'src/assets/wizardingWorldTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/wizarding-world/wizarding-world-chipset.png')).convert('RGBA')
CHARS = json.load(open(os.path.join(ROOT, 'src/assets/wizardingCharsets.json'), encoding='utf-8'))
REP = json.load(open(os.path.join(wzlib.TD, 'bake-report.json'), encoding='utf-8'))
TPR = DATA['tilesPerRow']
STRIP = {s['baseTile']: s for s in DATA['animationStrips']}


def uri(im, z=2, fmt='PNG', frames=None, dur=150):
    b = io.BytesIO()
    if frames:
        fr = [f.resize((f.width * z, f.height * z), Image.NEAREST) for f in frames]
        bg = [Image.alpha_composite(Image.new('RGBA', f.size, (60, 58, 66, 255)), f).convert('P', palette=Image.ADAPTIVE) for f in fr]
        bg[0].save(b, 'GIF', save_all=True, append_images=bg[1:], duration=dur, loop=0, disposal=2)
        return 'data:image/gif;base64,' + base64.b64encode(b.getvalue()).decode()
    im.resize((im.width * z, im.height * z), Image.NEAREST).save(b, fmt)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def kit_frames(k):
    n = max([STRIP[t]['frames'] for r in k['rows'] for t in r['tiles'] + r['upperTiles'] if t in STRIP] + [1])
    out = []
    for f in range(n):
        k2 = dict(k, rows=[dict(tiles=[t + f if t in STRIP else t for t in r['tiles']], upperTiles=[t + f if t in STRIP else t for t in r['upperTiles']]) for r in k['rows']])
        out.append(BL.reassemble(k2, SHEET, TPR))
    return out


by_space = {s: [] for s in wzlib.SPACES}
for k in DATA['structureKits']:
    sp = next((s for s in wzlib.SPACES if wzlib.SPACES[s] in k['ai'].get('tags', [])), 'shared')
    by_space[sp].append(k)
parts = [f"<h1>마법 학교 · 해리포터풍 번들 <small>wizarding_world</small></h1><p class=sum>키트 {len(DATA['structureKits'])} · 오토타일 {len(DATA['autotileGroups'])} · 움직이는 칸 {len(DATA['animationStrips'])} · 칸 {DATA['count']} · 인물·생물 {len(CHARS['characters'])} · 검수 거절 {len(REP['rejected'])}</p>",
         '<nav>' + ' '.join(f'<a href="#{s}">{wzlib.SPACES[s]} ({len(v)})</a>' for s, v in by_space.items() if v) + ' <a href="#chars">인물·생물</a> <a href="#ex">완성 예제</a> <a href="#rej">거절</a></nav>']
for s, kits in by_space.items():
    if not kits: continue
    parts.append(f'<h2 id="{s}">{wzlib.SPACES[s]} <small>{len(kits)}종</small></h2><div class=grid>')
    for k in kits:
        fr = kit_frames(k)
        src = uri(None, frames=fr) if len(fr) > 1 else uri(fr[0])
        parts.append(f'<figure><img src="{src}"><figcaption><b>{html.escape(k["name"])}</b><br><code>{k["id"]}</code> {k["width"]}×{k["height"]}</figcaption></figure>')
    parts.append('</div>')
for a in DATA['autotileGroups']:
    pass
parts.append('<h2 id="chars">인물·생물 걷기</h2><div class=grid>')
for c in CHARS['characters']:
    sh = Image.open(os.path.join(ROOT, f"public/assets/generated/charsets/Wizarding{c['sheet']}.png")).convert('RGBA')
    ox, oy = (c['index'] % 4) * 72, (c['index'] // 4) * 128
    frames = []
    for row in (2, 3, 0, 1):
        for f in (0, 1, 2, 1):
            frames.append(sh.crop((ox + f * 24, oy + row * 32, ox + f * 24 + 24, oy + row * 32 + 32)))
    parts.append(f'<figure><img src="{uri(None, z=3, frames=frames, dur=180)}"><figcaption><b>{html.escape(c["name"])}</b><br>{html.escape(c["spaceName"])}</figcaption></figure>')
parts.append('</div><h2 id="ex">완성 맵 — 조수 빌더 build_wizarding_space 결과 <small>걸을 수 있는 칸 한 덩이·문 닿음 검사 통과</small></h2>')
spdir = os.path.join(wzlib.TD, 'spaces')
for f in sorted(os.listdir(spdir)) if os.path.isdir(spdir) else []:
    if f.endswith('.png'):
        sp = json.load(open(os.path.join(spdir, f[:-4] + '.json'), encoding='utf-8'))
        parts.append(f'<figure class=ex><img src="{uri(Image.open(os.path.join(spdir, f)).convert("RGBA"))}"><figcaption><b>{html.escape(sp["name"])}</b> {sp["w"]}×{sp["h"]} · <code>{sp["space"]}{"/" + sp["variant"] if sp.get("variant") else ""}</code> · 가구 {len(sp["placed"])}</figcaption></figure>')
parts.append(f'<h2 id="rej">검수 거절·미검수 ({len(REP["rejected"])})</h2><table><tr><th>모듈</th><th>id</th><th>이유</th><th>검수자 메모</th></tr>' +
             ''.join(f'<tr><td>{r["module"]}</td><td><code>{r["id"]}</code></td><td>{html.escape(r["why"])}</td><td>{html.escape(r["reason"])}</td></tr>' for r in REP['rejected']) + '</table>')
css = ('body{background:#24232a;color:#ddd;font:14px sans-serif;margin:20px}h2{border-bottom:1px solid #555;margin-top:36px}small{color:#999;font-weight:normal}'
       '.grid{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}figure{margin:0;background:#3c3a42;padding:8px;border-radius:4px}figure img{image-rendering:pixelated;display:block}'
       'figcaption{font-size:11px;max-width:260px;margin-top:4px}code{color:#9cc}nav a{color:#9cf;margin-right:10px}.ex img{max-width:100%}table{border-collapse:collapse;font-size:12px}td,th{border:1px solid #555;padding:3px 6px}')
out = os.path.expanduser('~/claude-viz/wizarding-world.html')
open(out, 'w', encoding='utf-8').write(f'<!doctype html><meta charset=utf-8><title>마법 학교 번들</title><style>{css}</style>' + ''.join(parts))
print(out, os.path.getsize(out))
