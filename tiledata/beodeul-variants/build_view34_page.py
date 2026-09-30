"""3/4 재작업 전후 페이지: python3 build_view34_page.py -> ~/claude-viz/beodeul-var-N.html (자체완결 data URI).
전(=재작업 커밋의 부모)·후 렌더를 git 에서 꺼내 2x 로 나란히 놓는다."""
import base64, io, os, subprocess, glob, html
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = {'names': {'coast-cliff-road': '해안 절벽길', 'deep-forest-path': '깊은 숲길', 'mountain-pass': '산 고개', 'wheat-roman-road': '밀밭 로마 대로'},
 'places': [{'chk': '3 → 0',
             'crops': [('절벽과 길', (0, 300, 1000, 900)), ('서쪽 2단 절벽', (0, 500, 700, 1400))],
             'eye_before': 3,
             'left': '절벽 위 돌무더기 무리가 조금 반복적',
             'name': '해안 절벽길',
             'parts': ['driftwood', 'heath_c', 'rowboat', 'haystack', 'shrine', 'wayside_cross', 'trough'],
             'slug': 'coast-cliff-road',
             'what': '직선 판자띠 길을 굽이 연석 돌길로, 앞면 한 줄 절벽을 2단(앞면 3줄)+계단+선반으로, 절벽 위 같은 덤불 반복을 섞어 심기로.'},
            {'chk': '5 → 0',
             'crops': [('여관 앞 대로', (0, 400, 1400, 1040)), ('동쪽 갈림길', (1400, 400, 2816, 1040))],
             'eye_before': 1,
             'left': '굽이가 완만해 로마 대로치곤 곧음',
             'name': '밀밭 로마 대로',
             'parts': ['trough', 'wheat_b', 'wheat_c', 'wild_b', 'wild_c'],
             'slug': 'wheat-roman-road',
             'what': '칸 단위 계단식 판자띠 길을 픽셀 굽이 연석 돌길(연석·돌판·닳은 가운데·바퀴 자국)로. 소품 5종 재작성.'},
            {'chk': '19 → 0',
             'crops': [('통나무집과 오솔길', (700, 400, 1344, 1100)), ('폐문과 개울', (1344, 600, 2200, 1300))],
             'eye_before': 0,
             'left': '오솔길이 직각으로 꺾임, 폐문이 어두움',
             'name': '깊은 숲길',
             'parts': ['cairn',
                       'cairn_s',
                       'chopping_block',
                       'fern_a',
                       'fern_b',
                       'fern_c',
                       'hide_rack',
                       'hunter_post',
                       'log_fallen',
                       'ruin_gate',
                       'stones_a',
                       'stones_b',
                       'toadstools_a',
                       'toadstools_b',
                       'toadstools_c',
                       'wild_b',
                       'wild_c'],
             'slug': 'deep-forest-path',
             'what': '소품 19종을 윗면+앞면으로 손 도트 재작성. 배치는 그대로.'},
            {'chk': '14 → 0',
             'crops': [('절벽과 계단', (0, 300, 1408, 1000)), ('돌다리와 폭포', (1100, 150, 2000, 700))],
             'eye_before': 0,
             'left': '고개 길이 칸 단위 직각 꺾임(굽이 없음)',
             'name': '산 고개',
             'parts': ['alpine_a', 'alpine_b', 'boulder_m', 'cairn', 'cairn_s', 'guard_post', 'log_fallen', 'scree_a', 'scree_b', 'stone_bridge', 'trail_post', 'trough', 'wall_seg'],
             'slug': 'mountain-pass',
             'what': '소품 14종 재작성. 돌다리는 상판+앞 벽면.'}],
 'title': '버들항 변형 5 — 3/4 재작업 4곳'}
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def sh(*a): return subprocess.run(a, cwd=HERE, capture_output=True).stdout
def before_img(slug, name):
    c = sh('git', 'log', '--format=%H', '--grep=3/4 재작업 — ' + CFG['names'][slug], '--', slug).decode().split()
    if not c: return None
    raw = sh('git', 'show', f'{c[-1]}^:tiledata/beodeul-variants/{slug}/{name}')
    return Image.open(io.BytesIO(raw)).convert('RGBA') if raw else None
