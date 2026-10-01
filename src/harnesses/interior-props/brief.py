"""작업지시서(brief) — 판 하나에 하나. 작업자(Sonnet)가 읽는 것은 이 폴더뿐이다.

  <DATA>/rounds/h<판>/brief.md        무엇을 · 어떤 캔버스로 · 사용자 메모 · 지난 판에 버린 것과 이유 · 화풍 기준
  <DATA>/rounds/h<판>/current-x4.png  지금 시트에 쓰는 그림(4배)        current.png 원 크기
  <DATA>/rounds/h<판>/context.png     지금 그림을 방 안에 놓은 것(3배)
  <DATA>/rounds/h<판>/anchors/*.png   사용자가 직접 고른 같은 계열 기물(4배) — 화풍 기준. 규칙 글보다 이걸 따른다
  <DATA>/rounds/h<판>/rejected/*.png  이 기물에서 사용자가 버린 후보(4배) — 이렇게 하지 말 것
"""
import json, os, shutil, sqlite3, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
from common import CAND, geom, objects_by_id, slug  # noqa: E402
import picks_db  # noqa: E402
import store  # noqa: E402

# 방향 — 한 판 5장의 작업자마다 하나. 같은 기물을 다른 해석으로 찍게 해서 사용자가 고를 폭을 만든다.
DIRECTIONS = [
    ('A', '최소 수정: 지금 그림의 디자인·비율·색·결을 그대로 두고, 3/4 로 안 읽히는 곳(얇은 윗면 등)만 고친다. 화소 대부분이 그대로여야 한다.'),
    ('B', '최소 수정 (A 와 다른 해석): 지금 그림을 출발점으로, 윤곽·명암·윗면을 다듬어 더 단단하게. 모양과 크기는 지금과 같게.'),
    ('C', '기준 맞추기: anchors/ 의 고른 기물들과 같은 결(윤곽 굵기·명암 단 수·나뭇결·윗면 두께)로 다시 찍는다. 물건과 크기는 지금 그대로.'),
    ('D', '기준 맞추기 (C 와 다른 해석): anchors/ 의 결을 따르되 디자인을 한 단계 더 다듬는다(장식·비례). 물건은 같다.'),
    ('E', '자유: 같은 화풍(anchors/) 안에서 이 물건을 가장 잘 읽히게 새로 디자인한다. 칸 수·캔버스는 지킨다.'),
]
REASONS = {'view': '시점 이상', 'size': '크기·비율 이상', 'style': '화풍이 다름', 'read': '무슨 물건인지 안 읽힘',
           'messy': '지저분함·잔점', 'worse': '원래 그림이 더 나음'}


def _bg(im, s, bg=(150, 120, 90, 255)):
    b = Image.new('RGBA', im.size, bg); b.alpha_composite(im.convert('RGBA'))
    return b.resize((im.size[0] * s, im.size[1] * s), Image.NEAREST)


def current_choice(item):
    rec = picks_db.current_all().get(item) or {}
    return rec.get('choice') or 'v5'


def ensure_folder(item):
    d = os.path.join(CAND, slug(item))
    if not os.path.exists(os.path.join(d, 'info.json')):
        subprocess.run([sys.executable, os.path.join(ROOT, 'scripts/content/hand-interior-pick/make_jobs.py'), '--prep', item],
                       cwd=ROOT, check=True, capture_output=True)
    return d


def cand_png(item, choice):
    d = os.path.join(CAND, slug(item))
    p = os.path.join(d, ('v5' if choice in (None, 'v5') else choice) + '.png')
    if not os.path.exists(p) and choice not in (None, 'v5'):
        sys.path.insert(0, os.path.join(ROOT, 'scripts/content/pixel-harness/pxgrid')); import pxgrid
        pxgrid.render(p[:-4] + '.pxg', p)
    return p


