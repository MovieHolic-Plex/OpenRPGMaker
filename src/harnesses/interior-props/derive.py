"""파생 — 이미 고른 기물에서 같은 물건의 다른 그림을 뽑는다(2026-10-04 사용자 「의자 방향 4개, 움직이는 모션, 사이즈 키우기」).

종류 넷:
  facing  방향 4(남·동·북·서)   묶음 그림 한 장 — 원본 칸 + 나머지 방향 칸을 작업자 한 명이 한 판에
  state   상태 전환(열림·켬 …)  묶음 그림 한 장 — 원본 칸 + 다른 상태 칸
  loop    움직임 4프레임        묶음 그림 한 장 — 프레임 0 = 원본, 1~3 은 움직이는 부분만
  size    큰 판(2×2 …)         자식 기물 하나 — 원본을 출발 그림으로 새 칸 수에 다시 그린다

묶음(set)은 하네스 안에서만 쓰는 기물이다: tiledata/hand-interior/new/sets.json → common.load_new_items 가 같이 읽는다.
묶음 그림의 원본 칸은 고정이다(seed.png 그대로 — 검사가 화소를 잰다). 사용자가 묶음 후보를 고르면 칸을 잘라
자식 기물(new/items.json, 또는 이미 있는 짝 chair E 등)의 고른 그림으로 넣는다. 칩셋 메타에는 parent·derive·slot 이 남는다.
"""
import hashlib, json, os, sys, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
from common import CAND, NEW_ITEMS, SETS, atomic_write, geom, objects_by_id, resize_spec, slug  # noqa: E402

FACINGS = ['S', 'E', 'N', 'W']
FACING_KO = {'S': '남', 'E': '동', 'N': '북', 'W': '서'}
FACING_SEE = {'S': '남쪽(화면 아래·카메라 쪽)을 본다 — 앞모습', 'E': '동쪽(화면 오른쪽)을 본다 — 오른쪽을 향한 옆모습',
              'N': '북쪽(벽 쪽)을 본다 — 뒷모습(등받이·뒤판이 앞에 온다)', 'W': '서쪽(화면 왼쪽)을 본다 — 왼쪽을 향한 옆모습'}
LOOP_N = 4
LOOP_MS = 150
STATE_DEFAULT = {'open': '열림', 'switch': '켬', 'sit': '앉음', 'sleep': '누움', 'light': '켬'}
STATE_EN = {'열림': 'open', '닫힘': 'closed', '켬': 'on', '끔': 'off', '앉음': 'sat', '누움': 'lying', '깨짐': 'broken', '빔': 'empty', '가득': 'full'}   # id 는 영문만(slug 가 한글을 지운다)
KIND_KO = {'facing': '방향', 'state': '상태', 'loop': '움직임', 'size': '크기'}


# ---------------------------------------------------------------- 파일
def load_sets():
    if not os.path.exists(SETS): return []
    return json.load(open(SETS, encoding='utf-8')).get('sets', [])


def _save_sets(sets):
    atomic_write(SETS, json.dumps({'about': '소품 하네스 파생 묶음(src/harnesses/interior-props/derive.py). 하네스 안에서만 쓰는 묶음 그림 기물 — 칩셋에는 안 굽고, 고르면 칸을 잘라 자식 기물에 넣는다.',
                                   'sets': sets}, ensure_ascii=False, indent=1) + '\n')


def _add_items(entries):
    """new/items.json 끝에 덧붙인다(같은 id 는 건너뛴다 — batch*.py 와 같은 규칙)."""
    d = json.load(open(NEW_ITEMS, encoding='utf-8'))
    have = {it['id'] for it in d['items']}
    add = [e for e in entries if e['id'] not in have]
    if add:
        d['items'] += add
        atomic_write(NEW_ITEMS, json.dumps(d, ensure_ascii=False, indent=1) + '\n')
    return add


def set_of(o):
    return o.get('set') if o else None


# ---------------------------------------------------------------- 제안
_FACE_RE = __import__('re').compile(r'^([SENW])(\d*)$')   # 「chair E」, 「pew E2」(동쪽을 보는 2칸 긴 의자)


