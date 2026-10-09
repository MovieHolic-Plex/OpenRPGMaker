"""murim-chipset 하네스 본체. `npm run harness -- murim-chipset <단계>` 또는 `python3 src/harnesses/murim-chipset/harness.py <단계>`.

  validate                         시드·줄·팔레트·판 모듈 점검
  palette                          잠금 팔레트 보고(단마다 밝기 vs joseon_baram 범위, 가장 가까운 조선 램프)
  list [--wave W]                  시드 항목(줄마다 ★ = 사람이 고른 것, 현재 그림과 해시가 맞을 때만)
  draw <판>                        판의 후보를 그려 qa-runs/harnesses/murim-chipset/<판>/ 에 PNG·manifest.json
  gate <판>                        draw + 기계 관문(P Z Q F S R J Y G K / WARN T L N OUTLINE CONTRAST). 줄별로 센다. FAIL 이 있으면 종료코드 1
  sheet <판> [--force]             draw + gate + ~/claude-viz/murim-<판>.html (FAIL 이 있으면 --force 없이는 안 쓴다)
  pick <판> <항목> <후보> [--note]  사람이 고른 후보를 해시에 묶어 (항목, 줄)마다 기록, picked/<줄>/<항목>.png 로 복사
       [--by delegated --basis "…" --review <판정 json>]  사용자가 고르기를 위임한 경우(2026-10-08) — 독립 검수 판정 파일의
                                    그 후보 항목(PASS, 또는 FIX 뒤 fixed_sha256)이 현재 그림 해시와 맞을 때만 기록한다. by·basis·review 가 기록에 남는다.
  reject <판> <항목> <후보> --why   사람이 버린 후보와 이유
  status                           판·관문·줄별 고른 것(현재 그림 해시와 맞는지) 현황 + 외곽선 규칙 경고·굽기 전에 다듬을 목록
  bake --prepare-gate              고른 것(현재 해시)의 기물 조각을 공용 오브젝트 게이트 판정용 items.jsonl·PNG 로 내놓는다(.tmp/murim-bake/gate/)
  bake --dry                       번들을 쓰지 않고 .tmp/murim-bake/dry/ 에만 시트·정의·참고문서·장소를 그린다(게이트 영수증 현황만 보고)
  bake                             실제 굽기 — 기물 조각마다 require_pass(bundle). 하나라도 거절이면 아무것도 쓰지 않는다. 건너뛰기 옵션 없음

줄(line): 화풍을 하나로 고정하지 않고 컨셉 줄(seed `lines`, 예: A 밝은 문파 · B 강남 무관)마다 따로 고른다.
  - 화풍 판(seed rounds.<판>.keys = "letter", style-r1): 후보 글자 = 줄. 줄이 아닌 글자(style-r1 C)는 고를 수 없다.
  - 이후 판(keys = "line"): **줄마다 후보를 그린다.** 후보 키는 <줄><번호>(A1 A2 B1 B2 …), pick 은 앞 글자로 줄을 안다.
    줄의 화풍 기준은 origin 판(style-r1)의 그 글자 조각이다 — 같은 색·결(윤곽은 아래 외곽선 규칙이 우선). 관문 Y 가 재료 램프를 대조한다.
  - 고르기는 (항목, 줄)마다 하나. 같은 항목·같은 줄을 다시 고르면 앞 기록을 대체한다.

외곽선 규칙(사용자 2026-10-08, seed outlineRule — 시연 http://mdc-server:18301/outline-before-after.html):
  - 지형(바닥·벽면·지붕)과 기물(탁자·걸상·문·술독…) 모두 **먹 윤곽 없이** 재질 자신의 명암으로 형태를 읽게 한다.
    빛 받는 위·왼 가장자리 = 그 재질의 밝은 단, 그늘 아래·오른 = 그 재질의 어두운 단. 사람만 외곽선(Actor1 그대로, 그리지 않는다).
  - 예외: 바닥과 밝기가 비슷한 작은 기물(1~2칸)은 그늘 쪽만 그 재질의 가장 어두운 단 + 바닥 닿는 곳 접지 그림자를 진하게. 그래도 먹은 아니다.
  - 큰 구조(벽 덩어리·지붕·계단·난간)도 바깥 실루엣은 재질 어두운 단이지 먹이 아니다.
  - 먹 = palette ink 또는 밝기 ≤ 0.09(mu·wa·zhuz·cao·zhu 0단). ink 색은 비교·그림자(~)용으로만 남는다 — 조각의 불투명 화소에 쓰지 않는다.
  - 관문 OUTLINE·CONTRAST 는 WARN 이다(고른 것만 굽기 전에 다듬을 목록, status). 이미 그린 판의 그림은 사람이 고르는 중이라 고치지 않는다.

감독·에이전트는 pick 을 스스로 부르지 않는다. 사람이 고른 후보를 받아 적을 때만 쓴다.
예외: 사용자가 고르기를 명시적으로 위임했을 때(2026-10-08 「니가 알아서 올리고 다 해라」)만 `--by delegated` 로, 독립 검수 판정 파일을 근거로 기록한다.
화풍 판(style-r1)의 사용자 고르기는 그대로 둔다.
"""
import argparse
import base64
import datetime
import importlib.util
import inspect
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import gate as G  # noqa: E402
import tk  # noqa: E402

REPO = tk.REPO
DATA = tk.DATA
RUNS = os.path.join(REPO, 'qa-runs', 'harnesses', 'murim-chipset')
VIZ = os.path.expanduser('~/claude-viz')
LEDGER = os.path.join(DATA, 'ledger.json')
PICKED = os.path.join(DATA, 'picked')
JOSEON_PALETTE = os.path.join(REPO, 'scripts', 'content', 'lib', 'joseon', 'harness', 'palette.json')
LETTERS = 'ABCDE'
# 공용 오브젝트 게이트 종류(src/harnesses/_core/object_gate KINDS 와 같은 목록 — 모듈이 있으면 그쪽을 쓴다)
GATE_KINDS = ('tall_furniture', 'low_furniture', 'seat', 'frame', 'container', 'round_body', 'column', 'box', 'structure', 'figure',
              'organic', 'flat', 'wall_mounted', 'other')
try:  # noqa: SIM105
    sys.path.insert(0, os.path.join(tk.REPO, 'src', 'harnesses', '_core'))
    from object_gate import KINDS as _GK  # type: ignore
    GATE_KINDS = tuple(_GK)
except Exception:  # 게이트 모듈이 아직 없는 체크아웃 — 위 목록으로 점검만 한다
    pass
KEY_RE = re.compile(r'^([A-Z])(\d+)$')


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def seed():
    return json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))


def items_by_id():
    return {it['id']: it for it in seed()['items']}


def lines():
    """seed 의 컨셉 줄 {id: {name, concept, origin{round,letter}, primary}} (주 줄이 먼저)."""
    L = seed().get('lines', {})
    return dict(sorted(L.items(), key=lambda kv: (not kv[1].get('primary'), kv[0])))


def keys_mode(rid):
    r = seed()['rounds'][rid]
    return r.get('keys') or ('letter' if r['wave'] == 'style' else 'line')


def line_of(rid, key):
    """후보 키 → 줄 id. 화풍 판은 글자 = 줄(줄이 아닌 글자는 None), 이후 판은 <줄><번호> 의 앞 글자."""
    if keys_mode(rid) == 'letter':
        return key if key in lines() else None
    m = KEY_RE.match(key)
    return m.group(1) if m and m.group(1) in lines() else None


def line_label(L):
    ln = lines().get(L)
    return f'줄 {L} {ln["name"]}' if ln else f'{L}(줄 아님)'


def ledger():
    if os.path.exists(LEDGER):
        return json.load(open(LEDGER, encoding='utf-8'))
    return {'picks': [], 'rejects': [], 'runs': []}


