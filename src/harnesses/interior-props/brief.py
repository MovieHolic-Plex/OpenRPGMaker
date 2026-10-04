"""작업지시서(brief) — 판 하나에 하나. 작업자(Sonnet)가 읽는 것은 이 폴더뿐이다.

  <DATA>/rounds/h<판>/brief.md        무엇을 · 어떤 캔버스로 · 사용자 메모 · 지난 판에 버린 것과 이유 · 화풍 기준
  <DATA>/rounds/h<판>/current-x8.png  지금 시트에 쓰는 그림(8배)        current.png 원 크기
  <DATA>/rounds/h<판>/context.png     지금 그림을 방 안에 놓은 것(3배)
  <DATA>/rounds/h<판>/anchors/*.png   사용자가 직접 고른 같은 계열 기물(4배) — 화풍 기준. 규칙 글보다 이걸 따른다
  <DATA>/rounds/h<판>/rejected/*.png  이 기물에서 사용자가 버린 후보(4배) — 이렇게 하지 말 것
"""
import glob, json, os, shutil, sqlite3, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
from check_candidate import LINE_THICK_MAX, LINE_NONE_MAX  # noqa: E402
from common import CAND, SHARED_PAL, TOP_MIN_SHALLOW, blockout_image, geom, objects_by_id, slug, top_min, top_rule_text  # noqa: E402
import picks_db  # noqa: E402
import outline_select  # noqa: E402
import store  # noqa: E402

# 방향 — 한 판 5장의 작업자마다 하나. 같은 기물을 다른 해석으로 찍게 해서 사용자가 고를 폭을 만든다.
DIRECTIONS = [
    ('A', '최소 수정: 지금 그림의 디자인·비율·색·결을 그대로 두고, 3/4 로 안 읽히는 곳(얇은 윗면 등)만 고친다. 화소 대부분이 그대로여야 한다.'),
    ('B', '최소 수정 (A 와 다른 해석): 지금 그림을 출발점으로, 윤곽·명암·윗면을 다듬어 더 단단하게. 모양과 크기는 지금과 같게.'),
    ('C', '기준 맞추기: anchors/ 의 고른 기물들과 같은 결(윤곽 굵기·명암 단 수·나뭇결·윗면 두께)로 다시 찍는다. 물건과 크기는 지금 그대로.'),
    ('D', '기준 맞추기 (C 와 다른 해석): anchors/ 의 결을 따르되 디자인을 한 단계 더 다듬는다(장식·비례). 물건은 같다.'),
    ('E', '자유: 같은 화풍(anchors/) 안에서 이 물건을 가장 잘 읽히게 새로 디자인한다. 칸 수·캔버스는 지킨다.'),
]
# 새 기물(아직 고른 그림이 없는 new/items.json 항목) — 빈 캔버스에서 다섯 갈래 디자인.
NEW_DIRECTIONS = [
    ('A', '설명 충실: 설명 문장의 요소를 빠짐없이, 가장 전형적인 SFC 시절 JRPG 모양으로 그린다.'),
    ('B', '같은 방 화풍: anchors/ 와 맥락 방(context.png)의 다른 가구 결을 그대로 따라, 원래 그 방에 있던 물건처럼 그린다.'),
    ('C', '단순·또렷: 16px 칸에서 한눈에 읽히게 덩어리를 크게, 세부는 최소로.'),
    ('D', '장식: 같은 물건을 한 단계 화려하게(금장·문양·빛). 잔점·노이즈는 금지.'),
    ('E', '자유 해석: 같은 쓰임(use)의 물건을 다른 디자인으로 해석한다. 칸 수·캔버스는 지킨다.'),
]
# 둘째 상태(열린 상자·켠 레버 …) — 다른 기물의 고른 그림(base = 「후보@기물」)에서 출발해 상태만 바꾼다.
STATE_DIRECTIONS = [
    ('A', '상태만 바꾸기: 출발 그림(base-x8.png)의 화소를 그대로 두고 상태가 바뀌는 부분만 고친다(뚜껑·손잡이·창살·가시).'),
    ('B', '상태만 바꾸기 (A 와 다른 해석): 바뀐 부분의 모양을 A 와 다르게 해석한다. 나머지는 출발 그림 그대로.'),
    ('C', '또렷하게: 한눈에 상태가 바뀐 것이 보이게 바뀐 부분을 크게. 같은 물건으로 읽혀야 한다.'),
    ('D', '효과: 상태가 바뀐 표시(빛·속이 보임·그림자)를 더한다. 잔점 금지.'),
    ('E', '자유: 같은 물건의 그 상태를 자유롭게. 출발 그림과 한 벌로 읽혀야 한다.'),
]
REASONS = {'view': '시점 이상', 'size': '크기·비율 이상', 'style': '화풍이 다름', 'read': '무슨 물건인지 안 읽힘',
           'messy': '지저분함·잔점', 'worse': '원래 그림이 더 나음'}