def parent_facing(i):
    t = i.rsplit(' ', 1); m = len(t) == 2 and _FACE_RE.match(t[1])
    return m.group(1) if m else 'S'


def _stem(i):
    """「chair E」 → 「chair」(이름 끝이 방향 글자면). 아니면 None — 짝 기물이 없다. 「pew E2」 같은 길이 붙은 이름은 짝을 찾지 않는다."""
    t = i.rsplit(' ', 1); m = len(t) == 2 and _FACE_RE.match(t[1])
    return t[0] if m and not m.group(2) else None


def _pic(i):
    import brief
    brief.ensure_folder(i)
    return Image.open(brief.cand_png(i, brief.current_choice(i))).convert('RGBA')


_SPEC = {}
def _spec_object(i):
    p = os.path.join(ROOT, 'src/assets/handInteriorSpec.json'); mt = os.path.getmtime(p)
    if _SPEC.get('mt') != mt: _SPEC.update(mt=mt, objs=json.load(open(p, encoding='utf-8'))['objects'])
    return _SPEC['objs'].get(i) or {}


def _use(i, o):
    """쓰임새: 새 기물은 항목에, v5 기물은 조수용 명세(handInteriorSpec.json)에 있다."""
    return set(o.get('use') or _spec_object(i).get('use') or [])


def suggest(i, context=None):
    """파생 창의 체크 기본값. 쓰임새(use)·종류(kind)로 정한다 — 사용자가 확인해야 주문된다."""
    context = context or {}
    by = context.get('by') or objects_by_id(); o = by[i]; use = _use(i, o); k = o['kind']
    fp = geom(o)['footprint']; fw, fh = int(fp.get('w') or 1), int(fp.get('h') or 0)
    st = _stem(i); sib = [f for f in FACINGS if st and f != parent_facing(i) and f'{st} {f}' in by]
    facing_ok = k == 'floor'
    states = o.get('states') or _spec_object(i).get('states') or {}
    state_label = next(iter(states.get('others') or {}), None)
    unlit = i.startswith('unlit ') or states.get('state') in ('끔', '꺼짐') and 'light' in use
    state_label = state_label or ('닫힘' if i.endswith(' open') else '켬' if unlit else
                   next((STATE_DEFAULT[u] for u in ('open', 'switch', 'light', 'sleep', 'sit') if u in use), '다른 상태'))
    out = dict(id=i, name=o['name_ko'], kind=k, kind_ko=o['kind_ko'], use=sorted(use), footprint=[fw, fh],
               facing=dict(ok=facing_ok, checked=facing_ok and ('sit' in use or 'sleep' in use or bool(sib)),
                           why='' if facing_ok else '바닥 기물만 돌릴 수 있다(벽 앞·걸이·바닥 무늬는 늘 남쪽을 본다)',
                           siblings=sib),
               state=dict(ok=k != 'flat' or bool(use & {'open', 'switch'}), checked=bool(use & {'open', 'switch'}) or unlit, label=state_label),
               loop=dict(ok=True, checked='light' in use and not unlit and int(o['atlas'].get('frames') or 1) == 1, frames=LOOP_N, ms=LOOP_MS,
                         why='이미 칩셋에서 움직이는 기물(12프레임)' if int(o['atlas'].get('frames') or 1) > 1 else ''),
               size=dict(ok=k in ('floor', 'wall', 'hang', 'flat'), checked=False, w=min(8, fw * 2), h=min(8, max(1, fh) * 2) if fh else 2),
               sets=[dict(id=s['id'], derive=s['derive'], name=s['name_ko']) for s in (context['sets'] if 'sets' in context else load_sets()) if s['parent'] == i],
               sizes=[dict(id=it['id'], name=it['name_ko']) for it in (context['items'] if 'items' in context else json.load(open(NEW_ITEMS, encoding='utf-8'))['items'])
                      if it.get('parent') == i and it.get('derive') == 'size'])
    return out


