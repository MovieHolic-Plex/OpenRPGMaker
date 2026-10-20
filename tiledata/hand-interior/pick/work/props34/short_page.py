"""~/claude-viz/v5-props-redraw-1.html — short page: every redrawn prop, original v5 | merged #3087 | round 2, with votes."""
import base64, io, json, os, subprocess, sys, html
sys.path.insert(0, '/home/main/z-project/rpg-zzu-v5-interior-props-34/scripts/content/hand-interior/props34')
import redraw as R
from PIL import Image
W = os.path.dirname(os.path.abspath(__file__))
OUT = '/home/main/claude-viz/v5-props-redraw-1.html'
KO = {k: R.SPEC['objects'][k].get('ko', k) for k in R.SPEC['objects']}


def sheet_at(ref):
    b = subprocess.run(['git', '-C', R.ROOT, 'show', f'{ref}:{R.SHEET_PATH}'], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(b)).convert('RGBA')


def frames_on(sheet, oid):
    old = R.SHEET; R.SHEET = sheet
    try: return R.frames(oid)
    finally: R.SHEET = old


def uri(im, s):
    bg = Image.new('RGBA', im.size, (150, 122, 90, 255)); bg.alpha_composite(im)
    bg = bg.resize((im.width * s, im.height * s), Image.NEAREST)
    b = io.BytesIO(); bg.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


MERGED = sheet_at('eedc48f4a')
NOW = Image.open(os.path.join(R.ROOT, R.SHEET_PATH)).convert('RGBA')
res = R.build()
votes = json.load(open(os.path.join(W, 'argon_r2.json')))['votes']
gate = json.load(open(os.path.join(W, 'gate_r2.json'))) if os.path.exists(os.path.join(W, 'gate_r2.json')) else {}
reasons = json.load(open(os.path.join(W, 'reasons_r2.json'))) if os.path.exists(os.path.join(W, 'reasons_r2.json')) else {}
HELD_BEFORE = {'helmet shelf', 'orrery', 'control console', 'confessional'}


def col(title, im, s):
    return f'<div class="c"><p>{title}</p><img src="{uri(im,1)}"> <img src="{uri(im,s)}"></div>'


def item(oid):
    v = votes[oid]; ok = v[0] * 2 > v[1]
    s = 4 if max(res[oid][0].size) <= 32 else 3
    cand = res[oid][0]
    baked = oid not in held
    tag = ('<b class="ok">반영</b>' if baked else '<b class="no">보류 — 시트는 그대로</b>')
    m = '#3087 병합본' + (' (그때 보류라 원본 그대로)' if oid in HELD_BEFORE else '')
    return (f'<section><h3>{html.escape(KO[oid])} <code>{html.escape(oid)}</code> {tag} '
            f'<span class="v {"ok" if ok else "no"}">Argon 적대 판정 {v[0]}/{v[1]}</span> <span class="g">{html.escape(gate.get(oid, ""))}</span></h3>'
            f'<div class="row">{col("원본 v5", frames_on(R.SHEET, oid)[0], s)}{col(m, frames_on(MERGED, oid)[0], s)}{col("이번 판" + (" (후보, 시트에 안 들어감)" if oid in held else ""), (Image.open(os.path.join(W, 'rv', {'ship bunk': 'ship_bunk_r5_candidate.png', 'relic cabinet': 'relic_cabinet_r2_candidate.png'}[oid])).convert('RGBA') if oid in ('ship bunk', 'relic cabinet') else cand), s)}</div>'
            f'<p class="why">{html.escape(reasons.get(oid, ""))}</p></section>')


ids = list(res)
held = [k for k in ids if not votes[k][0] * 2 > votes[k][1] or not gate.get(k, '').startswith('object-gate(미보정 프로필 1db03a95) PASS')]
okids = [k for k in ids if k not in held]
page = f'''<!doctype html><meta charset="utf-8"><title>v5 실내 기물 다시 그리기 2판</title>
<style>body{{background:#1e1c1a;color:#eee;font:14px sans-serif;margin:16px;max-width:1300px}}img{{image-rendering:pixelated;vertical-align:bottom}}
section{{background:#2a2622;padding:8px 10px;margin:8px 0}}h3{{margin:0 0 6px;font-size:15px}}code{{color:#9cf;font-size:12px}}
.row{{display:flex;gap:18px;align-items:flex-end}}.c p{{margin:0 0 2px;color:#bbb;font-size:12px}}.ok{{color:#8f8}}.no{{color:#f88}}
.v{{font-size:12px;margin-left:8px}}.g{{font-size:12px;color:#ccc;margin-left:8px}}.why{{color:#ffd88a;font-size:12px;margin:4px 0 0}}</style>
<h1>atlas_biome_interior 기물 3/4·품질 — 2판 (2026-10-20)</h1>
<p>#3087 로 넣은 17종은 유효한 관문 없이 들어갔다. 21종 전부를 독립 적대 판정자(Gemini 4 Argon, 3번 판정 과반, 3/4 + 품질 기준표, 좋은 기준 빵 선반·옷장·지구본 / 나쁜 기준 안락의자)로 다시 보고, 떨어진 것을 다시 그렸다.
반영 조건은 둘 다: Argon 과반 통과 <i>그리고</i> object-gate 현재 프로필 PASS. 결과: <b class="ok">{len(okids)}종 통과·반영</b>, <b class="no">{len(held)}종 보류</b>({", ".join(KO[k] for k in held)}). object-gate 는 보정된 프로필이 아직 없어(현재 1db03a95 도 rejected) 정식 영수증이 불가능하다. REFER 3종은 사람 확인 대기 — 아래 회색 글씨는 현재 프로필 잠정 판정.</p>
<h2>보류 {len(held)}종</h2>{"".join(item(k) for k in held)}
<h2>통과·반영 {len(okids)}종</h2>{"".join(item(k) for k in okids)}'''
open(OUT, 'w', encoding='utf-8').write(page); print(OUT, len(held), len(okids))