def save_ledger(L):
    json.dump(L, open(LEDGER, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(LEDGER, 'a').write('\n')


def load_round(rid):
    s = seed()
    if rid not in s['rounds']:
        raise SystemExit(f'모르는 판: {rid}. 시드 rounds: {", ".join(s["rounds"])}')
    path = os.path.join(REPO, s['rounds'][rid]['module'])
    sys.path.insert(0, os.path.dirname(path))
    spec = importlib.util.spec_from_file_location(f'murim_round_{rid.replace("-", "_")}', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_RENDER_CACHE = {}


def render_round(rid):
    """판 모듈의 후보를 전부 그린다. {항목: {후보 키: (PIL, meta)}}"""
    if rid in _RENDER_CACHE:
        return _RENDER_CACHE[rid]
    mod = load_round(rid)
    out = {}
    for item, cands in mod.CANDIDATES.items():
        out[item] = {}
        for key, fn in cands.items():
            cv, meta = fn()
            out[item][key] = (cv.img(), meta or {})
    _RENDER_CACHE[rid] = (mod, out)
    return mod, out


def line_style(L):
    """줄의 화풍 기준 = origin 판의 그 글자 조각들. {style 항목: PIL}"""
    o = lines()[L]['origin']
    _, rendered = render_round(o['round'])
    return {item: c[o['letter']][0] for item, c in rendered.items() if o['letter'] in c}


def piece_crops(item, im):
    """세트 항목(seed pieces)을 조각별로 자른다. {조각 id: (PIL, 조각 정의)}"""
    out = {}
    for pc in item.get('pieces', []):
        x, y = pc['at'][0] * tk.T, pc['at'][1] * tk.T
        w, h = pc['size'][0] * tk.T, pc['size'][1] * tk.T
        out[pc['id']] = (im.crop((x, y, x + w, y + h)), pc)
    return out


def item_joins(item):
    js = [tuple(j) for j in item.get('joins', [])]
    al = item.get('joinsAll', [])
    for a in al:
        for b in al:
            if a == '@style' and b == '@style':
                continue
            js += [(a, b, 'x'), (a, b, 'y')]
    return js


def cmd_draw(rid, quiet=False):
    mod, rendered = render_round(rid)
    base = os.path.join(RUNS, rid)
    os.makedirs(base, exist_ok=True)
    man = {'round': rid, 'wave': getattr(mod, 'WAVE', None), 'at': now(), 'items': {}}
    for item, cands in rendered.items():
        d = os.path.join(base, item)
        os.makedirs(d, exist_ok=True)
        man['items'][item] = {}
        for key, (im, meta) in cands.items():
            im.save(os.path.join(d, f'{key}.png'))
            im.resize((im.width * 8, im.height * 8), Image.NEAREST).save(os.path.join(d, f'{key}-x8.png'))
            man['items'][item][key] = {'sha256': tk.image_hash(im), 'size': [im.width, im.height], 'line': line_of(rid, key),
                                       'note': meta.get('note', ''), 'top': meta.get('top')}
    json.dump(man, open(os.path.join(base, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not quiet:
        n = sum(len(v) for v in man['items'].values())
        print(f'{rid}: 항목 {len(man["items"])} · 후보 {n} → {os.path.relpath(base, REPO)}/')
    return mod, rendered, man


def _merge(code_results):
    """세트 조각들의 같은 관문 결과를 하나로: 하나라도 실패면 실패, 메시지는 실패한 조각만."""
    out = []
    order = []
    by = {}
    for pid, r in code_results:
        if r['code'] not in by:
            order.append(r['code'])
            by[r['code']] = []
        by[r['code']].append((pid, r))
    for code in order:
        rs = by[code]
        bad = [(pid, r) for pid, r in rs if not r['ok']]
        msg = '; '.join(f'[{pid}] {r["msg"]}' for pid, r in bad) if bad else f'조각 {len(rs)}개 통과'
        out.append(G._res(code, rs[0][1]['level'], not bad, msg))
    return out


def check_candidate(rid, item, key, im, meta, rendered=None):
    """후보 하나의 관문(R 제외). 세트 항목은 조각별 검사 + J(맞물림) + Y(줄 재료). 배치 견본(layout)은 K."""
    if not item.get('pieces'):
        rs = G.check_one(item, im, meta)
    else:
        ew, eh = item['size'][0] * tk.T, item['size'][1] * tk.T
        crops = piece_crops(item, im)
        pm = (meta or {}).get('pieces', {})
        per = [('세트', G._res('Z', 'FAIL', im.size == (ew, eh), f'세트 {im.width}×{im.height} (계약 {ew}×{eh})'))]
        for pid, (cim, pc) in crops.items():
            per += [(pid, r) for r in G.check_one(pc, cim, pm.get(pid, {}), open_sides(item, pid))]
        rs = _merge(per)
        L = line_of(rid, key)
        style = line_style(L) if L else {}
        ref = style.get((item.get('styleRef') or [None])[0])
        bad = []
        for a, b, ax in item_joins(item):
            ia = ref if a == '@style' else crops[a][0]
            ib = ref if b == '@style' else crops[b][0]
            if ia is None or ib is None:
                continue
            ok, seam, lim = G.check_join(ia, ib, ax)
            if not ok:
                bad.append(f'{a}→{b}({ax}) {seam:.3f}>{lim:.3f}')
        n = len(item_joins(item))
        rs.append(G._res('J', 'FAIL', not bad, '맞물림 어긋남 ' + ', '.join(bad) if bad else f'맞물림 {n}쌍 통과'))
    L = line_of(rid, key)
    if L and item.get('styleRef') and keys_mode(rid) == 'line':
        style = line_style(L)
        refs = [style[r] for r in item['styleRef'] if r in style]
        rs.append(G.check_line_material(im, refs, item.get('extraRamps', [])))
    rs += contrast_results(rid, item, key, im)
    if item.get('layout'):
        names = item['layout']['parts']
        miss = [n for n in names.values() if key not in (rendered or {}).get(n, {})]
        if miss:
            rs.append(G._res('K', 'FAIL', False, f'같은 후보 키 {key} 의 {", ".join(miss)} 가 이 판에 없다'))
        else:
            rs.append(G.check_layout(item, im, {n: rendered[n][key] for n in names.values()}))
    return rs


def open_sides(item, pid):
    """세트 조각의 바깥 변(N·S·W·E) = 시드 joins 로 다른 조각과 맞닿는 변을 뺀 나머지. OUTLINE 이 그 변의 테두리 띠만 본다."""
    sides = {'N', 'S', 'W', 'E'}
    for a, b, ax in item_joins(item):
        if a == pid:
            sides.discard('E' if ax == 'x' else 'S')
        if b == pid:
            sides.discard('W' if ax == 'x' else 'N')
    return sides


def contrast_ground(rid, item, key):
    """CONTRAST 의 줄 대표 바닥(그 줄 style 조각). 항목 contrastGround > 시드 outlineRule.contrastGround[묶음]. 없으면 None."""
    rule = seed().get('outlineRule', {})
    gid = item.get('contrastGround') or rule.get('contrastGround', {}).get(item['wave'])
    if not gid:
        return None, None
    if keys_mode(rid) == 'letter':   # 화풍 판: 같은 판·같은 글자의 바닥(줄 아닌 C 도 제 글자 바닥)
        c = render_round(rid)[1].get(gid, {})
        return gid, (c[key][0] if key in c else None)
    L = line_of(rid, key)
    return gid, (line_style(L).get(gid) if L else None)


def contrast_results(rid, item, key, im):
    """CONTRAST(WARN) — 크기 ≤2칸 object(세트면 조각마다). 대상이 아니면 빈 목록."""
    gid, floor = contrast_ground(rid, item, key)
    if floor is None:
        return []
    targets = []
    if item.get('pieces'):
        for pid, (cim, pc) in piece_crops(item, im).items():
            if pc['kind'] == 'object':
                targets.append((pid, cim, pc['size'][0] * pc['size'][1]))
    elif item['kind'] == 'object' and not item.get('layout'):
        targets.append((None, im, item['size'][0] * item['size'][1]))
    rs = [(pid, r) for pid, cim, cells in targets for r in [G.check_contrast(cim, floor, cells)] if r]
    if not rs:
        return []
    for _, r in rs:
        r['msg'] += f' [바닥 {gid}]'
    return _merge(rs) if item.get('pieces') else [rs[0][1]]


def run_gate(rid, rendered):
    items = items_by_id()
    res = {}
    for item, cands in rendered.items():
        if item not in items:
            raise SystemExit(f'판 {rid} 의 항목 {item} 이 시드에 없다')
        rc = G.check_recolor({K: im for K, (im, _) in cands.items()})
        res[item] = {}
        for key, (im, meta) in cands.items():
            res[item][key] = check_candidate(rid, items[item], key, im, meta, rendered) + [rc[key]]
    return res


POLISH_CODES = ('OUTLINE', 'CONTRAST')   # 외곽선 규칙(seed outlineRule) 경고 — 고른 것만 굽기 전에 다듬을 목록


def gate_summary(res):
    fails = [(i, K, r) for i, c in res.items() for K, rs in c.items() for r in rs if r['level'] == 'FAIL' and not r['ok']]
    warns = [(i, K, r) for i, c in res.items() for K, rs in c.items() for r in rs if r['level'] == 'WARN' and not r['ok']]
    return fails, warns


def cmd_gate(rid, quiet=False):
    mod, rendered, man = cmd_draw(rid, quiet=True)
    res = run_gate(rid, rendered)
    json.dump(res, open(os.path.join(RUNS, rid, 'gate.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    fails, warns = gate_summary(res)
    by_line = {}
    for item, cands in res.items():
        for key, rs in cands.items():
            b = by_line.setdefault(line_of(rid, key) or '-', {'cands': 0, 'fail': 0, 'warn': 0})
            b['cands'] += 1
            b['fail'] += sum(1 for r in rs if r['level'] == 'FAIL' and not r['ok'])
            b['warn'] += sum(1 for r in rs if r['level'] == 'WARN' and not r['ok'])
    if not quiet:
        for item, cands in res.items():
            for key, rs in cands.items():
                marks = ' '.join(f"{r['code']}{'✓' if r['ok'] else ('✗' if r['level'] == 'FAIL' else '!')}" for r in rs)
                print(f'{item:22} {key:3} {(line_of(rid, key) or "-"):2} {marks}')
        for i, K, r in fails:
            print(f'  FAIL {i} {K} {r["code"]}: {r["msg"]}')
        for i, K, r in warns:
            print(f'  WARN {i} {K} {r["code"]}: {r["msg"]}')
        for L, b in by_line.items():
            print(f'  {line_label(L) if L != "-" else "줄 없음"}: 후보 {b["cands"]} · FAIL {b["fail"]} · WARN {b["warn"]}')
        print(f'관문: FAIL {len(fails)} · WARN {len(warns)} — 통과는 합격이 아니다(시점·화풍은 사람이 본다)')
    by_code = {}
    for _, _, r in warns:
        by_code[r['code']] = by_code.get(r['code'], 0) + 1
    polish = [{'item': i, 'key': K, 'code': r['code'], 'msg': r['msg']} for i, K, r in warns if r['code'] in POLISH_CODES]
    if not quiet:
        print(f'  외곽선 규칙 경고(굽기 전에 다듬을 것): OUTLINE {by_code.get("OUTLINE", 0)} · CONTRAST {by_code.get("CONTRAST", 0)}')
    L = ledger()
    L['runs'].append({'at': now(), 'stage': 'gate', 'round': rid, 'fail': len(fails), 'warn': len(warns), 'byLine': by_line,
                      'warnByCode': by_code, 'polish': polish,
                      'hashes': {i: {k: v['sha256'] for k, v in c.items()} for i, c in man['items'].items()}})
    save_ledger(L)
    return mod, rendered, man, res, fails


# ---------------------------------------------------------------------------- 시트
def b64(im, k=1):
    if k != 1:
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def joseon_ref(ref):
    sheet = Image.open(os.path.join(REPO, ref['sheet'])).convert('RGBA')
    pieces = json.load(open(os.path.join(REPO, ref['pieces']), encoding='utf-8'))
    p = pieces['pieces'][ref['piece']]
    cols = pieces['cols']
    i = p['id']
    w, h = ref.get('w', p.get('w', 1)), ref.get('h', p.get('h', 1))
    x, y = (i % cols) * 16, (i // cols) * 16
    return sheet.crop((x, y, x + w * 16, y + h * 16))


def actor1():
    s = seed()['characters']
    sh = Image.open(os.path.join(REPO, s['sheet'])).convert('RGBA')
    fw, fh = s['frame']
    fr = sh.crop((fw * 1, fh * 2, fw * 2, fh * 3))  # 첫 캐릭터 · 정면 줄 · 가운데 프레임
    key = sh.getpixel((0, 0))[:3]
    px = fr.load()
    for yy in range(fr.height):
        for xx in range(fr.width):
            if px[xx, yy][:3] == key:
                px[xx, yy] = (0, 0, 0, 0)
    return fr


def tiled(im, nx, ny):
    t = Image.new('RGBA', (im.width * nx, im.height * ny))
    for i in range(nx):
        for j in range(ny):
            t.paste(im, (i * im.width, j * im.height))
    return t


def vignettes(rendered, letter):
    """후보 글자 하나로 6×5 칸(96×80) 장면 두 장: 바깥(지붕·벽·돌바닥·목인장) / 안(벽·마루·탁자). 사람은 Actor1."""
    def get(item):
        c = rendered.get(item, {})
        return c[letter][0] if letter in c else None
    act = actor1()
    out = {}
    roof, wall, stone, dummy = get('roof_tile_eave'), get('inn_wall_pillar'), get('yard_floor_stone'), get('training_dummy')
    if roof and wall and stone:
        v = Image.new('RGBA', (96, 80), (0, 0, 0, 255))
        for x in (0, 48):
            v.paste(roof, (x, 0))
            v.paste(wall, (x, 32))
        st = tiled(stone, 3, 1).crop((0, 0, 96, 16))
        v.paste(st, (0, 64))
        if dummy:
            v.alpha_composite(dummy, (10, 48))
        v.alpha_composite(act, (60, 47))
        out['바깥'] = v
    wood, table = get('inn_floor_wood'), get('round_table_stools')
    if wall and wood:
        v = Image.new('RGBA', (96, 80), (0, 0, 0, 255))
        for x in (0, 48):
            v.paste(wall, (x, 0))
        v.paste(tiled(wood, 3, 2).crop((0, 0, 96, 48)), (0, 32))
        if table:
            v.alpha_composite(table, (12, 38))
        v.alpha_composite(act, (62, 42))
        out['안'] = v
    return out


def joseon_scene():
    """조선 객잔 지도 한 자락(같은 6×5 칸) — 같은 게임에 놓였을 때의 밝기·대비 기준."""
    p = os.path.join(REPO, 'tiledata', 'joseon-interior', 'joseon_in_inn', 'joseon_in_inn-map-people.png')
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert('RGBA')
    return im.crop((128, 16, 224, 96))


CSS = """
body{background:#1e1f22;color:#e6e2da;font:14px/1.5 'Noto Sans KR','Nanum Gothic',sans-serif;margin:0;padding:18px 24px 80px}
h1{font-size:20px;margin:0 0 6px} h2{font-size:17px;margin:34px 0 4px;border-top:1px solid #444;padding-top:16px}
.lead{color:#bdb6a8;max-width:1100px} .warn{color:#ffcf7a}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;margin-top:10px}
.card{background:#2a2b2f;border:1px solid #3c3d42;border-radius:6px;padding:8px 10px;min-width:120px}
.card.ref{background:#26292a;border-color:#3d4a44}
.card h3{font-size:14px;margin:0 0 6px} .card .sub{color:#a9a294;font-size:12px;max-width:340px}
.imgs{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
.imgs figure{margin:0;text-align:center;font-size:11px;color:#8e877c}
.imgs img{image-rendering:pixelated;display:block;background:repeating-conic-gradient(#3a3a3a 0 25%,#454545 0 50%) 0 0/16px 16px}
.badges{margin:6px 0 4px;display:flex;flex-wrap:wrap;gap:4px}
.b{font:12px monospace;padding:1px 5px;border-radius:3px;background:#2f4a35;color:#bfe3c4;cursor:help}
.b.w{background:#5a4a20;color:#ffe2a0} .b.f{background:#6a2626;color:#ffc4c4}
button{background:#3b3d44;color:#e6e2da;border:1px solid #555;border-radius:4px;padding:3px 8px;font-size:12px;cursor:pointer;margin:2px 4px 0 0}
button:hover{background:#4a4d56}
.crit{color:#bdb6a8;font-size:13px;margin:4px 0 0 0;padding-left:18px}
.pal{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.ramp{display:flex;align-items:center;gap:0;font-size:11px;color:#a9a294}
.ramp span.sw{width:16px;height:16px;display:inline-block}
.ramp b{width:120px;font-weight:normal;margin-right:4px}
code{background:#2a2b2f;padding:1px 4px;border-radius:3px}
.lgroup{display:flex;flex-direction:column}
.lgroup>.row{margin-top:4px}
.lineh{margin:0;font-weight:bold;color:#f0c98a;font-size:14px;border-left:4px solid #b5783a;padding-left:8px}
.card.lc{border-color:#7a5a32;background:#2d2924}
.star{color:#ffd166}
.pieces{color:#a9a294;font-size:12px;margin:6px 0 0}
#toast{position:fixed;bottom:16px;right:16px;background:#2f4a35;color:#dfffe4;padding:8px 12px;border-radius:6px;display:none}
"""


def cmd_sheet(rid, force=False):
    mod, rendered, man, res, fails = cmd_gate(rid, quiet=True)
    if fails and not force:
        for i, K, r in fails:
            print(f'  FAIL {i} {K} {r["code"]}: {r["msg"]}')
        raise SystemExit(f'관문 FAIL {len(fails)} — 고친 뒤 다시(--force 는 사람에게 실패를 보여 줄 때만)')
    s = seed()
    mode = keys_mode(rid)
    LN = lines()
    items = items_by_id()
    act = actor1()
    L = ledger()
    picks = {(p['round'], p['item'], p.get('line') or p['letter']): p for p in L['picks']}
    pal = tk.PAL
    wave = s['rounds'][rid]['wave']
    H = []
    H.append(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>무림 칩셋 {rid}</title><style>{CSS}</style></head><body>')
    H.append(f'<h1>무림 칩셋(murim_wuxia) — {rid} <span style="color:#8e877c;font-size:14px">묶음 {wave}: {s["waves"][wave]}</span></h1>')
    if mode == 'letter':
        H.append('<p class="lead">항목마다 후보 A·B·C 를 <b>1배와 4배</b>로, 왼쪽에 <b>조선(joseon_baram) 같은 용도 조각</b>과 <b>Actor1 사람 크기</b>를 같은 배율로 놓았다. '
                 '반복 타일은 3×3 으로 이어 붙인 것도 함께 보인다. 맨 아래에 후보 글자별 6×5 칸 장면이 있다. '
                 '<b>이 판의 후보 글자는 곧 줄(컨셉 계열)이다</b> — 줄마다 하나씩 고른다.</p>')
    else:
        H.append('<p class="lead">이 판은 <b>줄(컨셉 계열)마다 후보를 따로 그렸다</b>. 후보 키 = 줄 글자 + 번호(A1·A2·B1·B2). '
                 '각 줄 후보 왼쪽에 <b>그 줄의 화풍 기준(style-r1 의 그 글자 조각)</b>을 놓았다 — 같은 색·결이어야 한다(윤곽은 외곽선 규칙: 먹 없이 재질 명암, 관문 OUTLINE·CONTRAST 경고). '
                 '세트 항목은 조각 전부를 한 장에 담았고, 옆에 이어 붙인 모습(조립 보기)을 함께 보인다. 맨 아래에 줄별 6×5 칸 객잔 장면이 있다.</p>')
    H.append('<p class="lead warn">고르는 것은 사람이다. 줄마다 하나씩(같은 항목이라도 줄 A 와 줄 B 를 따로) 고른다. 기계 관문(초록 배지)은 깨진 그림만 거르는 것이고 <b>통과가 합격이 아니다</b> — '
             '3/4 시점(윗면이 보이고 옆면이 없는지)·화풍·조선 옆 어울림은 눈으로 판단한다. '
             '버튼은 명령을 복사만 한다. 고른 후보를 알려 주면 그대로 기록한다(고른 기록은 그림 해시에 묶여, 그림이 바뀌면 무효).</p>')
    H.append(f'<p class="lead">만든 때 {man["at"]} · 관문 FAIL {len(fails)} · 판 모듈 <code>{s["rounds"][rid]["module"]}</code></p>')
    # 줄
    H.append('<h2>줄 (컨셉 계열)</h2><div class="row">')
    for lid, ln in LN.items():
        o = ln['origin']
        H.append(f'<div class="card lc"><h3>줄 {lid} · {ln["name"]}{" (주 줄)" if ln.get("primary") else ""}</h3>'
                 f'<div class="sub">{ln["concept"]}</div><div class="sub" style="margin-top:4px">화풍 기준: {o["round"]} 의 {o["letter"]} 조각 · {ln.get("decision", "")}</div></div>')
    H.append('</div>')
    # 팔레트
    H.append('<h2>잠긴 팔레트 (램프 7단, 어두움 → 밝음)</h2><div class="pal">')
    for name, ramp in pal['ramps'].items():
        sw = ''.join(f'<span class="sw" style="background:{c}" title="{c}"></span>' for c in ramp)
        H.append(f'<div class="ramp"><b>{name} · {pal["rampNames"].get(name, "")}</b>{sw}</div>')
    H.append(f'<div class="ramp"><b>ink · 비교·그림자용(조각에 쓰지 않음)</b><span class="sw" style="background:{pal["ink"]}"></span></div>')
    for name, ramp in pal['shared'].items():
        sw = ''.join(f'<span class="sw" style="background:{c}"></span>' for c in ramp)
        H.append(f'<div class="ramp"><b>{name} · 조선 잎 램프 공유</b>{sw}</div>')
    H.append('</div>')

    def badge(r):
        cls = '' if r['ok'] else (' f' if r['level'] == 'FAIL' else ' w')
        mark = '✓' if r['ok'] else ('✗' if r['level'] == 'FAIL' else '!')
        msg = r['msg'].replace('"', '&quot;')
        return f'<span class="b{cls}" title="{msg}">{r["code"]}{mark}</span>'

    def fig(im, k, cap):
        return f'<figure><img src="{b64(im, k)}"><figcaption>{cap}</figcaption></figure>'

    previews = getattr(mod, 'PREVIEWS', {})
    for item, cands in rendered.items():
        it = items[item]
        tiles = f'{it["size"][0]}×{it["size"][1]}칸'
        tl = it.get('tileable')
        H.append(f'<h2>{it["title"]} <span style="color:#8e877c;font-size:13px">({item} · {tiles} · {it["layer"]}{" · 반복 " + tl if tl else ""}'
                 f'{" · 조각 " + str(len(it["pieces"])) if it.get("pieces") else ""})</span></h2>')
        H.append(f'<div class="lead">{it["brief"]}</div><ul class="crit">' + ''.join(f'<li>{c}</li>' for c in it['criteria']) + '</ul>')
        if it.get('walkGrid'):
            H.append('<div class="sub pieces">통행 격자(칸, 위 → 아래): <code>' + ' / '.join(it['walkGrid']) + f'</code> — {it.get("walkNote", "")}</div>')
        if it.get('pieces'):
            H.append('<div class="sub pieces">조각: ' + ' · '.join(
                f'<b>{pc["id"]}</b> {pc["title"]}({pc["size"][0]}×{pc["size"][1]}{", 반복 " + pc["tileable"] if pc.get("tileable") else ""})'
                for pc in it['pieces']) + '</div>')
        H.append('<div class="row">')
        if it.get('joseonRef'):
            try:
                ref = joseon_ref(it['joseonRef'])
                H.append(f'<div class="card ref"><h3>조선 기준</h3><div class="sub">{it["joseonRef"]["label"]}</div><div class="imgs">'
                         + fig(ref, 1, '1×') + fig(ref, 4, '4×') + '</div></div>')
            except Exception as e:  # 기준 조각을 못 읽어도 시트는 만든다
                H.append(f'<div class="card ref"><h3>조선 기준</h3><div class="sub warn">읽기 실패: {e}</div></div>')
        H.append('<div class="card ref"><h3>사람 크기</h3><div class="sub">Actor1 정면(24×32)</div><div class="imgs">'
                 + fig(act, 1, '1×') + fig(act, 4, '4×') + '</div></div>')
        groups = {}
        for key in cands:
            groups.setdefault(line_of(rid, key) or '-', []).append(key)
        order = [g for g in LN if g in groups] + [g for g in groups if g not in LN]
        for g in order:
            H.append(f'<div class="lgroup"><div class="lineh">{line_label(g) if g != "-" else "줄 아님 — 보류(사용자가 말하면 줄로 더한다)"}</div><div class="row">')
            if mode == 'line' and g in LN and it.get('styleRef'):
                st = line_style(g)
                H.append(f'<div class="card ref lc"><h3>줄 {g} 화풍 기준</h3><div class="sub">{LN[g]["origin"]["round"]} {LN[g]["origin"]["letter"]}: '
                         + ', '.join(it['styleRef']) + '</div><div class="imgs">'
                         + ''.join(fig(st[r], 3, f'{r} 3×') for r in it['styleRef'] if r in st) + '</div></div>')
            for key in groups[g]:
                im, meta = cands[key]
                rs = res[item][key]
                p = picks.get((rid, item, g))
                star = f' <span class="star">★ {line_label(g)} 고름</span>' if p and p['letter'] == key else ''
                H.append(f'<div class="card"><h3>후보 {key}{star}</h3><div class="sub">{meta.get("note", "")}</div>')
                H.append('<div class="badges">' + ''.join(badge(r) for r in rs) + '</div><div class="imgs">')
                H.append(fig(im, 1, '1×'))
                zk = getattr(mod, 'SHEET_ZOOM', None) or (4 if im.width <= 64 else 3)   # 판이 정하면 그 배율(props-r1 은 대형도 4배)
                H.append(fig(im, zk, f'{zk}×'))
                if tl and not it.get('pieces'):
                    nx = 3
                    ny = 3 if 'y' in tl else 1
                    H.append(fig(tiled(im, nx, ny), 2, f'{nx}×{ny} 이어 붙임 2×'))
                if item in previews:
                    crops = {pid: c for pid, (c, _) in piece_crops(it, im).items()} if it.get('pieces') else {'_': im}
                    for cap, pv in previews[item](crops, line_style(g) if g in LN else {}):
                        H.append(fig(pv, 2, cap + ' 2×'))
                H.append('</div>')
                pick_cmd = f'npm run harness -- murim-chipset pick {rid} {item} {key}'
                rej_cmd = f'npm run harness -- murim-chipset reject {rid} {item} {key} --why "…"'
                if g in LN:
                    H.append(f'<button data-cmd=\'{pick_cmd}\'>고르기 명령 복사</button>')
                H.append(f'<button data-cmd=\'{rej_cmd}\'>버리기 명령 복사</button>')
                H.append(f'<div class="sub" style="font:11px monospace;color:#6f6a60">{man["items"][item][key]["sha256"][:16]}</div></div>')
            H.append('</div></div>')
        H.append('</div>')

    js = joseon_scene()
    if mode == 'letter':
        H.append('<h2>장면 6×5 칸 (후보 글자별, 3배)</h2><p class="lead">같은 글자끼리 묶은 장면이다. 글자 = 줄. 맨 왼쪽은 조선 객잔 지도의 같은 크기 자락(밝기·대비 기준).</p><div class="row">')
        if js:
            H.append(f'<div class="card ref"><h3>조선 객잔(기준)</h3><div class="imgs">{fig(js, 3, "joseon_in_inn 자락")}</div></div>')
        for key in sorted({K for c in rendered.values() for K in c}):
            vs = vignettes(rendered, key)
            H.append(f'<div class="card"><h3>{key} 묶음 · {line_label(key)}</h3><div class="imgs">' +
                     ''.join(fig(v, 3, k) for k, v in vs.items()) + '</div></div>')
        H.append('</div>')
    elif hasattr(mod, 'scenes'):
        H.append(getattr(mod, 'SCENE_HEAD', '<h2>줄별 장면 6×5 칸 (3배) — 그 줄 style 조각 + 이 판 후보로 객잔 한 모퉁이</h2>'
                 '<p class="lead">같은 번호끼리 묶은 장면이다(항목마다 다른 번호를 골라도 된다). 사람은 Actor1. 맨 왼쪽은 조선 객잔 지도 같은 크기 자락.</p>'))
        nums = sorted({KEY_RE.match(K).group(2) for c in rendered.values() for K in c if KEY_RE.match(K)})
        for g in [x for x in LN if any(line_of(rid, K) == x for c in rendered.values() for K in c)]:
            H.append(f'<div class="lineh">{line_label(g)}</div><div class="row">')
            if js:
                H.append(f'<div class="card ref"><h3>조선 객잔(기준)</h3><div class="imgs">{fig(js, 3, "joseon_in_inn 자락")}</div></div>')
            for n in nums:
                key = f'{g}{n}'

                def get(item, key=key):
                    c = rendered.get(item, {})
                    if key not in c:
                        return None
                    im = c[key][0]
                    return {pid: cc for pid, (cc, _) in piece_crops(items[item], im).items()} if items[item].get('pieces') else im
                takes_key = len(inspect.signature(mod.scenes).parameters) >= 4
                vs = mod.scenes(get, line_style(g), act, key) if takes_key else mod.scenes(get, line_style(g), act)
                H.append(f'<div class="card"><h3>{key} 묶음</h3><div class="imgs">' +
                         ''.join(fig(v, 3, k) for k, v in vs.items()) + '</div></div>')
            H.append('</div>')
    H.append('<div id="toast">복사했다</div><script>document.querySelectorAll("button[data-cmd]").forEach(b=>b.onclick=()=>{const t=b.dataset.cmd;'
             '(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove();})'
             '.finally(()=>{const e=document.getElementById("toast");e.textContent="복사: "+t;e.style.display="block";setTimeout(()=>e.style.display="none",2200);});});</script>')
    H.append('</body></html>')
    os.makedirs(VIZ, exist_ok=True)
    out = os.path.join(VIZ, f'murim-{rid}.html')
    open(out, 'w', encoding='utf-8').write('\n'.join(H))
    print(f'시트 → {out}\n주소 http://mdc-server:18301/murim-{rid}.html (관문 FAIL {len(fails)})')


# ---------------------------------------------------------------------------- 고르기·버리기·현황
def current_hash(rid, item, key):
    _, rendered = render_round(rid)
    if item not in rendered or key not in rendered[item]:
        return None, None
    im = rendered[item][key][0]
    return tk.image_hash(im), im


def picked_path(line, item):
    return os.path.join(PICKED, line, f'{item}.png')


def review_entry(review, rid, item, key):
    """독립 검수 판정 파일에서 (판, 항목, 후보) 항목. 위임 고르기의 근거."""
    path = review if os.path.isabs(review) else os.path.join(REPO, review)
    if not os.path.exists(path):
        raise SystemExit(f'판정 파일이 없다: {review}')
    R = json.load(open(path, encoding='utf-8'))
    hit = [p for p in R.get('picks', []) if p['round'] == rid and p['item'] == item and p.get('candidate') == key]
    if not hit:
        raise SystemExit(f'판정 파일 {review} 에 {rid} {item} {key} 가 없다 — 검수 받지 않은 후보는 위임으로 고를 수 없다')
    return os.path.relpath(path, REPO), hit[-1]


def cmd_pick(rid, item, key, note, by='user', basis='', review=None):
    if by not in ('user', 'delegated'):
        raise SystemExit('--by 는 user 또는 delegated')
    rv = None
    if by == 'delegated':
        if not basis or not review:
            raise SystemExit('위임 고르기는 --basis(사용자 위임 근거)와 --review(독립 검수 판정 파일)가 둘 다 필요하다')
        rv = review_entry(review, rid, item, key)
        if rv[1].get('verdict') not in ('PASS', 'FIX'):
            raise SystemExit(f'판정 {rv[1].get("verdict")} — 위임 고르기는 PASS 또는 고친 FIX 만')
        if rv[1].get('verdict') == 'FIX' and not rv[1].get('fixed_sha256'):
            raise SystemExit('판정 FIX 인데 fixed_sha256 이 없다 — 고친 뒤 판정 파일에 고친 해시를 적어야 한다')
    man_p = os.path.join(RUNS, rid, 'manifest.json')
    if not os.path.exists(man_p):
        raise SystemExit(f'판 {rid} 의 manifest 가 없다 — sheet {rid} 를 먼저(사람이 본 시트가 있어야 고를 수 있다)')
    man = json.load(open(man_p, encoding='utf-8'))
    if item not in man['items'] or key not in man['items'][item]:
        raise SystemExit(f'{rid} 에 {item} {key} 후보가 없다')
    line = line_of(rid, key)
    if not line:
        if keys_mode(rid) == 'letter':
            raise SystemExit(f'{rid} 의 {key} 는 줄이 아니다(seed lines: {", ".join(lines())}). 사용자가 줄로 더하라고 하면 seed lines 에 먼저 더한다')
        raise SystemExit(f'후보 키 {key} 는 <줄><번호> 형식이어야 한다(seed lines: {", ".join(lines())})')
    shown = man['items'][item][key]['sha256']
    cur, im = current_hash(rid, item, key)
    if cur != shown:
        raise SystemExit(f'시트 이후 그림이 바뀌었다(시트 {shown[:12]} ≠ 현재 {str(cur)[:12]}). sheet {rid} 를 다시 만들어 사람에게 다시 보여야 한다')
    if rv:
        judged = rv[1].get('fixed_sha256') or rv[1]['sha256']
        if cur != judged:
            raise SystemExit(f'판정 파일의 그림({judged[:12]}) ≠ 현재 그림({cur[:12]}) — 판정 뒤 그림이 바뀌었다. 다시 검수 받아야 한다')
    os.makedirs(os.path.join(PICKED, line), exist_ok=True)
    im.save(picked_path(line, item))
    L = ledger()
    L['picks'] = [p for p in L['picks'] if not (p['item'] == item and (p.get('line') or p['letter']) == line)] + [
        dict({'round': rid, 'item': item, 'line': line, 'letter': key, 'sha256': cur, 'note': note, 'at': now(), 'by': by},
             **({'basis': basis, 'review': rv[0], 'verdict': rv[1].get('verdict'), 'fixed': bool(rv[1].get('fixed_sha256'))} if rv else {}))]
    save_ledger(L)
    print(f'고름 기록({by}): {item} · {line_label(line)} ← {rid} {key} ({cur[:12]}) → harness-data/murim-chipset/picked/{line}/{item}.png')


def cmd_reject(rid, item, key, why):
    if not why:
        raise SystemExit('--why 가 필요하다(다음 판의 「하지 말 것」이 된다)')
    cur, _ = current_hash(rid, item, key)
    if cur is None:
        raise SystemExit(f'{rid} 에 {item} {key} 후보가 없다')
    L = ledger()
    L['rejects'].append({'round': rid, 'item': item, 'line': line_of(rid, key), 'letter': key, 'sha256': cur, 'why': why, 'at': now(), 'by': 'user'})
    save_ledger(L)
    print(f'버림 기록: {rid} {item} {key} — {why}')


def pick_state():
    """고른 것마다 현재 그림 해시와 맞는지. {(항목, 줄): (pick, 'current'|'VOID 사유')}"""
    L = ledger()
    out = {}
    for p in L['picks']:
        rid = p['round']
        line = p.get('line') or p['letter']
        try:
            c = render_round(rid)[1].get(p['item'], {}).get(p['letter'])
            cur = tk.image_hash(c[0]) if c else None
        except SystemExit:
            cur = None
        f = picked_path(line, p['item'])
        file_hash = tk.image_hash(Image.open(f)) if os.path.exists(f) else None
        if cur != p['sha256']:
            out[(p['item'], line)] = (p, 'VOID — 판 코드의 그림이 고른 뒤 바뀌었다')
        elif file_hash != p['sha256']:
            out[(p['item'], line)] = (p, 'VOID — picked/ 파일이 고른 그림과 다르다')
        else:
            out[(p['item'], line)] = (p, 'current')
    return out


def cmd_status():
    s = seed()
    L = ledger()
    ps = pick_state()
    print(f'무림 칩셋 — 계열 {s["family"]} · 타일셋 {s["tileset"]["id"]} ({s["tileset"]["status"]}, 굽기는 bake 단계 — 게이트 통과분만)')
    for rid in s['rounds']:
        runs = [r for r in L['runs'] if r['round'] == rid]
        last = runs[-1] if runs else None
        man = os.path.join(RUNS, rid, 'manifest.json')
        print(f'판 {rid} (후보 키 {keys_mode(rid)}): 그림 {"있음" if os.path.exists(man) else "없음"} · 마지막 관문 '
              + (f'{last["at"]} FAIL {last["fail"]} WARN {last["warn"]}' if last else '없음')
              + f' · 시트 {"있음" if os.path.exists(os.path.join(VIZ, f"murim-{rid}.html")) else "없음"}')
    by_wave = {}
    for it in s['items']:
        by_wave.setdefault(it['wave'], []).append(it)
    for lid, ln in lines().items():
        o = ln['origin']
        print(f'줄 {lid} · {ln["name"]}{" (주 줄)" if ln.get("primary") else ""} — 화풍 기준 {o["round"]} {o["letter"]}')
        for w, its in by_wave.items():
            got = [i for i in its if ps.get((i['id'], lid), (None, ''))[1] == 'current']
            print(f'  묶음 {w}: {len(got)}/{len(its)} 고름')
            for it in its:
                if (it['id'], lid) in ps:
                    p, st = ps[(it['id'], lid)]
                    print(f'    {it["id"]:22} {p["round"]} {p["letter"]:3} {st}' + ('' if p.get('by', 'user') == 'user' else f' (위임 · {p.get("verdict", "")})'))
    stray = [k for k in ps if k[1] not in lines()]
    for k in stray:
        print(f'  줄 아닌 고름 기록 {k}: {ps[k][1]}')
    print(f'버림 기록 {len(L["rejects"])}건')
    polish_report(L, ps)


def polish_report(L, ps):
    """외곽선 규칙(seed outlineRule) 경고 OUTLINE·CONTRAST — 판별 수와, 고른 것(현재 해시) 중 굽기 전에 다듬을 목록.
    판 그림은 사람이 고르는 중이라 고치지 않는다. 굽는 작업에서 고른 그림만 규칙대로 다듬는다."""
    last = {}
    for r in L['runs']:
        if r.get('stage', 'gate') == 'gate':
            last[r['round']] = r
    print('외곽선 규칙 경고(마지막 관문, WARN — FAIL 아님):')
    for rid, r in last.items():
        if 'polish' not in r:
            print(f'  {rid}: 외곽선 규칙 관문 전 기록 — gate {rid} 를 다시 돌리면 센다')
            continue
        wc = r.get('warnByCode', {})
        print(f'  {rid}: OUTLINE {wc.get("OUTLINE", 0)} · CONTRAST {wc.get("CONTRAST", 0)}')
    todo = []
    for (item, line), (p, st) in sorted(ps.items()):
        r = last.get(p['round'])
        if st != 'current' or not r or 'polish' not in r:
            continue
        todo += [(line, item, p['round'], p['letter'], w) for w in r['polish'] if w['item'] == item and w['key'] == p['letter']]
    print(f'굽기 전에 다듬을 목록(고른 것 중 외곽선 규칙 경고) {len(todo)}건' + (':' if todo else ''))
    for line, item, rid, key, w in todo:
        print(f'  줄 {line} {item:22} {rid} {key:3} {w["code"]}: {w["msg"]}')


def cmd_list(wave=None):
    ps = pick_state()
    LN = list(lines())
    for it in seed()['items']:
        if wave and it['wave'] != wave:
            continue
        mark = ' '.join(f'★{l}' if ps.get((it['id'], l), (None, ''))[1] == 'current' else ' ·' for l in LN)
        print(f'{mark} {it["wave"]:8} {it["id"]:22} {it["size"][0]}×{it["size"][1]} {it["kind"]:6} {it["title"]}')


def cmd_palette():
    rep = G.palette_report(JOSEON_PALETTE)
    print('단:          ' + ' '.join(f'{t:>5}' for t in range(7)))
    print('조선 범위 하: ' + ' '.join(f'{a:5.2f}' for a, b in rep['envelope']))
    print('조선 범위 상: ' + ' '.join(f'{b:5.2f}' for a, b in rep['envelope']))
    for name, r in rep['ramps'].items():
        flag = '' if not r['outOfEnvelope'] and r['monotone'] else '  ✗'
        print(f'{name:6} {tk.PAL["rampNames"].get(name, ""):14} ' + ' '.join(f'{l:5.2f}' for l in r['luma'])
              + f'   가까운 조선 램프 {r["nearestJoseon"]} (거리 {r["midDistance"]}){flag}')
    print('허용 색', len(tk.PAL['allowed']), '· ink', tk.PAL['ink'], '· 그림자 alpha', tk.PAL['shadow']['alpha'])
    for f in rep['fail']:
        print('  FAIL', f)
    return 1 if rep['fail'] else 0


def cmd_validate():
    errs = []
    s = seed()
    if s.get('version') != 1:
        errs.append('version 은 1')
    if s.get('family') != 'oprn-murim' or s.get('tileset', {}).get('id') != 'murim_wuxia':
        errs.append('family=oprn-murim, tileset.id=murim_wuxia 여야 한다')
    ids = set()
    for it in s['items']:
        i = it.get('id')
        if i in ids:
            errs.append(f'항목 id 중복 {i}')
        ids.add(i)
        if it.get('wave') not in s['waves']:
            errs.append(f'{i}: wave {it.get("wave")} 가 waves 에 없다')
        if it.get('kind') not in s['kinds']:
            errs.append(f'{i}: kind {it.get("kind")}')
        if it.get('layer') not in s['layers']:
            errs.append(f'{i}: layer {it.get("layer")}')
        sz = it.get('size')
        if not (isinstance(sz, list) and len(sz) == 2 and all(isinstance(v, int) and v > 0 for v in sz)):
            errs.append(f'{i}: size 는 [칸w, 칸h]')
        if it.get('tileable') not in (None, 'x', 'y', 'xy'):
            errs.append(f'{i}: tileable 은 x|y|xy')
        if not it.get('brief') or not it.get('criteria'):
            errs.append(f'{i}: brief·criteria 필수')
        ref = it.get('joseonRef')
        if ref:
            for k in ('sheet', 'pieces'):
                if not os.path.exists(os.path.join(REPO, ref[k])):
                    errs.append(f'{i}: joseonRef.{k} 파일 없음 {ref[k]}')
        lay = it.get('layout')
        if lay:
            for role, part in lay.get('parts', {}).items():
                tgt = next((x for x in s['items'] if x['id'] == part), None)
                if not tgt or tgt['wave'] != it['wave']:
                    errs.append(f'{i}: layout.parts.{role} = {part} 는 같은 묶음 항목이어야 한다')
            pl = lay.get('place', {})
            if set(lay.get('order', [])) != set(pl) or not {'back', 'table', 'left', 'right', 'front'} <= set(pl):
                errs.append(f'{i}: layout.place 는 back·table·left·right·front, order 는 그 전부')
            for slot, p_ in pl.items():
                if p_.get('part') not in lay.get('parts', {}):
                    errs.append(f'{i}: layout.place.{slot}.part 가 parts 에 없다')
                px, at = p_.get('px'), p_.get('at')
                if not (isinstance(px, list) and len(px) == 2 and isinstance(at, list) and len(at) == 2
                        and all(abs(a_ * tk.T - b_) < 1e-6 for a_, b_ in zip(at, px))):
                    errs.append(f'{i}: layout.place.{slot}: at(칸) × 16 = px 여야 한다')
        wg = it.get('walkGrid')
        if wg is not None:   # 칸 단위 통행 격자: X 막힘 · U 지나감(그림이 사람 위 ★) · F 지나감(바닥 높이 그림) · . 빈 칸
            if len(wg) != it['size'][1] or any(len(r_) != it['size'][0] or set(r_) - set('XUF.') for r_ in wg):
                errs.append(f'{i}: walkGrid 는 {it["size"][1]}줄 × {it["size"][0]}칸, 글자 X·U·F·. 만')
            if not it.get('walkNote'):
                errs.append(f'{i}: walkGrid 에는 walkNote(칸 뜻)가 필요하다')
        for pc in it.get('pieces', []):
            pwg = pc.get('walkGrid')
            if pwg is not None and (len(pwg) != pc['size'][1] or any(len(r_) != pc['size'][0] or set(r_) - set('XUF.') for r_ in pwg)):
                errs.append(f'{i}.{pc["id"]}: 조각 walkGrid 는 {pc["size"][1]}줄 × {pc["size"][0]}칸, 글자 X·U·F·.')
        gk = [it.get('gateKind')] + [pc.get('gateKind') for pc in it.get('pieces', [])]
        for g_ in gk:
            if g_ is not None and g_ not in GATE_KINDS:
                errs.append(f'{i}: gateKind {g_} 는 공용 오브젝트 게이트 종류가 아니다({", ".join(GATE_KINDS)})')
        if it['wave'] != 'style' and it['kind'] == 'object' and not any(gk):
            errs.append(f'{i}: 기물(kind object)은 gateKind 가 필요하다(조각 세트면 조각마다)')
        if it['kind'] in ('tile', 'wall', 'roof') and it.get('gateKind'):
            errs.append(f'{i}: 바닥·벽·지붕은 게이트 kind 를 쓰지 않는다(기존 관문만)')
        style_ids = {x['id'] for x in s['items'] if x['wave'] == 'style'}
        for r_ in it.get('styleRef', []):
            if r_ not in style_ids:
                errs.append(f'{i}: styleRef {r_} 는 style 묶음 항목이 아니다')
        if it.get('pieces'):
            if it.get('tileable'):
                errs.append(f'{i}: 세트 항목은 tileable 을 조각에 둔다')
            pids = set()
            occ = set()
            for pc in it['pieces']:
                pid = pc.get('id')
                if pid in pids or pid == '@style':
                    errs.append(f'{i}: 조각 id {pid} 중복·예약어')
                pids.add(pid)
                if pc.get('kind') not in s['kinds'] or pc.get('tileable') not in (None, 'x', 'y', 'xy'):
                    errs.append(f'{i}.{pid}: kind·tileable')
                (x, y), (w, h) = pc['at'], pc['size']
                if x + w > it['size'][0] or y + h > it['size'][1]:
                    errs.append(f'{i}.{pid}: 세트 크기 밖')
                cells = {(x + dx, y + dy) for dx in range(w) for dy in range(h)}
                if cells & occ:
                    errs.append(f'{i}.{pid}: 다른 조각과 겹친다')
                occ |= cells
            for a_, b_, ax in item_joins(it):
                if ax not in ('x', 'y') or any(z != '@style' and z not in pids for z in (a_, b_)):
                    errs.append(f'{i}: 맞물림 {a_}→{b_}({ax}) 의 조각이 없다')
                if '@style' in (a_, b_) and not it.get('styleRef'):
                    errs.append(f'{i}: @style 맞물림에는 styleRef 가 필요하다')
    LN = s.get('lines', {})
    for lid, ln in LN.items():
        if not KEY_RE.match(lid + '1'):
            errs.append(f'줄 id {lid} 는 대문자 한 글자')
        if not ln.get('name') or not ln.get('concept'):
            errs.append(f'줄 {lid}: name·concept 필수')
        o = ln.get('origin', {})
        if o.get('round') not in s['rounds']:
            errs.append(f'줄 {lid}: origin 판 {o.get("round")} 이 없다')
        elif s['rounds'][o['round']].get('keys', 'letter') != 'letter':
            errs.append(f'줄 {lid}: origin 판은 화풍 판(keys=letter)이어야 한다')
    if LN and sum(1 for ln in LN.values() if ln.get('primary')) != 1:
        errs.append('주 줄(primary)은 하나')
    for w in s['waves']:
        if not any(it['wave'] == w for it in s['items']):
            errs.append(f'묶음 {w} 에 항목이 없다')
    if not os.path.exists(os.path.join(REPO, s['characters']['sheet'])) or 'Actor1' not in s['characters']['sheet']:
        errs.append('characters.sheet 는 있는 Actor1 이어야 한다')
    for f in ('generated-images', 'people', 'side-faces', 'supervisor-pick', 'bake'):
        if f not in {x['id'] for x in s['forbidden']}:
            errs.append(f'forbidden 에 {f} 가 없다')
    for rid, r in s['rounds'].items():
        if not os.path.exists(os.path.join(REPO, r['module'])):
            errs.append(f'판 {rid}: 모듈 없음 {r["module"]}')
            continue
        mod = load_round(rid)
        mode = r.get('keys') or ('letter' if r['wave'] == 'style' else 'line')
        if mode not in ('letter', 'line'):
            errs.append(f'판 {rid}: keys 는 letter|line')
        if mod.WAVE != r['wave']:
            errs.append(f'판 {rid}: 모듈 WAVE {mod.WAVE} ≠ 시드 {r["wave"]}')
        for item, cands in mod.CANDIDATES.items():
            if item not in ids:
                errs.append(f'판 {rid}: 항목 {item} 이 시드에 없다')
            elif s['items'][[x['id'] for x in s['items']].index(item)]['wave'] != r['wave']:
                errs.append(f'판 {rid}: 항목 {item} 은 묶음 {r["wave"]} 이 아니다')
            if mode == 'letter':
                if not set(cands) <= set(LETTERS) or len(cands) < 2:
                    errs.append(f'판 {rid} {item}: 후보 글자는 A~E, 2개 이상')
                continue
            want = r.get('lines') or list(LN)
            per = {}
            for k in cands:
                m = KEY_RE.match(k)
                if not m or m.group(1) not in LN:
                    errs.append(f'판 {rid} {item}: 후보 키 {k} 는 <줄><번호>(줄 {",".join(LN)})')
                    continue
                per.setdefault(m.group(1), []).append(k)
            need = r.get('minPerLine', 2)   # props-r1 처럼 항목이 많은 판은 줄마다 1개(시드 minPerLine)
            for l_ in want:
                if len(per.get(l_, [])) < need:
                    errs.append(f'판 {rid} {item}: 줄 {l_} 후보가 {need}개 미만')
    rep = G.palette_report(JOSEON_PALETTE)
    errs += [f'팔레트: {f}' for f in rep['fail']]
    bk = s.get('bake')
    if bk:
        if bk.get('tilesetId') != s['tileset']['id'] or not bk.get('prefix', '').startswith('mur'):
            errs.append('bake.tilesetId = tileset.id, bake.prefix 는 mur- 로')
        for r_ in bk.get('rounds', []):
            if r_ not in s['rounds']:
                errs.append(f'bake.rounds: {r_} 판이 없다')
        for a_, b_ in bk.get('supersededStyle', {}).items():
            if a_ not in ids or b_ not in ids:
                errs.append(f'bake.supersededStyle {a_} → {b_}: 항목이 없다')
        if any(k for k in bk.get('gate', {}) if 'skip' in k.lower() and k != 'noSkip'):
            errs.append('bake.gate 에 건너뛰기 설정을 두지 않는다')
    for e in errs:
        print('✗', e)
    print(f'시드 항목 {len(ids)} · 묶음 {len(s["waves"])} · 줄 {len(LN)} · 판 {len(s["rounds"])} — ' + ('통과' if not errs else f'오류 {len(errs)}'))
    return 1 if errs else 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog='murim-chipset')
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('validate')
    sub.add_parser('palette')
    p = sub.add_parser('list'); p.add_argument('--wave')
    p = sub.add_parser('draw'); p.add_argument('round')
    p = sub.add_parser('gate'); p.add_argument('round')
    p = sub.add_parser('sheet'); p.add_argument('round'); p.add_argument('--force', action='store_true')
    p = sub.add_parser('pick'); p.add_argument('round'); p.add_argument('item'); p.add_argument('key', help='후보 키 — 화풍 판은 글자(=줄), 이후 판은 <줄><번호>'); p.add_argument('--note', default='')
    p.add_argument('--by', default='user', choices=['user', 'delegated'], help='고른 이 — 기본 user(사람). delegated 는 사용자가 위임했을 때만')
    p.add_argument('--basis', default='', help='위임 근거(사용자 말·날짜)'); p.add_argument('--review', default=None, help='위임 고르기의 독립 검수 판정 파일')
    p = sub.add_parser('reject'); p.add_argument('round'); p.add_argument('item'); p.add_argument('key'); p.add_argument('--why', default='')
    sub.add_parser('status')
    p = sub.add_parser('bake')
    g_ = p.add_mutually_exclusive_group()
    g_.add_argument('--prepare-gate', action='store_true', help='게이트 판정용 items.jsonl·PNG 만 내놓는다')
    g_.add_argument('--dry', action='store_true', help='.tmp 아래에만 그린다(번들 산출물을 쓰지 않는다)')
    a = ap.parse_args(argv)
    if a.cmd == 'validate':
        return cmd_validate()
    if a.cmd == 'palette':
        return cmd_palette()
    if a.cmd == 'list':
        cmd_list(a.wave); return 0
    if a.cmd == 'draw':
        cmd_draw(a.round); return 0
    if a.cmd == 'gate':
        return 1 if cmd_gate(a.round)[4] else 0
    if a.cmd == 'sheet':
        cmd_sheet(a.round, a.force); return 0
    if a.cmd == 'pick':
        cmd_pick(a.round, a.item, a.key.upper(), a.note, a.by, a.basis, a.review); return 0
    if a.cmd == 'reject':
        cmd_reject(a.round, a.item, a.key.upper(), a.why); return 0
    if a.cmd == 'status':
        cmd_status(); return 0
    if a.cmd == 'bake':
        import bake as B  # noqa: E402  (같은 폴더 — 굽기·게이트·참고문서·장소)
        if a.prepare_gate:
            return B.prepare_gate()
        return B.run(dry=a.dry)
    return 2


if __name__ == '__main__':
    sys.exit(main())