def suggestions():
    """기존 원본 전체에서 파생을 먼저 제안한다. 읽기 전용이며 주문/선택을 만들지 않는다."""
    import picks_db, store
    by = objects_by_id(); picks = picks_db.current_all()
    context = dict(by=by, sets=load_sets(), items=json.load(open(NEW_ITEMS, encoding='utf-8'))['items'])
    rounds = {}; runs = {}
    for r in store.rounds(): rounds[r['item']] = r['id']
    for r in store.runs(): runs.setdefault(r['round'], []).append(r)
    def existing(s):
        rr = runs.get(rounds.get(s['id']), [])
        status = ('drawing' if any(r['status'] in ('queued', 'running') for r in rr) else
                  'done' if picks.get(s['id'], {}).get('choice') else 'ready' if any(r['ok'] for r in rr) else 'failed' if rr else 'ordered')
        return dict(id=s['id'], name=s['name'], status=status)
    out = []
    for i, o in by.items():
        if o.get('set') or o.get('parent'): continue
        if o.get('new') and picks.get(i, {}).get('choice') in (None, 'v5'): continue
        # 방향 짝이 있는 가구는 같은 가족을 한 번만 제안한다.
        stem = _stem(i)
        if stem:
            family = [f'{stem} {f}' for f in FACINGS if f'{stem} {f}' in by]
            if family and i != family[0]: continue
        states = o.get('states') or _spec_object(i).get('states') or {}
        if states.get('group') in by and states['group'] != i: continue
        g = suggest(i, context); proposals = []
        for key, title, reason in (
                ('facing', '방향 4', '앉거나 눕는 가구·방향 짝은 남·동·북·서 그림을 맞춥니다.'),
                ('state', g['state']['label'] + ' 상태', '상자·장치·불빛은 원본과 다른 상태의 그림을 제안합니다.'),
                ('loop', '움직임', '불빛 기물은 불꽃·빛이 반복해서 움직이는 그림을 제안합니다.')):
            if not g[key]['ok'] or not g[key]['checked']: continue
            had = [existing(s) for s in g['sets'] if s['derive'] == key]
            proposals.append(dict(key=key, title=title, reason=reason, existing=had))
        if not proposals: continue
        pending = sum(not p['existing'] for p in proposals)
        out.append(dict(id=i, slug=slug(i), name=g['name'], category=o['category_ko'], use=g['use'],
                        current=picks.get(i, {}).get('choice') or 'v5', proposals=proposals, pending=pending))
    out.sort(key=lambda x: (not bool(x['pending']), x['category'], x['name']))
    return dict(items=out, pending=sum(bool(x['pending']) for x in out),
                alreadyOrdered=sum(not bool(x['pending']) for x in out))


# ---------------------------------------------------------------- 묶음 만들기
def _facing_slots(i, o):
    """칸 자리. 남·북은 원본 캔버스, 동·서는 발밑을 돌린 캔버스(가로 칸 = 원본 깊이, 깊이 = 원본 가로). 바닥 맞춤."""
    W, H = geom(o)['canvas']; fp = geom(o)['footprint']; fw, fh = int(fp['w']), max(1, int(fp.get('h') or 1))
    rise = max(0, H - fh * 16)
    pf = parent_facing(i); order = FACINGS[FACINGS.index(pf):] + FACINGS[:FACINGS.index(pf)]
    by = objects_by_id(); stem = _stem(i)
    slots = []
    for f in order:
        side = (f in ('E', 'W')) != (pf in ('E', 'W'))
        w, h = ((fh * 16, fw * 16 + rise) if side else (W, H))
        sib = f'{stem} {f}' if stem else None
        child = i if f == pf else (sib if sib in by and list(geom(by[sib])['canvas']) == [w, h] else f'{i} ~{f}')
        slots.append(dict(key=f, label=('원본 · ' if f == pf else '') + FACING_KO[f], w=w, h=h, child=child, locked=f == pf,
                          see=FACING_SEE[f], foot=[fh, fw] if side else [fw, fh]))
    return slots