def _bg(im, s, bg=(150, 120, 90, 255)):
    b = Image.new('RGBA', im.size, bg); b.alpha_composite(im.convert('RGBA'))
    return b.resize((im.size[0] * s, im.size[1] * s), Image.NEAREST)


def is_new(item):
    """새 기물이고 아직 고른 그림이 없다 = 지금 그림이 빈 캔버스."""
    return bool(objects_by_id()[item].get('new')) and current_choice(item) == 'v5'


def directions(item, base='', slot=''):
    import derive
    d = derive.directions(objects_by_id()[item], slot)   # 파생(묶음·큰 판)은 그 갈래
    if d: return d
    if '@' in (base or ''): return STATE_DIRECTIONS
    if base: return DIRECTIONS
    return NEW_DIRECTIONS if is_new(item) else DIRECTIONS


def base_src(item, base):
    """base = 「h13-D」(이 기물의 후보) 또는 「h13-D@treasure chest」(다른 기물의 후보) → (기물, 후보)."""
    if '@' in base:
        c, src = base.split('@', 1); return src, c
    return item, base


def current_choice(item):
    rec = picks_db.current_all().get(item) or {}
    return rec.get('choice') or 'v5'


def ensure_folder(item):
    d = os.path.join(CAND, slug(item))
    pal = os.path.join(d, 'palette.pal')
    # 공통 팔레트가 바뀌면(v5 → v6) 폴더의 palette.pal 도 새로 만든다 — 다시 그리는 작업자가 새 색을 쓰게
    if not os.path.exists(os.path.join(d, 'info.json')) or not os.path.exists(pal) or os.path.getmtime(pal) < os.path.getmtime(SHARED_PAL):
        subprocess.run([sys.executable, os.path.join(ROOT, 'scripts/content/hand-interior-pick/make_jobs.py'), '--prep', item],
                       cwd=ROOT, check=True, capture_output=True)
    return d


def cand_png(item, choice):
    d = os.path.join(CAND, slug(item))
    b, sel = outline_select.split(choice or '')
    if sel: return outline_select.ensure_png(d, b, objects_by_id()[item])
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
    by = objects_by_id(); head = item.split()[0].split(':')[0]; cat = by[item]['category_ko']
    return [i for i, m in by.items() if i != item and i.split()[0].split(':')[0] == head and m['category_ko'] == cat]


AUDIT = os.path.join(ROOT, 'tiledata/hand-interior/pick/audit/v34-audit-verdicts.json')
FLATKINDS = ('hang', 'flat')   # 벽면 걸이·바닥 무늬 — 평평한 게 정상이라 가구의 기준 그림으로 주면 정면도를 배운다(투구 선반 h49)


def _view_fail():
    """2026-10-01 3/4 전수조사에서 위반으로 나온 v5 원본 — 기준 그림에서 뺀다."""
    try: return {x['key'] for x in json.load(open(AUDIT, encoding='utf-8')) if x.get('rev') == 'FAIL'}
    except (OSError, ValueError): return set()