css = """body{background:#15171b;color:#e6e1d6;font:14px/1.6 system-ui,'Noto Sans KR',sans-serif;margin:0;padding:24px 32px;max-width:1700px}
h1{font-size:22px}h2{font-size:18px;border-bottom:1px solid #444;padding-bottom:4px;margin-top:44px}h3{font-size:14px;margin:14px 0 4px;color:#cdb87a}
img{image-rendering:pixelated;max-width:100%;display:block;border:1px solid #333}.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.card{background:#1d2026;padding:8px;border-radius:4px}.small{font-size:12px;color:#a9a496}table{border-collapse:collapse;margin:10px 0}
td,th{border:1px solid #444;padding:4px 10px;text-align:left;font-size:13px}th{background:#252a31}.ok{color:#8fd18f}p.a{color:#e0a97a}nav a{color:#9ec5ff;margin-right:14px}"""
h = ['<!doctype html><meta charset=utf-8><title>%s</title><style>%s a{color:#8fc1ff}</style>' % (CFG['title'], css), '<h1>%s</h1>' % CFG['title'],
     '<p class=small>3/4 계약: 땅은 1:1 위에서 본 그림, 기물은 윗면+앞면(옆면 없음), 빛은 왼쪽 위. 전/후 그림은 2x 크롭(원 해상도 1픽셀 = 2픽셀).</p>',
     '<h2>3/4 재작업: 위반 %d건 → 0건</h2>' % sum(p['eye_before'] for p in CFG['places']),
     '<table><tr><th>장소</th><th>검사기 비OK (전 → 후)</th><th>눈으로 본 위반 (전 → 후)</th><th>남은 어색함</th></tr>']
for p in CFG['places']:
    h.append('<tr><td><a href="#%s">%s</a></td><td>%s</td><td class=ok>%d → 0</td><td>%s</td></tr>' % (p['slug'], p['name'], p['chk'], p['eye_before'], html.escape(p['left'])))
h.append('</table>')
for p in CFG['places']:
    s = p['slug']; d = f'{HERE}/{s}'
    h.append('<h2 id=%s>%s</h2><p>%s</p>' % (s, p['name'], html.escape(p['what'])))
    a2 = Image.open(d + '/render-2x.png').convert('RGBA'); b2 = before_img(s, 'render-2x.png')
    for t, fb in p['crops']:
        if max(fb) > 1: fb = (fb[0]/a2.width, fb[1]/a2.height, fb[2]/a2.width, fb[3]/a2.height)
        fb = tuple(min(1.0, max(0.0, v)) for v in fb)
        box = (int(fb[0]*a2.width), int(fb[1]*a2.height), int(fb[2]*a2.width), int(fb[3]*a2.height))
        bb = (int(fb[0]*b2.width), int(fb[1]*b2.height), int(fb[2]*b2.width), int(fb[3]*b2.height)) if b2 is not None else None
        h.append('<h3>%s</h3><div class=row>' % t)
        if b2 is not None:
            h.append('<div class=card><div class=small>전</div><img src="%s"></div>' % uri(b2.crop(bb)))
        h.append('<div class=card><div class=small>후</div><img src="%s"></div></div>' % uri(a2.crop(box)))
    h.append('<h3>전체 1x (후)</h3><img src="%s">' % uri(Image.open(d + '/render-1x.png').convert('RGBA')))
    h.append('<h3>다시 그린 조각 (전 → 후, 3x)</h3><div class=row>')
    for n in p['parts']:
        pa = d + '/parts/%s.png' % n
        if not os.path.exists(pa): continue
        im = Image.open(pa).convert('RGBA'); im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
        bi = before_img(s, 'parts/%s.png' % n)
        cell = ''
        if bi is not None: bi = bi.resize((bi.width * 3, bi.height * 3), Image.NEAREST); cell += '<img src="%s" style="background:#3c5a34">' % uri(bi)
        cell += '<img src="%s" style="background:#3c5a34">' % uri(im)
        h.append('<div class=card style="text-align:center"><div style="display:flex;gap:6px;align-items:flex-end">%s</div><div class=small>%s 전 → 후</div></div>' % (cell, n))
    h.append('</div>')
open(os.path.expanduser('~/claude-viz/beodeul-var-5.html'), 'w', encoding='utf8').write('\n'.join(h))