def user_picks():
    """사용자가 직접 고른 기물 → 후보. 고르는 화면(web·beacon)과 DB 이전 picks.json 가져오기(import:…, 사용자 선택만 있던 시절).
    감독·에이전트가 바꿔 끼운 것(agent-*, supervisor-*)은 화풍 기준에서 뺀다."""
    c = sqlite3.connect(picks_db.DB); c.row_factory = sqlite3.Row
    last = {}
    for r in c.execute("SELECT item_id, choice, client FROM events WHERE kind='pick' ORDER BY id"):
        last[r['item_id']] = (r['choice'], r['client'])
    cur = picks_db.current_all()
    return {i: ch for i, (ch, cl) in last.items()
            if (cl in ('web', 'beacon') or (cl or '').startswith('import')) and ch and ch != 'v5' and (cur.get(i) or {}).get('choice') == ch}


def family(item):
    """같은 물건의 다른 방향·크기(chair E ↔ chair N·S·W, pew ↔ pew E2 …) — 첫 낱말이 같은 기물. 「같은 물건으로 읽혀야」 하는 짝."""
    head = item.split()[0].split(':')[0]
    return [i for i in objects_by_id() if i != item and i.split()[0].split(':')[0] == head]


def anchors(item, k=4):
    by = objects_by_id(); o = by[item]; up = user_picks()
    same_cat = [i for i in up if i != item and by.get(i) and by[i]['category_ko'] == o['category_ko']]
    same_kind = [i for i in up if i != item and by.get(i) and by[i]['kind'] == o['kind'] and i not in same_cat]
    out = []
    for i in same_cat + same_kind:
        p = cand_png(i, up[i])
        if os.path.exists(p): out.append((i, p))
        if len(out) >= k: break
    if len(out) < k:   # 사용자가 고른 것이 모자라면 같은 분류의 v5 원본(손 도트 정본 화풍)으로 채운다
        cur = picks_db.current_all(); fam = set(family(item))
        for i, m in by.items():
            if len(out) >= k: break
            if i == item or i in fam or m['category_ko'] != o['category_ko'] or m.get('new'): continue
            if ((cur.get(i) or {}).get('choice') or 'v5') != 'v5' or any(i == a for a, _ in out): continue
            p = os.path.join(CAND, slug(i), 'v5.png')
            if os.path.exists(p): out.append((i, p))
    return out