def _layout(slots):
    x = 0; SH = max(s['h'] for s in slots)
    for s in slots: s['x'] = x; s['y'] = SH - s['h']; x += s['w']
    return x, SH


def _seed(o_parent, pic, slots, fill):
    W, SH = sum(s['w'] for s in slots), max(s['h'] for s in slots)
    im = Image.new('RGBA', (W, SH))
    for s in slots:
        if s['locked'] or (fill and (s['w'], s['h']) == pic.size): im.alpha_composite(pic, (s['x'], s['y']))
    return im


def _child_entry(o, cid, slot, derive, canvas, foot, extra=''):
    lab = slot['label'].replace('원본 · ', '')
    return dict(id=cid, name_ko=f"{o['name_ko']}({lab})", name_en=f"{o.get('name_en') or o['id']} ({slot['key']})",
                category=o['category'], category_ko=o['category_ko'], kind=o['kind'],
                footprint={'w': foot[0], 'h': foot[1]}, canvas=list(canvas),
                description=f"{o['description'].rstrip()} {extra}".strip(),
                tags=list(o.get('tags') or []), use=sorted(_use(o['id'], o)), refs=[o['id']],
                contextRoom=o.get('contextRoom'), parent=o['id'], derive=derive, slot=slot['key'],
                **({'place': o['place']} if o.get('place') else {}), **({'pair': o['pair']} if o.get('pair') else {}))


def loop_child(sid, parent, s):
    """움직임은 원본과 별개의 기물이다. 후보 선택 전에는 등록하지 않는다."""
    slot = s['slots'][0]
    ent = _child_entry(parent, f'{s["parent"]} ~motion', dict(key='loop', label='움직임'),
                       'loop', (slot['w'], slot['h']), slot['foot'])
    ent['setId'] = sid
    ent['animation'] = {'frames': len(s['slots']), 'ms': s['ms']}
    return ent