def _anchor_ok(item, i, choice, bad):
    by = objects_by_id(); o, m = by[item], by.get(i)
    if not m: return False
    if o['kind'] in ('floor', 'wall') and m['kind'] in FLATKINDS: return False
    return not (choice == 'v5' and i in bad)


def anchors(item, k=4):
    by = objects_by_id(); o = by[item]; up = user_picks(); bad = _view_fail()
    out = []
    for i in o.get("refs") or []:   # 새 기물 명세의 refs = 가장 닮은 기존 기물(보물상자 → 상자·왕실 상자)
        if not by.get(i) or not _anchor_ok(item, i, current_choice(i), bad): continue
        ensure_folder(i); p = cand_png(i, current_choice(i))
        if os.path.exists(p): out.append((i, p))
    k = max(k, len(out) + 2)
    same_cat = [i for i in up if i != item and by.get(i) and by[i]['category_ko'] == o['category_ko']]
    same_kind = [i for i in up if i != item and by.get(i) and by[i]['kind'] == o['kind'] and i not in same_cat]
    for i in same_cat + same_kind:
        if any(i == a for a, _ in out) or not _anchor_ok(item, i, up[i], bad): continue
        p = cand_png(i, up[i])
        if os.path.exists(p): out.append((i, p))
        if len(out) >= k: break
    if len(out) < k:   # 사용자가 고른 것이 모자라면 같은 분류의 v5 원본(손 도트 정본 화풍)으로 채운다
        cur = picks_db.current_all(); fam = set(family(item))
        for i, m in by.items():
            if len(out) >= k: break
            if i == item or i in fam or m['category_ko'] != o['category_ko'] or m.get('new'): continue
            if ((cur.get(i) or {}).get('choice') or 'v5') != 'v5' or any(i == a for a, _ in out) or not _anchor_ok(item, i, 'v5', bad): continue
            p = os.path.join(CAND, slug(i), 'v5.png')
            if os.path.exists(p): out.append((i, p))
    if len(out) < k:   # 새 분류라 같은 분류가 없으면: 사용자가 고른 같은 종류(kind) 기물 → 같은 종류 v5 원본
        have = {a for a, _ in out}
        pool = [(i, up[i], 0) for i in up if i != item and by.get(i) and by[i]['kind'] == o['kind']] + \
               [(i, 'v5', 1) for i, m in by.items() if i != item and not m.get('new') and m['kind'] == o['kind']
                and ((picks_db.current_all().get(i) or {}).get('choice') or 'v5') == 'v5']
        for i, ch, _ in pool:
            if len(out) >= k: break
            if i in have or not _anchor_ok(item, i, ch, bad): continue
            p = cand_png(i, ch) if ch != 'v5' else os.path.join(CAND, slug(i), 'v5.png')
            if os.path.exists(p): out.append((i, p)); have.add(i)
    return out