def make(rid, item, note='', base=''):
    o = objects_by_id()[item]; d = ensure_folder(item); s = slug(item); G = geom(o)
    out = os.path.join(store.DATA, 'rounds', f'h{rid}'); os.makedirs(out, exist_ok=True)
    cur = current_choice(item)
    im = Image.open(cand_png(item, cur)).convert('RGBA')
    im.save(os.path.join(out, 'current.png')); _bg(im, 4).save(os.path.join(out, 'current-x4.png'))
    try:
        sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick')); import context
        ctx, room = context.context_image(o, None if cur == 'v5' else im)
        ctx.resize((ctx.width * 3, ctx.height * 3), Image.NEAREST).save(os.path.join(out, 'context.png'))
    except Exception as e:  # 맥락 그림이 안 되는 기물도 판은 돈다
        room = f'(맥락 그림 실패: {e!r})'
    if base:
        bim = Image.open(cand_png(item, base)).convert('RGBA'); _bg(bim, 4).save(os.path.join(out, 'base-x4.png'))
    an = anchors(item)
    fam = [(i, cand_png(i, current_choice(i))) for i in family(item)[:6]]
    fam = [(i, p) for i, p in fam if os.path.exists(p)]
    if fam:
        os.makedirs(os.path.join(out, 'family'), exist_ok=True)
        for i, p in fam: _bg(Image.open(p), 4).save(os.path.join(out, 'family', slug(i) + '-x4.png'))
    if an:
        os.makedirs(os.path.join(out, 'anchors'), exist_ok=True)
        for i, p in an: _bg(Image.open(p), 4).save(os.path.join(out, 'anchors', slug(i) + '-x4.png'))
    rej = [f for f in store.feedback(item) if f['verdict'] == 'reject' and f['cand']]
    lines_rej = []
    if rej:
        os.makedirs(os.path.join(out, 'rejected'), exist_ok=True)
        for f in rej[-8:]:
            p = cand_png(item, f['cand'])
            if os.path.exists(p): _bg(Image.open(p), 4).save(os.path.join(out, 'rejected', f['cand'] + '-x4.png'))
            why = ', '.join(REASONS.get(r, r) for r in f['reasons']) or '이유 없음'
            lines_rej.append(f"- `rejected/{f['cand']}-x4.png` — {why}" + (f" · 「{f['note']}」" if f['note'] else ''))
    notes = [f['note'] for f in store.feedback(item) if f['note'] and f['verdict'] != 'reject']
    md = [f'# 작업지시서 h{rid} — {o["name_ko"]} (`{item}`)', '',
          f'- 물건: {o["description"]}', f'- 종류: {o["kind_ko"]} · 분류: {o["category_ko"]}',
          f'- 캔버스: {G["canvas"][0]}×{G["canvas"][1]} px · 위 패딩 {G["padTop"]} px · 칸 {G["footprint"]["w"]}×{G["footprint"]["h"]}'
          + (' (크기 바뀜: resize.json)' if G['resized'] else ''),
          f'- 후보 폴더: `{os.path.relpath(d, ROOT)}` (팔레트 `palette.pal`, 지금 그림 `{"v5.pxg" if cur == "v5" else cur + ".pxg"}`)',
          f'- 방 안 맥락: `context.png` ({room})', '']
    if note: md += ['## 사용자 메모 (가장 먼저 따른다)', '', note, '']
    if notes: md += ['## 이 기물에 대한 사용자의 지난 말', ''] + [f'- {n}' for n in notes[-5:]] + ['']
    if base: md += [f'## 출발점', '', f'사용자가 이 후보(`{base}`, `base-x4.png`)를 출발점으로 골랐다. 지금 그림 대신 이걸 다듬는다.', '']
    if fam:
        md += ['## 같은 물건의 짝 (family/) — 이것들과 같은 물건으로 읽혀야 한다', '',
               '같은 디자인·나무색·굵기의 다른 방향(또는 크기)이다. 네 그림을 이 옆에 놓아도 한 벌로 보여야 한다.', '']
        md += [f'- `family/{slug(i)}-x4.png` — {objects_by_id()[i]["name_ko"]} ({current_choice(i)})' for i, _ in fam] + ['']
    md += ['## 화풍 기준 (anchors/)', '',
           '사용자가 직접 고른 같은 계열 기물이다. **규칙 문장보다 이 그림들을 따른다** — 윤곽 굵기, 명암 단 수, 윗면 두께, 결.', '']
    md += [f'- `anchors/{slug(i)}-x4.png` — {objects_by_id()[i]["name_ko"]}' for i, _ in an] or ['- (아직 없음 — 지금 그림의 결을 따른다)']
    md += ['']
    if lines_rej: md += ['## 사용자가 버린 후보 (이렇게 하지 말 것)', ''] + lines_rej + ['']
    md += ['## 시점 (3/4) — 이것만', '',
           '- 카메라는 남쪽 위에서 내려다본다. **수평 면(상판·좌판·뚜껑·입구·선반판)은 위에서 보이는 면으로 몇 줄 보인다.**',
           '- 보이는 세운 면은 남쪽 면뿐이다. 옆을 보는 물건(동쪽을 보는 의자 등)의 남쪽 면은 그 물건의 옆모습이다 — 옆모습은 정상.',
           '- 기하 도형(원통·상자)으로 통째로 다시 만들지 마라. 손 도트 화풍(anchors/·지금 그림)을 지킨다.', '']
    open(os.path.join(out, 'brief.md'), 'w', encoding='utf-8').write('\n'.join(md))
    store.set_brief(rid, out)
    return out