def make_set(i, derive, label='', note=''):
    """묶음 기물을 만든다(이미 있으면 원본 그림으로 seed 만 새로). 묶음 id 를 돌려준다."""
    by = objects_by_id(); o = by[i]; pic = _pic(i); W, H = pic.size
    fp = geom(o)['footprint']; fw, fh = int(fp['w']), int(fp.get('h') or 0)
    if derive == 'facing':
        if o['kind'] != 'floor': raise ValueError('방향 파생은 바닥 기물만')
        slots = _facing_slots(i, o); sid = f'{i} #facing'; name = f"{o['name_ko']} · 방향 묶음"
    elif derive == 'state':
        label = (label or '다른 상태').strip()[:12]
        en = STATE_EN.get(label) or 'alt%d' % (sum(map(ord, label)) % 1000)
        slots = [dict(key='base', label='원본', w=W, h=H, child=i, locked=True, foot=[fw, fh]),
                 dict(key=en, label=label, w=W, h=H, child=f'{i} ~{en}', locked=False, foot=[fw, fh])]
        sid = f'{i} #state-{en}'; name = f"{o['name_ko']} · {label}"
    elif derive == 'loop':
        slots = [dict(key=f'f{k}', label='원본 · 0' if k == 0 else str(k), w=W, h=H, child=None, locked=k == 0, foot=[fw, fh]) for k in range(LOOP_N)]
        sid = f'{i} #loop'; name = f"{o['name_ko']} · 움직임 {LOOP_N}프레임"
    else:
        raise ValueError(f'모르는 파생 {derive!r}')
    TW, SH = _layout(slots)
    if SH % 16 or TW % 16: raise ValueError(f'묶음 캔버스 {TW}×{SH} 가 16 의 배수가 아니다')
    sets = [s for s in load_sets() if s['id'] != sid]
    ent = dict(id=sid, name_ko=name, parent=i, derive=derive, kind=o['kind'], category=o['category'], category_ko=o['category_ko'],
               canvas=[TW, SH], footprint={'w': TW // 16, 'h': fh if o['kind'] in ('floor', 'wall', 'flat') else 0},
               description=o['description'], use=sorted(_use(i, o)), tags=list(o.get('tags') or []),
               slots=slots, ms=LOOP_MS if derive == 'loop' else None, created=time.strftime('%Y-%m-%dT%H:%M:%S'), note=note)
    if o['kind'] == 'flat': ent['footprint']['h'] = SH // 16
    sets.append(ent); _save_sets(sets)
    d = os.path.join(CAND, slug(sid)); os.makedirs(d, exist_ok=True)
    _seed(o, pic, slots, derive in ('state', 'loop')).save(os.path.join(d, 'seed.png'))
    for f in ('info.json',):   # 다시 준비(새 seed·팔레트)
        try: os.remove(os.path.join(d, f))
        except OSError: pass
    news = [_child_entry(o, s['child'], s, derive, (s['w'], s['h']), s['foot'],
                         f"({KIND_KO[derive]} 파생: {s['see'] if derive == 'facing' else s['label']})")
            for s in slots if s['child'] and not s['locked'] and s['child'] not in by]
    _add_items(news)
    return sid


def make_size(i, w, h, note=''):
    """큰 판 자식 기물(new/items.json). id = 「원본 ~2x2」."""
    by = objects_by_id(); o = by[i]
    spec = resize_spec(o, int(w), int(h), f'파생: {o["name_ko"]} 큰 판')
    cid = f'{i} ~{w}x{h}'
    ent = _child_entry(o, cid, dict(key=f'{w}x{h}', label=f'{w}×{h}'), 'size', spec['canvas'],
                       [spec['footprint']['w'], spec['footprint']['h']],
                       f"(크기 파생: {w}×{h}칸 큰 판 — 원본을 늘리지 말고 새 칸 수에 맞게 다시 그린 같은 물건) {spec.get('top_note', '')}")
    if spec.get('blockout'): ent['blockout'] = spec['blockout']
    _add_items([ent])
    return cid


# ---------------------------------------------------------------- 작업지시서·검수 글
SET_DIRECTIONS = {
    'facing': [('A', '원본 충실: 원본 칸의 재료·색·장식·비례를 그대로 옮기고 방향만 돌린다.'),
               ('B', '또렷하게: 같은 물건으로 읽히되 각 칸이 한눈에 그 방향으로 읽히게 덩어리(등받이·팔걸이·머리판)를 분명히.')],
    'state': [('A', '상태만 바꾸기: 원본 화소를 그대로 두고 상태가 바뀌는 부분만 고친다(뚜껑·문짝·손잡이·불빛).'),
              ('B', '또렷하게: 한눈에 상태가 바뀐 것이 보이게 바뀐 부분을 크게. 나머지는 원본 그대로.')],
    'loop': [('A', '잔잔하게: 움직이는 부분(불꽃·물·빛·연기)만 프레임마다 1~2화소씩. 몸통은 원본 그대로.'),
             ('B', '또렷하게: 움직임이 한눈에 보이게(불꽃 끝·빛 번짐·물결). 몸통은 원본 그대로.')],
}
SLOT_DIRECTIONS = [('A', '그 칸만 다시(원본 충실): 다른 칸과 같은 물건·같은 색으로, 지적된 것만 고친다.'),
                   ('B', '그 칸만 다시(새 해석): 다른 칸과 한 벌로 읽히게 그 칸을 새로 그린다.')]
SIZE_DIRECTIONS = [('A', '원본 충실: 출발 그림의 재료·색·장식을 그대로, 새 칸 수에 맞게 비례를 다시 잡는다(늘리기 금지).'),
                   ('B', '큰 판답게: 칸이 늘어난 만큼 세부(결·장식·이음)를 한 단 더. 같은 물건으로 읽혀야 한다.')]


def directions(o, slot=''):
    s = set_of(o)
    if s: return SLOT_DIRECTIONS if slot else SET_DIRECTIONS[s['derive']]
    if o.get('derive') == 'size': return SIZE_DIRECTIONS
    return None


def _slot_table(s):
    return [f"| {k + 1} | `{x['key']}` | x={x['x']}~{x['x'] + x['w'] - 1}, y={x['y']}~{x['y'] + x['h'] - 1} ({x['w']}×{x['h']}) | "
            + ('**원본 — 고정, 한 화소도 바꾸지 않는다**' if x['locked'] else (x.get('see') or x['label'])) + ' |'
            for k, x in enumerate(s['slots'])]


def brief_lines(o, base='', slot=''):
    s = set_of(o)
    if not s: return []
    by = objects_by_id(); p = by.get(s['parent']) or {}
    md = [f'## 파생 묶음 — 「{p.get("name_ko", s["parent"])}」의 {KIND_KO[s["derive"]]} (`{s["parent"]}`)', '',
          f'이 그림은 **한 장에 칸 {len(s["slots"])}개가 나란히** 있는 묶음 그림이다({s["canvas"][0]}×{s["canvas"][1]}). 칸마다 같은 물건이다.',
          '`v5.pxg`(= current-x8.png) 에 원본 칸이 이미 채워져 있다. **이 파일을 복사해 출발**하고, 원본 칸은 그대로 둔 채 나머지 칸을 채운다.',
          '칸 밖(칸 사이·칸 위 빈 줄)은 투명하게 둔다. 각 칸의 맨 아래 줄이 바닥 접지선이다.', '',
          '| 순서 | 칸 | 자리(px) | 그릴 것 |', '|---|---|---|---|'] + _slot_table(s) + ['']
    if s['derive'] == 'facing':
        md += ['- 카메라는 늘 남쪽 위에서 내려다본다(3/4). 빛은 늘 **왼쪽 위**에서 온다 — 동·서 칸을 좌우 뒤집기로 만들지 않는다(그림자 쪽이 바뀐다).',
               '- 동·서 칸은 발밑을 돌린 크기다(가로 칸 = 원본의 깊이). 옆모습이지만 꼭대기 면(좌판·윗판)의 윗면은 그대로 보여야 한다.',
               '- 북 칸은 뒷모습: 등받이·뒤판이 남쪽(앞)에 와서 좌판을 가린다.',
               '- 네 칸을 나란히 놓으면 한 물건을 돌린 것으로 읽혀야 한다: 같은 나무색·천 색·장식·다리 굵기.', '']
    elif s['derive'] == 'state':
        md += [f'- 둘째 칸은 같은 물건의 「{s["slots"][1]["label"]}」 상태다. 둘째 칸에도 원본이 미리 복사돼 있다 — **바뀌는 부분만** 고친다.',
               '- 크기·윤곽·색은 원본 그대로. 상태가 바뀐 것이 한눈에 보여야 한다(열린 뚜껑 안쪽이 보임, 켠 불빛 등).', '']
    elif s['derive'] == 'loop':
        md += [f'- 프레임 {LOOP_N}장을 {s.get("ms") or LOOP_MS}ms 마다 돌린다(0→1→2→3→0). 프레임 1~3 에도 원본이 미리 복사돼 있다 — **움직이는 부분만** 바꾼다.',
               '- 몸통(움직이지 않는 부분)은 네 프레임이 한 화소도 다르면 안 된다. 3 다음 0 으로 돌아갈 때 튀지 않게(3 은 0 과 1 사이처럼).', '']
    if slot:
        k = next((x for x in s['slots'] if x['key'] == slot), None)
        md += [f'## 이 판은 칸 하나만 다시 — `{slot}` ({k["label"] if k else ""})', '',
               f'출발 = 사용자가 고른 묶음 후보 `{base}`(`base-x8.png`). **그 파일을 복사해 출발하고 `{slot}` 칸만 고친다** — 다른 칸은 한 화소도 바꾸지 않는다(검사가 잰다).', '']
    return md


def review_text(o):
    s = set_of(o)
    if not s: return ''
    lines = ['', f'## 파생 묶음이다 — 칸 {len(s["slots"])}개(왼쪽부터)', ''] + [f"- 칸 {k + 1} `{x['key']}`: x={x['x']}~{x['x'] + x['w'] - 1}" + (' — 원본(고정, 판정 대상 아님)' if x['locked'] else f" — {x.get('see') or x['label']}") for k, x in enumerate(s['slots'])]
    lines += ['', '`WORSE` 는 쓰지 않는다(pair-x8 왼쪽은 원본 칸만 채운 출발 그림). 대신 본다:',
              '- 원본 칸 옆의 칸들이 **같은 물건**인가(재료·색·장식·크기감) — 아니면 `STYLE`.',
              '- 칸마다 3/4 시점(꼭대기 면 윗면)이 지켜졌나 — 아니면 `FRONT`.']
    if s['derive'] == 'facing':
        lines += ['- 칸마다 표의 방향을 보고 있나(동 = 오른쪽, 서 = 왼쪽, 북 = 뒷모습) — 틀리거나 두 칸이 같은 방향이면 `READ`.',
                  '- 빛이 왼쪽 위에서 오는가 — 동·서 칸이 좌우 뒤집기라 그림자 쪽이 바뀌었으면 `STYLE`.']
    elif s['derive'] == 'state':
        lines += ['- 둘째 칸에서 상태가 바뀐 것이 보이나 — 원본과 거의 같으면 `READ`. 바뀔 부분 밖이 달라졌으면 `STYLE`.']
    elif s['derive'] == 'loop':
        lines += ['- 프레임 사이에 움직이는 부분만 바뀌나, 3→0 이 튀지 않나 — 몸통이 흔들리거나 튀면 `STYLE`. 움직임이 안 보이면 `READ`.']
    return '\n'.join(lines) + '\n'


# ---------------------------------------------------------------- 검사·자르기
def _slot_px(im, x):
    import numpy as np
    return np.array(im.crop((x['x'], x['y'], x['x'] + x['w'], x['y'] + x['h'])))


def lock_check(o, png, brief_dir=None):
    """원본 칸은 seed 그대로, 「칸 하나만 다시」 판이면 다른 칸은 출발 후보 그대로여야 한다. 어긴 것 목록."""
    import numpy as np
    s = set_of(o)
    if not s: return []
    d = os.path.join(CAND, slug(o['id'])); im = Image.open(png).convert('RGBA'); errs = []
    seed = Image.open(os.path.join(d, 'seed.png')).convert('RGBA')
    if im.size != seed.size: return [f'묶음 캔버스 {im.size} ≠ {seed.size}']
    lock = {}
    if brief_dir and os.path.exists(os.path.join(brief_dir, 'lock.json')):
        lock = json.load(open(os.path.join(brief_dir, 'lock.json'), encoding='utf-8'))
    bim = None
    if lock.get('base'):
        import brief
        bim = Image.open(brief.cand_png(o['id'], lock['base'])).convert('RGBA')
    for x in s['slots']:
        ref = seed if x['locked'] else (bim if bim is not None and x['key'] != lock.get('slot') else None)
        if ref is None: continue
        n = int((_slot_px(im, x) != _slot_px(ref, x)).any(axis=2).sum())
        if n: errs.append(f"lock: 칸 `{x['key']}` 은 " + ('원본 칸이라' if x['locked'] else f"이번 판에서 고치지 않는 칸이라({lock.get('base')} 그대로)")
                          + f' 바꾸면 안 된다 — 화소 {n}개 다름. 그 칸은 v5.pxg/출발 후보 그대로 둔다')
    for x in s['slots']:
        if not x['locked'] and not (_slot_px(im, x)[..., 3] > 0).any():
            errs.append(f"empty: 칸 `{x['key']}` 이 비었다 — 칸마다 물건을 그린다")
    return errs


def _pal_and_rows(im):
    from make_jobs import CHARS
    px = im.load(); key = {}; lines = []
    for y in range(im.height):
        row = ''
        for x in range(im.width):
            c = px[x, y]
            if not c[3]: row += '.'; continue
            if c not in key:
                if len(key) >= len(CHARS): raise ValueError('색이 너무 많다')
                key[c] = CHARS[len(key)]
            row += key[c]
        lines.append(row)
    pal = ['// 파생 묶음에서 잘라 낸 그림의 색(derive.py 가 만든다)'] + [f"{k} #{c[0]:02x}{c[1]:02x}{c[2]:02x}" + (f' {c[3]}' if c[3] < 255 else '') for c, k in key.items()]
    return '\n'.join(pal) + '\n', lines


def slice_pick(sid, choice, rnd):
    """묶음 후보를 골랐다 → 칸을 잘라 자식 기물의 고른 그림으로. 넣은 (자식 id, 이름) 목록."""
    import brief, picks_db, store
    by = objects_by_id(); o = by[sid]; s = set_of(o)
    if not s or choice == 'keep': return []
    im = Image.open(brief.cand_png(sid, choice)).convert('RGBA')
    name = choice.split('.')[0]; out = []
    if list(im.size) != list(s['canvas']): raise ValueError('묶음 후보의 캔버스 크기가 다르다')
    if s['derive'] == 'loop':
        ent = loop_child(sid, by[s['parent']], s)
        W, H = ent['canvas']
        if any((x['w'], x['h']) != (W, H) for x in s['slots']): raise ValueError('모션 프레임의 크기가 서로 다르다')
        parts = [im.crop((x['x'], x['y'], x['x'] + W, x['y'] + H)) for x in s['slots']]
        strip = Image.new('RGBA', (W * len(parts), H))
        for k, part in enumerate(parts): strip.paste(part, (k * W, 0))
        _add_items([ent])
        c = ent['id']; d = os.path.join(CAND, slug(c)); os.makedirs(d, exist_ok=True)
        strip.save(os.path.join(d, name + '.loop.png'))
        atomic_write(os.path.join(d, name + '.loop.json'), json.dumps(dict(
            version=1, frames=len(parts), ms=s['ms'], width=W, height=H,
            sha256=hashlib.sha256(strip.tobytes()).hexdigest()), ensure_ascii=False) + '\n')
        _write_pick_image(d, name, parts[0], sid, choice, 'f0')
        picks_db.apply(c, {'choice': name, 'note': f'파생 묶음 {sid} h{rnd} 에서'}, 'web')
        store.add_feedback(c, 'pick', None, name, [], f'파생 묶음 {sid} 에서 움직임 저장')
        sets = load_sets()
        for e in sets:
            if e['id'] == sid: e['picked'] = dict(choice=choice, child=c, at=time.strftime('%Y-%m-%dT%H:%M:%S'))
        _save_sets(sets)
        picks_db.export()
        return [(c, ent['name_ko'])]
    for x in s['slots']:
        if x['locked'] or not x['child']: continue
        c = x['child']; co = by.get(c)
        if not co: continue
        brief.ensure_folder(c)
        d = os.path.join(CAND, slug(c)); part = im.crop((x['x'], x['y'], x['x'] + x['w'], x['y'] + x['h']))
        if list(part.size) != list(geom(co)['canvas']): continue
        _write_pick_image(d, name, part, sid, choice, x['key'])
        picks_db.apply(c, {'choice': name, 'note': f'파생 묶음 {sid} h{rnd} 에서'}, 'web')
        store.add_feedback(c, 'pick', None, name, [], f'파생 묶음 {sid} 에서 자름')
        out.append((c, co['name_ko']))
    try: picks_db.export()
    except Exception as e: print('picks.json 내보내기 실패:', repr(e), flush=True)
    return out


def _write_pick_image(d, name, part, sid, choice, key):
    pal, rows = _pal_and_rows(part)
    atomic_write(os.path.join(d, name + '.pal'), pal)
    atomic_write(os.path.join(d, name + '.pxg'), '\n'.join([
        f'// 파생 묶음 {sid} 의 후보 {choice} 에서 칸 `{key}` 을 잘라 냈다(derive.slice_pick).',
        f'@size {part.width} {part.height}', '@cell 16', f'@palette {name}.pal', '@block 0 0'] + rows) + '\n')
    part.save(os.path.join(d, name + '.png'))