def make(rid, item, note='', base='', slot=''):
    o = objects_by_id()[item]; d = ensure_folder(item); s = slug(item); G = geom(o)
    out = os.path.join(store.DATA, 'rounds', f'h{rid}'); os.makedirs(out, exist_ok=True)
    cur = current_choice(item)
    im = Image.open(cand_png(item, cur)).convert('RGBA')
    im.save(os.path.join(out, 'current.png')); _bg(im, 8).save(os.path.join(out, 'current-x8.png'))
    try:
        sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick')); import context
        ctx, room = context.context_image(o, None if cur == 'v5' else im)
        ctx.resize((ctx.width * 3, ctx.height * 3), Image.NEAREST).save(os.path.join(out, 'context.png'))
    except (Exception, SystemExit) as e:  # 맥락 그림이 안 되는 기물도 판은 돈다
        room = f'(맥락 그림 실패: {e!r})'
    if base:
        bitem, bc = base_src(item, base)
        bim = Image.open(cand_png(bitem, bc)).convert('RGBA'); _bg(bim, 8).save(os.path.join(out, 'base-x8.png'))
        bpxg = os.path.relpath(os.path.join(CAND, slug(bitem), (bc if bc != 'v5' else 'v5') + '.pxg'), ROOT)
    an = anchors(item)
    fam = [(i, cand_png(i, current_choice(i))) for i in family(item)[:6]]
    fam = [(i, p) for i, p in fam if os.path.exists(p)]
    if fam:
        os.makedirs(os.path.join(out, 'family'), exist_ok=True)
        for i, p in fam: _bg(Image.open(p), 8).save(os.path.join(out, 'family', slug(i) + '-x8.png'))
    if an:
        os.makedirs(os.path.join(out, 'anchors'), exist_ok=True)
        for i, p in an: _bg(Image.open(p), 8).save(os.path.join(out, 'anchors', slug(i) + '-x8.png'))
    flat = o['kind'] in FLATKINDS
    if not flat:
        os.makedirs(os.path.join(out, 'view34'), exist_ok=True)
        deep = int(o['footprint']['h']) >= 2
        for f in sorted(glob.glob(os.path.join(HERE, 'examples', '*.png'))) + (sorted(glob.glob(os.path.join(HERE, 'examples-deep', '*.png'))) if deep else []):
            _bg(Image.open(f), 8).save(os.path.join(out, 'view34', os.path.basename(f)[:-4] + '-x8.png'))
    if o.get('blockout'): blockout_image(o).save(os.path.join(out, 'blockout-x8.png'))
    if not flat:
        os.makedirs(os.path.join(out, 'lines'), exist_ok=True)
        for f in sorted(glob.glob(os.path.join(HERE, 'examples-lines', '*.png'))):
            n = os.path.basename(f)
            if n.startswith('good-'): _bg(Image.open(f), 8).save(os.path.join(out, 'lines', n[:-4] + '-x8.png'))
            else: shutil.copy(f, os.path.join(out, 'lines', n))
    rej = [f for f in store.feedback(item) if f['verdict'] == 'reject' and f['cand']]
    lines_rej = []
    if rej:
        os.makedirs(os.path.join(out, 'rejected'), exist_ok=True)
        for f in rej[-8:]:
            p = cand_png(item, f['cand'])
            if os.path.exists(p): _bg(Image.open(p), 8).save(os.path.join(out, 'rejected', f['cand'] + '-x8.png'))
            why = ', '.join(REASONS.get(r, r) for r in f['reasons']) or '이유 없음'
            lines_rej.append(f"- `rejected/{f['cand']}-x8.png` — {why}" + (f" · 「{f['note']}」" if f['note'] else ''))
    notes = [f['note'] for f in store.feedback(item) if f['note'] and f['verdict'] != 'reject']
    md = [f'# 작업지시서 h{rid} — {o["name_ko"]} (`{item}`)', '',
          f'- 물건: {o["description"]}', f'- 종류: {o["kind_ko"]} · 분류: {o["category_ko"]}',
          f'- 캔버스: {G["canvas"][0]}×{G["canvas"][1]} px · 위 패딩 {G["padTop"]} px · 칸 {G["footprint"]["w"]}×{G["footprint"]["h"]}'
          + (' (크기 바뀜: resize.json)' if G['resized'] else ''),
          f'- 후보 폴더: `{os.path.relpath(d, ROOT)}` (팔레트 `palette.pal`, 지금 그림 `{"v5.pxg" if cur == "v5" else cur + ".pxg"}`)',
          f'- 방 안 맥락: `context.png` ({room})', '']
    import derive
    if o.get('set'):
        md += derive.brief_lines(o, base, slot)
    elif is_new(item):
        md += ['## 새 기물 — 지금 그림이 없다', '',
               f'`v5.pxg` 는 빈 캔버스다({G["canvas"][0]}×{G["canvas"][1]}). **위 「물건」 설명대로 처음부터 그린다.** current-x8.png·context.png 에는 아직 이 물건이 없다(방 자리만 본다).',
               f'- 쓰임: {", ".join(o.get("use") or [])} · 놓는 곳: {o.get("place", "")}',
               '- 맨 아래 불투명 줄 = 발밑 칸의 바닥 접지선(캔버스 맨 아래). 솟는 부분은 캔버스 위쪽을 쓴다(위 패딩 없음).',
               '- 같은 방에 놓을 기존 가구(anchors/)와 윤곽 굵기·명암 단 수·크기감이 같아야 한다.', '']
    if note: md += ['## 사용자 메모 (가장 먼저 따른다)', '', note, '']
    if notes: md += ['## 이 기물에 대한 사용자의 지난 말', ''] + [f'- {n}' for n in notes[-5:]] + ['']
    if base and '@' in base and o.get('derive') == 'size':
        bitem, bc = base_src(item, base)
        md += ['## 출발점 — 같은 물건의 작은 판 (크기 파생)', '',
               f'이 기물은 「{objects_by_id()[bitem]["name_ko"]}」(`{bitem}`)를 {G["footprint"]["w"]}×{G["footprint"]["h"]}칸으로 키운 판이다. 사용자가 고른 그 그림 `{bpxg}`(`base-x8.png`)가 기준이다.',
               '- **늘리지(확대하지) 않는다.** 2배 확대 계단 화소는 떨어진다. 새 캔버스에 같은 물건을 16px 칸 화풍 그대로 다시 그린다 — 윤곽 1칸, 명암 단 수·나뭇결 굵기는 원본과 같다.',
               '- 재료·색·장식·비례 느낌은 원본을 따른다. 칸이 늘어난 만큼 세부(결·이음·장식)를 더해도 된다.',
               '- 색은 출발 그림 폴더 palette.pal 의 색만(검사는 이 폴더 palette.pal 로 본다 — 없는 색이면 가장 가까운 공통 팔레트 색).', '']
    elif base and '@' in base:
        bitem, bc = base_src(item, base)
        md += ['## 출발점 — 같은 물건의 다른 상태', '',
               f'이 기물은 「{objects_by_id()[bitem]["name_ko"]}」(`{bitem}`)의 다른 상태다. 사용자가 고른 그 그림 `{bpxg}`(`base-x8.png`)를 **복사해서 출발**한다 — `cp {bpxg} <네 결과 파일>.pxg`.',
               '팔레트가 다르면 출발 그림 폴더의 palette.pal 색과 같은 색만 쓴다(검사가 이 폴더 palette.pal 로 본다 — 없는 색이면 가장 가까운 색으로).',
               '둘을 나란히 놓으면 같은 물건의 두 상태로 읽혀야 한다: 크기·윤곽·색은 그대로, 상태가 바뀌는 부분만 다르다.', '']
    elif base: md += [f'## 출발점', '', f'사용자가 이 후보(`{base}`, `base-x8.png`)를 출발점으로 골랐다. 지금 그림 대신 이걸 다듬는다.', '']
    if fam:
        md += ['## 같은 물건의 짝 (family/) — 이것들과 같은 물건으로 읽혀야 한다', '',
               '같은 디자인·나무색·굵기의 다른 방향(또는 크기)이다. 네 그림을 이 옆에 놓아도 한 벌로 보여야 한다.', '']
        md += [f'- `family/{slug(i)}-x8.png` — {objects_by_id()[i]["name_ko"]} ({current_choice(i)})' for i, _ in fam] + ['']
    md += ['## 화풍 기준 (anchors/)', '',
           '같은 계열 기물(사용자가 고른 것 · 3/4 전수조사를 통과한 원본)이다. **윤곽 굵기·명암 단 수·결·크기감은 이 그림들을 따른다.** 시점(윗면 행 수)은 아래 「시점」 절이 우선한다 — 기준 그림이 그보다 납작하면 시점 절을 따른다.', '']
    md += [f'- `anchors/{slug(i)}-x8.png` — {objects_by_id()[i]["name_ko"]}' + (' **(가장 닮은 기존 기물 — 크기·결을 이것에 맞춘다)**' if i in (o.get('refs') or []) else '')
           for i, _ in an] or ['- (아직 없음 — 지금 그림의 결을 따른다)']
    md += ['']
    if lines_rej: md += ['## 사용자가 버린 후보 (이렇게 하지 말 것)', ''] + lines_rej + ['']
    need = top_min(o) or TOP_MIN_SHALLOW
    if flat:
        md += ['## 시점', '', f'- 이 물건은 {o["kind_ko"]}이다 — 평평한 게 정상이다. 칩셋의 같은 종류(anchors/)처럼 그린다.', '']
    else:
        md += ['## 시점 (3/4) — 재서 지킨다 (2026-10-02: 윗판 없는 정면도가 무더기로 나와 사용자가 지적)', '',
               '**먼저 `view34/` 그림을 연다.** `good-*` 은 칩셋의 3/4 가구, `bad-*` 은 같은 물건의 틀린 그림이다. 둘의 차이(꼭대기 윗면 행 수)를 눈에 익힌 뒤 그린다.', '',
               '- 카메라는 남쪽 위에서 내려다본다. 보이는 면 = **수평 면의 윗면 + 남쪽 면**. 순수 정면도(아이콘)는 틀린다.',
               f'- **꼭대기 면**: 가구의 가장 높은 수평 면(윗판·뚜껑·덮개·좌판·기둥 머리·지붕·받침)의 윗면을 **{need}행 이상**. 칩셋 책장 3~4행 · 옷장 4행 · 찬장 6행 · 벽난로 5행 · 4×2 식탁 24행. {top_rule_text(o)}',
               '  위가 뚫린 틀(기둥만 솟고 윗판이 없다)은 안 된다(`bad-helmet-shelf`).',
               '- **안쪽 판**(선반판·칸막이판)은 윗면 2~3행 + 앞 모서리 1~2행. 안쪽 판이 잘 보여도 꼭대기 판을 대신하지 못한다.',
               '- **얹힌 물건**(투구·책·단지·병·빵·화분)도 정수리·입구·뚜껑의 윗면이 보인다. 납작한 정면 아이콘으로 찍지 않는다(`good-helmet-shelf` 의 투구).',
               '- 「북쪽 벽 앞 기물」은 벽 **앞에 서 있는** 가구다(깊이가 있다). 평평해도 되는 것은 벽면 걸이·바닥 무늬뿐이다 — anchors/ 에 그런 그림이 섞여 보여도 따르지 않는다.',
               '- 윗면 자리가 모자라면 남쪽 면(앞면)을 줄여서 만든다. 꼭대기 윗면을 깎지 않는다.',
               '- 보이는 세운 면은 남쪽 면뿐이다. 옆을 보는 물건(동쪽을 보는 의자 등)의 남쪽 면은 그 물건의 옆모습이다 — 옆모습은 정상.',
               '- 기하 도형(원통·상자)으로 통째로 다시 만들지 마라. 손 도트 화풍(anchors/·지금 그림)을 지킨다.',
               f'- **끝내기 전에 8배 그림에서 세어 메모에 적는다**: `꼭대기 윗면 N행(y=a~b)` (이 꼴 그대로 — 검사가 읽는다). {need}행 미만이면 고친 뒤 끝낸다.',
               f'  검사가 그 y 범위가 한 덩이 면인지(가로 윤곽선이 가로지르지 않는지) 재고, 검수자가 메모를 보지 않고 따로 잰 범위와 반 이상 겹쳐야 한다 — 옆면을 윗면이라 적으면 떨어진다.', '']
        if deep:
            md += ['## 깊은 기물 — 옆모습(측면도) 금지 (2026-10-02: 기차·마차 25장이 전부 옆모습이었다)', '',
                   f'- {top_rule_text(o)}',
                   '- `view34/good-dining-4x2`·`good-magitek-engine-3x2`·`good-canopy-bed-2x2` 처럼 **발밑 깊이만큼 윗면이 길다**. 바퀴 달린 물건·긴 물건도 같다 — 지붕·상판을 위에서 본 긴 면으로 그리고, 남쪽 옆면은 그 아래에 붙인다.',
                   '- `view34/bad-*-side-elevation` 은 이번에 나온 틀린 그림이다: 지붕이 2~4행 띠뿐인 옆모습. 이렇게 그리면 검사·검수가 떨어뜨린다.',
                   '- 캔버스 높이 = 발밑 깊이(칸×16) + 솟는 높이. 윗면 행 수를 먼저 정하고(위 수 이상), 남은 높이를 남쪽 면에 나눈다.', '']
        if o.get('blockout'):
                (t0, t1), (f0, f1) = o['blockout']['top'], o['blockout']['front']; cv = o['blockout'].get('cover', 0.7)
                md += ['## 3/4 밑그림 — 이 띠를 채운다 (명세가 정한 자리, 검사가 잰다)', '',
                       f'`blockout-x8.png` 를 먼저 연다(8배, 16px 칸 선).',
                       f'- **윗면 띠 y={t0}~{t1}** (밝은 회색) = 위에서 내려다본 면(지붕·보일러 등·상판·받침 윗면). 이 줄들은 물건 폭의 {cv:.0%} 이상을 덮어야 한다.',
                       f'- **남쪽 면 띠 y={f0}~{f1}** (어두운 회색) = 남쪽을 보는 세운 면(창·옆판·바퀴·다리). 50% 이상 덮는다.',
                       f'- y<{t0} (빗금) = 굴뚝·돔·조각·날개처럼 위로 솟는 것만. 몸통을 여기로 올리지 않는다.',
                       f'- 메모의 `꼭대기 윗면 N행(y=a~b)` 는 이 윗면 띠와 겹쳐야 한다. 띠가 비거나(옆모습) 다른 데를 적으면 검사가 떨어뜨린다.', '']
    if not flat:
        md += ['## 선 — 재서 지킨다 (2026-10-02: 대형 기물의 외곽이 두껍거나 없다고 사용자가 지적)', '',
               '**먼저 `lines/` 그림을 연다.** `good-*` 은 사용자가 고른 기물(선이 깨끗한 것), `bad-*-marked` 는 왼쪽 원본 · 오른쪽 검사가 칠한 문제 칸이다.', '',
               '- **바깥 테(실루엣 둘레)는 1칸.** 그 바로 안쪽 칸은 테보다 한 단 이상 밝다. 테가 2~3칸 겹쳐 굵어지면 떨어진다(빨강 칸).',
               '- **테는 반드시 있다.** 둘레 칸이 안쪽보다 어둡지 않으면(밝은 테·테 없음) 떨어진다(하늘색 칸). 위·왼쪽 테도 어둡게 두르고, 빛은 그 안쪽 칸에 준다.',
               '- 테 색은 그 재료의 가장 어두운 단이다. 검은 몸통(쇠·옻칠)은 테를 몸통보다 한 단 더 어둡게 하고, 몸통 안쪽 면에 밝은 단을 넣어 테와 몸통을 가른다(`bad-grand-piano` 처럼 묻히지 않게).',
               '- 안쪽 선(판자 이음·문틀·서랍 테)도 1칸이 기본이다. 금테·무늬 띠처럼 일부러 넓은 띠는 괜찮다.',
               f'- 검사 `check_candidate.py` 가 기준(두꺼운 테 ≤{int(LINE_THICK_MAX * 100)}% · 테 없음 ≤{int(LINE_NONE_MAX * 100)}%)을 재고 `<후보>-lines-x6.png` 에 문제 칸을 칠한다. **끝내기 전에 그 그림을 열어 칠해진 칸을 고친다.**', '']
    open(os.path.join(out, 'brief.md'), 'w', encoding='utf-8').write('\n'.join(md))
    store.set_brief(rid, out)
    return out
